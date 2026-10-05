import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const alice='11111111-1111-4111-8111-111111111111';
const bob='22222222-2222-4222-8222-222222222222';
const source='33333333-3333-4333-8333-333333333333';
async function database(){
 const db=new PGlite();try{
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); insert into auth.users values ('${alice}'),('${bob}'); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to authenticated,service_role;`);
  for(const file of ['202610020001_browser_sources.sql','202610030002_source_studies.sql','202610030006_topic_maps.sql']) await db.exec(await readFile(new URL(`../../../supabase/migrations/${file}`,import.meta.url),'utf8'));
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${alice}',false)`);
  await db.query(`insert into sources(id,user_id,original_url,canonical_url,title,captured_text,capture_origin,coverage,coverage_detail) values($1,$2,'https://example.com/rag','https://example.com/rag','RAG',$3,'pasted','unknown','Supplied text')`,[source,alice,'Retrieval obtains passages for grounded generation. '.repeat(4)]);
  await db.exec('reset role; set role service_role');
  await db.query(`insert into source_studies(source_id,user_id,status,attempts,note) values($1,$2,'succeeded',1,$3::jsonb)`,[source,alice,JSON.stringify({overview:{text:'RAG uses retrieval.',citation_ids:['p0001']},concepts:[],examples:[],equations:[],recall:[],references:[]})]);
  return db;
 }catch(error){await db.close();throw error;}
}
test('completed notes atomically queue separate topic work and hide it from other learners',async()=>{
 const db=await database();try{
  await db.exec('reset role; set role authenticated');
  assert.equal((await db.query<{status:string}>('select status from source_topic_maps')).rows[0].status,'queued');
  await assert.rejects(db.query('select * from topic_outbox'));
  await db.exec(`select set_config('request.jwt.claim.sub','${bob}',false)`);
  assert.deepEqual((await db.query('select * from source_topic_maps')).rows,[]);
  await assert.rejects(db.query('select request_source_topics($1)',[source]));
  await assert.rejects(db.query('select claim_source_topics($1)',[source]));
  await db.exec('reset role; set role service_role');
  assert.deepEqual((await db.query('select source_id from due_topic_dispatches()')).rows,[{source_id:source}]);
  const claimed=await db.query<{claim:{source_id:string;note:{overview:{text:string}}}}>('select claim_source_topics($1) as claim',[source]);
  assert.equal(claimed.rows[0].claim.note.overview.text,'RAG uses retrieval.');
  assert.equal((await db.query<{claim:null}>('select claim_source_topics($1) as claim',[source])).rows[0].claim,null);
 }finally{await db.close();}
});

test('uncertain placement confirmation is owned, persists, and preserves original notes',async()=>{
 const db=await database(); const uncertain='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; const target='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 const topic=(id:string, unsure:boolean)=>({id,title:unsure?'RAG basics':'Retrieval-augmented generation',context:'Machine learning',aliases:[],groups:['AI'],description:'Retrieval supplies evidence for generation.',role:'main',citation_ids:['p0001'],uncertain:unsure,suggested_topic_id:unsure?target:null,placement_reason:unsure?'Scope may differ.':'Same topic.'});
 try{
  const claimed=await db.query<{claim:{lease_token:string}}>('select claim_source_topics($1) as claim',[source]);
  await db.query('select finish_source_topics($1,$2,$3::jsonb,null)',[source,claimed.rows[0].claim.lease_token,JSON.stringify({topics:[topic(uncertain,true),{...topic(target,false),role:'supporting'}],relations:[],catalog_partial:false})]);
  await db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub','${bob}',false)`);
  await assert.rejects(db.query('select confirm_topic_placement($1,$2,$3)',[source,uncertain,target]));
  await db.exec(`select set_config('request.jwt.claim.sub','${alice}',false)`);
  const result=await db.query<{map:{analysis:{topics:Array<{id:string;uncertain:boolean}>}}}>('select confirm_topic_placement($1,$2,$3) as map',[source,uncertain,target]);
  assert.equal(result.rows[0].map.analysis.topics.length,1);
  assert.equal(result.rows[0].map.analysis.topics[0].id,target);
  assert.equal(result.rows[0].map.analysis.topics[0].uncertain,false);
  assert.equal((await db.query<{note:{overview:{text:string}}}>('select note from source_studies')).rows[0].note.overview.text,'RAG uses retrieval.');
 }finally{await db.close();}
});

test('topic worker failures recover with fenced leases while source notes survive rollback',async()=>{
 const db=await database();try{
  const claim=await db.query<{claim:{lease_token:string}}>('select claim_source_topics($1) as claim',[source]);
  await db.query('select finish_source_topics($1,$2,null,$3)',[source,claim.rows[0].claim.lease_token,'timeout']);
  assert.equal((await db.query<{status:string}>('select status from source_topic_maps')).rows[0].status,'queued');
  await db.exec("update source_topic_maps set next_attempt_at=now(); update topic_outbox set next_delivery_at=now()");
  const next=await db.query<{claim:{lease_token:string}}>('select claim_source_topics($1) as claim',[source]);
  assert.notEqual(next.rows[0].claim.lease_token,claim.rows[0].claim.lease_token);
  assert.equal((await db.query<{finished:boolean}>('select finish_source_topics($1,$2,null,$3) as finished',[source,claim.rows[0].claim.lease_token,'timeout'])).rows[0].finished,false);
  await db.exec("update source_topic_maps set lease_until=now()-interval '1 second'");
  await db.query('select * from due_topic_dispatches()');
  assert.equal((await db.query<{status:string}>('select status from source_topic_maps')).rows[0].status,'queued');
  await db.exec('reset role');
  await db.exec(await readFile(new URL('../../../supabase/rollbacks/202610030006_topic_maps.sql',import.meta.url),'utf8'));
  assert.equal((await db.query('select * from sources')).rows.length,1);
  assert.equal((await db.query('select * from source_studies')).rows.length,1);
 }finally{await db.close();}
});
