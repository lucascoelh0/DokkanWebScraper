import { projectEventArtwork } from './project-event-artwork.mjs';
const API_ORIGIN = "https://ishin-global.aktsk.com";
const CDN_HOST = "cf.ishin-global.aktsk.com";
const CDN_PATH = /^\/banners\/en\/gashasocool\/[A-Za-z0-9_-]+\.png$/u;
const API_LIMIT = 43;
const IMAGE_LIMIT = 40;
const API_BYTES = 8 * 1024 * 1024;
const IMAGE_BYTES = 2 * 1024 * 1024;
const CONFIG_BYTES = 32 * 1024;
const DEFAULT_TIMEOUT_MS = 20_000;
const ALLOWED_HEADER = /^(?:authorization|content-type|accept|user-agent|x-[a-z0-9!#$%&'*+.^_`|~-]+)$/u;
const HEADER_NAME = /^[a-z0-9!#$%&'*+.^_`|~-]{1,128}$/u;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function fail() {
  throw new Error("auth_session_failed");
}

function isRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizeHeaders(value) {
  if (!isRecord(value)) fail();
  const normalized = Object.create(null);
  for (const [rawName, rawValue] of Object.entries(value)) {
    const name = rawName.toLowerCase();
    if (
      rawName !== rawName.trim() ||
      !HEADER_NAME.test(name) ||
      !ALLOWED_HEADER.test(name) ||
      Object.prototype.hasOwnProperty.call(normalized, name) ||
      typeof rawValue !== "string" ||
      rawValue.length < 1 ||
      rawValue.length > 8_192 ||
      /[^\u0020-\u007e]/u.test(rawValue)
    ) {
      fail();
    }
    normalized[name] = rawValue;
  }
  return normalized;
}

function normalizeConfig(config) {
  if (!isRecord(config)) fail();
  const expected = new Set(["nonceHeaders", "loginHeaders", "loginBody", "apiHeaders"]);
  if (Object.keys(config).some((key) => !expected.has(key))) fail();

  let serialized;
  try {
    serialized = JSON.stringify(config);
  } catch {
    fail();
  }
  if (typeof serialized !== "string" || Buffer.byteLength(serialized, "utf8") > CONFIG_BYTES) fail();

  const nonceHeaders = normalizeHeaders(config.nonceHeaders);
  const loginHeaders = normalizeHeaders(config.loginHeaders);
  const apiHeaders = normalizeHeaders(config.apiHeaders);
  if (!/^Basic [A-Za-z0-9+/]+={0,2}$/u.test(loginHeaders.authorization ?? "")) fail();
  if (!isRecord(config.loginBody)) fail();

  let loginBody;
  try {
    loginBody = JSON.parse(JSON.stringify(config.loginBody));
  } catch {
    fail();
  }
  if (!isRecord(loginBody)) fail();

  // API captures contain an expired bearer. It is never allowed to survive.
  delete apiHeaders.authorization;
  nonceHeaders["accept-encoding"] = "identity";
  loginHeaders["accept-encoding"] = "identity";
  apiHeaders["accept-encoding"] = "identity";
  loginHeaders["content-type"] = "application/json";
  return { nonceHeaders, loginHeaders, loginBody, apiHeaders };
}

function responseHeader(response, name) {
  if (!response?.headers || typeof response.headers.get !== "function") fail();
  const value = response.headers.get(name);
  return typeof value === "string" ? value : null;
}

async function readBounded(response, maximum) {
  const contentLength = responseHeader(response, "content-length");
  if (contentLength !== null) {
    if (!/^(?:0|[1-9][0-9]*)$/u.test(contentLength)) fail();
    const length = Number(contentLength);
    if (!Number.isSafeInteger(length) || length > maximum) fail();
  }
  if (!response.body || typeof response.body.getReader !== "function") fail();

  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array) || value.byteLength === 0) fail();
      length += value.byteLength;
      if (length > maximum) fail();
      chunks.push(Buffer.from(value));
    }
  } catch {
    try {
      await reader.cancel();
    } catch {
      // Ignore cancellation errors; callers receive only the sanitized failure.
    }
    fail();
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // A failed reader may already have released its lock.
    }
  }
  return Buffer.concat(chunks, length);
}

function parseJson(bytes) {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const value = JSON.parse(text);
    if (!isRecord(value)) fail();
    return value;
  } catch {
    fail();
  }
}

function validateResponse(response, contentType) {
  if (!response || response.status !== 200 || response.redirected === true) fail();
  const encoding = responseHeader(response, "content-encoding");
  if (encoding !== null && encoding.trim().toLowerCase() !== "identity") fail();
  const actualType = responseHeader(response, "content-type")?.split(";", 1)[0].trim().toLowerCase();
  // CDN MIME is advisory: published images must pass PNG signature and full decode.
  // API responses still require JSON; HTML/error bytes can never pass PNG validation.
  if (contentType !== null && actualType !== contentType) fail();
}

function validateImageUrl(value, pathPattern = CDN_PATH) {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > 8_192 ||
    /[\u0000-\u0020\\#]/u.test(value)
  ) {
    fail();
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    fail();
  }
  const authority = value.slice("https://".length).split("/", 1)[0];
  if (
    !value.startsWith("https://") ||
    authority.includes("@") ||
    url.protocol !== "https:" ||
    url.hostname !== CDN_HOST ||
    (url.port !== "" && url.port !== "443") ||
    url.username !== "" ||
    url.password !== "" ||
    url.hash !== "" ||
    url.search.length < 2 ||
    url.pathname.includes("%") ||
    !pathPattern.test(url.pathname)
  ) {
    fail();
  }
  return value;
}

function learnGashaIds(value) {
  if (!Array.isArray(value.gashas) || value.gashas.length > 200) fail();
  const ids = new Set();
  for (const row of value.gashas) {
    if (!isRecord(row) || !Number.isSafeInteger(row.id) || row.id < 1 || row.id > 999_999_999) fail();
    ids.add(String(row.id));
  }
  return ids;
}

/**
 * Creates a one-shot, server-side authenticated session around caller-supplied
 * fetch. Secrets stay in closure memory and all outward failures are sanitized.
 */
export function createSession(config, { fetchImpl = globalThis.fetch, timeoutMs = DEFAULT_TIMEOUT_MS, apiScope = "summons" } = {}) {
  try {
    if (!["summons", "events", "events-media", "campaigns", "campaigns-media", "news", "news-media", "news-library"].includes(apiScope)) fail();
    if (typeof fetchImpl !== "function") fail();
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > DEFAULT_TIMEOUT_MS) fail();
    let secrets = normalizeConfig(config);
    let token = null;
    let learnedIds = null;
    let gashasRequested = false;
    let eventsRequested = false;
    let newsRequested = false;
    let campaignsRequested = false;
    const requestedIds = new Set();
    const controllers = new Set();
    let apiRequests = 0;
    let imageRequests = 0;
    let closed = false;
    let poisoned = false;
    const campaignImageUrls = new Set();
    const newsImageUrls = new Set();
    const eventImageUrls = new Set();
    const newsDetailIds = new Set();
    let authenticating = null;

    function usable() {
      if (closed || poisoned || secrets === null) fail();
    }

    async function perform(url, options, maximum, contentType, isApi) {
      usable();
      if (isApi) {
        // News: two auth calls, one index, six visible articles, at most eight
        // additional exact-ID summon period articles. Duplicate IDs stay blocked.
        if (apiRequests >= (apiScope === 'news-library' ? 103 : apiScope === "summons" ? API_LIMIT : apiScope === 'news-media' ? 17 : 3)) fail();
        apiRequests += 1;
      } else {
        if (imageRequests >= (apiScope === 'news-library' ? 256 : apiScope === 'events-media' ? 20 : apiScope === 'news-media' ? 12 : apiScope === 'campaigns-media' ? 8 : IMAGE_LIMIT)) fail();
        imageRequests += 1;
      }
      const controller = new AbortController();
      controllers.add(controller);
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(url, {
          ...options,
          credentials: "omit",
          redirect: "error",
          signal: controller.signal,
        });
        validateResponse(response, contentType);
        return await readBounded(response, maximum);
      } catch {
        controller.abort();
        fail();
      } finally {
        clearTimeout(timer);
        controllers.delete(controller);
      }
    }

    async function jsonRequest(path, method, headers, body) {
      const bytes = await perform(
        `${API_ORIGIN}${path}`,
        {
          method,
          headers,
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        },
        path === "/missions/mission_board_campaigns" ? 1024 * 1024 : API_BYTES,
        "application/json",
        true,
      );
      return parseJson(bytes);
    }

    async function authenticate() {
      const nonce = await jsonRequest("/auth/nonce", "GET", secrets.nonceHeaders);
      const transactionId = nonce.auth_transaction_id;
      if (
        typeof transactionId !== "string" ||
        transactionId.length < 1 ||
        transactionId.length > 4_096 ||
        /[\u0000-\u001f\u007f]/u.test(transactionId)
      ) {
        fail();
      }
      const body = { ...secrets.loginBody, auth_transaction_id: transactionId };
      const login = await jsonRequest("/auth/sign_in", "POST", secrets.loginHeaders, body);
      if (
        typeof login.access_token !== "string" ||
        login.access_token.length < 1 ||
        login.access_token.length > 16_384 ||
        /[\u0000-\u0020\u007f]/u.test(login.access_token) ||
        typeof login.token_type !== "string" ||
        login.token_type.toLowerCase() !== "bearer"
      ) {
        fail();
      }
      token = login.access_token;
      // Login-only material is no longer needed after a fresh bearer is issued.
      secrets.loginBody = null;
      secrets.loginHeaders = null;
      secrets.nonceHeaders = null;
    }

    async function ensureAuthenticated() {
      if (token !== null) return;
      authenticating ??= authenticate();
      await authenticating;
    }

    async function guarded(operation) {
      try {
        usable();
        return await operation();
      } catch {
        poisoned = true;
        token = null;
        learnedIds?.clear();
        throw new Error("auth_session_failed");
      }
    }

    async function requestApi(path) {
      return guarded(async () => {
        let id = null;
        if (apiScope === "campaigns" || apiScope === "campaigns-media") {
          if (path !== "/missions/mission_board_campaigns" || campaignsRequested) fail();
          campaignsRequested = true;
        } else if (apiScope === "news" || apiScope === "news-media" || apiScope === 'news-library') {
          if (path === '/announcements' && !newsRequested) newsRequested = true;
          else {
            const match = /^\/announcements\/([1-9][0-9]{0,8})$/u.exec(path);
            if (!['news-media','news-library'].includes(apiScope) || !match || !newsDetailIds.has(match[1]) || requestedIds.has(match[1])) fail();
            requestedIds.add(match[1]);
          }
        } else if (apiScope === "events" || apiScope === "events-media") {
          if (path !== "/events" || eventsRequested) fail();
          eventsRequested = true;
        } else if (path === "/gashas") {
          if (gashasRequested) fail();
          gashasRequested = true;
        } else {
          const match = typeof path === "string" ? /^\/gashas\/([1-9][0-9]*)\/featured_cards$/u.exec(path) : null;
          if (!match || learnedIds === null || !learnedIds.has(match[1]) || requestedIds.has(match[1])) fail();
          id = match[1];
          requestedIds.add(id);
        }
        await ensureAuthenticated();
        const headers = { ...secrets.apiHeaders, authorization: `Bearer ${token}` };
        // First-party session counter, not an endpoint schema version. A fresh
        // sign-in is followed by GETs only in this adapter; captured counters
        // from an already-used game session must never be replayed here.
        headers["x-requestversion"] = "1";
        const body = await jsonRequest(path, "GET", headers);
        if (apiScope === 'events-media') {
          const allowed = new Set(projectEventArtwork(body).map(row => `${row.imageHost}${row.imagePath}`));
          for (const row of [...body.events, ...body.z_battle_stages]) {
            try {
              const url = new URL(row.banner_image);
              if (row.banner_image.split('?')[0] === `https://${CDN_HOST}${url.pathname}` &&
                  allowed.has(`${url.hostname}${url.pathname}`)) eventImageUrls.add(validateImageUrl(
                row.banner_image, /^\/banners\/en\/event\/eve_banner\/[A-Za-z0-9_-]+\.png$/u));
            } catch { /* Invalid optional artwork keeps its text fallback. */ }
          }
        }
        if (['news-media','news-library'].includes(apiScope) && path === '/announcements') {
          if (!Array.isArray(body.announcements) || body.announcements.length > 500) fail();
          for (const row of body.announcements) {
            if (Number.isSafeInteger(row.id) && row.id > 0 && row.id <= 999999999) newsDetailIds.add(String(row.id));
            if (row.banner) newsImageUrls.add(validateImageUrl(row.banner,
              /^\/banners\/en\/news\/[A-Za-z0-9_-]+\.png$/u));
          }
        }
        if (apiScope === 'news-library' && path !== '/announcements') {
          const article = body.announcement;
          if (!article || String(article.id) !== path.split('/').at(-1) || !Array.isArray(article.bodies) || article.bodies.length > 30) fail();
          for (const block of article.bodies) {
            if (block.image) newsImageUrls.add(validateImageUrl(block.image,
              /^\/banners\/en\/news\/[A-Za-z0-9_-]+\.png$/u));
          }
        }
        if (apiScope === 'campaigns-media') {
          if (!Array.isArray(body.mission_board_campaigns) || body.mission_board_campaigns.length > 100) fail();
          for (const campaign of body.mission_board_campaigns) {
            if (campaign.banner_image_path != null) campaignImageUrls.add(validateImageUrl(
              campaign.banner_image_path, /^\/images\/en\/panel_mission\/[A-Za-z0-9_-]+\.png$/u));
          }
        }
        if (path === "/gashas") learnedIds = learnGashaIds(body);
        return { status: 200, body };
      });
    }

    async function fetchImage(value) {
      return guarded(async () => {
        if (apiScope !== "summons" && apiScope !== 'campaigns-media' && apiScope !== 'news-media' && apiScope !== 'news-library' && apiScope !== 'events-media') fail();
        if (apiScope === 'events-media' && !eventImageUrls.has(value)) fail();
        if (['news-media','news-library'].includes(apiScope) && !newsImageUrls.has(value)) fail();
        if (apiScope === 'campaigns-media' && !campaignImageUrls.has(value)) fail();
        const url = validateImageUrl(value, apiScope === 'events-media'
          ? /^\/banners\/en\/event\/eve_banner\/[A-Za-z0-9_-]+\.png$/u : ['news-media','news-library'].includes(apiScope)
          ? /^\/banners\/en\/news\/[A-Za-z0-9_-]+\.png$/u : apiScope === 'campaigns-media'
          ? /^\/images\/en\/panel_mission\/[A-Za-z0-9_-]+\.png$/u : CDN_PATH);
        const bytes = await perform(
          url,
          { method: "GET", headers: { accept: "image/png", "accept-encoding": "identity" } },
          IMAGE_BYTES,
          null,
          false,
        );
        if (bytes.length < PNG_SIGNATURE.length || !bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) fail();
        return bytes;
      });
    }

    function close() {
      if (closed) return;
      closed = true;
      poisoned = true;
      for (const controller of controllers) controller.abort();
      controllers.clear();
      token = null;
      learnedIds?.clear();
      requestedIds.clear();
      newsImageUrls.clear();
      eventImageUrls.clear();
      newsDetailIds.clear();
      secrets = null;
      authenticating = null;
    }

    return Object.freeze({ requestApi, fetchImage, close });
  } catch {
    throw new Error("auth_session_failed");
  }
}
