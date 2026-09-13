import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { hostedCampaignRefresh, readCampaignDefinitions, decodeCampaignDefinitions } from './hosted-campaign-refresh.mjs';

test('hosted definitions require canonical bounded gzip and bounded decoded bytes', () => {
  const bytes = Buffer.from('{"example":true}');
  assert.deepEqual(decodeCampaignDefinitions(gzipSync(bytes).toString('base64')), bytes);
  for (const value of [undefined, '', '!!!!', 'A'.repeat(32772), Buffer.from('not gzip').toString('base64'),
    gzipSync(Buffer.alloc(0)).toString('base64'), gzipSync(Buffer.alloc(2 * 1024 * 1024 + 1)).toString('base64')]) {
    assert.throws(() => decodeCampaignDefinitions(value));
  }
});

test('ambiguous or invalid hosted definitions fail before storage or file access', async () => {
  for (const changes of [
    { HOME_FEED_CAMPAIGNS_DEFINITIONS_GZIP_BASE64: gzipSync(definitions).toString('base64') },
    { HOME_FEED_CAMPAIGNS_DEFINITIONS_PATH: undefined, HOME_FEED_CAMPAIGNS_DEFINITIONS_GZIP_BASE64: 'invalid' },
    { HOME_FEED_CAMPAIGNS_DEFINITIONS_PATH: undefined, HOME_FEED_CAMPAIGNS_DEFINITIONS_GZIP_BASE64: gzipSync(definitions).toString('base64'), HOME_FEED_CAMPAIGNS_DEFINITIONS_SHA256: 'b'.repeat(64) },
  ]) {
    let fileReads = 0, stores = 0;
    const step = hostedCampaignRefresh({ ...env, ...changes }, config, {
      readDefinitions: () => { fileReads++; throw Error(); },
      makeStore: () => { stores++; throw Error(); }, now: () => at,
    });
    assert.deepEqual(await step({ lease: lease() }), { status: 'failed' });
    assert.equal(fileReads, 0); assert.equal(stores, 0);
  }
});

const at = Date.parse('2026-09-13T18:00:00Z');
const definitions = Buffer.from(JSON.stringify({ schemaVersion: 2, contract: 'dokkan-campaign-definitions',
  source: 'dokkan-game-db', databaseSha256: 'a'.repeat(64), categories: [{ id: 10, name: 'Board' }],
  missions: [{ id: 100, categoryId: 10, type: 'Mission', name: 'Task', description: null, priority: 0,
    destination: { type: 'event-area', areaId: 1768 }, rewards: [{ id: 1, itemId: 1, itemType: 'Card', quantity: 1 }] }] }));
const env = { HOME_FEED_CAMPAIGNS_ENABLED: 'true', HOME_FEED_CAMPAIGNS_DEFINITIONS_PATH: '/test/definitions.json',
  HOME_FEED_CAMPAIGNS_DEFINITIONS_SHA256: createHash('sha256').update(definitions).digest('hex'),
  HOME_FEED_CAMPAIGNS_DATABASE_SHA256: 'a'.repeat(64), CAMPAIGN_GATEWAY_URL: 'https://test.test.workers.dev',
  CAMPAIGN_GATEWAY_TOKEN: 'c'.repeat(64), HOME_GATEWAY_TOKEN: 'PRIVATE-HOME' };
const config = { nonceHeaders: {}, loginHeaders: { authorization: 'Basic test' }, loginBody: {}, apiHeaders: {} };
const lease = () => ({ assertOwned: async () => {} });

test('disabled settings do not read files, construct stores or make requests', () => {
  for (const enabled of [undefined, false, true, 'false', 'TRUE', '1']) {
    assert.equal(hostedCampaignRefresh({ ...env, HOME_FEED_CAMPAIGNS_ENABLED: enabled }, config, {
      readDefinitions: () => { throw Error(); }, makeStore: () => { throw Error(); },
    }), undefined);
  }
});

test('invalid pins or schema stop before authentication/storage, once per lease', async () => {
  for (const change of [{ HOME_FEED_CAMPAIGNS_DEFINITIONS_SHA256: 'b'.repeat(64) }, { HOME_FEED_CAMPAIGNS_DATABASE_SHA256: undefined }]) {
    let reads = 0, stores = 0;
    const step = hostedCampaignRefresh({ ...env, ...change }, config, { now: () => at,
      readDefinitions: async () => { reads++; return definitions; }, makeStore: () => { stores++; throw Error(); } });
    const owner = lease();
    assert.deepEqual(await step({ lease: owner }), { status: 'failed' });
    assert.deepEqual(await step({ lease: owner }), { status: 'already_attempted' });
    assert.equal(reads, 1); assert.equal(stores, 0);
  }
});

test('lost lease prevents reading definitions or constructing a store', async () => {
  const step = hostedCampaignRefresh(env, config, { readDefinitions: () => { throw Error('must not read'); } });
  assert.deepEqual(await step({ lease: { assertOwned: async () => { throw Error('PRIVATE'); } } }), { status: 'failed' });
});

test('pin reader accepts regular bounded files and rejects directories, empty and oversized files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'campaign-definitions-reader-'));
  try {
    const file = join(root, 'definitions.json');
    await writeFile(file, definitions);
    assert.deepEqual(await readCampaignDefinitions(file), definitions);
    await assert.rejects(readCampaignDefinitions(root));
    await assert.rejects(readCampaignDefinitions('relative.json'));
    await writeFile(file, Buffer.alloc(0)); await assert.rejects(readCampaignDefinitions(file));
    await writeFile(file, Buffer.alloc(2 * 1024 * 1024 + 1)); await assert.rejects(readCampaignDefinitions(file));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('hosted composition publishes real v2 candidate, reports only totals and closes capability', async () => {
  const objects = new Map(), calls = [], reports = []; let closed = false;
  const step = hostedCampaignRefresh(env, config, { now: () => at, readDefinitions: async () => definitions,
    makeStore: settings => {
      assert.deepEqual(Object.keys(settings).sort(), ['CAMPAIGN_GATEWAY_TOKEN', 'CAMPAIGN_GATEWAY_URL']);
      return {
        readObject: async key => objects.get(key) ?? null,
        readBucketBytes: async () => 100,
        putObject: async (key, bytes, options) => {
          assert.equal(options.ifNoneMatch, '*'); assert(!objects.has(key));
          calls.push(key); objects.set(key, { bytes, version: '"v1"' }); return '"v1"';
        }, close: () => { closed = true; },
      };
    },
    report: report => reports.push(report),
    fetchImpl: async url => {
      const target = new URL(url);
      if (target.hostname === 'assets.dkbcompanion.com') return new Response(objects.get(target.pathname.slice(1)).bytes);
      calls.push(target.pathname);
      const body = target.pathname === '/auth/nonce' ? { auth_transaction_id: 'PRIVATE' }
        : target.pathname === '/auth/sign_in' ? { token_type: 'bearer', access_token: 'PRIVATE' }
        : { mission_board_campaigns: [{ id: 1, name: 'Campaign', start_at: at / 1000 - 60,
          end_at: at / 1000 + 3600, end_at_hidden: false, priority: 0, announcement_id: 1,
          campaign_complete_mission_id: 100, mission_boards: [{ id: 1, number: 1, contents_lv: 0,
            mission_category_id: 10, complete_mission_id: 100, display_reward_id: 1 }] }] };
      return Response.json(body);
    },
  });
  const result = await step({ lease: lease() });
  assert.equal(result.status, 'published'); assert(closed);
  assert.equal(calls.at(-1), 'staging/v2/campaigns/manifest.json');
  const index = [...objects.entries()].find(([key]) => key.includes('/index/'))[1];
  assert.equal(JSON.parse(index.bytes).schemaVersion, 2);
  assert.equal(reports.length, 1);
  assert.deepEqual(Object.keys(reports[0]).sort(), ['maxBucketBytes', 'maximumWriteBytes', 'objectCount', 'phase', 'projectedBucketBytes', 'reusedObjects', 'target']);
  assert(!JSON.stringify([result, reports]).includes('PRIVATE'));
});

test('capability closes even when collection throws and exception text stays private', async () => {
  let closed = false;
  const step = hostedCampaignRefresh(env, config, { now: () => at, readDefinitions: async () => definitions,
    makeStore: () => ({ close: () => { closed = true; } }),
    makeStep: () => async () => { throw Error('PRIVATE'); },
  });
  assert.deepEqual(await step({ lease: lease() }), { status: 'failed' }); assert(closed);
});
