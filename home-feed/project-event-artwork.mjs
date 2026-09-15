const HOST = 'cf.ishin-global.aktsk.com';
const MAX_ROWS = 2_000;

/** Offline public references only. Does not authorize fetching or publish signed URLs. */
export function projectEventArtwork(payload) {
  const fail = () => { throw new Error('Invalid event artwork'); };
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) fail();
  const result = [];
  for (const [field, sourceKind] of [['events', 'event'], ['z_battle_stages', 'z-battle']]) {
    const rows = payload[field];
    if (!Array.isArray(rows) || rows.length > MAX_ROWS) fail();
    const seen = new Set();
    for (const row of rows) {
      if (!row || !Number.isSafeInteger(row.id) || row.id < 1 || row.id > 999_999_999 || seen.has(row.id)) fail();
      seen.add(row.id);
      // listbutton is the illustrated horizontal art; event_image is a tall poster.
      for (const sourceField of ['listbutton_image', 'event_image', 'banner_image']) {
        const prefix = `/banners/en/event/${({listbutton_image:'eve_listbutton',event_image:'eve_header',banner_image:'eve_banner'})[sourceField]}/`;
        const value = row[sourceField];
        if (value == null || value === '') continue;
        // Optional bad art is omitted without discarding otherwise usable events.
        if (typeof value !== 'string' || value.length > 8192 || /[\s\\#]/u.test(value)) continue;
        let url;
        try { url = new URL(value); } catch { continue; }
        if (url.protocol !== 'https:' || url.hostname !== HOST || url.username || url.password || url.port ||
            !url.pathname.startsWith(prefix) || !/^[A-Za-z0-9_-]+\.png$/.test(url.pathname.slice(prefix.length))) continue;
        // URL normalisation must not turn traversal or an alternative authority into allowed input.
        if (value.split('?')[0] !== `https://${HOST}${url.pathname}`) continue;
        // Match the availability candidate's source ID, not its independently joined area target.
        result.push({ id: `${sourceKind}:${row.id}`, imageHost: HOST, imagePath: url.pathname,
          ...(sourceField !== 'banner_image' ? { sourceField } : {}) });
        break;
      }
    }
  }
  return result;
}
