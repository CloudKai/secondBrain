import {useEffect,useSyncExternalStore} from 'react';
import {z} from 'zod';
import type {SourceClient} from './source-client';
import {DraftConflictError,type DraftSlot,type LessonDraft,type DraftSave} from './learning-draft';

const pendingSchema=z.object({text:z.string().refine(text=>Array.from(text).length<=5000),expected_revision:z.number().int().nonnegative().safe(),save_id:z.string().uuid()}).strict();
const cacheSchema=z.object({pending:pendingSchema,retry:pendingSchema.nullable()}).strict();
type Status='loading'|'saved'|'unsaved'|'saving'|'error'|'conflict'|'signedout';
interface DraftState {text:string;status:Status;error:string;memoryOnly:boolean;saved:LessonDraft|null;conflict:LessonDraft|null}
const blank:DraftState={text:'',status:'loading',error:'',memoryOnly:false,saved:null,conflict:null};
const prefix='learning-draft.v1:';
const workspaces=new WeakMap<SourceClient,DraftWorkspace>();
// Slots outlive an editor unmount. Serialized writes finish on navigation, and
// tab-private session storage protects pending text across reloads without
// letting another tab overwrite or clear its recovery copy.
class DraftWorkspace {
 owner:string|null=null;
 slots=new Map<string,DraftEditor>();
 connected=false;
 constructor(readonly client:SourceClient){}
 connect(){
  if(this.connected)return;this.connected=true;
  this.client.onDraftOwnerChange(owner=>{
   if(this.owner&&owner!==this.owner){
    try{for(const key of Object.keys(sessionStorage))if(key.startsWith(`${prefix}${this.owner}:`))sessionStorage.removeItem(key);}catch{/* Each editor also reports unavailable browser storage. */}
    for(const slot of this.slots.values())slot.expire();this.owner=null;
   }
  });
 }
 editor(slot:DraftSlot){
  const key=JSON.stringify(slot);let editor=this.slots.get(key);
  if(!editor){editor=new DraftEditor(this,slot);this.slots.set(key,editor);}
  return editor;
 }
}
class DraftEditor {
 state:DraftState=blank;
 listeners=new Set<()=>void>();
 owner:string|null=null;
 pending:DraftSave|null=null;
 retryWrite:DraftSave|null=null;
 timer:ReturnType<typeof setTimeout>|null=null;
 loading=false;writing=false;expired=false;
 constructor(readonly workspace:DraftWorkspace,readonly slot:DraftSlot){}
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
 snapshot=()=>this.state;
 update(patch:Partial<DraftState>){if(this.expired)return;this.state={...this.state,...patch};for(const listener of this.listeners)listener();}
 get key(){return `${prefix}${this.owner}:${this.slot.collectionId}:${this.slot.planId}:${this.slot.lessonIndex}:${this.slot.kind}`;}
 persist(){
  if(!this.owner||this.expired)return;
  try{if(this.pending)sessionStorage.setItem(this.key,JSON.stringify({pending:this.pending,retry:this.retryWrite}));else sessionStorage.removeItem(this.key);this.update({memoryOnly:false});}
  catch{this.update({memoryOnly:true});}
 }
 expire(){
  if(this.timer)clearTimeout(this.timer);this.pending=null;this.retryWrite=null;
  this.update({text:'',saved:null,conflict:null,status:'signedout',error:'Your session changed. Reopen the collection.'});this.expired=true;
 }
 async read(){const s=this.slot;return this.workspace.client.getLearningDraft(s.collectionId,s.planId,s.lessonIndex,s.kind);}
 async load(){
  if(this.loading||this.writing||this.expired)return;this.loading=true;
  try{
   const owner=await this.workspace.client.draftOwner();if(this.expired)return;
   this.owner=owner;this.workspace.owner=owner;
   if(!this.pending){
    try{const parsed=cacheSchema.safeParse(JSON.parse(sessionStorage.getItem(this.key)??'null'));
     if(parsed.success&&[parsed.data.pending,parsed.data.retry].every(write=>!write||Array.from(write.text).length<=(this.slot.kind==='answer'?5000:2000))){this.pending=parsed.data.pending;this.retryWrite=parsed.data.retry;this.update({text:this.pending.text});}
    }catch{this.update({memoryOnly:true});}
   }
   const saved=await this.read();if(this.expired)return;
   this.update({saved,error:''});
   if(!this.pending){this.update({text:saved.text,status:'saved',conflict:null});return;}
   if(this.pending.text===saved.text){this.pending=null;this.retryWrite=null;this.persist();this.update({text:saved.text,status:'saved',conflict:null});return;}
   // A lost response may have committed the older text while typing continued.
   if(this.retryWrite&&saved.save_id===this.retryWrite.save_id&&saved.text===this.retryWrite.text){this.retryWrite=null;this.pending={...this.pending,expected_revision:saved.revision,save_id:crypto.randomUUID()};}
   if(this.pending.expected_revision!==saved.revision){this.update({status:'conflict',conflict:saved});return;}
   this.update({status:'unsaved',conflict:null});this.persist();this.schedule();
  }catch(error){this.update({status:'error',error:message(error)});}
  finally{this.loading=false;}
 }
 schedule(){if(this.timer)clearTimeout(this.timer);this.timer=setTimeout(()=>{this.timer=null;void this.save();},600);}
 edit=(text:string)=>{
  if(this.expired||!this.owner)return;
  if(Array.from(text).length>(this.slot.kind==='answer'?5000:2000))return;
  this.pending={text,expected_revision:this.state.saved?.revision??0,save_id:crypto.randomUUID()};
  this.update({text,status:this.state.conflict?'conflict':'unsaved',error:''});this.persist();
  if(!this.state.conflict)this.schedule();
 };
 async save(){
  if(this.writing||this.loading||this.expired||this.state.conflict||!this.pending)return;
  if(!this.state.saved){await this.load();return;}
  const write=this.retryWrite??this.pending;this.writing=true;this.update({status:'saving',error:''});
  try{
   const s=this.slot;
   const saved=await this.workspace.client.saveLearningDraft(s.collectionId,s.planId,s.lessonIndex,s.kind,write,this.owner??undefined);
   if(this.expired)return;
   this.retryWrite=null;this.update({saved});
   if(this.pending?.save_id===write.save_id){this.pending=null;this.update({text:saved.text,status:'saved'});}
   else if(this.pending){this.pending={...this.pending,expected_revision:saved.revision,save_id:crypto.randomUUID()};this.update({status:'unsaved'});this.schedule();}
   this.persist();
  }catch(error){
   if(this.expired)return;
   this.retryWrite=write;this.persist();
   if(error instanceof DraftConflictError){
    try{const conflict=await this.read();this.update({status:'conflict',conflict,error:''});}
    catch(readError){this.update({status:'error',error:message(readError)});}
   }else this.update({status:'error',error:message(error)});
  }finally{this.writing=false;}
 }
 retry=()=>{if(this.state.saved)void this.save();else void this.load();};
 useSaved=()=>{
  const saved=this.state.conflict;if(!saved||this.writing||this.expired)return;
  this.pending=null;this.retryWrite=null;this.update({saved,text:saved.text,status:'saved',conflict:null,error:''});this.persist();
 };
 replaceSaved=()=>{
  const saved=this.state.conflict;if(!saved||this.writing||this.expired)return;
  this.retryWrite=null;this.pending={text:this.state.text,expected_revision:saved.revision,save_id:crypto.randomUUID()};
  this.update({saved,conflict:null,status:'unsaved',error:''});this.persist();void this.save();
 };
 download=()=>{
  const blob=new Blob([JSON.stringify({format:'secondbrain-learning-draft',version:1,scope:'lesson',...this.slot,text:this.state.text,revision:this.state.saved?.revision??0,status:this.state.status,updated_at:this.state.saved?.updated_at??null},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`learning-${this.slot.kind}-draft.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
}
function message(error:unknown){return error instanceof Error?error.message:'Your draft could not be saved. Keep this page open and retry.';}
export function useLearningDraft(client:SourceClient,slot:DraftSlot|null){
 let workspace=workspaces.get(client);if(!workspace){workspace=new DraftWorkspace(client);workspaces.set(client,workspace);}
 const editor=slot?workspace.editor(slot):null;
 useEffect(()=>{workspace.connect();if(editor)void editor.load();},[workspace,editor]);
 const state=useSyncExternalStore(editor?.subscribe??emptySubscribe,editor?.snapshot??emptySnapshot,emptySnapshot);
 return {state,edit:editor?.edit??noop,retry:editor?.retry??noop,useSaved:editor?.useSaved??noop,replaceSaved:editor?.replaceSaved??noop,download:editor?.download??noop};
}
const noop=()=>{};
const emptySubscribe=()=>noop;
const emptySnapshot=()=>blank;
export type LearningDraftEditor=ReturnType<typeof useLearningDraft>;
