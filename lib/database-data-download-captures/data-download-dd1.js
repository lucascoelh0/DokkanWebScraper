"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDd1 = exports.buildDd1 = void 0;
const data_download_core_1 = require("./data-download-core");
const API = "ishin-global.aktsk.com", CDN = "cf.ishin-global.aktsk.com";
const safeHeaderName = /^[a-z0-9!#$%&'*+.^_`|~-]{1,128}$/;
function timestamp(value) { const time = typeof value === "string" ? Date.parse(value) : NaN; return Number.isFinite(time) ? new Date(time).toISOString() : null; }
function mime(value) { if (typeof value !== "string")
    return "unknown"; const media = value.split(";", 1)[0].trim().toLowerCase(); return /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(media) ? media : "unknown"; }
function headerNames(value) { if (!Array.isArray(value))
    return []; return [...new Set(value.flatMap(item => { const name = typeof item?.name === "string" ? item.name.toLowerCase() : ""; return safeHeaderName.test(name) ? [name] : []; }))].sort(); }
function size(value) { return Number.isSafeInteger(value) && value >= 0 ? value : null; }
function strictBase64Bytes(value) { if (value.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))
    throw new Error("DD1 malformed base64 body"); return Buffer.from(value, "base64").byteLength; }
function body(content, status) {
    if (content?.encoding !== undefined && content.encoding !== "base64")
        throw new Error("DD1 unknown content encoding");
    const present = typeof content?.text === "string" && content.text.length > 0, media = mime(content?.mimeType), encoding = content?.encoding === "base64" ? "base64" : "identity", declaredSizeBytes = size(content?.size);
    const capturedSizeBytes = present ? encoding === "base64" ? strictBase64Bytes(content.text) : Buffer.byteLength(content.text) : 0;
    if (status === 304 && (present || capturedSizeBytes !== 0))
        throw new Error("DD1 304 response unexpectedly contains a body");
    const disposition = status === 304 ? "not_modified_304" : !present ? media === "application/octet-stream" ? "binary_identity_not_captured" : "absent" : encoding === "base64" ? "binary_base64" : media === "application/json" || media.endsWith("+json") ? "json_identity" : "identity_non_json";
    return { present, mimeType: media, encoding, declaredSizeBytes, capturedSizeBytes, disposition };
}
function scope(host, method, pathname) {
    if (host === CDN)
        return "cdn";
    if (host !== API)
        return "unknown";
    if (/^\/auth(?:\/|$)/.test(pathname))
        return "auth";
    if (!["GET", "HEAD", "OPTIONS"].includes(method))
        return "mutation";
    if (/^\/(?:user|cards)(?:\/|$)/.test(pathname))
        return "account";
    if (/^\/resources\/login(?:\/|$)/.test(pathname))
        return "mixed";
    if (/^\/(?:ping|title\/banners|client_assets(?:\/database)?|db_stories|iap_rails\/googleplay_products)(?:\/|$)/.test(pathname))
        return "global";
    return "unknown";
}
function buildDd1(loaded, lock, dd0) {
    if (dd0.contract !== "dokkan-data-download-source-audit" || dd0.sourceLockSha256 !== (0, data_download_core_1.sha256)(`${JSON.stringify(lock, null, 2)}\n`) || loaded.length !== lock.captures.length)
        throw new Error("DD1 requires exact DD0 lineage");
    const entries = [], temporalRelations = [];
    let priorDeviceValue = null;
    for (const source of loaded) {
        let priorApi = null, priorManifest = null;
        source.har.log.entries.forEach((raw, entryIndex) => {
            const request = raw?.request ?? {}, response = raw?.response ?? {};
            let url;
            try {
                url = new URL(request.url);
            }
            catch {
                throw new Error(`DD1 invalid URL ${source.lock.captureId}:${entryIndex}`);
            }
            if (url.protocol !== "https:" || url.port || url.username || url.password || ![API, CDN].includes(url.hostname.toLowerCase()))
                throw new Error(`DD1 non-official request target ${source.lock.captureId}:${entryIndex}`);
            const host = url.hostname.toLowerCase(), method = typeof request.method === "string" && /^[A-Z]{1,12}$/i.test(request.method) ? request.method.toUpperCase() : "UNKNOWN";
            if (method === "UNKNOWN" || !url.pathname.startsWith("/") || /[\u0000-\u001f\\]/.test(url.pathname))
                throw new Error(`DD1 unsafe request metadata ${source.lock.captureId}:${entryIndex}`);
            const entryScope = scope(host, method, url.pathname), deviceValues = url.searchParams.getAll("device_asset_size_bytes");
            if (deviceValues.length > 1)
                throw new Error(`DD1 ambiguous device_asset_size_bytes ${source.lock.captureId}:${entryIndex}`);
            const deviceValue = deviceValues[0] ?? null, deviceType = deviceValue !== null && /^\d+$/.test(deviceValue) ? "decimal_string" : "unknown";
            const relation = deviceValue === null || priorDeviceValue === null ? "not_comparable" : deviceValue === priorDeviceValue ? "equal" : "different";
            if (deviceValue !== null)
                priorDeviceValue = deviceValue;
            const requestBodyPresent = typeof request?.postData?.text === "string" && request.postData.text.length > 0 || Array.isArray(request?.postData?.params) && request.postData.params.length > 0;
            const result = { captureId: source.lock.captureId, mode: source.lock.mode, entryIndex, capturedAt: timestamp(raw?.startedDateTime), host, method, pathname: url.pathname, status: Number.isSafeInteger(response.status) && response.status >= 0 && response.status <= 999 ? response.status : 0, requestBodyPresent, request: body(request?.postData, 0), response: body(response?.content, response.status), safeRequestHeaderNames: headerNames(request.headers), safeResponseHeaderNames: headerNames(response.headers), scope: entryScope, mutationObservedOnly: entryScope === "mutation", deviceAssetSizeBytesQuery: { presence: deviceValue === null ? "absent" : "present", type: deviceValue === null ? "unknown" : deviceType, relationToPriorObservation: relation } };
            entries.push(result);
            const isManifest = host === API && ["/client_assets", "/client_assets/database", "/ondemand_assets"].includes(url.pathname);
            if (isManifest && priorApi !== null)
                temporalRelations.push({ captureId: source.lock.captureId, earlierEntryIndex: priorApi, laterEntryIndex: entryIndex, kind: "api_to_manifest", evidence: "capture_order_only" });
            if (host === CDN && priorManifest !== null)
                temporalRelations.push({ captureId: source.lock.captureId, earlierEntryIndex: priorManifest, laterEntryIndex: entryIndex, kind: "manifest_to_cdn", evidence: "capture_order_only" });
            if (host === API)
                priorApi = entryIndex;
            if (isManifest)
                priorManifest = entryIndex;
        });
    }
    const generatedAt = entries.flatMap(value => value.capturedAt ? [value.capturedAt] : []).sort().at(-1);
    if (!generatedAt)
        throw new Error("DD1 no valid timestamps");
    const dataset = { schemaVersion: 1, contract: "dokkan-data-download-lossless-entry-inventory", contractVersion: "0.1.0", generatedAt, collectionMode: "offline_local_har_no_requests_no_replay", productionMutation: false, defaultEnabled: false, valuePolicy: "no_query_header_cookie_request_body_or_account_values", sources: lock.captures.map(value => ({ ...value })), entries, temporalRelations };
    const validation = validateDd1(dataset, lock);
    if (!validation.valid)
        throw new Error(`DD1 validation failed: ${validation.failures.join(", ")}`);
    return dataset;
}
exports.buildDd1 = buildDd1;
function validateDd1(dataset, lock) {
    const failures = [];
    if (dataset.schemaVersion !== 1 || dataset.contract !== "dokkan-data-download-lossless-entry-inventory" || dataset.contractVersion !== "0.1.0" || dataset.productionMutation !== false || dataset.defaultEnabled !== false || dataset.valuePolicy !== "no_query_header_cookie_request_body_or_account_values")
        failures.push("dataset contract");
    const expectedCounts = new Map(lock?.captures.map(value => [value.captureId, value.entryCount]) ?? []), counts = new Map();
    for (const entry of dataset.entries) {
        const current = counts.get(entry.captureId) ?? 0;
        if (entry.entryIndex !== current || ![API, CDN].includes(entry.host) || !entry.pathname.startsWith("/") || entry.pathname.includes("?") || !Number.isSafeInteger(entry.status) || entry.mutationObservedOnly !== (entry.scope === "mutation") || entry.safeRequestHeaderNames.some(value => !safeHeaderName.test(value)) || entry.safeResponseHeaderNames.some(value => !safeHeaderName.test(value)) || entry.response.disposition === "not_modified_304" !== (entry.status === 304) || entry.status === 304 && (entry.response.present || entry.response.capturedSizeBytes !== 0))
            failures.push("entry contract");
        counts.set(entry.captureId, current + 1);
    }
    for (const [captureId, count] of expectedCounts)
        if ((counts.get(captureId) ?? 0) !== count)
            failures.push("source cardinality");
    for (const relation of dataset.temporalRelations)
        if (relation.earlierEntryIndex >= relation.laterEntryIndex || !dataset.entries.some(value => value.captureId === relation.captureId && value.entryIndex === relation.earlierEntryIndex) || !dataset.entries.some(value => value.captureId === relation.captureId && value.entryIndex === relation.laterEntryIndex))
            failures.push("temporal relation");
    const latest = dataset.entries.flatMap(value => value.capturedAt ? [value.capturedAt] : []).sort().at(-1);
    if (dataset.generatedAt !== latest)
        failures.push("generatedAt");
    return { schemaVersion: 1, valid: failures.length === 0, failures: [...new Set(failures)], counts: { entries: dataset.entries.length, relations: dataset.temporalRelations.length, notModified: dataset.entries.filter(value => value.response.disposition === "not_modified_304").length, deviceAssetSizeObservations: dataset.entries.filter(value => value.deviceAssetSizeBytesQuery.presence === "present").length } };
}
exports.validateDd1 = validateDd1;
//# sourceMappingURL=data-download-dd1.js.map