"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateCaptureH10 = exports.buildCaptureH10 = void 0;
const crypto_1 = require("crypto");
const buffer_1 = require("buffer");
const capture_h0_audit_1 = require("./capture-h0-audit");
const domains = ["events_schedules", "gashas", "missions_boards_rewards", "profile_account", "assets_descriptors", "misc"];
const ID_FIELDS = new Set(["id", "event_id", "event_ids", "quest_id", "quest_ids", "mission_id", "mission_ids", "gasha_id", "gasha_ids", "card_id", "card_ids", "featured_card_ids", "normal_card_ids", "category_id", "mission_category_id", "reward_id", "display_reward_id", "campaign_id", "campaign_ids", "campaign_complete_mission_id", "complete_mission_id", "announcement_id", "item_id"]);
const TIME_FIELDS = new Set(["start_at", "open_at", "begin_at", "end_at", "close_at", "finish_at", "available_at", "expired_at"]);
const VALUE_FIELDS = new Set(["rate", "featured_rate", "normal_rate", "total_rate", "quantity", "amount", "version", "asset_no"]);
function sha256(v) { return (0, crypto_1.createHash)("sha256").update(v).digest("hex"); }
function sorted(v) { return [...new Set(v)].sort((a, b) => String(a).localeCompare(String(b))); }
function classify(path, host) { if (host === "cf.ishin-global.aktsk.com" || /^\/client_assets(?:\/|$)/.test(path))
    return "assets_descriptors"; if (/^\/(?:events|db_stories|bonus_schedules|quests)(?:\/|$)/.test(path))
    return "events_schedules"; if (/^\/(?:gashas|title\/banners)(?:\/|$)/.test(path))
    return "gashas"; if (/^\/missions(?:\/|$)/.test(path))
    return "missions_boards_rewards"; if (/^\/(?:auth|sessions?|user|users|resources\/(?:home|login))(?:\/|$)/.test(path))
    return "profile_account"; return "misc"; }
function route(path, domain) { const s = path.split("/").filter(Boolean).map(x => /^\d+$/.test(x) ? ":id" : x.toLowerCase()); const allow = { events_schedules: new Set(["events", "eventkagi_events", "db_stories", "bonus_schedules", "quests", "briefing", "start", "finish"]), gashas: new Set(["gashas", "featured_cards", "rates", "title", "banners", "draw"]), missions_boards_rewards: new Set(["missions", "mission_board_campaigns", "images", "accept", "put_forward"]), profile_account: new Set(["auth", "sessions", "user", "users", "resources", "home", "login", "sign_in", "profile"]), assets_descriptors: new Set(["client_assets", "database"]), misc: new Set(["gifts", "shops", "teams", "items", "exchange", "purchase", "sell"]) }; return "/" + s.map(x => x === ":id" || allow[domain].has(x) ? x : ":opaque").join("/"); }
function definitionFields(method, path) { if (method !== "GET")
    return null; if (/^\/events\/eventkagi_events$/.test(path))
    return new Set(["$.eventkagi_events[].id", "$.eventkagi_events[].end_at", "$.eventkagi_events[].announcement_id", "$.eventkagi_events[].quests[].id", "$.eventkagi_z_battle_stages[].id", "$.eventkagi_z_battle_stages[].announcement_id"]); if (/^\/bonus_schedules$/.test(path))
    return new Set(["$.bonus_schedules[].id", "$.bonus_schedules[].start_at", "$.bonus_schedules[].end_at", "$.bonus_schedules[].rate"]); if (/^\/gashas\/\d+\/featured_cards$/.test(path))
    return new Set(["$.gasha_items[].card_id"]); if (/^\/gashas\/\d+\/rates$/.test(path))
    return new Set(["$.steps[].gasha_rates.id", "$.steps[].gasha_rates.featured_card_ids", "$.steps[].gasha_rates.normal_card_ids", "$.steps[].gasha_rates.rarities[].featured_rate", "$.steps[].gasha_rates.rarities[].normal_rate", "$.steps[].gasha_rates.rarities[].total_rate", "$.steps[].special_gashas[].id", "$.steps[].special_gashas[].featured_card_ids", "$.steps[].special_gashas[].normal_card_ids"]); if (/^\/missions\/mission_board_campaigns$/.test(path))
    return new Set(["$.mission_board_campaigns[].id", "$.mission_board_campaigns[].start_at", "$.mission_board_campaigns[].end_at", "$.mission_board_campaigns[].announcement_id", "$.mission_board_campaigns[].campaign_complete_mission_id", "$.mission_board_campaigns[].mission_boards[].id", "$.mission_board_campaigns[].mission_boards[].complete_mission_id", "$.mission_board_campaigns[].mission_boards[].display_reward_id", "$.mission_board_campaigns[].mission_boards[].mission_category_id"]); return null; }
function parentId(path) { for (const s of path.split("/")) {
    const n = Number(s);
    if (Number.isSafeInteger(n) && n > 0)
        return n;
} return null; }
function extract(value, allowed, out = [], path = "$") { if (!value || typeof value !== "object")
    return out; if (Array.isArray(value)) {
    for (const child of value)
        extract(child, allowed, out, `${path}[]`);
    return out;
} for (const [key, child] of Object.entries(value)) {
    const coordinate = `${path}.${key}`;
    if (allowed.has(coordinate) && ID_FIELDS.has(key)) {
        for (const candidate of Array.isArray(child) ? child : [child]) {
            const n = typeof candidate === "number" ? candidate : typeof candidate === "string" && /^\d+$/.test(candidate) ? Number(candidate) : NaN;
            if (Number.isSafeInteger(n) && n > 0)
                out.push({ field: key, value: n });
        }
    }
    else if (allowed.has(coordinate) && TIME_FIELDS.has(key)) {
        if (typeof child === "number" && Number.isFinite(child))
            out.push({ field: key, value: child });
        else if (typeof child === "string" && Number.isFinite(Date.parse(child)))
            out.push({ field: key, value: new Date(Date.parse(child)).toISOString() });
    }
    else if (allowed.has(coordinate) && VALUE_FIELDS.has(key) && typeof child === "number" && Number.isFinite(child))
        out.push({ field: key, value: child });
    if (child && typeof child === "object")
        extract(child, allowed, out, coordinate);
} return out; }
function derive(manifest, roots, h9, h9Text) {
    const root = roots[manifest.inputRoot];
    if (!root)
        throw new Error("H10 root not allowlisted");
    const buckets = new Map(), facts = new Map(), rels = new Map();
    for (const d of domains)
        buckets.set(d, { obs: [], routes: [], paths: [] });
    let accept200 = 0, lastStatus = null;
    for (const input of manifest.captures) {
        const raw = JSON.parse((0, capture_h0_audit_1.readValidatedCaptureSnapshot)(root, input.path, input.captureId).text)?.log?.entries;
        if (!Array.isArray(raw))
            throw new Error("H10 invalid HAR");
        raw.forEach((entry, index) => { const observation = h9.observations.find(v => v.captureId === input.captureId && v.entryIndex === index); if (!observation)
            throw new Error("H10/H9 lineage mismatch"); let url = null; try {
            url = new URL(entry?.request?.url);
        }
        catch { } const path = url?.pathname.toLowerCase() ?? "/", host = url?.hostname.toLowerCase() ?? "", domain = classify(path, host), safeRoute = route(path, domain), bucket = buckets.get(domain); bucket.obs.push(observation); bucket.routes.push(safeRoute); for (const side of [observation.request, observation.response])
            for (const field of side.fields)
                bucket.paths.push(field.path); if (input.captureId === "event-mission-crash" && host === "ishin-global.aktsk.com") {
            lastStatus = observation.status;
            if (observation.method === "POST" && /\/missions\/accept(?:\/|$)/.test(path) && observation.status === 200)
                accept200++;
        } const allowed = definitionFields(observation.method, path); if (host !== "ishin-global.aktsk.com" || !allowed || observation.status !== 200 || observation.response.disposition !== "json")
            return; const p = parentId(path), provenance = { captureId: input.captureId, entryIndex: index }; for (const fact of extract(JSON.parse(entry.response.content.text), allowed)) {
            const key = JSON.stringify([domain, safeRoute, p, fact.field, fact.value]);
            const current = facts.get(key) ?? { domain: domain, route: safeRoute, parentId: p, field: fact.field, value: fact.value, confidence: "partial_authenticated_observation", provenance: [] };
            current.provenance.push(provenance);
            facts.set(key, current);
            if (p && ID_FIELDS.has(fact.field) && typeof fact.value === "number" && fact.value !== p) {
                const rk = JSON.stringify([domain, safeRoute, p, fact.field, fact.value]);
                const rel = rels.get(rk) ?? { domain: domain, route: safeRoute, parentId: p, childField: fact.field, childId: fact.value, confidence: "partial_structural_relation", provenance: [] };
                rel.provenance.push(provenance);
                rels.set(rk, rel);
            }
        } });
    }
    const summaries = [...buckets.entries()].map(([domain, b]) => ({ domain, observationCount: b.obs.length, readCount: b.obs.filter(v => ["GET", "HEAD"].includes(v.method)).length, mutationCount: b.obs.filter(v => !["GET", "HEAD"].includes(v.method)).length, statusCodes: sorted(b.obs.map(v => v.status)), routes: sorted(b.routes), schemaFieldPaths: sorted(b.paths), accountValuePolicy: domain === "profile_account" || domain === "misc" ? "values_excluded_structure_only" : "not_applicable" }));
    const normalize = (v) => ({ ...v, provenance: [...new Map(v.provenance.map(p => [`${p.captureId}:${p.entryIndex}`, p])).values()].sort((a, b) => `${a.captureId}:${a.entryIndex}`.localeCompare(`${b.captureId}:${b.entryIndex}`)) });
    return { schemaVersion: 1, contract: "dokkan-official-capture-domain-audit", contractVersion: "0.11.0", generatedAt: h9.generatedAt, generatedAtPolicy: "inherits_h9_capture_timestamp", collectionMode: "offline_local_har_no_requests_no_replay", productionMutation: false, defaultEnabled: false, authority: "partial_product_observation_and_account_structure_only", accountFixturePolicy: "no_personal_or_account_scalar_values", h9ArtifactSha256: sha256(h9Text), h9ArtifactSizeBytes: buffer_1.Buffer.byteLength(h9Text), domains: summaries.sort((a, b) => a.domain.localeCompare(b.domain)), productFacts: [...facts.values()].map(normalize).sort((a, b) => JSON.stringify([a.domain, a.route, a.parentId, a.field, a.value]).localeCompare(JSON.stringify([b.domain, b.route, b.parentId, b.field, b.value]))), relationships: [...rels.values()].map(normalize).sort((a, b) => JSON.stringify([a.domain, a.route, a.parentId, a.childField, a.childId]).localeCompare(JSON.stringify([b.domain, b.route, b.parentId, b.childField, b.childId]))), crashBoundary: { captureId: "event-mission-crash", acceptedMissionMutationStatus200Count: accept200, lastObservedOfficialApiStatus: lastStatus, causality: "not_established_request_before_crash_only", currentHypothesis: "instrumentation_interception_plus_x86_64_arm64_libhoudini_glthread_incompatibility" } };
}
function buildCaptureH10(m, r, h, t) { const d = derive(m, r, h, t), v = validateCaptureH10(d, m, r, h, t); if (!v.valid)
    throw new Error(`H10 validation failed: ${v.failures.join(", ")}`); return d; }
exports.buildCaptureH10 = buildCaptureH10;
function validProvenance(values) { return values.length > 0 && values.every(v => /^[a-z0-9][a-z0-9_-]{0,47}$/.test(v.captureId) && Number.isSafeInteger(v.entryIndex) && v.entryIndex >= 0) && new Set(values.map(v => `${v.captureId}:${v.entryIndex}`)).size === values.length; }
function validateCaptureH10(d, m, r, h, t) { const f = []; if (d.schemaVersion !== 1 || d.contract !== "dokkan-official-capture-domain-audit" || d.contractVersion !== "0.11.0" || d.generatedAtPolicy !== "inherits_h9_capture_timestamp" || !Number.isFinite(Date.parse(d.generatedAt)) || d.collectionMode !== "offline_local_har_no_requests_no_replay" || d.productionMutation !== false || d.defaultEnabled !== false || d.authority !== "partial_product_observation_and_account_structure_only" || d.accountFixturePolicy !== "no_personal_or_account_scalar_values" || d.domains.length !== 6 || JSON.stringify(d.domains.map(v => v.domain).sort()) !== JSON.stringify([...domains].sort()) || !/^[a-f0-9]{64}$/.test(d.h9ArtifactSha256) || !Number.isSafeInteger(d.h9ArtifactSizeBytes) || d.h9ArtifactSizeBytes <= 0)
    f.push("contract"); for (const fact of d.productFacts)
    if ((!ID_FIELDS.has(fact.field) && !TIME_FIELDS.has(fact.field) && !VALUE_FIELDS.has(fact.field)) || !["events_schedules", "gashas", "missions_boards_rewards", "assets_descriptors"].includes(fact.domain) || !fact.route.startsWith("/") || fact.parentId !== null && (!Number.isSafeInteger(fact.parentId) || fact.parentId <= 0) || typeof fact.value === "number" && !Number.isFinite(fact.value) || typeof fact.value === "string" && !Number.isFinite(Date.parse(fact.value)) || fact.confidence !== "partial_authenticated_observation" || !validProvenance(fact.provenance))
        f.push("fact contract"); for (const rel of d.relationships)
    if (!["events_schedules", "gashas", "missions_boards_rewards"].includes(rel.domain) || !rel.route.startsWith("/") || !ID_FIELDS.has(rel.childField) || ![rel.parentId, rel.childId].every(v => Number.isSafeInteger(v) && v > 0) || rel.confidence !== "partial_structural_relation" || !validProvenance(rel.provenance))
        f.push("relationship contract"); if (d.crashBoundary.captureId !== "event-mission-crash" || !Number.isSafeInteger(d.crashBoundary.acceptedMissionMutationStatus200Count) || d.crashBoundary.acceptedMissionMutationStatus200Count < 0 || d.crashBoundary.lastObservedOfficialApiStatus !== null && !Number.isSafeInteger(d.crashBoundary.lastObservedOfficialApiStatus) || d.crashBoundary.causality !== "not_established_request_before_crash_only" || d.crashBoundary.currentHypothesis !== "instrumentation_interception_plus_x86_64_arm64_libhoudini_glthread_incompatibility")
    f.push("crash boundary"); if (m && r && h && t && JSON.stringify(d) !== JSON.stringify(derive(m, r, h, t)))
    f.push("snapshot lineage"); return { schemaVersion: 1, valid: f.length === 0, domainCount: d.domains.length, productFactCount: d.productFacts.length, relationshipCount: d.relationships.length, accountSchemaPathCount: d.domains.filter(v => v.accountValuePolicy === "values_excluded_structure_only").reduce((n, v) => n + v.schemaFieldPaths.length, 0), failures: [...new Set(f)] }; }
exports.validateCaptureH10 = validateCaptureH10;
//# sourceMappingURL=capture-h10-domains.js.map