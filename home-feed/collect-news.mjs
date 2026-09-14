import { createHash } from 'node:crypto';
import { createSession } from './auth-session.mjs';
import { projectAnnouncements, projectAnnouncementBody } from './project-announcements.mjs';
import { prepareNewsArtwork } from './news-artwork.mjs';
import { projectSummonPeriod } from './project-summon-period.mjs';
const collected = new WeakMap();

/** Optional read-only metadata collection. Asset delivery and publication are separate. */
export async function collectNews({ config, includePresentation = false, banners = [] }, { fetchImpl = globalThis.fetch, now = Date.now } = {}) {
  let session;
  let deadline;
  try {
    const started = now();
    if (typeof includePresentation !== 'boolean') throw Error();
    if (!Number.isSafeInteger(started) || started < 1230768000000 || started >= 4102444800000) throw Error();
    session = createSession(config, { fetchImpl, apiScope: includePresentation ? 'news-media' : 'news' });
    deadline = setTimeout(() => session?.close(), 60000);
    const response = await session.requestApi('/announcements');
    const completed = now();
    if (response.status !== 200 || !Number.isSafeInteger(completed) || completed < started || completed - started >= 60000) throw Error();
    const projection = projectAnnouncements(response.body);
    const artwork = new Map();
    const periods = new Map();
    if (includePresentation) {
      const byId = new Map(response.body.announcements.map(row => [row.id, row]));
      const details = new Map();
      const detailFor = async id => {
        if (!details.has(id)) details.set(id, await session.requestApi(`/announcements/${id}`));
        return details.get(id);
      };
      if (!Array.isArray(banners) || banners.length > 40) throw Error();
      const eligible = banners.filter(b => b.gasha_category_id === 1 && byId.has(b.information_announcement_id));
      if (new Set(eligible.map(b => b.information_announcement_id)).size <= 8) {
        for (const banner of eligible) {
          const detail = await detailFor(banner.information_announcement_id);
          const endsAt = projectSummonPeriod(detail.body, banner);
          if (endsAt) periods.set(banner.id, { start: banner.open_at, announcementId: banner.information_announcement_id, endsAt });
        }
      }
      const cache = new Map();
      let totalBytes = 0;
      projection.announcements = projection.announcements.filter(row => row.startsAt * 1000 <= started).slice(0, 6);
      for (const row of projection.announcements) {
        const detail = await detailFor(row.id);
        if (detail.status !== 200) throw Error();
        // A native reader cannot interpret every game markup variant. Retain
        // verified index metadata/art rather than losing all announcements.
        try { row.paragraphs = projectAnnouncementBody(detail.body, row.id); }
        catch { row.paragraphs = []; }
        const afterDetail = now();
        if (!Number.isSafeInteger(afterDetail) || afterDetail < started || afterDetail - started >= 60000) throw Error();
        if (!row.image) continue;
        const identity = row.image.path;
        if (!cache.has(identity)) {
          const prepared = await prepareNewsArtwork(await session.fetchImage(byId.get(row.id).banner));
          totalBytes += prepared.bytes.length;
          if (totalBytes > 8 * 1024 * 1024) throw Error();
          cache.set(identity, prepared);
        }
        artwork.set(row.id, cache.get(identity));
        const instant = now();
        if (!Number.isSafeInteger(instant) || instant < started || instant - started >= 60000) throw Error();
      }
    }
    const result = { status: 'collected', projection, ...(includePresentation ? { artwork } : {}), receipt: {
      source: 'fresh-global-announcements-session',
      requestStartedAt: new Date(started).toISOString(),
      receivedAt: new Date(completed).toISOString(),
      publicProjectionSha256: createHash('sha256').update(JSON.stringify(projection)).digest('hex'),
    }, publicationAllowed: false };
    if (includePresentation) collected.set(result, {
      projection: structuredClone(projection), observedAt: started,
      periods,
      artwork: new Map([...artwork].map(([id, value]) => [id, { bytes: Buffer.from(value.bytes), descriptor: { ...value.descriptor } }])),
    });
    return result;
  } catch {
    return { status: 'unavailable' };
  } finally {
    clearTimeout(deadline);
    session?.close();
  }
}

export function collectedBannerEnd(collection, banner, now = Date.now()) {
  const stored = collected.get(collection);
  if (!stored || !Number.isSafeInteger(now) || now < stored.observedAt || now >= stored.observedAt + 21600000) return null;
  const period = stored.periods.get(banner.id);
  return period?.start === banner.open_at && period.announcementId === banner.information_announcement_id ? period.endsAt : null;
}

/** Public candidate bound to a successful in-process collection, not caller edits. */
export function prepareCollectedNews(collection, now = Date.now()) {
  const stored = collected.get(collection);
  if (!stored || !Number.isSafeInteger(now) || now < stored.observedAt || now >= stored.observedAt + 21600000) return null;
  const images = new Map();
  const items = stored.projection.announcements.map(row => {
    const art = stored.artwork.get(row.id);
    let imageUrl = null;
    if (art) {
      const key = `staging/v2/home/images/${art.descriptor.sha256}.png`;
      imageUrl = `https://assets.dkbcompanion.com/${key}`;
      images.set(key, { key, bytes: Buffer.from(art.bytes), ...art.descriptor, contentType: 'image/png',
        cacheControl: 'public,max-age=31536000,immutable' });
    }
    return { id: String(row.id), title: row.title, summary: row.summary, category: row.category,
      ...(row.tabId == null ? {} : { tabId: row.tabId }),
      publishedAt: new Date(row.startsAt * 1000).toISOString(), imageUrl, paragraphs: [...row.paragraphs] };
  });
  const section = { schemaVersion: 1, coverage: 'partial', observedAt: new Date(stored.observedAt).toISOString(),
    validUntil: new Date(stored.observedAt + 21600000).toISOString(), items };
  if (Buffer.byteLength(JSON.stringify(section)) > 48000) return null;
  return { section, images: [...images.values()] };
}
