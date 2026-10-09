import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

const alice='11111111-1111-4111-8111-111111111111',bob='22222222-2222-4222-8222-222222222222';
const source='33333333-3333-4333-8333-333333333333';
const capture='A source provides evidence for a claim. Similarity by itself does not establish support. Learners can revisit original evidence when checking a conclusion.';
const passage={id:'p0001',start:0,end:capture.length,excerpt:capture,page:null,start_ms:null,end_ms:null};
const claim={text:'Evidence supports a conclusion.',citation_ids:['p0001']};
const content={title:'Check support',outcomes:['Check a conclusion'],prerequisites:[],coverage:'One source supports this explanation.',gaps:[],background:[],lessons:[{title:'Support',outcome:'Explain evidence support',explanation:claim,example:null,check:{kind:'explain',question:'Why check support?',criteria:['Uses evidence'],hint:'Look at the claim.',worked_answer:claim}}]};
const note={overview:claim,concepts:[{title:'Evidence',...claim}],examples:[],equations:[],recall:[{question:'Why evidence?',answer:capture,citation_ids:['p0001']}],references:[passage]};
async function learner(db:PGlite,owner=alice){await db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${owner}',false)`);}
async function legacyDatabase(){
 const db=new PGlite();
 try{
  await db.exec(await readFile(new URL('../../../backend/tests/sql/retrieval_bootstrap.sql',import.meta.url),'utf8'));
  await db.query('insert into auth.users values ($1),($2)',[alice,bob]);
  const folder=new URL('../../../supabase/migrations/',import.meta.url);
  for(const name of (await readdir(folder)).filter(name=>name.endsWith('.sql')&&name<'202610090019').sort())await db.exec(await readFile(new URL(name,folder),'utf8'));
  await db.query("insert into public.sources(id,user_id,original_url,canonical_url,title,captured_text,capture_origin,coverage,coverage_detail) values($1,$2,'https://example.com/evidence','https://example.com/evidence','Evidence',$3,'direct','complete','Captured article')",[source,alice,capture]);
  await db.query("insert into public.source_studies(source_id,user_id,source_version,status,note) values($1,$2,1,'succeeded',$3)",[source,alice,JSON.stringify(note)]);
  await learner(db);
  return db;
 }catch(error){await db.close();throw error;}
}
async function preview(db:PGlite,difficulty='foundation',pathId:string|null=null){
 const request=crypto.randomUUID();
 const context=(await db.query<{v:{lease_token:string}}>('select public.request_learning_preview($1,1,$2,$3,$4,$5) v',[source,request,'Explain evidence',difficulty,pathId])).rows[0].v;
 await db.exec("reset role;select set_config('request.jwt.claim.sub','',false);set role service_role");
 await db.query('select public.finish_learning_preview($1,$2,$3,$4,$5,$6)',[request,context.lease_token,JSON.stringify({suggested_goal:'Explain evidence',paths:[content]}),'Explain evidence',JSON.stringify([passage]),'gpt-6-luna']);
 await learner(db);
 return (await db.query<{v:{plans:{id:string;path_id:string;request_id:string}[]}}>('select public.get_source_learning($1) v',[source])).rows[0].v.plans.find(plan=>plan.request_id===request)!;
}
const migration=new URL('../../../supabase/migrations/202610090019_collection_identity.sql',import.meta.url);
type Detail={user_id:string;collection:{id:string;legacy_source_id:string;goal:string;source_count:number;path_count:number;original_source_available:boolean};sources:{id:string}[];learning:{selected_plan_id:string;selected_place_revision:number;plans:{id:string;path_id:string;references:typeof passage[]}[];attempts:{id:string;response:string}[]}};
async function resolve(db:PGlite){return (await db.query<{v:Detail}>('select public.resolve_source_learning_collection($1) v',[source])).rows[0].v;}

test('legacy collection backfill is repeatable and preserves learning identity, attempts and exact citations',async()=>{
 const db=await legacyDatabase();
 try{
  const plan=await preview(db);await db.query('select public.confirm_learning_plan($1)',[plan.id]);
  const attempt=crypto.randomUUID();await db.query('select public.submit_learning_attempt($1,$2,0,$3)',[plan.id,attempt,'My explanation stays saved.']);
  const before=(await db.query<{v:Detail['learning']}>('select public.get_source_learning($1) v',[source])).rows[0].v;
  await db.exec('reset role');await db.exec(await readFile(migration,'utf8'));await learner(db);
  const first=await resolve(db);
  assert.notEqual(first.collection.id,source);assert.equal(first.collection.goal,'Explain evidence');
  assert.equal(first.collection.source_count,1);assert.deepEqual(first.sources.map(item=>item.id),[source]);
  assert.equal(first.learning.selected_plan_id,plan.id);assert.equal(first.learning.plans[0].path_id,plan.path_id);
  assert.deepEqual(first.learning.plans[0].references,[passage]);assert.equal(first.learning.attempts[0].id,attempt);
  assert.deepEqual(first.learning,before);
  await assert.rejects(db.query('select public.backfill_learning_collections()'),/permission denied/);
  await db.exec('reset role');await db.query('select public.backfill_learning_collections()');await learner(db);
  assert.deepEqual(await resolve(db),first);
  const direct=(await db.query<{v:Detail}>('select public.get_learning_collection($1) v',[first.collection.id])).rows[0].v;
  assert.deepEqual(direct,first);
  assert.deepEqual((await db.query<{source_id:string}>('select source_id from public.learning_collection_sources')).rows,[{source_id:source}]);
  await learner(db,bob);await assert.rejects(db.query('select public.get_learning_collection($1)',[first.collection.id]),/Collection not found/);
  assert.deepEqual((await db.query('select id from public.learning_collections')).rows,[]);
  assert.deepEqual((await db.query('select source_id from public.learning_collection_sources')).rows,[]);
 }finally{await db.close();}
});

test('legacy writers create one durable collection and removal keeps learning history without captured evidence',async()=>{
 const db=await legacyDatabase();
 try{
  await db.exec('reset role');await db.exec(await readFile(migration,'utf8'));await learner(db);
  const plan=await preview(db);await db.query('select public.confirm_learning_plan($1)',[plan.id]);
  await db.query('select public.confirm_learning_plan($1)',[plan.id]);
  const first=await resolve(db);assert.equal(first.collection.source_count,1);assert.equal(first.collection.path_count,1);
  const attempt=crypto.randomUUID();await db.query('select public.submit_learning_attempt($1,$2,0,$3)',[plan.id,attempt,'Keep this after source removal.']);
  await db.query('delete from public.sources where id=$1',[source]);
  const retained=await resolve(db);assert.equal(retained.collection.id,first.collection.id);
  assert.equal(retained.collection.original_source_available,false);assert.equal(retained.collection.source_count,0);
  assert.deepEqual(retained.sources,[]);assert.deepEqual(retained.learning.plans[0].references,[]);
  assert.equal(retained.learning.attempts[0].response,'Keep this after source removal.');
  await assert.rejects(db.query('insert into public.learning_collections(user_id,legacy_source_id,title) values($1,$2,$3)',[alice,source,'Client write']),/permission denied/);
 }finally{await db.close();}
});

test('collection selection shares the legacy cursor and rejects stale writes without awarding activity',async()=>{
 const db=await legacyDatabase();
 try{
  await db.exec('reset role');await db.exec(await readFile(migration,'utf8'));await learner(db);
  const plan=await preview(db);await db.query('select public.confirm_learning_plan($1)',[plan.id]);
  const initial=await resolve(db),revision=initial.learning.selected_place_revision;
  const listing=(await db.query<{v:{collections:Detail['collection'][];next_offset:number|null}}>('select public.list_learning_collections() v')).rows[0].v;
  assert.equal(listing.collections[0].id,initial.collection.id);assert.equal(listing.next_offset,null);
  const selected=(await db.query<{v:Detail}>('select public.select_learning_collection_lesson($1,$2,0,$3) v',[initial.collection.id,plan.id,revision])).rows[0].v;
  assert.equal(selected.learning.selected_place_revision,revision+1);assert.equal(selected.learning.selected_plan_id,plan.id);
  assert.equal((await resolve(db)).learning.selected_place_revision,revision+1);
  await assert.rejects(db.query('select public.select_learning_collection_lesson($1,$2,0,$3)',[initial.collection.id,plan.id,revision]),/Learning place changed/);
  await learner(db,bob);assert.deepEqual((await db.query<{v:{collections:unknown[]}}>('select public.list_learning_collections() v')).rows[0].v.collections,[]);
  await assert.rejects(db.query('select public.select_learning_collection_lesson($1,$2,0,0)',[initial.collection.id,plan.id]),/Collection not found/);
 }finally{await db.close();}
});

test('backfill includes removed anchors with branches and difficulty history without regenerating learning',async()=>{
 const db=await legacyDatabase();
 try{
  const first=await preview(db);await db.query('select public.confirm_learning_plan($1)',[first.id]);
  const attempt=crypto.randomUUID();await db.query('select public.submit_learning_attempt($1,$2,0,$3)',[first.id,attempt,'My original foundation answer.']);
  const advanced=await preview(db,'advanced',first.path_id);await db.query('select public.confirm_learning_plan($1)',[advanced.id]);
  const request=crypto.randomUUID(),goal='Apply support checks to a new decision.';
  const context=(await db.query<{v:{lease_token:string}}>('select public.request_learning_revision($1,$2,null,null,null,$3) v',[advanced.id,request,goal])).rows[0].v;
  const branch={...content,title:'Apply support',lessons:[{...content.lessons[0],check:{...content.lessons[0].check,kind:'apply',question:'How would you check a new decision?'}}]};
  await db.exec("reset role;select set_config('request.jwt.claim.sub','',false);set role service_role");
  await db.query('select public.finish_learning_revision($1,$2,$3,$4,$5)',[request,context.lease_token,JSON.stringify({path:branch,contributions:[claim],ordering_changes:'Apply after explanation.',disagreements:[]}),JSON.stringify([{id:'p0001',source_id:source,source_version:1,title:'Evidence',passage}]),'gpt-6-luna']);
  await learner(db);
  const generated=(await db.query<{v:Detail['learning']}>('select public.get_source_learning($1) v',[source])).rows[0].v;
  const branchPlan=generated.plans.find(plan=>plan.path_id!==first.path_id)!;
  await db.query('select public.confirm_learning_plan($1)',[branchPlan.id]);
  await db.query('delete from public.sources where id=$1',[source]);
  const before=(await db.query<{v:Detail['learning']}>('select public.get_source_learning($1) v',[source])).rows[0].v;
  await db.exec('reset role');await db.exec(await readFile(migration,'utf8'));await learner(db);
  const migrated=await resolve(db);
  assert.equal(migrated.collection.original_source_available,false);assert.equal(migrated.collection.path_count,2);
  assert.equal(migrated.collection.source_count,0);assert.equal(migrated.collection.goal,goal);
  assert.deepEqual(migrated.learning,before);assert.equal(migrated.learning.plans.length,3);
  assert.equal(migrated.learning.attempts[0].response,'My original foundation answer.');
 }finally{await db.close();}
});

test('confirmed contributions add one membership and pending previews do not increase collection coverage',async()=>{
 const db=await legacyDatabase(),other='88888888-8888-4888-8888-888888888888',topic='99999999-9999-4999-8999-999999999999';
 try{
  await db.exec('reset role');await db.exec(await readFile(migration,'utf8'));await learner(db);
  const first=await preview(db);await db.query('select public.confirm_learning_plan($1)',[first.id]);
  await db.exec('reset role');
  await db.query("insert into public.sources(id,user_id,original_url,canonical_url,title,captured_text,capture_origin,coverage,coverage_detail) values($1,$2,'https://example.com/more','https://example.com/more','More evidence',$3,'direct','complete','Article')",[other,alice,capture]);
  await db.query("insert into public.source_studies(source_id,user_id,source_version,status,note) values($1,$2,1,'succeeded',$3)",[other,alice,JSON.stringify(note)]);
  const analysis={topics:[{id:topic,title:'Evidence',aliases:[],role:'main',context:'Evidence support',citation_ids:['p0001'],uncertain:false,suggested_topic_id:null,placement_reason:'Clear topic'}],relations:[]};
  for(const sid of [source,other])await db.query('update public.source_topic_maps set status=$2,analysis=$3 where source_id=$1',[sid,'succeeded',JSON.stringify(analysis)]);
  await learner(db);
  const request=crypto.randomUUID(),context=(await db.query<{v:{lease_token:string}}>('select public.request_learning_revision($1,$2,$3,1) v',[first.id,request,other])).rows[0].v;
  await db.exec("reset role;select set_config('request.jwt.claim.sub','',false);set role service_role");
  await db.query('select public.finish_learning_revision($1,$2,$3,$4,$5)',[request,context.lease_token,JSON.stringify({path:content,contributions:[{...claim,citation_ids:['p0002']}],ordering_changes:'Keep the order.',disagreements:[]}),JSON.stringify([{id:'p0001',source_id:source,source_version:1,title:'Evidence',passage},{id:'p0002',source_id:other,source_version:1,title:'More evidence',passage}]),'gpt-6-luna']);
  await learner(db);const pending=await resolve(db);assert.equal(pending.collection.source_count,1);
  const revision=pending.learning.plans.find(plan=>plan.id!==first.id)!;
  await db.query('select public.confirm_learning_plan($1)',[revision.id]);await db.query('select public.confirm_learning_plan($1)',[revision.id]);
  assert.equal((await resolve(db)).collection.source_count,2);
  await db.exec('reset role');await db.query('select public.backfill_learning_collections()');await learner(db);
  assert.equal((await resolve(db)).collection.source_count,2);
 }finally{await db.close();}
});

test('collection recovery retains identity, saved answers and compatibility writers',async()=>{
 const db=await legacyDatabase();
 try{
  await db.exec('reset role');await db.exec(await readFile(migration,'utf8'));await learner(db);
  const plan=await preview(db);await db.query('select public.confirm_learning_plan($1)',[plan.id]);
  const attempt=crypto.randomUUID();await db.query('select public.submit_learning_attempt($1,$2,0,$3)',[plan.id,attempt,'An answer retained through recovery.']);
  const initial=await resolve(db);
  await db.exec('reset role');await db.exec(await readFile(new URL('../../../supabase/rollbacks/202610090019_collection_identity.sql',import.meta.url),'utf8'));await learner(db);
  assert.equal((await resolve(db)).collection.id,initial.collection.id);
  assert.equal((await db.query<{v:Detail}>('select public.get_learning_collection($1) v',[initial.collection.id])).rows[0].v.learning.attempts[0].id,attempt);
  await assert.rejects(db.query('select public.select_learning_collection_lesson($1,$2,0,$3)',[initial.collection.id,plan.id,initial.learning.selected_place_revision]),/permission denied/);
  const recovered=(await db.query<{v:Detail['learning']}>('select public.get_source_learning($1) v',[source])).rows[0].v;
  assert.equal(recovered.attempts[0].response,'An answer retained through recovery.');
  await db.query('select public.select_learning_lesson($1,0)',[plan.id]);
  assert.deepEqual((await db.query<{id:string}>('select id from public.learning_collections')).rows.map(item=>item.id),[initial.collection.id]);
 }finally{await db.close();}
});

test('unmapped legacy places abort migration without leaving partially attached learning roots',async()=>{
 const db=await legacyDatabase();
 try{
  const plan=await preview(db);await db.query('select public.confirm_learning_plan($1)',[plan.id]);
  await db.exec('reset role');
  await db.query('insert into public.learning_places(user_id,original_source_id,plan_id,lesson_index) values($1,$2,$3,0)',[alice,crypto.randomUUID(),plan.id]);
  await assert.rejects(db.exec(await readFile(migration,'utf8')),/Unmapped learning roots/);
  await db.exec('rollback');await learner(db);
  const retained=(await db.query<{v:Detail['learning']}>('select public.get_source_learning($1) v',[source])).rows[0].v;
  assert.equal(retained.selected_plan_id,plan.id);assert.equal(retained.plans.length,1);
 }finally{await db.close();}
});
