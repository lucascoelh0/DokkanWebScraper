import { createHash } from "crypto";
import { closeSync, fstatSync, lstatSync, openSync, readFileSync, realpathSync, statSync } from "fs";
import { basename, dirname, extname, isAbsolute, relative, resolve, sep } from "path";
import {
    CaptureEndpointClass,
    CaptureH0Dataset,
    CaptureH0EndpointInventory,
    CaptureH0Inventory,
    CaptureInputManifest,
    CaptureTargetHostClass,
} from "./capture-h0-contract";

const OFFICIAL_API_HOST = "ishin-global.aktsk.com";
const OFFICIAL_CDN_HOST = "cf.ishin-global.aktsk.com";
const MAX_CAPTURE_BYTES = 192 * 1024 * 1024;
const MAX_JSON_SCHEMA_BODY_CHARS = 32 * 1024 * 1024;
const SENSITIVE_KEY = /(?:^|[_-])(access[_-]?token|api[_-]?token|authorization|auth(?:entication|orization|transaction)?|account|cookie|device|session|signature|userid|user[_-]?id)(?:$|[_-])/i;
const SCHEMA_KEY_ALLOWLIST = new Set([
    "algorithm", "assets", "banner", "banners", "bonus_schedules", "campaigns", "cards", "categories", "category_id",
    "data", "database", "db_stories", "end_at", "event_id", "eventkagi_events", "events", "featured_cards", "gashas",
    "hash", "id", "image", "images", "items", "mission_board_campaigns", "mission_id", "missions", "open_at", "paths",
    "quest_id", "quests", "rates", "resources", "rewards", "schedules", "start_at", "status", "steps", "url", "version", "wday",
]);
const API_PATH_SEGMENT_ALLOWLIST = new Set([
    "auth", "bonus_schedules", "briefing", "client_assets", "database", "db_stories", "events", "eventkagi_events", "featured_cards",
    "finish", "gashas", "gifts", "home", "images", "login", "mission_board_campaigns", "missions", "put_forward", "quests", "rates",
    "resources", "sessions", "shops", "sign_in", "start", "teams", "title", "banners", "user", "user_areas", "users",
]);
const ASSET_EXTENSION_ALLOWLIST = new Set(["cpk", "db", "gif", "jpeg", "jpg", "json", "mp4", "png", "sqlite", "webp"]);

const classes: CaptureEndpointClass[] = [
    "product_catalog",
    "mixed_product_and_user_state",
    "user_state",
    "mutation",
    "auth",
    "asset_delivery",
];

export interface CaptureInputRoots {
    [logicalName: string]: string;
}

export interface SanitizedHarEntryStructure {
    hostClass: CaptureTargetHostClass;
    method: string;
    normalizedEndpoint: string;
    classification: CaptureEndpointClass;
    status: number;
    queryKeys: string[];
    requestHeaderNames: string[];
    responseHeaderNames: string[];
    requestMimeType: string;
    responseMimeType: string;
    requestBodySchema: string[];
    responseBodySchema: string[];
    requestBodyPresent: boolean;
    responseBodyPresent: boolean;
    capturedAt: string | null;
}

function sha256(value: string): string {
    return createHash("sha256").update(value).digest("hex");
}

function sortedUnique(values: string[]): string[] {
    return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function safeHeaderNames(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return sortedUnique(value.flatMap(item => {
        if (!item || typeof item !== "object") return [];
        const name = (item as { name?: unknown }).name;
        return typeof name === "string" && /^[a-z0-9_-]{1,64}$/i.test(name) ? [name.toLowerCase()] : [];
    }));
}

function safeMimeType(value: unknown): string {
    if (typeof value !== "string") return "unknown";
    const normalized = value.split(";", 1)[0].trim().toLowerCase();
    return /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(normalized) ? normalized : "unknown";
}

function schemaKey(key: string): string {
    if (SENSITIVE_KEY.test(key)) return "[sensitive-key]";
    return SCHEMA_KEY_ALLOWLIST.has(key) ? key : "[unallowlisted-key]";
}

function queryKey(key: string): string {
    return /^[A-Za-z0-9_.-]{1,80}$/.test(key) ? key : "[opaque-key]";
}

function jsonSchema(value: unknown, path = "$", output: string[] = [], depth = 0): string[] {
    if (output.length >= 4096 || depth > 24) return output;
    if (value === null) {
        output.push(`${path}:null`);
    } else if (Array.isArray(value)) {
        output.push(`${path}:array`);
        const representatives = new Map<string, unknown>();
        for (const item of value) {
            const type = item === null ? "null" : Array.isArray(item) ? "array" : typeof item;
            if (!representatives.has(type)) representatives.set(type, item);
        }
        for (const [type, item] of [...representatives.entries()].sort(([a], [b]) => a.localeCompare(b))) {
            jsonSchema(item, `${path}[]<${type}>`, output, depth + 1);
        }
    } else if (typeof value === "object") {
        output.push(`${path}:object`);
        for (const [rawKey, child] of Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))) {
            const key = schemaKey(rawKey);
            if (key === "[sensitive-key]") {
                output.push(`${path}.${key}:redacted`);
            } else {
                jsonSchema(child, `${path}.${key}`, output, depth + 1);
            }
        }
    } else {
        output.push(`${path}:${typeof value}`);
    }
    return output;
}

function contentSchema(content: unknown): string[] {
    if (!content || typeof content !== "object") return [];
    const candidate = content as { text?: unknown; encoding?: unknown; mimeType?: unknown };
    const mimeType = safeMimeType(candidate.mimeType);
    if (candidate.encoding === "base64" || typeof candidate.text !== "string" || candidate.text.length > MAX_JSON_SCHEMA_BODY_CHARS) return [];
    if (!(mimeType === "application/json" || mimeType.endsWith("+json"))) return [];
    try {
        return jsonSchema(JSON.parse(candidate.text)).sort((a, b) => a.localeCompare(b));
    } catch {
        return ["$:invalid-json"];
    }
}

function normalizedPath(pathname: string, hostClass: CaptureTargetHostClass): string {
    if (hostClass === "official_cdn") {
        const candidate = pathname.toLowerCase().match(/\.([a-z0-9]{1,8})$/)?.[1];
        return `/asset/${candidate && ASSET_EXTENSION_ALLOWLIST.has(candidate) ? candidate : "unknown"}`;
    }
    const segments = pathname.split("/").filter(Boolean).map(segment => {
        let decoded: string;
        try { decoded = decodeURIComponent(segment); } catch { return ":opaque"; }
        if (/^\d+$/.test(decoded) || /^[0-9a-f]{16,}$/i.test(decoded) || /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(decoded)) return ":id";
        const lower = decoded.toLowerCase();
        return API_PATH_SEGMENT_ALLOWLIST.has(lower) ? lower : ":opaque";
    });
    return `/${segments.join("/")}`;
}

function isMutationPath(path: string): boolean {
    return /\/(?:start|finish|dropout|accept|draw|exchange|put_forward|receive|consume|purchase|sell|use)(?:\/|$)/.test(path);
}

export function classifyEndpoint(hostClass: CaptureTargetHostClass, method: string, path: string): CaptureEndpointClass {
    if (/^\/(?:auth|sessions?)(?:\/|$)/.test(path) || /\/(?:login|sign_in|refresh_token)(?:\/|$)/.test(path)) return "auth";
    if (!['GET', 'HEAD'].includes(method) || isMutationPath(path)) return "mutation";
    if (hostClass === "official_cdn") return "asset_delivery";
    if (/^\/(?:resources\/home|user_areas|events|missions|gashas)$/.test(path)) return "mixed_product_and_user_state";
    if (/^\/(?:users?|teams?|gifts?|shops?|dragon_stones?)(?:\/|$)/.test(path)) return "user_state";
    if (/^\/(?:bonus_schedules|db_stories|title\/banners|client_assets\/database|events\/eventkagi_events|gashas\/:id\/(?:featured_cards|rates)|missions\/mission_board_campaigns(?:\/:id\/images)?|quests\/:id\/briefing)(?:\/|$)/.test(path)) return "product_catalog";
    return "user_state";
}

function targetUrl(rawUrl: unknown): { url: URL; hostClass: CaptureTargetHostClass } | null {
    if (typeof rawUrl !== "string") return null;
    let url: URL;
    try { url = new URL(rawUrl); } catch { return null; }
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    if (host === OFFICIAL_API_HOST) return { url, hostClass: "official_api" };
    if (host === OFFICIAL_CDN_HOST) return { url, hostClass: "official_cdn" };
    return null;
}

function parseTimestamp(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const time = Date.parse(value);
    return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function entryStructure(raw: unknown): SanitizedHarEntryStructure | null {
    if (!raw || typeof raw !== "object") return null;
    const entry = raw as any;
    const request = entry.request && typeof entry.request === "object" ? entry.request : {};
    const response = entry.response && typeof entry.response === "object" ? entry.response : {};
    const target = targetUrl(request.url);
    if (!target) return null;
    const method = typeof request.method === "string" && /^[A-Z]+$/i.test(request.method) ? request.method.toUpperCase() : "UNKNOWN";
    const path = normalizedPath(target.url.pathname, target.hostClass);
    const classification = classifyEndpoint(target.hostClass, method, path);
    const requestContent = request.postData && typeof request.postData === "object" ? request.postData : {};
    const responseContent = response.content && typeof response.content === "object" ? response.content : {};
    return {
        hostClass: target.hostClass,
        method,
        normalizedEndpoint: path,
        classification,
        status: Number.isSafeInteger(response.status) ? response.status : 0,
        queryKeys: sortedUnique([...target.url.searchParams.keys()].map(queryKey)),
        requestHeaderNames: safeHeaderNames(request.headers),
        responseHeaderNames: safeHeaderNames(response.headers),
        requestMimeType: safeMimeType(requestContent.mimeType),
        responseMimeType: safeMimeType(responseContent.mimeType),
        requestBodySchema: contentSchema(requestContent),
        responseBodySchema: contentSchema(responseContent),
        requestBodyPresent: typeof requestContent.text === "string" && requestContent.text.length > 0,
        responseBodyPresent: typeof responseContent.text === "string" && responseContent.text.length > 0,
        capturedAt: parseTimestamp(entry.startedDateTime),
    };
}

function schemaEntryValue(entry: SanitizedHarEntryStructure): string {
    const { capturedAt: _capturedAt, requestBodyPresent: _requestBodyPresent, responseBodyPresent: _responseBodyPresent, ...structure } = entry;
    return JSON.stringify(structure);
}

function structuralEntryValue(entry: SanitizedHarEntryStructure): string {
    return JSON.stringify({ hostClass: entry.hostClass, method: entry.method, normalizedEndpoint: entry.normalizedEndpoint, classification: entry.classification, status: entry.status, queryKeys: entry.queryKeys });
}

function emptyClassCounts(): Record<CaptureEndpointClass, number> {
    return Object.fromEntries(classes.map(value => [value, 0])) as Record<CaptureEndpointClass, number>;
}

function endpointInventory(entries: SanitizedHarEntryStructure[]): CaptureH0EndpointInventory[] {
    const groups = new Map<string, CaptureH0EndpointInventory>();
    for (const entry of entries) {
        const key = `${entry.hostClass}\u0000${entry.method}\u0000${entry.normalizedEndpoint}\u0000${entry.classification}`;
        const current = groups.get(key) ?? { hostClass: entry.hostClass, method: entry.method, normalizedEndpoint: entry.normalizedEndpoint, classification: entry.classification, count: 0, statusCodes: [], queryKeys: [] };
        current.count += 1;
        current.statusCodes.push(entry.status);
        current.queryKeys.push(...entry.queryKeys);
        groups.set(key, current);
    }
    return [...groups.values()].map(value => ({ ...value, statusCodes: sortedUnique(value.statusCodes.map(String)).map(Number), queryKeys: sortedUnique(value.queryKeys) })).sort((a, b) => `${a.hostClass}:${a.method}:${a.normalizedEndpoint}`.localeCompare(`${b.hostClass}:${b.method}:${b.normalizedEndpoint}`));
}

function validateRelativeCapturePath(value: string): void {
    if (!value || isAbsolute(value) || value.includes("\0") || value.split(/[\\/]/).includes("..") || basename(value) !== value || extname(value).toLowerCase() !== ".har") {
        throw new Error("capture path must be a direct relative .har filename");
    }
}

function resolveCapture(rootPath: string, relativePath: string): { candidate: string; realRoot: string } {
    validateRelativeCapturePath(relativePath);
    const rootLstat = lstatSync(rootPath);
    if (!rootLstat.isDirectory() || rootLstat.isSymbolicLink()) throw new Error("input root must be a regular directory, not a link or junction");
    const realRoot = realpathSync.native(rootPath);
    const candidate = resolve(rootPath, relativePath);
    const candidateLstat = lstatSync(candidate);
    if (!candidateLstat.isFile() || candidateLstat.isSymbolicLink()) throw new Error("capture must be a regular file, not a link or junction");
    const realCandidate = realpathSync.native(candidate);
    const relation = relative(realRoot, realCandidate);
    if (!relation || relation.startsWith(`..${sep}`) || relation === ".." || isAbsolute(relation) || dirname(realCandidate) !== realRoot) throw new Error("capture escapes the allowlisted input root");
    return { candidate, realRoot };
}

function readValidatedCapture(captureId: string, filePath: string, expectedRoot: string): { sizeBytes: number; text: string } {
    const descriptor = openSync(filePath, "r");
    try {
        const opened = fstatSync(descriptor);
        const currentLink = lstatSync(filePath);
        const currentReal = realpathSync.native(filePath);
        const current = statSync(filePath);
        const relation = relative(expectedRoot, currentReal);
        if (!opened.isFile() || currentLink.isSymbolicLink() || !current.isFile() || opened.dev !== current.dev || opened.ino !== current.ino || !relation || relation.startsWith(`..${sep}`) || relation === ".." || isAbsolute(relation) || dirname(currentReal) !== expectedRoot) {
            throw new Error(`capture ${captureId} changed after path validation`);
        }
        if (opened.size <= 0 || opened.size > MAX_CAPTURE_BYTES) throw new Error(`capture ${captureId} violates the size gate`);
        return { sizeBytes: opened.size, text: readFileSync(descriptor, "utf8") };
    } finally {
        closeSync(descriptor);
    }
}

export function readValidatedCaptureForSecretScanner(rootPath: string, relativePath: string, captureId: string): string {
    const resolved = resolveCapture(rootPath, relativePath);
    return readValidatedCapture(captureId, resolved.candidate, resolved.realRoot).text;
}

export function loadSanitizedCaptureEntries(rootPath: string, relativePath: string, captureId: string): { sizeBytes: number; entryCount: number; entries: SanitizedHarEntryStructure[] } {
    const resolved = resolveCapture(rootPath, relativePath);
    const validated = readValidatedCapture(captureId, resolved.candidate, resolved.realRoot);
    const parsed = JSON.parse(validated.text);
    const rawEntries = parsed?.log?.entries;
    if (!Array.isArray(rawEntries)) throw new Error(`capture ${captureId} is not a HAR with log.entries`);
    return { sizeBytes: validated.sizeBytes, entryCount: rawEntries.length, entries: rawEntries.map(entryStructure).filter((value): value is SanitizedHarEntryStructure => value !== null) };
}

export function auditSanitizedCaptureEntries(captureId: string, sizeBytes: number, entryCount: number, entries: SanitizedHarEntryStructure[]): CaptureH0Inventory {
    const timestamps = entries.flatMap(value => value.capturedAt ? [value.capturedAt] : []).sort((a, b) => a.localeCompare(b));
    const classificationCounts = emptyClassCounts();
    for (const entry of entries) classificationCounts[entry.classification] += 1;
    const fingerprintInput = entries.map(structuralEntryValue).sort((a, b) => a.localeCompare(b)).join("\n");
    const schemaFingerprintInput = entries.map(schemaEntryValue).sort((a, b) => a.localeCompare(b)).join("\n");
    return {
        captureId,
        structuralFingerprint: sha256(fingerprintInput),
        schemaFingerprint: sha256(schemaFingerprintInput),
        duplicateOf: null,
        sizeBytes,
        capturedAtStart: timestamps.at(0) ?? null,
        capturedAtEnd: timestamps.at(-1) ?? null,
        entryCount,
        targetEntryCount: entries.length,
        nonTargetEntryCount: entryCount - entries.length,
        classificationCounts,
        endpoints: endpointInventory(entries),
    };
}

function auditOne(captureId: string, filePath: string, expectedRoot: string): CaptureH0Inventory {
    const validated = readValidatedCapture(captureId, filePath, expectedRoot);
    const sizeBytes = validated.sizeBytes;
    const parsed = JSON.parse(validated.text);
    const rawEntries = parsed?.log?.entries;
    if (!Array.isArray(rawEntries)) throw new Error(`capture ${captureId} is not a HAR with log.entries`);
    const entries = rawEntries.map(entryStructure).filter((value): value is SanitizedHarEntryStructure => value !== null);
    return auditSanitizedCaptureEntries(captureId, sizeBytes, rawEntries.length, entries);
}

export function auditCaptureManifest(manifest: CaptureInputManifest, roots: CaptureInputRoots): CaptureH0Dataset {
    if (manifest.schemaVersion !== 1 || !manifest.inputRoot || !Array.isArray(manifest.captures) || manifest.captures.length === 0) throw new Error("unsupported capture manifest");
    const root = roots[manifest.inputRoot];
    if (!root) throw new Error("capture manifest input root is not allowlisted");
    const ids = new Set<string>();
    const captures = manifest.captures.map(item => {
        if (!item || typeof item.captureId !== "string" || !/^[a-z0-9][a-z0-9_-]{0,47}$/.test(item.captureId) || ids.has(item.captureId)) throw new Error("capture IDs must be unique safe identifiers");
        ids.add(item.captureId);
        const resolved = resolveCapture(root, item.path);
        return auditOne(item.captureId, resolved.candidate, resolved.realRoot);
    }).sort((a, b) => a.captureId.localeCompare(b.captureId));
    const byFingerprint = new Map<string, CaptureH0Inventory[]>();
    for (const capture of captures) byFingerprint.set(capture.structuralFingerprint, [...(byFingerprint.get(capture.structuralFingerprint) ?? []), capture]);
    const duplicateGroups = [...byFingerprint.values()].filter(group => group.length > 1).map(group => group.map(value => value.captureId).sort((a, b) => a.localeCompare(b))).sort((a, b) => a[0].localeCompare(b[0]));
    for (const group of duplicateGroups) for (const captureId of group.slice(1)) captures.find(value => value.captureId === captureId)!.duplicateOf = group[0];
    const generatedAt = captures.flatMap(value => value.capturedAtEnd ? [value.capturedAtEnd] : []).sort((a, b) => a.localeCompare(b)).at(-1);
    if (!generatedAt) throw new Error("no valid target-entry capture timestamp");
    return {
        schemaVersion: 1,
        contract: "dokkan-official-capture-structural-inventory",
        contractVersion: "0.1.0",
        generatedAt,
        generatedAtPolicy: "latest_capture_timestamp_for_deterministic_bytes",
        collectionMode: "offline_local_har_no_requests",
        productionMutation: false,
        authority: "structural_evidence_only_no_user_derived_authority",
        pathPolicy: "logical_allowlisted_root_relative_regular_files_only",
        fingerprintPolicy: "structural_sha256_excludes_values_headers_and_bodies_schema_sha256_remains_separate",
        captures,
        duplicateGroups,
    };
}
