import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { prepareEventSection } from './prepare-events.mjs';

export const PREFIX = 'staging/v2/home/';
export const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const object = (key, bytes, contentType, mutable = false) => ({ key, bytes,
  sizeBytes: bytes.length, sha256: sha(bytes), contentType,
  cacheControl: mutable ? 'no-cache' : 'public,max-age=31536000,immutable' });

/** Consumes the complete collector observation, not arbitrary raw API objects. */
export async function prepareCandidate(observation, now = Date.now(), { enableEvents = false, eventCollection } = {}) {
  const { snapshot, receipts, images, featuredResponses } = observation;
  const observed = Date.parse(snapshot.observedAt);
  assert(Number.isSafeInteger(now) && Number.isFinite(observed));
  assert(observed <= now && now - observed < 86_400_000);
  assert(snapshot.source === 'authorized_manual_global_gashas_read');
  assert(Array.isArray(snapshot.banners) && snapshot.banners.length <= 40);
  assert(new Set(snapshot.banners.map(b => b.id)).size === snapshot.banners.length);
  assert(receipts.length === snapshot.banners.length && featuredResponses.length === receipts.length);
  assert(new Set(receipts.map(r => r.bannerId)).size === receipts.length);
  assert(new Set(featuredResponses.map(r => r.path)).size === featuredResponses.length);
  const validUntil = observed + 86_400_000;
  const generatedAt = new Date(now).toISOString();
  const operations = [], summons = [];
  for (const b of snapshot.banners) {
    assert(Number.isSafeInteger(b.id) && b.id > 0 && b.id <= 999999999);
    assert(typeof b.name === 'string' && b.name.trim().length && b.name.length <= 100);
    assert(!/[\u0000-\u001f\u007f-\u009f]/.test(b.name));
    assert(Number.isSafeInteger(b.open_at) && Number.isSafeInteger(b.end_at));
    assert(b.open_at >= 0 && b.end_at > b.open_at);
    if (b.open_at * 1000 > now || b.end_at * 1000 <= now) continue;
    assert(b.imageHost === 'cf.ishin-global.aktsk.com');
    assert(/^\/banners\/en\/gashasocool\/[A-Za-z0-9_-]+\.png$/.test(b.imagePath));
    const receipt = receipts.find(r => r.bannerId === b.id);
    assert(receipt && receipt.sourcePath === b.imagePath && /^[a-f0-9]{64}$/.test(receipt.sha256));
    const name = receipt.sha256 + '.png', bytes = images.get(name);
    assert(Buffer.isBuffer(bytes) && bytes.length > 24 && bytes.length <= 2097152);
    assert(sha(bytes) === receipt.sha256 && bytes.length === receipt.sizeBytes);
    const key = PREFIX + 'images/' + name;
    if (!operations.some(o => o.key === key)) {
      // Decode the entire image with bounded dimensions; do not republish transformed art.
      const image = sharp(bytes, { limitInputPixels: 16_000_000, failOn: 'warning' });
      const metadata = await image.metadata();
      assert(metadata.format === 'png' && !metadata.isProgressive);
      assert(!metadata.pages || metadata.pages === 1);
      assert(metadata.width === receipt.width && metadata.height === receipt.height);
      assert(metadata.width <= 8192 && metadata.height <= 8192);
      await image.raw().toBuffer();
      operations.push(object(key, Buffer.from(bytes), 'image/png'));
    }
    const featured = featuredResponses.find(r => r.path === `/gashas/${b.id}/featured_cards`);
    assert(featured?.status === 200 && featured.error === null);
    const at = Date.parse(featured.observedAt);
    assert(at <= now && now - at < 86_400_000);
    const rows = featured.publicIds?.gasha_items;
    assert(Array.isArray(rows) && rows.length <= 100);
    assert(rows.every(r => Number.isSafeInteger(r.card_id) && r.card_id > 0 && r.card_id <= 999999999));
    assert(new Set(rows.map(r => r.card_id)).size === rows.length);
    summons.push({ id: `gasha-${b.id}`, title: b.name, action: 'catalog',
      imageUrl: 'https://assets.dkbcompanion.com/' + key,
      startsAt: generatedAt, endsAt: new Date(Math.min(validUntil, b.end_at * 1000)).toISOString(),
      group: b.gasha_category_id === 1 ? 'main' : 'more',
      featuredCardIds: rows.map(r => String(r.card_id)),
      category: ({ 1: 'featured', 2: 'dragon_stones', 3: 'tickets', 4: 'friend' })[b.gasha_category_id] ?? 'other' });
  }
  // Preserve server order within each grouping; no fixed IDs or title inference.
  summons.sort((a, b) => Number(b.group === 'main') - Number(a.group === 'main'));
  const content = { schemaVersion: 1, generatedAt,
    validUntil: new Date(validUntil).toISOString(), spotlight: summons.find(s => s.group === 'main') ?? null, summons };
  const eventSchedule = enableEvents === true ? prepareEventSection(eventCollection, now) : null;
  // Optional enrichment cannot push a healthy summons payload over the client cap.
  if (eventSchedule && Buffer.byteLength(JSON.stringify({ ...content, eventSchedule })) <= 65536)
    content.eventSchedule = eventSchedule;
  const payload = Buffer.from(JSON.stringify(content));
  assert(payload.length <= 65536);
  const hash = sha(payload);
  const manifest = Buffer.from(JSON.stringify({ schemaVersion: 1, file: hash + '.json', sizeBytes: payload.length, sha256: hash }));
  operations.push(object(PREFIX + hash + '.json', payload, 'application/json'));
  operations.push(object(PREFIX + 'manifest.json', manifest, 'application/json', true));
  assert(operations.reduce((n, o) => n + o.sizeBytes, 0) <= 16 * 1024 * 1024);
  return { validUntil, operations, manifestSha256: sha(manifest) };
}
