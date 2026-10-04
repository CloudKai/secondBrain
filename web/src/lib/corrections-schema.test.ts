import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import type {TopicRecord} from './topic-library';
const alice='11111111-1111-4111-8111-111111111111',bob='22222222-2222-4222-8222-222222222222';
const a='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',b='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',c='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const first='33333333-3333-4333-8333-333333333333',second='44444444-4444-4444-8444-444444444444';
const assignment=(id:string,title:string)=>({id,title,context:'Machine learning',aliases:[],groups:['AI'],description:'Saved evidence about '+title,role:'main',citation_ids:['p0001'],uncertain:false,suggested_topic_id:null,placement_reason:'Substantive coverage.'});
const passage={id:'p0001',start:0,end:30,excerpt:'Retrieval supports generation.',page:null,start_ms:null,end_ms:null};
const note={overview:{text:passage.excerpt,citation_ids:['p0001']},concepts:[{title:'RAG',text:passage.excerpt,citation_ids:['p0001']}],examples:[],equations:[],recall:[{question:'What supports generation?',answer:passage.excerpt,citation_ids:['p0001']}],references:[passage]};
async function database(){const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${alice}'),('${bob}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,service_role;`);
 for(const file of ['202610020001_browser_sources.sql','202610030002_source_studies.sql','202610030006_topic_maps.sql','202610040007_topic_overviews.sql','202610040008_topic_corrections.sql'])await db.exec(await readFile(new URL(`../../../supabase/migrations/${file}`,import.meta.url),'utf8'));
 for(const [id,topics] of [[first,[assignment(a,'RAG'),assignment(b,'Retrieval')]], [second,[assignment(c,'RAG duplicate'),assignment(b,'Retrieval')]]] as const){
 await db.query(`insert into sources(id,user_id,original_url,canonical_url,title,captured_text,capture_origin,coverage,coverage_detail) values($1,$2,$3,$3,'Correction evidence',$4,'pasted','unknown','Controlled input')`,[id,alice,`https://example.com/${id}`,passage.excerpt.repeat(5)]);
 await db.query(`insert into source_studies(source_id,user_id,status,attempts,note) values($1,$2,'succeeded',1,$3::jsonb)`,[id,alice,JSON.stringify(note)]);
 await db.query(`update source_topic_maps set status='succeeded',analysis=$2::jsonb where source_id=$1`,[id,JSON.stringify({topics,relations:[{source:topics[0].id,target:b,kind:'uses',reason:'RAG uses retrieval.',citation_ids:['p0001']}],catalog_partial:false})]);}
 await learner(db,alice);return db;
 }catch(e){await db.close();throw e;}}
async function learner(db:PGlite,user=alice){await db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${user}',false)`);}
async function worker(db:PGlite){await db.exec("reset role;select set_config('request.jwt.claim.sub','',false);set role service_role");}
async function correct(db:PGlite,action:unknown){return db.query('select correct_topic_library($1::jsonb)',[JSON.stringify(action)]);}
async function maps(db:PGlite){return (await db.query<{analysis:NonNullable<TopicRecord['analysis']>}>('select analysis from source_topic_maps order by source_id')).rows.map(r=>r.analysis);}

test('owned rename persists across reads and future worker output without changing source notes',async()=>{
 const db=await database();try{
 await correct(db,{action:'rename',topic_id:a,title:'Retrieval grounded generation'});
 assert.equal((await maps(db))[0].topics[0].title,'Retrieval grounded generation');
 await learner(db,bob);assert.equal((await maps(db)).length,0);await assert.rejects(correct(db,{action:'rename',topic_id:a,title:'Forged name'}));
 await assert.rejects(db.query('select * from topic_rules'));
 await worker(db);await db.query(`update source_topic_maps set analysis=$2::jsonb where source_id=$1`,[first,JSON.stringify({topics:[assignment(a,'RAG')],relations:[],catalog_partial:false})]);
 await learner(db);assert.equal((await maps(db))[0].topics[0].title,'Retrieval grounded generation');assert.deepEqual((await db.query<{note:unknown}>('select note from source_studies order by source_id')).rows.map(r=>r.note),[note,note]);
 }finally{await db.close();}
});

test('merge deduplicates memberships and relations while future output follows the survivor',async()=>{
 const db=await database();try{
 await correct(db,{action:'merge',topic_id:c,target_id:a});
 let current=await maps(db);assert.deepEqual(current.map(m=>m.topics.map(t=>t.id)),[[a,b],[a,b]]);assert.equal(current[1].relations[0].source,a);
 await worker(db);await db.query(`update source_topic_maps set analysis=$2::jsonb where source_id=$1`,[second,JSON.stringify({topics:[assignment(c,'RAG duplicate'),assignment(a,'RAG'),assignment(b,'Retrieval')],relations:[{source:c,target:a,kind:'uses',reason:'Duplicate self link.',citation_ids:['p0001']}],catalog_partial:false})]);
 await learner(db);current=await maps(db);assert.equal(current[1].topics.filter(t=>t.id===a).length,1);assert.deepEqual(current[1].relations,[]);assert.deepEqual(current[1].topics.find(t=>t.id===a)?.citation_ids,['p0001']);
 await assert.rejects(correct(db,{action:'merge',topic_id:a,target_id:a}));
 assert.deepEqual((await db.query<{note:unknown}>('select note from source_studies order by source_id')).rows.map(r=>r.note),[note,note]);
 }finally{await db.close();}
});

test('rejected connections survive merges, supporting-source deletion and later automatic comparison',async()=>{
 const db=await database();try{
 await correct(db,{action:'connection',source:a,target:b,state:'rejected'});
 await correct(db,{action:'connection',source:c,target:b,state:'accepted'});
 await correct(db,{action:'merge',topic_id:a,target_id:c});
 assert.deepEqual((await db.query('select source,target,state from topic_connection_decisions')).rows,[{source:b,target:c,state:'rejected'}]);
 await db.query('delete from sources where id=$1',[first]);
 assert.equal((await db.query<{state:string}>('select state from topic_connection_decisions')).rows[0].state,'rejected');
 await learner(db,bob);assert.deepEqual((await db.query('select * from topic_connection_decisions')).rows,[]);await assert.rejects(correct(db,{action:'connection',source:b,target:c,state:'accepted'}));
 await learner(db);await correct(db,{action:'connection',source:b,target:c,state:'accepted'});assert.equal((await db.query<{state:string}>('select state from topic_connection_decisions')).rows[0].state,'accepted');
 }finally{await db.close();}
});

test('source assignment correction preserves other memberships and fences later model output',async()=>{
 const db=await database();try{
 await correct(db,{action:'assign',source_id:first,topic_ids:[a,c],evidence_ids:['p0001']});
 let current=await maps(db);assert.deepEqual(current[0].topics.map(t=>t.id),[a,c]);assert.equal(current[1].topics.some(t=>t.id===b),true);
 await assert.rejects(correct(db,{action:'assign',source_id:first,topic_ids:[a],evidence_ids:['invented']}));
 await worker(db);const analysis={topics:[assignment(a,'RAG'),assignment(b,'Retrieval')],relations:[],catalog_partial:false};
 await db.query(`update source_topic_maps set analysis=$2::jsonb where source_id=$1`,[first,JSON.stringify(analysis)]);
 await learner(db);current=await maps(db);assert.deepEqual(current[0].topics.map(t=>t.id),[a,c]);
 await correct(db,{action:'rename',topic_id:c,title:'Grounded generation'});assert.equal((await maps(db))[0].topics[1].title,'Grounded generation');
 assert.deepEqual((await db.query<{note:unknown}>('select note from source_studies order by source_id')).rows.map(r=>r.note),[note,note]);
 await db.query('delete from sources where id=$1',[first]);await worker(db);assert.deepEqual((await db.query('select source_id from source_topic_overrides')).rows,[]);assert.equal((await db.query<{claim:unknown}>('select claim_source_topics($1) as claim',[first])).rows[0].claim,null);
 }finally{await db.close();}
});

test('assignment changes invalidate combined citations and deleted sources reject late worker completion',async()=>{
 const db=await database();try{
 const queued=(await db.query<{value:{record:{id:string}}}>('select set_topic_overview_view($1,$2,false) value',[b,'combined'])).rows[0].value;
 await worker(db);const claim=(await db.query<{value:{lease_token:string}}>('select claim_topic_overview($1) value',[queued.record.id])).rows[0].value;
 await learner(db);await correct(db,{action:'assign',source_id:first,topic_ids:[a],evidence_ids:['p0001']});
 const snapshot=(await db.query<{value:{record:unknown;needs_refresh:boolean;source_count:number}}>('select get_topic_overview($1) value',[b])).rows[0].value;
 assert.equal(snapshot.record,null);assert.equal(snapshot.needs_refresh,true);assert.equal(snapshot.source_count,1);
 await worker(db);assert.equal((await db.query<{done:boolean}>('select finish_topic_overview($1,$2,$3::jsonb,null) done',[queued.record.id,claim.lease_token,JSON.stringify({overview:{text:'Obsolete',reference_ids:[]},references:[]})])).rows[0].done,false);
 // A queued mapping fixture exercises the real service claim/finish boundary.
 await db.query(`update source_topic_maps set status='queued',analysis=null,attempts=0,next_attempt_at=now() where source_id=$1`,[first]);
 const mapping=(await db.query<{value:{lease_token:string}}>('select claim_source_topics($1) value',[first])).rows[0].value;
 await learner(db);await db.query('delete from sources where id=$1',[first]);await worker(db);
 assert.equal((await db.query<{done:boolean}>('select finish_source_topics($1,$2,$3::jsonb,null) done',[first,mapping.lease_token,JSON.stringify({topics:[assignment(a,'RAG')],relations:[],catalog_partial:false})])).rows[0].done,false);
 await db.exec('reset role');await db.exec(await readFile(new URL('../../../supabase/rollbacks/202610040008_topic_corrections.sql',import.meta.url),'utf8'));
 assert.deepEqual((await db.query<{note:unknown}>('select note from source_studies')).rows.map(r=>r.note),[note]);assert.equal((await maps(db)).length,1);
 }finally{await db.close();}
});
