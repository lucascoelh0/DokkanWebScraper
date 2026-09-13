import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { prepareCampaignDelivery, CAMPAIGN_DELIVERY_LIMITS } from './prepare-campaign-delivery.mjs';
import { prepareCampaignPreview } from './prepare-campaign-preview.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const observedAt = '2026-09-12T12:00:00.000Z';
const seconds = Date.parse(observedAt) / 1000;
function fixture({ shared = false, description = null, extraMissions = 0 } = {}) {
  const category = id => ({ id, name: `Category ${id}` });
  const mission = (id, categoryId) => ({ id, categoryId, type: 'Mission', name: `Mission ${id}`,
    description, priority: 0, rewards: [{ id, itemId: id, itemType: 'Card', quantity: 1 }] });
  const campaign = (id, categoryId, completion) => ({ id, name: `Campaign ${id}`,
    start_at: seconds - 60, end_at: seconds + 3600, end_at_hidden: false,
    campaign_complete_mission_id: completion, priority: id, announcement_id: id,
    mission_boards: [{ id, number: 1, contents_lv: 0, mission_category_id: categoryId,
      complete_mission_id: completion, display_reward_id: completion }] });
  const body = { access_token: 'PRIVATE', missions: [{ current_value: 'PRIVATE' }],
    mission_board_campaigns: [campaign(1, 10, 100), campaign(2, shared ? 10 : 20, shared ? 100 : 200)] };
  const definitions = { schemaVersion: 1, contract: 'dokkan-campaign-definitions', source: 'dokkan-game-db',
    databaseSha256: 'a'.repeat(64), categories: [category(10), category(20)],
    missions: [mission(100, 10), mission(101, 10), mission(200, 20),
      ...Array.from({ length: extraMissions }, (_, n) => mission(1000 + n, 10))] };
  const definitionBytes = Buffer.from(JSON.stringify(definitions));
  return { observation: { bodyBytes: Buffer.from(JSON.stringify(body)), status: 200,
    endpoint: '/missions/mission_board_campaigns', timestampUnit: 'unix-seconds', observedAt, now: observedAt },
  definitionBytes, expectedDefinitionSha256: sha(definitionBytes), expectedDatabaseSha256: definitions.databaseSha256 };
}

test('compact index identifies separate details with exact byte hashes and typed destinations', () => {
  const result = prepareCampaignDelivery(fixture());
  const index = JSON.parse(result.indexBytes);
  assert.equal(result.indexSha256, sha(result.indexBytes));
  assert.equal(index.publicationAllowed, false);
  assert.equal(index.region, 'global');
  assert.equal(index.mode, 'offline-experiment');
  assert.equal(index.campaigns.length, 2);
  for (const [position, entry] of index.campaigns.entries()) {
    const detail = result.details[position];
    assert.deepEqual(entry.destination, { type: 'campaign-detail', campaignId: entry.id, detailSha256: sha(detail.bytes) });
    assert.deepEqual(entry.detail, { sha256: sha(detail.bytes), sizeBytes: detail.bytes.length });
    assert.equal(detail.campaignId, entry.id);
    const parsed = JSON.parse(detail.bytes);
    assert.equal(parsed.campaign.id, entry.id);
    for (const key of ['observationSha256', 'definitionSha256', 'databaseSha256', 'observedAt', 'validUntil']) {
      assert.equal(parsed[key], index[key]);
    }
    assert.equal(parsed.publicationAllowed, false);
  }
  assert.equal(result.totalBytes, result.indexBytes.length + result.details.reduce((n, d) => n + d.bytes.length, 0));
  assert(result.indexBytes.length <= CAMPAIGN_DELIVERY_LIMITS.indexBytes);
  assert(!result.indexBytes.toString().includes('description'));
});

test('each detail only contains its referenced missions including completion', () => {
  const result = prepareCampaignDelivery(fixture());
  assert.deepEqual(result.details.map(d => JSON.parse(d.bytes).missions.map(m => m.id)), [[100, 101], [200]]);
});

test('shared missions are self-contained once per campaign, not duplicated within it', () => {
  const result = prepareCampaignDelivery(fixture({ shared: true }));
  for (const detail of result.details) assert.deepEqual(JSON.parse(detail.bytes).missions.map(m => m.id), [100, 101]);
});

test('packing is deterministic and source/content changes invalidate identity', () => {
  const first = prepareCampaignDelivery(fixture());
  const second = prepareCampaignDelivery(fixture());
  assert.deepEqual(first, second);
  const changed = prepareCampaignDelivery(fixture({ description: 'Different content' }));
  assert.notEqual(first.indexSha256, changed.indexSha256);
  assert.notEqual(first.details[0].sha256, changed.details[0].sha256);
});

test('input pin failures, expired observations and malformed input fail with fixed error', () => {
  const badPin = fixture();
  badPin.expectedDefinitionSha256 = 'b'.repeat(64);
  const expired = fixture();
  expired.observation.now = '2026-09-12T18:00:00.000Z';
  for (const input of [null, {}, badPin, expired]) assert.throws(() => prepareCampaignDelivery(input), { message: 'Invalid offline campaign delivery' });
});

test('no account state, raw URLs or private wrappers escape into any artifact', () => {
  const result = prepareCampaignDelivery(fixture());
  for (const bytes of [result.indexBytes, ...result.details.map(d => d.bytes)]) {
    assert(!/PRIVATE|access_token|current_value|https?:\/\//.test(bytes.toString()));
  }
});

test('per-campaign expanded byte cap rejects oversized detail even under preview cap', () => {
  const input = fixture({ description: 'x'.repeat(4000), extraMissions: 135 });
  assert.doesNotThrow(() => prepareCampaignPreview(input));
  assert.throws(() => prepareCampaignDelivery(input),
    { message: 'Invalid offline campaign delivery' });
});

function repeatCampaign(input, count) {
  const body = JSON.parse(input.observation.bodyBytes);
  const original = body.mission_board_campaigns[0];
  body.mission_board_campaigns = Array.from({ length: count }, (_, n) => ({
    ...original, id: n + 1, name: 'C'.repeat(120),
    mission_boards: original.mission_boards.map(b => ({ ...b, id: n + 1 })),
  }));
  input.observation.bodyBytes = Buffer.from(JSON.stringify(body));
  return input;
}

test('index cap rejects too many long summaries without relaxing the Home limit', () => {
  const input = repeatCampaign(fixture(), 100);
  assert.doesNotThrow(() => prepareCampaignPreview(input));
  assert.throws(() => prepareCampaignDelivery(input), { message: 'Invalid offline campaign delivery' });
});

test('aggregate cap bounds duplication of shared definitions across campaigns', () => {
  const input = repeatCampaign(fixture({ description: 'x'.repeat(4000), extraMissions: 90 }), 12);
  assert.doesNotThrow(() => prepareCampaignPreview(input));
  assert.throws(() => prepareCampaignDelivery(input), { message: 'Invalid offline campaign delivery' });
});
