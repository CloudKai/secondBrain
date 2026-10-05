import test from 'node:test';
import assert from 'node:assert/strict';
import {createSourceClient} from './source-client';
const owner='11111111-1111-4111-8111-111111111111',id='33333333-3333-4333-8333-333333333333';
const text='Calculus describes change and accumulation. '.repeat(4);
const pdf={id,source_version:1,original_url:null,canonical_url:'urn:pdf:sha256:'+'a'.repeat(64),source_kind:'pdf' as const,document:{filename:'selected.pdf',page_count:4,pages:[{page:3,start:0,end:text.length}],selected_pages:{start:3,end:3}},transcript:null,title:'Calculus',captured_text:text,captured_at:'2026-10-04T00:00:00Z',capture_origin:'upload' as const,coverage:'partial' as const,coverage_detail:'Selected PDF page 3.',study_status:'pending' as const};
function clientWith(respond:(path:string,init?:RequestInit)=>Response){
 const token=`${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:owner,exp:2000000000})).toString('base64url')}.signature`;
 const values=new Map<string,string>();
 return createSourceClient({url:'https://supabase.test',publicKey:'public-test'},{storage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>{values.set(k,v);},removeItem:k=>{values.delete(k);}},fetch:async(input,init)=>{
  if(String(input).includes('/auth/v1/signup'))return Response.json({access_token:token,refresh_token:'refresh',token_type:'bearer',expires_in:3600,user:{id:owner,is_anonymous:true,app_metadata:{},user_metadata:{}}});
  assert.equal(new Headers(init?.headers).get('Authorization'),`Bearer ${token}`);return respond(String(input),init);
 }});
}
test('PDF import sends selected original pages and validates their returned locations',async()=>{
 const client=clientWith((path,init)=>{const url=new URL(path,'https://app.test');assert.equal(url.searchParams.get('page_start'),'3');assert.equal(url.searchParams.get('page_end'),'3');assert.ok(init?.body instanceof Blob);return Response.json(pdf);});
 const saved=await client.savePDF({file:new File(['%PDF-'], 'selected.pdf',{type:'application/pdf'}),title:'Calculus',pages:{start:3,end:3}});
 assert.equal(saved.document?.pages[0].page,3);
 assert.deepEqual(saved.document?.selected_pages,{start:3,end:3});
});

test('owned study responses expose saved section progress and reject impossible completion',async()=>{
 const progress={source_id:id,source_version:1,status:'processing',attempts:1,max_attempts:3,next_attempt_at:'2026-10-04T00:00:00Z',error_code:null,note:null,updated_at:'2026-10-04T00:00:00Z',sections_total:3,sections_completed:2};
 const client=clientWith(()=>Response.json(progress));
 const {studyMessage}=await import('./study-note');
 assert.match(studyMessage(await client.generate(id)),/2 of 3 sections/);
 progress.sections_completed=3;
 assert.match(studyMessage(await client.generate(id)),/Combining/);
 progress.sections_completed=4;
 await assert.rejects(client.generate(id),/incomplete/);
});

test('transcript ranges retain supplied cue locations and refresh can explicitly return to the whole source',async()=>{
 const video={...pdf,original_url:'https://www.youtube.com/watch?v=ovrv11testA',canonical_url:'https://www.youtube.com/watch?v=ovrv11testA',source_kind:'video',capture_origin:'pasted',document:null,transcript:{provider:'youtube',format:'srt',filename:null,selected_time:{start_ms:25000,end_ms:40000},segments:[{start:0,end:text.length,start_ms:24000,end_ms:42000}]}};
 const client=clientWith((path,init)=>{
  const url=new URL(path,'https://app.test');
  if(url.pathname.endsWith('/revision-check')){assert.equal(url.searchParams.get('whole_source'),'true');return Response.json({source_id:id,base_version:1,candidate_id:null,changed:false,current:video,replacement:null});}
  assert.equal(url.searchParams.get('start_ms'),'25000');assert.equal(url.searchParams.get('end_ms'),'40000');assert.equal(new Headers(init?.headers).get('X-Video-URL'),video.original_url);return Response.json(video);
 });
 const saved=await client.saveVideo({url:video.original_url,title:'Lecture',text,times:{start_ms:25000,end_ms:40000}});
 assert.equal(saved.transcript?.segments[0].start_ms,24000);
 assert.equal((await client.compareSource(id,{transcriptText:text,times:null})).changed,false);
});
