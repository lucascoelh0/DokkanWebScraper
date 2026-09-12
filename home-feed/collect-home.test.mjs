import test from 'node:test';
import assert from 'node:assert/strict';
import { collectHome } from './collect-home.mjs';
import { prepareCandidate } from './prepare-candidate.mjs';
import { createHash } from 'node:crypto';

const now=Date.parse('2026-09-12T21:00:00.000Z');
const observation=()=>({snapshot:{observedAt:new Date(now).toISOString(),
  source:'authorized_manual_global_gashas_read',banners:[]},receipts:[],images:new Map(),featuredResponses:[]});
test('disabled by default and nonliteral flags perform no event work',async()=>{
  for(const enableEvents of [undefined,false,'true',1]){
    const source=observation();
    const result=await collectHome({collectSummons:async()=>source,config:{},enableEvents},
      {loadCatalog:()=>assert.fail('events disabled')});
    assert.deepEqual(result,{observation:source});
  }
});
test('summons failure never logs into events',async()=>{
  await assert.rejects(collectHome({collectSummons:async()=>{throw Error('failed')},enableEvents:true},
    {loadCatalog:()=>assert.fail('must not collect')}));
});
test('optional catalog and event failures preserve baseline candidate bytes',async()=>{
  const source=observation(),baseline=await prepareCandidate(source,now);
  for(const deps of [{loadCatalog:async()=>{throw Error('PRIVATE')}},
    {loadCatalog:async()=>({}),collectEventObservation:async()=>{throw Error('PRIVATE')}}]){
    const result=await collectHome({collectSummons:async()=>source,enableEvents:true},deps);
    assert.deepEqual(result.eventCollection,{status:'unavailable'});
    const candidate=await prepareCandidate(result.observation,now,{enableEvents:true,eventCollection:result.eventCollection});
    assert.deepEqual(candidate.operations,baseline.operations);
  }
});
test('sequential collection flows into the optional public section',async()=>{
  const order=[];
  const bytes=Buffer.from(JSON.stringify({schemaVersion:1,contract:'dokkan-stage-delivery',source:'dokkan-game-db',
    entries:[{kind:'z-battle',id:'211'}]}));
  const catalog={catalogBytes:bytes,catalogSha256:createHash('sha256').update(bytes).digest('hex')};
  const {collectEvents}=await import('./collect-events.mjs');
  const config={nonceHeaders:{authorization:'Basic test'},loginHeaders:{authorization:'Basic test'},loginBody:{},apiHeaders:{}};
  const result=await collectHome({collectSummons:async()=>{order.push('summons');return observation()},config,enableEvents:true},{
    loadCatalog:async()=>{order.push('catalog');return catalog},
    collectEventObservation:input=>collectEvents(input,{now:()=>now,fetchImpl:async url=>{
      const path=new URL(url).pathname;order.push(path);
      return new Response(JSON.stringify(path==='/auth/nonce'?{auth_transaction_id:'t'}:
        path==='/auth/sign_in'?{access_token:'PRIVATE',token_type:'bearer'}:
          {events:[],z_battle_stages:[{id:211,start_at:1788411600,end_at:1792483199}]}),
          {headers:{'content-type':'application/json'}});
    }}),
  });
  assert.deepEqual(order,['summons','catalog','/auth/nonce','/auth/sign_in','/events']);
  const candidate=await prepareCandidate(result.observation,now,{enableEvents:true,eventCollection:result.eventCollection});
  const payload=JSON.parse(candidate.operations.find(o=>!o.mutable && o.key.endsWith('.json')).bytes);
  assert.equal(payload.eventSchedule.items[0].target.id,'211');
  assert(!JSON.stringify(payload).includes('PRIVATE'));
});
