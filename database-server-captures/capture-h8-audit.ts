import { createHash } from "crypto";
import { Buffer } from "buffer";
import { CaptureInputManifest } from "./capture-h0-contract";
import { readValidatedCaptureSnapshot, sanitizeHarEntryStructure } from "./capture-h0-audit";
import { CaptureH8Dataset, CaptureH8Entry, CaptureH8Inventory, CaptureH8TrafficClass, CaptureH8Validation } from "./capture-h8-contract";

const SENSITIVE_HEADER = /^(?:authorization|cookie|set-cookie|x-api(?:token|-token|-key)|x-apitoken|x-user(?:id|-id|-country|-currency)|x-device(?:id|-id|-token)|x-session(?:id|-id|-token)|x-signature)$/i;
const classes: CaptureH8TrafficClass[] = ["read", "mutation", "telemetry", "cdn", "unknown"];

function sha256(value: string | Buffer): string { return createHash("sha256").update(value).digest("hex"); }
function safeNames(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.flatMap(item => {
        const name = item && typeof item === "object" ? (item as any).name : null;
        return typeof name === "string" && SENSITIVE_HEADER.test(name) && /^[A-Za-z0-9_-]{1,64}$/.test(name) ? [name.toLowerCase()] : [];
    }))].sort();
}
function bodyBytes(content: any): number {
    if (!content || typeof content.text !== "string") return 0;
    try { return content.encoding === "base64" ? Buffer.from(content.text, "base64").byteLength : Buffer.byteLength(content.text); } catch { return 0; }
}
function timestamp(value: unknown): string | null { const n = typeof value === "string" ? Date.parse(value) : NaN; return Number.isFinite(n) ? new Date(n).toISOString() : null; }
function explicitMutation(method: string, rawUrl: unknown): boolean {
    if (["GET", "HEAD", "OPTIONS"].includes(method) || typeof rawUrl !== "string") return false;
    try { return /^\/(?:missions|gashas|gifts|shops|teams|user)(?:\/|$)/.test(new URL(rawUrl).pathname.toLowerCase()); } catch { return false; }
}
export function sanitizeCaptureH8Entry(raw: any, entryIndex: number): CaptureH8Entry {
    const sanitized = sanitizeHarEntryStructure(raw);
    const request = raw?.request ?? {}, response = raw?.response ?? {}, responseContent = response.content ?? {};
    if (sanitized) {
        const responseBodyBytes = sanitized.status === 304 ? 0 : bodyBytes(responseContent);
        const trafficClass: CaptureH8TrafficClass = sanitized.hostClass === "official_cdn" ? "cdn" : ["GET", "HEAD"].includes(sanitized.method) ? "read" : explicitMutation(sanitized.method, request.url) ? "mutation" : "unknown";
        return { entryIndex, hostClass: sanitized.hostClass, method: sanitized.method, normalizedPath: sanitized.normalizedEndpoint, trafficClass, status: sanitized.status, requestMimeType: sanitized.requestMimeType, responseMimeType: sanitized.responseMimeType, requestBodyBytes: bodyBytes(request.postData), responseBodyBytes, capturedAt: timestamp(raw?.startedDateTime), sensitiveRequestHeaderNames: safeNames(request.headers), sensitiveResponseHeaderNames: safeNames(response.headers), representation: sanitized.status === 304 ? "not_modified_body_omitted" : responseBodyBytes > 0 ? "body_observed" : "body_absent" };
    }
    let hostClass: CaptureH8Entry["hostClass"] = "unknown";
    try { const host = new URL(request.url).hostname.toLowerCase(); if (/(?:googleapis|firebase|crashlytics|app-measurement)\./.test(host) || host.endsWith(".google.com")) hostClass = "telemetry"; } catch { /* safe unknown */ }
    const method = typeof request.method === "string" && /^[A-Z]{1,12}$/i.test(request.method) ? request.method.toUpperCase() : "UNKNOWN";
    const status = Number.isSafeInteger(response.status) ? response.status : 0, responseBodyBytes = status === 304 ? 0 : bodyBytes(responseContent);
    return { entryIndex, hostClass, method, normalizedPath: "/:unknown", trafficClass: hostClass === "telemetry" ? "telemetry" : "unknown", status, requestMimeType: "unknown", responseMimeType: "unknown", requestBodyBytes: bodyBytes(request.postData), responseBodyBytes, capturedAt: timestamp(raw?.startedDateTime), sensitiveRequestHeaderNames: safeNames(request.headers), sensitiveResponseHeaderNames: safeNames(response.headers), representation: status === 304 ? "not_modified_body_omitted" : responseBodyBytes > 0 ? "body_observed" : "body_absent" };
}
function structuralValue(value: CaptureH8Entry): string { const { entryIndex: _i, capturedAt: _t, ...rest } = value; return JSON.stringify(rest); }
function routeKey(value: CaptureH8Entry): string { return `${value.hostClass}\0${value.method}\0${value.normalizedPath}\0${value.trafficClass}`; }

export function buildCaptureH8(manifest: CaptureInputManifest, roots: Record<string, string>): CaptureH8Dataset {
    if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.captures) || manifest.captures.length === 0) throw new Error("unsupported H8 manifest");
    const root = roots[manifest.inputRoot]; if (!root) throw new Error("H8 input root is not allowlisted");
    const rawDigests = new Map<string, string>();
    const captures: CaptureH8Inventory[] = manifest.captures.map(input => {
        const snapshot = readValidatedCaptureSnapshot(root, input.path, input.captureId), parsed = JSON.parse(snapshot.text), rawEntries = parsed?.log?.entries;
        if (!Array.isArray(rawEntries)) throw new Error(`capture ${input.captureId} is not a HAR`);
        rawDigests.set(input.captureId, sha256(Buffer.from(snapshot.text)));
        const entries = rawEntries.map((value: unknown, index: number) => sanitizeCaptureH8Entry(value, index));
        const times = entries.flatMap(value => value.capturedAt ? [value.capturedAt] : []).sort();
        return { captureId: input.captureId, fileName: input.path, sizeBytes: Buffer.byteLength(snapshot.text), entryCount: entries.length, capturedAtStart: times[0] ?? null, capturedAtEnd: times.at(-1) ?? null, structuralSha256: sha256(entries.map(structuralValue).join("\n")), sourceIdentityFingerprint: snapshot.sourceIdentityFingerprint, exactDuplicateOf: null, entries };
    }).sort((a, b) => a.captureId.localeCompare(b.captureId));
    const groups = new Map<string, string[]>(); for (const capture of captures) groups.set(rawDigests.get(capture.captureId)!, [...(groups.get(rawDigests.get(capture.captureId)!) ?? []), capture.captureId]);
    const exactDuplicateGroups = [...groups.values()].filter(value => value.length > 1).map(value => value.sort()).sort((a, b) => a[0].localeCompare(b[0]));
    for (const group of exactDuplicateGroups) for (const captureId of group.slice(1)) captures.find(value => value.captureId === captureId)!.exactDuplicateOf = group[0];
    const overlaps = [];
    for (let i = 0; i < captures.length; i++) for (let j = i + 1; j < captures.length; j++) {
        const left = new Set(captures[i].entries.map(routeKey)), right = new Set(captures[j].entries.map(routeKey));
        const sharedRouteCount = [...left].filter(value => right.has(value)).length;
        overlaps.push({ leftCaptureId: captures[i].captureId, rightCaptureId: captures[j].captureId, leftRouteCount: left.size, rightRouteCount: right.size, sharedRouteCount, unionRouteCount: new Set([...left, ...right]).size });
    }
    const generatedAt = captures.flatMap(value => value.capturedAtEnd ? [value.capturedAtEnd] : []).sort().at(-1); if (!generatedAt) throw new Error("H8 has no timestamp");
    const dataset: CaptureH8Dataset = { schemaVersion: 1, contract: "dokkan-official-capture-extension-inventory", contractVersion: "0.9.0", generatedAt, generatedAtPolicy: "latest_capture_timestamp_for_deterministic_bytes", collectionMode: "offline_local_har_no_requests", productionMutation: false, defaultEnabled: false, authority: "structural_observation_only_no_account_or_product_authority", exactDuplicatePolicy: "raw_bytes_compared_in_memory_digest_not_persisted", inputManifestSha256: sha256(JSON.stringify(manifest)), captures, exactDuplicateGroups, overlaps };
    const validation = validateCaptureH8(dataset, manifest, roots); if (!validation.valid) throw new Error(`H8 validation failed: ${validation.failures.join(", ")}`); return dataset;
}

export function validateCaptureH8(dataset: CaptureH8Dataset, manifest?: CaptureInputManifest, roots?: Record<string, string>): CaptureH8Validation {
    const failures: string[] = [], trafficClassCounts = Object.fromEntries(classes.map(value => [value, 0])) as Record<CaptureH8TrafficClass, number>;
    if (dataset.schemaVersion !== 1 || dataset.contract !== "dokkan-official-capture-extension-inventory" || dataset.contractVersion !== "0.9.0" || dataset.generatedAtPolicy !== "latest_capture_timestamp_for_deterministic_bytes" || !Number.isFinite(Date.parse(dataset.generatedAt)) || dataset.collectionMode !== "offline_local_har_no_requests" || dataset.productionMutation !== false || dataset.defaultEnabled !== false || dataset.authority !== "structural_observation_only_no_account_or_product_authority" || dataset.exactDuplicatePolicy !== "raw_bytes_compared_in_memory_digest_not_persisted" || !/^[a-f0-9]{64}$/.test(dataset.inputManifestSha256)) failures.push("dataset contract");
    if (JSON.stringify(dataset.captures.map(value => value.captureId)) !== JSON.stringify(dataset.captures.map(value => value.captureId).sort()) || new Set(dataset.captures.map(value => value.captureId)).size !== dataset.captures.length) failures.push("capture order");
    for (const capture of dataset.captures) {
        const times = capture.entries.flatMap(value => value.capturedAt ? [value.capturedAt] : []).sort();
        if (!/^[a-z0-9][a-z0-9_-]{0,47}$/.test(capture.captureId) || !/^[A-Za-z0-9_.-]+\.har$/.test(capture.fileName) || !Number.isSafeInteger(capture.sizeBytes) || capture.sizeBytes <= 0 || capture.entryCount !== capture.entries.length || capture.capturedAtStart !== (times[0] ?? null) || capture.capturedAtEnd !== (times.at(-1) ?? null) || !/^[a-f0-9]{64}$/.test(capture.sourceIdentityFingerprint) || capture.structuralSha256 !== sha256(capture.entries.map(structuralValue).join("\n"))) failures.push("capture contract");
        capture.entries.forEach((value, index) => { if (value.entryIndex !== index || !classes.includes(value.trafficClass) || !["official_api", "official_cdn", "telemetry", "unknown"].includes(value.hostClass) || !/^[A-Z]{1,12}$/.test(value.method) || !value.normalizedPath.startsWith("/") || !Number.isSafeInteger(value.status) || value.status < 0 || value.status > 999 || !Number.isSafeInteger(value.requestBodyBytes) || value.requestBodyBytes < 0 || !Number.isSafeInteger(value.responseBodyBytes) || value.responseBodyBytes < 0 || value.status === 304 !== (value.representation === "not_modified_body_omitted") || value.status === 304 && value.responseBodyBytes !== 0 || value.capturedAt !== null && !Number.isFinite(Date.parse(value.capturedAt)) || !value.sensitiveRequestHeaderNames.every(name => SENSITIVE_HEADER.test(name)) || !value.sensitiveResponseHeaderNames.every(name => SENSITIVE_HEADER.test(name))) failures.push("entry contract"); trafficClassCounts[value.trafficClass] += 1; });
    }
    const latest = dataset.captures.flatMap(value => value.capturedAtEnd ? [value.capturedAtEnd] : []).sort().at(-1); if (dataset.generatedAt !== latest) failures.push("generatedAt");
    const expectedOverlaps = [] as typeof dataset.overlaps; for (let i = 0; i < dataset.captures.length; i++) for (let j = i + 1; j < dataset.captures.length; j++) { const left = new Set(dataset.captures[i].entries.map(routeKey)), right = new Set(dataset.captures[j].entries.map(routeKey)); expectedOverlaps.push({ leftCaptureId: dataset.captures[i].captureId, rightCaptureId: dataset.captures[j].captureId, leftRouteCount: left.size, rightRouteCount: right.size, sharedRouteCount: [...left].filter(value => right.has(value)).length, unionRouteCount: new Set([...left, ...right]).size }); } if (JSON.stringify(dataset.overlaps) !== JSON.stringify(expectedOverlaps)) failures.push("overlaps");
    const grouped = new Set(dataset.exactDuplicateGroups.flat()); for (const group of dataset.exactDuplicateGroups) { if (group.length < 2 || JSON.stringify(group) !== JSON.stringify([...group].sort()) || new Set(group).size !== group.length || group.some(id => !dataset.captures.some(value => value.captureId === id))) failures.push("duplicate groups"); group.forEach((id, index) => { if (dataset.captures.find(value => value.captureId === id)?.exactDuplicateOf !== (index === 0 ? null : group[0])) failures.push("duplicate references"); }); } for (const capture of dataset.captures.filter(value => !grouped.has(value.captureId))) if (capture.exactDuplicateOf !== null) failures.push("duplicate references");
    if (manifest && roots) {
        const root = roots[manifest.inputRoot]; if (!root || dataset.inputManifestSha256 !== sha256(JSON.stringify(manifest))) failures.push("manifest lineage");
        else {
            const rawGroups = new Map<string, string[]>(), expectedCaptures: CaptureH8Inventory[] = [];
            for (const input of manifest.captures) {
                const snapshot = readValidatedCaptureSnapshot(root, input.path, input.captureId), parsed = JSON.parse(snapshot.text), rawEntries = parsed?.log?.entries;
                if (!Array.isArray(rawEntries)) { failures.push("input HAR"); continue; }
                const entries = rawEntries.map((value: unknown, index: number) => sanitizeCaptureH8Entry(value, index)), times = entries.flatMap(value => value.capturedAt ? [value.capturedAt] : []).sort();
                expectedCaptures.push({ captureId: input.captureId, fileName: input.path, sizeBytes: Buffer.byteLength(snapshot.text), entryCount: entries.length, capturedAtStart: times[0] ?? null, capturedAtEnd: times.at(-1) ?? null, structuralSha256: sha256(entries.map(structuralValue).join("\n")), sourceIdentityFingerprint: snapshot.sourceIdentityFingerprint, exactDuplicateOf: null, entries });
                const digest = sha256(Buffer.from(snapshot.text)); rawGroups.set(digest, [...(rawGroups.get(digest) ?? []), input.captureId]);
            }
            expectedCaptures.sort((a, b) => a.captureId.localeCompare(b.captureId)); const expected = [...rawGroups.values()].filter(value => value.length > 1).map(value => value.sort()).sort((a, b) => a[0].localeCompare(b[0]));
            for (const group of expected) group.slice(1).forEach(id => { expectedCaptures.find(value => value.captureId === id)!.exactDuplicateOf = group[0]; });
            if (JSON.stringify(dataset.exactDuplicateGroups) !== JSON.stringify(expected)) failures.push("duplicate evidence");
            if (JSON.stringify(dataset.captures) !== JSON.stringify(expectedCaptures)) failures.push("snapshot inventory lineage");
        }
    } else if (dataset.exactDuplicateGroups.length > 0) failures.push("duplicate evidence unavailable");
    return { schemaVersion: 1, valid: failures.length === 0, captureCount: dataset.captures.length, entryCount: dataset.captures.reduce((sum, value) => sum + value.entryCount, 0), trafficClassCounts, exactDuplicateGroupCount: dataset.exactDuplicateGroups.length, failures: [...new Set(failures)] };
}
