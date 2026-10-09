import test from 'node:test';
import assert from 'node:assert/strict';
import {createSourceClient} from './source-client';

const owner='11111111-1111-4111-8111-111111111111',collection='77777777-7777-4777-8777-777777777777',plan='55555555-5555-4555-8555-555555555555',save='44444444-4444-4444-8444-444444444444';
const record={collection_id:collection,plan_id:plan,lesson_index:0,kind:'answer',scope:'lesson',source_version:1,evidence_current:true,text:'',revision:0,save_id:null,updated_at:null};
function clientFixture(){
 const values=new Map<string,string>();let response:unknown=record,status=200;
 const token=`${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:owner,exp:2000000000})).toString('base64url')}.signature`;
 const client=createSourceClient({url:'https://supabase.test',publicKey:'public-test'},{storage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>{values.set(k,v);},removeItem:k=>{values.delete(k);}},fetch:async(input,init)=>{
  if(String(input).includes('/auth/v1/signup'))return Response.json({access_token:token,refresh_token:'refresh',token_type:'bearer',expires_in:3600,user:{id:owner,aud:'authenticated',role:'authenticated'}});
  assert.equal(new Headers(init?.headers).get('Authorization'),`Bearer ${token}`);
  assert.equal(String(input),`/api/v2/learning/collections/${collection}/plans/${plan}/lessons/0/drafts/answer`);
  return Response.json(response,{status});
 }});
 return {client,set:(value:unknown,code=200)=>{response=value;status=code;}};
}
test('draft client validates the exact slot and preserves saved Unicode wording',async()=>{
 const {client,set}=clientFixture();
 assert.equal((await client.getLearningDraft(collection,plan,0,'answer')).revision,0);
 const text='  Reasoning 👩🏽‍💻\n\nx² + β = 3.\n';
 set({...record,text,revision:1,save_id:save,updated_at:'2026-10-09T00:00:00Z'});
 assert.equal((await client.saveLearningDraft(collection,plan,0,'answer',{text,expected_revision:0,save_id:save})).text,text);
 set({...record,plan_id:collection});await assert.rejects(client.getLearningDraft(collection,plan,0,'answer'));
 set({...record,revision:1});await assert.rejects(client.getLearningDraft(collection,plan,0,'answer'));
 set({detail:'Changed in another tab'},409);await assert.rejects(client.saveLearningDraft(collection,plan,0,'answer',{text,expected_revision:0,save_id:save}),{name:'DraftConflictError'});
});
