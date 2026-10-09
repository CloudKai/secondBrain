import test from 'node:test';
import assert from 'node:assert/strict';
import {createSourceClient} from './source-client';
import {plan} from './fixtures/collection-plan';
const collectionId='77777777-7777-4777-8777-777777777777',sourceId='33333333-3333-4333-8333-333333333333';
const collection={id:collectionId,legacy_source_id:sourceId,title:'Calculus collection',goal:'Interpret instantaneous change',revision:1,source_count:0,path_count:0,original_source_available:false,created_at:'2026-10-09T00:00:00Z',updated_at:'2026-10-09T00:00:00Z'};
const detail={collection,sources:[],learning:{source_id:sourceId,selected_plan_id:null,selected_lesson_index:0,selected_place_revision:0,plans:[],attempts:[],activities:[]}};
function clientFor(reply:(input:RequestInfo|URL,init?:RequestInit)=>unknown){
 const values=new Map<string,string>();const user='11111111-1111-4111-8111-111111111111';
 const token=`${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:user,exp:2000000000})).toString('base64url')}.signature`;
 return createSourceClient({url:'https://workspace.supabase.co',publicKey:'test-public-key'},{storage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>{values.set(k,v);},removeItem:k=>{values.delete(k);}},fetch:async(input,init)=>{
  if(String(input).includes('/auth/v1/signup'))return Response.json({access_token:token,refresh_token:'refresh',token_type:'bearer',expires_in:3600,user:{id:user,is_anonymous:true,app_metadata:{},user_metadata:{}}});
  assert.equal(new Headers(init?.headers).get('Authorization'),`Bearer ${token}`);
  const value=reply(input,init);return value instanceof Response?value:Response.json(value);
 }});
}
test('collection browser reads preserve legacy identity and reject another collection response',async()=>{
 let value:unknown=detail;const client=clientFor(()=>value);
 assert.deepEqual(await client.collection(collectionId),detail);
 value={...detail,collection:{...collection,id:'88888888-8888-4888-8888-888888888888'}};
 await assert.rejects(client.collection(collectionId),/collection/i);
 value={...detail,learning:{...detail.learning,source_id:'88888888-8888-4888-8888-888888888888'}};
 await assert.rejects(client.collection(collectionId));
});

test('collection library keeps removed anchors accessible through independent collection links',async()=>{
 const {createElement}=await import('react');const {renderToStaticMarkup}=await import('react-dom/server');
 const {CollectionLibraryView}=await import('../components/CollectionLibrary');
 const html=renderToStaticMarkup(createElement(CollectionLibraryView,{data:{collections:[collection],next_offset:null},onMore:()=>{},busy:false}));
 assert.match(html,new RegExp(`#collection/${collectionId}`));assert.match(html,/Calculus collection/);assert.match(html,/Interpret instantaneous change/);assert.match(html,/Original source removed/);
 assert.doesNotMatch(html,/#note\/|Mastered/);
});

test('collection overview separates saved membership from plan teaching evidence and labels retained history',async()=>{
 const {createElement}=await import('react');const {renderToStaticMarkup}=await import('react-dom/server');
 const {CollectionOverview}=await import('../components/CollectionWorkspace');
 const html=renderToStaticMarkup(createElement(CollectionOverview,{data:detail,onDiscover:()=>{}}));
 assert.match(html,/Interpret instantaneous change/);assert.match(html,/0 saved sources/);assert.match(html,/Sources in a plan/);assert.match(html,/Original source removed/);assert.match(html,/Topic graph/);
 assert.doesNotMatch(html,/Mastered|Complete topic coverage/);
});

test('collection alias and list reads validate ownership identity and pagination before navigation',async()=>{
 let value:unknown=detail;const client=clientFor(()=>value);
 assert.equal((await client.sourceCollection(sourceId))?.collection.id,collectionId);
 value={...detail,collection:{...collection,legacy_source_id:'88888888-8888-4888-8888-888888888888'}};
 await assert.rejects(client.sourceCollection(sourceId));
 value={collections:[collection],next_offset:null};assert.equal((await client.collections()).collections[0].id,collectionId);
 value={collections:[collection],next_offset:1};await assert.rejects(client.collections(),/pagination/i);
});


test('collection aliases distinguish an unstarted path from authentication and server failures',async()=>{
 let status=404;const client=clientFor(()=>Response.json({detail:'Unavailable'},{status}));
 assert.equal(await client.sourceCollection(sourceId),null);
 status=401;await assert.rejects(client.sourceCollection(sourceId));
 status=503;await assert.rejects(client.sourceCollection(sourceId));
});

test('checked collection selection keeps revision fencing and rejects stale or unrelated places',async()=>{
 const selected={...detail,collection:{...collection,path_count:1},learning:{...detail.learning,plans:[plan],selected_plan_id:plan.id,selected_place_revision:6}};
 let value:unknown=selected;const client=clientFor((input,init)=>{
  assert.match(String(input),new RegExp(`/learning/collections/${collectionId}/plans/${plan.id}/place$`));
  assert.equal(init?.method,'POST');assert.deepEqual(JSON.parse(String(init?.body)),{lesson_index:0,expected_revision:5});return value;
 });
 assert.equal((await client.selectCollectionLesson(collectionId,plan.id,0,5)).selected_place_revision,6);
 value={...selected,learning:{...selected.learning,selected_place_revision:5}};
 await assert.rejects(client.selectCollectionLesson(collectionId,plan.id,0,5),/place changed/i);
 value={...selected,collection:{...selected.collection,id:sourceId}};
 await assert.rejects(client.selectCollectionLesson(collectionId,plan.id,0,5),/place changed/i);
});

test('removed captures retain distinct path history and learner answers without citation controls',async()=>{
 const {createElement}=await import('react');const {renderToStaticMarkup}=await import('react-dom/server');
 const {RetainedCollectionHistory}=await import('../components/CollectionWorkspace');
 const old={...plan,source_id:null,needs_review:true,references:[],active:false};
 const newer={...old,id:'88888888-8888-4888-8888-888888888888',active:true,created_at:'2026-10-09T01:00:00Z',confirmed_at:'2026-10-09T01:00:00Z'};
 const data={...detail,collection:{...collection,path_count:1},learning:{...detail.learning,plans:[old,newer],attempts:[{id:'99999999-9999-4999-8999-999999999999',plan_id:old.id,lesson_index:0,response:'My earlier reasoning remains saved.',difficulty:plan.difficulty,status:'pending' as const,feedback:null,created_at:plan.created_at}]}};
 const html=renderToStaticMarkup(createElement(RetainedCollectionHistory,{data}));
 assert.match(html,/My earlier reasoning remains saved/);assert.match(html,/Previous.*Version 1/);assert.match(html,/Current.*Version 2/);
 assert.doesNotMatch(html,/Inspect source passage|Relevant passages still/);
});
