import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { collectSummons } from './collect-summons.mjs';
import { prepareCandidate, sha } from './prepare-candidate.mjs';
import { collectEvents } from './collect-events.mjs';
import { collectNews } from './collect-news.mjs';
const now = Date.parse('2026-09-12T12:00:00Z');

test('expired promotion keeps verified overall banner availability and removes discount claim',async()=>{
 const tick=Date.parse('2026-09-30T12:00:00Z');
 const source={id:12472,information_announcement_id:107229,gasha_category_id:1,open_at:1789273800,end_at:1790713799,
   type:'Gasha::StoneGasha',timer_layout_type:2,name:'Banner',description:'400 hours only! Perform 3 Multi-Summons and get one FREE! New SSR arrives!',
   banner_url:'https://cf.ishin-global.aktsk.com/banners/en/gashasocool/a.png?signature=private'};
 const png=await sharp({create:{width:2,height:2,channels:4,background:'#000000'}}).png().toBuffer();
 const observation=await collectSummons({now:()=>new Date(tick),fetchImage:async()=>png,
   requestApi:async path=>({status:200,body:path==='/gashas'?{gashas:[source]}:{gasha_items:[{card_id:123}]}})});
 const news=await collectNews({config:{nonceHeaders:{authorization:'Basic test'},loginHeaders:{authorization:'Basic test'},loginBody:{account_id:'private'},apiHeaders:{}},includePresentation:true,banners:observation.snapshot.banners},
  {now:()=>tick,fetchImpl:async url=>{
   const path=new URL(url).pathname;
   const value=path==='/auth/nonce'?{auth_transaction_id:'private'}:path==='/auth/sign_in'?{access_token:'private',token_type:'bearer'}:
    path==='/announcements'?{announcements:[{id:107229,category:0,title:'Summons',summary:'',start_at:1789273800,banner:null}]}:
    {announcement:{id:107229,bodies:[{description:'= Event Period =\n- Dokkan Festival x Legendary Summon Carnival{color}\n{duration:1789273800,1792483140,DT,U}\n= Notes ='}]}};
   return Response.json(value);
  }});
 const candidate=await prepareCandidate(observation,tick,{enableNews:true,newsCollection:news});
 const banner=JSON.parse(candidate.operations.at(-2).bytes).summons[0];
 assert.equal(banner.bannerEndsAt,'2026-10-20T07:59:00.000Z');
 assert(Date.parse(banner.endsAt)>tick);assert.equal(banner.discount,undefined);
 assert.equal(banner.description,'New SSR arrives!');
 const unverified=await prepareCandidate(observation,tick);
 assert.equal(JSON.parse(unverified.operations.at(-2).bytes).summons.length,0);
});
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
  assert.equal(payload.summons[0].startsAt, new Date(now - 1000).toISOString());
  assert.deepEqual(payload.summons[0].featuredCardIds, ['123']);
  assert(!JSON.stringify(payload).includes('private'));
  assert.equal(result.summary.summonsCount,1);
  assert.equal(result.summary.eventsStatus,'disabled');
  assert.equal(result.summary.payloadBytes,result.operations.at(-2).bytes.length);
  assert.equal(result.summary.payloadSha256,manifest.sha256);
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
  assert.equal(result.summary.summonsCount,0);
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
  assert.deepEqual(enabled.summary,{
    summonsCount:1,newsStatus:'disabled',newsCount:0,eventsStatus:'included',eventsCount:1,
    eventsValidUntil:payload.eventSchedule.validUntil,
    eventsCatalogSha256:sha(catalogBytes),
    payloadBytes:enabled.operations.at(-2).bytes.length,
    payloadSha256:sha(enabled.operations.at(-2).bytes),
  });
  assert.equal(JSON.stringify(enabled.summary).includes('private'),false);
  eventCollection.projection.candidates=[];
  const empty=await prepareCandidate(o,now,{enableEvents:true,eventCollection});
  assert.equal(empty.summary.eventsStatus,'empty');
  assert.equal(empty.summary.eventsCount,0);
  assert.equal(empty.summary.eventsCatalogSha256,sha(catalogBytes));
});
test('discount uses source deadline independently of clipped feed expiry', async () => {
  const o = await observation();
  const banner = o.snapshot.banners[0];
  banner.end_at = banner.open_at + 400 * 3600 - 1;
  banner.discount = { kind: 'three-plus-one', endsAt: new Date(banner.end_at * 1000).toISOString() };
  const output = JSON.parse((await prepareCandidate(o, now)).operations.at(-2).bytes);
  assert.deepEqual(output.summons[0].discount, banner.discount);
  assert.ok(Date.parse(output.summons[0].endsAt) < Date.parse(output.summons[0].discount.endsAt));
  banner.discount.endsAt = new Date(now).toISOString();
  const invalid = JSON.parse((await prepareCandidate(o, now)).operations.at(-2).bytes);
  assert.equal(invalid.summons[0].discount, undefined);
});

test('operational summary separates unavailability from omitted observations without leaking errors',async()=>{
  const o=await observation(),baseline=await prepareCandidate(o,now);
  for(const [eventCollection,expected] of [
    [undefined,'unavailable'],
    [{status:'unavailable',error:'PRIVATE account token'},'unavailable'],
    [{status:'PRIVATE error'},'unavailable'],
    [{status:'collected',projection:{secret:'PRIVATE'}},'omitted'],
  ]){
    const result=await prepareCandidate(o,now,{enableEvents:true,eventCollection});
    assert.equal(result.summary.eventsStatus,expected);
    assert.equal(result.summary.eventsCount,0);
    assert.equal(result.summary.eventsValidUntil,null);
    assert.equal(result.summary.eventsCatalogSha256,null);
    assert.equal(JSON.stringify(result.summary).includes('PRIVATE'),false);
    assert.equal('published' in result.summary,false);
    assert.deepEqual(result.operations,baseline.operations);
  }
});
