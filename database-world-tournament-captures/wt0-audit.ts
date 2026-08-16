import { createHash } from "crypto";
import { relative } from "path";
import { Wt0CacheRelation, Wt0Dataset, Wt0Entry, Wt0StructuralId, Wt0Validation, WtBodyDisposition, WtEvidenceClass, WtExternalSourceLock, WtSchemaNode, WtSchemaType } from "./wt0-contract";

const SENSITIVE_KEY = /(?:token|authorization|cookie|credential|device|password|secret|session|sign(?:ature)?|user(?:_|-)?id|account|nonce|name|point|ranking)/i;
const WT_CANDIDATE = /^\/(?:resources\/home|bonus_schedules|budokais(?:\/|$)|quests\/\d+\/briefing|images\/[a-z]+\/(?:budokai|help_ten1|help)(?:\/|$))/i;

function sha256(value: string | Buffer): string { return createHash("sha256").update(value).digest("hex"); }
function object(value: unknown): Record<string, unknown> | null { return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function text(value: unknown): string | null { return typeof value === "string" ? value : null; }
function schemaType(value: unknown): WtSchemaType { return value === null ? "null" : Array.isArray(value) ? "array" : typeof value as WtSchemaType; }

function collectSchema(value: unknown): WtSchemaNode[] {
    const paths = new Map<string, Set<WtSchemaType>>();
    const visit = (current: unknown, path: string): void => {
        const type = schemaType(current);
        if (!["array", "boolean", "null", "number", "object", "string"].includes(type)) throw new Error(`unsupported schema type at ${path}`);
        const set = paths.get(path) ?? new Set<WtSchemaType>(); set.add(type); paths.set(path, set);
        if (Array.isArray(current)) for (const child of current) visit(child, `${path}[]`);
        else { const row = object(current); if (row) for (const key of Object.keys(row).sort()) visit(row[key], `${path}.${key}`); }
    };
    visit(value, "$");
    return [...paths].map(([path, types]) => ({ path, types: [...types].sort() })).sort((a, b) => a.path.localeCompare(b.path));
}

function parseJsonBody(raw: unknown, route: string): { disposition: WtBodyDisposition; schema: WtSchemaNode[] } {
    if (typeof raw !== "string") return { disposition: "absent", schema: [] };
    let parsed: unknown; try { parsed = JSON.parse(raw); } catch { return { disposition: "binary_or_unparsed_not_retained", schema: [] }; }
    const schema = collectSchema(parsed);
    return { disposition: route === "/budokais/:budokai_id/tournaments" ? "opaque_envelope_schema_only" : "schema_only", schema };
}

function routeOf(path: string): string | null {
    if (!WT_CANDIDATE.test(path)) return null;
    const known = path.toLowerCase()
        .replace(/^\/budokais\/\d+/, "/budokais/:budokai_id")
        .replace(/\/box_rankings\/\d+$/, "/box_rankings/:box_ranking_id")
        .replace(/^\/quests\/\d+/, "/quests/:quest_id")
        .replace(/^\/images\/[a-z]+\/budokai\/[^/?]+$/, "/images/:locale/budokai/:asset")
        .replace(/^\/images\/[a-z]+\/(?:help_ten1|help)\/[^/?]+$/, "/images/:locale/:wt_help_collection/:asset");
    if (/^\/(?:resources\/home|bonus_schedules|budokais\/:budokai_id(?:\/(?:entry|ranks|rankings(?:\/borders|\/friends)?|box_rankings\/:box_ranking_id|tournaments))?|quests\/:quest_id\/briefing|images\/:locale\/(?:budokai|:wt_help_collection)\/:asset)$/.test(known)) return known;
    return `/${path.split("/").filter(Boolean).map((segment, index) => index === 0 && ["budokais", "images", "quests"].includes(segment.toLowerCase()) ? segment.toLowerCase() : /^\d+$/.test(segment) ? ":id" : ":opaque").join("/")}`;
}

function classification(route: string): WtEvidenceClass {
    if (route === "/bonus_schedules" || route === "/budokais/:budokai_id/ranks") return "global";
    if (route.endsWith("/rankings/borders")) return "partial";
    if (route.includes("/rankings") || route.endsWith("/entry")) return "account_scoped";
    if (route.endsWith("/tournaments")) return "opaque";
    if (route.includes("/briefing") || route === "/resources/home" || route.includes("/box_rankings/")) return "partial";
    return "unknown";
}

function headerMap(value: unknown): Map<string, string> {
    const result = new Map<string, string>();
    if (!Array.isArray(value)) return result;
    for (const item of value) { const row = object(item), name = text(row?.name), valueText = text(row?.value); if (name && valueText) result.set(name.toLowerCase(), valueText); }
    return result;
}

function collectSensitive(value: unknown, target: Set<string>, accountSurface: boolean): void {
    if (Array.isArray(value)) { for (const child of value) collectSensitive(child, target, accountSurface); return; }
    const row = object(value); if (!row) return;
    for (const [key, child] of Object.entries(row)) {
        if ((SENSITIVE_KEY.test(key) || accountSurface) && (typeof child === "string" || typeof child === "number") && String(child).length >= 4) target.add(String(child));
        else collectSensitive(child, target, accountSurface);
    }
}
function number(value: unknown): number | null { return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null; }
function objects(value: unknown): Record<string, unknown>[] { return Array.isArray(value) ? value.map(object).filter((row): row is Record<string, unknown> => row !== null) : []; }
function allowedStructuralIds(route: string, url: URL, body: unknown, entryIndex: number): Wt0StructuralId[] {
    const result: Wt0StructuralId[] = [], add = (kind: Wt0StructuralId["kind"], value: unknown, sourcePath: string, scope: WtEvidenceClass): void => { const id = number(value); if (id !== null) result.push({ kind, id, sourcePath, classification: scope, observedEntryIndexes: [entryIndex] }); }, row = object(body);
    const segments = url.pathname.split("/").filter(Boolean); if (segments[0]?.toLowerCase() === "budokais") add("budokai", Number(segments[1]), "$route.budokai_id", "global"); if (route.includes("/box_rankings/")) add("box_ranking", Number(segments.at(-1)), "$route.box_ranking_id", "global"); if (route === "/quests/:quest_id/briefing") add("quest", Number(segments[1]), "$route.quest_id", "partial");
    if (!row) return result;
    if (route === "/resources/home") { const budokai = object(row.budokai); add("budokai", budokai?.id, "$.budokai.id", "global"); for (const value of objects(row.bonus_schedules)) add("bonus_schedule", value.id, "$.bonus_schedules[].id", "global"); }
    if (route === "/bonus_schedules") for (const value of objects(row.bonus_schedules)) add("bonus_schedule", value.id, "$.bonus_schedules[].id", "global");
    if (route.endsWith("/entry")) { add("budokai", row.id, "$.id", "global"); add("script", row.description_script_id, "$.description_script_id", "global"); add("script", row.entry_script_id, "$.entry_script_id", "global"); for (const value of objects(row.budokai_maps)) { add("budokai_map", value.id, "$.budokai_maps[].id", "global"); add("budokai", value.budokai_id, "$.budokai_maps[].budokai_id", "global"); } const status = object(row.budokai_status); add("mission", status?.next_budokai_mission_id, "$.budokai_status.next_budokai_mission_id", "account_scoped"); }
    return result;
}

function exactSecretMatches(serialized: string, values: Set<string>): number {
    let matches = 0;
    for (const value of values) if (value.length >= 6 && (serialized.includes(JSON.stringify(value)) || serialized.includes(value))) matches += 1;
    return matches;
}
export function scanWtCampaignTexts(harText: string, structuralIds: number[], files: Array<{ name: string; text: string }>): { capturedSensitiveValueCount: number; scannedFileCount: number; exactCapturedValueMatches: number; numericCapturedValueMatches: number; stringCapturedValueMatches: number; genericSecretPatternMatches: number; exactMatchedFiles: string[]; valid: boolean } {
    const har = object(JSON.parse(harText)), log = object(har?.log), rawEntries = log?.entries, sensitive = new Set<string>();
    if (!Array.isArray(rawEntries) || rawEntries.length === 0 || files.length === 0) throw new Error("WT secret scan input invalid");
    for (const raw of rawEntries) {
        const entry = object(raw), request = object(entry?.request), response = object(entry?.response), rawUrl = text(request?.url); if (!request || !response || !rawUrl) throw new Error("WT secret scan malformed HAR");
        let url: URL; try { url = new URL(rawUrl); } catch { throw new Error("WT secret scan invalid URL"); } const route = routeOf(url.pathname);
        const requestHeaders = headerMap(request.headers), responseHeaders = headerMap(response.headers), scope = route ? classification(route) : "unknown", accountSurface = scope === "account_scoped" || scope === "opaque";
        for (const value of [...requestHeaders.values(), ...responseHeaders.values(), ...url.searchParams.values()]) if (value.length >= 4) sensitive.add(value);
        const postData = object(request.postData), content = object(response.content); for (const rawBody of [postData?.text, content?.text]) if (typeof rawBody === "string") { try { collectSensitive(JSON.parse(rawBody), sensitive, accountSurface); } catch { /* opaque bytes remain unretained */ } }
    }
    for (const id of structuralIds) sensitive.delete(String(id));
    sensitive.delete("android"); // public platform classification retained only as an explicit NO-GO scope
    const campaignMatches = (serialized: string): { numeric: number; string: number } => { let numeric = 0, string = 0; for (const value of sensitive) { if (value.length < 6) continue; const isNumeric = /^-?\d+(?:\.\d+)?$/.test(value), matched = isNumeric ? new RegExp(`(^|[^0-9])${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^0-9]|$)`).test(serialized) : serialized.includes(JSON.stringify(value)) || serialized.includes(`'${value.replace(/'/g, "\\'")}'`) || serialized.includes(`\`${value.replace(/`/g, "\\`")}\``); if (matched) isNumeric ? numeric++ : string++; } return { numeric, string }; };
    let exactCapturedValueMatches = 0, numericCapturedValueMatches = 0, stringCapturedValueMatches = 0, genericSecretPatternMatches = 0; const exactMatchedFiles: string[] = [];
    for (const file of files) { const matched = campaignMatches(file.text), exact = matched.numeric + matched.string; numericCapturedValueMatches += matched.numeric; stringCapturedValueMatches += matched.string; exactCapturedValueMatches += exact; if (exact > 0) exactMatchedFiles.push(file.name); if (/Bearer\s+[A-Za-z0-9._~+\/-]{8,}|eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/.test(file.text)) genericSecretPatternMatches++; }
    return { capturedSensitiveValueCount: sensitive.size, scannedFileCount: files.length, exactCapturedValueMatches, numericCapturedValueMatches, stringCapturedValueMatches, genericSecretPatternMatches, exactMatchedFiles, valid: exactCapturedValueMatches === 0 && genericSecretPatternMatches === 0 };
}
export function assertExternalHarPath(root: string, sourcePath: string): void { const inside = relative(root, sourcePath).replace(/\\/g, "/"); if (!inside.startsWith("../") && inside !== "..") throw new Error("WT0 HAR source must remain outside the worktree"); }

export function makeExternalSourceLock(harText: string): WtExternalSourceLock {
    const parsed = object(JSON.parse(harText)), log = object(parsed?.log), entries = log?.entries;
    if (!Array.isArray(entries) || entries.length === 0) throw new Error("WT0 invalid HAR entry collection");
    return { schemaVersion: 1, contract: "dokkan-world-tournament-external-source-lock", contractVersion: "0.1.0", sourceId: "world-tournament-until-start-crash-2026-08-16", fileName: "world_tournament_until_start_crash.har", sizeBytes: Buffer.byteLength(harText), sha256: sha256(harText), entryCount: entries.length };
}

export function buildWt0(harText: string, lock: WtExternalSourceLock): Wt0Dataset {
    const expected = makeExternalSourceLock(harText);
    if (JSON.stringify(lock) !== JSON.stringify(expected) || !/^[a-f0-9]{64}$/.test(lock.sha256)) throw new Error("WT0 external source lock mismatch");
    const har = object(JSON.parse(harText)), log = object(har?.log), rawEntries = log?.entries;
    if (!Array.isArray(rawEntries)) throw new Error("WT0 invalid HAR");
    const entries: Wt0Entry[] = [], sensitive = new Set<string>(), structuralRows: Wt0StructuralId[] = [], candidates: Array<{ index: number; url: string; route: string; status: number; requestHeaders: Map<string, string>; responseHeaders: Map<string, string> }> = [];
    rawEntries.forEach((raw, entryIndex) => {
        const entry = object(raw), request = object(entry?.request), response = object(entry?.response), method = text(request?.method), rawUrl = text(request?.url);
        if (!request || !response || !method || !rawUrl) throw new Error(`WT0 malformed HAR entry ${entryIndex}`);
        let url: URL; try { url = new URL(rawUrl); } catch { throw new Error(`WT0 invalid URL at entry ${entryIndex}`); }
        const route = routeOf(url.pathname); if (!route) return; if (!["GET", "POST"].includes(method)) throw new Error(`WT0 unsupported WT method ${method}`);
        const status = typeof response.status === "number" ? response.status : -1, requestHeaders = headerMap(request.headers), responseHeaders = headerMap(response.headers);
        const postData = object(request.postData), content = object(response.content), requestBody = parseJsonBody(postData?.text, route), responseBody = parseJsonBody(content?.text, route);
        const scope = classification(route), accountSurface = scope === "account_scoped" || scope === "opaque";
        for (const value of [...requestHeaders.values(), ...responseHeaders.values()]) if (value.length >= 4) sensitive.add(value);
        for (const value of url.searchParams.values()) if (value.length >= 4) sensitive.add(value);
        for (const rawBody of [postData?.text, content?.text]) if (typeof rawBody === "string") { try { collectSensitive(JSON.parse(rawBody), sensitive, accountSurface); } catch { /* opaque bytes never leave memory */ } }
        if (typeof content?.text === "string") { try { structuralRows.push(...allowedStructuralIds(route, url, JSON.parse(content.text), entryIndex)); } catch { /* non-JSON bodies have no structural IDs */ } } else structuralRows.push(...allowedStructuralIds(route, url, null, entryIndex));
        entries.push({ entryIndex, method: method as "GET" | "POST", route, status, classification: scope, traffic: method === "GET" ? "read_observed" : "mutation_observed_not_replayable", queryKeyNames: [...new Set([...url.searchParams.keys()])].sort(), requestBodyDisposition: requestBody.disposition, responseBodyDisposition: responseBody.disposition, requestSchema: requestBody.schema, responseSchema: responseBody.schema });
        candidates.push({ index: entryIndex, url: `${url.origin}${url.pathname}${url.search}`, route, status, requestHeaders, responseHeaders });
    });
    const cacheRelations: Wt0CacheRelation[] = [];
    for (const later of candidates.filter(value => value.status === 304)) {
        for (const [validatorKind, requestName, responseName] of [["etag", "if-none-match", "etag"], ["last_modified", "if-modified-since", "last-modified"]] as const) {
            const requestValue = later.requestHeaders.get(requestName); if (!requestValue) continue;
            const prior = candidates.filter(value => value.index < later.index && value.url === later.url && value.status === 200 && value.responseHeaders.get(responseName) === requestValue).at(-1);
            if (prior) { cacheRelations.push({ route: later.route, sourceEntryIndex: prior.index, notModifiedEntryIndex: later.index, validatorKind, exactUrlMatched: true, validatorMatched: true }); break; }
        }
    }
    const structural = new Map<string, Wt0StructuralId>(); for (const value of structuralRows) { const key = `${value.kind}:${value.id}:${value.sourcePath}:${value.classification}`, prior = structural.get(key); if (prior) prior.observedEntryIndexes = [...new Set([...prior.observedEntryIndexes, ...value.observedEntryIndexes])].sort((a, b) => a - b); else structural.set(key, { ...value }); } const structuralIds = [...structural.values()].sort((a, b) => `${a.kind}:${String(a.id).padStart(12, "0")}:${a.sourcePath}`.localeCompare(`${b.kind}:${String(b.id).padStart(12, "0")}:${b.sourcePath}`)); for (const value of structuralIds) sensitive.delete(String(value.id));
    const source = { schemaVersion: lock.schemaVersion, contract: lock.contract, contractVersion: lock.contractVersion, sourceId: lock.sourceId, sizeBytes: lock.sizeBytes, sha256: lock.sha256, entryCount: lock.entryCount } as const;
    const base = { schemaVersion: 1 as const, contract: "dokkan-world-tournament-offline-inventory" as const, contractVersion: "0.1.0" as const, collectionMode: "offline_local_har_no_requests_no_replay" as const, defaultEnabled: false as const, productionMutation: false as const, source, observedEntryCount: rawEntries.length, retainedEntryCount: entries.length, excludedNonWtEntryCount: rawEntries.length - entries.length, unclassifiedWtEntryCount: entries.filter(value => value.classification === "unknown").length, entries, structuralIds, cacheRelations: cacheRelations.sort((a, b) => a.notModifiedEntryIndex - b.notModifiedEntryIndex), exclusions: ["authorization_headers_and_values", "cookies_and_tokens", "query_values", "raw_request_and_response_bodies", "sign_values_and_sign_semantics", "user_ids_names_points_and_personal_rankings", "binary_asset_bytes"] };
    const serialized = JSON.stringify(base), exactCapturedValueMatches = exactSecretMatches(serialized, sensitive), genericSecretPatternMatches = /Bearer\s+[A-Za-z0-9._~+\/-]{8,}|eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/.test(serialized) ? 1 : 0;
    const dataset: Wt0Dataset = { ...base, secretScan: { capturedSensitiveValueCount: sensitive.size, exactCapturedValueMatches, genericSecretPatternMatches, valid: exactCapturedValueMatches === 0 && genericSecretPatternMatches === 0 } };
    const validation = validateWt0(dataset, lock); if (!validation.valid) throw new Error(`WT0 validation failed: ${validation.failures.join(", ")}`); return dataset;
}

export function validateWt0(dataset: Wt0Dataset, lock: WtExternalSourceLock): Wt0Validation {
    const failures: string[] = [];
    if (dataset.schemaVersion !== 1 || dataset.contract !== "dokkan-world-tournament-offline-inventory" || dataset.contractVersion !== "0.1.0" || dataset.collectionMode !== "offline_local_har_no_requests_no_replay" || dataset.defaultEnabled || dataset.productionMutation) failures.push("contract boundary");
    if (dataset.source.schemaVersion !== 1 || dataset.source.contract !== lock.contract || dataset.source.contractVersion !== "0.1.0" || dataset.source.sourceId !== lock.sourceId || dataset.source.sha256 !== lock.sha256 || dataset.source.sizeBytes !== lock.sizeBytes || dataset.source.entryCount !== lock.entryCount || dataset.observedEntryCount !== lock.entryCount) failures.push("source lineage");
    if (dataset.retainedEntryCount !== dataset.entries.length || dataset.excludedNonWtEntryCount + dataset.retainedEntryCount !== dataset.observedEntryCount || dataset.unclassifiedWtEntryCount !== dataset.entries.filter(value => value.classification === "unknown").length || dataset.entries.length === 0) failures.push("entry cardinality");
    const indexes = new Set<number>();
    const schemaTypes = new Set(["array", "boolean", "null", "number", "object", "string"]), dispositions = new Set(["absent", "schema_only", "opaque_envelope_schema_only", "binary_or_unparsed_not_retained"]);
    const canonicalRoute = /^(?:\/(?:resources\/home|bonus_schedules|budokais\/:budokai_id(?:\/(?:entry|ranks|rankings(?:\/borders|\/friends)?|box_rankings\/:box_ranking_id|tournaments))?|quests\/:quest_id\/briefing|images\/:locale\/(?:budokai|:wt_help_collection)\/:asset)|\/(?:budokais|images|quests)(?:\/:id|\/:opaque)+)$/;
    if (dataset.entries.some(value => { if (!Number.isSafeInteger(value.entryIndex) || value.entryIndex < 0 || value.entryIndex >= dataset.observedEntryCount || indexes.has(value.entryIndex)) return true; indexes.add(value.entryIndex); const invalidSchema = [...value.requestSchema, ...value.responseSchema].some(node => !node.path.startsWith("$") || node.types.length === 0 || new Set(node.types).size !== node.types.length || node.types.some(type => !schemaTypes.has(type))); return !["GET", "POST"].includes(value.method) || !Number.isInteger(value.status) || value.status < 0 || value.status > 599 || !dispositions.has(value.requestBodyDisposition) || !dispositions.has(value.responseBodyDisposition) || !canonicalRoute.test(value.route) || value.queryKeyNames.some(key => key.includes("=")) || invalidSchema || classification(value.route) !== value.classification || (value.method === "POST" && value.traffic !== "mutation_observed_not_replayable") || (value.method === "GET" && value.traffic !== "read_observed"); })) failures.push("entry policy");
    if (dataset.entries.filter(value => value.route.endsWith("/tournaments")).some(value => value.requestBodyDisposition !== "opaque_envelope_schema_only" || value.responseBodyDisposition !== "opaque_envelope_schema_only")) failures.push("opaque sign envelope");
    const structuralKeys = new Set<string>(), coordinates = new Set(["budokai:$route.budokai_id:global", "budokai:$.budokai.id:global", "budokai:$.id:global", "budokai:$.budokai_maps[].budokai_id:global", "budokai_map:$.budokai_maps[].id:global", "box_ranking:$route.box_ranking_id:global", "bonus_schedule:$.bonus_schedules[].id:global", "mission:$.budokai_status.next_budokai_mission_id:account_scoped", "script:$.description_script_id:global", "script:$.entry_script_id:global", "quest:$route.quest_id:partial"]); if (dataset.structuralIds.some(value => { const key = `${value.kind}:${value.id}:${value.sourcePath}:${value.classification}`; if (structuralKeys.has(key)) return true; structuralKeys.add(key); return !coordinates.has(`${value.kind}:${value.sourcePath}:${value.classification}`) || !Number.isSafeInteger(value.id) || value.id < 0 || value.observedEntryIndexes.length === 0 || value.observedEntryIndexes.some(index => !indexes.has(index)); })) failures.push("structural ID policy");
    if (dataset.cacheRelations.some(value => { const source = dataset.entries.find(entry => entry.entryIndex === value.sourceEntryIndex), later = dataset.entries.find(entry => entry.entryIndex === value.notModifiedEntryIndex); return !value.exactUrlMatched || !value.validatorMatched || !source || !later || source.method !== "GET" || source.status !== 200 || later.method !== "GET" || later.status !== 304 || source.route !== value.route || later.route !== value.route || value.sourceEntryIndex >= value.notModifiedEntryIndex; })) failures.push("cache relation proof");
    if (!dataset.secretScan.valid || dataset.secretScan.exactCapturedValueMatches || dataset.secretScan.genericSecretPatternMatches) failures.push("secret scan");
    return { schemaVersion: 1, valid: failures.length === 0, failures: [...new Set(failures)], retainedEntryCount: dataset.entries.length, cacheRelationCount: dataset.cacheRelations.length };
}
