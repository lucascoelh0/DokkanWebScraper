import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { collectCampaigns, prepareCollectedCampaignCandidate } from './collect-campaigns.mjs';
import { publishCampaigns } from './publish-campaigns.mjs';

const at = Date.parse('2026-09-13T02:00:00.000Z');
const target = 'staging/v2/campaigns/';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

async function collectionFixture() {
  const definitionBytes = Buffer.from(JSON.stringify({ schemaVersion: 1,
    contract: 'dokkan-campaign-definitions', source: 'dokkan-game-db', databaseSha256: 'a'.repeat(64),
    categories: [{ id: 10, name: 'Board' }], missions: [{ id: 100, categoryId: 10,
      type: 'Mission', name: 'Mission', description: null, priority: 0,
      rewards: [{ id: 1, itemId: 1, itemType: 'Card', quantity: 1 }] }] }));
  const collection = await collectCampaigns({ enabled: true, definitionBytes,
    expectedDefinitionSha256: sha(definitionBytes), expectedDatabaseSha256: 'a'.repeat(64),
    config: { nonceHeaders: {}, loginHeaders: { authorization: 'Basic synthetic' },
      loginBody: {}, apiHeaders: {} } }, { now: () => at, fetchImpl: async url => {
    const path = new URL(url).pathname;
    const body = path === '/auth/nonce' ? { auth_transaction_id: 'PRIVATE-NONCE' }
      : path === '/auth/sign_in' ? { token_type: 'bearer', access_token: 'PRIVATE-TOKEN' }
      : { mission_board_campaigns: [{ id: 1, name: 'Campaign', start_at: at / 1000 - 60,
        end_at: at / 1000 + 3600, end_at_hidden: false, priority: 0, announcement_id: 1,
        campaign_complete_mission_id: 100, mission_boards: [{ id: 1, number: 1,
          contents_lv: 0, mission_category_id: 10, complete_mission_id: 100,
          display_reward_id: 1 }] }] };
    return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
  } });
  assert.equal(collection.status, 'collected');
  return collection;
}

async function harness({ seedCandidate = false, publicOverride, inventoryOverride } = {}) {
  const collection = await collectionFixture();
  const candidate = prepareCollectedCampaignCandidate(collection, { now: () => at });
  const data = new Map(), events = [], writes = [];
  let version = 0;
  const seed = (key, bytes, namedVersion = `v${++version}`) =>
    data.set(key, { bytes: Buffer.from(bytes), version: namedVersion });
  if (seedCandidate) {
    for (const detail of candidate.details) seed(target + detail.objectKey, detail.bytes);
    seed(`${target}index/${candidate.indexSha256}.json`, candidate.indexBytes);
    seed(`${target}manifest.json`, candidate.manifestBytes);
  }
  const readObject = async key => {
    events.push(`read:${key}`);
    const value = data.get(key);
    return value ? { bytes: Buffer.from(value.bytes), version: value.version } : null;
  };
  const readBucketBytes = async () => {
    events.push('inventory');
    if (inventoryOverride) return inventoryOverride({ data, events });
    return 1000 + [...data.values()].reduce((sum, value) => sum + value.bytes.length, 0);
  };
  const putObject = async (key, bytes, options) => {
    events.push(`put:${key}`);
    const existing = data.get(key);
    if (options.ifNoneMatch === '*') assert.equal(existing, undefined);
    else if (options.ifMatch) assert.equal(options.ifMatch, existing?.version);
    else assert.fail('unconditional write');
    assert.equal(options.contentType, 'application/json');
    assert.match(options.cacheControl, /^(?:public, max-age=31536000, immutable|no-cache, no-transform)$/);
    const nextVersion = `v${++version}`;
    data.set(key, { bytes: Buffer.from(bytes), version: nextVersion });
    writes.push({ key, options });
    return nextVersion;
  };
  const publicRead = async (key, size) => {
    events.push(`public:${key}`);
    if (publicOverride) return publicOverride({ key, size, data, events });
    return Buffer.from(data.get(key).bytes);
  };
  const options = { authorizedTarget: target, readObject, readBucketBytes, putObject,
    publicRead, reportPreflight: async report => { events.push('report'); assert.equal(report.target, target); },
    now: () => at };
  return { collection, candidate, data, events, writes, seed, options };
}

test('reports preflight before ordered conditional writes and verifies dependencies before manifest', async () => {
  const h = await harness();
  const result = await publishCampaigns(h.collection, h.options);
  assert.equal(result.status, 'published');
  assert.equal(result.verified, true);
  assert.equal(result.createdObjects, 3);
  assert.equal(result.reusedObjects, 0);
  assert.equal(h.writes.at(-1).key, `${target}manifest.json`);
  assert(h.writes.slice(0, -1).every(write => write.options.ifNoneMatch === '*'));
  assert.equal(h.writes.at(-1).options.ifNoneMatch, '*');
  const firstPut = h.events.findIndex(event => event.startsWith('put:'));
  assert(firstPut > h.events.indexOf('report'));
  const manifestPut = h.events.indexOf(`put:${target}manifest.json`);
  for (const write of h.writes.slice(0, -1)) {
    assert(h.events.indexOf(`read:${write.key}`, h.events.indexOf(`put:${write.key}`) + 1) < manifestPut);
    assert(h.events.indexOf(`public:${write.key}`) < manifestPut);
  }
  assert(h.events.indexOf(`public:${target}manifest.json`) > manifestPut);
});

test('exact existing objects are reused and a second publication is idempotent', async () => {
  const h = await harness({ seedCandidate: true });
  const first = await publishCampaigns(h.collection, h.options);
  const second = await publishCampaigns(h.collection, h.options);
  assert.equal(first.createdObjects, 0);
  assert.equal(first.reusedObjects, 3);
  assert.equal(second.createdObjects, 0);
  assert.equal(second.reusedObjects, 3);
  assert.deepEqual(h.writes, []);
});

test('explicit exact prefix authorization is required before any adapter I/O', async () => {
  const h = await harness();
  for (const authorizedTarget of [undefined, 'staging/v2/home/', `${target}extra`]) {
    await assert.rejects(publishCampaigns(h.collection, { ...h.options, authorizedTarget }),
      { message: 'campaign_publication_failed' });
  }
  assert.deepEqual(h.events, []);
  assert.deepEqual(h.writes, []);
});

test('immutable conflicts reject without a write and errors reveal no adapter detail', async () => {
  const h = await harness();
  const detailKey = target + h.candidate.details[0].objectKey;
  h.seed(detailKey, Buffer.from('PRIVATE conflict'), 'conflict-version');
  await assert.rejects(publishCampaigns(h.collection, h.options), error => {
    assert.equal(error.message, 'campaign_publication_failed');
    assert(!/PRIVATE|conflict-version/.test(error.message));
    return true;
  });
  assert.deepEqual(h.writes, []);
});

test('manifest witness race is never overwritten and publication performs no rollback', async () => {
  const h = await harness();
  h.seed(`${target}manifest.json`, Buffer.from('{"old":true}'), 'old-version');
  h.options.reportPreflight = async () => {
    h.events.push('report');
    h.seed(`${target}manifest.json`, Buffer.from('{"newer":true}'), 'race-version');
  };
  await assert.rejects(publishCampaigns(h.collection, h.options),
    { message: 'campaign_publication_failed' });
  assert.equal(h.data.get(`${target}manifest.json`).bytes.toString(), '{"newer":true}');
  assert.deepEqual(h.writes, []);
});

test('an object approved for reuse may not disappear after the reported preflight', async () => {
  const h = await harness({ seedCandidate: true });
  const detailKey = target + h.candidate.details[0].objectKey;
  h.options.reportPreflight = async () => { h.events.push('report'); h.data.delete(detailKey); };
  await assert.rejects(publishCampaigns(h.collection, h.options),
    { message: 'campaign_publication_failed' });
  assert.deepEqual(h.writes, []);
});

test('expiry, three-minute lifetime exhaustion and reporting failure all stop before writes', async () => {
  for (const afterReport of [at + 180_000, at + 6 * 60 * 60 * 1000]) {
    const h = await harness(); let instant = at;
    h.options.now = () => instant;
    h.options.reportPreflight = async () => { h.events.push('report'); instant = afterReport; };
    await assert.rejects(publishCampaigns(h.collection, h.options),
      { message: 'campaign_publication_failed' });
    assert.deepEqual(h.writes, []);
  }
  const h = await harness();
  h.options.reportPreflight = async () => { throw new Error('PRIVATE reporter failure'); };
  await assert.rejects(publishCampaigns(h.collection, h.options), error => {
    assert.equal(error.message, 'campaign_publication_failed');
    assert(!error.message.includes('PRIVATE'));
    return true;
  });
  assert.deepEqual(h.writes, []);
});

test('dependency public verification failure leaves the manifest unpromoted', async () => {
  const h = await harness({ publicOverride: ({ key, data }) => key.includes('/details/')
    ? Buffer.from('wrong') : Buffer.from(data.get(key).bytes) });
  await assert.rejects(publishCampaigns(h.collection, h.options),
    { message: 'campaign_publication_failed' });
  assert(!h.data.has(`${target}manifest.json`));
  assert(!h.writes.some(write => write.key.endsWith('/manifest.json')));
});

test('final manifest public verification is mandatory without claiming rollback', async () => {
  const h = await harness({ publicOverride: ({ key, data }) => key.endsWith('/manifest.json')
    ? Buffer.from('wrong') : Buffer.from(data.get(key).bytes) });
  await assert.rejects(publishCampaigns(h.collection, h.options),
    { message: 'campaign_publication_failed' });
  assert(h.data.has(`${target}manifest.json`));
  assert.equal(h.writes.at(-1).key, `${target}manifest.json`);
});

test('storage is refreshed after the report before any write', async () => {
  let inventories = 0;
  const h = await harness({ inventoryOverride: () => ++inventories <= 2 ? 1000 : 7999 });
  h.options.maxBucketBytes = 8000;
  await assert.rejects(publishCampaigns(h.collection, h.options),
    { message: 'campaign_publication_failed' });
  assert(inventories >= 3);
  assert.deepEqual(h.writes, []);
});

test('storage is rechecked after dependency writes and before manifest promotion', async () => {
  let inventories = 0;
  const h = await harness({ inventoryOverride: () => ++inventories <= 3 ? 1000 : 7999 });
  h.options.maxBucketBytes = 8000;
  await assert.rejects(publishCampaigns(h.collection, h.options),
    { message: 'campaign_publication_failed' });
  assert(inventories >= 4);
  assert(h.writes.some(write => !write.key.endsWith('/manifest.json')));
  assert(!h.writes.some(write => write.key.endsWith('/manifest.json')));
});

test('copied or forged collector results cannot provide publication authority', async () => {
  const h = await harness();
  for (const collection of [{ ...h.collection }, JSON.parse(JSON.stringify(h.collection)), { status: 'collected' }]) {
    await assert.rejects(publishCampaigns(collection, h.options),
      { message: 'campaign_publication_failed' });
  }
  assert.deepEqual(h.events, []);
  assert.deepEqual(h.writes, []);
});
