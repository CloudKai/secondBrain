import test from 'node:test';
import assert from 'node:assert/strict';
import {draftDatabase,preview,source} from './fixtures/learning-database';

test('a completed tutor exchange reopens exactly and retries without duplicating learning activity',async()=>{
 const db=await draftDatabase();
 try{
  const plan=await preview(db);await db.query('select public.confirm_learning_plan($1)',[plan.id]);
  const cid=(await db.query<{v:{collection:{id:string}}}>('select public.resolve_source_learning_collection($1) v',[source])).rows[0].v.collection.id;
  const request=crypto.randomUUID(),question='  Why evidence? 🧠\n';
  const claim=(await db.query<{v:{lease_token:string;conversation:{revision:number}}}>('select public.request_learning_conversation($1,$2,0,$3,$4,0) v',[cid,plan.id,request,question])).rows[0].v;
  assert.equal(claim.conversation.revision,0);
  await db.exec("reset role;set role service_role");
  const reply={text:'Check the supporting passage. β ≠ 0.',citation_ids:['p0001'],gap:null};
  await db.query('select public.finish_learning_conversation($1,$2,$3,$4)',[request,claim.lease_token,JSON.stringify(reply),'gpt-6-luna']);
  const {learner}=await import('./fixtures/learning-database');await learner(db);
  const saved=(await db.query<{v:{revision:number;exchanges:{question:string;reply:unknown;model:string}[]}}>('select public.get_learning_conversation($1,$2,0) v',[cid,plan.id])).rows[0].v;
  assert.equal(saved.revision,1);assert.equal(saved.exchanges.length,1);assert.equal(saved.exchanges[0].question,question);assert.deepEqual(saved.exchanges[0].reply,reply);assert.equal(saved.exchanges[0].model,'gpt-6-luna');
  const retry=(await db.query<{v:{lease_token:null;conversation:unknown}}>('select public.request_learning_conversation($1,$2,0,$3,$4,0) v',[cid,plan.id,request,question])).rows[0].v;
  assert.equal(retry.lease_token,null);assert.deepEqual(retry.conversation,saved);
  const learning=(await db.query<{v:{attempts:unknown[];activities:unknown[]}}>('select public.get_source_learning($1) v',[source])).rows[0].v;
  assert.deepEqual(learning.attempts,[]);assert.deepEqual(learning.activities,[]);
 }finally{await db.close();}
});

test('removing source evidence redacts tutor replies, and clearing fences late generation',async()=>{
 const {learner}=await import('./fixtures/learning-database');
 const db=await draftDatabase();
 try{
  const plan=await preview(db);await db.query('select public.confirm_learning_plan($1)',[plan.id]);
  const cid=(await db.query<{v:{collection:{id:string}}}>('select public.resolve_source_learning_collection($1) v',[source])).rows[0].v.collection.id;
  const request=crypto.randomUUID();
  const begin=(await db.query<{v:{lease_token:string}}>('select public.request_learning_conversation($1,$2,0,$3,$4,0) v',[cid,plan.id,request,'Why support?'])).rows[0].v;
  await db.exec('reset role;set role service_role');
  await db.query('select public.finish_learning_conversation($1,$2,$3,$4)',[request,begin.lease_token,JSON.stringify({text:'Original source explanation',citation_ids:['p0001'],gap:null}),'gpt-6.1-sol']);
  await learner(db);await db.query('delete from public.sources where id=$1',[source]);
  const removed=(await db.query<{v:{evidence_current:boolean;exchanges:{question:string;reply:null;redacted:boolean;model:string}[]}}>('select public.get_learning_conversation($1,$2,0) v',[cid,plan.id])).rows[0].v;
  assert.equal(removed.evidence_current,false);assert.equal(removed.exchanges[0].reply,null);assert.equal(removed.exchanges[0].redacted,true);assert.equal(removed.exchanges[0].question,'Why support?');assert.equal(removed.exchanges[0].model,'gpt-6.1-sol');
  await db.query('select public.clear_learning_conversation($1,$2,0,1)',[cid,plan.id]);
  assert.deepEqual((await db.query<{v:{exchanges:unknown[];revision:number}}>('select public.get_learning_conversation($1,$2,0) v',[cid,plan.id])).rows[0].v.exchanges,[]);
  await assert.rejects(db.query('select public.request_learning_conversation($1,$2,0,$3,$4,0)',[cid,plan.id,request,'Why support?']),/cleared/);
  await db.exec('reset role;set role service_role');
  assert.equal((await db.query<{v:boolean}>('select public.finish_learning_conversation($1,$2,$3,$4) v',[request,begin.lease_token,JSON.stringify({text:'Must not resurrect',citation_ids:['p0001'],gap:null}),'gpt-6-luna'])).rows[0].v,false);
 }finally{await db.close();}
});

test('conversation sends and clears fence ownership, stale tabs, retries and late replies',async()=>{
 const {learner,bob}=await import('./fixtures/learning-database');
 const db=await draftDatabase();
 try{
  const plan=await preview(db);await db.query('select public.confirm_learning_plan($1)',[plan.id]);
  const cid=(await db.query<{v:{collection:{id:string}}}>('select public.resolve_source_learning_collection($1) v',[source])).rows[0].v.collection.id;
  const request=crypto.randomUUID();
  const send=()=>db.query<{v:{lease_token:string}}>('select public.request_learning_conversation($1,$2,0,$3,$4,0) v',[cid,plan.id,request,'Retain my question']);
  const first=(await send()).rows[0].v;
  await assert.rejects(send(),/still running/);
  await assert.rejects(db.query('select public.request_learning_conversation($1,$2,0,$3,$4,0)',[cid,plan.id,request,'Changed payload']),/retry changed/);
  await assert.rejects(db.query('select public.finish_learning_conversation($1,$2,null,null)',[request,first.lease_token]),/permission denied/);
  await learner(db,bob);await assert.rejects(db.query('select public.get_learning_conversation($1,$2,0)',[cid,plan.id]),/not found/);
  assert.deepEqual((await db.query('select question from public.learning_exchanges')).rows,[]);
  await learner(db);await assert.rejects(db.query('select public.get_learning_conversation($1,$2,1)',[cid,plan.id]),/Invalid lesson/);
  await assert.rejects(db.query('select public.clear_learning_conversation($1,$2,0,1)',[cid,plan.id]),/changed before clear/);
  await db.query('select public.clear_learning_conversation($1,$2,0,0)',[cid,plan.id]);
  await db.exec('reset role;set role service_role');
  assert.equal((await db.query<{v:boolean}>('select public.finish_learning_conversation($1,$2,$3,$4) v',[request,first.lease_token,JSON.stringify({text:'Late reply',citation_ids:['p0001'],gap:null}),'gpt-6-luna'])).rows[0].v,false);
  await learner(db);const read=(await db.query<{v:{revision:number;exchanges:unknown[]}}>('select public.get_learning_conversation($1,$2,0) v',[cid,plan.id])).rows[0].v;
  assert.equal(read.revision,1);assert.deepEqual(read.exchanges,[]);
 }finally{await db.close();}
});

test('failed tutor sends are retryable within limits; changed sources block saving replies',async()=>{
 const {learner}=await import('./fixtures/learning-database');
 const db=await draftDatabase();
 try{
  const plan=await preview(db);await db.query('select public.confirm_learning_plan($1)',[plan.id]);
  const cid=(await db.query<{v:{collection:{id:string}}}>('select public.resolve_source_learning_collection($1) v',[source])).rows[0].v.collection.id;
  const request=crypto.randomUUID();
  for(let i=0;i<3;i++){
   const claim=(await db.query<{v:{lease_token:string}}>('select public.request_learning_conversation($1,$2,0,$3,$4,0) v',[cid,plan.id,request,'Try this question'])).rows[0].v;
   await db.exec('reset role;set role service_role');await db.query('select public.finish_learning_conversation($1,$2,null,null)',[request,claim.lease_token]);await learner(db);
  }
  await assert.rejects(db.query('select public.request_learning_conversation($1,$2,0,$3,$4,0)',[cid,plan.id,request,'Try this question']),/retry limit/);
  const next=crypto.randomUUID();
  const claim=(await db.query<{v:{lease_token:string}}>('select public.request_learning_conversation($1,$2,0,$3,$4,0) v',[cid,plan.id,next,'Question before source change'])).rows[0].v;
  await db.exec('reset role');await db.query('update public.sources set source_version=2 where id=$1',[source]);await db.exec('set role service_role');
  assert.equal((await db.query<{v:boolean}>('select public.finish_learning_conversation($1,$2,$3,$4) v',[next,claim.lease_token,JSON.stringify({text:'Stale explanation',citation_ids:['p0001'],gap:null}),'gpt-6-luna'])).rows[0].v,false);
  await db.query('select public.finish_learning_conversation($1,$2,null,null)',[next,claim.lease_token]);await learner(db);
  const history=(await db.query<{v:{revision:number;exchanges:{status:string;reply:null}[]}}>('select public.get_learning_conversation($1,$2,0) v',[cid,plan.id])).rows[0].v;
  assert.equal(history.revision,0);assert.deepEqual(history.exchanges.map(e=>e.reply),[null,null]);assert.deepEqual(history.exchanges.map(e=>e.status),['failed','failed']);
  await assert.rejects(db.query('select public.request_learning_conversation($1,$2,0,$3,$4,0)',[cid,plan.id,crypto.randomUUID(),'New source needed']),/source evidence changed/);
 }finally{await db.close();}
});

test('conversation generation limits and rollback preserve readable history and clear',async()=>{
 const {learner}=await import('./fixtures/learning-database');const {readFile}=await import('node:fs/promises');
 const db=await draftDatabase();
 try{
  const plan=await preview(db);await db.query('select public.confirm_learning_plan($1)',[plan.id]);
  const cid=(await db.query<{v:{collection:{id:string}}}>('select public.resolve_source_learning_collection($1) v',[source])).rows[0].v.collection.id;
  for(let i=0;i<30;i++){
   const request=crypto.randomUUID();const claim=(await db.query<{v:{lease_token:string}}>('select public.request_learning_conversation($1,$2,0,$3,$4,0) v',[cid,plan.id,request,'Question '+i])).rows[0].v;
   await db.exec('reset role;set role service_role');await db.query('select public.finish_learning_conversation($1,$2,null,null)',[request,claim.lease_token]);await learner(db);
  }
  await assert.rejects(db.query('select public.request_learning_conversation($1,$2,0,$3,$4,0)',[cid,plan.id,crypto.randomUUID(),'Over limit']),/conversation limit/);
  await db.exec('reset role');await db.exec(await readFile(new URL('../../../supabase/rollbacks/202610100021_learning_conversations.sql',import.meta.url),'utf8'));await learner(db);
  assert.equal((await db.query<{v:{exchanges:unknown[]}}>('select public.get_learning_conversation($1,$2,0) v',[cid,plan.id])).rows[0].v.exchanges.length,30);
  await assert.rejects(db.query('select public.request_learning_conversation($1,$2,0,$3,$4,0)',[cid,plan.id,crypto.randomUUID(),'Rollback blocked']),/permission denied/);
  await db.query('select public.clear_learning_conversation($1,$2,0,0)',[cid,plan.id]);
  assert.deepEqual((await db.query<{v:{exchanges:unknown[]}}>('select public.get_learning_conversation($1,$2,0) v',[cid,plan.id])).rows[0].v.exchanges,[]);
 }finally{await db.close();}
});
