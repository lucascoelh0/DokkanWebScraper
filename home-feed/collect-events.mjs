import { createHash } from 'node:crypto';
import { createSession } from './auth-session.mjs';
import { projectEvents } from './project-events.mjs';
import { projectEventArtwork } from './project-event-artwork.mjs';
import { prepareEventSection } from './prepare-events.mjs';
import { prepareNewsArtwork } from './news-artwork.mjs';

const artworkSnapshots = new WeakMap();

/** Only artwork acquired by this collector, bound to the original schedule, can be delivered. */
export function prepareCollectedEventArtwork(collection, now) {
  const saved = artworkSnapshots.get(collection);
  if (!saved || JSON.stringify(prepareEventSection(collection, now)) !== saved.schedule) return null;
  return saved.images.map(image => ({ ...image, bytes: Buffer.from(image.bytes) }));
}

/** Internal trusted collector. Never accepts an externally supplied observation date/body. */
export async function collectEvents({ config, catalogBytes, catalogSha256, includePresentation = false }, { fetchImpl = fetch, now = Date.now } = {}) {
  let session, deadline;
  try {
    const started = now();
    if (!Number.isSafeInteger(started) || started < 1230768000000 || started >= 4102444800000) throw Error();
    // Snapshot and validate the independently pinned public catalog before login.
    if (!Buffer.isBuffer(catalogBytes) || catalogBytes.length > 16 * 1024 * 1024) throw Error();
    const catalog = Buffer.from(catalogBytes);
    const date = new Date(started).toISOString();
    projectEvents({ bodyBytes: Buffer.from('{"events":[],"z_battle_stages":[]}'),
      catalogBytes: catalog, catalogSha256, endpoint: '/events', status: 200, observedAt: date, now: date });
    session = createSession(config, { fetchImpl, apiScope: includePresentation === true ? 'events-media' : 'events' });
    deadline = setTimeout(() => session.close(), 60000);
    const response = await session.requestApi('/events');
    const completed = now();
    if (!Number.isSafeInteger(completed) || completed < started || completed - started >= 60000) throw Error();
    // Begin-time freshness is conservative: a slow response never extends the lease.
    const bodyBytes = Buffer.from(JSON.stringify(response.body));
    const result = projectEvents({ bodyBytes, catalogBytes: catalog, catalogSha256,
      endpoint: '/events', status: response.status, observedAt: date, now: new Date(completed).toISOString() });
    const collection = { status: 'collected', projection: result, receipt: {
      source: 'fresh-global-events-session', requestStartedAt: date,
      receivedAt: new Date(completed).toISOString(),
      normalizedBodySha256: createHash('sha256').update(bodyBytes).digest('hex'),
      catalogSha256,
    } };
    if (includePresentation === true) {
      const schedule = prepareEventSection(collection, completed);
      const images = [], byPath = new Map();
      let total = 0;
      const references = projectEventArtwork(response.body);
      for (const item of schedule?.items ?? []) {
        const ref = references.find(row => row.id === item.id);
        if (!ref) continue;
        const [kind, id] = item.id.split(':');
        const row = response.body[kind === 'event' ? 'events' : 'z_battle_stages'].find(row => String(row.id) === id);
        if (!row?.banner_image?.includes('?')) continue;
        try {
          let art = byPath.get(ref.imagePath);
          if (!art) {
            art = await prepareNewsArtwork(await session.fetchImage(row.banner_image));
            if (total + art.bytes.length > 8 * 1024 * 1024) break;
            total += art.bytes.length;
            byPath.set(ref.imagePath, art);
          }
          const tick = now();
          if (!Number.isSafeInteger(tick) || tick < completed || tick - started >= 60000) break;
          const key = `staging/v2/home/images/${art.descriptor.sha256}.png`;
          images.push({ id: item.id, key, sizeBytes: art.bytes.length, bytes: Buffer.from(art.bytes) });
        } catch { break; /* Keep the schedule and any successfully collected artwork. */ }
      }
      artworkSnapshots.set(collection, { schedule: JSON.stringify(schedule), images });
    }
    return collection;
  } catch {
    // Optional enrichment failure must not reveal response/config or erase summons.
    return { status: 'unavailable' };
  } finally {
    clearTimeout(deadline);
    session?.close();
  }
}
