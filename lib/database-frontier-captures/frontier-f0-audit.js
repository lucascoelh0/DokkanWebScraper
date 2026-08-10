"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateFrontierF0 = exports.buildFrontierF0 = exports.sanitizeFrontierF0Entry = void 0;
const crypto_1 = require("crypto");
const buffer_1 = require("buffer");
const OFFICIAL_API = "ishin-global.aktsk.com";
const OFFICIAL_CDN = "cf.ishin-global.aktsk.com";
const SENSITIVE_HEADER = /^(?:authorization|cookie|set-cookie|x-api(?:token|-token|-key)|x-apitoken|x-user(?:id|-id|-country|-currency)|x-device(?:id|-id|-token)|x-session(?:id|-id|-token)|x-signature)$/i;
const API_SEGMENTS = new Set(["announcements", "auth", "briefing", "commands", "execute_trigger_skill", "finish", "iap_rails", "kobetu_battles", "missions", "next_turn", "nonce", "notify", "origin_battles", "origin_episodes", "origin_series", "put_forward", "resources", "sign_in", "start", "take_energy_ball", "title", "banners", "use_group_change", "user"]);
const trafficClasses = ["read_product", "mutation_observed", "cdn", "authentication", "account_state", "telemetry", "unknown"];
const scopes = ["global_product", "mixed_product_account", "account_scoped", "authentication", "asset_delivery", "telemetry", "unknown"];
function sha256(value) { return (0, crypto_1.createHash)("sha256").update(value).digest("hex"); }
function timestamp(value) { const parsed = typeof value === "string" ? Date.parse(value) : NaN; return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null; }
function mime(value) { if (typeof value !== "string")
    return "unknown"; const result = value.split(";", 1)[0].trim().toLowerCase(); return /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(result) ? result : "unknown"; }
function uniqueSafeNames(value, filter) { if (!Array.isArray(value))
    return []; return [...new Set(value.flatMap(item => { const name = item && typeof item === "object" ? item.name : null; return typeof name === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(name) && (!filter || filter.test(name)) ? [name.toLowerCase()] : []; }))].sort(); }
function bodyBytes(content) { if (!content || typeof content.text !== "string")
    return 0; try {
    return content.encoding === "base64" ? buffer_1.Buffer.from(content.text, "base64").byteLength : buffer_1.Buffer.byteLength(content.text);
}
catch {
    return 0;
} }
function hostClass(host) { if (host === OFFICIAL_API)
    return "official_api"; if (host === OFFICIAL_CDN)
    return "official_cdn"; if (/(?:googleapis|firebase|crashlytics|app-measurement)\./.test(host) || host.endsWith(".google.com"))
    return "telemetry"; return "unknown"; }
function normalizePath(pathname, host) {
    const collapsed = pathname.replace(/\/{2,}/g, "/");
    if (host === "official_cdn") {
        const extension = collapsed.toLowerCase().match(/\.([a-z0-9]{1,8})$/)?.[1];
        return `/asset/${extension && ["jpg", "jpeg", "png", "webp", "gif", "json", "db"].includes(extension) ? extension : "unknown"}`;
    }
    if (host !== "official_api")
        return "/:unknown";
    return `/${collapsed.split("/").filter(Boolean).map(segment => { let decoded; try {
        decoded = decodeURIComponent(segment);
    }
    catch {
        return ":opaque";
    } if (/^\d+$/.test(decoded))
        return ":id"; const lower = decoded.toLowerCase(); return API_SEGMENTS.has(lower) ? lower : ":opaque"; }).join("/")}`;
}
function classify(method, path, host) {
    if (host === "official_cdn")
        return { trafficClass: "cdn", scope: "asset_delivery" };
    if (host === "telemetry")
        return { trafficClass: "telemetry", scope: "telemetry" };
    if (host !== "official_api")
        return { trafficClass: "unknown", scope: "unknown" };
    if (/^\/auth(?:\/|$)/.test(path))
        return { trafficClass: "authentication", scope: "authentication" };
    if (!["GET", "HEAD", "OPTIONS"].includes(method))
        return { trafficClass: "mutation_observed", scope: "account_scoped" };
    if (/^\/(?:user|resources\/login|missions\/put_forward)(?:\/|$)/.test(path))
        return { trafficClass: "account_state", scope: "account_scoped" };
    if (/^\/(?:origin_series|origin_episodes\/:id|origin_battles\/briefing)(?:\/|$)/.test(path))
        return { trafficClass: "read_product", scope: "mixed_product_account" };
    return { trafficClass: "read_product", scope: "global_product" };
}
function sanitizeFrontierF0Entry(raw, entryIndex) {
    const request = raw?.request ?? {}, response = raw?.response ?? {};
    let url = null;
    try {
        if (typeof request.url === "string")
            url = new URL(request.url);
    }
    catch { /* unknown */ }
    const host = hostClass(url?.hostname.toLowerCase() ?? ""), method = typeof request.method === "string" && /^[A-Z]{1,12}$/i.test(request.method) ? request.method.toUpperCase() : "UNKNOWN", path = normalizePath(url?.pathname ?? "/", host), classification = classify(method, path, host), responseContent = response.content ?? {};
    return { entryIndex, capturedAt: timestamp(raw?.startedDateTime), hostClass: host, method, normalizedPath: path, status: Number.isSafeInteger(response.status) ? response.status : 0, ...classification, queryKeyNames: uniqueSafeNames(url ? [...url.searchParams.keys()].map(name => ({ name })) : []), requestMimeType: mime(request.postData?.mimeType), responseMimeType: mime(responseContent.mimeType), requestBodyBytes: bodyBytes(request.postData), responseBodyBytes: bodyBytes(responseContent), responseContentEncoding: responseContent.encoding === "base64" ? "base64" : typeof responseContent.text === "string" ? "identity" : "unknown", sensitiveRequestHeaderNames: uniqueSafeNames(request.headers, SENSITIVE_HEADER), sensitiveResponseHeaderNames: uniqueSafeNames(response.headers, SENSITIVE_HEADER) };
}
exports.sanitizeFrontierF0Entry = sanitizeFrontierF0Entry;
function buildFrontierF0(harText, lock) {
    if (lock.schemaVersion !== 1 || lock.contract !== "dokkan-frontier-offline-capture-source-lock" || lock.contractVersion !== "0.1.0" || lock.captureRoot !== "dokkan-har-0810" || !/^[a-f0-9]{64}$/.test(lock.sha256) || !Number.isSafeInteger(lock.sizeBytes) || lock.sizeBytes <= 0 || !Number.isSafeInteger(lock.entryCount) || lock.entryCount <= 0)
        throw new Error("F0 source lock contract mismatch");
    if (buffer_1.Buffer.byteLength(harText) !== lock.sizeBytes || sha256(buffer_1.Buffer.from(harText)) !== lock.sha256)
        throw new Error("F0 HAR identity mismatch");
    const rawEntries = JSON.parse(harText)?.log?.entries;
    if (!Array.isArray(rawEntries) || rawEntries.length !== lock.entryCount)
        throw new Error("F0 HAR entry count mismatch");
    const entries = rawEntries.map(sanitizeFrontierF0Entry), generatedAt = entries.flatMap(value => value.capturedAt ? [value.capturedAt] : []).sort().at(-1);
    if (!generatedAt)
        throw new Error("F0 capture has no valid timestamp");
    const dataset = { schemaVersion: 1, contract: "dokkan-frontier-offline-capture-inventory", contractVersion: "0.1.0", generatedAt, generatedAtPolicy: "latest_capture_timestamp_for_deterministic_bytes", collectionMode: "offline_local_har_no_requests_no_replay", productionMutation: false, defaultEnabled: false, authority: "structural_observation_only_no_account_or_product_authority", source: { captureId: lock.captureId, fileName: lock.fileName, sizeBytes: lock.sizeBytes, sha256: lock.sha256, entryCount: lock.entryCount }, entries };
    const validation = validateFrontierF0(dataset, lock);
    if (!validation.valid)
        throw new Error(`F0 validation failed: ${validation.failures.join(", ")}`);
    return dataset;
}
exports.buildFrontierF0 = buildFrontierF0;
function validateFrontierF0(dataset, lock) {
    const failures = [], trafficClassCounts = Object.fromEntries(trafficClasses.map(value => [value, 0])), scopeCounts = Object.fromEntries(scopes.map(value => [value, 0]));
    if (dataset.schemaVersion !== 1 || dataset.contract !== "dokkan-frontier-offline-capture-inventory" || dataset.contractVersion !== "0.1.0" || dataset.generatedAtPolicy !== "latest_capture_timestamp_for_deterministic_bytes" || dataset.collectionMode !== "offline_local_har_no_requests_no_replay" || dataset.productionMutation !== false || dataset.defaultEnabled !== false || dataset.authority !== "structural_observation_only_no_account_or_product_authority" || !Number.isFinite(Date.parse(dataset.generatedAt)))
        failures.push("dataset contract");
    dataset.entries.forEach((value, index) => { if (value.entryIndex !== index || !trafficClasses.includes(value.trafficClass) || !scopes.includes(value.scope) || !["official_api", "official_cdn", "telemetry", "unknown"].includes(value.hostClass) || !/^[A-Z]{1,12}$/.test(value.method) || !value.normalizedPath.startsWith("/") || !Number.isSafeInteger(value.status) || value.status < 0 || value.status > 999 || ![value.requestBodyBytes, value.responseBodyBytes].every(size => Number.isSafeInteger(size) && size >= 0) || value.capturedAt !== null && !Number.isFinite(Date.parse(value.capturedAt)) || !value.sensitiveRequestHeaderNames.every(name => SENSITIVE_HEADER.test(name)) || !value.sensitiveResponseHeaderNames.every(name => SENSITIVE_HEADER.test(name)))
        failures.push("entry contract"); trafficClassCounts[value.trafficClass] += 1; scopeCounts[value.scope] += 1; });
    if (dataset.generatedAt !== dataset.entries.flatMap(value => value.capturedAt ? [value.capturedAt] : []).sort().at(-1))
        failures.push("generatedAt");
    if (lock && (dataset.source.captureId !== lock.captureId || dataset.source.fileName !== lock.fileName || dataset.source.sizeBytes !== lock.sizeBytes || dataset.source.sha256 !== lock.sha256 || dataset.source.entryCount !== lock.entryCount || dataset.entries.length !== lock.entryCount))
        failures.push("source lineage");
    return { schemaVersion: 1, valid: failures.length === 0, entryCount: dataset.entries.length, targetHostEntryCount: dataset.entries.filter(value => value.hostClass === "official_api" || value.hostClass === "official_cdn").length, trafficClassCounts, scopeCounts, failures: [...new Set(failures)] };
}
exports.validateFrontierF0 = validateFrontierF0;
//# sourceMappingURL=frontier-f0-audit.js.map