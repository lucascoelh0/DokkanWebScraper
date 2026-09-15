const categories = new Set(['challenge','bonus','limited','growth','story','db-story','quests','z-battles']);
const ordinary = new Set(['challenge','bonus','limited','z-battles']);
const id = value => Number.isSafeInteger(value) && value > 0 && value <= 999999999;
const seconds = value => Number.isSafeInteger(value) && value >= 1230768000 && value < 4102444800;
const iso = value => new Date(value * 1000).toISOString();

export function eventCategory(rows, kind) {
  if (kind === 'z-battle') return 'z-battles';
  const values = new Set(rows.map(row => row.browseCategory));
  return values.size === 1 && categories.has([...values][0]) ? [...values][0] : 'unknown';
}

export function isHomeHighlight(category, burstMode) {
  // Missing is a legacy projection, not a claim that its category is known.
  return category == null || ordinary.has(category) || (category === 'growth' && burstMode != null);
}

/** Only independent product schedule fields survive; never account is_new/reward state. */
export function projectBurstPeriods(body, observedAt, now) {
  const output = new Map();
  const observed = Date.parse(observedAt) / 1000, current = Date.parse(now) / 1000;
  const section = body?.genkai_battles;
  if (!Number.isFinite(observed) || !Number.isFinite(current) || current < observed || current >= observed + 21600
      || !seconds(section?.expire_at) || section.expire_at <= current
      || !Array.isArray(section.genkai_battles) || section.genkai_battles.length > 100) return output;
  const duplicates = new Set();
  for (const row of section.genkai_battles) {
    if (!row || !id(row.id) || !id(row.area_id) || !id(row.genkai_battle_schedule_id)
        || !seconds(row.start_at) || !seconds(row.end_at) || row.end_at <= row.start_at
        || row.end_at - row.start_at > 366 * 86400 || observed < row.start_at || current >= row.end_at) continue;
    const area = String(row.area_id);
    if (output.has(area)) duplicates.add(area);
    output.set(area, { id: String(row.id), scheduleId: String(row.genkai_battle_schedule_id),
      startsAt: iso(row.start_at), endsAt: iso(row.end_at),
      validUntil: new Date(Math.min(observed + 21600, row.end_at, section.expire_at) * 1000).toISOString() });
  }
  // Conflicting active roots for one base area require explicit resolution, not guessing.
  for (const area of duplicates) output.delete(area);
  return output;
}
