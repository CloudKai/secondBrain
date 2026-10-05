import test from 'node:test';
import assert from 'node:assert/strict';
import { createSourceClient } from './source-client';
const owner='11111111-1111-4111-8111-111111111111';
const source='33333333-3333-4333-8333-333333333333';
const topic='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
test('topic navigation data and placement requests use the learner token and reject invalid graph data',async()=>{
 const token=`${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:owner,exp:2000000000})).toString('base64url')}.signature`;
 const record={source_id:source,status:'succeeded',attempts:1,max_attempts:3,next_attempt_at:'2026-10-03T00:00:00Z',error_code:null,analysis:{topics:[{id:topic,title:'RAG',context:'Machine learning',aliases:['Retrieval augmented generation'],groups:['AI'],description:'Retrieval supplies passages to generation.',role:'main',citation_ids:['p0001'],uncertain:false,suggested_topic_id:null,placement_reason:'Same substantive topic.'}],relations:[],catalog_partial:false},updated_at:'2026-10-03T00:00:00Z'};
 let invalid=false,confirmed=false;
 const storage=new Map<string,string>();
 const client=createSourceClient({url:'https://supabase.test',publicKey:'test-public'},{storage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>{storage.set(k,v);},removeItem:k=>{storage.delete(k);}},fetch:async(input,init)=>{
  if(String(input).includes('/auth/v1/signup'))return Response.json({access_token:token,refresh_token:'refresh',token_type:'bearer',expires_in:3600,user:{id:owner,is_anonymous:true,app_metadata:{},user_metadata:{}}});
  assert.equal(new Headers(init?.headers).get('Authorization'),`Bearer ${token}`);
  if(String(input).endsWith('/placement')){assert.deepEqual(JSON.parse(String(init?.body)),{topic_id:topic,target_id:null});confirmed=true;return Response.json(record);}
  return Response.json({maps:[record],topics:[{id:topic,title:'RAG',context:'Machine learning',aliases:[],groups:['AI'],description:'Retrieval supplies passages.',source_ids:[source],uncertain:false}],connections:invalid?[{id:'bad',source:topic,target:topic,kind:'uses',reason:'Unsupported',source_ids:[source],evidence:{}}]:[],graph_ready:false,partial:false});
 }});
 assert.equal((await client.topicLibrary()).topics[0].title,'RAG');
 await client.confirmPlacement(source,topic,null);assert.equal(confirmed,true);
 invalid=true;await assert.rejects(client.topicLibrary(),/incomplete/);
});
