import test from 'node:test';
import assert from 'node:assert/strict';
import { gatewayStore } from './gateway-store.mjs';
const env = { HOME_GATEWAY_URL:'https://test.account.workers.dev', HOME_GATEWAY_TOKEN:'a'.repeat(64) };
test('gateway client restricts endpoint and keys before requests', async()=>{
  assert.throws(()=>gatewayStore({...env,HOME_GATEWAY_URL:'https://example.com'}));
  const store=gatewayStore(env,()=>{throw Error('must_not_fetch');});
  await assert.rejects(store.get('production/v2/home/manifest.json'));
  await assert.rejects(store.put('staging/v2/home/manifest.json',Buffer.from('{}'),{}));
});
test('gateway client follows bounded inventory pages and sends auth privately',async()=>{
  let calls=0;
  const store=gatewayStore(env,async(url,options)=>{
    assert.equal(options.headers.authorization,`Bearer ${env.HOME_GATEWAY_TOKEN}`);
    assert.equal(options.headers['accept-encoding'],'identity');
    assert.equal(options.redirect,'error');calls++;
    return Response.json(calls===1?{bytes:10,truncated:true,cursor:'next'}:{bytes:20,truncated:false});
  });
  assert.equal(await store.inventoryBytes(),30);assert.equal(calls,2);
  store.close();await assert.rejects(store.inventoryBytes());
});
test('gateway client preserves ETag conditions, missing and conflict',async()=>{
  let method;
  const store=gatewayStore(env,async(url,options)=>{
    method=options.method;
    if(!method)return new Response(null,{status:404});
    assert.equal(options.headers['if-none-match'],'*');return new Response(null,{status:412});
  });
  assert.equal(await store.get('staging/v2/home/manifest.json'),null);
  await assert.rejects(store.put('staging/v2/home/manifest.json',Buffer.from('{}'),{ifNoneMatch:'*'}));
});
test('gateway client rejects repeated cursors and oversized response; redacts transport errors',async()=>{
  await assert.rejects(gatewayStore(env,async()=>Response.json({bytes:1,truncated:true,cursor:'same'})).inventoryBytes());
  await assert.rejects(gatewayStore(env,async()=>new Response('x'.repeat(65537))).get('staging/v2/home/manifest.json'),/gateway_request_failed/);
  await assert.rejects(gatewayStore(env,async()=>{throw Error('sensitive transport');}).inventoryBytes(),e=>e.message==='gateway_request_failed');
});
