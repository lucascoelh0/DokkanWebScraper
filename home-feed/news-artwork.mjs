import sharp from 'sharp';
import { createHash } from 'node:crypto';

/** Fully decode official PNGs, strip metadata, and bind immutable bytes. */
export async function prepareNewsArtwork(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 24 || bytes.length > 2 * 1024 * 1024 ||
      !bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) throw Error('news_artwork_invalid');
  const image = sharp(bytes, { limitInputPixels: 4_000_000, failOn: 'warning' });
  const metadata = await image.metadata();
  if (metadata.format !== 'png' || metadata.pages > 1 || !metadata.width || !metadata.height ||
      metadata.width > 4096 || metadata.height > 4096) throw Error('news_artwork_invalid');
  const output = await image.png().toBuffer();
  if (output.length > 2 * 1024 * 1024) throw Error('news_artwork_invalid');
  return { bytes: output, descriptor: {
    sha256: createHash('sha256').update(output).digest('hex'), sizeBytes: output.length,
    width: metadata.width, height: metadata.height,
  } };
}
