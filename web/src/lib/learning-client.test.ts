import test from 'node:test';
import assert from 'node:assert/strict';
import {createSourceClient} from './source-client';

const owner='11111111-1111-4111-8111-111111111111',source='33333333-3333-4333-8333-333333333333';

test('learning transport restores the session and reads only the selected owned collection',async()=>{
  const token=`${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:owner,exp:2000000000})).toString('base64url')}.signature`;
  const storage=new Map<string,string>();
  const client=createSourceClient({url:'https://supabase.test',publicKey:'public-test'}, {
    storage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>{storage.set(key,value);},removeItem:key=>{storage.delete(key);}},
    fetch:async(input,init)=>{
      if(String(input).includes('/auth/v1/signup'))return Response.json({access_token:token,refresh_token:'refresh',token_type:'bearer',expires_in:3600,user:{id:owner,is_anonymous:true,app_metadata:{},user_metadata:{}}});
      assert.equal(String(input),`/api/v2/sources/${source}/learning`);
      assert.equal(new Headers(init?.headers).get('Authorization'),`Bearer ${token}`);
      return Response.json({source_id:source,selected_plan_id:null,selected_lesson_index:0,plans:[],attempts:[],activities:[]});
    },
  });
  assert.deepEqual(await client.learning(source),{source_id:source,selected_plan_id:null,selected_lesson_index:0,plans:[],attempts:[],activities:[]});
});

test('collection transport scopes candidates and posts explicit source revision requests',async()=>{
 const plan='55555555-5555-4555-8555-555555555555',other='88888888-8888-4888-8888-888888888888';
 const token=`${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:owner,exp:2000000000})).toString('base64url')}.signature`,storage=new Map<string,string>();
 let wrong=false;
 const client=createSourceClient({url:'https://supabase.test',publicKey:'public-test'},{storage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>{storage.set(key,value);},removeItem:key=>{storage.delete(key);}},fetch:async(input,init)=>{
  if(String(input).includes('/auth/v1/signup'))return Response.json({access_token:token,refresh_token:'refresh',token_type:'bearer',expires_in:3600,user:{id:owner,is_anonymous:true,app_metadata:{},user_metadata:{}}});
  assert.equal(new Headers(init?.headers).get('Authorization'),`Bearer ${token}`);
  if(String(input).endsWith('/candidates'))return Response.json({source_id:wrong?other:source,plan_id:plan,candidates:[{source_id:other,source_version:1,title:'More evidence',shared_topics:['Evidence']}]});
  assert.equal(String(input),`/api/v2/sources/${source}/learning/plans/${plan}/revision`);
  assert.deepEqual(JSON.parse(String(init?.body)),{request_id:plan,source_id:other,source_version:1});
  return Response.json({source_id:source,plans:[],attempts:[],activities:[]});
 }});
 assert.equal((await client.learningCandidates(source,plan)).candidates[0].title,'More evidence');
 assert.equal((await client.reviseLearning(source,plan,{request_id:plan,source_id:other,source_version:1})).plans.length,0);
 wrong=true;await assert.rejects(client.learningCandidates(source,plan),/collection changed/);
});
