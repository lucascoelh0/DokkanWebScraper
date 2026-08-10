"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateFrontierF2 = exports.buildFrontierF2 = void 0;
const crypto_1 = require("crypto");
const buffer_1 = require("buffer");
const SENSITIVE_KEY = /(?:token|authorization|cookie|password|secret|signature|session|device|account|user_?id|userid)/i;
const ACCOUNT_SUBTREE = new Set(["user_origin_series", "user_origin_episode", "user_origin_battle", "special_guests", "last_deck_cards"]);
function sha256(value) { return (0, crypto_1.createHash)("sha256").update(value).digest("hex"); }
function normalize(pathname) { return `/${pathname.replace(/\/{2,}/g, "/").split("/").filter(Boolean).map(value => /^\d+$/.test(value) ? ":id" : value.toLowerCase()).join("/")}`; }
function operation(method, path) { const key = `${method} ${path}`; const routes = { "GET /origin_series": "series", "GET /origin_episodes/:id": "episode", "GET /origin_battles/briefing": "briefing", "POST /origin_battles/start": "start", "POST /kobetu_battles/commands/take_energy_ball": "take_energy_ball", "POST /kobetu_battles/commands/next_turn": "next_turn", "POST /kobetu_battles/commands/use_group_change": "use_group_change", "POST /kobetu_battles/commands/execute_trigger_skill": "execute_trigger_skill", "POST /origin_battles/finish": "finish" }; return routes[key] ?? null; }
function scope(value) { return ["start", "take_energy_ball", "next_turn", "use_group_change", "execute_trigger_skill", "finish"].includes(value) ? "account_scoped" : value === "briefing" || value === "series" || value === "episode" ? "mixed_product_account" : "global_product"; }
function fieldType(value) { return value === null ? "null" : Array.isArray(value) ? "array" : typeof value; }
function fieldState(value) { return value === null ? "null" : Array.isArray(value) && value.length === 0 ? "empty_array" : value && typeof value === "object" && Object.keys(value).length === 0 ? "empty_object" : value === "" ? "empty_string" : "value"; }
function walk(value, path = "$", out = [], depth = 0, accountScoped = false) { if (depth > 48 || out.length > 16384)
    throw new Error("F2 JSON shape exceeds safety gate"); const type = fieldType(value), state = fieldState(value); out.push({ path, type, state, accountScoped }); if (Array.isArray(value)) {
    for (const item of value)
        walk(item, `${path}[]`, out, depth + 1, accountScoped);
}
else if (value && typeof value === "object") {
    for (const [rawKey, child] of Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) {
        const sensitive = SENSITIVE_KEY.test(rawKey), childAccount = accountScoped || ACCOUNT_SUBTREE.has(rawKey) || sensitive, key = sensitive ? "[sensitive-field]" : /^[A-Za-z_][A-Za-z0-9_-]{0,63}$/.test(rawKey) ? rawKey : "[dynamic-key]", childPath = `${path}.${key}`;
        out.push({ path: childPath, type: fieldType(child), state: fieldState(child), accountScoped: childAccount });
        if (!childAccount) {
            if (Array.isArray(child))
                for (const item of child)
                    walk(item, `${childPath}[]`, out, depth + 1, false);
            else if (child && typeof child === "object")
                for (const [nestedKey, nestedValue] of Object.entries(child).sort(([a], [b]) => a.localeCompare(b))) {
                    const nestedSensitive = SENSITIVE_KEY.test(nestedKey), nested = nestedSensitive ? "[sensitive-field]" : /^[A-Za-z_][A-Za-z0-9_-]{0,63}$/.test(nestedKey) ? nestedKey : "[dynamic-key]";
                    walk(nestedValue, `${childPath}.${nested}`, out, depth + 1, nestedSensitive);
                }
        }
    }
} return out; }
function aggregateFields(atoms) { const groups = new Map(); for (const atom of atoms) {
    const key = `${atom.path}\0${atom.accountScoped}`, current = groups.get(key) ?? { path: atom.path, types: [], states: [], accountScoped: atom.accountScoped };
    if (!current.types.includes(atom.type))
        current.types.push(atom.type);
    if (!current.states.includes(atom.state))
        current.states.push(atom.state);
    groups.set(key, current);
} return [...groups.values()].map(value => ({ ...value, types: value.types.sort(), states: value.states.sort() })).sort((a, b) => `${a.path}:${a.accountScoped}`.localeCompare(`${b.path}:${b.accountScoped}`)); }
function plainBody(content) { if (!content || typeof content.text !== "string" || content.text.length === 0)
    return { disposition: "body_absent", fields: [], compressedEvidence: null }; if (content.encoding === "base64")
    return { disposition: "encoded_unknown", fields: [], compressedEvidence: null }; const media = typeof content.mimeType === "string" ? content.mimeType.split(";", 1)[0].trim().toLowerCase() : ""; if (!(media === "application/json" || media.endsWith("+json")))
    return { disposition: "non_json", fields: [], compressedEvidence: null }; try {
    return { disposition: "json_shape", fields: aggregateFields(walk(JSON.parse(content.text))), compressedEvidence: null };
}
catch {
    return { disposition: "non_json", fields: [], compressedEvidence: null };
} }
function aggregate(observations) { const groups = new Map(); for (const value of observations) {
    const key = `${value.method}\0${value.normalizedPath}\0${value.operation}\0${value.scope}`;
    groups.set(key, [...(groups.get(key) ?? []), value]);
} return [...groups.entries()].map(([key, values]) => { const [method, normalizedPath, op, valueScope] = key.split("\0"); return { method, normalizedPath, operation: op, scope: valueScope, observationCount: values.length, requestFields: aggregateFields(values.flatMap(value => value.request.fields.flatMap(field => field.types.flatMap(type => field.states.map(state => ({ path: field.path, type, state, accountScoped: field.accountScoped })))))), responseFields: aggregateFields(values.flatMap(value => value.response.fields.flatMap(field => field.types.flatMap(type => field.states.map(state => ({ path: field.path, type, state, accountScoped: field.accountScoped })))))), responseDispositions: [...new Set(values.map(value => value.response.disposition))].sort(), provenance: values.map(value => ({ entryIndex: value.entryIndex, capturedAt: value.capturedAt })).sort((a, b) => a.entryIndex - b.entryIndex) }; }).sort((a, b) => `${a.method}:${a.normalizedPath}`.localeCompare(`${b.method}:${b.normalizedPath}`)); }
function buildFrontierF2(harText, f1, f1Text) { const entries = JSON.parse(harText)?.log?.entries; if (!Array.isArray(entries))
    throw new Error("F2 invalid HAR"); const evidence = new Map(f1.bodies.map(value => [value.entryIndex, value])), observations = []; entries.forEach((entry, entryIndex) => { let path; try {
    path = normalize(new URL(entry.request.url).pathname);
}
catch {
    return;
} const method = typeof entry.request?.method === "string" ? entry.request.method.toUpperCase() : "UNKNOWN", op = operation(method, path); if (!op)
    return; const compressed = evidence.get(entryIndex), response = compressed ? { disposition: "compressed_unknown", fields: [], compressedEvidence: { compressedSha256: compressed.compressedSha256, compressedSizeBytes: compressed.compressedSizeBytes, dictionaryId: compressed.frame.dictionaryId, reason: "dictionary_not_proved" } } : plainBody(entry.response?.content), capturedAt = typeof entry.startedDateTime === "string" && Number.isFinite(Date.parse(entry.startedDateTime)) ? new Date(entry.startedDateTime).toISOString() : null; if (!capturedAt)
    throw new Error("F2 target observation lacks timestamp"); observations.push({ entryIndex, capturedAt, method, normalizedPath: path, status: Number.isSafeInteger(entry.response?.status) ? entry.response.status : 0, scope: scope(op), operation: op, request: plainBody(entry.request?.postData), response }); }); const dataset = { schemaVersion: 1, contract: "dokkan-frontier-sanitized-offline-shapes", contractVersion: "0.3.0", generatedAt: f1.generatedAt, generatedAtPolicy: "inherits_f1_capture_timestamp", collectionMode: "offline_local_har_no_requests_no_replay", productionMutation: false, defaultEnabled: false, valuePolicy: "field_types_presence_and_nullability_only_account_values_excluded", f1ArtifactSha256: sha256(f1Text), f1ArtifactSizeBytes: buffer_1.Buffer.byteLength(f1Text), observations, routeSchemas: aggregate(observations) }; const validation = validateFrontierF2(dataset, f1, f1Text); if (!validation.valid)
    throw new Error(`F2 validation failed: ${validation.failures.join(", ")}`); return dataset; }
exports.buildFrontierF2 = buildFrontierF2;
function validateFrontierF2(dataset, f1, f1Text) { const failures = []; if (dataset.schemaVersion !== 1 || dataset.contract !== "dokkan-frontier-sanitized-offline-shapes" || dataset.contractVersion !== "0.3.0" || dataset.generatedAtPolicy !== "inherits_f1_capture_timestamp" || dataset.collectionMode !== "offline_local_har_no_requests_no_replay" || dataset.productionMutation !== false || dataset.defaultEnabled !== false || dataset.valuePolicy !== "field_types_presence_and_nullability_only_account_values_excluded" || !/^[a-f0-9]{64}$/.test(dataset.f1ArtifactSha256) || dataset.f1ArtifactSizeBytes <= 0)
    failures.push("dataset contract"); if (JSON.stringify(dataset.routeSchemas) !== JSON.stringify(aggregate(dataset.observations)))
    failures.push("route aggregation"); const indexes = new Set(); for (const value of dataset.observations) {
    if (indexes.has(value.entryIndex) || !Number.isFinite(Date.parse(value.capturedAt)) || value.response.disposition === "compressed_unknown" !== (value.response.compressedEvidence !== null) || [...value.request.fields, ...value.response.fields].some(field => !field.path.startsWith("$") || field.types.length === 0 || field.states.length === 0))
        failures.push("observation contract");
    indexes.add(value.entryIndex);
} if (f1 && f1Text && (dataset.generatedAt !== f1.generatedAt || dataset.f1ArtifactSha256 !== sha256(f1Text) || dataset.f1ArtifactSizeBytes !== buffer_1.Buffer.byteLength(f1Text) || dataset.observations.filter(value => value.response.disposition === "compressed_unknown").length !== f1.bodies.length))
    failures.push("F1 lineage"); return { schemaVersion: 1, valid: failures.length === 0, observationCount: dataset.observations.length, routeSchemaCount: dataset.routeSchemas.length, compressedUnknownCount: dataset.observations.filter(value => value.response.disposition === "compressed_unknown").length, accountScopedFieldCount: dataset.routeSchemas.reduce((sum, value) => sum + value.requestFields.filter(field => field.accountScoped).length + value.responseFields.filter(field => field.accountScoped).length, 0), failures: [...new Set(failures)] }; }
exports.validateFrontierF2 = validateFrontierF2;
//# sourceMappingURL=frontier-f2-shapes.js.map