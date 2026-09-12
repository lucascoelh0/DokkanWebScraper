import { createHash } from 'node:crypto';

const fail = () => { throw new Error('Invalid local event observation'); };
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const id = v => Number.isSafeInteger(v) && v > 0 && v <= 999999999;
const stringId = v => typeof v === 'string' && /^[1-9][0-9]{0,8}$/.test(v);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
function parse(bytes, limit) {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0 || bytes.length > limit) fail();
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}
function instant(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)) fail();
  const ms = Date.parse(value);
  if (!Number.isFinite(ms) || new Date(ms).toISOString() !== value) fail();
  return ms;
}
function period(row) {
  // Experimental seconds-only interpretation; reject open-ended/sentinel windows.
  const { start_at: start, end_at: end } = row;
  if (![start, end].every(v => Number.isSafeInteger(v) && v >= 1420070400 && v < 4102444800)
      || end <= start || end - start > 366 * 86400) return null;
  return { startsAt: new Date(start * 1000).toISOString(), endsAt: new Date(end * 1000).toISOString() };
}

/** Offline-only experiment. Not imported by collector, publisher or Android. */
export function projectEvents(input) {
  try {
    return project(input);
  } catch {
    // Never expose parser errors, source bodies, titles or account values.
    fail();
  }
}

function project({ bodyBytes, status, endpoint, observedAt, now, catalogBytes, catalogSha256 }) {
  if (status !== 200 || endpoint !== '/events') fail();
  const observed = instant(observedAt), current = instant(now);
  if (current < observed || current - observed >= 6 * 3600000) fail();
  if (typeof catalogSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(catalogSha256)) fail();
  const body = parse(bodyBytes, 4 * 1024 * 1024);
  const catalog = parse(catalogBytes, 16 * 1024 * 1024);
  if (digest(catalogBytes) !== catalogSha256 || !object(catalog)
      || catalog.schemaVersion !== 1 || catalog.contract !== 'dokkan-stage-delivery'
      || catalog.source !== 'dokkan-game-db' || !Array.isArray(catalog.entries)
      || catalog.entries.length > 20000) fail();
  if (!object(body) || !Array.isArray(body.events) || !Array.isArray(body.z_battle_stages)
      || body.events.length > 1000 || body.z_battle_stages.length > 1000) fail();
  const quests = new Map(), zBattles = new Set(), keys = new Set();
  for (const row of catalog.entries) {
    if (!object(row) || !stringId(row.id) || !['quest-level', 'z-battle'].includes(row.kind)) fail();
    const key = `${row.kind}:${row.id}`;
    if (keys.has(key)) fail();
    keys.add(key);
    if (row.kind === 'z-battle') zBattles.add(row.id);
    else {
      if (!stringId(row.questId) || !stringId(row.areaId)) fail();
      const areas = quests.get(row.questId) ?? new Set();
      areas.add(row.areaId); quests.set(row.questId, areas);
    }
  }
  const candidates = [], seen = new Set();
  const excluded = { invalidPeriod: 0, recurrenceUnproved: 0, unresolvedTarget: 0, superZBattleDeferred: 0 };
  for (const [kind, rows] of [['event', body.events], ['z-battle', body.z_battle_stages]]) {
    for (const row of rows) {
      if (!object(row) || !id(row.id)) fail();
      const key = `${kind}:${row.id}`;
      if (seen.has(key)) fail();
      seen.add(key);
      if (kind === 'z-battle' && row.super_z_battle_stage != null) excluded.superZBattleDeferred++;
      const window = period(row);
      if (!window) { excluded.invalidPeriod++; continue; }
      if ((kind === 'event' && !Array.isArray(row.wday))
          || (row.wday != null && (!Array.isArray(row.wday) || row.wday.length !== 0))
          || [row.wday_start_at, row.wday_end_at].some(v => v != null && v !== 0)) {
        excluded.recurrenceUnproved++; continue;
      }
      let target;
      if (kind === 'event') {
        if (!Array.isArray(row.quests) || row.quests.length > 4096) fail();
        const areas = new Set(), questIds = new Set();
        let resolved = row.quests.length > 0;
        for (const quest of row.quests) {
          if (!object(quest) || !id(quest.id) || questIds.has(quest.id)) fail();
          questIds.add(quest.id);
          const matches = quests.get(String(quest.id));
          if (!matches || matches.size !== 1) resolved = false;
          else for (const area of matches) areas.add(area);
        }
        if (resolved && areas.size === 1) target = { kind: 'event-area', id: [...areas][0] };
      } else if (zBattles.has(String(row.id))) target = { kind: 'z-battle', id: String(row.id) };
      if (!target) { excluded.unresolvedTarget++; continue; }
      candidates.push({ id: key, target, ...window });
    }
  }
  candidates.sort((a, b) => a.endsAt.localeCompare(b.endsAt) || a.id.localeCompare(b.id));
  return {
    schemaVersion: 1, mode: 'offline-experiment', publicationAllowed: false,
    authority: 'partial-global-account-observation', timestampSemantics: 'unix-seconds-unverified-on-current-response',
    observedAt, validUntil: new Date(observed + 6 * 3600000).toISOString(),
    catalogSha256, candidates, excluded,
  };
}
