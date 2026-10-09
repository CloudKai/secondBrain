import {useEffect,useSyncExternalStore} from 'react';
import type {SourceClient} from './source-client';
import {conversationSendSchema,type ConversationSend,type ConversationSlot,type LessonConversation} from './learning-conversation';

type ConversationState={status:'loading'|'ready'|'busy'|'error'|'signedout';conversation:LessonConversation|null;pending:ConversationSend|null;error:string;memoryOnly:boolean};
const empty:ConversationState={status:'loading',conversation:null,pending:null,error:'',memoryOnly:false};
const workspaces=new WeakMap<SourceClient,ConversationWorkspace>();
class ConversationWorkspace{
 slots=new Map<string,ConversationController>();observedOwner:string|null|undefined;
 constructor(readonly client:SourceClient){
  client.onDraftOwnerChange(owner=>{
   this.observedOwner=owner;
   try{for(const key of Object.keys(sessionStorage))if(key.startsWith('learning-conversation.v1:')&&(owner===null||!key.startsWith(`learning-conversation.v1:${owner}:`)))sessionStorage.removeItem(key);}
   catch{for(const controller of this.slots.values())controller.storageUnavailable();}
   for(const controller of this.slots.values())if(controller.owner&&controller.owner!==owner)controller.expire();
  });
 }
 get(slot:ConversationSlot){
  const key=JSON.stringify(slot);let controller=this.slots.get(key);
  if(!controller){controller=new ConversationController(this.client,slot,()=>this.observedOwner);this.slots.set(key,controller);}
  return controller;
 }
}
class ConversationController{
 state:ConversationState=empty;owner:string|null=null;private expired=false;private reading=false;private writing=false;private connecting=false;private listeners=new Set<()=>void>();
 constructor(private client:SourceClient,readonly slot:ConversationSlot,private observedOwner:()=>string|null|undefined){}
 storageUnavailable(){this.update({memoryOnly:true});}
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
 snapshot=()=>this.state;
 private update(changes:Partial<ConversationState>){this.state={...this.state,...changes};for(const listener of this.listeners)listener();}
 private key(){return `learning-conversation.v1:${this.owner}:${this.slot.collectionId}:${this.slot.planId}:${this.slot.lessonIndex}`;}
 private stash(pending:ConversationSend|null){
  try{if(pending)sessionStorage.setItem(this.key(),JSON.stringify(pending));else sessionStorage.removeItem(this.key());}
  catch{this.update({memoryOnly:true});}
  this.update({pending});
 }
 expire(){
  this.stash(null);this.expired=true;this.update({status:'signedout',conversation:null,pending:null,error:'Your session changed. Reopen the library before continuing.'});
 }
 connect=async()=>{
  if(this.expired||this.connecting)return;
  if(this.owner){await this.load();return;}
  this.connecting=true;
  try{
   this.owner=await this.client.draftOwner();if(this.expired)return;
   const observed=this.observedOwner();if(observed!==undefined&&observed!==this.owner){this.expire();return;}
   try{const raw=sessionStorage.getItem(this.key());if(raw)this.update({pending:conversationSendSchema.parse(JSON.parse(raw))});}
   catch{this.update({memoryOnly:true});}
   await this.load();
  }catch(error){if(!this.expired)this.update({status:'error',error:message(error)});}
  finally{this.connecting=false;}
 };
 private receive(conversation:LessonConversation){
  const pending=this.state.pending;
  if(pending&&conversation.exchanges.some(e=>e.id===pending.request_id&&e.status==='completed'&&e.question===pending.question))this.stash(null);
  this.update({conversation,status:'ready',error:''});
 }
 load=async()=>{
  if(this.expired||this.reading||this.writing)return;
  if(!this.owner){await this.connect();return;}
  this.reading=true;this.update({status:'loading',conversation:null,error:''});
  try{const value=await this.client.getLearningConversation(this.slot.collectionId,this.slot.planId,this.slot.lessonIndex);if(!this.expired)this.receive(value);}
  catch(error){if(!this.expired)this.update({status:'error',error:message(error)});}
  finally{this.reading=false;}
 };
 send=async(question:string)=>{
  if(this.expired||this.writing||this.reading||!this.owner||!this.state.conversation||this.state.pending)return;
  const pending=conversationSendSchema.safeParse({question,request_id:crypto.randomUUID(),expected_revision:this.state.conversation.revision});
  if(!pending.success){this.update({error:'Keep your question within 2,000 characters.'});return;}
  this.stash(pending.data);await this.retry();
 };
 retry=async()=>{
  if(this.expired||this.writing||this.reading||!this.owner||!this.state.pending)return;
  this.writing=true;this.update({status:'busy',error:''});
  try{const value=await this.client.sendLearningConversation(this.slot.collectionId,this.slot.planId,this.slot.lessonIndex,this.state.pending,this.owner);if(!this.expired)this.receive(value);}
  catch(error){if(!this.expired)this.update({status:'error',error:message(error)});}
  finally{this.writing=false;}
 };
 forget=()=>{if(!this.writing&&!this.reading&&!this.expired){this.stash(null);this.update({error:''});}};
 clear=async()=>{
  if(this.expired||this.writing||this.reading||!this.owner||!this.state.conversation)return;
  this.writing=true;this.update({status:'busy',error:''});
  try{const value=await this.client.clearLearningConversation(this.slot.collectionId,this.slot.planId,this.slot.lessonIndex,this.state.conversation.revision,this.owner);if(!this.expired){this.stash(null);this.receive(value);}}
  catch(error){if(!this.expired)this.update({status:'error',error:message(error)});}
  finally{this.writing=false;}
 };
 download=async()=>{
  if(this.expired||this.writing||this.reading||!this.owner)return;
  this.reading=true;this.update({status:'loading',error:''});
  try{
   // Fetch again so removed evidence cannot escape through a stale cached export.
   const conversation=await this.client.getLearningConversation(this.slot.collectionId,this.slot.planId,this.slot.lessonIndex);
   if(this.expired)return;this.receive(conversation);
   const blob=new Blob([JSON.stringify({format:'secondbrain.lesson-conversation.v1',exported_at:new Date().toISOString(),conversation},null,2)],{type:'application/json'});
   const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`lesson-${this.slot.lessonIndex+1}-conversation.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(error){if(!this.expired)this.update({status:'error',error:message(error)});}
  finally{this.reading=false;}
 };
}
function message(error:unknown){return error instanceof Error?error.message:'Conversation storage is unavailable. Your question is retained; reload or retry.';}
export function useLessonConversation(client:SourceClient,slot:ConversationSlot){
 let workspace=workspaces.get(client);if(!workspace){workspace=new ConversationWorkspace(client);workspaces.set(client,workspace);}
 const controller=workspace.get(slot);
 useEffect(()=>{void controller.connect();},[controller]);
 const state=useSyncExternalStore(controller.subscribe,controller.snapshot,()=>empty);
 return {state,load:controller.load,send:controller.send,retry:controller.retry,forget:controller.forget,clear:controller.clear,download:controller.download};
}
export type ConversationWorkspaceView=ReturnType<typeof useLessonConversation>;
