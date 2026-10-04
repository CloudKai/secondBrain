import test from 'node:test';
import assert from 'node:assert/strict';
import {createSourceClient} from './source-client';
const owner='11111111-1111-4111-8111-111111111111',source='33333333-3333-4333-8333-333333333333';
test('assistant questions retain authenticated scope and reject unrelated citations',async()=>{
 const token=`${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:owner,exp:2000000000})).toString('base64url')}.signature`;
 const storage=new Map<string,string>();let invalid=false;
 const client=createSourceClient({url:'https://supabase.test',publicKey:'test-public'},{storage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>{storage.set(k,v);},removeItem:k=>{storage.delete(k);}},fetch:async(input,init)=>{
  if(String(input).includes('/auth/v1/signup'))return Response.json({access_token:token,refresh_token:'refresh',token_type:'bearer',expires_in:3600,user:{id:owner,is_anonymous:true,app_metadata:{},user_metadata:{}}});
  assert.equal(new Headers(init?.headers).get('Authorization'),`Bearer ${token}`);
  assert.equal(String(input),`/api/v2/sources/${source}/ask`);
  assert.equal(JSON.parse(String(init?.body)).library,true);
  return Response.json({status:'supported',claims:[{text:'RAG retrieves evidence.',reference_ids:[source+':p0001']}],gap:null,references:[{id:source+':p0001',source_id:source,source_version:invalid?2:1,title:'RAG',passage:{id:'p0001',start:0,end:19,excerpt:'Retrieved evidence.',page:null,start_ms:null,end_ms:null}}],partial:false,source_ids:[source]});
 }});
 const answer=await client.ask(source,{question:'Explain RAG',source_version:1,library:true});
 assert.equal(answer.references[0].passage.excerpt,'Retrieved evidence.');
 invalid=true;await assert.rejects(client.ask(source,{question:'Explain RAG',source_version:1,library:true}),/incomplete/);
});
