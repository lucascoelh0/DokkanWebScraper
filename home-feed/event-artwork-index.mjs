import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const shaPattern = /^[a-f0-9]{64}$/;
const keyPattern = /^(event-area|z-battle):[1-9][0-9]{0,8}$/;
const BASE = 'https://assets.dkbcompanion.com/staging/v2/home/';
const PREFIX = 'staging/v2/home/';
export function validateArtworkItems(items, now = Date.now()) {
  assert(items && typeof items === 'object' && !Array.isArray(items));
  assert(Object.keys(items).length <= 2000);
  for (const [key, value] of Object.entries(items)) {
    assert(keyPattern.test(key) && Array.isArray(value) && value.length === 2);
    assert(shaPattern.test(value[0]) && Number.isSafeInteger(value[1]));
    assert(value[1] >= 1230768000 && value[1] < 4102444800 && value[1] * 1000 <= now);
  }
  return structuredClone(items);
}

export function prepareArtworkIndex(catalogSha256, items, now, cursor) {
  assert(shaPattern.test(catalogSha256));
  assert(cursor === undefined || keyPattern.test(cursor));
  const valid = validateArtworkItems(items, now);
  const buckets = Array.from({length:8}, () => ({}));
  for (const key of Object.keys(valid).sort()) {
    const bucket = parseInt(hash(Buffer.from(key)).slice(0, 2), 16) % 8;
    buckets[bucket][key] = valid[key];
  }
  const operations = [], shards = [];
  for (const items of buckets.filter(b => Object.keys(b).length)) {
    assert(Object.keys(items).length <= 512);
    const bytes = Buffer.from(JSON.stringify({schemaVersion:1,catalogSha256,items}));
    assert(bytes.length <= 65536);
    const sha256 = hash(bytes), file = sha256 + '.json';
    operations.push({key:PREFIX + file,bytes,sizeBytes:bytes.length,sha256,contentType:'application/json',cacheControl:'public,max-age=31536000,immutable'});
    shards.push({file,sha256,sizeBytes:bytes.length});
  }
  return {index:{schemaVersion:1,catalogSha256,shards,...(cursor ? {cursor} : {})},operations};
}

function descriptor(value) {
  assert(value && shaPattern.test(value.sha256) && value.file === value.sha256 + '.json');
  assert(Number.isSafeInteger(value.sizeBytes) && value.sizeBytes > 0 && value.sizeBytes <= 65536);
  return value;
}
async function read(path, limit, fetchImpl, allowMissing = false, traversalSignal) {
  traversalSignal?.throwIfAborted();
  const signal = traversalSignal ? AbortSignal.any([traversalSignal, AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000);
  const response = await fetchImpl(BASE + path, {redirect:'error',signal,headers:{'accept-encoding':'identity','cache-control':'no-cache'}});
  if (allowMissing && response.status === 404) return null;
  assert(response.status === 200 && response.body);
  const reader = response.body.getReader(), chunks = []; let size = 0;
  try {
    for (;;) {
      const {done,value} = await reader.read(); if (done) break;
      size += value.length; assert(size <= limit); chunks.push(Buffer.from(value));
    }
    assert(size > 0); return Buffer.concat(chunks);
  } finally { await reader.cancel(); }
}
async function readObject(ref, fetchImpl, signal) {
  descriptor(ref);
  const bytes = await read(ref.file, ref.sizeBytes, fetchImpl, false, signal);
  assert(bytes.length === ref.sizeBytes && hash(bytes) === ref.sha256);
  return JSON.parse(bytes.toString('utf8'));
}

/** Read-only, hash-verified last published index. A failure must not replace it with empty art. */
export async function loadPreviousEventArtwork(catalogSha256, {fetchImpl=fetch,now=Date.now,signal=AbortSignal.timeout(20000)} = {}) {
  try {
    assert(shaPattern.test(catalogSha256));
    const bytes = await read('manifest.json', 1024, fetchImpl, true, signal);
    if (!bytes) return {catalogSha256,items:{}};
    const manifest = JSON.parse(bytes.toString('utf8'));
    assert(manifest.schemaVersion === 1);
    const home = await readObject(manifest, fetchImpl, signal);
    const index = home.eventArtwork;
    if (!index || index.catalogSha256 !== catalogSha256) return {catalogSha256,items:{}};
    assert(index.schemaVersion === 1 && Array.isArray(index.shards) && index.shards.length <= 8);
    assert(index.cursor === undefined || keyPattern.test(index.cursor));
    assert(new Set(index.shards.map(s => s.file)).size === index.shards.length);
    const items = {};
    for (const ref of index.shards) {
      const shard = await readObject(ref, fetchImpl, signal);
      assert(shard.schemaVersion === 1 && shard.catalogSha256 === catalogSha256);
      const valid = validateArtworkItems(shard.items, now());
      assert(Object.keys(valid).length <= 512);
      for (const [key,value] of Object.entries(valid)) { assert(!Object.hasOwn(items,key)); items[key] = value; }
    }
    return {catalogSha256,items:validateArtworkItems(items,now()),index:structuredClone(index)};
  } catch { return null; }
}
