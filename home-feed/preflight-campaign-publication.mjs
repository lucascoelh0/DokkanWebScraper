import { createHash } from 'node:crypto';
import { planCampaignPublication } from './plan-campaign-publication.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const MAX_OBJECT_BYTES = 512 * 1024;
const MAX_BUDGET_BYTES = 10_000_000_000;
const DEFAULT_BUDGET_BYTES = 8_000_000_000;

/** Read-only adapter boundary; injected readers are trusted I/O, not proof of authorization. */
export async function preflightCampaignPublication(collection, {
  readObject, readBucketBytes, now = Date.now, maxBucketBytes = DEFAULT_BUDGET_BYTES,
} = {}) {
  try {
    if (typeof readObject !== 'function' || typeof readBucketBytes !== 'function'
      || !Number.isSafeInteger(maxBucketBytes) || maxBucketBytes <= 0
      || maxBucketBytes > MAX_BUDGET_BYTES) throw new Error();
    const started = now();
    const plan = planCampaignPublication(collection, { now: () => started });
    const checkTime = () => {
      const instant = now();
      if (!Number.isSafeInteger(instant) || instant < started || instant - started >= 60_000
        || instant >= Date.parse(plan.validUntil)) throw new Error();
      return instant;
    };
    const usage = async () => {
      const value = await readBucketBytes();
      checkTime();
      if (!Number.isSafeInteger(value) || value < 0 || value >= maxBucketBytes) throw new Error();
      return value;
    };
    const read = async descriptor => {
      const value = await readObject(descriptor.key);
      checkTime();
      if (value === null) return null;
      const limit = descriptor.key.endsWith('/manifest.json') ? 4096 : MAX_OBJECT_BYTES;
      if (!value || !Buffer.isBuffer(value.bytes) || value.bytes.length === 0
        || value.bytes.length > limit || typeof value.version !== 'string'
        || !/^[\x21-\x7e]{1,256}$/.test(value.version)) throw new Error();
      return Object.freeze({ sha256: sha(value.bytes), sizeBytes: value.bytes.length, version: value.version });
    };
    const bucketBefore = await usage();
    const manifest = plan.objects.at(-1);
    const baseline = await read(manifest);
    const objects = [];
    let uploadBytes = 0;
    for (const descriptor of plan.objects) {
      const existing = descriptor === manifest ? baseline : await read(descriptor);
      const identical = existing?.sha256 === descriptor.sha256 && existing.sizeBytes === descriptor.sizeBytes;
      if (existing && !identical && descriptor !== manifest) throw new Error();
      if (!identical) uploadBytes += descriptor.sizeBytes;
      objects.push(Object.freeze({ ...descriptor, action: identical ? 'reuse' : 'write', existing }));
    }
    const bucketAfter = await usage();
    const finalBaseline = await read(manifest);
    if (JSON.stringify(finalBaseline) !== JSON.stringify(baseline)) throw new Error();
    // Do not subtract replaced manifest bytes or assume another writer stays idle.
    const projectedBucketBytes = Math.max(bucketBefore, bucketAfter) + uploadBytes;
    if (!Number.isSafeInteger(projectedBucketBytes) || projectedBucketBytes >= maxBucketBytes) throw new Error();
    const completedAt = new Date(checkTime()).toISOString();
    return Object.freeze({
      kind: 'read-only-campaign-preflight', target: plan.target,
      publicationAllowed: false, completedAt, validUntil: plan.validUntil,
      maximumWriteBytes: uploadBytes, projectedBucketBytes, maxBucketBytes,
      reusedObjects: objects.filter(object => object.action === 'reuse').length,
      objects: Object.freeze(objects),
      requiredBeforeWrite: Object.freeze(['explicit-prefix-authorization', 'fresh-preflight-recheck',
        'conditional-immutable-create-and-readback', 'manifest-compare-and-swap-last', 'public-verification']),
    });
  } catch {
    throw new Error('campaign_publication_preflight_failed');
  }
}
