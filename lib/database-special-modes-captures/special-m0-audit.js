"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateSpecialM0 = exports.buildSpecialM0 = exports.sanitizeSpecialM0Entry = void 0;
const crypto_1 = require("crypto");
const buffer_1 = require("buffer");
const API = "ishin-global.aktsk.com";
const CDN = "cf.ishin-global.aktsk.com";
const SENSITIVE_HEADER = /^(?:authorization|cookie|set-cookie|x-api(?:token|-token|-key)|x-apitoken|x-user(?:id|-id|-country|-currency)|x-device(?:id|-id|-token)|x-session(?:id|-id|-token)|x-signature)$/i;
const SAFE_API_SEGMENTS = new Set(["accept", "announcements", "auth", "banners", "briefing", "db_stories", "eventkagi_events", "events", "finish", "finish_opening", "googleplay_products", "home", "iap_rails", "joint_campaigns", "login", "mission_board_campaigns", "missions", "nonce", "notify", "open", "packs", "ping", "put_forward", "quests", "resources", "sd", "sign_in", "start", "sugoroku_maps", "title", "tutorial", "user", "user_areas"]);
const REPRESENTATIONS = ["absent", "json_identity", "binary_base64", "cache_not_modified_304", "zstandard_base64", "encoded_unknown", "identity_non_json"];
function sha256(value) { return (0, crypto_1.createHash)("sha256").update(value).digest("hex"); }
function timestamp(value) { const parsed = typeof value === "string" ? Date.parse(value) : NaN; return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null; }
function mime(value) { if (typeof value !== "string")
    return "unknown"; const media = value.split(";", 1)[0].trim().toLowerCase(); return /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(media) ? media : "unknown"; }
function names(value, pattern) { if (!Array.isArray(value))
    return []; return [...new Set(value.flatMap(item => { const name = item && typeof item === "object" ? item.name : null; return typeof name === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(name) && (!pattern || pattern.test(name)) ? [name.toLowerCase()] : []; }))].sort(); }
function byteLength(content) { if (!content || typeof content.text !== "string")
    return 0; if (content.encoding === "base64") {
    try {
        return buffer_1.Buffer.from(content.text, "base64").length;
    }
    catch {
        return 0;
    }
} return buffer_1.Buffer.byteLength(content.text); }
function representation(content, status) { if (status === 304)
    return "cache_not_modified_304"; if (!content || typeof content.text !== "string" || content.text.length === 0)
    return "absent"; const media = mime(content.mimeType); if (content.encoding === "base64")
    return media === "application/x-zstd" ? "zstandard_base64" : media.startsWith("image/") || media === "application/octet-stream" ? "binary_base64" : "encoded_unknown"; return media === "application/json" || media.endsWith("+json") ? "json_identity" : "identity_non_json"; }
function body(content, status) { return { mimeType: mime(content?.mimeType), sizeBytes: byteLength(content), representation: representation(content, status) }; }
function normalize(pathname, host) { if (host === "official_cdn") {
    const ext = pathname.toLowerCase().match(/\.([a-z0-9]{1,8})$/)?.[1];
    return `/asset/${ext && ["png", "jpg", "jpeg", "webp", "json", "db"].includes(ext) ? ext : "unknown"}`;
} if (host !== "official_api")
    return "/:unknown"; return `/${pathname.replace(/\/{2,}/g, "/").split("/").filter(Boolean).map(segment => { let decoded; try {
    decoded = decodeURIComponent(segment);
}
catch {
    return ":opaque";
} if (/^\d+$/.test(decoded))
    return ":id"; const lower = decoded.toLowerCase(); return SAFE_API_SEGMENTS.has(lower) ? lower : ":opaque"; }).join("/")}`; }
function classify(method, path, host) { if (host === "official_cdn")
    return { scope: "asset_delivery", trafficClass: "asset_read" }; if (host !== "official_api")
    return { scope: "unknown", trafficClass: "unknown" }; if (/^\/auth(?:\/|$)/.test(path))
    return { scope: "authentication", trafficClass: "authentication" }; if (!["GET", "HEAD", "OPTIONS"].includes(method))
    return { scope: "account_scoped", trafficClass: "mutation_observed" }; if (/^\/(?:user|user_areas)(?:\/|$)/.test(path))
    return { scope: "account_scoped", trafficClass: "read_observed" }; if (/^\/(?:resources\/home|quests\/:id\/briefing|sd\/packs)(?:\/|$)/.test(path))
    return { scope: "mixed_product_account", trafficClass: "read_observed" }; return { scope: "global_product", trafficClass: "read_observed" }; }
function sanitizeSpecialM0Entry(captureId, raw, entryIndex) { const request = raw?.request ?? {}, response = raw?.response ?? {}; let url = null; try {
    if (typeof request.url === "string")
        url = new URL(request.url);
}
catch { /* invalid URL is unknown */ } const hostname = url?.hostname.toLowerCase() ?? "", hostClass = hostname === API ? "official_api" : hostname === CDN ? "official_cdn" : "unknown", method = typeof request.method === "string" && /^[A-Z]{1,12}$/i.test(request.method) ? request.method.toUpperCase() : "UNKNOWN", normalizedPath = normalize(url?.pathname ?? "/", hostClass), status = Number.isSafeInteger(response.status) ? response.status : 0, classification = classify(method, normalizedPath, hostClass); return { captureId, entryIndex, capturedAt: timestamp(raw?.startedDateTime), hostClass, method, normalizedPath, status, ...classification, queryKeyNames: names(url ? [...url.searchParams.keys()].map(name => ({ name })) : []), sensitiveRequestHeaderNames: names(request.headers, SENSITIVE_HEADER), sensitiveResponseHeaderNames: names(response.headers, SENSITIVE_HEADER), request: body(request.postData, 0), response: body(response.content, status) }; }
exports.sanitizeSpecialM0Entry = sanitizeSpecialM0Entry;
function buildSpecialM0(inputs, sourceLock) { if (sourceLock.schemaVersion !== 1 || sourceLock.contract !== "dokkan-special-modes-offline-source-lock" || sourceLock.contractVersion !== "0.1.0" || sourceLock.captureRoot !== "special-modes-2026-08-10" || sourceLock.captures.length !== 2)
    throw new Error("M0 source lock contract mismatch"); const entries = []; for (const input of inputs) {
    if (!sourceLock.captures.some(value => JSON.stringify(value) === JSON.stringify(input.lock)) || !/^[a-f0-9]{64}$/.test(input.lock.sha256) || buffer_1.Buffer.byteLength(input.text) !== input.lock.sizeBytes || sha256(input.text) !== input.lock.sha256)
        throw new Error(`M0 capture identity mismatch ${input.lock.captureId}`);
    const raw = JSON.parse(input.text)?.log?.entries;
    if (!Array.isArray(raw) || raw.length !== input.lock.entryCount)
        throw new Error(`M0 entry count mismatch ${input.lock.captureId}`);
    entries.push(...raw.map((value, index) => sanitizeSpecialM0Entry(input.lock.captureId, value, index)));
} const generatedAt = entries.flatMap(value => value.capturedAt ? [value.capturedAt] : []).sort().at(-1); if (!generatedAt)
    throw new Error("M0 captures have no timestamp"); const dataset = { schemaVersion: 1, contract: "dokkan-special-modes-offline-inventory", contractVersion: "0.1.0", generatedAt, generatedAtPolicy: "latest_capture_timestamp", collectionMode: "offline_local_har_no_requests_no_replay", defaultEnabled: false, productionMutation: false, replayCapability: false, valuePolicy: "metadata_and_names_only_no_header_query_cookie_or_body_values", sources: [...sourceLock.captures].sort((a, b) => a.captureId.localeCompare(b.captureId)), entries: entries.sort((a, b) => `${a.captureId}:${String(a.entryIndex).padStart(8, "0")}`.localeCompare(`${b.captureId}:${String(b.entryIndex).padStart(8, "0")}`)) }; const validation = validateSpecialM0(dataset, sourceLock); if (!validation.valid)
    throw new Error(`M0 validation failed: ${validation.failures.join(", ")}`); return dataset; }
exports.buildSpecialM0 = buildSpecialM0;
function validateSpecialM0(dataset, lock) { const failures = [], captureCounts = { "burst-mode-2026-08-10": 0, "pettan-not-live-2026-08-10": 0 }, representationCounts = Object.fromEntries(REPRESENTATIONS.map(value => [value, 0])); if (dataset.schemaVersion !== 1 || dataset.contract !== "dokkan-special-modes-offline-inventory" || dataset.contractVersion !== "0.1.0" || dataset.generatedAtPolicy !== "latest_capture_timestamp" || dataset.collectionMode !== "offline_local_har_no_requests_no_replay" || dataset.defaultEnabled !== false || dataset.productionMutation !== false || dataset.replayCapability !== false || dataset.valuePolicy !== "metadata_and_names_only_no_header_query_cookie_or_body_values")
    failures.push("dataset contract"); for (const entry of dataset.entries) {
    captureCounts[entry.captureId] += 1;
    representationCounts[entry.request.representation] += 1;
    representationCounts[entry.response.representation] += 1;
    if (!Number.isSafeInteger(entry.entryIndex) || entry.entryIndex < 0 || !entry.normalizedPath.startsWith("/") || !Number.isSafeInteger(entry.status) || entry.status < 0 || entry.status > 999 || ![entry.request.sizeBytes, entry.response.sizeBytes].every(value => Number.isSafeInteger(value) && value >= 0) || entry.sensitiveRequestHeaderNames.some(name => !SENSITIVE_HEADER.test(name)) || entry.sensitiveResponseHeaderNames.some(name => !SENSITIVE_HEADER.test(name)))
        failures.push("entry contract");
} if (lock && lock.captures.some(value => captureCounts[value.captureId] !== value.entryCount))
    failures.push("source lineage"); const expectedAt = dataset.entries.flatMap(value => value.capturedAt ? [value.capturedAt] : []).sort().at(-1); if (dataset.generatedAt !== expectedAt)
    failures.push("generatedAt"); return { schemaVersion: 1, valid: failures.length === 0, entryCount: dataset.entries.length, captureCounts, mutationObservedCount: dataset.entries.filter(value => value.trafficClass === "mutation_observed").length, representationCounts, zstandardBodyCount: dataset.entries.filter(value => value.request.representation === "zstandard_base64" || value.response.representation === "zstandard_base64").length, failures: [...new Set(failures)] }; }
exports.validateSpecialM0 = validateSpecialM0;
//# sourceMappingURL=special-m0-audit.js.map