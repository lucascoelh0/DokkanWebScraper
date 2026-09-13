import { createHash } from 'node:crypto';
import { prepareCollectedCampaignCandidate } from './collect-campaigns.mjs';
import { preflightCampaignPublication } from './preflight-campaign-publication.mjs';

const TARGET = 'staging/v2/campaigns/';
const MAX_BUDGET_BYTES = 10_000_000_000;
const DEFAULT_BUDGET_BYTES = 8_000_000_000;
const MAX_LIFETIME_MS = 180_000;
const VERSION = /^[\x21-\x7e]{1,256}$/;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

/**
 * Publishes only a genuine, fresh in-process campaign collection. The injected
 * store must enforce the supplied conditional write options.
 */
export async function publishCampaigns(collection, {
  authorizedTarget, readObject, readBucketBytes, putObject, publicRead,
  reportPreflight, now = Date.now, maxBucketBytes = DEFAULT_BUDGET_BYTES,
} = {}) {
  try {
    if (authorizedTarget !== TARGET || typeof readObject !== 'function'
      || typeof readBucketBytes !== 'function' || typeof putObject !== 'function'
      || typeof publicRead !== 'function' || typeof reportPreflight !== 'function'
      || !Number.isSafeInteger(maxBucketBytes) || maxBucketBytes <= 0
      || maxBucketBytes > MAX_BUDGET_BYTES) throw new Error();

    const started = now();
    const candidate = prepareCollectedCampaignCandidate(collection, { now: () => started });
    const validUntil = Date.parse(candidate.validUntil);
    const checkTime = () => {
      const instant = now();
      if (!Number.isSafeInteger(instant) || instant < started
        || instant - started >= MAX_LIFETIME_MS || instant >= validUntil) throw new Error();
      return instant;
    };
    const checked = async promise => {
      const value = await promise;
      checkTime();
      return value;
    };
    const inspect = async (key, limit) => {
      const value = await checked(readObject(key));
      if (value === null) return null;
      if (!value || !Buffer.isBuffer(value.bytes) || value.bytes.length === 0
        || value.bytes.length > limit || typeof value.version !== 'string'
        || !VERSION.test(value.version)) throw new Error();
      return { bytes: Buffer.from(value.bytes), sha256: sha(value.bytes),
        sizeBytes: value.bytes.length, version: value.version };
    };
    const verifyPublic = async descriptor => {
      const bytes = await checked(publicRead(descriptor.key, descriptor.sizeBytes));
      if (!Buffer.isBuffer(bytes) || bytes.length !== descriptor.sizeBytes
        || sha(bytes) !== descriptor.sha256) throw new Error();
    };
    const sameWitness = (left, right) => left === null ? right === null
      : right !== null && left.sha256 === right.sha256
        && left.sizeBytes === right.sizeBytes && left.version === right.version;

    const report = await preflightCampaignPublication(collection, {
      readObject, readBucketBytes, now, maxBucketBytes,
    });
    checkTime();
    await reportPreflight(report);
    checkTime();

    const bytesByKey = new Map(candidate.details.map(detail =>
      [TARGET + detail.objectKey, Buffer.from(detail.bytes)]));
    bytesByKey.set(`${TARGET}index/${candidate.indexSha256}.json`, Buffer.from(candidate.indexBytes));
    bytesByKey.set(`${TARGET}manifest.json`, Buffer.from(candidate.manifestBytes));
    if (report.target !== TARGET || report.objects.length !== bytesByKey.size) throw new Error();
    for (const descriptor of report.objects) {
      const bytes = bytesByKey.get(descriptor.key);
      if (!bytes || bytes.length !== descriptor.sizeBytes || sha(bytes) !== descriptor.sha256) throw new Error();
    }

    const manifest = report.objects.at(-1);
    const dependencies = report.objects.slice(0, -1);
    const initialManifest = await inspect(manifest.key, 4096);
    if (!sameWitness(manifest.existing, initialManifest)) throw new Error();
    const refreshedBucketBytes = await checked(readBucketBytes());
    const conservativeBytes = refreshedBucketBytes + candidate.totalBytes;
    if (!Number.isSafeInteger(refreshedBucketBytes) || refreshedBucketBytes < 0
      || !Number.isSafeInteger(conservativeBytes) || conservativeBytes >= maxBucketBytes) throw new Error();

    let createdObjects = 0;
    let reusedObjects = 0;
    for (const descriptor of dependencies) {
      checkTime();
      const bytes = bytesByKey.get(descriptor.key);
      const existing = await inspect(descriptor.key, 512 * 1024);
      if (existing) {
        if (existing.sha256 !== descriptor.sha256 || existing.sizeBytes !== descriptor.sizeBytes) throw new Error();
        reusedObjects++;
      } else {
        if (descriptor.action === 'reuse') throw new Error();
        const version = await checked(putObject(descriptor.key, bytes, {
          ifNoneMatch: '*', contentType: descriptor.contentType, cacheControl: descriptor.cacheControl,
        }));
        if (typeof version !== 'string' || !VERSION.test(version)) throw new Error();
        createdObjects++;
      }
      const verified = await inspect(descriptor.key, 512 * 1024);
      if (!verified || verified.sha256 !== descriptor.sha256
        || verified.sizeBytes !== descriptor.sizeBytes) throw new Error();
      await verifyPublic(descriptor);
    }

    const bucketBytes = await checked(readBucketBytes());
    if (!Number.isSafeInteger(bucketBytes) || bucketBytes < 0 || bucketBytes >= maxBucketBytes) throw new Error();
    const manifestBaseline = await inspect(manifest.key, 4096);
    if (!sameWitness(manifest.existing, manifestBaseline)) throw new Error();
    const manifestAlreadyCurrent = manifestBaseline?.sha256 === manifest.sha256
      && manifestBaseline.sizeBytes === manifest.sizeBytes;
    const projectedBucketBytes = bucketBytes + (manifestAlreadyCurrent ? 0 : manifest.sizeBytes);
    if (!Number.isSafeInteger(projectedBucketBytes) || projectedBucketBytes >= maxBucketBytes) throw new Error();

    if (manifestAlreadyCurrent) {
      reusedObjects++;
    } else {
      const condition = manifestBaseline
        ? { ifMatch: manifestBaseline.version } : { ifNoneMatch: '*' };
      const version = await checked(putObject(manifest.key, bytesByKey.get(manifest.key), {
        ...condition, contentType: manifest.contentType, cacheControl: manifest.cacheControl,
      }));
      if (typeof version !== 'string' || !VERSION.test(version)) throw new Error();
      createdObjects++;
    }

    const finalManifest = await inspect(manifest.key, 4096);
    if (!finalManifest || finalManifest.sha256 !== manifest.sha256
      || finalManifest.sizeBytes !== manifest.sizeBytes) throw new Error();
    await verifyPublic(manifest);
    const completedAt = new Date(checkTime()).toISOString();
    return Object.freeze({ kind: 'campaign-publication-result', status: 'published',
      target: TARGET, verified: true, completedAt, indexSha256: candidate.indexSha256,
      manifestSha256: manifest.sha256, createdObjects, reusedObjects,
      projectedBucketBytes });
  } catch {
    throw new Error('campaign_publication_failed');
  }
}
