import test from 'node:test';
import assert from 'node:assert/strict';
import { createSourceClient } from './source-client';
const source = '33333333-3333-4333-8333-333333333333';
const owner = '11111111-1111-4111-8111-111111111111';
test('index progress is authenticated and rejects stale or incomplete readiness', async () => {
  const token = `${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:owner,exp:2000000000})).toString('base64url')}.signature`;
  const storage = new Map<string,string>();
  let value = {source_id:source,source_version:1,status:'processing',chunks_total:4,chunks_completed:2,error_code:null};
  const client = createSourceClient({url:'https://supabase.test',publicKey:'public-test'}, {
    storage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>{storage.set(k,v);},removeItem:k=>{storage.delete(k);}},
    fetch:async(input,init)=>{
      if (String(input).includes('/auth/v1/signup')) return Response.json({access_token:token,refresh_token:'refresh',token_type:'bearer',expires_in:3600,user:{id:owner,is_anonymous:true,app_metadata:{},user_metadata:{}}});
      assert.equal(String(input),`/api/v2/sources/${source}/index-status`);
      assert.equal(new Headers(init?.headers).get('Authorization'),`Bearer ${token}`);
      return Response.json(value);
    },
  });
  assert.equal((await client.indexStatus(source,1)).chunks_completed,2);
  value = {...value, source_version:2};
  await assert.rejects(client.indexStatus(source,1), /changed/);
  value = {...value, source_version:1, status:'ready'};
  await assert.rejects(client.indexStatus(source,1), /incomplete/);
  value = {...value, source_id:owner, chunks_completed:4};
  await assert.rejects(client.indexStatus(source,1), /changed/);
});
