import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {draftDatabase,learner,preview,source} from './fixtures/learning-database';

test('full-capture previews retain evidence absent from the note without changing it or awarding activity',async()=>{
 const db=await draftDatabase();
 try{
  const request=crypto.randomUUID();
  const capture=(await db.query<{captured_text:string}>('select captured_text from public.sources where id=$1',[source])).rows[0].captured_text;
  const hidden=' Hidden detail: uncommitted operations need replay after an outage.';
  await db.exec('reset role');await db.query('update public.sources set captured_text=$2 where id=$1',[source,capture+hidden]);
  await db.query("update public.retrieval_indexes set status='ready',chunks_total=1,chunks_completed=1 where source_id=$1",[source]);await learner(db);
  const note=(await db.query('select note from public.source_studies where source_id=$1',[source])).rows[0];
  const context=(await db.query<{v:{lease_token:string}}>('select public.request_learning_capture_preview($1,1,$2,$3,$4,null) v',[source,request,'Explain replay','foundation'])).rows[0].v;
  const snapshots=(await db.query<{v:unknown}>('select public.get_assistant_search_inventory($1,1,null,false) v',[source])).rows[0].v;
  const reference={id:'r-hidden',start:Array.from(capture).length+1,end:Array.from(capture+hidden).length,excerpt:hidden.slice(1),page:null,start_ms:null,end_ms:null};
  const claim={text:'Uncommitted operations need replay.',citation_ids:['r-hidden']};
  const path={title:'Explain replay',outcomes:['Explain uncommitted recovery'],prerequisites:[],coverage:'One captured passage',gaps:[],background:[],lessons:[{title:'Replay',outcome:'Explain uncommitted recovery',explanation:claim,example:null,check:{kind:'explain',question:'Which work needs replay?',criteria:['Identifies uncommitted operations'],hint:'Was the work committed?',worked_answer:claim}}]};
  const manifest={policy_version:'teaching_manifest_v1',coverage:'A sampled passage, not the entire source.',gaps:[],entries:[{kind:'concept',text:'Uncommitted replay',citation_ids:['r-hidden']}]};
  await db.exec('reset role;set role service_role');
  const body=[request,context.lease_token,JSON.stringify({suggested_goal:'Explain replay',paths:[path]}),'Explain replay',JSON.stringify([reference]),'gpt-6-luna',JSON.stringify(manifest),JSON.stringify(snapshots)];
  assert.equal((await db.query<{v:boolean}>('select public.finish_learning_capture_preview($1,$2,$3,$4,$5,$6,$7,$8) v',body)).rows[0].v,true);
  await learner(db);const saved=(await db.query<{v:{plans:{id:string;references:unknown[];teaching:unknown}[];attempts:unknown[];activities:unknown[]}}>('select public.get_source_learning($1) v',[source])).rows[0].v;
  assert.deepEqual(saved.plans[0].references,[reference]);assert.ok(saved.plans[0].teaching);
  assert.deepEqual((await db.query('select note from public.source_studies where source_id=$1',[source])).rows[0],note);
  assert.deepEqual(saved.attempts,[]);assert.deepEqual(saved.activities,[]);
  const replay=(await db.query<{v:{lease_token:null}}>('select public.request_learning_capture_preview($1,1,$2,$3,$4,null) v',[source,request,'Explain replay','foundation'])).rows[0].v;
  assert.equal(replay.lease_token,null);
  await assert.rejects(db.query('select public.request_learning_preview($1,1,$2,$3,$4,null)',[source,request,'Explain replay','foundation']),/mode/);
  await db.query('select public.confirm_learning_plan($1)',[saved.plans[0].id]);
  const cid=(await db.query<{v:{collection:{id:string}}}>('select public.resolve_source_learning_collection($1) v',[source])).rows[0].v.collection.id;
  await db.query('delete from public.sources where id=$1',[source]);
  const removed=(await db.query<{v:{learning:{plans:{teaching:null}[]}}}>('select public.get_learning_collection($1) v',[cid])).rows[0].v;
  assert.equal(removed.learning.plans[0].teaching,null);
 }finally{await db.close();}
});

test('capture writer rejects forged coordinates, index races and cross-owner requests through public RPCs',async()=>{
 const {bob}=await import('./fixtures/learning-database');
 const db=await draftDatabase();
 try{
  await db.exec('reset role');await db.query("update public.retrieval_indexes set status='ready',chunks_total=1,chunks_completed=1 where source_id=$1",[source]);await learner(db);
  const request=crypto.randomUUID();
  const context=(await db.query<{v:{lease_token:string}}>('select public.request_learning_capture_preview($1,1,$2,$3,$4,null) v',[source,request,'Explain support','foundation'])).rows[0].v;
  const snapshots=(await db.query<{v:unknown[]}>('select public.get_assistant_search_inventory($1,1,null,false) v',[source])).rows[0].v;
  const original=(await db.query<{note:{references:unknown[]}}>('select note from public.source_studies where source_id=$1',[source])).rows[0].note.references[0];
  const claim={text:'Evidence supports a claim.',citation_ids:['p0001']};
  const draft={suggested_goal:'Explain support',paths:[{title:'Support',outcomes:['Explain support'],prerequisites:[],coverage:'Selected text',gaps:[],background:[],lessons:[{title:'Support',outcome:'Explain support',explanation:claim,example:null,check:{kind:'explain',question:'Why use evidence?',criteria:['Identifies support'],hint:'Check the claim',worked_answer:claim}}]}]};
  const manifest={policy_version:'teaching_manifest_v1',coverage:'Sample only',gaps:[],entries:[{kind:'concept',text:'Support',citation_ids:['p0001']}]};
  await learner(db,bob);await assert.rejects(db.query('select public.request_learning_capture_preview($1,1,$2,$3,$4,null)',[source,request,'Explain support','foundation']),/not found/i);
  await assert.rejects(db.query('select public.finish_learning_capture_preview($1,$2,null,null,null,null,null,null)',[request,context.lease_token]),/permission denied/);
  await db.exec('reset role;set role service_role');
  const finish=(refs:unknown,snaps:unknown=snapshots,map:unknown=manifest)=>db.query('select public.finish_learning_capture_preview($1,$2,$3,$4,$5,$6,$7,$8)',[request,context.lease_token,JSON.stringify(draft),'Explain support',JSON.stringify(refs),'gpt-6-luna',JSON.stringify(map),JSON.stringify(snaps)]);
  await assert.rejects(finish([{...(original as object),start:'0'}]),/Invalid original capture reference/);
  await assert.rejects(finish([{...(original as object),page:1}]),/Invalid original capture reference/);
  await assert.rejects(finish([{...(original as object),excerpt:'Invented evidence'}]),/Invalid original capture reference/);
  await assert.rejects(finish([original],snapshots,{...manifest,entries:[{kind:'concept',text:'Support',citation_ids:['forged']}]}),/Invalid manifest evidence/);
  await assert.rejects(finish([original],[{...(snapshots[0] as object),generation:crypto.randomUUID()}]),/evidence changed/);
  await db.exec('reset role');await db.query("update public.retrieval_indexes set status='failed' where source_id=$1",[source]);await db.exec('set role service_role');
  await assert.rejects(finish([original]),/evidence changed/);
  assert.equal((await db.query<{v:boolean}>('select public.finish_learning_capture_preview($1,$2,null,null,null,null,null,null) v',[request,context.lease_token])).rows[0].v,true);
  await learner(db);const saved=(await db.query<{v:{plans:unknown[]}}>('select public.get_source_learning($1) v',[source])).rows[0].v;
  assert.deepEqual(saved.plans,[]);
 }finally{await db.close();}
});

test('timed evidence rejects string timestamps and retains exact numeric cue locations',async()=>{
 const db=await draftDatabase();
 try{
  const capture=(await db.query<{captured_text:string}>('select captured_text from public.sources where id=$1',[source])).rows[0].captured_text;
  const reference={id:'cue1',start:0,end:Array.from(capture).length,excerpt:capture,page:null,start_ms:13000,end_ms:18000};
  const transcript={provider:'zoom',format:'vtt',filename:null,segments:[{start:0,end:reference.end,start_ms:13000,end_ms:18000}]};
  await db.exec('reset role');
  await db.query("update public.sources set source_kind='video',capture_origin='pasted',coverage='partial',original_url='https://zoom.us/rec/share/example',canonical_url='https://zoom.us/rec/share/example',transcript=$2 where id=$1",[source,JSON.stringify(transcript)]);
  await db.query("update public.retrieval_indexes set status='ready',chunks_total=1,chunks_completed=1 where source_id=$1",[source]);await learner(db);
  const request=crypto.randomUUID(),context=(await db.query<{v:{lease_token:string}}>('select public.request_learning_capture_preview($1,1,$2,$3,$4,null) v',[source,request,'Explain support','foundation'])).rows[0].v;
  const snapshots=(await db.query<{v:unknown}>('select public.get_assistant_search_inventory($1,1,null,false) v',[source])).rows[0].v;
  const claim={text:'Evidence supports a claim.',citation_ids:['cue1']};
  const draft={suggested_goal:'Explain support',paths:[{title:'Support',outcomes:['Explain support'],prerequisites:[],coverage:'Selected cue',gaps:[],background:[],lessons:[{title:'Support',outcome:'Explain support',explanation:claim,example:null,check:{kind:'explain',question:'Why use evidence?',criteria:['Identifies support'],hint:'Check the claim',worked_answer:claim}}]}]};
  const manifest={policy_version:'teaching_manifest_v1',coverage:'Sample only',gaps:[],entries:[{kind:'concept',text:'Support',citation_ids:['cue1']}]};
  await db.exec('reset role;set role service_role');
  const finish=(refs:unknown)=>db.query<{v:boolean}>('select public.finish_learning_capture_preview($1,$2,$3,$4,$5,$6,$7,$8) v',[request,context.lease_token,JSON.stringify(draft),'Explain support',JSON.stringify(refs),'gpt-6-luna',JSON.stringify(manifest),JSON.stringify(snapshots)]);
  await assert.rejects(finish([{...reference,start_ms:'13000',end_ms:'18000'}]),/Invalid original capture reference/);
  await assert.rejects(finish([{...reference,start_ms:12000}]),/Invalid original capture reference/);
  assert.equal((await finish([reference])).rows[0].v,true);
  await learner(db);const saved=(await db.query<{v:{plans:{references:unknown[]}[]}}>('select public.get_source_learning($1) v',[source])).rows[0].v;
  assert.deepEqual(saved.plans[0].references,[reference]);
 }finally{await db.close();}
});

test('physical PDF pages preserve Unicode spans and reject neighbouring page attribution',async()=>{
 const db=await draftDatabase();
 try{
  const prefix='First page: this introduction describes a difference quotient and why a limiting process is needed before identifying an instantaneous slope.\n',excerpt='On page two, limₕ→₀ ((x+h)²−x²)/h = 2x.';
  const capture=prefix+excerpt,start=Array.from(prefix).length,end=Array.from(capture).length;
  const reference={id:'pdf2',start,end,excerpt,page:2,start_ms:null,end_ms:null};
  const document={filename:'derivative.pdf',page_count:2,pages:[{page:1,start:0,end:start-1},{page:2,start,end}]};
  await db.exec('reset role');
  await db.query("update public.sources set source_kind='pdf',captured_text=$2,document=$3 where id=$1",[source,capture,JSON.stringify(document)]);
  await db.query("update public.retrieval_indexes set status='ready',chunks_total=1,chunks_completed=1 where source_id=$1",[source]);await learner(db);
  const request=crypto.randomUUID(),context=(await db.query<{v:{lease_token:string}}>('select public.request_learning_capture_preview($1,1,$2,$3,$4,null) v',[source,request,'Explain the derivative','foundation'])).rows[0].v;
  const snapshots=(await db.query<{v:unknown}>('select public.get_assistant_search_inventory($1,1,null,false) v',[source])).rows[0].v;
  const claim={text:'The derivative of x² is 2x.',citation_ids:['pdf2']};
  const draft={suggested_goal:'Explain the derivative',paths:[{title:'Derivative',outcomes:['Explain the limit'],prerequisites:[],coverage:'One page-two passage',gaps:[],background:[],lessons:[{title:'Limit',outcome:'Explain the limit',explanation:claim,example:null,check:{kind:'explain',question:'What does the limit approach?',criteria:['Identifies 2x'],hint:'Simplify the difference quotient.',worked_answer:claim}}]}]};
  const manifest={policy_version:'teaching_manifest_v1',coverage:'Selected page-two evidence only',gaps:[],entries:[{kind:'concept',text:'Difference quotient',citation_ids:['pdf2']}]};
  await db.exec('reset role;set role service_role');
  const finish=(refs:unknown)=>db.query<{v:boolean}>('select public.finish_learning_capture_preview($1,$2,$3,$4,$5,$6,$7,$8) v',[request,context.lease_token,JSON.stringify(draft),'Explain the derivative',JSON.stringify(refs),'gpt-6-luna',JSON.stringify(manifest),JSON.stringify(snapshots)]);
  await assert.rejects(finish([{...reference,page:1}]),/Invalid original capture reference/);
  await assert.rejects(finish([{...reference,page:'2'}]),/Invalid original capture reference/);
  assert.equal((await finish([reference])).rows[0].v,true);
  await learner(db);const saved=(await db.query<{v:{plans:{references:unknown[]}[]}}>('select public.get_source_learning($1) v',[source])).rows[0].v;
  assert.deepEqual(saved.plans[0].references,[reference]);
 }finally{await db.close();}
});

test('capture recovery disables new generation while keeping note previews and saved history readable',async()=>{
 const db=await draftDatabase();
 try{
  const existing=await preview(db);
  await db.query('select public.confirm_learning_plan($1)',[existing.id]);
  const before=(await db.query<{v:unknown}>('select public.get_source_learning($1) v',[source])).rows[0].v;
  await db.exec('reset role');
  await db.exec(await readFile(new URL('../../../supabase/rollbacks/202610100022_capture_learning.sql',import.meta.url),'utf8'));
  await learner(db);
  await assert.rejects(db.query('select public.request_learning_capture_preview($1,1,$2,$3,$4,null)',[source,crypto.randomUUID(),'Explain support','foundation']),/permission denied/);
  assert.deepEqual((await db.query<{v:unknown}>('select public.get_source_learning($1) v',[source])).rows[0].v,before);
  const retained=await preview(db,'advanced',existing.path_id);
  assert.ok(retained.id);
  await db.exec('reset role;set role service_role');
  await assert.rejects(db.query('select public.finish_learning_capture_preview($1,$2,null,null,null,null,null,null)',[crypto.randomUUID(),crypto.randomUUID()]),/permission denied/);
 }finally{await db.close();}
});
