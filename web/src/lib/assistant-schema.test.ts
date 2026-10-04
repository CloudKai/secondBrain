import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
const alice='11111111-1111-4111-8111-111111111111',bob='22222222-2222-4222-8222-222222222222',id='33333333-3333-4333-8333-333333333333';
const text='Retrieval augmented generation retrieves evidence before generating answers. '.repeat(4);
const note={overview:{text:'RAG retrieves evidence.',citation_ids:['p0001']},concepts:[{title:'RAG',text:'RAG retrieves evidence.',citation_ids:['p0001']}],examples:[],equations:[],recall:[{question:'What is retrieved?',answer:'Evidence.',citation_ids:['p0001']}],references:[{id:'p0001',start:0,end:text.length,excerpt:text,page:null,start_ms:null,end_ms:null}]};
async function database(){
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${alice}'),('${bob}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,service_role;`);
 for(const file of ['202610020001_browser_sources.sql','202610030002_source_studies.sql','202610030003_pdf_sources.sql','202610030004_video_transcripts.sql','202610030005_youtube_transcripts.sql','202610030006_topic_maps.sql','202610040007_topic_overviews.sql','202610040008_topic_corrections.sql','202610040009_source_revisions.sql','202610040010_long_sources.sql'])await db.exec(await readFile(new URL(`../../../supabase/migrations/${file}`,import.meta.url),'utf8'));
 await db.query(`insert into sources(id,user_id,original_url,canonical_url,title,captured_text,capture_origin,coverage,coverage_detail) values($1,$2,'https://example.com/rag','https://example.com/rag','RAG',$3,'pasted','unknown','Supplied article')`,[id,alice,text]);
 await db.query(`insert into source_studies(source_id,user_id,status,attempts,note) values($1,$2,'succeeded',1,$3::jsonb)`,[id,alice,JSON.stringify(note)]);
 // First run establishes RED before the new migration exists.
 try{await db.exec(await readFile(new URL('../../../supabase/migrations/202610050011_assistant_context.sql',import.meta.url),'utf8'));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 await learner(db);return db;
 }catch(e){await db.close();throw e;}
}
async function learner(db:PGlite,user=alice){await db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${user}',false)`);}
type Row={source_id:string;source_version:number;study_updated_at:string;map_updated_at:string|null;scope:string};
async function context(db:PGlite,topic:string|null=null,library=false){return (await db.query<{v:Row[]}>('select get_assistant_context($1,1,$2,$3,$4) v',[id,'How does retrieval help answers?',topic,library])).rows[0].v;}
async function valid(db:PGlite,rows:Row[],topic:string|null=null){return (await db.query<{v:boolean}>('select validate_assistant_context($1,$2,$3::jsonb) v',[id,topic,JSON.stringify(rows.map(({source_id,source_version,study_updated_at,map_updated_at,scope})=>({source_id,source_version,study_updated_at,map_updated_at,scope})))])).rows[0].v;}

test('assistant retrieval is owned and a changed note invalidates the answer context',async()=>{
 const db=await database();try{
 const rows=await context(db);
 assert.equal(rows.length,1);assert.equal(rows[0].source_id,id);assert.equal(rows[0].scope,'note');
 assert.equal(await valid(db,rows),true);
 await learner(db,bob);await assert.rejects(context(db));assert.equal(await valid(db,rows),false);
 await db.exec('reset role');await db.query("update source_studies set updated_at=updated_at+interval '1 second' where source_id=$1",[id]);
 await learner(db);assert.equal(await valid(db,rows),false);
 await db.exec('reset role;set role anon');await assert.rejects(context(db));
 }finally{await db.close();}
});

test('topic evidence precedes relevant library evidence without duplicates and corrections fence answers',async()=>{
 const db=await database();try{
 const second='44444444-4444-4444-8444-444444444444',third='55555555-5555-4555-8555-555555555555',foreign='66666666-6666-4666-8666-666666666666',topic='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 await db.exec('reset role');
 for(const [source,owner,url] of [[second,alice,'topic'],[third,alice,'library'],[foreign,bob,'foreign']]){
  await db.query(`insert into sources(id,user_id,original_url,canonical_url,title,captured_text,capture_origin,coverage,coverage_detail) values($1,$2,$3,$3,'RAG',$4,'pasted','unknown','Supplied article')`,[source,owner,'https://example.com/'+url,text]);
  await db.query(`insert into source_studies(source_id,user_id,status,attempts,note) values($1,$2,'succeeded',1,$3::jsonb)`,[source,owner,JSON.stringify(note)]);
 }
 const analysis={topics:[{id:topic,title:'RAG',context:'AI',aliases:[],role:'main',citation_ids:['p0001'],uncertain:false,suggested_topic_id:null,placement_reason:'Clear evidence.'}],relations:[],catalog_partial:false};
 for(const source of [id,second])await db.query(`update source_topic_maps set status='succeeded',analysis=$2::jsonb where source_id=$1`,[source,JSON.stringify(analysis)]);
 await learner(db);
 const rows=await context(db,topic,true);
 assert.deepEqual(rows.map(r=>[r.source_id,r.scope]),[[id,'note'],[second,'topic'],[third,'library']]);
 assert.equal(await valid(db,rows,topic),true);
 await assert.rejects(context(db,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true));
 await db.exec('reset role');await db.query("update source_topic_maps set updated_at=updated_at+interval '1 second' where source_id=$1",[second]);
 await learner(db);assert.equal(await valid(db,rows,topic),false);
 await db.exec('reset role');await db.query('delete from sources where id=$1',[third]);
 await learner(db);assert.equal(await valid(db,rows,topic),false);
 }finally{await db.close();}
});
