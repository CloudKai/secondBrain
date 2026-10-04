import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const alice='11111111-1111-4111-8111-111111111111';
const bob='22222222-2222-4222-8222-222222222222';
const topic='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const first='33333333-3333-4333-8333-333333333333';
const second='44444444-4444-4444-8444-444444444444';
const assignment={id:topic,title:'RAG',context:'Machine learning',aliases:[],groups:['AI'],description:'Retrieval augments generation.',role:'main',citation_ids:['p0001'],uncertain:false,suggested_topic_id:null,placement_reason:'Same substantive topic.'};
const reference={id:'p0001',start:0,end:51,excerpt:'Retrieved evidence supports language-model generation.',page:null,start_ms:null,end_ms:null};
const note={overview:{text:reference.excerpt,citation_ids:['p0001']},concepts:[{title:'RAG',text:reference.excerpt,citation_ids:['p0001']}],examples:[],equations:[],recall:[{question:'What supports generation?',answer:'Retrieved evidence.',citation_ids:['p0001']}],references:[reference]};
async function database(){
 const db=new PGlite();try{
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); insert into auth.users values('${alice}'),('${bob}'); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to authenticated,service_role;`);
  for(const file of ['202610020001_browser_sources.sql','202610030002_source_studies.sql','202610030006_topic_maps.sql','202610040007_topic_overviews.sql'])await db.exec(await readFile(new URL(`../../../supabase/migrations/${file}`,import.meta.url),'utf8'));
  for(const [id,url] of [[first,'a'],[second,'b']]){
   await db.query(`insert into sources(id,user_id,original_url,canonical_url,title,captured_text,capture_origin,coverage,coverage_detail) values($1,$2,$3,$3,'RAG evidence',$4,'pasted','unknown','Controlled evidence')`,[id,alice,`https://example.com/${url}`,reference.excerpt.repeat(4)]);
   await db.query(`insert into source_studies(source_id,user_id,status,attempts,note) values($1,$2,'succeeded',1,$3::jsonb)`,[id,alice,JSON.stringify(note)]);
   await db.query(`update source_topic_maps set status='succeeded',analysis=$2::jsonb where source_id=$1`,[id,JSON.stringify({topics:[assignment],relations:[],catalog_partial:false})]);
  }
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${alice}',false)`);
  return db;
 }catch(error){await db.close();throw error;}
}
interface Snapshot {view_mode:string;source_count:number;needs_refresh:boolean;record:null|{id:string;status:string;overview:unknown}}
test('learner source-branch choice persists without generation and is hidden from other learners',async()=>{
 const db=await database();try{
  const chosen=await db.query<{snapshot:Snapshot}>('select set_topic_overview_view($1,$2,false) as snapshot',[topic,'separate']);
  assert.equal(chosen.rows[0].snapshot.record,null);
  assert.equal(chosen.rows[0].snapshot.source_count,2);
  assert.equal((await db.query<{snapshot:Snapshot}>('select get_topic_overview($1) as snapshot',[topic])).rows[0].snapshot.view_mode,'separate');
  await db.exec(`select set_config('request.jwt.claim.sub','${bob}',false)`);
  await assert.rejects(db.query('select get_topic_overview($1)',[topic]));
  await assert.rejects(db.query('select set_topic_overview_view($1,$2,false)',[topic,'combined']));
  await assert.rejects(db.query('select * from topic_overviews'));
  await assert.rejects(db.query('select * from overview_outbox'));
 }finally{await db.close();}
});

const synthesis={overview:{text:'Retrieved evidence supports generation in both sources.',reference_ids:[first+':p0001',second+':p0001']},agreements:[],differences:[],references:[{id:first+':p0001',source_id:first,title:'RAG evidence',passage:reference},{id:second+':p0001',source_id:second,title:'RAG evidence',passage:reference}],source_ids:[first,second],partial:false};
test('Combine queues one durable job and the owned snapshot preserves original notes and citations',async()=>{
 const db=await database();try{
  const requested=await db.query<{snapshot:Snapshot}>('select set_topic_overview_view($1,$2,false) as snapshot',[topic,'combined']);
  assert.equal(requested.rows[0].snapshot.record?.status,'queued');
  const id=requested.rows[0].snapshot.record!.id;
  assert.equal((await db.query<{snapshot:Snapshot}>('select set_topic_overview_view($1,$2,false) as snapshot',[topic,'combined'])).rows[0].snapshot.record?.id,id);
  await assert.rejects(db.query('select claim_topic_overview($1)',[id]));
  await db.exec('reset role; set role service_role');
  assert.deepEqual((await db.query('select id from due_overview_dispatches()')).rows,[{id}]);
  const claim=await db.query<{claim:{lease_token:string;inputs:Array<{source_id:string;note:unknown}>}}>('select claim_topic_overview($1) as claim',[id]);
  assert.equal(claim.rows[0].claim.inputs.length,2);
  assert.deepEqual(claim.rows[0].claim.inputs[0].note,note);
  assert.equal((await db.query<{done:boolean}>('select finish_topic_overview($1,$2,$3::jsonb,null) as done',[id,claim.rows[0].claim.lease_token,JSON.stringify(synthesis)])).rows[0].done,true);
  await db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub','${alice}',false)`);
  const saved=await db.query<{snapshot:Snapshot}>('select get_topic_overview($1) as snapshot',[topic]);
  assert.deepEqual(saved.rows[0].snapshot.record?.overview,synthesis);
  await db.query('select set_topic_overview_view($1,$2,false)',[topic,'separate']);
  assert.equal((await db.query<{snapshot:Snapshot}>('select get_topic_overview($1) as snapshot',[topic])).rows[0].snapshot.view_mode,'separate');
  assert.deepEqual((await db.query<{note:unknown}>('select note from source_studies order by source_id')).rows.map(r=>r.note),[note,note]);
 }finally{await db.close();}
});

test('membership changes hide old results and fence late worker completion',async()=>{
 const db=await database();try{
  const requested=await db.query<{snapshot:Snapshot}>('select set_topic_overview_view($1,$2,false) as snapshot',[topic,'combined']);
  const id=requested.rows[0].snapshot.record!.id;
  await db.exec('reset role; set role service_role');
  const claimed=await db.query<{claim:{lease_token:string}}>('select claim_topic_overview($1) as claim',[id]);
  await db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub','${alice}',false)`);
  await db.query('delete from sources where id=$1',[second]);
  const snapshot=(await db.query<{snapshot:Snapshot}>('select get_topic_overview($1) as snapshot',[topic])).rows[0].snapshot;
  assert.equal(snapshot.record,null);assert.equal(snapshot.needs_refresh,true);assert.equal(snapshot.source_count,1);
  await db.exec('reset role; set role service_role');
  assert.equal((await db.query<{done:boolean}>('select finish_topic_overview($1,$2,$3::jsonb,null) as done',[id,claimed.rows[0].claim.lease_token,JSON.stringify(synthesis)])).rows[0].done,false);
  await db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub','${alice}',false)`);
  assert.equal((await db.query<{snapshot:Snapshot}>('select get_topic_overview($1) as snapshot',[topic])).rows[0].snapshot.record,null);
 }finally{await db.close();}
});

test('overview leases recover with bounded retries and rollback preserves authoritative notes',async()=>{
 const db=await database();try{
  const requested=await db.query<{snapshot:Snapshot}>('select set_topic_overview_view($1,$2,false) as snapshot',[topic,'combined']);const id=requested.rows[0].snapshot.record!.id;
  await db.exec('reset role; set role service_role');
  const claim=(await db.query<{claim:{lease_token:string}}>('select claim_topic_overview($1) as claim',[id])).rows[0].claim;
  await db.query('select finish_topic_overview($1,$2,null,$3)',[id,claim.lease_token,'timeout']);
  await db.exec("update topic_overviews set next_attempt_at=now(); update overview_outbox set next_delivery_at=now()");
  const next=(await db.query<{claim:{lease_token:string}}>('select claim_topic_overview($1) as claim',[id])).rows[0].claim;
  assert.notEqual(next.lease_token,claim.lease_token);
  assert.equal((await db.query<{done:boolean}>('select finish_topic_overview($1,$2,$3::jsonb,null) as done',[id,claim.lease_token,JSON.stringify(synthesis)])).rows[0].done,false);
  await db.exec("update topic_overviews set lease_until=now()-interval '1 second'");
  assert.deepEqual((await db.query('select id from due_overview_dispatches()')).rows,[{id}]);
  const last=(await db.query<{claim:{lease_token:string}}>('select claim_topic_overview($1) as claim',[id])).rows[0].claim;
  await db.query('select finish_topic_overview($1,$2,null,$3)',[id,last.lease_token,'timeout']);
  await db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub','${alice}',false)`);
  assert.equal((await db.query<{snapshot:Snapshot}>('select get_topic_overview($1) as snapshot',[topic])).rows[0].snapshot.record?.status,'failed');
  assert.equal((await db.query<{snapshot:Snapshot}>('select set_topic_overview_view($1,$2,true) as snapshot',[topic,'combined'])).rows[0].snapshot.record?.status,'queued');
  await db.exec('reset role');await db.exec(await readFile(new URL('../../../supabase/rollbacks/202610040007_topic_overviews.sql',import.meta.url),'utf8'));
  assert.equal((await db.query('select * from sources')).rows.length,2);
  assert.equal((await db.query('select * from source_topic_maps')).rows.length,2);
  assert.deepEqual((await db.query<{note:unknown}>('select note from source_studies order by source_id')).rows.map(r=>r.note),[note,note]);
 }finally{await db.close();}
});
