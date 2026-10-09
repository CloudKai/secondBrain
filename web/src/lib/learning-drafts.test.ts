import test from 'node:test';
import assert from 'node:assert/strict';
import {draftDatabase,preview,source,learner,bob} from './fixtures/learning-database';

test('an unfinished draft survives reopen with exact wording without creating an attempt or activity',async()=>{
 const db=await draftDatabase();
 try{
  const plan=await preview(db);await db.query('select public.confirm_learning_plan($1)',[plan.id]);
  const cid=(await db.query<{v:{collection:{id:string}}}>('select public.resolve_source_learning_collection($1) v',[source])).rows[0].v.collection.id;
  const text='  My unfinished reasoning 👩🏽‍💻\n\nx² + β = 3.\n';
  const saved=(await db.query<{v:{text:string;revision:number;scope:string}}>('select public.save_learning_draft($1,$2,0,$3,$4,0,$5) v',[cid,plan.id,'answer',text,crypto.randomUUID()])).rows[0].v;
  assert.equal(saved.text,text);assert.equal(saved.revision,1);assert.equal(saved.scope,'lesson');
  assert.deepEqual((await db.query<{v:unknown}>('select public.get_learning_draft($1,$2,0,$3) v',[cid,plan.id,'answer'])).rows[0].v,saved);
  const learning=(await db.query<{v:{attempts:unknown[];activities:unknown[]}}>('select public.get_source_learning($1) v',[source])).rows[0].v;
  assert.deepEqual(learning.attempts,[]);assert.deepEqual(learning.activities,[]);
 }finally{await db.close();}
});


test('draft retries and conflicting tabs preserve each kind and reject cross-owner or unrelated lesson writes',async()=>{
 const db=await draftDatabase();
 try{
  const plan=await preview(db);await db.query('select public.confirm_learning_plan($1)',[plan.id]);
  const cid=(await db.query<{v:{collection:{id:string}}}>('select public.resolve_source_learning_collection($1) v',[source])).rows[0].v.collection.id;
  const request=crypto.randomUUID(),body=[cid,plan.id,'answer','First tab wording',request];
  const save=()=>db.query<{v:{text:string;revision:number}}> ('select public.save_learning_draft($1,$2,0,$3,$4,0,$5) v',body);
  const first=(await save()).rows[0].v;assert.deepEqual((await save()).rows[0].v,first);
  await assert.rejects(db.query('select public.save_learning_draft($1,$2,0,$3,$4,0,$5)',[cid,plan.id,'answer','Changed retry',request]),/retry changed/);
  await assert.rejects(db.query('select public.save_learning_draft($1,$2,0,$3,$4,0,$5)',[cid,plan.id,'answer','Other tab wording',crypto.randomUUID()]),/another tab/);
  await db.query('select public.save_learning_draft($1,$2,0,$3,$4,0,$5)',[cid,plan.id,'question','My separate question',crypto.randomUUID()]);
  assert.equal((await db.query<{v:{text:string}}>('select public.get_learning_draft($1,$2,0,$3) v',[cid,plan.id,'answer'])).rows[0].v.text,'First tab wording');
  await assert.rejects(db.query('select public.get_learning_draft($1,$2,1,$3)',[cid,plan.id,'answer']),/Invalid lesson/);
  await assert.rejects(db.query('select public.save_learning_draft($1,$2,0,$3,$4,1,$5)',[crypto.randomUUID(),plan.id,'answer','Wrong collection',crypto.randomUUID()]),/Collection not found/);
  await assert.rejects(db.query('insert into public.learning_drafts(collection_id,user_id,plan_id,lesson_index,kind,text,revision,save_id) values($1,$2,$3,0,$4,$5,1,$6)',[cid,bob,plan.id,'answer','Forged owner',crypto.randomUUID()]),/permission denied/);
  await learner(db,bob);await assert.rejects(db.query('select public.get_learning_draft($1,$2,0,$3)',[cid,plan.id,'answer']),/not found/);
  assert.deepEqual((await db.query('select text from public.learning_drafts')).rows,[]);
 }finally{await db.close();}
});

test('source changes and removal retain drafts; recovery disables writes while keeping reads',async()=>{
 const {readFile}=await import('node:fs/promises');
 const db=await draftDatabase();
 try{
  const plan=await preview(db);await db.query('select public.confirm_learning_plan($1)',[plan.id]);
  const cid=(await db.query<{v:{collection:{id:string}}}>('select public.resolve_source_learning_collection($1) v',[source])).rows[0].v.collection.id;
  await db.query('select public.save_learning_draft($1,$2,0,$3,$4,0,$5)',[cid,plan.id,'answer','My reasoning remains mine.',crypto.randomUUID()]);
  await db.exec('reset role');await db.query('update public.sources set source_version=2 where id=$1',[source]);await learner(db);
  const changed=(await db.query<{v:{text:string;evidence_current:boolean}}>('select public.get_learning_draft($1,$2,0,$3) v',[cid,plan.id,'answer'])).rows[0].v;
  assert.equal(changed.text,'My reasoning remains mine.');assert.equal(changed.evidence_current,false);
  await db.query('delete from public.sources where id=$1',[source]);
  assert.deepEqual((await db.query<{v:unknown}>('select public.get_learning_draft($1,$2,0,$3) v',[cid,plan.id,'answer'])).rows[0].v,changed);
  await db.query('select public.save_learning_draft($1,$2,0,$3,$4,1,$5)',[cid,plan.id,'answer','',crypto.randomUUID()]);
  assert.equal((await db.query<{v:{revision:number;text:string}}>('select public.get_learning_draft($1,$2,0,$3) v',[cid,plan.id,'answer'])).rows[0].v.revision,2);
  await db.exec('reset role');await db.exec(await readFile(new URL('../../../supabase/rollbacks/202610090020_learning_drafts.sql',import.meta.url),'utf8'));await learner(db);
  assert.equal((await db.query<{v:{text:string}}>('select public.get_learning_draft($1,$2,0,$3) v',[cid,plan.id,'answer'])).rows[0].v.text,'');
  await assert.rejects(db.query('select public.save_learning_draft($1,$2,0,$3,$4,2,$5)',[cid,plan.id,'answer','Recovery must retain reads',crypto.randomUUID()]),/permission denied/);
 }finally{await db.close();}
});

test('new plan revisions have separate drafts and enforce Unicode bounds',async()=>{
 const db=await draftDatabase();
 try{
  const plan=await preview(db);await db.query('select public.confirm_learning_plan($1)',[plan.id]);
  const cid=(await db.query<{v:{collection:{id:string}}}>('select public.resolve_source_learning_collection($1) v',[source])).rows[0].v.collection.id;
  const text='🧠'.repeat(2000);
  await db.query('select public.save_learning_draft($1,$2,0,$3,$4,0,$5)',[cid,plan.id,'question',text,crypto.randomUUID()]);
  await assert.rejects(db.query('select public.save_learning_draft($1,$2,0,$3,$4,1,$5)',[cid,plan.id,'question',text+'x',crypto.randomUUID()]),/Invalid draft/);
  const next=await preview(db,'advanced',plan.path_id);await db.query('select public.confirm_learning_plan($1)',[next.id]);
  const empty=(await db.query<{v:{text:string;revision:number}}>('select public.get_learning_draft($1,$2,0,$3) v',[cid,next.id,'question'])).rows[0].v;
  assert.equal(empty.text,'');assert.equal(empty.revision,0);
  assert.equal((await db.query<{v:{text:string}}>('select public.get_learning_draft($1,$2,0,$3) v',[cid,plan.id,'question'])).rows[0].v.text,text);
 }finally{await db.close();}
});
