const DAYS = new Set(['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']);
const seconds = v => Number.isSafeInteger(v) && v >= 1230768000 && v < 4102444800;
const iso = v => new Date(v * 1000).toISOString();
const absent = v => v == null || v === 0;

/** Offline policy only: observed availability is not a guarantee of player eligibility. */
export function interpretEventAvailability(row, { kind, observedAt, now } = {}) {
  if (!row || typeof row !== 'object' || Array.isArray(row)
      || !['event', 'z-battle'].includes(kind)) return null;
  const parse = value => {
    if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)) return NaN;
    const ms = Date.parse(value);
    return Number.isFinite(ms) && new Date(ms).toISOString() === value ? ms / 1000 : NaN;
  };
  const observed = parse(observedAt), current = parse(now);
  if (!Number.isFinite(observed) || !Number.isFinite(current)
      || current < observed || current >= observed + 21600) return null;
  const start = row.start_at, end = row.end_at;
  if (!seconds(start) || !seconds(end) || end <= start) return null;
  // A long horizon can bound observation but must never become a useful deadline.
  const eventEndsAt = end !== 2145916800 && end - start <= 366 * 86400 ? iso(end) : null;
  const hasWeekdayWindow = !absent(row.wday_start_at) || !absent(row.wday_end_at);
  let availabilityStart = start, availabilityEnd = end, basis = 'overall-period';
  if (kind === 'event' || hasWeekdayWindow || row.wday != null) {
    if (!Array.isArray(row.wday) || row.wday.length > 7
        || row.wday.some(v => typeof v !== 'string' || !DAYS.has(v.toLowerCase()))) return null;
    const days = row.wday.map(v => v.toLowerCase());
    if (new Set(days).size !== days.length) return null;
    if (days.length > 0) {
      const ws = row.wday_start_at, we = row.wday_end_at;
      // Consume the server's absolute interval, not a guessed weekday timezone.
      if (!seconds(ws) || !seconds(we) || we - ws !== 86400) return null;
      availabilityStart = Math.max(start, ws);
      availabilityEnd = Math.min(end, we);
      basis = 'observed-weekday-window';
    } else if (hasWeekdayWindow) return null;
  }
  // Never carry a future interval into a later day or resurrect an ended observation.
  if (observed < availabilityStart || observed >= availabilityEnd
      || current >= availabilityEnd) return null;
  return {
    basis,
    availableFrom: iso(availabilityStart),
    availableUntil: iso(availabilityEnd),
    eventEndsAt,
    validUntil: iso(Math.min(observed + 21600, availabilityEnd)),
  };
}
