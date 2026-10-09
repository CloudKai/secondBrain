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

test('related learning sources require owned current confirmed topic membership',async()=>{
 const db=await database();
 const other='88888888-8888-4888-8888-888888888888',topic='99999999-9999-4999-8999-999999999999';
 try{
  const plan=await preview(db);await db.query('select public.confirm_learning_plan($1)',[plan.id]);
  await db.exec('reset role');
  await db.query("insert into public.sources(id,user_id,original_url,canonical_url,title,captured_text,capture_origin,coverage,coverage_detail) values($1,$2,'https://example.com/other','https://example.com/other','Other evidence',$3,'direct','complete','Article')",[other,alice,capture]);
  await db.query("insert into public.source_studies(source_id,user_id,source_version,status,note) values($1,$2,1,'succeeded',$3)",[other,alice,JSON.stringify(note)]);
  const analysis={topics:[{id:topic,title:'Evidence',aliases:[],role:'main',context:'Evidence support',citation_ids:['p0001'],uncertain:false,suggested_topic_id:null,placement_reason:'Clear topic'}],relations:[]};
  for(const sid of [source,other])await db.query("insert into public.source_topic_maps(source_id,user_id,status,analysis) values($1,$2,'succeeded',$3) on conflict(source_id) do update set status='succeeded',analysis=excluded.analysis",[sid,alice,JSON.stringify(analysis)]);
  await learner(db);
  const read=async()=> (await db.query<{v:{candidates:{source_id:string;shared_topics:string[]}[]}}>('select public.get_learning_candidates($1) v',[plan.id])).rows[0].v;
  assert.deepEqual((await read()).candidates,[{source_id:other,source_version:1,title:'Other evidence',shared_topics:['Evidence']}]);
  await learner(db,bob);await assert.rejects(read(),/Plan not found/);
  await db.exec('reset role');await db.query("update public.source_topic_overrides set analysis=jsonb_set(analysis,'{topics,0,uncertain}','true') where source_id=$1",[other]);await db.query("update public.source_topic_maps set analysis=jsonb_set(analysis,'{topics,0,uncertain}','true') where source_id=$1",[other]);
  await learner(db);assert.deepEqual((await read()).candidates,[]);
 }finally{await db.close();}
});

test('unused collection migration rolls back without changing one-source learning',async()=>{
 const db=await database();
 try{
  const plan=await preview(db);await db.query('select public.confirm_learning_plan($1)',[plan.id]);
  const answer=crypto.randomUUID();await db.query('select public.submit_learning_attempt($1,$2,0,$3)',[plan.id,answer,'My saved learner answer.']);
  await db.exec('reset role');
  const other='88888888-8888-4888-8888-888888888888',topic='99999999-9999-4999-8999-999999999999';
  await db.query("insert into public.sources(id,user_id,original_url,canonical_url,title,captured_text,capture_origin,coverage,coverage_detail) values($1,$2,'https://example.com/unused','https://example.com/unused','Unused source',$3,'direct','complete','Article')",[other,alice,capture]);
  await db.query("insert into public.source_studies(source_id,user_id,source_version,status,note) values($1,$2,1,'succeeded',$3)",[other,alice,JSON.stringify(note)]);
  const analysis={topics:[{id:topic,title:'Evidence',aliases:[],role:'main',context:'Evidence support',citation_ids:['p0001'],uncertain:false,suggested_topic_id:null,placement_reason:'Clear topic'}],relations:[]};
  for(const sid of [source,other])await db.query("update public.source_topic_maps set status='succeeded',analysis=$2 where source_id=$1",[sid,JSON.stringify(analysis)]);
  await learner(db);
  const request=crypto.randomUUID(),context=(await db.query<{v:{lease_token:string}}>('select public.request_learning_revision($1,$2,$3,1) v',[plan.id,request,other])).rows[0].v;
  await server(db);await db.query('select public.finish_learning_revision($1,$2,$3,$4,$5)',[request,context.lease_token,JSON.stringify({path:content,contributions:[{text:'Another explanation.',citation_ids:['p0002']}],ordering_changes:'Keep order.',disagreements:[]}),JSON.stringify([{id:'p0001',source_id:source,source_version:1,title:'Evidence',passage:ref},{id:'p0002',source_id:other,source_version:1,title:'Unused source',passage:ref}]),'gpt-6-luna']);
  await learner(db);assert.equal((await snapshot(db)).plans.length,2);
  await db.exec('reset role');
  await db.exec(await readFile(new URL('../../../supabase/rollbacks/202610090016_learning_collections.sql',import.meta.url),'utf8'));
  await learner(db);
  assert.equal((await snapshot(db)).plans.length,1);
  assert.equal((await snapshot(db)).attempts[0].response,'My saved learner answer.');
  assert.equal((await snapshot(db)).plans[0].active,true);
 }finally{await db.close();}
});

test('collection revision preserves original citation locations and fences every supporting source',async()=>{
 const db=await database(),other='88888888-8888-4888-8888-888888888888',topic='99999999-9999-4999-8999-999999999999',third='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',applicationTopic='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 try{
  const first=await preview(db);await db.query('select public.confirm_learning_plan($1)',[first.id]);
  const answer=crypto.randomUUID();await db.query('select public.submit_learning_attempt($1,$2,0,$3)',[first.id,answer,'Relevance alone does not establish support.']);
  const earlyRequest=crypto.randomUUID();
  const early=(await db.query<{v:{lease_token:string}}> ("select public.request_learning_preview($1,1,$2,$3,'advanced',$4) v",[source,earlyRequest,first.goal,first.path_id])).rows[0].v;
  await db.exec('reset role');
  await db.query("insert into public.sources(id,user_id,original_url,canonical_url,title,captured_text,capture_origin,coverage,coverage_detail) values($1,$2,'https://example.com/more','https://example.com/more','More evidence',$3,'direct','complete','Article')",[other,alice,capture]);
  await db.query("insert into public.source_studies(source_id,user_id,source_version,status,note) values($1,$2,1,'succeeded',$3)",[other,alice,JSON.stringify(note)]);
  const analysis={topics:[{id:topic,title:'Evidence',aliases:[],role:'main',context:'Evidence support',citation_ids:['p0001'],uncertain:false,suggested_topic_id:null,placement_reason:'Clear topic'}],relations:[]};
  await db.query("insert into public.sources(id,user_id,original_url,canonical_url,title,captured_text,capture_origin,coverage,coverage_detail) values($1,$2,'https://example.com/application','https://example.com/application','Application evidence',$3,'direct','complete','Article')",[third,alice,capture]);
  await db.query("insert into public.source_studies(source_id,user_id,source_version,status,note) values($1,$2,1,'succeeded',$3)",[third,alice,JSON.stringify(note)]);
  const extra={...analysis.topics[0],id:applicationTopic,title:'Applications',role:'supporting'};
  for(const sid of [source,other,third])await db.query("update public.source_topic_maps set status='succeeded',analysis=$2 where source_id=$1",[sid,JSON.stringify({...analysis,topics:sid===source?analysis.topics:sid===other?[...analysis.topics,extra]:[extra]})]);
  await learner(db);
  const request=crypto.randomUUID();
  const context=(await db.query<{v:{lease_token:string;sources:{source:{id:string}}[]}}>('select public.request_learning_revision($1,$2,$3,1) v',[first.id,request,other])).rows[0].v;
  assert.deepEqual(context.sources.map(item=>item.source.id),[source,other]);
  await assert.rejects(db.query('select public.request_learning_revision($1,$2,$3,1)',[first.id,request,other]),/still generating/);
  const revision={path:content,contributions:[{text:'Another explanation of evidence support.',citation_ids:['p0002']}],ordering_changes:'Keep the original order.',disagreements:[]};
  const evidence=[{id:'p0001',source_id:source,source_version:1,title:'Evidence',passage:ref},{id:'p0002',source_id:other,source_version:1,title:'More evidence',passage:ref}];
  await assert.rejects(db.query('select public.finish_learning_revision($1,$2,$3,$4,$5)',[request,context.lease_token,JSON.stringify(revision),JSON.stringify(evidence),'gpt-6-luna']),/permission denied/);
  await server(db);
  await assert.rejects(db.query('select public.finish_learning_revision($1,$2,$3,$4,$5)',[request,context.lease_token,JSON.stringify({...revision,disagreements:[{text:'The sources disagree.',citation_ids:['p0001']}]}),JSON.stringify(evidence),'gpt-6-luna']),/both source perspectives/);
  await db.query('select public.finish_learning_revision($1,$2,$3,$4,$5)',[request,context.lease_token,JSON.stringify(revision),JSON.stringify(evidence),'gpt-6-luna']);
  await learner(db);
  let restored=await snapshot(db),plan=restored.plans.find(item=>item.request_id===request)!;
  assert.equal(plan.active,false);assert.equal(restored.plans.find(item=>item.id===first.id)!.active,true);
  assert.equal(restored.attempts[0].response,'Relevance alone does not establish support.');
  assert.deepEqual(plan.evidence,evidence);assert.equal(plan.references[1].id,'p0002');
  await db.query('select public.confirm_learning_plan($1)',[plan.id]);
  assert.equal((await snapshot(db)).plans.find(item=>item.id===plan.id)!.active,true);
  await server(db);await assert.rejects(db.query('select public.finish_learning_preview($1,$2,$3,$4,$5,$6)',[earlyRequest,early.lease_token,JSON.stringify({suggested_goal:first.goal,paths:[content]}),first.goal,JSON.stringify([ref]),'gpt-6-luna']),/collection evidence changed/);await learner(db);
  await db.exec('reset role');
  await assert.rejects(db.exec(await readFile(new URL('../../../supabase/rollbacks/202610090016_learning_collections.sql',import.meta.url),'utf8')),/Export and migrate collection learner history/);
  await db.exec('rollback');await learner(db);
  const suggestions=(await db.query<{v:{candidates:{source_id:string;shared_topics:string[]}[]}}>('select public.get_learning_candidates($1) v',[plan.id])).rows[0].v;
  assert.deepEqual(suggestions.candidates,[{source_id:third,source_version:1,title:'Application evidence',shared_topics:['Applications']}]);
  assert.equal((await db.query<{v:{lease_token:null}}>('select public.request_learning_revision($1,$2,$3,1) v',[first.id,request,other])).rows[0].v.lease_token,null);
  const variantRequest=crypto.randomUUID();
  const variantContext=(await db.query<{v:{lease_token:string;sources:unknown[]}}>("select public.request_learning_revision($1,$2,null,null,'advanced') v",[plan.id,variantRequest])).rows[0].v;
  assert.equal(variantContext.sources.length,2);
  await server(db);await db.query('select public.finish_learning_revision($1,$2,$3,$4,$5)',[variantRequest,variantContext.lease_token,JSON.stringify(revision),JSON.stringify(evidence),'gpt-6-luna']);
  await learner(db);const variant=(await snapshot(db)).plans.find(item=>item.request_id===variantRequest)!;
  assert.equal(variant.difficulty,'advanced');assert.deepEqual(variant.source_members,plan.source_members);
  await assert.rejects(db.query('select public.request_learning_preview($1,1,$2,$3,$4,$5)',[source,crypto.randomUUID(),plan.goal,'advanced',plan.path_id]),/collection difficulty/);
  await db.exec('reset role');await db.query('update public.sources set source_version=2 where id=$1',[other]);await learner(db);
  restored=await snapshot(db);plan=restored.plans.find(item=>item.id===plan.id)!;
  assert.equal(plan.needs_review,true);assert.equal(restored.plans.find(item=>item.id===first.id)!.needs_review,false);
  await assert.rejects(db.query("select public.record_learning_activity($1,0,'read')",[plan.id]),/evidence changed/);
  await db.query('delete from public.sources where id=$1',[other]);
  restored=await snapshot(db);plan=restored.plans.find(item=>item.id===plan.id)!;
  assert.equal(plan.references.length,0);assert.equal(plan.evidence.length,0);assert.equal(plan.needs_review,true);
  assert.equal(restored.attempts[0].response,'Relevance alone does not establish support.');
 }finally{await db.close();}
});
