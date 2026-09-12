import { createHash } from "node:crypto";

const SOURCE = "authorized_manual_global_gashas_read";
const COVERAGE = "account_observation_not_complete_global_inventory";
const IMAGE_HOST = "cf.ishin-global.aktsk.com";
const IMAGE_PATH_PATTERN = /^\/banners\/en\/gashasocool\/[A-Za-z0-9_-]+\.png$/;
const MAX_GASHA_ROWS = 200;
const MAX_ACTIVE_BANNERS = 40;
const MAX_FEATURED_ITEMS = 100;
const MAX_PUBLIC_ID = 999_999_999;
const MAX_TIMESTAMP = 9_999_999_999;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 8_192;
const MAX_IMAGE_PIXELS = 16_000_000;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function invalid() {
  throw new Error("invalid");
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireInteger(value, minimum, maximum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    invalid();
  }
  return value;
}

function requireName(value) {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > 100 ||
    /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    invalid();
  }
  return value;
}

function parseBannerUrl(value) {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > 8_192 ||
    /[\u0000-\u0020\\#]/u.test(value)
  ) {
    invalid();
  }

  const schemeEnd = value.indexOf("://");
  const authorityStart = schemeEnd < 0 ? 0 : schemeEnd + 3;
  const remainder = value.slice(authorityStart);
  const authorityEnd = remainder.search(/[/?#]/u);
  const authority = remainder.slice(0, authorityEnd < 0 ? remainder.length : authorityEnd);
  if (authority.includes("@")) {
    invalid();
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    invalid();
  }

  if (
    url.protocol !== "https:" ||
    url.hostname !== IMAGE_HOST ||
    (url.port !== "" && url.port !== "443") ||
    url.username !== "" ||
    url.password !== "" ||
    url.hash !== "" ||
    !IMAGE_PATH_PATTERN.test(url.pathname) ||
    url.pathname.includes("%")
  ) {
    invalid();
  }

  return { signedUrl: value, imageHost: IMAGE_HOST, imagePath: url.pathname };
}

function projectBanner(row) {
  if (!isRecord(row)) {
    invalid();
  }

  const id = requireInteger(row.id, 1, MAX_PUBLIC_ID);
  const gashaCategoryId = requireInteger(row.gasha_category_id, 0, MAX_TIMESTAMP);
  const openAt = requireInteger(row.open_at, 0, MAX_TIMESTAMP);
  const endAt = requireInteger(row.end_at, 0, MAX_TIMESTAMP);
  if (endAt <= openAt) {
    invalid();
  }
  const name = requireName(row.name);
  const image = parseBannerUrl(row.banner_url);

  return {
    public: {
      id,
      name,
      gasha_category_id: gashaCategoryId,
      open_at: openAt,
      end_at: endAt,
      imageHost: image.imageHost,
      imagePath: image.imagePath,
    },
    signedUrl: image.signedUrl,
  };
}

function responsePayload(response) {
  if (!isRecord(response) || response.status !== 200) {
    invalid();
  }
  if (Object.prototype.hasOwnProperty.call(response, "body")) {
    return response.body;
  }
  if (Object.prototype.hasOwnProperty.call(response, "data")) {
    return response.data;
  }
  invalid();
}

function projectFeatured(payload) {
  if (!isRecord(payload) || !Array.isArray(payload.gasha_items)) {
    invalid();
  }
  if (payload.gasha_items.length > MAX_FEATURED_ITEMS) {
    invalid();
  }

  const gashaItems = payload.gasha_items.map((item) => {
    if (!isRecord(item)) {
      invalid();
    }
    return { card_id: requireInteger(item.card_id, 1, MAX_PUBLIC_ID) };
  });
  if (new Set(gashaItems.map((item) => item.card_id)).size !== gashaItems.length) {
    invalid();
  }

  return { gasha_items: gashaItems };
}

function imageBytes(response) {
  if (Buffer.isBuffer(response)) {
    return response;
  }
  const body = responsePayload(response);
  if (!Buffer.isBuffer(body) && !(body instanceof Uint8Array)) {
    invalid();
  }
  return Buffer.from(body);
}

function inspectPng(bytes) {
  if (bytes.length < 24 || bytes.length > MAX_IMAGE_BYTES) {
    invalid();
  }
  if (
    !bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE) ||
    bytes.readUInt32BE(8) !== 13 ||
    bytes.toString("ascii", 12, 16) !== "IHDR"
  ) {
    invalid();
  }

  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (
    width < 1 ||
    width > MAX_IMAGE_DIMENSION ||
    height < 1 ||
    height > MAX_IMAGE_DIMENSION ||
    width * height > MAX_IMAGE_PIXELS
  ) {
    invalid();
  }

  // This boundary verifies bounded PNG framing and dimensions only. A publisher
  // that needs pixel-level assurance must perform a separate bounded full decode.
  return { width, height };
}

function observation(now) {
  const value = now();
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    invalid();
  }
  return { observedAt: value.toISOString(), epochSeconds: value.getTime() / 1_000 };
}

async function collect({ requestApi, fetchImage, now }) {
  if (typeof requestApi !== "function" || typeof fetchImage !== "function" || typeof now !== "function") {
    invalid();
  }

  const { observedAt, epochSeconds } = observation(now);
  const gashasPayload = responsePayload(await requestApi("/gashas"));
  if (!isRecord(gashasPayload) || !Array.isArray(gashasPayload.gashas)) {
    invalid();
  }
  if (gashasPayload.gashas.length > MAX_GASHA_ROWS) {
    invalid();
  }

  const projected = gashasPayload.gashas.map(projectBanner);
  if (new Set(projected.map((banner) => banner.public.id)).size !== projected.length) {
    invalid();
  }

  const active = projected.filter(
    (banner) => banner.public.open_at <= epochSeconds && epochSeconds < banner.public.end_at,
  );
  if (active.length > MAX_ACTIVE_BANNERS) {
    invalid();
  }

  const receipts = [];
  const images = new Map();
  const featuredResponses = [];

  for (const banner of active) {
    const featuredPath = `/gashas/${banner.public.id}/featured_cards`;
    const featuredPayload = responsePayload(await requestApi(featuredPath));
    const publicIds = projectFeatured(featuredPayload);
    featuredResponses.push({
      path: featuredPath,
      status: 200,
      error: null,
      observedAt,
      publicIds,
    });

    const bytes = imageBytes(await fetchImage(banner.signedUrl));
    const { width, height } = inspectPng(bytes);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    images.set(`${sha256}.png`, Buffer.from(bytes));
    receipts.push({
      bannerId: banner.public.id,
      sha256,
      sizeBytes: bytes.length,
      width,
      height,
      sourcePath: banner.public.imagePath,
    });
  }

  return {
    snapshot: {
      source: SOURCE,
      observedAt,
      coverage: COVERAGE,
      banners: active.map((banner) => banner.public),
    },
    receipts,
    images,
    featuredResponses,
  };
}

/**
 * Collects one bounded, public summons observation through caller-supplied I/O.
 * requestApi(path) must return {status: 200, body|data}; fetchImage(url) may
 * return the same response shape or a Buffer. This module performs no auth,
 * persistence, retries, scheduling, redirects, or network access of its own.
 */
export async function collectSummons(options) {
  try {
    return await collect(options ?? {});
  } catch {
    // Do not propagate adapter exceptions, response bodies, or signed URLs.
    throw new Error("summons_collection_failed");
  }
}
