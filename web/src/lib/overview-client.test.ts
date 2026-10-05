import test from 'node:test';
import assert from 'node:assert/strict';
import {createSourceClient} from './source-client';
const owner='11111111-1111-4111-8111-111111111111';
const topic='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const first='33333333-3333-4333-8333-333333333333';
const second='44444444-4444-4444-8444-444444444444';
test('overview choices and source-prefixed citations cross the authenticated client boundary',async()=>{
 const token=`${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:owner,exp:2000000000})).toString('base64url')}.signature`;
 let mode='combined',invalid=false;
 const refs=[first+':p0001',second+':p0001'];
 const storage=new Map<string,string>();
 const client=createSourceClient({url:'https://supabase.test',publicKey:'test-public'},{storage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>{storage.set(k,v);},removeItem:k=>{storage.delete(k);}},fetch:async(input,init)=>{
  if(String(input).includes('/auth/v1/signup'))return Response.json({access_token:token,refresh_token:'refresh',token_type:'bearer',expires_in:3600,user:{id:owner,is_anonymous:true,app_metadata:{},user_metadata:{}}});
  assert.equal(new Headers(init?.headers).get('Authorization'),`Bearer ${token}`);
  assert.equal(String(input).endsWith(`/topics/${topic}/overview`),true);
  if(init?.method==='POST')mode=JSON.parse(String(init.body)).view_mode;
  return Response.json({topic_id:topic,view_mode:mode,source_ids:[first,second],source_count:2,needs_refresh:false,record:{id:'55555555-5555-4555-8555-555555555555',topic_id:topic,status:'succeeded',attempts:1,max_attempts:3,error_code:null,updated_at:'2026-10-04T00:00:00Z',overview:{overview:{text:'Two sources describe retrieval-grounded generation.',reference_ids:invalid?['unknown',refs[1]]:refs},agreements:[],differences:[],references:[first,second].map((source_id,i)=>({id:refs[i],source_id,title:'RAG source',passage:{id:'p0001',start:0,end:10,excerpt:'Retrieval.',page:null,start_ms:null,end_ms:null}})),source_ids:[first,second],partial:false}}});
 }});
 assert.equal((await client.topicOverview(topic)).record?.overview?.references[1].source_id,second);
 await client.setTopicView(topic,'separate');assert.equal((await client.topicOverview(topic)).view_mode,'separate');
 invalid=true;await assert.rejects(client.topicOverview(topic),/incomplete/);
});
