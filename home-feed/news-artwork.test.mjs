import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { prepareNewsArtwork } from './news-artwork.mjs';
test('decodes PNG and binds delivered bytes to hash and dimensions', async () => {
  const bytes = await sharp({ create: { width: 20, height: 10, channels: 4, background: '#ff8800' } }).png().toBuffer();
  const result = await prepareNewsArtwork(bytes);
  assert.equal(result.descriptor.width, 20);
  assert.equal(result.descriptor.height, 10);
  assert.equal(result.descriptor.sizeBytes, result.bytes.length);
  assert.equal(result.descriptor.sha256, createHash('sha256').update(result.bytes).digest('hex'));
});
test('rejects invalid, truncated and oversized images', async () => {
  for (const bytes of [Buffer.from('not a PNG'), Buffer.alloc(2 * 1024 * 1024 + 1),
    Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.alloc(30)])]) {
    await assert.rejects(() => prepareNewsArtwork(bytes));
  }
});
