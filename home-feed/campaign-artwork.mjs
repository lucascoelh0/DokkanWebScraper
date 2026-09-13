import sharp from 'sharp';
import { createHash } from 'node:crypto';

/** Private input URL; never serialized into public campaign documents. */
export function campaignArtworkUrl(value) {
  if (typeof value !== 'string' || value.length > 8192 || /[\s\\#]/u.test(value)) throw Error('campaign_artwork_invalid');
  const url = new URL(value);
  if (!value.startsWith('https://cf.ishin-global.aktsk.com/') || url.username || url.password || url.port
      || !/^\/images\/en\/panel_mission\/[A-Za-z0-9_-]+\.png$/.test(url.pathname)) throw Error('campaign_artwork_invalid');
  return value;
}

export async function prepareCampaignArtwork(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 24 || bytes.length > 512 * 1024
      || !bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) throw Error('campaign_artwork_invalid');
  const image = sharp(bytes, { limitInputPixels: 4_000_000, failOn: 'warning' });
  const metadata = await image.metadata();
  if (metadata.format !== 'png' || metadata.pages > 1 || !metadata.width || !metadata.height
      || metadata.width > 4096 || metadata.height > 4096) throw Error('campaign_artwork_invalid');
  const output = await image.png().toBuffer();
  if (output.length > 512 * 1024) throw Error('campaign_artwork_invalid');
  const sha256 = createHash('sha256').update(output).digest('hex');
  return { bytes: output, descriptor: { sha256, sizeBytes: output.length,
    width: metadata.width, height: metadata.height } };
}
