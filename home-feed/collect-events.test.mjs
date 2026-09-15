import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { collectEvents, prepareCollectedEventArtwork } from './collect-events.mjs';
import { prepareCandidate } from './prepare-candidate.mjs';
import { createSession } from './auth-session.mjs';
import sharp from 'sharp';

const at = Date.parse('2026-09-12T21:00:00.000Z');
const catalogBytes = Buffer.from(JSON.stringify({ schemaVersion: 1, contract: 'dokkan-stage-delivery',
  source: 'dokkan-game-db', entries: [{ kind: 'z-battle', id: '211' }] }));
const input = () => ({ catalogBytes, catalogSha256: createHash('sha256').update(catalogBytes).digest('hex'),
  config: { nonceHeaders: { authorization: 'Basic test' }, loginHeaders: { authorization: 'Basic test' },
    loginBody: { account_id: 'PRIVATE' }, apiHeaders: {} } });
function io(body = { events: [], z_battle_stages: [{ id: 211, start_at: 1788411600, end_at: 1792483199 }] }) {
  const calls = [];
  return { calls, fetchImpl: async (url, options) => {
    const path = new URL(url).pathname;
    calls.push({ path, options });
    const data = path === '/auth/nonce' ? { auth_transaction_id: 'transaction' }
      : path === '/auth/sign_in' ? { access_token: 'PRIVATE', token_type: 'bearer' } : body;
    return new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } });
  } };
}
test('one fresh session binds normalized response and capture times to projection', async () => {
  const mock = io(); let tick = 0;
  const value = await collectEvents(input(), { fetchImpl: mock.fetchImpl, now: () => at + tick++ * 1000 });
  assert.equal(value.status, 'collected');
  assert.deepEqual(mock.calls.map(c => c.path), ['/auth/nonce', '/auth/sign_in', '/events']);
  assert.equal(mock.calls[2].options.headers.authorization, 'Bearer PRIVATE');
  assert.equal(value.projection.observedAt, '2026-09-12T21:00:00.000Z');
  assert.equal(value.receipt.receivedAt, '2026-09-12T21:00:01.000Z');
  assert.equal(value.receipt.normalizedBodySha256, value.projection.observationSha256);
  assert.equal(value.projection.candidates.length, 1);
  assert.equal(value.projection.publicationAllowed, false);
  assert.equal(JSON.stringify(value).includes('PRIVATE'), false);
});
test('invalid catalog is rejected before authentication', async () => {
  const mock = io();
  assert.deepEqual(await collectEvents({ ...input(), catalogSha256: '0'.repeat(64) }, { fetchImpl: mock.fetchImpl, now: () => at }), { status: 'unavailable' });
  assert.equal(mock.calls.length, 0);
});
test('private errors and malformed observations become optional unavailability', async () => {
  for (const fetchImpl of [async () => { throw Error('PRIVATE'); }, io({ token: 'PRIVATE' }).fetchImpl]) {
    assert.deepEqual(await collectEvents(input(), { fetchImpl, now: () => at }), { status: 'unavailable' });
  }
});
test('clock rollback or excessively slow capture fails without retry', async () => {
  for (const delta of [-1, 60000]) {
    const mock = io(); let tick = 0;
    assert.deepEqual(await collectEvents(input(), { fetchImpl: mock.fetchImpl, now: () => at + (tick++ ? delta : 0) }), { status: 'unavailable' });
    assert.equal(mock.calls.length, 3);
  }
});

const imageUrl = 'https://cf.ishin-global.aktsk.com/banners/en/event/eve_banner/zbattle_list_banner_211.png?Signature=PRIVATE';
async function mediaIo({ broken = false, url = imageUrl, header } = {}) {
  const base = io({ events: [], z_battle_stages: [{ id: 211, start_at: 1788411600, end_at: 1792483199, banner_image: url, event_image: header }] });
  const png = await sharp({ create: { width: 500, height: 110, channels: 4, background: '#123456' } }).png().toBuffer();
  return { calls: base.calls, fetchImpl: async (url, options) => {
    if (new URL(url).hostname !== 'cf.ishin-global.aktsk.com') return base.fetchImpl(url, options);
    base.calls.push({ path: new URL(url).pathname, options });
    return new Response(broken ? 'invalid PNG' : png, { status: 200 });
  } };
}

test('verified illustrated header is published separately from legacy list artwork', async () => {
  const mock = await mediaIo({ header: imageUrl.replace('/eve_banner/', '/eve_header/') });
  const value = await collectEvents({ ...input(), includePresentation: true }, { fetchImpl: mock.fetchImpl, now: () => at });
  const art = prepareCollectedEventArtwork(value, at);
  assert.equal(art[0].header, true);
  assert.match(mock.calls[3].path, /\/eve_header\//);
  const observation = { snapshot: { observedAt: new Date(at).toISOString(), source: 'authorized_manual_global_gashas_read', banners: [] }, receipts: [], images: new Map(), featuredResponses: [] };
  const candidate = await prepareCandidate(observation, at, { enableEvents: true, eventCollection: value });
  const payload = JSON.parse(candidate.operations.at(-2).bytes);
  assert.equal(payload.eventSchedule.items[0].headerImageUrl, 'https://assets.dkbcompanion.com/' + art[0].key);
  assert.equal(payload.eventSchedule.items[0].imageUrl, undefined);
});

test('event art is opt-in, private, immutable and delivered only with its trusted schedule', async () => {
  const mock = await mediaIo();
  const value = await collectEvents({ ...input(), includePresentation: true }, { fetchImpl: mock.fetchImpl, now: () => at });
  assert.equal(value.status, 'collected');
  const art = prepareCollectedEventArtwork(value, at);
  assert.equal(art.length, 1);
  assert.equal(art[0].id, 'z-battle:211');
  assert.equal(mock.calls.length, 4);
  assert.deepEqual(mock.calls[3].options.headers, { accept: 'image/png', 'accept-encoding': 'identity' });
  assert(!JSON.stringify(value).includes('PRIVATE'));
  assert.equal(prepareCollectedEventArtwork(structuredClone(value), at), null);
  const original = Buffer.from(art[0].bytes);
  art[0].bytes.fill(0);
  assert.deepEqual(prepareCollectedEventArtwork(value, at)[0].bytes, original);
  const observation = { snapshot: { observedAt: new Date(at).toISOString(), source: 'authorized_manual_global_gashas_read', banners: [] }, receipts: [], images: new Map(), featuredResponses: [] };
  const candidate = await prepareCandidate(observation, at, { enableEvents: true, eventCollection: value });
  const payload = JSON.parse(candidate.operations.at(-2).bytes);
  assert.equal(payload.eventSchedule.items[0].imageUrl, 'https://assets.dkbcompanion.com/' + art[0].key);
  assert.deepEqual(candidate.operations[0].bytes, original);
  assert(!JSON.stringify(payload).includes('PRIVATE'));
  value.projection.candidates[0].target.id = '212';
  assert.equal(prepareCollectedEventArtwork(value, at), null);
});

test('missing or failed optional art preserves usable event schedule', async () => {
  for (const options of [{ broken: true }, { url: 'https://evil.invalid/a.png?x=1' }]) {
    const mock = await mediaIo(options);
    const value = await collectEvents({ ...input(), includePresentation: true }, { fetchImpl: mock.fetchImpl, now: () => at });
    assert.equal(value.status, 'collected');
    assert.equal(value.projection.candidates.length, 1);
    assert.deepEqual(prepareCollectedEventArtwork(value, at), []);
  }
  const mock = await mediaIo();
  const value = await collectEvents(input(), { fetchImpl: mock.fetchImpl, now: () => at });
  assert.equal(mock.calls.length, 3);
  assert.equal(prepareCollectedEventArtwork(value, at), null);
});

test('events-media cannot fetch unobserved artwork or unrelated API endpoints', async () => {
  for (const action of [session => session.fetchImage(imageUrl.replace('_211.png', '_212.png')),
    session => session.requestApi('/gashas')]) {
    const mock = await mediaIo();
    const session = createSession(input().config, { fetchImpl: mock.fetchImpl, apiScope: 'events-media' });
    await session.requestApi('/events');
    await assert.rejects(action(session), /auth_session_failed/);
    assert.equal(mock.calls.length, 3);
    session.close();
  }
});

test('Burst resource read is exact, once-only, after events, with no unrelated resource access', async () => {
  const path='/resources/login?genkai_battles=true';
  const mock=io();const session=createSession(input().config,{fetchImpl:mock.fetchImpl,apiScope:'events-media'});
  await session.requestApi('/events');await session.requestApi(path);
  await assert.rejects(session.requestApi(path),/auth_session_failed/);
  assert.equal(mock.calls.length,4);
  for(const scope of ['events','summons','events-media']) {
    const m=io();const s=createSession(input().config,{fetchImpl:m.fetchImpl,apiScope:scope});
    await assert.rejects(s.requestApi(path),/auth_session_failed/);
    assert.equal(m.calls.length,0);
  }
  const m=io();const s=createSession(input().config,{fetchImpl:m.fetchImpl,apiScope:'events-media'});
  await s.requestApi('/events');
  await assert.rejects(s.requestApi(path+'&gifts=true'),/auth_session_failed/);
  assert.equal(m.calls.length,3);
});

test('optional Burst request failure keeps the previously collected base schedule without retry', async () => {
  const mock=io();let failed=0;
  const value=await collectEvents({...input(),includeBurst:true},{now:()=>at,fetchImpl:async(url,options)=>{
    if(new URL(url).pathname==='/resources/login'){failed++;return new Response('PRIVATE',{status:503});}
    return mock.fetchImpl(url,options);
  }});
  assert.equal(value.status,'collected');assert.equal(value.projection.candidates.length,1);
  assert.equal(failed,1);assert.equal(value.projection.burstObservationSha256,undefined);
  assert(!JSON.stringify(value).includes('PRIVATE'));
});

test('optional event art cannot exceed the publisher 42-object ceiling', async () => {
  const mock = await mediaIo();
  const value = await collectEvents({ ...input(), includePresentation: true }, { fetchImpl: mock.fetchImpl, now: () => at });
  const observedAt = new Date(at).toISOString();
  const observation = { snapshot: { observedAt, source: 'authorized_manual_global_gashas_read', banners: [] }, receipts: [], images: new Map(), featuredResponses: [] };
  for (let id = 1; id <= 40; id++) {
    const png = await sharp({ create: { width: 1, height: 1, channels: 4, background: { r:id, g:0, b:0, alpha:1 } } }).png().toBuffer();
    const hash = createHash('sha256').update(png).digest('hex');
    const imagePath = `/banners/en/gashasocool/a${id}.png`;
    observation.snapshot.banners.push({ id, name:'Synthetic', open_at:at/1000-1, end_at:at/1000+3600, imageHost:'cf.ishin-global.aktsk.com', imagePath });
    observation.receipts.push({ bannerId:id, sourcePath:imagePath, sha256:hash, sizeBytes:png.length, width:1, height:1 });
    observation.images.set(hash+'.png', png);
    observation.featuredResponses.push({ path:`/gashas/${id}/featured_cards`, status:200, error:null, observedAt, publicIds:{ gasha_items:[] } });
  }
  const candidate = await prepareCandidate(observation, at, { enableEvents:true, eventCollection:value });
  assert.equal(candidate.operations.length, 42);
  assert.equal(JSON.parse(candidate.operations.at(-2).bytes).eventSchedule.items[0].imageUrl, undefined);
});
