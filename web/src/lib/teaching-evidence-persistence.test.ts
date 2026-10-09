import test from 'node:test';
import assert from 'node:assert/strict';
import {draftDatabase,learner,preview,source,bob} from './fixtures/learning-database';

test('teaching inventory and capture reads validate owner and index generation without learning activity',async()=>{
 const db=await draftDatabase();
 try{
  const plan=await preview(db);await db.query('select public.confirm_learning_plan($1)',[plan.id]);
  const inventory=async()=>(await db.query<{v:Record<string,unknown>[]}>('select public.get_assistant_search_inventory($1,1,null,false) v',[source])).rows[0].v;
  assert.equal((await inventory())[0].generation,null);
  await db.exec("reset role;set role service_role");
  await db.query("update public.retrieval_indexes set status='ready',chunks_total=1,chunks_completed=1 where source_id=$1",[source]);
  await learner(db);const snapshot=await inventory();
  assert.equal(snapshot.length,1);assert.equal(snapshot[0].source_id,source);assert.ok(snapshot[0].generation);
  const body=JSON.stringify(snapshot);
  const validate=async()=>(await db.query<{v:boolean}>('select public.validate_hybrid_assistant_context($1,1,null,false,$2) v',[source,body])).rows[0].v;
  assert.equal(await validate(),true);
  const rows=(await db.query<{v:{captured_text:string}[]}>('select public.get_hybrid_assistant_context($1,1,null,false,$2) v',[source,body])).rows[0].v;
  assert.equal(rows.length,1);assert.match(rows[0].captured_text,/Similarity by itself does not establish support/);
  await learner(db,bob);await assert.rejects(inventory(),/unavailable/);
  await assert.rejects(db.query('select public.get_hybrid_assistant_context($1,1,null,false,$2)',[source,body]),/changed/);
  await learner(db);await db.exec("reset role;set role service_role");
  await db.query('update public.retrieval_indexes set generation=gen_random_uuid() where source_id=$1',[source]);
  await learner(db);assert.equal(await validate(),false);
  const learning=(await db.query<{v:{attempts:unknown[];activities:unknown[]}}>('select public.get_source_learning($1) v',[source])).rows[0].v;
  assert.deepEqual(learning.attempts,[]);assert.deepEqual(learning.activities,[]);
 }finally{await db.close();}
});

test('removed captured sources invalidate a teaching snapshot while collection history remains accessible',async()=>{
 const db=await draftDatabase();
 try{
  const plan=await preview(db);await db.query('select public.confirm_learning_plan($1)',[plan.id]);
  const cid=(await db.query<{v:{collection:{id:string}}}>('select public.resolve_source_learning_collection($1) v',[source])).rows[0].v.collection.id;
  const snapshots=(await db.query<{v:unknown}>('select public.get_assistant_search_inventory($1,1,null,false) v',[source])).rows[0].v;
  await db.query('delete from public.sources where id=$1',[source]);
  assert.equal((await db.query<{v:boolean}>('select public.validate_hybrid_assistant_context($1,1,null,false,$2) v',[source,JSON.stringify(snapshots)])).rows[0].v,false);
  const collection=(await db.query<{v:{learning:{plans:{id:string;needs_review:boolean}[]}}}>('select public.get_learning_collection($1) v',[cid])).rows[0].v;
  assert.equal(collection.learning.plans[0].id,plan.id);assert.equal(collection.learning.plans[0].needs_review,true);
 }finally{await db.close();}
});
