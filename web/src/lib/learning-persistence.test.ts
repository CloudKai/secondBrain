import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {learningSnapshotSchema} from './learning';

const alice='11111111-1111-4111-8111-111111111111',bob='22222222-2222-4222-8222-222222222222',source='33333333-3333-4333-8333-333333333333';
const capture='Evidence supports an answer. Similarity by itself does not establish support. A learner should distinguish finding passages from verifying a conclusion.';
const ref={id:'p0001',start:0,end:capture.length,excerpt:capture,page:null,start_ms:null,end_ms:null};
const claim={text:'Check support before accepting an answer.',citation_ids:['p0001']};
const content={title:'Reason about support',outcomes:['Distinguish relevance and support'],prerequisites:[],coverage:'This source explains the distinction.',gaps:['No implementation'],background:[],lessons:[{title:'Support',outcome:'Explain why relevance alone is insufficient',explanation:claim,example:null,check:{kind:'explain',question:'Why is relevance not sufficient?',criteria:['Distinguishes relevance and support'],hint:'What does similarity establish?',worked_answer:claim}}]};
const note={overview:claim,concepts:[{title:'Evidence',...claim}],examples:[],equations:[],recall:[{question:'What is support?',answer:capture,citation_ids:['p0001']}],references:[ref]};
async function learner(db:PGlite,owner=alice){await db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${owner}',false)`);}
async function server(db:PGlite){await db.exec("reset role;select set_config('request.jwt.claim.sub','',false);set role service_role");}
async function database(){
 const db=new PGlite();
 try{
  await db.exec(await readFile(new URL('../../../backend/tests/sql/retrieval_bootstrap.sql',import.meta.url),'utf8'));
  await db.query('insert into auth.users values ($1),($2)',[alice,bob]);
  const folder=new URL('../../../supabase/migrations/',import.meta.url);
  for(const file of (await readdir(folder)).filter(name=>name.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,folder),'utf8'));
  await db.query(`insert into public.sources(id,user_id,original_url,canonical_url,title,captured_text,capture_origin,coverage,coverage_detail) values($1,$2,'https://example.com/evidence','https://example.com/evidence','Evidence',$3,'direct','complete','Captured article')`,[source,alice,capture]);
  await db.query("insert into public.source_studies(source_id,user_id,source_version,status,note) values($1,$2,1,'succeeded',$3)",[source,alice,JSON.stringify(note)]);
  await learner(db);
  return db;
 }catch(error){await db.close();throw error;}
}
async function snapshot(db:PGlite){const value=(await db.query<{v:unknown}>('select public.get_source_learning($1) v',[source])).rows[0].v as Record<string,unknown>;const {user_id,...publicValue}=value;assert.equal(user_id,alice);return learningSnapshotSchema.parse(publicValue);}
async function preview(db:PGlite,difficulty='foundation',pathId:string|null=null){
 const id=crypto.randomUUID();
 const context=(await db.query<{v:{lease_token:string}}>('select public.request_learning_preview($1,1,$2,$3,$4,$5) v',[source,id,'Explain evidence',difficulty,pathId])).rows[0].v;
 await assert.rejects(db.query('select public.finish_learning_preview($1,$2,$3,$4,$5,$6)',[id,context.lease_token,JSON.stringify({suggested_goal:'Explain evidence',paths:[content]}),'Explain evidence',JSON.stringify([ref]),'gpt-6-luna']),/permission denied/);
 await server(db);
 await db.query('select public.finish_learning_preview($1,$2,$3,$4,$5,$6)',[id,context.lease_token,JSON.stringify({suggested_goal:'Explain evidence',paths:[content]}),'Explain evidence',JSON.stringify([ref]),'gpt-6-luna']);
 await learner(db);
 return (await snapshot(db)).plans.find(plan=>plan.request_id===id)!;
}

test('authenticated learning RPCs preserve difficulty history, attempts and version fences',async()=>{
 const db=await database();
 try{
  const first=await preview(db);
  assert.equal(first.active,false);
  const attemptId=crypto.randomUUID();
  await assert.rejects(db.query('select public.submit_learning_attempt($1,$2,0,$3)',[first.id,attemptId,'An answer before confirmation']),/not confirmed/);
  await db.query('select public.confirm_learning_plan($1)',[first.id]);
  await db.query('select public.submit_learning_attempt($1,$2,0,$3)',[first.id,attemptId,'Relevant words do not guarantee evidence for the conclusion.']);
  await db.query('select public.submit_learning_attempt($1,$2,0,$3)',[first.id,attemptId,'Relevant words do not guarantee evidence for the conclusion.']);
  assert.equal((await snapshot(db)).attempts.length,1);
  await assert.rejects(db.query('select public.submit_learning_attempt($1,$2,0,$3)',[first.id,attemptId,'Changed answer using the same request']),/Submission changed/);
  const variant=await preview(db,'advanced',first.path_id);
  let restored=await snapshot(db);
  assert.equal(restored.plans.find(plan=>plan.id===first.id)?.active,true);
  assert.equal(variant.active,false);
  await db.query('select public.confirm_learning_plan($1)',[variant.id]);
  restored=await snapshot(db);
  assert.equal(restored.attempts[0].difficulty,'foundation');
  assert.equal(restored.plans.find(plan=>plan.id===first.id)?.active,false);
  assert.equal(restored.plans.find(plan=>plan.id===variant.id)?.active,true);
  const ownHistory=(await db.query<{v:{collections:{source_id:string}[]}}>('select public.get_learning_history() v')).rows[0].v;
  assert.equal(ownHistory.collections[0].source_id,source);
  await learner(db,bob);
  assert.deepEqual((await db.query<{v:{collections:unknown[]}}>('select public.get_learning_history() v')).rows[0].v.collections,[]);
  await assert.rejects(db.query('select public.get_source_learning($1)',[source]),/Source not found/);
  await assert.rejects(db.query('select public.confirm_learning_plan($1)',[first.id]),/Plan not found/);
  assert.deepEqual((await db.query('select id from public.learning_attempts')).rows,[]);
  await db.exec('reset role');
  await db.query('update public.sources set source_version=2 where id=$1',[source]);
  await learner(db);
  restored=await snapshot(db);
  assert.ok(restored.plans.every(plan=>plan.needs_review));
  assert.equal(restored.attempts.length,1);
  await assert.rejects(db.query('select public.confirm_learning_plan($1)',[variant.id]),/evidence changed/);
  await assert.rejects(db.query("select public.record_learning_activity($1,0,'read')",[first.id]),/evidence changed/);
 }finally{await db.close();}
});

test('feedback leases fence late writes and removed sources without losing earlier answers',async()=>{
 const db=await database();
 try{
  const plan=await preview(db);
  await db.query('select public.confirm_learning_plan($1)',[plan.id]);
  const attemptId=crypto.randomUUID();
  await db.query('select public.submit_learning_attempt($1,$2,0,$3)',[plan.id,attemptId,'Similarity alone is not enough.']);
  const first=(await db.query<{v:{lease_token:string}}>('select public.claim_learning_feedback($1) v',[attemptId])).rows[0].v;
  await assert.rejects(db.query('select public.claim_learning_feedback($1)',[attemptId]),/still generating/);
  await db.exec('reset role');
  await db.query("update public.learning_attempts set lease_until=now()-interval '1 second' where id=$1",[attemptId]);
  await learner(db);
  const second=(await db.query<{v:{lease_token:string}}>('select public.claim_learning_feedback($1) v',[attemptId])).rows[0].v;
  assert.notEqual(second.lease_token,first.lease_token);
  await server(db);
  await assert.rejects(db.query('select public.finish_learning_feedback($1,$2,null)',[attemptId,first.lease_token]),/not found|expired/i);
  await db.query('select public.finish_learning_feedback($1,$2,null)',[attemptId,second.lease_token]);
  await learner(db);
  assert.equal((await snapshot(db)).attempts[0].status,'failed');
  assert.equal((await snapshot(db)).attempts[0].response,'Similarity alone is not enough.');
  const third=(await db.query<{v:{lease_token:string}}>('select public.claim_learning_feedback($1) v',[attemptId])).rows[0].v;
  await db.query('delete from public.sources where id=$1',[source]);
  const retained=await snapshot(db);
  assert.equal(retained.attempts[0].response,'Similarity alone is not enough.');
  assert.ok(retained.plans.every(plan=>plan.needs_review&&plan.source_id===null&&plan.references.length===0));
  assert.deepEqual((await db.query('select source_references from public.learning_plans')).rows,[{source_references:[]}]);
  const history=(await db.query<{v:{collections:{source_available:boolean}[]}}>('select public.get_learning_history() v')).rows[0].v;
  assert.equal(history.collections[0].source_available,false);
  await server(db);
  await assert.rejects(db.query('select public.finish_learning_feedback($1,$2,null)',[attemptId,third.lease_token]),/Source removed/);
  await learner(db);
  // History is still owned and readable; its deleted capture cannot be opened.
  assert.equal((await db.query<{response:string}>('select response from public.learning_attempts')).rows[0].response,'Similarity alone is not enough.');
  assert.equal((await db.query<{source_id:string|null}>('select source_id from public.learning_paths')).rows[0].source_id,null);
 }finally{await db.close();}
});
