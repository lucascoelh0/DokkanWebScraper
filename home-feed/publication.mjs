import assert from 'node:assert/strict';
import { PREFIX, sha } from './prepare-candidate.mjs';
import { validateArtworkItems } from './event-artwork-index.mjs';
const MANIFEST = PREFIX + 'manifest.json';

function validate(candidate, now) {
  assert(candidate.validUntil > now);
  assert(candidate.operations.length >= 2 && candidate.operations.length <= 70);
  assert(new Set(candidate.operations.map(o => o.key)).size === candidate.operations.length);
  assert(candidate.operations.at(-1).key === MANIFEST);
  for (const o of candidate.operations) {
    assert(Buffer.isBuffer(o.bytes) && o.sizeBytes === o.bytes.length && o.sha256 === sha(o.bytes));
    assert(o.key === MANIFEST || /^staging\/v2\/home\/(?:images\/[a-f0-9]{64}\.png|[a-f0-9]{64}\.json)$/.test(o.key));
    assert(o.bytes.length <= (o.key.endsWith('.png') ? 2097152 : 65536));
    if (o.key !== MANIFEST) assert(o.key.includes(o.sha256));
  }
  assert(sha(candidate.operations.at(-1).bytes) === candidate.manifestSha256);
  const manifest = JSON.parse(candidate.operations.at(-1).bytes);
  const payload = candidate.operations.at(-2);
  assert(manifest.file === payload.sha256 + '.json' && manifest.sha256 === payload.sha256);
  assert(manifest.sizeBytes === payload.sizeBytes && payload.key === PREFIX + manifest.file);
  const body = JSON.parse(payload.bytes);
  // Shared-art releases allow 20 additional PNGs and up to eight index shards;
  // the legacy ceiling and universal 16 MiB write/storage guards remain intact.
  if (candidate.operations.length > 42) {
    const index = body.eventArtwork;
    assert(index?.schemaVersion === 1 && /^[a-f0-9]{64}$/.test(index.catalogSha256));
    assert(Array.isArray(index.shards) && index.shards.length <= 8);
    const artKeys = new Set(), imageKeys = new Set(), targetKeys = new Set();
    for (const ref of index.shards) {
      assert(ref.file === ref.sha256 + '.json' && /^[a-f0-9]{64}$/.test(ref.sha256));
      const key = PREFIX + ref.file;
      assert(!artKeys.has(key));
      const op = candidate.operations.slice(0, -2).find(o => o.key === key);
      assert(op && op.sizeBytes === ref.sizeBytes);
      const shard = JSON.parse(op.bytes);
      assert(shard.schemaVersion === 1 && shard.catalogSha256 === index.catalogSha256);
      const items = validateArtworkItems(shard.items, now);
      assert(Object.keys(items).length <= 512);
      for (const [target, [image]] of Object.entries(items)) {
        assert(!targetKeys.has(target)); targetKeys.add(target);
        imageKeys.add(PREFIX + 'images/' + image + '.png');
      }
      artKeys.add(key);
    }
    assert(targetKeys.size <= 2000);
    const artImages = candidate.operations.filter(o => imageKeys.has(o.key));
    assert(artImages.length <= 20);
    for (const o of artImages) artKeys.add(o.key);
    assert(candidate.operations.filter(o => !artKeys.has(o.key)).length <= 42);
  }
  assert(Date.parse(body.validUntil) === candidate.validUntil && Date.parse(body.generatedAt) <= now);
}

/** store.get -> null or {bytes,etag}; store.put must enforce conditional writes.
 * A plan is bound to the exact candidate and previous manifest, never a wildcard.
 */
export function publication(store, publicRead, now = Date.now) {
  const plans = new WeakMap();
  const startingManifests = new WeakMap();
  return {
    async plan(candidate, lease) {
      validate(candidate, now());
      // One five-minute budget spans preflight and publication, with a full
      // network-operation reserve before the durable ownership deadline.
      const deadline = Math.min(now() + 5 * 60_000, (lease?.deadline ?? Infinity) - 120_000);
      assert(now() < deadline, 'publication_budget_exhausted');
      const bucketBytes = await store.inventoryBytes();
      let newBytes = 0, writeBytes = 0;
      const operations = [];
      for (const o of candidate.operations) {
        assert(now() < deadline, 'publication_budget_exhausted');
        const existing = await store.get(o.key);
        const mutable = o.key === MANIFEST;
        if(mutable){
          if(!startingManifests.has(candidate))startingManifests.set(candidate,existing?.bytes ? Buffer.from(existing.bytes) : null);
          const initial=startingManifests.get(candidate);
          // Recovery may see our own uncertain promotion or the original head,
          // never adopt a different publisher's head and overwrite it.
          assert((existing?.bytes?.equals(o.bytes)) ||
            (initial===null ? existing===null : existing?.bytes?.equals(initial)), 'manifest_changed');
        }
        if (existing && !mutable) assert(existing.bytes.equals(o.bytes), 'immutable_collision');
        const write = !existing || !existing.bytes.equals(o.bytes);
        if (write) { writeBytes += o.sizeBytes; newBytes += Math.max(0, o.sizeBytes - (existing?.bytes.length ?? 0)); }
        operations.push({ ...o, bytes: Buffer.from(o.bytes), write,
          condition: existing ? { ifMatch: existing.etag } : { ifNoneMatch: '*' } });
      }
      assert(writeBytes <= 16 * 1024 * 1024 && bucketBytes + newBytes < 8_000_000_000);
      const result = Object.freeze({ target: PREFIX, conflicts: 0, bucketBytes, newBytes, writeBytes });
      plans.set(result, { operations, manifestSha256: candidate.manifestSha256, deadline });
      return result;
    },
    async publish(candidate, plan, lease) {
      validate(candidate, now());
      const bound = plans.get(plan);
      assert(bound && bound.manifestSha256 === candidate.manifestSha256);
      plans.delete(plan); // A failed/uncertain operation must not be blindly retried.
      for (const o of bound.operations) {
        assert(now() < bound.deadline, 'publication_budget_exhausted');
        await lease.assertOwned();
        assert(candidate.validUntil > now());
        if (o.write) await store.put(o.key, o.bytes, { ...o.condition,
          contentType: o.contentType, cacheControl: o.cacheControl });
        const bytes = await publicRead(o.key, o.sizeBytes);
        assert(bytes.length === o.sizeBytes && sha(bytes) === o.sha256, 'public_verification_failed');
      }
      return { verified: true, manifestSha256: bound.manifestSha256 };
    },
  };
}
