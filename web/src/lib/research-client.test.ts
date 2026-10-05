import test from 'node:test';
import assert from 'node:assert/strict';
import {createSourceClient} from './source-client';
const owner='11111111-1111-4111-8111-111111111111';
test('research is authenticated external material and does not save until explicitly requested',async()=>{
 const token=`${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:owner,exp:2000000000})).toString('base64url')}.signature`;
 const storage=new Map<string,string>();let invalid=false;const calls:string[]=[];
 const client=createSourceClient({url:'https://supabase.test',publicKey:'test-public'},{storage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>{storage.set(k,v);},removeItem:k=>{storage.delete(k);}},fetch:async(input,init)=>{
  if(String(input).includes('/auth/v1/signup'))return Response.json({access_token:token,refresh_token:'refresh',token_type:'bearer',expires_in:3600,user:{id:owner,is_anonymous:true,app_metadata:{},user_metadata:{}}});
  assert.equal(new Headers(init?.headers).get('Authorization'),`Bearer ${token}`);
  calls.push(String(input));assert.equal(String(input),'/api/v2/research');
  assert.deepEqual(JSON.parse(String(init?.body)),{query:'RAG evaluation'});
  return Response.json({query:'RAG evaluation',resources:[{url:invalid?'javascript:alert(1)':'https://arxiv.org/abs/2401.00001',title:'RAG study',authors:[],organization:'arxiv.org',date:null,kind:'paper',capture_kind:'article',publication_status:'preprint',metadata_origin:'search_index',relevance:'A search excerpt about RAG.'}],partial:false});
 }});
 const results=await client.research('RAG evaluation');assert.equal(results.resources[0].date,null);assert.equal(results.resources[0].publication_status,'preprint');assert.deepEqual(calls,['/api/v2/research']);
 invalid=true;await assert.rejects(client.research('RAG evaluation'),/incomplete/);
});

test('discovery failures retain actionable provider setup feedback',async()=>{
 const token=`${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:owner,exp:2000000000})).toString('base64url')}.signature`;
 const storage=new Map<string,string>();
 const client=createSourceClient({url:'https://supabase.test',publicKey:'test-public'},{storage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>{storage.set(k,v);},removeItem:k=>{storage.delete(k);}},fetch:async(input)=>String(input).includes('/auth/v1/signup')?Response.json({access_token:token,refresh_token:'refresh',token_type:'bearer',expires_in:3600,user:{id:owner,is_anonymous:true,app_metadata:{},user_metadata:{}}}):Response.json({detail:'Research search is unavailable. Retry. No sources were saved.'},{status:503})});
 await assert.rejects(client.research('RAG'),/No sources were saved/);
});
