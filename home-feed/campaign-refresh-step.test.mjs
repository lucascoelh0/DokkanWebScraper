import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createCampaignRefreshStep } from './campaign-refresh-step.mjs';
import { refreshCycle } from './refresh-cycle.mjs';

const at = Date.parse('2026-09-13T18:00:00.000Z');
function harness() {
  const definitionBytes = Buffer.from(JSON.stringify({ schemaVersion: 1,
    contract: 'dokkan-campaign-definitions', source: 'dokkan-game-db', databaseSha256: 'a'.repeat(64),
    categories: [{ id: 10, name: 'Board' }], missions: [{ id: 100, categoryId: 10,
      type: 'Mission', name: 'Synthetic task', description: null, priority: 0,
      rewards: [{ id: 1, itemId: 1, itemType: 'Card', quantity: 1 }] }] }));
  const calls = [], objects = new Map(); let owned = true;
  const lease = { assertOwned: async () => { if (!owned) throw Error('PRIVATE lease'); } };
  const input = { enabled: true, authorizedTarget: 'staging/v2/campaigns/', definitionBytes,
    expectedDefinitionSha256: createHash('sha256').update(definitionBytes).digest('hex'),
    expectedDatabaseSha256: 'a'.repeat(64),
    config: { nonceHeaders: {}, loginHeaders: { authorization: 'Basic test' }, loginBody: {}, apiHeaders: {} },
    readObject: async key => objects.get(key) ?? null,
    readBucketBytes: async () => [...objects.values()].reduce((n, o) => n + o.bytes.length, 0),
    putObject: async (key, bytes, options) => {
      assert.equal(options.ifNoneMatch, '*'); assert(!objects.has(key));
      calls.push(key); objects.set(key, { bytes, version: 'v1' }); return 'v1';
    },
    publicRead: async key => objects.get(key).bytes,
    reportPreflight: async () => { calls.push('preflight'); },
  };
  const dependencies = { now: () => at, fetchImpl: async url => {
    const path = new URL(url).pathname; calls.push(path);
    const body = path === '/auth/nonce' ? { auth_transaction_id: 'PRIVATE-NONCE' }
      : path === '/auth/sign_in' ? { token_type: 'bearer', access_token: 'PRIVATE-TOKEN' }
      : { mission_board_campaigns: [{ id: 1, name: 'Synthetic campaign', start_at: at / 1000 - 60,
        end_at: at / 1000 + 3600, end_at_hidden: false, priority: 0, announcement_id: 1,
        campaign_complete_mission_id: 100, mission_boards: [{ id: 1, number: 1, contents_lv: 0,
          mission_category_id: 10, complete_mission_id: 100, display_reward_id: 1 }] }] };
    return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
  } };
  return { calls, objects, lease, input, dependencies, loseLease: () => { owned = false; } };
}

test('disabled step never touches lease, network or storage', async () => {
  for (const enabled of [undefined, false, 'true', 1]) {
    const h = harness();
    assert.deepEqual(await createCampaignRefreshStep({ ...h.input, enabled }, h.dependencies)(), { status: 'disabled' });
    assert.deepEqual(h.calls, []);
  }
});

test('genuine collection publishes under supplied slot once, with safe receipt', async () => {
  const h = harness(), step = createCampaignRefreshStep(h.input, h.dependencies);
  const result = await step({ lease: h.lease });
  assert.equal(result.status, 'published'); assert.match(result.manifestSha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(h.calls.slice(0, 4), ['/auth/nonce', '/auth/sign_in', '/missions/mission_board_campaigns', 'preflight']);
  assert.equal(h.calls.at(-1), 'staging/v2/campaigns/manifest.json');
  const count = h.calls.length;
  assert.deepEqual(await step({ lease: h.lease }), { status: 'already_attempted' });
  assert.equal(h.calls.length, count);
  assert(!JSON.stringify(result).includes('PRIVATE'));
});

test('missing authorization, adapters or ownership stops before login', async () => {
  for (const change of [{ authorizedTarget: undefined }, { authorizedTarget: 'v2/campaigns/' }, { putObject: undefined }]) {
    const h = harness();
    assert.equal((await createCampaignRefreshStep({ ...h.input, ...change }, h.dependencies)({ lease: h.lease })).status, 'failed');
    assert.deepEqual(h.calls, []);
  }
  const h = harness(); h.loseLease();
  assert.equal((await createCampaignRefreshStep(h.input, h.dependencies)({ lease: h.lease })).phase, 'ownership');
  assert.deepEqual(h.calls, []);
});

test('bad definition pin stops before login and cannot retry the same slot', async () => {
  const h = harness(), step = createCampaignRefreshStep({ ...h.input, expectedDefinitionSha256: 'b'.repeat(64) }, h.dependencies);
  assert.deepEqual(await step({ lease: h.lease }), { status: 'failed', phase: 'collection' });
  assert.deepEqual(await step({ lease: h.lease }), { status: 'already_attempted' });
  assert.deepEqual(h.calls, []);
});

test('API failure sanitized and no automatic retry or publication', async () => {
  const h = harness();
  h.dependencies.fetchImpl = async () => { h.calls.push('fetch'); throw Error('PRIVATE'); };
  const step = createCampaignRefreshStep(h.input, h.dependencies);
  assert.deepEqual(await step({ lease: h.lease }), { status: 'failed', phase: 'collection' });
  assert.deepEqual(h.calls, ['fetch']);
  assert.equal(h.objects.size, 0);
});

test('lease lost during preflight prevents all writes', async () => {
  const h = harness(); h.input.reportPreflight = async () => h.loseLease();
  assert.deepEqual(await createCampaignRefreshStep(h.input, h.dependencies)({ lease: h.lease }), { status: 'failed', phase: 'publication' });
  assert.equal(h.objects.size, 0);
});

test('lease lost after immutable write stops before manifest, without rollback claims', async () => {
  const h = harness(), put = h.input.putObject;
  h.input.putObject = async (...args) => { const result = await put(...args); h.loseLease(); return result; };
  const result = await createCampaignRefreshStep(h.input, h.dependencies)({ lease: h.lease });
  assert.deepEqual(result, { status: 'failed', phase: 'publication' });
  assert.equal(h.objects.size, 1);
  assert(!h.objects.has('staging/v2/campaigns/manifest.json'));
});

test('composed Home cycle records both verified publications in the same slot', async () => {
  const h = harness(), records = [];
  Object.assign(h.lease, { readState: async () => ({}),
    writeState: async value => { await h.lease.assertOwned(); records.push(value); },
    recordFailure: async value => records.push(value), release: async () => {} });
  const result = await refreshCycle({ now: () => at, acquireLease: async () => h.lease,
    collect: async () => ({}), prepare: async () => ({ validUntil: at + 100000 }),
    plan: async () => ({ target: 'staging/v2/home/', conflicts: 0, writeBytes: 0, newBytes: 0, bucketBytes: 0 }),
    publish: async () => { h.calls.push('home-published'); return { verified: true, manifestSha256: 'c'.repeat(64) }; },
    refreshCampaigns: createCampaignRefreshStep(h.input, h.dependencies) });
  assert.equal(result.status, 'success'); assert.equal(result.campaigns.status, 'published');
  assert.equal(h.calls[0], 'home-published');
  assert.equal(records.at(-1).manifestSha256, 'c'.repeat(64));
  assert.deepEqual(records.at(-1).campaigns, result.campaigns);
});
