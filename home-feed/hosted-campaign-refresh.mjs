import assert from 'node:assert/strict';
import { open, lstat } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { prepareCampaignDelivery } from './prepare-campaign-delivery.mjs';
import { campaignGatewayStore } from './campaign-gateway-store.mjs';
import { campaignPublicRead } from './campaign-r2-store.mjs';
import { createCampaignRefreshStep } from './campaign-refresh-step.mjs';

const LIMIT = 2 * 1024 * 1024;
const TARGET = 'staging/v2/campaigns/';

export function decodeCampaignDefinitions(encoded) {
  assert(typeof encoded === 'string' && encoded.length > 0 && encoded.length <= 32768);
  assert(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded));
  const compressed = Buffer.from(encoded, 'base64');
  assert(compressed.toString('base64') === encoded);
  const bytes = gunzipSync(compressed, { maxOutputLength: LIMIT });
  assert(bytes.length > 0);
  return bytes;
}

export async function readCampaignDefinitions(path) {
  assert(typeof path === 'string' && isAbsolute(path));
  const stat = await lstat(path);
  assert(stat.isFile() && stat.size > 0 && stat.size <= LIMIT);
  const file = await open(path, 'r');
  try {
    const opened = await file.stat();
    assert(opened.isFile() && opened.size === stat.size && opened.ino === stat.ino && opened.dev === stat.dev);
    const bytes = Buffer.alloc(opened.size + 1);
    let total = 0;
    while (total < bytes.length) {
      const { bytesRead } = await file.read(bytes, total, bytes.length - total, total);
      if (bytesRead === 0) break;
      total += bytesRead;
    }
    assert(total === opened.size);
    return bytes.subarray(0, total);
  } finally { await file.close(); }
}

/** No I/O until the existing Home owner invokes this after verified publication. */
export function hostedCampaignRefresh(env, config, {
  now = Date.now, fetchImpl = fetch, readDefinitions = readCampaignDefinitions,
  makeStore = campaignGatewayStore, makeStep = createCampaignRefreshStep,
  report = value => console.log(JSON.stringify(value)),
} = {}) {
  if (env.HOME_FEED_CAMPAIGNS_ENABLED !== 'true') return undefined;
  // Keep only this capability's settings; never retain the entire environment.
  const settings = {
    CAMPAIGN_GATEWAY_URL: env.CAMPAIGN_GATEWAY_URL,
    CAMPAIGN_GATEWAY_TOKEN: env.CAMPAIGN_GATEWAY_TOKEN,
  };
  const path = env.HOME_FEED_CAMPAIGNS_DEFINITIONS_PATH;
  const encoded = env.HOME_FEED_CAMPAIGNS_DEFINITIONS_GZIP_BASE64;
  const expectedDefinitionSha256 = env.HOME_FEED_CAMPAIGNS_DEFINITIONS_SHA256;
  const expectedDatabaseSha256 = env.HOME_FEED_CAMPAIGNS_DATABASE_SHA256;
  const attempted = new WeakSet();
  return async ({ lease } = {}) => {
    let store;
    try {
      assert(lease && typeof lease.assertOwned === 'function');
      if (attempted.has(lease)) return { status: 'already_attempted' };
      attempted.add(lease);
      await lease.assertOwned();
      assert(!(path && encoded));
      const definitionBytes = encoded ? decodeCampaignDefinitions(encoded) : await readDefinitions(path);
      const observedAt = new Date(now()).toISOString();
      // Full validation, not merely a checksum, before constructing auth/store.
      prepareCampaignDelivery({ definitionBytes, expectedDefinitionSha256, expectedDatabaseSha256,
        observation: { bodyBytes: Buffer.from('{"mission_board_campaigns":[]}'), status: 200,
          endpoint: '/missions/mission_board_campaigns', observedAt, now: observedAt, timestampUnit: 'unix-seconds' } });
      await lease.assertOwned();
      store = makeStore(settings, { fetchImpl, now });
      const step = makeStep({ enabled: true, includePresentation: true, config, definitionBytes,
        expectedDefinitionSha256, expectedDatabaseSha256, authorizedTarget: TARGET,
        readObject: store.readObject, readBucketBytes: store.readBucketBytes, putObject: store.putObject,
        publicRead: (key, size) => campaignPublicRead(key, size, { fetchImpl }),
        reportPreflight: value => report({ phase: 'campaign_preflight', target: TARGET,
          maximumWriteBytes: value.maximumWriteBytes, projectedBucketBytes: value.projectedBucketBytes,
          maxBucketBytes: value.maxBucketBytes, reusedObjects: value.reusedObjects,
          objectCount: value.objects.length }),
      }, { fetchImpl, now });
      return await step({ lease });
    } catch { return { status: 'failed' }; }
    finally { store?.close(); }
  };
}
