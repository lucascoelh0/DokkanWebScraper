import assert from 'node:assert/strict';
import { PREFIX, sha } from './prepare-candidate.mjs';
const MANIFEST = PREFIX + 'manifest.json';

function validate(candidate, now) {
  assert(candidate.validUntil > now);
  assert(candidate.operations.length >= 2 && candidate.operations.length <= 42);
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
  assert(Date.parse(body.validUntil) === candidate.validUntil && Date.parse(body.generatedAt) <= now);
}

/** store.get -> null or {bytes,etag}; store.put must enforce conditional writes.
 * A plan is bound to the exact candidate and previous manifest, never a wildcard.
 */
export function publication(store, publicRead, now = Date.now) {
  const plans = new WeakMap();
  return {
    async plan(candidate) {
      validate(candidate, now());
      const bucketBytes = await store.inventoryBytes();
      let newBytes = 0, writeBytes = 0;
      const operations = [];
      for (const o of candidate.operations) {
        const existing = await store.get(o.key);
        const mutable = o.key === MANIFEST;
        if (existing && !mutable) assert(existing.bytes.equals(o.bytes), 'immutable_collision');
        const write = !existing || !existing.bytes.equals(o.bytes);
        if (write) { writeBytes += o.sizeBytes; newBytes += Math.max(0, o.sizeBytes - (existing?.bytes.length ?? 0)); }
        operations.push({ ...o, bytes: Buffer.from(o.bytes), write,
          condition: existing ? { ifMatch: existing.etag } : { ifNoneMatch: '*' } });
      }
      assert(writeBytes <= 16 * 1024 * 1024 && bucketBytes + newBytes < 8_000_000_000);
      const result = Object.freeze({ target: PREFIX, conflicts: 0, bucketBytes, newBytes, writeBytes });
      plans.set(result, { operations, manifestSha256: candidate.manifestSha256 });
      return result;
    },
    async publish(candidate, plan, lease) {
      validate(candidate, now());
      const bound = plans.get(plan);
      assert(bound && bound.manifestSha256 === candidate.manifestSha256);
      plans.delete(plan); // A failed/uncertain operation must not be blindly retried.
      for (const o of bound.operations) {
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
