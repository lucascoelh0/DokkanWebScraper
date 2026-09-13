import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { collectCampaigns, prepareCollectedCampaignCandidate } from './collect-campaigns.mjs';
import sharp from 'sharp';
import { planCampaignPublication } from './plan-campaign-publication.mjs';

const at = Date.parse('2026-09-13T02:00:00.000Z');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function input() {
  const definitionBytes = Buffer.from(JSON.stringify({ schemaVersion: 1, contract: 'dokkan-campaign-definitions',
    source: 'dokkan-game-db', databaseSha256: 'a'.repeat(64), categories: [{ id: 10, name: 'Board' }],
    missions: [{ id: 100, categoryId: 10, type: 'Mission', name: 'Synthetic mission', description: null,
      priority: 0, rewards: [{ id: 1, itemId: 1, itemType: 'Card', quantity: 1 }] }] }));
  return { enabled: true, definitionBytes, expectedDefinitionSha256: sha(definitionBytes),
    expectedDatabaseSha256: 'a'.repeat(64), config: { nonceHeaders: {}, loginHeaders: { authorization: 'Basic test' },
      loginBody: { account_id: 'PRIVATE-ACCOUNT' }, apiHeaders: { authorization: 'Bearer PRIVATE-OLD' } } };
}
function io({ status = 200, malformed = false } = {}) {
  const calls = [];
  return { calls, fetchImpl: async (url, options) => {
    const path = new URL(url).pathname;
    calls.push({ path, options });
    const body = path === '/auth/nonce' ? { auth_transaction_id: 'PRIVATE-NONCE' }
      : path === '/auth/sign_in' ? { token_type: 'bearer', access_token: 'PRIVATE-NEW' }
      : malformed ? { private: 'PRIVATE' } : {
        missions: [{ current_value: 'PRIVATE-PROGRESS' }], mission_board_campaigns: [{
          id: 1, name: 'Synthetic campaign', start_at: at / 1000 - 60, end_at: at / 1000 + 3600,
          end_at_hidden: false, priority: 0, announcement_id: 1, campaign_complete_mission_id: 100,
          mission_boards: [{ id: 1, number: 1, contents_lv: 0, mission_category_id: 10,
            complete_mission_id: 100, display_reward_id: 1 }] }] };
    return new Response(JSON.stringify(body), { status: path.startsWith('/auth/') ? 200 : status,
      headers: { 'content-type': 'application/json' } });
  } };
}
test('explicit enablement and independent definitions are required before login', async () => {
  const mock = io();
  for (const enabled of [false, undefined, 'true', 1]) {
    assert.deepEqual(await collectCampaigns({ ...input(), enabled }, mock), { status: 'disabled' });
  }
  assert.deepEqual(await collectCampaigns({ ...input(), expectedDefinitionSha256: 'b'.repeat(64) }, mock), { status: 'unavailable' });
  assert.equal(mock.calls.length, 0);
});

test('opt-in presentation publishes only decoded hash artwork and typed event references', async () => {
  const options = input();
  const defs = JSON.parse(options.definitionBytes);
  defs.schemaVersion = 2;
  defs.missions[0].destination = { type: 'event-area', areaId: 1768 };
  options.definitionBytes = Buffer.from(JSON.stringify(defs));
  options.expectedDefinitionSha256 = sha(options.definitionBytes);
  options.includePresentation = true;
  const png = await sharp({ create: { width: 640, height: 160, channels: 4, background: '#123456' } }).png().toBuffer();
  const mock = io();
  let imageCalls = 0;
  const collection = await collectCampaigns(options, { now: () => at, fetchImpl: async (url, request) => {
    if (new URL(url).hostname === 'cf.ishin-global.aktsk.com') {
      imageCalls++;
      assert.equal(request.headers.authorization, undefined);
      return new Response(png, { headers: { 'content-type': 'image/png' } });
    }
    const response = await mock.fetchImpl(url, request);
    if (new URL(url).pathname !== '/missions/mission_board_campaigns') return response;
    const body = await response.json();
    body.mission_board_campaigns[0].banner_image_path = 'https://cf.ishin-global.aktsk.com/images/en/panel_mission/banner.png?PRIVATE-SIGNATURE';
    return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
  } });
  assert.equal(collection.status, 'collected');
  assert.equal(imageCalls, 1);
  const candidate = prepareCollectedCampaignCandidate(collection, { now: () => at });
  const index = JSON.parse(candidate.indexBytes), detail = JSON.parse(candidate.details[0].bytes);
  assert.equal(index.schemaVersion, 2);
  assert.deepEqual(index.campaigns[0].artwork, detail.campaign.artwork);
  assert.deepEqual(detail.missions[0].destination, { type: 'event-area', areaId: 1768 });
  assert.equal(candidate.images[0].sha256, sha(candidate.images[0].bytes));
  assert(!/PRIVATE|banner_image_path|https:/.test(candidate.indexBytes + candidate.details[0].bytes));
  const plan = planCampaignPublication(collection, { now: () => at });
  assert.equal(plan.objects[0].contentType, 'image/png');
  assert(plan.objects[0].key.endsWith('.png'));
  assert(plan.objects.at(-1).key.endsWith('/manifest.json'));
});
test('one scoped fresh login creates only sanitized offline artifacts', async () => {
  const mock = io(); let tick = 0;
  const result = await collectCampaigns(input(), { ...mock, now: () => at + tick++ * 1000 });
  assert.equal(result.status, 'collected');
  assert.deepEqual(mock.calls.map(c => c.path), ['/auth/nonce', '/auth/sign_in', '/missions/mission_board_campaigns']);
  assert.equal(mock.calls[2].options.headers.authorization, 'Bearer PRIVATE-NEW');
  const index = JSON.parse(result.delivery.indexBytes);
  assert.equal(index.observedAt, '2026-09-13T02:00:00.000Z');
  assert.equal(result.receipt.receivedAt, '2026-09-13T02:00:01.000Z');
  assert.equal(index.publicationAllowed, false);
  assert.equal(result.receipt.published, false);
  for (const bytes of [result.delivery.indexBytes, ...result.delivery.details.map(d => d.bytes)]) {
    assert(!/PRIVATE|current_value/.test(bytes.toString()));
  }
});
test('failed response or invalid body makes no retry and reveals no private values', async () => {
  for (const options of [{ status: 403 }, { malformed: true }]) {
    const mock = io(options);
    assert.deepEqual(await collectCampaigns(input(), { ...mock, now: () => at }), { status: 'unavailable' });
    assert.equal(mock.calls.length, 3);
  }
});
test('clock rollback or slow request cannot extend observed freshness', async () => {
  for (const delta of [-1, 60000]) {
    const mock = io(); let tick = 0;
    assert.deepEqual(await collectCampaigns(input(), { ...mock, now: () => at + (tick++ ? delta : 0) }), { status: 'unavailable' });
    assert.equal(mock.calls.length, 3);
  }
});

test('public candidate has its own schema and identities based only on public projection', async () => {
  const mock = io();
  const collection = await collectCampaigns(input(), { ...mock, now: () => at });
  const candidate = prepareCollectedCampaignCandidate(collection, { now: () => at });
  const index = JSON.parse(candidate.indexBytes), manifest = JSON.parse(candidate.manifestBytes);
  assert.equal(index.contract, 'dokkan-campaign-index');
  assert.equal(index.coverage, 'partial-observation');
  assert.equal(candidate.publicationAllowed, false);
  assert.equal(manifest.sha256, sha(candidate.indexBytes));
  assert.equal(manifest.file, `index/${manifest.sha256}.json`);
  assert.equal(manifest.sizeBytes, candidate.indexBytes.length);
  for (const detail of candidate.details) {
    assert.equal(detail.sha256, sha(detail.bytes));
    assert.equal(JSON.parse(detail.bytes).revisionSha256, index.revisionSha256);
    assert.equal(index.campaigns[0].detail.sha256, detail.sha256);
  }
  for (const bytes of [candidate.indexBytes, candidate.manifestBytes, ...candidate.details.map(d => d.bytes)]) {
    assert(!/PRIVATE|observationSha256|databaseSha256|definitionSha256|offline-experiment/.test(bytes.toString()));
  }
});

test('historical or copied results cannot impersonate an in-process collection receipt', async () => {
  const mock = io();
  const collection = await collectCampaigns(input(), { ...mock, now: () => at });
  for (const fake of [{ ...collection }, JSON.parse(JSON.stringify(collection)), { status: 'collected' }, null]) {
    assert.throws(() => prepareCollectedCampaignCandidate(fake, { now: () => at }), { message: 'campaign_public_candidate_failed' });
  }
  for (const instant of [at - 1, at + 6 * 3600000, NaN]) {
    assert.throws(() => prepareCollectedCampaignCandidate(collection, { now: () => instant }), { message: 'campaign_public_candidate_failed' });
  }
});

test('returned experimental buffers cannot mutate stored trusted projection', async () => {
  const collection = await collectCampaigns(input(), { ...io(), now: () => at });
  const original = prepareCollectedCampaignCandidate(collection, { now: () => at });
  collection.delivery.indexBytes.fill(0);
  collection.delivery.details[0].bytes.fill(0);
  collection.receipt.receivedAt = 'PRIVATE';
  assert.deepEqual(prepareCollectedCampaignCandidate(collection, { now: () => at }), original);
});

test('private progress changes cannot fingerprint the public candidate at same observation time', async () => {
  const first = await collectCampaigns(input(), { ...io(), now: () => at });
  const originalFetch = io().fetchImpl;
  const second = await collectCampaigns(input(), { now: () => at, fetchImpl: async (url, options) => {
    const response = await originalFetch(url, options);
    if (new URL(url).pathname !== '/missions/mission_board_campaigns') return response;
    const body = await response.json(); body.missions = [{ current_value: 'DIFFERENT-PRIVATE' }];
    return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
  } });
  assert.notEqual(JSON.parse(first.delivery.indexBytes).observationSha256, JSON.parse(second.delivery.indexBytes).observationSha256);
  assert.deepEqual(prepareCollectedCampaignCandidate(first, { now: () => at }), prepareCollectedCampaignCandidate(second, { now: () => at }));
});
