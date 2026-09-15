import { createHash } from 'node:crypto';
import { createSession } from './auth-session.mjs';
import { projectEvents } from './project-events.mjs';
import { projectEventArtwork } from './project-event-artwork.mjs';
import { prepareEventSection } from './prepare-events.mjs';
import { prepareNewsArtwork } from './news-artwork.mjs';
import { validateArtworkItems } from './event-artwork-index.mjs';

const artworkSnapshots = new WeakMap();
const sharedArtworkSnapshots = new WeakMap();

export function prepareCollectedSharedArtwork(collection, now) {
  const saved = sharedArtworkSnapshots.get(collection);
  if (!saved || saved.binding !== JSON.stringify(collection) || now < saved.observed || now >= saved.observed + 6 * 3600000) return null;
  return {catalogSha256:saved.catalogSha256,items:structuredClone(saved.items),cursor:saved.cursor,
    images:saved.images.map(image => ({...image,bytes:Buffer.from(image.bytes)}))};
}

/** Only artwork acquired by this collector, bound to the original schedule, can be delivered. */
export function prepareCollectedEventArtwork(collection, now) {
  const saved = artworkSnapshots.get(collection);
  if (!saved || JSON.stringify(prepareEventSection(collection, now)) !== saved.schedule) return null;
  return saved.images.map(image => ({ ...image, bytes: Buffer.from(image.bytes) }));
}

/** Internal trusted collector. Never accepts an externally supplied observation date/body. */
export async function collectEvents({ config, catalogBytes, catalogSha256, includePresentation = false, includeBurst = false, previousArtwork }, { fetchImpl = fetch, now = Date.now } = {}) {
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
    session = createSession(config, { fetchImpl, apiScope: includePresentation === true || includeBurst === true ? 'events-media' : 'events' });
    deadline = setTimeout(() => session.close(), 60000);
    const response = await session.requestApi('/events');
    let burstBodyBytes;
    const completed = now();
    if (!Number.isSafeInteger(completed) || completed < started || completed - started >= 60000) throw Error();
    // Begin-time freshness is conservative: a slow response never extends the lease.
    const bodyBytes = Buffer.from(JSON.stringify(response.body));
    const result = projectEvents({ bodyBytes, catalogBytes: catalog, catalogSha256,
      endpoint: '/events', status: response.status, observedAt: date, now: new Date(completed).toISOString(), burstBodyBytes });
    const collection = { status: 'collected', projection: result, receipt: {
      source: 'fresh-global-events-session', requestStartedAt: date,
      receivedAt: new Date(completed).toISOString(),
      normalizedBodySha256: createHash('sha256').update(bodyBytes).digest('hex'),
      catalogSha256,
      ...(burstBodyBytes ? { burstBodySha256: createHash('sha256').update(burstBodyBytes).digest('hex') } : {}),
    } };
    if (includePresentation === true) {
      const schedule = prepareEventSection(collection, completed);
      const images = [], byPath = new Map();
      let total = 0;
      const references = projectEventArtwork(response.body);
      const shared = previousArtwork !== null && references.some(ref => ref.sourceField === 'listbutton_image');
      const prior = shared && previousArtwork?.catalogSha256 === catalogSha256
        ? validateArtworkItems(previousArtwork.items, started) : {};
      const targets = shared ? result.artworkTargets.filter(item => references.some(ref => ref.id === item.id && ref.sourceField === 'listbutton_image')) : schedule?.items ?? [];
      const targetKey = item => `${item.target.kind}:${item.target.id}`;
      const highlighted = new Set(schedule?.items.map(item => item.id));
      if (shared) targets.sort((a,b) => (prior[targetKey(a)]?.[1] ?? 0) - (prior[targetKey(b)]?.[1] ?? 0)
        || Number(highlighted.has(b.id)) - Number(highlighted.has(a.id)) || a.id.localeCompare(b.id));
      let cursor = previousArtwork?.index?.cursor;
      if (shared && cursor) {
        // Stable cyclic order prevents a single unavailable CDN object starving all later art.
        targets.sort((a,b) => targetKey(a).localeCompare(targetKey(b)));
        let after = targets.findIndex(item => targetKey(item).localeCompare(cursor) > 0);
        if (after < 0) after = 0;
        targets.push(...targets.splice(0,after));
      }
      const uniqueTargets = new Set();
      for (const item of targets) {
        if (shared && uniqueTargets.has(targetKey(item))) continue;
        if (uniqueTargets.size >= 20) break;
        uniqueTargets.add(shared ? targetKey(item) : item.id);
        if (shared) cursor = targetKey(item);
        const ref = references.find(row => row.id === item.id);
        if (!ref) continue;
        const [kind, id] = item.id.split(':');
        const row = response.body[kind === 'event' ? 'events' : 'z_battle_stages'].find(row => String(row.id) === id);
        const imageSource = row?.[ref.sourceField ?? 'banner_image'];
        if (!imageSource?.includes('?')) continue;
        try {
          let art = byPath.get(ref.imagePath);
          if (!art) {
            art = await prepareNewsArtwork(await session.fetchImage(imageSource));
            if (shared && (art.descriptor.width / art.descriptor.height < 3 || art.descriptor.width / art.descriptor.height > 6)) continue;
            if (total + art.bytes.length > 8 * 1024 * 1024) break;
            total += art.bytes.length;
            byPath.set(ref.imagePath, art);
          }
          const tick = now();
          if (!Number.isSafeInteger(tick) || tick < completed || tick - started >= 60000) break;
          const key = `staging/v2/home/images/${art.descriptor.sha256}.png`;
          images.push({ id: item.id, key, header: ref.sourceField === 'event_image',
            ...(shared ? {targetKey:targetKey(item),checkedAt:Math.floor(started/1000),sha256:art.descriptor.sha256} : {}),
            sizeBytes: art.bytes.length, bytes: Buffer.from(art.bytes) });
        } catch { break; /* Keep the schedule and any successfully collected artwork. */ }
      }
      if (shared) sharedArtworkSnapshots.set(collection, {binding:JSON.stringify(collection), observed:started,catalogSha256,items:prior,images,cursor});
      else artworkSnapshots.set(collection, { schedule: JSON.stringify(schedule), images });
    }
    // Optional login-resource failure must not suppress independently collected CDN art.
    if (includeBurst === true && now() - started < 60000) {
      try {
        const burst = await session.requestApi('/resources/login?genkai_battles=true');
        burstBodyBytes = Buffer.from(JSON.stringify({genkai_battles:burst.body.genkai_battles}));
        const received = now();
        if (!Number.isSafeInteger(received) || received < completed || received - started >= 60000) throw Error();
        const projection = projectEvents({bodyBytes,catalogBytes:catalog,catalogSha256,
          endpoint:'/events',status:response.status,observedAt:date,now:new Date(received).toISOString(),burstBodyBytes});
        collection.projection = projection;
        collection.receipt.burstBodySha256 = createHash('sha256').update(burstBodyBytes).digest('hex');
        collection.receipt.receivedAt = new Date(received).toISOString();
        const shared = sharedArtworkSnapshots.get(collection);
        if (shared) shared.binding = JSON.stringify(collection);
        const legacy = artworkSnapshots.get(collection);
        if (legacy) legacy.schedule = JSON.stringify(prepareEventSection(collection,received));
      } catch { /* Keep base events and already verified artwork. No retry. */ }
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
