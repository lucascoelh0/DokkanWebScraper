import { createHash } from 'node:crypto';
import { prepareCollectedCampaignCandidate } from './collect-campaigns.mjs';

/** Local preparation only. This module has no storage client, credentials or upload operation. */
export function planCampaignPublication(collection, { now = Date.now } = {}) {
  try {
    const instant = now();
    const candidate = prepareCollectedCampaignCandidate(collection, { now: () => instant });
    const target = 'staging/v2/campaigns/';
    const object = (relativeKey, bytes, immutable) => Object.freeze({
      key: target + relativeKey,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      sizeBytes: bytes.length,
      contentType: 'application/json',
      cacheControl: immutable ? 'public, max-age=31536000, immutable' : 'no-cache, no-transform',
      mode: immutable ? 'create-or-verify-identical' : 'compare-and-swap-last',
    });
    const objects = Object.freeze([
      ...candidate.details.map(detail => object(detail.objectKey, detail.bytes, true)),
      object(`index/${candidate.indexSha256}.json`, candidate.indexBytes, true),
      object('manifest.json', candidate.manifestBytes, false),
    ]);
    return Object.freeze({
      kind: 'local-campaign-publication-plan',
      target,
      plannedAt: new Date(instant).toISOString(),
      validUntil: candidate.validUntil,
      publicationAllowed: false,
      remotePreflightPerformed: false,
      campaignCount: candidate.details.length,
      objectCount: objects.length,
      candidateBytes: candidate.totalBytes,
      maximumWriteBytes: candidate.totalBytes,
      projectedBucketBytes: null, // Unknown until an authorized read-only remote inventory/preflight.
      objects,
      requiredGates: Object.freeze([
        'coordinated-fresh-observation',
        'explicit-staging-prefix-authorization',
        'read-only-remote-preflight-and-storage-budget',
        'conditional-immutable-write-or-byte-identical-reuse',
        'verify-all-dependencies-before-manifest-compare-and-swap',
        'recheck-expiry-and-public-bytes-after-promotion',
      ]),
    });
  } catch {
    throw new Error('campaign_publication_plan_failed');
  }
}
