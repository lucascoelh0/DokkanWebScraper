import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { prepareEventSection } from './prepare-events.mjs';
import { prepareCollectedNews, collectedBannerEnd } from './collect-news.mjs';
import { prepareCollectedEventArtwork, prepareCollectedSharedArtwork } from './collect-events.mjs';
import { prepareArtworkIndex } from './event-artwork-index.mjs';

export const PREFIX = 'staging/v2/home/';
export const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const object = (key, bytes, contentType, mutable = false) => ({ key, bytes,
  sizeBytes: bytes.length, sha256: sha(bytes), contentType,
  cacheControl: mutable ? 'no-cache' : 'public,max-age=31536000,immutable' });

/** Consumes the complete collector observation, not arbitrary raw API objects. */
export async function prepareCandidate(observation, now = Date.now(), { enableEvents = false, eventCollection, enableNews = false, newsCollection, previousArtwork } = {}) {
  // Unreadable published graph is not an empty registry. Keep the previous release.
  assert(!enableEvents || previousArtwork !== null);
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
    const bannerEndsAt = enableNews === true ? collectedBannerEnd(newsCollection, b, now) : null;
    const availabilityEnd = bannerEndsAt ? Date.parse(bannerEndsAt) : b.end_at * 1000;
    if (b.open_at * 1000 > now || availabilityEnd <= now) continue;
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
    const description = b.discount && Date.parse(b.discount.endsAt) <= now
      ? b.description?.replace(/400 hours only!\s*Perform 3 Multi-Summons and get one FREE!\s*/giu, '').trim()
      : b.description;
    summons.push({ id: `gasha-${b.id}`, title: b.name, action: 'catalog',
      ...(bannerEndsAt ? { bannerEndsAt } : {}),
      imageUrl: 'https://assets.dkbcompanion.com/' + key,
      ...(b.discount?.kind === 'three-plus-one' &&
        b.discount.endsAt === new Date(b.end_at * 1000).toISOString() &&
        b.end_at - b.open_at + 1 === 400 * 3600 && b.end_at * 1000 > now
        ? { discount: { kind: 'three-plus-one', endsAt: b.discount.endsAt } } : {}),
      ...(typeof description === 'string' && description.length <= 1000 &&
        !/[<>\u0000-\u001f\u007f]/u.test(description) ? { description } : {}),
      ...(Array.isArray(b.rewards) && b.rewards.length <= 30 && b.rewards.every(r =>
        r.itemType === 'TreasureItem' && [r.courseNo, r.itemId, r.quantity].every(n => Number.isSafeInteger(n) && n > 0 && n <= 999999999))
        ? { rewards: b.rewards.map(r => ({ courseNo: r.courseNo, itemType: r.itemType, itemId: r.itemId, quantity: r.quantity })) } : {}),
      startsAt: new Date(b.open_at * 1000).toISOString(), endsAt: new Date(Math.min(validUntil, availabilityEnd)).toISOString(),
      group: b.gasha_category_id === 1 ? 'main' : 'more',
      featuredCardIds: rows.map(r => String(r.card_id)),
      category: ({ 1: 'featured', 2: 'dragon_stones', 3: 'tickets', 4: 'friend' })[b.gasha_category_id] ?? 'other' });
  }
  // Preserve server order within each grouping; no fixed IDs or title inference.
  summons.sort((a, b) => Number(b.group === 'main') - Number(a.group === 'main'));
  const content = { schemaVersion: 1, generatedAt,
    validUntil: new Date(validUntil).toISOString(), spotlight: summons.find(s => s.group === 'main') ?? null, summons };
  if (enableEvents && previousArtwork?.index) content.eventArtwork = previousArtwork.index;
  const eventSchedule = enableEvents === true ? prepareEventSection(eventCollection, now) : null;
  // Optional enrichment cannot push a healthy summons payload over the client cap.
  if (eventSchedule && Buffer.byteLength(JSON.stringify({ ...content, eventSchedule })) <= 65536)
    content.eventSchedule = eventSchedule;
  const news = enableNews === true ? prepareCollectedNews(newsCollection, now) : null;
  const newsImageSlots = news?.images.filter(image => !operations.some(op => op.key === image.key)).length ?? 0;
  const eventArt = content.eventSchedule ? prepareCollectedEventArtwork(eventCollection, now)
    ?.slice(0, Math.max(0, 40 - operations.length - newsImageSlots)) : null;
  if (eventArt?.length) {
    const enriched = { ...eventSchedule, items: eventSchedule.items.map(item => {
      const image = eventArt.find(image => image.id === item.id);
      return image ? { ...item, [image.header ? 'headerImageUrl' : 'imageUrl']: 'https://assets.dkbcompanion.com/' + image.key } : item;
    }) };
    const uniqueImages = [...new Map(eventArt.map(image => [image.key, image])).values()]
      .filter(image => !operations.some(op => op.key === image.key));
    if (operations.length + uniqueImages.length <= 40 &&
        Buffer.byteLength(JSON.stringify({ ...content, eventSchedule: enriched })) <= 65536 &&
        operations.reduce((sum, op) => sum + op.sizeBytes, 0) + uniqueImages.reduce((sum, image) => sum + image.sizeBytes, 0) <= 15 * 1024 * 1024) {
      content.eventSchedule = enriched;
      for (const image of uniqueImages) operations.push(object(image.key, image.bytes, 'image/png'));
    }
  }
  if (news && operations.length + news.images.filter(image => !operations.some(op => op.key === image.key)).length <= 40 &&
      Buffer.byteLength(JSON.stringify({ ...content, news: news.section })) <= 65536 &&
      operations.reduce((sum, op) => sum + op.sizeBytes, 0) + news.images.reduce((sum, image) => sum + image.sizeBytes, 0) <= 15 * 1024 * 1024) {
    content.news = news.section;
    for (const image of news.images) {
      if (!operations.some(op => op.key === image.key)) operations.push(object(image.key, image.bytes, 'image/png'));
    }
  }
  // Separate shared registry: availability/category never gates catalog/detail artwork.
  const sharedArt = enableEvents ? prepareCollectedSharedArtwork(eventCollection, now) : null;
  if (sharedArt && operations.length <= 40) {
    const items = sharedArt.items;
    const artOperations = [];
    let cursor = sharedArt.cursor, lastIncluded = previousArtwork?.index?.cursor;
    let budget = 15 * 1024 * 1024 - operations.reduce((sum,op) => sum + op.sizeBytes,0) - 8 * 65536;
    for (const image of sharedArt.images) {
      const exists = [...operations,...artOperations].some(op => op.key === image.key);
      if (!exists && (operations.length + artOperations.length >= 60 || image.sizeBytes > budget)) {
        cursor = lastIncluded;
        break; // Retry unpublished targets before advancing the durable scan cursor.
      }
      if (!exists) { artOperations.push(object(image.key,image.bytes,'image/png')); budget -= image.sizeBytes; }
      items[image.targetKey] = [image.sha256,image.checkedAt];
      lastIncluded = image.targetKey;
    }
    const prepared = prepareArtworkIndex(sharedArt.catalogSha256,items,now,cursor);
    if (Buffer.byteLength(JSON.stringify({...content,eventArtwork:prepared.index})) <= 65536) {
      content.eventArtwork = prepared.index;
      operations.push(...artOperations,...prepared.operations);
    }
  }
  const payload = Buffer.from(JSON.stringify(content));
  assert(payload.length <= 65536);
  const hash = sha(payload);
  const manifest = Buffer.from(JSON.stringify({ schemaVersion: 1, file: hash + '.json', sizeBytes: payload.length, sha256: hash }));
  operations.push(object(PREFIX + hash + '.json', payload, 'application/json'));
  operations.push(object(PREFIX + 'manifest.json', manifest, 'application/json', true));
  assert(operations.reduce((n, o) => n + o.sizeBytes, 0) <= 16 * 1024 * 1024);
  // Operational metadata only: never copy collector diagnostics or raw responses.
  // Prepared is not published; the coordinator's verified receipt owns that claim.
  const summary = {
    summonsCount: summons.length,
    newsStatus: enableNews !== true ? 'disabled' : content.news ? 'included' : 'unavailable',
    newsCount: content.news?.items.length ?? 0,
    eventsStatus: enableEvents !== true ? 'disabled'
      : content.eventSchedule ? (content.eventSchedule.items.length ? 'included' : 'empty')
      : eventCollection?.status === 'collected' ? 'omitted' : 'unavailable',
    eventsCount: content.eventSchedule?.items.length ?? 0,
    eventsValidUntil: content.eventSchedule?.validUntil ?? null,
    eventsCatalogSha256: content.eventSchedule?.catalogSha256 ?? null,
    payloadBytes: payload.length,
    payloadSha256: hash,
  };
  return { validUntil, operations, manifestSha256: sha(manifest), summary };
}
