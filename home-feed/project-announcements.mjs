// Offline public projection only. No authentication, requests or publication.
const fail = () => { throw new Error("Invalid announcements observation"); };
const record = value => value !== null && typeof value === "object" && !Array.isArray(value);
function integer(value, max = 999_999_999) {
  if (!Number.isSafeInteger(value) || value < 0 || value > max) fail();
  return value;
}
function plain(value, max, required = false) {
  if (typeof value !== "string" || value.length > max || /[<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) fail();
  const text = value.replace(/\s+/gu, " ").trim();
  if (required && !text) fail();
  return text;
}
function imageReference(value) {
  if (value === null || value === "") return null;
  if (typeof value !== "string" || value.length > 8192 || /[\\\s]/u.test(value)) fail();
  let url;
  try { url = new URL(value); } catch { fail(); }
  if (url.protocol !== "https:" || url.hostname !== "cf.ishin-global.aktsk.com" ||
      url.username || url.password || url.port || url.hash ||
      !/^\/banners\/en\/news\/[A-Za-z0-9_-]+\.png$/u.test(url.pathname)) fail();
  // This is identity, not a fetch URL. Signed query strings must stay private.
  return { host: url.hostname, path: url.pathname };
}

export function projectAnnouncements(payload) {
  if (!record(payload) || !Array.isArray(payload.announcements) || payload.announcements.length > 500) fail();
  const seen = new Set();
  const announcements = payload.announcements.map(row => {
    if (!record(row)) fail();
    const id = integer(row.id);
    if (!id || seen.has(id)) fail();
    seen.add(id);
    return {
      id,
      category: integer(row.category),
      ...(row.announcement_tab_id == null ? {} : {
        tabId: integer(row.announcement_tab_id) || fail(),
      }),
      title: plain(row.title, 500, true),
      summary: plain(row.summary, 2000),
      startsAt: integer(row.start_at, 9_999_999_999),
      image: imageReference(row.banner),
    };
  });
  return {
    source: "game_api_announcements",
    coverage: "account_observation_not_complete_global_inventory",
    announcements: announcements.sort((a, b) => b.startsAt - a.startsAt || b.id - a.id),
  };
}

/** Native plain-text article. Never interpret markup, links or account status. */
export function projectAnnouncementBody(payload, expectedId) {
  const article = payload?.announcement;
  if (!record(article) || article.id !== expectedId || !Array.isArray(article.bodies) || article.bodies.length > 30) fail();
  const paragraphs = article.bodies.map(body => {
    if (!record(body) || typeof body.description !== 'string') fail();
    // Preserve deliberate paragraph breaks for reading, rather than HTML rendering.
    plain(body.description, 12000);
    return body.description.replace(/\r\n?/gu, '\n').trim();
  }).filter(Boolean);
  if (paragraphs.reduce((sum, value) => sum + Buffer.byteLength(value), 0) > 24000) fail();
  return paragraphs;
}
