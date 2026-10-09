import test from 'node:test';
import assert from 'node:assert/strict';
import {createSourceClient} from './source-client';
const owner='11111111-1111-4111-8111-111111111111',collection='77777777-7777-4777-8777-777777777777',plan='55555555-5555-4555-8555-555555555555',send='44444444-4444-4444-8444-444444444444';
const record={collection_id:collection,plan_id:plan,lesson_index:0,scope:'lesson',source_version:1,evidence_current:true,revision:0,exchanges:[]};
test('conversation HTTP client validates lesson identity, send completion and checked clear',async()=>{
 const values=new Map<string,string>();let result:unknown=record;
 const token=`${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:owner,exp:2000000000})).toString('base64url')}.signature`;
 const client=createSourceClient({url:'https://supabase.test',publicKey:'public-test'},{storage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>{values.set(k,v);},removeItem:k=>{values.delete(k);}},fetch:async(input,init)=>{
  if(String(input).includes('/auth/v1/signup'))return Response.json({access_token:token,refresh_token:'refresh',token_type:'bearer',expires_in:3600,user:{id:owner,aud:'authenticated',role:'authenticated'}});
  assert.equal(new Headers(init?.headers).get('Authorization'),`Bearer ${token}`);
  assert.equal(String(input),`/api/v2/learning/collections/${collection}/plans/${plan}/lessons/0/conversation`);
  return Response.json(result);
 }});
 assert.equal((await client.getLearningConversation(collection,plan,0)).revision,0);
 result={...record,plan_id:collection};await assert.rejects(client.getLearningConversation(collection,plan,0));
 result={...record,revision:1,exchanges:[{id:send,question:'Why?',status:'completed',reply:{text:'Check evidence.',citation_ids:['p0001'],gap:null},redacted:false,model:'gpt-6-luna',policy_version:'learning_v1',created_at:'2026-10-10T00:00:00Z',completed_at:'2026-10-10T00:00:01Z'}]};
 assert.equal((await client.sendLearningConversation(collection,plan,0,{question:'Why?',request_id:send,expected_revision:0})).exchanges[0].reply?.text,'Check evidence.');
 await assert.rejects(client.sendLearningConversation(collection,plan,0,{question:'Changed',request_id:send,expected_revision:0}));
 result={...record,revision:2};assert.equal((await client.clearLearningConversation(collection,plan,0,1)).revision,2);
 result={...record,revision:3};await assert.rejects(client.clearLearningConversation(collection,plan,0,1));
});
