import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const PREFIX = 'staging/v2/campaigns/';
const versionOk = value => typeof value === 'string' && /^"[^"\u0000-\u001f\u007f,]{1,254}"$/.test(value);
function policy(key) {
  assert(typeof key === 'string');
  if (key === PREFIX + 'manifest.json') return { limit: 4096, manifest: true, image: false };
  const match = /^staging\/v2\/campaigns\/(index|details|images)\/([a-f0-9]{64})\.(json|png)$/.exec(key);
  assert(match && (match[1] === 'images') === (match[3] === 'png'));
  return { limit: match[1] === 'index' ? 32768 : 524288, manifest: false, image: match[1] === 'images', hash: match[2] };
}

/** Dedicated capability; never falls back to HOME_GATEWAY_TOKEN or broad R2 credentials. */
export function campaignGatewayStore(env, { fetchImpl = fetch, now = Date.now } = {}) {
  const origin = new URL(env.CAMPAIGN_GATEWAY_URL);
  assert(origin.protocol === 'https:' && !origin.username && !origin.password && !origin.port);
  assert(origin.pathname === '/' && !origin.search && !origin.hash);
  assert(/^[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev$/.test(origin.hostname));
  let token = env.CAMPAIGN_GATEWAY_TOKEN;
  assert(typeof token === 'string' && /^[a-f0-9]{64}$/.test(token));
  async function request(path, options = {}, limit = 65536) {
    try {
      assert(token);
      const response = await fetchImpl(new URL(path, origin), {
        ...options, redirect: 'error', signal: AbortSignal.timeout(20000),
        headers: { ...options.headers, 'accept-encoding': 'identity', authorization: `Bearer ${token}` },
      });
      const reader = response.body?.getReader();
      const chunks = []; let total = 0;
      try {
        if (reader) while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          total += value.length; assert(total <= limit); chunks.push(Buffer.from(value));
        }
      } finally { await reader?.cancel(); }
      return { status: response.status, version: response.headers.get('etag'), bytes: Buffer.concat(chunks) };
    } catch { throw Error('campaign_gateway_request_failed'); }
  }
  return {
    close() { token = null; },
    async readBucketBytes() {
      const started = now(); const seen = new Set(); let cursor = '', total = 0;
      for (let page = 0; page < 1000; page++) {
        assert(now() >= started && now() - started < 45000);
        const response = await request('/campaign-inventory' + (cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''));
        assert(now() >= started && now() - started < 45000 && response.status === 200);
        const data = JSON.parse(response.bytes);
        assert(Number.isSafeInteger(data.bytes) && data.bytes >= 0 && typeof data.truncated === 'boolean');
        total += data.bytes; assert(Number.isSafeInteger(total));
        if (!data.truncated) return total;
        assert(typeof data.cursor === 'string' && Buffer.byteLength(data.cursor) > 0
          && Buffer.byteLength(data.cursor) <= 4096 && !seen.has(data.cursor));
        cursor = data.cursor; seen.add(cursor);
      }
      throw Error('campaign_inventory_limit');
    },
    async readObject(key) {
      const spec = policy(key);
      const result = await request(`/campaign-object?key=${encodeURIComponent(key)}`, {}, spec.limit);
      if (result.status === 404) return null;
      assert(result.status === 200 && versionOk(result.version) && result.bytes.length > 0);
      if (!spec.manifest) assert(createHash('sha256').update(result.bytes).digest('hex') === spec.hash);
      return { bytes: result.bytes, version: result.version };
    },
    async putObject(key, bytes, options) {
      const spec = policy(key);
      assert(Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= spec.limit);
      assert(options.contentType === (spec.image ? 'image/png' : 'application/json'));
      assert(options.cacheControl === (spec.manifest ? 'no-cache, no-transform' : 'public, max-age=31536000, immutable'));
      assert((options.ifNoneMatch === '*' && options.ifMatch === undefined)
        || (spec.manifest && versionOk(options.ifMatch) && options.ifNoneMatch === undefined));
      if (!spec.manifest) assert(createHash('sha256').update(bytes).digest('hex') === spec.hash);
      const headers = options.ifMatch ? { 'if-match': options.ifMatch } : { 'if-none-match': '*' };
      const result = await request(`/campaign-object?key=${encodeURIComponent(key)}`, { method: 'PUT', headers, body: bytes });
      assert(result.status === 200 && versionOk(result.version));
      return result.version;
    },
  };
}
