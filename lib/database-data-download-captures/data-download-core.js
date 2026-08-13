"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stagedDdVersionableTargets = exports.scanVersionableTargets = exports.collectDdExternalSensitiveValues = exports.collectDdSensitiveValues = exports.buildDd0 = exports.loadDdCaptures = exports.loadDdExternalSources = exports.validateVersionableTarget = exports.validateDd0SourceLock = exports.parseDdHar = exports.sha256 = void 0;
const crypto_1 = require("crypto");
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const path_1 = require("path");
const capture_h0_audit_1 = require("../database-server-captures/capture-h0-audit");
const IDS = ["incremental", "clean_install", "download_all"];
const FILES = ["data_download.har", "data_download_clean_install.har", "data_download_all.har"];
const MODES = ["incremental", "clean_install", "download_all"];
const EXPECTED_CAPTURES = [
    { sizeBytes: 2119371, sha256: "c5f73661b82e3c0a2f7f47588ff986f9f02b489867681717fa09c491905c8d0c", entryCount: 50, modifiedAt: "2026-08-13T14:08:44.9196264Z" },
    { sizeBytes: 34618000, sha256: "6867c80fbff36a1162d2835fe378205b8216c9af9cbd10439652058c22769c4d", entryCount: 183, modifiedAt: "2026-08-13T14:44:38.7152087Z" },
    { sizeBytes: 1789781, sha256: "47f6b8a5d5004299194f1685c450cd8bd8257d4642ffb1d56c84ab898d2b7d0b", entryCount: 152, modifiedAt: "2026-08-13T14:55:43.7022130Z" },
];
const EXPECTED_SCREENSHOTS = [
    { role: "clean_install_ui", uiFileCount: 4868, sizeBytes: 1995175, sha256: "eeb0c684fdb7e1576b2f6a84323ce640fc6eca32de0c1031c656dacc334281fd", modifiedAt: "2026-08-13T14:44:48.4503542Z" },
    { role: "download_all_ui", uiFileCount: 25233, sizeBytes: 2089190, sha256: "ba2c7a59496c4e7d8381060291626ec7dd48ffad71cd93973d42eb51251fd784", modifiedAt: "2026-08-13T14:55:22.5041547Z" },
];
const EXPECTED_EXTERNAL_SOURCES = [
    { sourceId: "clean_install_ondemand_manifest", fileName: "ondeman_assets_clean_install.json", locator: "exact_file_name", sizeBytes: 3063770, sha256: "b81a95437ee511dc60ff434349635f8f374dacbb6232233e1c46d83af53b78e6", modifiedAt: "2026-08-13T15:16:16.8422816Z", classification: "allowlisted_manifest_body_in_memory_only", captureId: "clean_install", endpoint: "/ondemand_assets", uiFileCount: 4868 },
    { sourceId: "download_all_ondemand_manifest", fileName: "client_assets_download_all.json", locator: "exact_file_name", sizeBytes: 3063770, sha256: "b504f15ad0075233164b78c26af09036fe134e355f99264841d68124d9ee386e", modifiedAt: "2026-08-13T15:27:33.4721914Z", classification: "allowlisted_manifest_body_in_memory_only", captureId: "download_all", endpoint: "/ondemand_assets", uiFileCount: 4868 },
    { sourceId: "download_all_client_assets_manifest", fileName: null, locator: "single_client_assets_device_size_pattern", sizeBytes: 16150270, sha256: "455f5850efd8d7bc135759d59dc8272629dd2378b8e61bb5e615c5eac536827b", modifiedAt: "2026-08-13T15:28:01.1295732Z", classification: "allowlisted_manifest_body_in_memory_only", captureId: "download_all", endpoint: "/client_assets", uiFileCount: 25233 },
    { sourceId: "clean_install_cards_account_body", fileName: "cards_clean_install.json", locator: "exact_file_name", sizeBytes: 41897, sha256: "10b5985e3d9611b9a9712e8d50adae600eea22dbb270dca9fb6954bdfbd9894f", modifiedAt: "2026-08-13T15:16:54.7488920Z", classification: "opaque_account_scoped_sensitive_body", captureId: "clean_install", endpoint: "/cards", uiFileCount: null },
];
const EXPECTED_ALLOWED_TARGETS = ["TypeScript contracts", "synthetic minimal fixtures", "sanitized metadata JSON", "external manifest bodies in memory only"];
const EXPECTED_FORBIDDEN_TARGETS = ["HAR captures", "raw bodies", "account-scoped response bodies", "SQLite or database bytes", "CPK or asset bytes", "screenshots", "data directories", "logs", "attachments"];
const rawExternalNames = new Set(EXPECTED_EXTERNAL_SOURCES.flatMap(value => typeof value.fileName === "string" ? [value.fileName.toLowerCase()] : []));
const forbiddenExtensions = new Set([".har", ".sqlite", ".db", ".cpk", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".log", ".zip"]);
const forbiddenComponents = new Set(["data", "logs", "screenshots", "attachments"]);
const sensitiveHeader = /^(?:authorization|proxy-authorization|cookie|set-cookie|x-api(?:token|-token|-key)|x-apitoken|x-user(?:id|-id|-country|-currency)|x-device(?:id|-id|-token)|x-session(?:id|-id|-token)|x-signature|x-nonce)$/i;
const sensitiveKey = /(?:^|[_-])(?:access[_-]?token|api[_-]?(?:token|key)|authorization|account|cookie|credential|device(?:[_-]?(?:id|token))?|nonce|password|secret|session|signature|user[_-]?id)(?:$|[_-])/i;
function sha256(value) { return (0, crypto_1.createHash)("sha256").update(value).digest("hex"); }
exports.sha256 = sha256;
function parseDdHar(text, captureId, entryCount) { let har; try {
    har = JSON.parse(text);
}
catch {
    throw new Error(`DD0 malformed HAR: ${captureId}`);
} if (!Array.isArray(har?.log?.entries) || har.log.entries.length !== entryCount)
    throw new Error(`DD0 HAR entry count mismatch: ${captureId}`); return har; }
exports.parseDdHar = parseDdHar;
function exactKeys(value, expected, label) { if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join("\0") !== [...expected].sort().join("\0"))
    throw new Error(`${label} fields mismatch`); }
function validateDd0SourceLock(lock) {
    exactKeys(lock, ["schemaVersion", "contract", "contractVersion", "captureRoot", "captures", "externalConfidentialSources", "externalScreenshots", "preTransformClassification"], "DD0 source lock");
    if (lock.schemaVersion !== 1 || lock.contract !== "dokkan-data-download-offline-source-lock" || lock.contractVersion !== "0.1.0" || lock.captureRoot !== "dokkan-har-2026-08-13" || !Array.isArray(lock.captures) || lock.captures.length !== 3)
        throw new Error("DD0 source lock contract mismatch");
    lock.captures.forEach((capture, index) => {
        exactKeys(capture, ["captureId", "mode", "fileName", "sizeBytes", "sha256", "entryCount", "modifiedAt"], `DD0 capture ${index}`);
        const expected = EXPECTED_CAPTURES[index];
        if (capture.captureId !== IDS[index] || capture.mode !== MODES[index] || capture.fileName !== FILES[index] || capture.sizeBytes !== expected.sizeBytes || capture.sha256 !== expected.sha256 || capture.entryCount !== expected.entryCount || capture.modifiedAt !== expected.modifiedAt)
            throw new Error(`DD0 capture lock mismatch ${IDS[index]}`);
    });
    if (!Array.isArray(lock.externalConfidentialSources) || lock.externalConfidentialSources.length !== EXPECTED_EXTERNAL_SOURCES.length)
        throw new Error("DD0 external source evidence mismatch");
    lock.externalConfidentialSources.forEach((item, index) => { exactKeys(item, ["sourceId", "fileName", "locator", "sizeBytes", "sha256", "modifiedAt", "classification", "captureId", "endpoint", "uiFileCount"], `DD0 external source ${index}`); if (JSON.stringify(item) !== JSON.stringify(EXPECTED_EXTERNAL_SOURCES[index]))
        throw new Error("DD0 external source evidence mismatch"); });
    if (!Array.isArray(lock.externalScreenshots) || lock.externalScreenshots.length !== 2)
        throw new Error("DD0 screenshot evidence mismatch");
    lock.externalScreenshots.forEach((item, index) => { exactKeys(item, ["role", "uiFileCount", "sizeBytes", "sha256", "modifiedAt"], `DD0 screenshot ${index}`); if (JSON.stringify(item) !== JSON.stringify(EXPECTED_SCREENSHOTS[index]))
        throw new Error("DD0 screenshot evidence mismatch"); });
    exactKeys(lock.preTransformClassification, ["allowedVersionableTargets", "forbiddenVersionableTargets"], "DD0 classification");
    if (JSON.stringify(lock.preTransformClassification.allowedVersionableTargets) !== JSON.stringify(EXPECTED_ALLOWED_TARGETS) || JSON.stringify(lock.preTransformClassification.forbiddenVersionableTargets) !== JSON.stringify(EXPECTED_FORBIDDEN_TARGETS))
        throw new Error("DD0 classification mismatch");
}
exports.validateDd0SourceLock = validateDd0SourceLock;
function validateVersionableTarget(name, text) {
    if (typeof name !== "string" || !name || typeof text !== "string" || name.includes("\0") || text.includes("\0"))
        throw new Error("invalid versionable target");
    const normalized = name.replace(/\\/g, "/").toLowerCase(), components = normalized.split("/");
    if (rawExternalNames.has((0, path_1.basename)(normalized)) || forbiddenExtensions.has((0, path_1.extname)(normalized)) || components.some(value => forbiddenComponents.has(value)) || /(?:^|[-_.])raw[-_.]?bod(?:y|ies)(?:[-_.]|$)/i.test(normalized) || /"log"\s*:\s*\{\s*"entries"\s*:/s.test(text))
        throw new Error("forbidden versionable target classification");
}
exports.validateVersionableTarget = validateVersionableTarget;
function readContainedExternalSource(captureRoot, lock) {
    const realRoot = fs_1.realpathSync.native(captureRoot);
    let resolvedName, discoveredQueryValueSecret = null, discoveredFileNameSecret = null;
    if (lock.locator === "exact_file_name") {
        if (typeof lock.fileName !== "string" || (0, path_1.basename)(lock.fileName) !== lock.fileName || (0, path_1.extname)(lock.fileName).toLowerCase() !== ".json")
            throw new Error(`DD0 unsafe external source name: ${lock.sourceId}`);
        resolvedName = lock.fileName;
    }
    else {
        if (lock.fileName !== null)
            throw new Error(`DD0 pattern source must not persist a filename: ${lock.sourceId}`);
        const matches = (0, fs_1.readdirSync)(realRoot, { withFileTypes: true }).filter(value => value.isFile()).map(value => value.name).filter(value => /^client_assetsdevice_asset_size_bytes=(\d+)\.json$/.test(value));
        if (matches.length !== 1)
            throw new Error(`DD0 external pattern must resolve exactly once: ${lock.sourceId}`);
        resolvedName = matches[0];
        discoveredFileNameSecret = resolvedName;
        discoveredQueryValueSecret = resolvedName.match(/=(\d+)\.json$/)[1];
    }
    const candidate = (0, path_1.resolve)(realRoot, resolvedName), relation = (0, path_1.relative)(realRoot, candidate);
    if (!relation || relation === ".." || relation.startsWith(`..${path_1.sep}`) || (0, path_1.isAbsolute)(relation) || (0, path_1.dirname)(candidate) !== realRoot)
        throw new Error(`DD0 external source escaped root: ${lock.sourceId}`);
    const link = (0, fs_1.lstatSync)(candidate);
    if (!link.isFile() || link.isSymbolicLink())
        throw new Error(`DD0 external source is not a regular file: ${lock.sourceId}`);
    const descriptor = (0, fs_1.openSync)(candidate, "r");
    try {
        const opened = (0, fs_1.fstatSync)(descriptor, { bigint: true }), current = (0, fs_1.statSync)(candidate, { bigint: true }), currentReal = fs_1.realpathSync.native(candidate);
        if (!opened.isFile() || opened.dev !== current.dev || opened.ino !== current.ino || currentReal !== candidate || opened.size !== current.size || opened.mtimeNs !== current.mtimeNs)
            throw new Error(`DD0 external source changed during read: ${lock.sourceId}`);
        const text = (0, fs_1.readFileSync)(descriptor, "utf8");
        if (Buffer.byteLength(text) !== lock.sizeBytes || sha256(text) !== lock.sha256 || Number(opened.size) !== lock.sizeBytes || Math.abs(Number(opened.mtimeNs / 1000000n) - Date.parse(lock.modifiedAt)) > 0)
            throw new Error(`DD0 external source identity mismatch: ${lock.sourceId}`);
        return { lock: { ...lock }, text, sourceIdentityFingerprint: sha256([opened.dev, opened.ino, opened.size, opened.mtimeNs].join("\n")), discoveredFileNameSecret, discoveredQueryValueSecret };
    }
    finally {
        (0, fs_1.closeSync)(descriptor);
    }
}
function loadDdExternalSources(captureRoot, lock) {
    validateDd0SourceLock(lock);
    let realRoot;
    try {
        const rootLink = (0, fs_1.lstatSync)(captureRoot);
        if (!rootLink.isDirectory() || rootLink.isSymbolicLink())
            throw new Error("rejected");
        realRoot = fs_1.realpathSync.native(captureRoot);
    }
    catch {
        throw new Error("DD0 external source root validation failed");
    }
    return lock.externalConfidentialSources.map(value => {
        try {
            return readContainedExternalSource(realRoot, value);
        }
        catch {
            throw new Error(`DD0 external source validation failed: ${value.sourceId}`);
        }
    });
}
exports.loadDdExternalSources = loadDdExternalSources;
function loadDdCaptures(captureRoot, lock) {
    validateDd0SourceLock(lock);
    let realRoot;
    try {
        const rootLink = (0, fs_1.lstatSync)(captureRoot);
        if (!rootLink.isDirectory() || rootLink.isSymbolicLink())
            throw new Error("rejected");
        realRoot = fs_1.realpathSync.native(captureRoot);
    }
    catch {
        throw new Error("DD0 capture root validation failed");
    }
    return lock.captures.map(capture => {
        try {
            if ((0, path_1.basename)(capture.fileName) !== capture.fileName || (0, path_1.isAbsolute)(capture.fileName) || capture.fileName.includes("\0"))
                throw new Error("rejected");
            const candidate = (0, path_1.resolve)(realRoot, capture.fileName), relation = (0, path_1.relative)(realRoot, candidate);
            if (!relation || relation === ".." || relation.startsWith(`..${path_1.sep}`) || (0, path_1.isAbsolute)(relation) || (0, path_1.dirname)(candidate) !== realRoot)
                throw new Error("rejected");
            const before = (0, fs_1.statSync)(candidate, { bigint: true }), link = (0, fs_1.lstatSync)(candidate);
            if (!before.isFile() || link.isSymbolicLink() || fs_1.realpathSync.native(candidate) !== candidate)
                throw new Error("rejected");
            const snapshot = (0, capture_h0_audit_1.readValidatedCaptureSnapshot)(realRoot, capture.fileName, capture.captureId);
            const after = (0, fs_1.statSync)(candidate, { bigint: true });
            if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size || before.mtimeNs !== after.mtimeNs)
                throw new Error("changed");
            if (Buffer.byteLength(snapshot.text) !== capture.sizeBytes || sha256(snapshot.text) !== capture.sha256 || Number(before.size) !== capture.sizeBytes || Math.abs(Number(before.mtimeNs / 1000000n) - Date.parse(capture.modifiedAt)) > 0)
                throw new Error("identity");
            const har = parseDdHar(snapshot.text, capture.captureId, capture.entryCount);
            return { lock: { ...capture }, text: snapshot.text, har, sourceIdentityFingerprint: snapshot.sourceIdentityFingerprint };
        }
        catch {
            throw new Error(`DD0 capture validation failed: ${capture.captureId}`);
        }
    });
}
exports.loadDdCaptures = loadDdCaptures;
function buildDd0(lock, loaded, external = []) {
    validateDd0SourceLock(lock);
    if (loaded.length !== lock.captures.length || loaded.some((item, index) => sha256(item.text) !== lock.captures[index].sha256 || item.har.log.entries.length !== lock.captures[index].entryCount))
        throw new Error("DD0 loaded source lineage mismatch");
    if (external.length !== lock.externalConfidentialSources.length || external.some((item, index) => sha256(item.text) !== lock.externalConfidentialSources[index].sha256))
        throw new Error("DD0 external source lineage mismatch");
    return { schemaVersion: 1, contract: "dokkan-data-download-source-audit", contractVersion: "0.1.0", generatedAt: [...lock.captures.map(value => value.modifiedAt), ...lock.externalScreenshots.map(value => value.modifiedAt), ...lock.externalConfidentialSources.map(value => value.modifiedAt)].sort().at(-1), collectionMode: "offline_local_har_no_requests_no_replay", defaultEnabled: false, productionMutation: false, sourceLockSha256: sha256(`${JSON.stringify(lock, null, 2)}\n`), sources: lock.captures.map(value => ({ ...value })), externalConfidentialSources: lock.externalConfidentialSources.map(value => ({ ...value })), externalScreenshots: lock.externalScreenshots.map(value => ({ ...value })), preTransformClassification: { allowedVersionableTargets: [...lock.preTransformClassification.allowedVersionableTargets], forbiddenVersionableTargets: [...lock.preTransformClassification.forbiddenVersionableTargets] } };
}
exports.buildDd0 = buildDd0;
function addScalar(target, value) { if (["string", "number", "boolean"].includes(typeof value) && String(value).length > 0)
    target.add(String(value)); }
function queryValuesFromString(value, target) {
    if (!value.includes("?"))
        return;
    try {
        const url = new URL(value);
        for (const queryValue of url.searchParams.values())
            addScalar(target, queryValue);
        for (const pair of url.search.slice(1).split("&"))
            addScalar(target, pair.split("=", 2)[1] ?? "");
    }
    catch { /* not a URL */ }
}
function walk(value, target, collectAllScalars, key = "", depth = 0) {
    if (depth > 32)
        throw new Error("DD secret scanner nesting limit exceeded");
    if (value === null || ["string", "number", "boolean"].includes(typeof value)) {
        if (collectAllScalars || sensitiveKey.test(key))
            addScalar(target, value);
        if (typeof value === "string")
            queryValuesFromString(value, target);
        return;
    }
    if (Array.isArray(value)) {
        for (const child of value)
            walk(child, target, collectAllScalars, key, depth + 1);
        return;
    }
    if (value && typeof value === "object")
        for (const [childKey, child] of Object.entries(value))
            walk(child, target, collectAllScalars, childKey, depth + 1);
}
function collectDdSensitiveValues(loaded) {
    const values = new Set();
    for (const source of loaded)
        for (const entry of source.har.log.entries) {
            let requestUrl;
            try {
                requestUrl = new URL(entry?.request?.url);
            }
            catch {
                throw new Error(`DD secret scanner invalid request URL: ${source.lock.captureId}`);
            }
            for (const value of requestUrl.searchParams.values())
                addScalar(values, value);
            for (const side of [entry?.request, entry?.response]) {
                for (const header of Array.isArray(side?.headers) ? side.headers : [])
                    if (sensitiveHeader.test(String(header?.name ?? "")))
                        addScalar(values, header?.value);
                for (const cookie of Array.isArray(side?.cookies) ? side.cookies : [])
                    addScalar(values, cookie?.value);
            }
            const requestText = entry?.request?.postData?.text;
            if (typeof requestText === "string") {
                addScalar(values, requestText);
                try {
                    walk(JSON.parse(requestText), values, true);
                }
                catch { /* raw body string itself was collected */ }
            }
            for (const parameter of Array.isArray(entry?.request?.postData?.params) ? entry.request.postData.params : [])
                addScalar(values, parameter?.value);
            const responseText = entry?.response?.content?.text;
            if (typeof responseText === "string" && responseText.length <= 32 * 1024 * 1024) {
                try {
                    walk(JSON.parse(responseText), values, false);
                }
                catch {
                    queryValuesFromString(responseText, values);
                }
            }
        }
    return values;
}
exports.collectDdSensitiveValues = collectDdSensitiveValues;
function collectDdExternalSensitiveValues(loaded) {
    const values = new Set();
    for (const source of loaded) {
        let parsed;
        try {
            parsed = JSON.parse(source.text);
        }
        catch {
            throw new Error(`DD secret scanner malformed external JSON: ${source.lock.sourceId}`);
        }
        walk(parsed, values, source.lock.classification === "opaque_account_scoped_sensitive_body");
        addScalar(values, source.discoveredFileNameSecret);
        addScalar(values, source.discoveredQueryValueSecret);
    }
    return values;
}
exports.collectDdExternalSensitiveValues = collectDdExternalSensitiveValues;
function scanVersionableTargets(values, targets) {
    let failingTargetCount = 0;
    for (const target of targets) {
        validateVersionableTarget(target.name, target.text);
        let failed = false;
        const haystack = `${target.name}\n${target.text}`;
        for (const value of values) {
            const exact = value.length >= 8 && haystack.includes(value);
            if (exact) {
                failed = true;
                break;
            }
        }
        if (/Bearer\s+[A-Za-z0-9._~+\/-]{8,}|[?&](?:signature|token|nonce|user_id|device_id)=|device_asset_size_bytes=\d+/i.test(haystack))
            failed = true;
        if (failed)
            failingTargetCount += 1;
    }
    return { valid: failingTargetCount === 0, capturedValueCount: values.size, targetCount: targets.length, failingTargetCount };
}
exports.scanVersionableTargets = scanVersionableTargets;
function stagedDdVersionableTargets() {
    let names;
    try {
        names = (0, child_process_1.execFileSync)("git", ["diff", "--cached", "--name-only", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
    }
    catch {
        throw new Error("DD staged secret scan could not enumerate staged targets");
    }
    if (names.length === 0)
        throw new Error("DD staged secret scan requires at least one staged target");
    return names.map(name => {
        try {
            return { name, text: (0, child_process_1.execFileSync)("git", ["show", `:${name}`], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }) };
        }
        catch {
            throw new Error("DD staged secret scan could not read a staged target");
        }
    });
}
exports.stagedDdVersionableTargets = stagedDdVersionableTargets;
//# sourceMappingURL=data-download-core.js.map