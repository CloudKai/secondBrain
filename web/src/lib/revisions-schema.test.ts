import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const alice='11111111-1111-4111-8111-111111111111',bob='22222222-2222-4222-8222-222222222222',id='33333333-3333-4333-8333-333333333333';
const text='Calculus describes change. Derivatives measure instantaneous rates and integrals accumulate contributions. '.repeat(3);
const changed='Algebra describes relationships between quantities and symbols. Equations represent constraints and transformations. '.repeat(3);
const capture={captured_text:changed,capture_origin:'pasted',coverage:'unknown',coverage_detail:'Supplied replacement',document:null,transcript:null};
async function learner(db:PGlite,user=alice){await db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${user}',false)`);}
async function database(){const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${alice}'),('${bob}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,service_role;`);
 for(const file of ['202610020001_browser_sources.sql','202610030002_source_studies.sql','202610030003_pdf_sources.sql','202610030004_video_transcripts.sql','202610030005_youtube_transcripts.sql','202610030006_topic_maps.sql','202610040007_topic_overviews.sql','202610040008_topic_corrections.sql'])await db.exec(await readFile(new URL(`../../../supabase/migrations/${file}`,import.meta.url),'utf8'));
 const migration=await readFile(new URL('../../../supabase/migrations/202610040009_source_revisions.sql',import.meta.url),'utf8').catch(()=> '');if(migration)await db.exec(migration);
 await learner(db);await db.query(`insert into sources(id,user_id,original_url,canonical_url,title,captured_text,capture_origin,coverage,coverage_detail) values($1,$2,'https://example.com/calculus','https://example.com/calculus','Calculus',$3,'pasted','unknown','Original text')`,[id,alice,text]);return db;
 }catch(e){await db.close();throw e;}}
async function compare(db:PGlite,input:unknown){return (await db.query<{value:{source_id:string;base_version:number;candidate_id:string|null;changed:boolean}}>('select compare_source_capture($1,$2::jsonb,null) value',[id,JSON.stringify(input)])).rows[0].value;}
test('comparison reuses unchanged evidence and stages changed material until explicit version confirmation',async()=>{
 const db=await database();try{
 const same=await compare(db,{...capture,captured_text:text});assert.equal(same.changed,false);assert.equal(same.candidate_id,null);
 const staged=await compare(db,capture);assert.equal(staged.changed,true);assert.equal(staged.base_version,1);assert.equal((await db.query<{captured_text:string}>('select captured_text from sources')).rows[0].captured_text,text);
 const applied=(await db.query<{value:{source_version:number;captured_text:string}}>('select confirm_source_refresh($1,$2,1) value',[id,staged.candidate_id])).rows[0].value;assert.equal(applied.source_version,2);assert.equal(applied.captured_text,changed);
 const saved=(await db.query<{value:{source:{captured_text:string;source_version:number}}}>('select get_source_version($1,1) value',[id])).rows[0].value;assert.equal(saved.source.captured_text,text);assert.equal(saved.source.source_version,1);
 }finally{await db.close();}
});

test('refresh is owned, invalidates old study leases and preserves exact archived note evidence',async()=>{
 const db=await database();try{
 await db.query('select request_source_study($1,false)',[id]);
 await db.exec("reset role;select set_config('request.jwt.claim.sub','',false);set role service_role");
 const old=(await db.query<{value:{lease_token:string}}>('select claim_source_study($1) value',[id])).rows[0].value;
 const ref={id:'p0001',start:0,end:25,excerpt:'Calculus describes change.',page:null,start_ms:null,end_ms:null};
 const note={overview:{text:ref.excerpt,citation_ids:['p0001']},concepts:[{title:'Change',text:ref.excerpt,citation_ids:['p0001']}],examples:[],equations:[],recall:[{question:'What changes?',answer:ref.excerpt,citation_ids:['p0001']}],references:[ref]};
 assert.equal((await db.query<{done:boolean}>('select finish_source_study($1,$2,$3::jsonb,null) done',[id,old.lease_token,JSON.stringify(note)])).rows[0].done,true);
 await learner(db);const staged=await compare(db,capture);
 await learner(db,bob);await assert.rejects(db.query('select confirm_source_refresh($1,$2,1)',[id,staged.candidate_id]));await assert.rejects(db.query('select get_source_version($1,1)',[id]));await assert.rejects(db.query('select * from source_revision_candidates'));
 await learner(db);await db.query('select confirm_source_refresh($1,$2,1)',[id,staged.candidate_id]);
 const saved=(await db.query<{value:{study:{note:unknown}}}>('select get_source_version($1,1) value',[id])).rows[0].value;assert.deepEqual(saved.study.note,note);
 await db.exec("reset role;select set_config('request.jwt.claim.sub','',false);set role service_role");
 assert.equal((await db.query<{done:boolean}>('select finish_source_study($1,$2,$3::jsonb,null) done',[id,old.lease_token,JSON.stringify(note)])).rows[0].done,false);
 const current=(await db.query<{value:{captured_text:string}}>('select claim_source_study($1) value',[id])).rows[0].value;assert.equal(current.captured_text,changed);
 }finally{await db.close();}
});

test('changed passages suspend corrected assignments until the learner supplies current evidence',async()=>{
 const db=await database();try{
 const topic='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';const oldRef={id:'p0001',start:0,end:25,excerpt:'Calculus describes change.'};
 const note=(r:typeof oldRef)=>({overview:{text:r.excerpt,citation_ids:[r.id]},concepts:[{title:'Topic',text:r.excerpt,citation_ids:[r.id]}],examples:[],equations:[],recall:[{question:'What is covered?',answer:r.excerpt,citation_ids:[r.id]}],references:[r]});
 const assignment={id:topic,title:'Rates of change',context:'Math',aliases:[],groups:['Math'],description:'How quantities change.',role:'main',citation_ids:['p0001'],uncertain:false,suggested_topic_id:null,placement_reason:'Substantive coverage.'};
 await db.exec('reset role');await db.query(`insert into source_studies(source_id,user_id,status,note) values($1,$2,'succeeded',$3::jsonb)`,[id,alice,JSON.stringify(note(oldRef))]);await db.query(`update source_topic_maps set status='succeeded',analysis=$2::jsonb where source_id=$1`,[id,JSON.stringify({topics:[assignment],relations:[],catalog_partial:false})]);
 await learner(db);await db.query('select correct_topic_library($1::jsonb)',[JSON.stringify({action:'assign',source_id:id,topic_ids:[topic],evidence_ids:['p0001']})]);
 const staged=await compare(db,capture);await db.query('select confirm_source_refresh($1,$2,1)',[id,staged.candidate_id]);
 await db.exec("reset role;select set_config('request.jwt.claim.sub','',false);set role service_role");
 const study=(await db.query<{value:{lease_token:string}}>('select claim_source_study($1) value',[id])).rows[0].value;
 const newRef={id:'p0001',start:0,end:58,excerpt:changed.slice(0,58)};await db.query('select finish_source_study($1,$2,$3::jsonb,null)',[id,study.lease_token,JSON.stringify(note(newRef))]);
 const mapping=(await db.query<{value:{lease_token:string}}>('select claim_source_topics($1) value',[id])).rows[0].value;
 await db.query('select finish_source_topics($1,$2,$3::jsonb,null)',[id,mapping.lease_token,JSON.stringify({topics:[assignment],relations:[],catalog_partial:false})]);
 await learner(db);const versions=(await db.query<{value:{correction_review:{topics:{id:string}[]}}}>('select list_source_versions($1) value',[id])).rows[0].value;assert.equal(versions.correction_review.topics[0].id,topic);
 assert.equal((await db.query<{analysis:unknown}>('select analysis from source_topic_maps')).rows[0].analysis,null);
 await db.query('select review_source_assignments($1,$2::uuid[],$3::text[])',[id,[topic],['p0001']]);
 const corrected=(await db.query<{analysis:{topics:{id:string;citation_ids:string[]}[]}}>('select analysis from source_topic_maps')).rows[0].analysis;assert.equal(corrected.topics[0].id,topic);assert.deepEqual(corrected.topics[0].citation_ids,['p0001']);
 assert.equal((await db.query<{value:{correction_review:unknown}}>('select list_source_versions($1) value',[id])).rows[0].value.correction_review,null);
 }finally{await db.close();}
});

test('unchanged replacement PDF containers reuse one source identity despite different upload digests',async()=>{
 const db=await database();try{
 const old='urn:pdf:sha256:'+'a'.repeat(64),next='urn:pdf:sha256:'+'b'.repeat(64);
 await db.exec('reset role');await db.query(`delete from sources where id=$1`,[id]);await db.query(`insert into sources(id,user_id,original_url,canonical_url,title,captured_text,capture_origin,coverage,coverage_detail,source_kind,document) values($1,$2,null,$3,'Uploaded calculus',$4,'upload','complete','Selectable pages','pdf',$5::jsonb)`,[id,alice,old,text,JSON.stringify({filename:'original.pdf',page_count:1,pages:[{page:1,start:0,end:text.length}]})]);
 await learner(db);const replacement={...capture,captured_text:text,capture_origin:'upload',coverage:'complete',document:{filename:'replacement.pdf',page_count:1,pages:[{page:1,start:0,end:text.length}]}};
 const checked=(await db.query<{value:{changed:boolean}}>('select compare_source_capture($1,$2::jsonb,$3) value',[id,JSON.stringify(replacement),next])).rows[0].value;assert.equal(checked.changed,false);
 const existing=(await db.query<{value:{id:string}}>('select find_source_identity($1) value',[next])).rows[0].value;assert.equal(existing.id,id);assert.equal((await db.query('select id from sources')).rows.length,1);
 }finally{await db.close();}
});

test('stale confirmations and invalid captures cannot overwrite the current version',async()=>{
 const db=await database();try{
 await assert.rejects(compare(db,{...capture,user_id:bob}));
 const first=await compare(db,capture);const second=await compare(db,{...capture,captured_text:changed+' Additional material.'});
 await assert.rejects(db.query('select confirm_source_refresh($1,$2,1)',[id,first.candidate_id]));
 await assert.rejects(db.query('select confirm_source_refresh($1,$2,2)',[id,second.candidate_id]));
 assert.equal((await db.query<{captured_text:string}>('select captured_text from sources')).rows[0].captured_text,text);
 await db.query('select confirm_source_refresh($1,$2,1)',[id,second.candidate_id]);await assert.rejects(db.query('select confirm_source_refresh($1,$2,1)',[id,second.candidate_id]));
 await db.query('delete from sources where id=$1',[id]);await assert.rejects(db.query('select list_source_versions($1)',[id]));
 await db.exec('reset role');for(const table of ['source_versions','source_revision_candidates','source_identities'])assert.deepEqual((await db.query(`select source_id from ${table}`)).rows,[]);
 }finally{await db.close();}
});

test('matching saved excerpts reanchor learner assignments to new passage IDs after refresh',async()=>{
 const db=await database();try{
 const topic='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';const excerpt='Calculus describes change.';
 const note=(refId:string,start:number)=>({overview:{text:excerpt,citation_ids:[refId]},concepts:[{title:'Change',text:excerpt,citation_ids:[refId]}],examples:[],equations:[],recall:[{question:'What changes?',answer:excerpt,citation_ids:[refId]}],references:[{id:refId,start,end:start+excerpt.length,excerpt}]});
 const assignment={id:topic,title:'Calculus',context:'Math',aliases:[],groups:['Math'],description:'Rates of change.',role:'main',citation_ids:['p0001'],uncertain:false,suggested_topic_id:null,placement_reason:'Substantive coverage.'};
 await db.exec('reset role');await db.query(`insert into source_studies(source_id,user_id,status,note) values($1,$2,'succeeded',$3::jsonb)`,[id,alice,JSON.stringify(note('p0001',0))]);await db.query(`update source_topic_maps set status='succeeded',analysis=$2::jsonb where source_id=$1`,[id,JSON.stringify({topics:[assignment],relations:[],catalog_partial:false})]);
 await learner(db);await db.query('select correct_topic_library($1::jsonb)',[JSON.stringify({action:'rename',topic_id:topic,title:'My calculus'})]);await db.query('select correct_topic_library($1::jsonb)',[JSON.stringify({action:'assign',source_id:id,topic_ids:[topic],evidence_ids:['p0001']})]);
 const staged=await compare(db,{...capture,captured_text:'New introduction. '+text});await db.query('select confirm_source_refresh($1,$2,1)',[id,staged.candidate_id]);
 await db.exec("reset role;select set_config('request.jwt.claim.sub','',false);set role service_role");const study=(await db.query<{value:{lease_token:string}}>('select claim_source_study($1) value',[id])).rows[0].value;await db.query('select finish_source_study($1,$2,$3::jsonb,null)',[id,study.lease_token,JSON.stringify(note('p0002',18))]);
 const mapping=(await db.query<{value:{lease_token:string}}>('select claim_source_topics($1) value',[id])).rows[0].value;await db.query('select finish_source_topics($1,$2,$3::jsonb,null)',[id,mapping.lease_token,JSON.stringify({topics:[{...assignment,citation_ids:['p0002']}],relations:[],catalog_partial:false})]);
 await learner(db);const mapped=(await db.query<{analysis:{topics:{title:string;citation_ids:string[]}[]}}>('select analysis from source_topic_maps')).rows[0].analysis;assert.equal(mapped.topics[0].title,'My calculus');assert.deepEqual(mapped.topics[0].citation_ids,['p0002']);
 assert.equal((await db.query<{value:{source_count:number}}>('select get_topic_overview($1) value',[topic])).rows[0].value.source_count,1);
 }finally{await db.close();}
});

test('refresh rollback disables promotion while preserving archived versions and current queued notes',async()=>{
 const db=await database();try{
 const staged=await compare(db,capture);await db.query('select confirm_source_refresh($1,$2,1)',[id,staged.candidate_id]);await db.exec('reset role');
 await db.exec(await readFile(new URL('../../../supabase/rollbacks/202610040009_source_revisions.sql',import.meta.url),'utf8'));
 await learner(db);await assert.rejects(compare(db,capture));
 assert.equal((await db.query<{value:{source:{captured_text:string}}}>('select get_source_version($1,1) value',[id])).rows[0].value.source.captured_text,text);
 assert.equal((await db.query<{source_version:number}>('select source_version from source_studies')).rows[0].source_version,2);
 }finally{await db.close();}
});
