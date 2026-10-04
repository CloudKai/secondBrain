import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';

const alice='11111111-1111-4111-8111-111111111111', bob='22222222-2222-4222-8222-222222222222', id='33333333-3333-4333-8333-333333333333';
const text='Calculus studies change and accumulation. '.repeat(1100);
const summary={text:'Calculus studies change.',citation_ids:['p0001']};
async function database(){
 const db=new PGlite();
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${alice}'),('${bob}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,service_role;`);
 for(const file of ['202610020001_browser_sources.sql','202610030002_source_studies.sql','202610030003_pdf_sources.sql','202610030004_video_transcripts.sql','202610030005_youtube_transcripts.sql','202610030006_topic_maps.sql','202610040007_topic_overviews.sql','202610040008_topic_corrections.sql','202610040009_source_revisions.sql','202610040010_long_sources.sql'])await db.exec(await readFile(new URL(`../../../supabase/migrations/${file}`,import.meta.url),'utf8'));
 await learner(db);
 await db.query(`insert into sources(id,user_id,original_url,canonical_url,title,captured_text,capture_origin,coverage,coverage_detail) values($1,$2,'https://example.com/long','https://example.com/long','Long calculus',$3,'pasted','unknown','Supplied article')`,[id,alice,text]);
 await db.query('select request_source_study($1)',[id]);return db;
 }catch(e){await db.close();throw e;}
}
async function learner(db:PGlite,user=alice){await db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${user}',false)`);}
async function worker(db:PGlite){await db.exec("reset role;select set_config('request.jwt.claim.sub','',false);set role service_role");}
async function claim(db:PGlite){return (await db.query<{v:{lease_token:string;source_version:number;completed_sections:typeof summary[]}}>('select claim_source_study($1) v',[id])).rows[0].v;}

test('section progress survives retries under ownership and current worker lease',async()=>{
 const db=await database();try{
 await assert.rejects(db.query('select plan_source_study($1,1,$2,2)',[id,alice]));
 await worker(db);const first=await claim(db);
 assert.deepEqual(first.completed_sections,[]);
 await db.query('select plan_source_study($1,1,$2,2)',[id,first.lease_token]);
 await db.query('select save_study_section($1,1,$2,0,$3::jsonb)',[id,first.lease_token,JSON.stringify(summary)]);
 await db.query('select save_study_section($1,1,$2,0,$3::jsonb)',[id,first.lease_token,JSON.stringify(summary)]);
 await assert.rejects(db.query("select finish_source_study($1,$2,'{}'::jsonb,null)",[id,first.lease_token]));
 await db.query("select finish_source_study($1,$2,null,'provider_unavailable')",[id,first.lease_token]);
 await learner(db);const progress=(await db.query<{v:{sections_total:number;sections_completed:number;note:null;status:string}}>('select request_source_study($1) v',[id])).rows[0].v;
 assert.equal(progress.sections_total,2);assert.equal(progress.sections_completed,1);assert.equal(progress.note,null);assert.equal(progress.status,'queued');
 await assert.rejects(db.query('select * from study_sections'));
 await learner(db,bob);assert.deepEqual((await db.query('select source_id from source_studies')).rows,[]);
 await worker(db);await db.exec('update source_studies set next_attempt_at=now()');const second=await claim(db);
 assert.deepEqual(second.completed_sections,[summary]);assert.notEqual(second.lease_token,first.lease_token);
 assert.equal((await db.query<{v:boolean}>('select save_study_section($1,1,$2,1,$3::jsonb) v',[id,first.lease_token,JSON.stringify(summary)])).rows[0].v,false);
 await db.query('select save_study_section($1,1,$2,1,$3::jsonb)',[id,second.lease_token,JSON.stringify(summary)]);
 await db.query("select finish_source_study($1,$2,'{}'::jsonb,null)",[id,second.lease_token]);
 await learner(db);assert.equal((await db.query<{v:{sections_completed:number;status:string}}>('select request_source_study($1) v',[id])).rows[0].v.status,'succeeded');
 }finally{await db.close();}
});

test('refresh and removal fence old section work while retaining one source identity',async()=>{
 const db=await database();try{
 await worker(db);const first=await claim(db);
 await db.query('select plan_source_study($1,1,$2,2)',[id,first.lease_token]);
 await db.query('select save_study_section($1,1,$2,0,$3::jsonb)',[id,first.lease_token,JSON.stringify(summary)]);
 await learner(db);
 const replacement={captured_text:text+' Updated explanation.',capture_origin:'pasted',coverage:'unknown',coverage_detail:'Supplied replacement',document:null,transcript:null};
 const candidate=(await db.query<{v:{candidate_id:string}}>('select compare_source_capture($1,$2::jsonb) v',[id,JSON.stringify(replacement)])).rows[0].v;
 await db.query('select confirm_source_refresh($1,$2,1)',[id,candidate.candidate_id]);
 assert.equal((await db.query('select id from sources')).rows.length,1);
 const fresh=(await db.query<{v:{sections_total:number;sections_completed:number}}>('select request_source_study($1) v',[id])).rows[0].v;
 assert.equal(fresh.sections_completed,0);assert.equal(fresh.sections_total,0);
 await worker(db);
 assert.equal((await db.query<{v:boolean}>('select save_study_section($1,1,$2,1,$3::jsonb) v',[id,first.lease_token,JSON.stringify(summary)])).rows[0].v,false);
 const next=await claim(db);assert.equal(next.source_version,2);assert.deepEqual(next.completed_sections,[]);
 await learner(db);await db.query('delete from sources where id=$1',[id]);
 await worker(db);assert.equal((await db.query<{v:boolean}>('select plan_source_study($1,2,$2,2) v',[id,next.lease_token])).rows[0].v,false);
 assert.deepEqual((await db.query('select source_id from study_sections')).rows,[]);
 }finally{await db.close();}
});

test('original page and cue ranges validate under RLS and unchanged legacy captures reuse',async()=>{
 const db=await database();try{
 const captured='Calculus describes change and accumulation. '.repeat(4);
 const document={filename:'range.pdf',page_count:4,pages:[{page:3,start:0,end:captured.length}],selected_pages:{start:3,end:3}};
 assert.equal((await db.query<{v:boolean}>('select valid_pdf_document($1::jsonb,$2) v',[JSON.stringify(document),captured])).rows[0].v,true);
 const pdfId='55555555-5555-4555-8555-555555555555';
 await db.query(`insert into sources(id,user_id,original_url,canonical_url,title,captured_text,capture_origin,coverage,coverage_detail,source_kind,document) values($1,$2,null,$3,'Selected calculus',$4,'upload','partial','Selected page 3','pdf',$5::jsonb)`,[pdfId,alice,'urn:pdf:sha256:'+'a'.repeat(64),captured,JSON.stringify(document)]);
 assert.equal((await db.query<{v:boolean}>('select valid_pdf_document($1::jsonb,$2) v',[JSON.stringify({...document,selected_pages:{start:4,end:4}}),captured])).rows[0].v,false);
 assert.equal((await db.query<{v:boolean}>('select valid_pdf_document($1::jsonb,$2) v',[JSON.stringify({...document,selected_pages:{start:3,end:5}}),captured])).rows[0].v,false);
 const transcript={provider:'youtube',format:'srt',filename:null,segments:[{start:0,end:captured.length,start_ms:24000,end_ms:42000}],selected_time:{start_ms:25000,end_ms:40000}};
 assert.equal((await db.query<{v:boolean}>('select valid_video_transcript($1::jsonb,$2) v',[JSON.stringify(transcript),captured])).rows[0].v,true);
 const videoId='66666666-6666-4666-8666-666666666666',url='https://www.youtube.com/watch?v=ovrv11testA';
 await db.query(`insert into sources(id,user_id,original_url,canonical_url,title,captured_text,capture_origin,coverage,coverage_detail,source_kind,transcript) values($1,$2,$3,$3,'Selected lecture',$4,'pasted','partial','Selected timed cues','video',$5::jsonb)`,[videoId,alice,url,captured,JSON.stringify(transcript)]);
 assert.equal((await db.query<{v:boolean}>('select valid_video_transcript($1::jsonb,$2) v',[JSON.stringify({...transcript,selected_time:{start_ms:43000,end_ms:45000}}),captured])).rows[0].v,false);
 assert.equal((await db.query<{v:boolean}>('select valid_video_transcript($1::jsonb,$2) v',[JSON.stringify({...transcript,format:'text'}),captured])).rows[0].v,false);
 await db.exec('reset role');
 await db.query('update sources set document=$2::jsonb where id=$1',[pdfId,JSON.stringify({filename:'range.pdf',page_count:1,pages:[{page:1,start:0,end:captured.length}]})]);
 await learner(db);
 const legacyCapture={captured_text:captured,capture_origin:'upload',coverage:'complete',coverage_detail:'Selectable text',document:{filename:'new.pdf',page_count:1,pages:[{page:1,start:0,end:captured.length}],selected_pages:null},transcript:null};
 assert.equal((await db.query<{v:{changed:boolean}}>('select compare_source_capture($1,$2::jsonb) v',[pdfId,JSON.stringify(legacyCapture)])).rows[0].v.changed,false);
 await learner(db,bob);assert.deepEqual((await db.query('select id from sources')).rows,[]);
 }finally{await db.close();}
});
