import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';

const BASE = 'https://assets.dkbcompanion.com/staging/v2/';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

async function read(url, maximum, fetchImpl) {
  const response = await fetchImpl(url, { redirect: 'error', signal: AbortSignal.timeout(20000),
    headers: { 'accept-encoding': 'identity', 'cache-control': 'no-cache' } });
  assert(response.body);
  const reader = response.body.getReader();
  const chunks = []; let size = 0;
  try {
    assert(response.status === 200);
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length; assert(size <= maximum);
      chunks.push(Buffer.from(value));
    }
    assert(size > 0);
    return Buffer.concat(chunks);
  } finally { await reader.cancel(); }
}

/** Public staging reads only. The manifest pins compressed bytes; Android joins expanded bytes. */
export async function loadEventCatalog({ fetchImpl = fetch, expectedCatalogSha256 } = {}) {
  try {
    assert(typeof expectedCatalogSha256 === 'string' && /^[a-f0-9]{64}$/.test(expectedCatalogSha256));
    const manifest = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(
      await read(BASE + 'stage-details-manifest.json', 1024 * 1024, fetchImpl)));
    assert(manifest.schemaVersion === 2 && manifest.contract === 'dokkan-stage-delivery'
      && ['1.0.0','1.1.0'].includes(manifest.contractVersion) && manifest.source === 'dokkan-game-db');
    const entry = manifest.catalog;
    assert(entry && /^[a-f0-9]{64}$/.test(entry.sha256));
    assert(entry.contentType === 'application/json' && entry.contentEncoding === 'gzip');
    assert(entry.objectKey === `stage-details/objects/${entry.sha256}.json.gz`);
    assert(Number.isSafeInteger(entry.sizeBytes) && entry.sizeBytes > 0 && entry.sizeBytes <= 4 * 1024 * 1024);
    assert(Number.isSafeInteger(entry.expandedSizeBytes) && entry.expandedSizeBytes > 0 && entry.expandedSizeBytes <= 16 * 1024 * 1024);
    const compressed = await read(BASE + entry.objectKey, entry.sizeBytes, fetchImpl);
    assert(compressed.length === entry.sizeBytes && digest(compressed) === entry.sha256);
    const catalogBytes = gunzipSync(compressed, { maxOutputLength: entry.expandedSizeBytes });
    assert(catalogBytes.length === entry.expandedSizeBytes);
    assert(digest(catalogBytes) === expectedCatalogSha256);
    return { catalogBytes, catalogSha256: expectedCatalogSha256 };
  } catch { throw Error('event_catalog_unavailable'); }
}
