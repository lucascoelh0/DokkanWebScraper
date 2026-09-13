import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { collectCampaigns } from './collect-campaigns.mjs';
import { planCampaignPublication } from './plan-campaign-publication.mjs';
import { preflightCampaignPublication } from './preflight-campaign-publication.mjs';
import { prepareCollectedCampaignCandidate } from './collect-campaigns.mjs';

const at = Date.parse('2026-09-13T02:00:00.000Z');
async function fixture({ empty = false } = {}) {
  const definitionBytes = Buffer.from(JSON.stringify({ schemaVersion: 1, contract: 'dokkan-campaign-definitions',
    source: 'dokkan-game-db', databaseSha256: 'a'.repeat(64), categories: [{ id: 10, name: 'Board' }],
    missions: [{ id: 100, categoryId: 10, type: 'Mission', name: 'Mission', description: null,
      priority: 0, rewards: [{ id: 1, itemId: 1, itemType: 'Card', quantity: 1 }] }] }));
  let calls = 0;
  const collection = await collectCampaigns({ enabled: true, definitionBytes,
    expectedDefinitionSha256: createHash('sha256').update(definitionBytes).digest('hex'),
    expectedDatabaseSha256: 'a'.repeat(64), config: { nonceHeaders: {},
      loginHeaders: { authorization: 'Basic synthetic' }, loginBody: {}, apiHeaders: {} } }, {
    now: () => at,
    fetchImpl: async url => {
      calls++;
      const path = new URL(url).pathname;
      const body = path === '/auth/nonce' ? { auth_transaction_id: 'PRIVATE-NONCE' }
        : path === '/auth/sign_in' ? { token_type: 'bearer', access_token: 'PRIVATE-TOKEN' }
        : { mission_board_campaigns: empty ? [] : [{ id: 1, name: 'Campaign', start_at: at / 1000 - 60,
          end_at: at / 1000 + 3600, end_at_hidden: false, priority: 0, announcement_id: 1,
          campaign_complete_mission_id: 100, mission_boards: [{ id: 1, number: 1, contents_lv: 0,
            mission_category_id: 10, complete_mission_id: 100, display_reward_id: 1 }] }] };
      return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
    },
  });
  assert.equal(collection.status, 'collected');
  return { collection, calls: () => calls };
}

test('local plan orders details before index and mutable manifest last without further I/O', async () => {
  const f = await fixture();
  const plan = planCampaignPublication(f.collection, { now: () => at });
  assert.equal(f.calls(), 3);
  assert.equal(plan.objectCount, 3);
  assert.match(plan.objects[0].key, /^staging\/v2\/campaigns\/details\/[a-f0-9]{64}\.json$/);
  assert.match(plan.objects[1].key, /^staging\/v2\/campaigns\/index\/[a-f0-9]{64}\.json$/);
  assert.equal(plan.objects[2].key, 'staging/v2/campaigns/manifest.json');
  assert.equal(plan.objects[2].mode, 'compare-and-swap-last');
  assert.equal(plan.objects[0].mode, 'create-or-verify-identical');
  assert.equal(plan.candidateBytes, plan.objects.reduce((sum, object) => sum + object.sizeBytes, 0));
  assert.equal(plan.maximumWriteBytes, plan.candidateBytes);
  assert.equal(plan.projectedBucketBytes, null);
  assert.equal(plan.publicationAllowed, false);
  assert.equal(plan.remotePreflightPerformed, false);
  assert(!/PRIVATE|authorization|observationSha256|databaseSha256|definitionSha256/.test(JSON.stringify(plan.objects)));
});

test('plan cannot be forged from historical copies and cannot outlive collection validity', async () => {
  const { collection } = await fixture();
  for (const receipt of [null, {}, { ...collection }, JSON.parse(JSON.stringify(collection))]) {
    assert.throws(() => planCampaignPublication(receipt, { now: () => at }), { message: 'campaign_publication_plan_failed' });
  }
  for (const instant of [at - 1, at + 21600000, NaN]) {
    assert.throws(() => planCampaignPublication(collection, { now: () => instant }), { message: 'campaign_publication_plan_failed' });
  }
});

test('plan is detached from experimental buffers and immutable to callers', async () => {
  const { collection } = await fixture();
  const first = planCampaignPublication(collection, { now: () => at });
  collection.delivery.indexBytes.fill(0);
  collection.delivery.details[0].bytes.fill(0);
  assert.deepEqual(planCampaignPublication(collection, { now: () => at }), first);
  assert.throws(() => { first.publicationAllowed = true; }, TypeError);
  assert.throws(() => { first.objects[0].key = 'production/arbitrary'; }, TypeError);
  assert.throws(() => first.requiredGates.pop(), TypeError);
});

test('empty observation still plans a complete empty index and manifest without invented details', async () => {
  const { collection } = await fixture({ empty: true });
  const plan = planCampaignPublication(collection, { now: () => at });
  assert.equal(plan.campaignCount, 0);
  assert.equal(plan.objectCount, 2);
  assert.match(plan.objects[0].key, /\/index\//);
  assert.equal(plan.objects[1].key, 'staging/v2/campaigns/manifest.json');
});

async function preflightFixture() {
  const { collection } = await fixture();
  const candidate = prepareCollectedCampaignCandidate(collection, { now: () => at });
  const bodies = new Map(candidate.details.map(d => ['staging/v2/campaigns/' + d.objectKey, d.bytes]));
  bodies.set('staging/v2/campaigns/index/' + candidate.indexSha256 + '.json', candidate.indexBytes);
  bodies.set('staging/v2/campaigns/manifest.json', candidate.manifestBytes);
  return { collection, bodies, readObject: async key => ({ bytes: bodies.get(key), version: 'v1' }),
    readBucketBytes: async () => 1000, now: () => at };
}

test('preflight reuses exact objects, rereads the manifest and never grants write authority', async () => {
  const f = await preflightFixture(); const reads = [];
  const result = await preflightCampaignPublication(f.collection, { ...f,
    readObject: async key => { reads.push(key); return f.readObject(key); } });
  assert.equal(result.maximumWriteBytes, 0);
  assert.equal(result.reusedObjects, 3);
  assert.equal(result.projectedBucketBytes, 1000);
  assert.equal(result.publicationAllowed, false);
  assert.equal(reads.filter(k => k.endsWith('/manifest.json')).length, 2);
  assert.throws(() => result.objects.pop(), TypeError);
});

test('preflight budgets absent objects conservatively without deleting old objects', async () => {
  const f = await preflightFixture();
  const result = await preflightCampaignPublication(f.collection, { ...f, readObject: async () => null });
  const total = [...f.bodies.values()].reduce((n, b) => n + b.length, 0);
  assert.equal(result.maximumWriteBytes, total);
  assert.equal(result.projectedBucketBytes, 1000 + total);
  assert.equal(result.objects.at(-1).mode, 'compare-and-swap-last');
});

test('preflight rejects immutable conflicts and sanitizes adapter errors', async () => {
  const f = await preflightFixture();
  for (const readObject of [async () => ({ bytes: Buffer.from('wrong'), version: 'v1' }),
    async () => { throw new Error('PRIVATE TOKEN'); }]) {
    await assert.rejects(preflightCampaignPublication(f.collection, { ...f, readObject }),
      { message: 'campaign_publication_preflight_failed' });
  }
});

test('preflight rejects changed manifest witness even for identical body bytes', async () => {
  const f = await preflightFixture(); let calls = 0;
  await assert.rejects(preflightCampaignPublication(f.collection, { ...f, readObject: async key => {
    const value = await f.readObject(key);
    if (key.endsWith('/manifest.json')) value.version = String(++calls);
    return value;
  } }), { message: 'campaign_publication_preflight_failed' });
});

test('preflight rejects expiry, clock rollback and excessively slow reads', async () => {
  for (const end of [at - 1, at + 60_000, at + 21_600_000, NaN]) {
    const f = await preflightFixture(); let instant = at;
    await assert.rejects(preflightCampaignPublication(f.collection, { ...f,
      now: () => instant, readBucketBytes: async () => { instant = end; return 1000; } }),
    { message: 'campaign_publication_preflight_failed' });
  }
});

test('preflight enforces budget and rejects unknown inventory or malformed body metadata', async () => {
  const f = await preflightFixture();
  for (const overrides of [
    { readBucketBytes: async () => -1 }, { readBucketBytes: async () => null },
    { readBucketBytes: async () => Number.MAX_SAFE_INTEGER },
    { maxBucketBytes: 1001, readObject: async () => null },
    { maxBucketBytes: 10_000_000_001 },
    { readObject: async () => ({ bytes: Buffer.alloc(4097), version: 'v1' }) },
    { readObject: async () => ({ bytes: Buffer.from('{}'), version: 'bad\nversion' }) },
  ]) await assert.rejects(preflightCampaignPublication(f.collection, { ...f, ...overrides }),
    { message: 'campaign_publication_preflight_failed' });
});

test('default preflight budget reserves two GB of the free allowance', async () => {
  const f = await preflightFixture();
  const result = await preflightCampaignPublication(f.collection, f);
  assert.equal(result.maxBucketBytes, 8_000_000_000);
  await assert.rejects(preflightCampaignPublication(f.collection, { ...f,
    readBucketBytes: async () => 8_000_000_000 }), { message: 'campaign_publication_preflight_failed' });
});

test('preflight rejects exact projected budget equality', async () => {
  const f = await preflightFixture();
  const total = [...f.bodies.values()].reduce((n, b) => n + b.length, 0);
  await assert.rejects(preflightCampaignPublication(f.collection, { ...f,
    maxBucketBytes: 1000 + total, readObject: async () => null }),
  { message: 'campaign_publication_preflight_failed' });
});
