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
      return Response.json({source_id:source,plans:[],attempts:[],activities:[]});
    },
  });
  assert.deepEqual(await client.learning(source),{source_id:source,plans:[],attempts:[],activities:[]});
});
