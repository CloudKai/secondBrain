import test from 'node:test';
import assert from 'node:assert/strict';
import {createSourceClient} from './source-client';
import {noteFromSavedSource} from './api';
const owner='11111111-1111-4111-8111-111111111111',id='33333333-3333-4333-8333-333333333333',candidate='44444444-4444-4444-8444-444444444444';
const source={id,original_url:'https://example.com/source',canonical_url:'https://example.com/source',source_kind:'article' as const,document:null,transcript:null,title:'Calculus',captured_text:'Calculus explains how quantities change and how contributions accumulate. '.repeat(3),captured_at:'2026-10-04T00:00:00Z',capture_origin:'pasted' as const,coverage:'unknown' as const,coverage_detail:'Supplied text',study_status:'pending' as const,source_version:1};
test('owned comparisons require explicit promotion and validate the returned source version',async()=>{
 const token=`${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:owner,exp:2000000000})).toString('base64url')}.signature`;
 const storage=new Map<string,string>();let promoted=false,invalid=false;
 const client=createSourceClient({url:'https://supabase.test',publicKey:'public-test'},{storage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>{storage.set(k,v);},removeItem:k=>{storage.delete(k);}},fetch:async(input,init)=>{
  if(String(input).includes('/auth/v1/signup'))return Response.json({access_token:token,refresh_token:'refresh',token_type:'bearer',expires_in:3600,user:{id:owner,is_anonymous:true,app_metadata:{},user_metadata:{}}});
  assert.equal(new Headers(init?.headers).get('Authorization'),`Bearer ${token}`);
  if(String(input).endsWith('/revision-check')){assert.deepEqual(JSON.parse(String(init?.body)),{raw_text:'Replacement'});return Response.json({source_id:id,base_version:1,candidate_id:candidate,changed:true,current:source,replacement:{...source,source_version:2}});}
  assert.deepEqual(JSON.parse(String(init?.body)),{candidate_id:candidate,expected_version:1});promoted=true;return Response.json({...source,source_version:invalid?1:2});
 }});
 const comparison=await client.compareSource(id,{rawText:'Replacement'});assert.equal(promoted,false);assert.equal(comparison.current.source_version,1);
 assert.equal((await client.refreshSource(id,candidate,1)).source_version,2);
 invalid=true;await assert.rejects(client.refreshSource(id,candidate,1),/version|verified|incomplete/i);
});

test('the current reader rejects an earlier note even when its excerpt still matches',()=>{
 const excerpt=source.captured_text.slice(0,26);
 const study={source_id:id,source_version:1,status:'succeeded' as const,attempts:1,max_attempts:3 as const,next_attempt_at:'2026-10-04T00:00:00Z',error_code:null,updated_at:'2026-10-04T00:00:00Z',note:{overview:{text:excerpt,citation_ids:['p0001']},concepts:[{title:'Change',text:excerpt,citation_ids:['p0001']}],examples:[],equations:[],recall:[{question:'What changes?',answer:excerpt,citation_ids:['p0001']}],references:[{id:'p0001',start:0,end:26,excerpt,page:null,start_ms:null,end_ms:null}]}};
 assert.throws(()=>noteFromSavedSource({...source,source_version:2},study),/version|references/);
});
