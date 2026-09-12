import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { collectSummons } from './collect-summons.mjs';
import { prepareCandidate, sha } from './prepare-candidate.mjs';
import { collectEvents } from './collect-events.mjs';
const now = Date.parse('2026-09-12T12:00:00Z');
async function observation(category = 1) {
  const png = await sharp({ create: { width: 2, height: 2, channels: 4, background: '#000000' } }).png().toBuffer();
  return collectSummons({ now: () => new Date(now), fetchImage: async () => png,
    requestApi: async path => ({status: 200, body: path === '/gashas' ? {gashas: [{id: 12,
      name: 'Banner', open_at: now / 1000 - 1, end_at: now / 1000 + 100,
      gasha_category_id: category, banner_url: 'https://cf.ishin-global.aktsk.com/banners/en/gashasocool/a.png?signature=private'}]}
      : { gasha_items: [{card_id: 123}] } }) });
}
test('full decode then canonical public payload, manifest last', async () => {
  const result = await prepareCandidate(await observation(), now);
  assert.equal(result.operations.length, 3);
  const manifest = JSON.parse(result.operations.at(-1).bytes);
  assert.equal(manifest.sha256, sha(result.operations.at(-2).bytes));
  const payload = JSON.parse(result.operations.at(-2).bytes);
  assert.equal(payload.summons[0].group, 'main');
  assert.deepEqual(payload.summons[0].featuredCardIds, ['123']);
  assert(!JSON.stringify(payload).includes('private'));
});
test('unknown categories never get featured placement', async () => {
  const result = await prepareCandidate(await observation(99), now);
  const payload = JSON.parse(result.operations.at(-2).bytes);
  assert.equal(payload.spotlight, null); assert.equal(payload.summons[0].category, 'other');
});
test('empty current observation clears expired list without extending old content', async () => {
  const o = await observation(); o.snapshot.banners = []; o.receipts = []; o.featuredResponses = [];
  const result = await prepareCandidate(o, now);
  assert.deepEqual(JSON.parse(result.operations.at(-2).bytes).summons, []);
});
test('corrupt PNG fails full decode even with matching hash and headers', async () => {
  const o = await observation(), r = o.receipts[0];
  const bytes = o.images.values().next().value.subarray(0, 33);
  r.sha256 = sha(bytes); r.sizeBytes = bytes.length; o.images = new Map([[r.sha256 + '.png', bytes]]);
  await assert.rejects(prepareCandidate(o, now));
});
test('stale observations and duplicate featured rows fail closed', async () => {
  await assert.rejects(prepareCandidate(await observation(), now + 86400000));
  const o = await observation(); o.featuredResponses[0].publicIds.gasha_items.push({card_id:123});
  await assert.rejects(prepareCandidate(o, now));
});

test('missing or invalid optional events preserve summons bytes', async () => {
  const o = await observation();
  const original = await prepareCandidate(o, now);
  for (const options of [{enableEvents: true,eventCollection:{status:'unavailable'}},
    {enableEvents:true,eventCollection:{status:'collected',projection:{secret:'private'}}},
    {eventCollection:{status:'collected'}}]) {
    const result = await prepareCandidate(o,now,options);
    assert.deepEqual(result.operations.at(-2).bytes,original.operations.at(-2).bytes);
  }
});

test('fresh collector output reaches hashed payload only under explicit opt-in', async () => {
  const catalogBytes = Buffer.from(JSON.stringify({schemaVersion:1,contract:'dokkan-stage-delivery',source:'dokkan-game-db',entries:[{kind:'z-battle',id:'211'}]}));
  const eventCollection = await collectEvents({catalogBytes,catalogSha256:sha(catalogBytes),config:{
    nonceHeaders:{authorization:'Basic test'},loginHeaders:{authorization:'Basic test'},loginBody:{account_id:'private'},apiHeaders:{}}},
  {now:()=>now,fetchImpl:async url=>new Response(JSON.stringify(new URL(url).pathname==='/auth/nonce'
    ? {auth_transaction_id:'transaction'} : new URL(url).pathname==='/auth/sign_in'
      ? {access_token:'private',token_type:'bearer'}
      : {events:[],z_battle_stages:[{id:211,start_at:now/1000-60,end_at:now/1000+600}]}),
    {status:200,headers:{'content-type':'application/json'}})});
  assert.equal(eventCollection.status,'collected');
  const o = await observation();
  const enabled = await prepareCandidate(o,now,{enableEvents:true,eventCollection});
  const payload = JSON.parse(enabled.operations.at(-2).bytes);
  assert.equal(payload.schemaVersion,1);
  assert.equal(payload.eventSchedule.items[0].target.id,'211');
  assert.equal(JSON.parse(enabled.operations.at(-1).bytes).sha256,sha(enabled.operations.at(-2).bytes));
  const disabled = await prepareCandidate(o,now,{eventCollection});
  assert.equal('eventSchedule' in JSON.parse(disabled.operations.at(-2).bytes),false);
  assert.equal(JSON.stringify(payload).includes('private'),false);
});
