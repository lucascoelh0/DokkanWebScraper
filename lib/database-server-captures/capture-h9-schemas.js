"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateCaptureH9 = exports.buildCaptureH9 = void 0;
const crypto_1 = require("crypto");
const buffer_1 = require("buffer");
const capture_h0_audit_1 = require("./capture-h0-audit");
const MAX_JSON_CHARS = 32 * 1024 * 1024;
const SENSITIVE_KEY = /(?:token|authorization|cookie|password|secret|signature|session|device|account|user_?id|userid)/i;
function sha256(value) { return (0, crypto_1.createHash)("sha256").update(value).digest("hex"); }
function safeKey(value) { if (SENSITIVE_KEY.test(value))
    return "[sensitive-field]"; if (!/^[A-Za-z_][A-Za-z0-9_-]{0,63}$/.test(value) || /^\d+$/.test(value) || /^[a-f0-9]{16,}$/i.test(value) || /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(value) || /(?:^|[_-])\d{2,}$/.test(value) || /^[A-Za-z0-9_-]{48,}$/.test(value))
    return "[dynamic-key]"; return value; }
function walk(value, path = "$", out = [], depth = 0) {
    if (depth > 64)
        throw new Error("H9 JSON schema exceeds depth gate");
    if (value === null)
        out.push({ path, type: "null", state: "null" });
    else if (Array.isArray(value)) {
        out.push({ path, type: "array", state: value.length ? "value" : "empty_array" });
        for (const item of value)
            walk(item, `${path}[]`, out, depth + 1);
    }
    else if (typeof value === "object") {
        const entries = Object.entries(value);
        out.push({ path, type: "object", state: entries.length ? "value" : "empty_object" });
        for (const [key, child] of entries.sort(([a], [b]) => a.localeCompare(b))) {
            const sanitized = safeKey(key);
            if (sanitized === "[sensitive-field]")
                out.push({ path: `${path}.${sanitized}`, type: child === null ? "null" : Array.isArray(child) ? "array" : typeof child, state: child === null ? "null" : Array.isArray(child) && child.length === 0 ? "empty_array" : typeof child === "object" && child !== null && Object.keys(child).length === 0 ? "empty_object" : typeof child === "string" && child.length === 0 ? "empty_string" : "value" });
            else
                walk(child, `${path}.${sanitized}`, out, depth + 1);
        }
    }
    else if (["string", "number", "boolean"].includes(typeof value))
        out.push({ path, type: typeof value, state: typeof value === "string" && value.length === 0 ? "empty_string" : "value" });
    return out;
}
function mime(value) { return typeof value === "string" ? value.split(";", 1)[0].trim().toLowerCase() : ""; }
function body(content, status) {
    if (status === 304)
        return { disposition: "not_modified", fields: [] };
    if (!content || typeof content.text !== "string" || content.text.length === 0)
        return { disposition: "body_absent", fields: [] };
    if (content.encoding === "base64")
        return { disposition: "encoded", fields: [] };
    if (content.text.length > MAX_JSON_CHARS)
        return { disposition: "oversized", fields: [] };
    const media = mime(content.mimeType);
    if (!(media === "application/json" || media.endsWith("+json")))
        return { disposition: "non_json", fields: [] };
    try {
        const fields = walk(JSON.parse(content.text));
        return { disposition: "json", fields: [...new Map(fields.map(value => [`${value.path}\0${value.type}\0${value.state}`, value])).values()].sort((a, b) => `${a.path}:${a.type}:${a.state}`.localeCompare(`${b.path}:${b.type}:${b.state}`)) };
    }
    catch (error) {
        if (error instanceof SyntaxError)
            return { disposition: "invalid_json", fields: [] };
        throw error;
    }
}
function scope(rawUrl, method, hostClass) { if (hostClass === "official_cdn")
    return "cdn"; if (hostClass !== "official_api" || typeof rawUrl !== "string")
    return "unknown"; try {
    const path = new URL(rawUrl).pathname.toLowerCase();
    if (/^\/(?:auth|sessions?)(?:\/|$)/.test(path))
        return "authentication";
    if (!['GET', 'HEAD'].includes(method) || /^\/(?:user|users|teams|gifts|shops|user_areas)(?:\/|$)/.test(path))
        return "account_scoped";
    if (/^\/(?:resources\/home|events|missions|gashas)(?:\/|$)/.test(path))
        return "mixed";
    if (/^\/(?:bonus_schedules|db_stories|title|client_assets|quests)(?:\/|$)/.test(path))
        return "global_product";
    return "unknown";
}
catch {
    return "unknown";
} }
function headerMap(value) { const out = new Map(); if (Array.isArray(value))
    for (const item of value)
        if (item && typeof item.name === "string" && typeof item.value === "string")
            out.set(item.name.toLowerCase(), item.value); return out; }
function aggregate(observations) {
    const groups = new Map();
    for (const value of observations)
        for (const side of ["request", "response"]) {
            const key = `${value.method}\0${value.normalizedPath}\0${value.scope}\0${side}`;
            groups.set(key, [...(groups.get(key) ?? []), value]);
        }
    return [...groups.entries()].map(([key, values]) => { const [method, normalizedPath, valueScope, side] = key.split("\0"); const json = values.filter(value => value[side].disposition === "json"), paths = new Map(); for (const value of json)
        for (const field of value[side].fields) {
            const current = paths.get(field.path) ?? { types: new Set(), states: new Set(), provenance: [] };
            current.types.add(field.type);
            current.states.add(field.state);
            current.provenance.push({ captureId: value.captureId, entryIndex: value.entryIndex });
            paths.set(field.path, current);
        } const fields = [...paths.entries()].map(([path, value]) => ({ path, types: [...value.types].sort(), states: [...value.states].sort(), presentCount: new Set(value.provenance.map(p => `${p.captureId}:${p.entryIndex}`)).size, absentCount: json.length - new Set(value.provenance.map(p => `${p.captureId}:${p.entryIndex}`)).size, provenance: value.provenance.sort((a, b) => `${a.captureId}:${a.entryIndex}`.localeCompare(`${b.captureId}:${b.entryIndex}`)) })); const select = (re) => fields.filter(value => re.test(value.path)).map(value => value.path).sort(); return { method, normalizedPath, scope: valueScope, side, observationCount: values.length, jsonBodyCount: json.length, notModifiedCount: values.filter(value => value[side].disposition === "not_modified").length, bodyAbsentCount: values.filter(value => value[side].disposition === "body_absent").length, otherBodyCount: values.filter(value => !["json", "not_modified", "body_absent"].includes(value[side].disposition)).length, fields: fields.sort((a, b) => a.path.localeCompare(b.path)), paginationFieldPaths: select(/(?:page|cursor|offset|limit|total|next)/i), scheduleFieldPaths: select(/(?:start|open|begin|end|close|finish|schedule|wday|week)/i), availabilityFieldPaths: select(/(?:available|active|enabled|status|locked|visible)/i), idFieldPaths: select(/(?:^|[._])(?:id|ids|.*_id|.*_ids)$/i) }; }).sort((a, b) => `${a.method}:${a.normalizedPath}:${a.scope}:${a.side}`.localeCompare(`${b.method}:${b.normalizedPath}:${b.scope}:${b.side}`));
}
function deriveCaptureH9(manifest, roots, h8, h8Text) {
    const root = roots[manifest.inputRoot];
    if (!root)
        throw new Error("H9 root not allowlisted");
    const observations = [];
    for (const input of manifest.captures) {
        const raw = JSON.parse((0, capture_h0_audit_1.readValidatedCaptureSnapshot)(root, input.path, input.captureId).text)?.log?.entries;
        const h8Capture = h8.captures.find(value => value.captureId === input.captureId);
        if (!Array.isArray(raw) || !h8Capture || raw.length !== h8Capture.entryCount)
            throw new Error("H9/H8 lineage mismatch");
        const priorByUrl = new Map();
        raw.forEach((value, index) => { const request = value?.request ?? {}, response = value?.response ?? {}, status = Number.isSafeInteger(response.status) ? response.status : 0, h8Entry = h8Capture.entries[index], method = h8Entry.method, reqHeaders = headerMap(request.headers), resHeaders = headerMap(response.headers); let cacheRelation = null; if (status === 304 && typeof request.url === "string") {
            const prior = priorByUrl.get(request.url);
            if (prior && prior.etag && reqHeaders.get("if-none-match") === prior.etag)
                cacheRelation = { priorEntryIndex: prior.index, proof: "exact_url_and_etag" };
            else if (prior && prior.lastModified && reqHeaders.get("if-modified-since") === prior.lastModified)
                cacheRelation = { priorEntryIndex: prior.index, proof: "exact_url_and_last_modified" };
        } if (typeof request.url === "string" && status >= 200 && status < 300 && status !== 204 && status !== 304)
            priorByUrl.set(request.url, { index, etag: resHeaders.get("etag"), lastModified: resHeaders.get("last-modified") }); observations.push({ captureId: input.captureId, entryIndex: index, method, normalizedPath: h8Entry.normalizedPath, status, scope: scope(request.url, method, h8Entry.hostClass), request: body(request.postData ?? {}, 0), response: body(response.content ?? {}, status), validatorHeaderNames: [...new Set([reqHeaders.has("if-none-match") ? "if-none-match" : null, reqHeaders.has("if-modified-since") ? "if-modified-since" : null, resHeaders.has("etag") ? "etag" : null, resHeaders.has("last-modified") ? "last-modified" : null].filter((v) => v !== null))].sort(), cacheRelation }); });
    }
    const dataset = { schemaVersion: 1, contract: "dokkan-official-capture-observed-schemas", contractVersion: "0.10.0", generatedAt: h8.generatedAt, generatedAtPolicy: "inherits_h8_capture_timestamp", collectionMode: "offline_local_har_no_requests", productionMutation: false, defaultEnabled: false, authority: "schema_and_cache_relation_evidence_only_values_omitted", h8ArtifactSha256: sha256(h8Text), h8ArtifactSizeBytes: buffer_1.Buffer.byteLength(h8Text), observations: observations.sort((a, b) => `${a.captureId}:${String(a.entryIndex).padStart(8, "0")}`.localeCompare(`${b.captureId}:${String(b.entryIndex).padStart(8, "0")}`)), routeSchemas: [] };
    dataset.routeSchemas = aggregate(dataset.observations);
    return dataset;
}
function buildCaptureH9(manifest, roots, h8, h8Text) { const dataset = deriveCaptureH9(manifest, roots, h8, h8Text), validation = validateCaptureH9(dataset, manifest, roots, h8, h8Text); if (!validation.valid)
    throw new Error(`H9 validation failed: ${validation.failures.join(", ")}`); return dataset; }
exports.buildCaptureH9 = buildCaptureH9;
function validateCaptureH9(dataset, manifest, roots, h8, h8Text) { const failures = []; const dispositions = ["json", "invalid_json", "not_modified", "body_absent", "non_json", "encoded", "oversized"], types = ["array", "object", "string", "number", "boolean", "null"], states = ["value", "empty_array", "empty_object", "empty_string", "null"], scopes = ["global_product", "account_scoped", "mixed", "authentication", "cdn", "unknown"]; if (dataset.schemaVersion !== 1 || dataset.contract !== "dokkan-official-capture-observed-schemas" || dataset.contractVersion !== "0.10.0" || dataset.generatedAtPolicy !== "inherits_h8_capture_timestamp" || !Number.isFinite(Date.parse(dataset.generatedAt)) || dataset.collectionMode !== "offline_local_har_no_requests" || dataset.productionMutation !== false || dataset.defaultEnabled !== false || dataset.authority !== "schema_and_cache_relation_evidence_only_values_omitted" || !/^[a-f0-9]{64}$/.test(dataset.h8ArtifactSha256) || !Number.isSafeInteger(dataset.h8ArtifactSizeBytes) || dataset.h8ArtifactSizeBytes <= 0)
    failures.push("dataset contract"); if (JSON.stringify(dataset.routeSchemas) !== JSON.stringify(aggregate(dataset.observations)))
    failures.push("route schema derivation"); for (const value of dataset.observations) {
    if (!/^[a-z0-9][a-z0-9_-]{0,47}$/.test(value.captureId) || !Number.isSafeInteger(value.entryIndex) || value.entryIndex < 0 || !scopes.includes(value.scope) || value.status === 304 !== (value.response.disposition === "not_modified") || value.cacheRelation && (value.status !== 304 || value.cacheRelation.priorEntryIndex >= value.entryIndex || !["exact_url_and_etag", "exact_url_and_last_modified"].includes(value.cacheRelation.proof)))
        failures.push("observation contract");
    for (const side of [value.request, value.response]) {
        if (!dispositions.includes(side.disposition) || side.disposition !== "json" && side.fields.length > 0)
            failures.push("body contract");
        for (const field of side.fields)
            if (!field.path.startsWith("$") || field.path.length > 1024 || !types.includes(field.type) || !states.includes(field.state))
                failures.push("field path");
    }
} if (manifest && roots && h8 && h8Text) {
    const expected = deriveCaptureH9(manifest, roots, h8, h8Text);
    if (JSON.stringify(dataset) !== JSON.stringify(expected))
        failures.push("snapshot schema lineage");
} return { schemaVersion: 1, valid: failures.length === 0, observationCount: dataset.observations.length, routeSchemaCount: dataset.routeSchemas.length, jsonObservationCount: dataset.observations.reduce((n, v) => n + (v.request.disposition === "json" ? 1 : 0) + (v.response.disposition === "json" ? 1 : 0), 0), notModifiedCount: dataset.observations.filter(v => v.response.disposition === "not_modified").length, provedCacheRelationCount: dataset.observations.filter(v => v.cacheRelation !== null).length, failures: [...new Set(failures)] }; }
exports.validateCaptureH9 = validateCaptureH9;
//# sourceMappingURL=capture-h9-schemas.js.map