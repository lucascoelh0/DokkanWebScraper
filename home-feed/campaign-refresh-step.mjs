import { collectCampaigns } from './collect-campaigns.mjs';
import { publishCampaigns } from './publish-campaigns.mjs';

const TARGET = 'staging/v2/campaigns/';

/** Optional step inside the Home owner's existing durable slot, never a new job.
 * A slot is consumed even on failure. Transport adapters must bound their own I/O;
 * ownership checks do not cancel in-flight writes or replace conditional writes.
 * No credentials, schedule or hosted storage capability is provisioned here.
 */
export function createCampaignRefreshStep({ enabled = false, includePresentation = false, config, definitionBytes,
  expectedDefinitionSha256, expectedDatabaseSha256, authorizedTarget,
  readObject, readBucketBytes, putObject, publicRead, reportPreflight,
} = {}, { fetchImpl = fetch, now = Date.now } = {}) {
  const attempted = new WeakSet();
  // Snapshot the pinned definitions; the collector performs their full validation.
  const definitions = Buffer.isBuffer(definitionBytes) ? Buffer.from(definitionBytes) : null;
  return async ({ lease } = {}) => {
    if (enabled !== true) return { status: 'disabled' };
    let phase = 'configuration';
    try {
      if (authorizedTarget !== TARGET || !lease || typeof lease.assertOwned !== 'function'
        || ![readObject, readBucketBytes, putObject, publicRead, reportPreflight].every(fn => typeof fn === 'function'))
        throw Error();
      if (attempted.has(lease)) return { status: 'already_attempted' };
      attempted.add(lease);
      phase = 'ownership';
      await lease.assertOwned();
      phase = 'collection';
      const collection = await collectCampaigns({ enabled: true, includePresentation, config,
        definitionBytes: definitions, expectedDefinitionSha256, expectedDatabaseSha256 }, {
        now, fetchImpl: async (...args) => {
          await lease.assertOwned();
          return fetchImpl(...args);
        },
      });
      if (collection.status !== 'collected') throw Error();
      phase = 'publication';
      await lease.assertOwned();
      const receipt = await publishCampaigns(collection, { authorizedTarget,
        readObject, readBucketBytes, publicRead, now,
        reportPreflight: async report => {
          await lease.assertOwned();
          await reportPreflight(report);
          await lease.assertOwned();
        },
        putObject: async (...args) => {
          await lease.assertOwned();
          const version = await putObject(...args);
          await lease.assertOwned();
          return version;
        },
      });
      await lease.assertOwned();
      return { status: 'published', manifestSha256: receipt.manifestSha256 };
    } catch {
      // Publication may have partially or fully written: never claim rollback.
      return { status: 'failed', phase };
    }
  };
}
