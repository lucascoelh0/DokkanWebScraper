import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';

const ORIGIN = 'https://assets.dkbcompanion.com/staging/v2/campaigns/';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const hashOk = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const idOk = value => Number.isSafeInteger(value) && value > 0 && value <= 999999999;

/** Public GET-only integrity audit, not an exhaustive replacement for Android parsers. */
export async function verifyPublicCampaigns({ fetchImpl = fetch, now = Date.now, requireV2 = false } = {}) {
  let phase = 'manifest', totalBytes = 0;
  const started = now();
  try {
    async function read(file, limit, descriptor) {
      assert(file === 'manifest.json' || /^(index|details)\/[a-f0-9]{64}\.json$/.test(file)
        || /^images\/[a-f0-9]{64}\.png$/.test(file));
      assert(now() - started < 120000);
      if (descriptor) assert(hashOk(descriptor.sha256) && Number.isSafeInteger(descriptor.sizeBytes)
        && descriptor.sizeBytes > 0 && descriptor.sizeBytes <= limit);
      const response = await fetchImpl(ORIGIN + file, { redirect: 'error', signal: AbortSignal.timeout(20000),
        headers: { 'accept-encoding': 'identity', 'cache-control': 'no-cache' } });
      assert(response.status === 200);
      const reader = response.body.getReader(), parts = []; let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read(); if (done) break;
          size += value.length; totalBytes += value.length;
          assert(size <= (descriptor?.sizeBytes ?? limit) && totalBytes <= 4 * 1024 * 1024 + 4096);
          parts.push(Buffer.from(value));
        }
      } finally { await reader.cancel(); }
      const bytes = Buffer.concat(parts); assert(bytes.length > 0);
      if (descriptor) assert(bytes.length === descriptor.sizeBytes && hash(bytes) === descriptor.sha256);
      return bytes;
    }
    const manifestBytes = await read('manifest.json',4096), manifest = JSON.parse(manifestBytes);
    assert(manifest.schemaVersion === 1 && manifest.contract === 'dokkan-campaign-manifest' && manifest.region === 'global');
    assert(hashOk(manifest.sha256) && manifest.file === `index/${manifest.sha256}.json`);
    phase = 'index';
    const index = JSON.parse(await read(manifest.file,32768,manifest));
    assert([1,2].includes(index.schemaVersion) && (!requireV2 || index.schemaVersion === 2));
    assert(index.contract === 'dokkan-campaign-index' && index.region === 'global' && hashOk(index.revisionSha256));
    const observed = Date.parse(index.observedAt), until = Date.parse(index.validUntil);
    assert(Number.isFinite(observed) && Number.isFinite(until) && observed <= now() && until > now() && until > observed);
    assert(Array.isArray(index.campaigns) && index.campaigns.length <= 100);
    const ids = new Set(), images = new Map(); let missions = 0, eventLinks = 0;
    for (const row of index.campaigns) {
      phase = 'detail';
      assert(idOk(row.id) && !ids.has(row.id)); ids.add(row.id);
      assert(row.destination?.type === 'campaign-detail' && row.destination.campaignId === row.id
        && row.destination.detailSha256 === row.detail?.sha256);
      const detail = JSON.parse(await read(`details/${row.detail.sha256}.json`,524288,row.detail));
      assert(detail.contract === 'dokkan-campaign-detail');
      for (const key of ['schemaVersion','region','source','coverage','contentSemantics','revisionSha256','observedAt','validUntil'])
        assert(detail[key] === index[key]);
      assert(detail.campaign?.id === row.id && detail.campaign.title === row.title
        && Array.isArray(detail.campaign.boards) && detail.campaign.boards.length === row.boardCount);
      assert.deepEqual(detail.campaign.artwork,row.artwork);
      assert(Array.isArray(detail.missions)); missions += detail.missions.length;
      for (const mission of detail.missions) {
        if (Object.hasOwn(mission,'destination')) assert(index.schemaVersion === 2);
        if (mission.destination != null) {
          assert(mission.destination.type === 'event-area' && idOk(mission.destination.areaId)); eventLinks++;
        }
      }
      if (row.artwork) {
        const art = row.artwork; assert(index.schemaVersion === 2 && hashOk(art.sha256));
        assert(Number.isSafeInteger(art.width) && Number.isSafeInteger(art.height)
          && art.width > 0 && art.height > 0 && art.width <= 4096 && art.height <= 4096 && art.width * art.height <= 4000000);
        if (images.has(art.sha256)) assert.deepEqual(images.get(art.sha256),art);
        else { images.set(art.sha256,art); assert(images.size <= 8); }
      }
    }
    phase = 'images';
    for (const art of images.values()) {
      const bytes = await read(`images/${art.sha256}.png`,524288,art);
      assert(bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')));
      const image = sharp(bytes,{limitInputPixels:4000000,failOn:'warning'}), meta = await image.metadata();
      assert(meta.format === 'png' && (meta.pages ?? 1) === 1 && meta.width === art.width && meta.height === art.height);
      await image.raw().toBuffer();
    }
    phase = 'stability';
    assert((await read('manifest.json',4096)).equals(manifestBytes));
    assert(now() < until && now() - started < 120000);
    return {status:'verified',schemaVersion:index.schemaVersion,manifestSha256:hash(manifestBytes),
      campaigns:ids.size,missions,eventLinks,images:images.size,observedAt:index.observedAt,validUntil:index.validUntil,totalBytes};
  } catch { return {status:'failed',phase}; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--require-v2')) { console.error('invalid_arguments'); process.exitCode = 1; }
  else { const result = await verifyPublicCampaigns({requireV2:args.includes('--require-v2')});
    console.log(JSON.stringify(result)); process.exitCode = result.status === 'verified' ? 0 : 1; }
}
