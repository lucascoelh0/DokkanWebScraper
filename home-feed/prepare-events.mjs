import { isHomeHighlight } from './event-highlights.mjs';
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const hash = v => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
function instant(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v)) throw Error();
  const ms = Date.parse(v);
  if (!Number.isFinite(ms) || new Date(ms).toISOString() !== v) throw Error();
  return ms;
}

/** Explicit internal-to-public boundary for collectEvents output. The raw projection
 * remains non-publishable; only this whitelisted section may enter a candidate when
 * the separate enableEvents gate is true. Invalid enrichment never erases summons. */
export function prepareEventSection(collection, now) {
  try {
    if (!Number.isSafeInteger(now) || collection?.status !== 'collected') return null;
    const { projection: p, receipt: r } = collection;
    if (!object(p) || !object(r) || p.schemaVersion !== 2 || p.publicationAllowed !== false
        || p.mode !== 'offline-experiment' || p.authority !== 'partial-global-account-observation'
        || p.timestampSemantics !== 'absolute-window-intersection'
        || r.source !== 'fresh-global-events-session' || !hash(p.catalogSha256)
        || !hash(p.observationSha256) || p.catalogSha256 !== r.catalogSha256
        || p.observationSha256 !== r.normalizedBodySha256 || p.observedAt !== r.requestStartedAt) return null;
    if (p.burstObservationSha256 != null && (!hash(p.burstObservationSha256)
        || p.burstObservationSha256 !== r.burstBodySha256)) return null;
    const start = instant(p.observedAt), received = instant(r.receivedAt), expiry = instant(p.validUntil);
    if (received < start || received - start >= 60000 || now < received || now >= expiry
        || expiry !== start + 21600000 || !Array.isArray(p.candidates) || p.candidates.length > 2000) return null;
    const items = [], seen = new Set();
    for (const c of p.candidates) {
      if (!object(c) || typeof c.id !== 'string' || !/^(event|z-battle):[1-9][0-9]{0,8}$/.test(c.id)
          || seen.has(c.id) || !object(c.target) || !['event-area','z-battle'].includes(c.target.kind)
          || typeof c.target.id !== 'string' || !/^[1-9][0-9]{0,8}$/.test(c.target.id)
          || c.id.startsWith('event:') !== (c.target.kind === 'event-area')) return null;
      seen.add(c.id);
      const a = c.availability;
      if (!object(a) || !['overall-period','observed-weekday-window','observed-burst-window'].includes(a.basis)) return null;
      const from = instant(a.availableFrom), until = instant(a.availableUntil), valid = instant(a.validUntil);
      const deadline = a.eventEndsAt === null ? null : instant(a.eventEndsAt);
      const eventStart = a.eventStartsAt == null ? null : instant(a.eventStartsAt);
      if (eventStart !== null && eventStart > from) return null;
      if (from > start || until <= start || valid !== Math.min(expiry, until)
          || (deadline !== null && (deadline < until || deadline <= start))) return null;
      if (now >= valid) continue;
      const category = c.category;
      if (category != null && !['challenge','bonus','limited','growth','story','db-story','quests','z-battles','unknown'].includes(category)) return null;
      let burstMode = null;
      if (c.burstMode != null) {
        const b = c.burstMode;
        if (!hash(p.burstObservationSha256) || !object(b) || c.target.kind !== 'event-area'
            || typeof b.id !== 'string' || !/^[1-9][0-9]{0,8}$/.test(b.id)
            || typeof b.scheduleId !== 'string' || !/^[1-9][0-9]{0,8}$/.test(b.scheduleId)) return null;
        const bs = instant(b.startsAt), be = instant(b.endsAt), bv = instant(b.validUntil);
        if (bs > start || be <= bs || be-bs > 366*86400000 || bv > Math.min(be,expiry) || bv <= start) return null;
        if (now < bv) burstMode = { id:b.id, scheduleId:b.scheduleId, startsAt:b.startsAt, endsAt:b.endsAt, validUntil:b.validUntil };
      }
      if (!isHomeHighlight(category, burstMode)) continue;
      if (a.basis === 'observed-burst-window' && (!burstMode || a.availableFrom !== burstMode.startsAt
          || a.availableUntil !== burstMode.validUntil || a.eventEndsAt !== null)) continue;
      items.push({ id: c.id, target: { kind: c.target.kind, id: c.target.id },
        availableFrom: a.availableFrom, availableUntil: a.availableUntil,
        eventEndsAt: a.eventEndsAt, validUntil: a.validUntil,
        ...(eventStart === null ? {} : { eventStartsAt: a.eventStartsAt }),
        ...(category == null ? {} : { category }), ...(burstMode ? { burstMode } : {}) });
    }
    items.sort((a,b) => Number(b.burstMode != null)-Number(a.burstMode != null)
      || (b.burstMode?.startsAt ?? b.eventStartsAt ?? '').localeCompare(a.burstMode?.startsAt ?? a.eventStartsAt ?? '')
      || Number(a.eventEndsAt === null) - Number(b.eventEndsAt === null)
      || (a.eventEndsAt ?? '').localeCompare(b.eventEndsAt ?? '') || a.id.localeCompare(b.id));
    const targets = new Set();
    const unique = items.filter(item => {
      const key = `${item.target.kind}:${item.target.id}`;
      if (targets.has(key)) return false;
      targets.add(key); return true;
    });
    const section = { schemaVersion: 1, observedAt: p.observedAt, validUntil: p.validUntil,
      catalogSha256: p.catalogSha256, coverage: 'partial', items: unique.slice(0,20) };
    return Buffer.byteLength(JSON.stringify(section)) <= 16384 ? section : null;
  } catch { return null; }
}
