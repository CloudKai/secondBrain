import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

const alice='11111111-1111-4111-8111-111111111111',bob='22222222-2222-4222-8222-222222222222';
const source='33333333-3333-4333-8333-333333333333';
const capture='A source provides evidence for a claim. Similarity by itself does not establish support. Learners can revisit original evidence when checking a conclusion.';
const passage={id:'p0001',start:0,end:capture.length,excerpt:capture,page:null,start_ms:null,end_ms:null};
const claim={text:'Evidence supports a conclusion.',citation_ids:['p0001']};
const content={title:'Check support',outcomes:['Check a conclusion'],prerequisites:[],coverage:'One source supports this explanation.',gaps:[],background:[],lessons:[{title:'Support',outcome:'Explain evidence support',explanation:claim,example:null,check:{kind:'explain',question:'Why check support?',criteria:['Uses evidence'],hint:'Look at the claim.',worked_answer:claim}}]};
const note={overview:claim,concepts:[{title:'Evidence',...claim}],examples:[],equations:[],recall:[{question:'Why evidence?',answer:capture,citation_ids:['p0001']}],references:[passage]};
export async function learner(db:PGlite,owner=alice){await db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${owner}',false)`);}
export async function draftDatabase(){
 const db=new PGlite();
 try{
  await db.exec(await readFile(new URL('../../../../backend/tests/sql/retrieval_bootstrap.sql',import.meta.url),'utf8'));
  await db.query('insert into auth.users values ($1),($2)',[alice,bob]);
  const folder=new URL('../../../../supabase/migrations/',import.meta.url);
  for(const name of (await readdir(folder)).filter(name=>name.endsWith('.sql')).sort())await db.exec(await readFile(new URL(name,folder),'utf8'));
  await db.query("insert into public.sources(id,user_id,original_url,canonical_url,title,captured_text,capture_origin,coverage,coverage_detail) values($1,$2,'https://example.com/evidence','https://example.com/evidence','Evidence',$3,'direct','complete','Captured article')",[source,alice,capture]);
  await db.query("insert into public.source_studies(source_id,user_id,source_version,status,note) values($1,$2,1,'succeeded',$3)",[source,alice,JSON.stringify(note)]);
  await learner(db);
  return db;
 }catch(error){await db.close();throw error;}
}
export async function preview(db:PGlite,difficulty='foundation',pathId:string|null=null){
 const request=crypto.randomUUID();
 const context=(await db.query<{v:{lease_token:string}}>('select public.request_learning_preview($1,1,$2,$3,$4,$5) v',[source,request,'Explain evidence',difficulty,pathId])).rows[0].v;
 await db.exec("reset role;select set_config('request.jwt.claim.sub','',false);set role service_role");
 await db.query('select public.finish_learning_preview($1,$2,$3,$4,$5,$6)',[request,context.lease_token,JSON.stringify({suggested_goal:'Explain evidence',paths:[content]}),'Explain evidence',JSON.stringify([passage]),'gpt-6-luna']);
 await learner(db);
 return (await db.query<{v:{plans:{id:string;path_id:string;request_id:string}[]}}>('select public.get_source_learning($1) v',[source])).rows[0].v.plans.find(plan=>plan.request_id===request)!;
}

export {alice,bob,source};
