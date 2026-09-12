import assert from 'node:assert/strict';
const allowed = key => /^staging\/v2\/home\/(?:manifest\.json|[a-f0-9]{64}\.json|images\/[a-f0-9]{64}\.png|runs\/[0-9]+\.json)$/.test(key);

export function gatewayStore(env, fetchImpl = fetch) {
  const origin = new URL(env.HOME_GATEWAY_URL);
  assert(origin.protocol === 'https:' && !origin.username && !origin.password);
  assert(origin.pathname === '/' && !origin.search && !origin.hash);
  assert(/^[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev$/.test(origin.hostname));
  let token = env.HOME_GATEWAY_TOKEN;
  assert(typeof token === 'string' && /^[a-f0-9]{64}$/.test(token));
  async function request(path, options = {}, limit = 65536) {
    assert(token);
    try {
      const response = await fetchImpl(new URL(path, origin), {
        ...options, redirect: 'error', signal: AbortSignal.timeout(20000),
        headers: { ...options.headers, authorization: `Bearer ${token}` },
      });
      const reader = response.body?.getReader();
      const chunks = []; let size = 0;
      try {
        if (reader) while (true) {
          const { done, value } = await reader.read(); if (done) break;
          size += value.length; assert(size <= limit); chunks.push(Buffer.from(value));
        }
      } finally { await reader?.cancel(); }
      return { status: response.status, etag: response.headers.get('etag'), bytes: Buffer.concat(chunks) };
    } catch { throw Error('gateway_request_failed'); }
  }
  return {
    close() { token = null; },
    async inventoryBytes() {
      let cursor = '', bytes = 0; const seen = new Set();
      for (let page = 0; page < 1000; page++) {
        const response = await request('/inventory' + (cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''));
        assert(response.status === 200);
        const data = JSON.parse(response.bytes);
        assert(Number.isSafeInteger(data.bytes) && data.bytes >= 0 && typeof data.truncated === 'boolean');
        bytes += data.bytes; assert(Number.isSafeInteger(bytes));
        if (!data.truncated) return bytes;
        assert(typeof data.cursor === 'string' && data.cursor.length > 0 && data.cursor.length <= 8192 && !seen.has(data.cursor));
        cursor = data.cursor; seen.add(cursor);
      }
      throw Error('inventory_limit');
    },
    async get(key) {
      assert(allowed(key));
      const result = await request(`/object?key=${encodeURIComponent(key)}`, {}, key.endsWith('.png') ? 2097152 : 65536);
      if (result.status === 404) return null;
      assert(result.status === 200 && result.etag);
      return { bytes: result.bytes, etag: result.etag };
    },
    async put(key, bytes, options) {
      assert(allowed(key) && Buffer.isBuffer(bytes));
      assert(bytes.length <= (key.endsWith('.png') ? 2097152 : key.includes('/runs/') ? 4096 : 65536));
      assert((options.ifNoneMatch === '*' && !options.ifMatch) || (typeof options.ifMatch === 'string' && options.ifMatch.length > 0 && !options.ifNoneMatch));
      const headers = options.ifMatch ? { 'if-match': options.ifMatch } : { 'if-none-match': '*' };
      const result = await request(`/object?key=${encodeURIComponent(key)}`, { method: 'PUT', headers, body: bytes });
      assert(result.status === 200 && result.etag);
      return result.etag;
    },
  };
}
