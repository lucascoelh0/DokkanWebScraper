const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const fail = () => { throw new Error('Invalid event schedule diagnostic'); };
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
function timestamp(value) {
  if (value === undefined) return { state: 'absent' };
  if (value === null) return { state: 'null' };
  if (!Number.isSafeInteger(value) || value < 0 || value > 10000000000000) return { state: 'invalid' };
  return { state: 'integer', value };
}
function weekdays(value) {
  if (value === undefined) return { state: 'absent' };
  if (value === null) return { state: 'null' };
  if (!Array.isArray(value) || value.length > 7 || value.some(v => typeof v !== 'string' || !DAYS.includes(v.toLowerCase()))) return { state: 'invalid' };
  const days = value.map(v => v.toLowerCase());
  if (new Set(days).size !== days.length) return { state: 'invalid' };
  return { state: days.length === 7 ? 'all-seven' : days.length === 0 ? 'empty' : 'subset', days: DAYS.filter(d => days.includes(d)) };
}
function periodReason(start, end) {
  if (start.state !== 'integer' || end.state !== 'integer') return 'missing-or-invalid';
  if (start.value === 0 || end.value === 0) return 'zero-boundary';
  if (start.value < 1420070400 || end.value < 1420070400 || start.value >= 4102444800 || end.value >= 4102444800) return 'outside-seconds-policy';
  if (end.value <= start.value) return 'non-increasing';
  if (end.value - start.value > 366 * 86400) return 'longer-than-366-days';
  return 'finite-within-policy';
}
/** Public field evidence only. Never interprets weekday timezones or grants availability. */
export function diagnoseEventSchedules({ bodyBytes, endpoint, status }) {
  try {
    if (endpoint !== '/events' || status !== 200 || !Buffer.isBuffer(bodyBytes) || bodyBytes.length > 4 * 1024 * 1024) fail();
    const body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bodyBytes));
    if (!object(body)) fail();
    const rows = [], seen = new Set();
    for (const [kind, source] of [['event', body.events], ['z-battle', body.z_battle_stages]]) {
      if (!Array.isArray(source) || source.length > 1000) fail();
      for (const row of source) {
        if (!object(row) || !Number.isSafeInteger(row.id) || row.id < 1 || row.id > 999999999) fail();
        const key = `${kind}:${row.id}`;
        if (seen.has(key)) fail();
        seen.add(key);
        const start = timestamp(row.start_at), end = timestamp(row.end_at);
        rows.push({ id: key, start, end, periodReason: periodReason(start, end),
          weekdays: weekdays(row.wday), weekdayStart: timestamp(row.wday_start_at), weekdayEnd: timestamp(row.wday_end_at) });
      }
    }
    rows.sort((a, b) => a.id.localeCompare(b.id));
    return { schemaVersion: 1, publicationAllowed: false, interpretation: 'numeric-calendar-evidence-only', rows };
  } catch { fail(); }
}
