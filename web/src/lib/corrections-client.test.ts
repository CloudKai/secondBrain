import test from 'node:test';
import assert from 'node:assert/strict';
import {createSourceClient} from './source-client';
const owner='11111111-1111-4111-8111-111111111111',topic='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
test('saved topic correction is an authenticated mutation and reports failed storage',async()=>{
 const token=`${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:owner,exp:2000000000})).toString('base64url')}.signature`;
 const storage=new Map<string,string>();let fail=false;
 const client=createSourceClient({url:'https://supabase.test',publicKey:'public-test'},{storage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>{storage.set(k,v);},removeItem:k=>{storage.delete(k);}},fetch:async(input,init)=>{
 if(String(input).includes('/auth/v1/signup'))return Response.json({access_token:token,refresh_token:'refresh',token_type:'bearer',expires_in:3600,user:{id:owner,is_anonymous:true,app_metadata:{},user_metadata:{}}});
 assert.equal(String(input),'/api/v2/topic-corrections');assert.equal(new Headers(init?.headers).get('Authorization'),`Bearer ${token}`);assert.equal(init?.method,'POST');assert.deepEqual(JSON.parse(String(init?.body)),{action:'rename',topic_id:topic,title:'Grounded generation'});return new Response(null,{status:fail?503:204});
 }});
 await client.correctTopics({action:'rename',topic_id:topic,title:'Grounded generation'});
 fail=true;await assert.rejects(client.correctTopics({action:'rename',topic_id:topic,title:'Grounded generation'}),/corrections.*saved/i);
});
