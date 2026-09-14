import test from 'node:test';
import assert from 'node:assert/strict';
import { collectNews, prepareCollectedNews, collectedBannerEnd } from './collect-news.mjs';
import sharp from 'sharp';
import { prepareCandidate } from './prepare-candidate.mjs';
const at = Date.parse('2026-09-14T12:00:00Z');

test('periods use fresh matching article once and reject forged or stale collections', async () => {
  const banner = { id: 12472, information_announcement_id: 107229, gasha_category_id: 1, open_at: 1789273800, end_at: 1790713799 };
  const mock = io({ announcements: [{ id: 107229, category: 0, title: 'Summons', summary: '', start_at: 1789273800, banner: null }] });
  let details = 0;
  const result = await collectNews({ config, includePresentation: true, banners: [banner] }, { now: () => at, fetchImpl: async (url, options) => {
    if (new URL(url).pathname === '/announcements/107229') {
      details++;
      return new Response(JSON.stringify({ announcement: { id: 107229, bodies: [{ description: '= Event Period =\n- Dokkan Festival x Legendary Summon Carnival\n- Deathmatch at the Cell Games Packs{color}\n{duration:1789273800,1792483140,DT,U}\n= Notes =' }] } }), { headers: { 'content-type': 'application/json' } });
    }
    return mock.fetchImpl(url, options);
  } });
  assert.equal(result.status, 'collected');
  assert.equal(details, 1);
  assert.equal(collectedBannerEnd(result, banner, at), '2026-10-20T07:59:00.000Z');
  assert.equal(collectedBannerEnd({ ...result }, banner, at), null);
  assert.equal(collectedBannerEnd(result, banner, at + 21600000), null);
  assert.equal(collectedBannerEnd(result, { ...banner, information_announcement_id: 1 }, at), null);
});
const config = { nonceHeaders: { authorization: 'Basic test' }, loginHeaders: { authorization: 'Basic test' },
  loginBody: { account_id: 'PRIVATE' }, apiHeaders: {} };
function io(body = { announcements: [] }) {
  const calls = [];
  return { calls, fetchImpl: async (url, options) => {
    const path = new URL(url).pathname;
    calls.push({ path, method: options.method });
    const data = path === '/auth/nonce' ? { auth_transaction_id: 'PRIVATE' }
      : path === '/auth/sign_in' ? { access_token: 'PRIVATE', token_type: 'bearer' }
      : /^\/announcements\/\d+$/.test(path) ? { announcement: { id: Number(path.split('/').pop()), bodies: [{ description: 'Full article\nSecond line' }] } } : body;
    return new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
  } };
}
test('collects public metadata with one fresh bounded read and no publication permission', async () => {
  const mock = io();
  const result = await collectNews({ config }, { fetchImpl: mock.fetchImpl, now: () => at });
  assert.equal(result.status, 'collected');
  assert.equal(result.publicationAllowed, false);
  assert.deepEqual(mock.calls.map(x => x.path), ['/auth/nonce', '/auth/sign_in', '/announcements']);
  assert.equal(mock.calls[2].method, 'GET');
  assert.match(result.receipt.publicProjectionSha256, /^[a-f0-9]{64}$/);
  assert.ok(!JSON.stringify(result).includes('PRIVATE'));
  assert.equal(prepareCollectedNews(result, at), null);
});

test('six news articles plus separate summon articles fit the bounded session', async () => {
  const rows = Array.from({ length: 8 }, (_, i) => ({ id: i + 1, category: 0, title: 'News', summary: '', start_at: 100, banner: null }));
  const mock = io({ announcements: rows });
  const result = await collectNews({ config, includePresentation: true,
    banners: [1, 2].map(id => ({ id, information_announcement_id: id, gasha_category_id: 1 })) }, { fetchImpl: mock.fetchImpl, now: () => at });
  assert.equal(result.status, 'collected');
  assert.equal(result.projection.announcements.length, 6);
  assert.equal(mock.calls.filter(x => /^\/announcements\/\d+$/.test(x.path)).length, 8);
});
test('invalid time avoids login; malformed body and errors remain unavailable', async () => {
  const mock = io();
  assert.deepEqual(await collectNews({ config }, { fetchImpl: mock.fetchImpl, now: () => NaN }), { status: 'unavailable' });
  assert.equal(mock.calls.length, 0);
  for (const fetchImpl of [io({ secret: 'PRIVATE' }).fetchImpl, async () => { throw Error('PRIVATE'); }]) {
    assert.deepEqual(await collectNews({ config }, { fetchImpl, now: () => at }), { status: 'unavailable' });
  }
});
test('slow response and clock rollback fail closed', async () => {
  for (const delta of [-1, 60000]) {
    let tick = 0;
    assert.deepEqual(await collectNews({ config }, { fetchImpl: io().fetchImpl,
      now: () => at + (tick++ ? delta : 0) }), { status: 'unavailable' });
  }
});

test('media scope downloads only observed art, deduplicates, and preserves public references', async () => {
  const signed = 'https://cf.ishin-global.aktsk.com/banners/en/news/example.png?Signature=PRIVATE';
  const body = { announcements: [1, 2].map(id => ({ id, category: 0, title: 'News', summary: '', start_at: 100, banner: signed })) };
  const mock = io(body);
  const bytes = await sharp({ create: { width: 20, height: 10, channels: 4, background: '#ff8800' } }).png().toBuffer();
  let images = 0;
  const result = await collectNews({ config, includePresentation: true }, { now: () => at, fetchImpl: async (url, options) => {
    if (new URL(url).hostname === 'cf.ishin-global.aktsk.com') {
      images++;
      assert.equal(options.headers.authorization, undefined);
      return new Response(bytes);
    }
    return mock.fetchImpl(url, options);
  } });
  assert.equal(result.status, 'collected');
  assert.equal(images, 1);
  assert.equal(result.artwork.size, 2);
  assert.ok(!JSON.stringify(result).includes('PRIVATE'));
  const prepared = prepareCollectedNews(result, at);
  assert.equal(prepared.section.items[0].paragraphs[0], 'Full article\nSecond line');
  assert.equal(prepared.images.length, 1);
  assert.ok(!JSON.stringify(prepared.section).includes('PRIVATE'));
  result.projection.announcements[0].title = 'MUTATED';
  assert.notEqual(prepareCollectedNews(result, at).section.items[0].title, 'MUTATED');
  assert.equal(prepareCollectedNews({ ...result }, at), null);
  assert.equal(prepareCollectedNews(result, at + 21600000), null);
  const observation = { snapshot: { source: 'authorized_manual_global_gashas_read', observedAt: new Date(at).toISOString(), banners: [] },
    receipts: [], images: new Map(), featuredResponses: [] };
  const candidate = await prepareCandidate(observation, at, { enableNews: true, newsCollection: result });
  const payload = JSON.parse(candidate.operations.find(op => op.key.endsWith('.json') && !op.mutable).bytes);
  assert.equal(payload.news.items.length, 2);
  assert.equal(candidate.operations.filter(op => op.contentType === 'image/png').length, 1);
  assert.ok(!JSON.stringify(payload).includes('MUTATED'));
  const disabled = await prepareCandidate(observation, at, { newsCollection: result });
  assert.equal(disabled.operations.filter(op => op.contentType === 'image/png').length, 0);
  assert.equal(disabled.summary.newsStatus, 'disabled');
});

test('media failure cannot return a partially collected result', async () => {
  const mock = io({ announcements: [{ id: 1, category: 0, title: 'News', summary: '', start_at: 100,
    banner: 'https://cf.ishin-global.aktsk.com/banners/en/news/example.png' }] });
  assert.deepEqual(await collectNews({ config, includePresentation: true }, { now: () => at, fetchImpl: mock.fetchImpl }), { status: 'unavailable' });
});

test('unsupported article markup omits only the body, not verified news metadata', async () => {
  const mock = io({ announcements: [{ id:1, category:0, title:'News', summary:'Summary', start_at:100, banner:null }] });
  const result = await collectNews({config,includePresentation:true},{now:()=>at,fetchImpl:async(url,options)=>{
    if(new URL(url).pathname==='/announcements/1') return new Response(JSON.stringify({announcement:{id:1,bodies:[{description:'<unsupported>Text</unsupported>'}]}}),{headers:{'content-type':'application/json'}});
    return mock.fetchImpl(url,options);
  }});
  assert.equal(result.status,'collected');
  const item=prepareCollectedNews(result,at).section.items[0];
  assert.equal(item.title,'News');
  assert.equal(item.summary,'Summary');
  assert.deepEqual(item.paragraphs,[]);
});

test('total collection deadline actively aborts an in-flight request', async t => {
  const schedule = globalThis.setTimeout;
  let aborted = false;
  t.mock.method(globalThis, 'setTimeout', (callback, milliseconds, ...args) =>
    schedule(callback, milliseconds === 60000 ? 1 : milliseconds, ...args));
  const result = await collectNews({ config }, { now: () => at,
    fetchImpl: async (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => { aborted = true; reject(Error('PRIVATE')); }, { once: true });
    }) });
  assert.equal(aborted, true);
  assert.deepEqual(result, { status: 'unavailable' });
});
