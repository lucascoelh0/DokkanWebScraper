import assert from 'node:assert/strict';
import { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
const BUCKET = 'dokkanpanion-data';
const keyAllowed = key => /^staging\/v2\/home\/(?:manifest\.json|[a-f0-9]{64}\.json|images\/[a-f0-9]{64}\.png|runs\/[0-9]+\.json)$/.test(key);

export function r2Store(env) {
  assert(/^[a-f0-9]{32}$/.test(env.HOME_R2_ACCOUNT_ID));
  assert(env.HOME_R2_ACCESS_KEY_ID && env.HOME_R2_SECRET_ACCESS_KEY);
  const client = new S3Client({ region: 'auto',
    endpoint: `https://${env.HOME_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    maxAttempts: 1, followRegionRedirects: false,
    requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED',
    credentials: { accessKeyId: env.HOME_R2_ACCESS_KEY_ID, secretAccessKey: env.HOME_R2_SECRET_ACCESS_KEY } });
  const send = command => client.send(command, { abortSignal: AbortSignal.timeout(20000) });
  return {
    close: () => client.destroy(),
    async inventoryBytes() {
      let token, bytes = 0;
      const seen = new Set();
      for (let page = 0; page < 1000; page++) {
        const result = await send(new ListObjectsV2Command({ Bucket: BUCKET, MaxKeys: 1000, ContinuationToken: token }));
        for (const row of result.Contents ?? []) {
          assert(Number.isSafeInteger(row.Size) && row.Size >= 0); bytes += row.Size;
        }
        if (!result.IsTruncated) return bytes;
        token = result.NextContinuationToken;
        assert(token && !seen.has(token)); seen.add(token);
      }
      throw Error('inventory_limit');
    },
    async get(key) {
      assert(keyAllowed(key));
      let result;
      try { result = await send(new GetObjectCommand({Bucket:BUCKET,Key:key})); }
      catch (e) { if (e?.name === 'NoSuchKey') return null; throw Error('r2_read_failed'); }
      const limit = key.endsWith('.png') ? 2097152 : 65536;
      assert(Number.isSafeInteger(result.ContentLength) && result.ContentLength <= limit && result.ETag);
      const chunks = []; let count = 0;
      try {
        for await (const chunk of result.Body) {
          count += chunk.length; assert(count <= limit); chunks.push(chunk);
        }
        assert(count === result.ContentLength);
        return {bytes:Buffer.concat(chunks),etag:result.ETag};
      } finally { result.Body?.destroy(); }
    },
    async put(key, bytes, options) {
      assert(keyAllowed(key) && Buffer.isBuffer(bytes));
      assert(bytes.length <= (key.endsWith('.png') ? 2097152 : 65536));
      assert((typeof options.ifMatch === 'string' && options.ifMatch.length > 0 && !options.ifNoneMatch)
        || (options.ifNoneMatch === '*' && !options.ifMatch));
      const result = await send(new PutObjectCommand({Bucket:BUCKET,Key:key,Body:bytes,
        IfMatch:options.ifMatch,IfNoneMatch:options.ifNoneMatch,
        ContentType:options.contentType,CacheControl:options.cacheControl}));
      assert(result.ETag); return result.ETag;
    },
  };
}

export async function publicRead(key, size) {
  assert(keyAllowed(key) && !key.includes('/runs/') && size <= 2097152);
  const response = await fetch('https://assets.dkbcompanion.com/' + key,
    {redirect:'error',signal:AbortSignal.timeout(20000),headers:{'accept-encoding':'identity','cache-control':'no-cache'}});
  assert(response.status === 200);
  const chunks=[];let count=0;
  const reader=response.body.getReader();
  try {
    while(true) {const {done,value}=await reader.read();if(done)break;
      count+=value.length;assert(count<=size);chunks.push(Buffer.from(value));}
    assert(count===size);return Buffer.concat(chunks);
  } finally { await reader.cancel(); }
}
