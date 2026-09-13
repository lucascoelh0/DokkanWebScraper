import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, timingSafeEqual } from 'node:crypto';
import { campaignGatewayStore } from './campaign-gateway-store.mjs';
import worker from './gateway/src/worker.ts';

if (!crypto.subtle.timingSafeEqual) Object.defineProperty(crypto.subtle, 'timingSafeEqual', {
  value: (a, b) => timingSafeEqual(new Uint8Array(a), new Uint8Array(b)),
});
const env = { CAMPAIGN_GATEWAY_URL: 'https://test.account.workers.dev', CAMPAIGN_GATEWAY_TOKEN: 'c'.repeat(64) };
const prefix = 'staging/v2/campaigns/';
const immutable = { ifNoneMatch: '*', contentType: 'application/json', cacheControl: 'public, max-age=31536000, immutable' };
const mutable = { ifNoneMatch: '*', contentType: 'application/json', cacheControl: 'no-cache, no-transform' };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

test('campaign client rejects endpoint, missing credentials, keys and invalid writes before transport', async () => {
  for (const url of ['https://example.com', 'https://test.account.workers.dev:8443', 'https://test.account.workers.dev/path', 'http://test.account.workers.dev']) {
    assert.throws(() => campaignGatewayStore({ ...env, CAMPAIGN_GATEWAY_URL: url }));
  }
  assert.throws(() => campaignGatewayStore({ ...env, CAMPAIGN_GATEWAY_TOKEN: undefined, HOME_GATEWAY_TOKEN: 'a'.repeat(64) }));
  let calls = 0;
  const store = campaignGatewayStore(env, { fetchImpl: () => { calls++; throw Error('unexpected'); } });
  for (const key of ['production/v2/campaigns/manifest.json', 'staging/v2/home/manifest.json', prefix + 'runs/1.json']) {
    await assert.rejects(store.readObject(key));
  }
  await assert.rejects(store.putObject(prefix + 'manifest.json', Buffer.alloc(4097), mutable));
  await assert.rejects(store.putObject(prefix + 'manifest.json', Buffer.from('{}'), { ...mutable, ifMatch: '"x"' }));
  await assert.rejects(store.putObject(prefix + 'index/' + 'a'.repeat(64) + '.json', Buffer.from('{}'), immutable));
  assert.equal(calls, 0);
});

test('campaign adapter and actual worker preserve immutable hashes, metadata and manifest CAS', async () => {
  const objects = new Map(); let calls = 0;
  const bucket = {
    async get(key) {
      const row = objects.get(key);
      return row ? { size: row.bytes.length, body: new Blob([row.bytes]).stream(), httpEtag: row.etag } : null;
    },
    async put(key, bytes, options) {
      const prior = objects.get(key);
      if (options.onlyIf.get('If-None-Match') === '*' && prior) return null;
      if (options.onlyIf.has('If-Match') && options.onlyIf.get('If-Match') !== prior?.etag) return null;
      const etag = `"version-${++calls}"`;
      objects.set(key, { bytes: Buffer.from(bytes), etag, metadata: options.httpMetadata });
      return { httpEtag: etag };
    },
    async list() { return { objects: [...objects.values()].map(row => ({ size: row.bytes.length })), truncated: false }; },
  };
  const store = campaignGatewayStore(env, { fetchImpl: (url, options) => {
    assert.equal(options.headers.authorization, `Bearer ${env.CAMPAIGN_GATEWAY_TOKEN}`);
    assert.equal(options.headers['accept-encoding'], 'identity');
    assert.equal(options.redirect, 'error');
    return worker.fetch(new Request(url, options), { BUCKET: bucket, GATEWAY_TOKEN: 'a'.repeat(64), CAMPAIGN_GATEWAY_TOKEN: env.CAMPAIGN_GATEWAY_TOKEN });
  } });
  const bytes = Buffer.from('{"fixture":true}');
  const key = prefix + 'details/' + hash(bytes) + '.json';
  assert.equal(await store.readObject(key), null);
  await store.putObject(key, bytes, immutable);
  assert.deepEqual((await store.readObject(key)).bytes, bytes);
  await assert.rejects(store.putObject(key, bytes, immutable));
  const png = Buffer.from([137,80,78,71,13,10,26,10,1]);
  const pngKey = prefix + 'images/' + hash(png) + '.png';
  await store.putObject(pngKey, png, { ...immutable, contentType: 'image/png' });
  assert.equal(objects.get(pngKey).metadata.contentType, 'image/png');
  const manifest = prefix + 'manifest.json';
  const version = await store.putObject(manifest, bytes, mutable);
  await assert.rejects(store.putObject(manifest, bytes, { ...mutable, ifNoneMatch: undefined, ifMatch: '"wrong"' }));
  await store.putObject(manifest, bytes, { ...mutable, ifNoneMatch: undefined, ifMatch: version });
  assert.equal(await store.readBucketBytes(), bytes.length * 2 + png.length);
  store.close(); await assert.rejects(store.readObject(manifest), /campaign_gateway_request_failed/);
});

test('campaign client bounds and validates read responses without leaking transport errors', async () => {
  await assert.rejects(campaignGatewayStore(env, { fetchImpl: async () => new Response('x'.repeat(4097)) }).readObject(prefix + 'manifest.json'), /campaign_gateway_request_failed/);
  await assert.rejects(campaignGatewayStore(env, { fetchImpl: async () => { throw Error('private secret'); } }).readObject(prefix + 'manifest.json'), error => error.message === 'campaign_gateway_request_failed');
  await assert.rejects(campaignGatewayStore(env, { fetchImpl: async () => new Response('{}', { headers: { etag: 'W/"weak"' } }) }).readObject(prefix + 'manifest.json'));
  await assert.rejects(campaignGatewayStore(env, { fetchImpl: async () => new Response('{}', { headers: { etag: '"ok"' } }) }).readObject(prefix + 'index/' + 'a'.repeat(64) + '.json'));
});

test('campaign inventory is paginated, cycle-safe and deadline-bounded', async () => {
  let calls = 0;
  const store = campaignGatewayStore(env, { fetchImpl: async url => {
    assert.equal(url.pathname, '/campaign-inventory');
    calls++;
    return Response.json(calls === 1 ? { bytes: 10, truncated: true, cursor: 'next' } : { bytes: 20, truncated: false });
  } });
  assert.equal(await store.readBucketBytes(), 30);
  await assert.rejects(campaignGatewayStore(env, { fetchImpl: async () => Response.json({ bytes: 1, truncated: true, cursor: 'same' }) }).readBucketBytes());
  let instant = 0;
  await assert.rejects(campaignGatewayStore(env, { now: () => instant, fetchImpl: async () => {
    instant = 45000; return Response.json({ bytes: 1, truncated: false });
  } }).readBucketBytes());
});
