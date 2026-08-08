"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.captureH7LocalLineage = exports.loadCaptureH7ExternalInputs = void 0;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const path_1 = require("path");
const configs = [
    { key: "s0", sourceClass: "database_server", manifestPath: "database-server/s0/server-s0-manifest.json", contract: "dokkan-server-source-catalog" },
    { key: "s1", sourceClass: "database_server", manifestPath: "database-server/s1/server-s1-manifest.json", contract: "dokkan-server-schedule-and-banners", project: payload => ({ s1GashaIds: numbers(payload.banners?.map((value) => value?.identity?.id)), s1GashaPeriods: gashaPeriods(payload.banners) }) },
    { key: "s2", sourceClass: "database_server", manifestPath: "database-server/s2/server-s2-manifest.json", contract: "dokkan-server-root-resolution", project: payload => ({ s2UltimateClashIds: familyIds(payload, "ultimate_clash"), s2BurstModeIds: familyIds(payload, "burst_mode") }) },
    { key: "s3", sourceClass: "database_server", manifestPath: "database-server/s3/server-s3-manifest.json", contract: "dokkan-server-reward-identity" },
    { key: "s4", sourceClass: "database_server", manifestPath: "database-server/s4/server-s4-manifest.json", contract: "dokkan-server-asset-delivery", project: payload => ({ s4CapturedManifestJoinCount: nonNegative(payload.e6Projection?.remoteManifestJoinedReferenceCount) }) },
    { key: "s5", sourceClass: "database_server", manifestPath: "database-server/s5/server-s5-manifest.json", contract: "dokkan-server-sidecar-registry" },
    { key: "s6", sourceClass: "database_server", manifestPath: "database-server/s6/server-s6-manifest.json", contract: "dokkan-server-shadow-parity", project: payload => ({ s6Totals: objectCounts(payload.totals) }) },
    { key: "s7", sourceClass: "database_server", manifestPath: "database-server/s7/server-s7-manifest.json", contract: "dokkan-server-readiness", project: payload => ({ s7DecisionKeys: strings(payload.decisions?.map((value) => value?.key)) }) },
    { key: "e1", sourceClass: "database_events", manifestPath: "database-events/events-e1-manifest.json", contract: "dokkan-events-database-first-catalog", project: payload => ({ e1Identities: identities(payload.catalog?.map((value) => value?.identity)) }) },
    { key: "e2", sourceClass: "database_events", manifestPath: "database-events/events-e2-manifest.json", contract: "dokkan-events-database-first-topology", project: payload => ({ e2QuestStageIds: numbers(payload.questStages?.map((value) => value?.identity?.id)), e2QuestLevelIds: numbers(payload.questStages?.flatMap((value) => value?.levels?.map((level) => level?.identity?.id) ?? [])) }) },
    { key: "e5", sourceClass: "database_events", manifestPath: "database-events/events-e5-manifest.json", contract: "dokkan-events-database-first-rewards", project: payload => ({ e5MissionIds: numbers(payload.linkedEventMissions?.map((value) => value?.identity?.id)), e5MissionCategoryIds: numbers([...(payload.linkedEventMissions?.map((value) => value?.missionCategoryId) ?? []), ...(payload.missionCategoryPreviews?.map((value) => value?.missionCategoryId) ?? [])]) }) },
    { key: "e6", sourceClass: "database_events", manifestPath: "database-events/events-e6-manifest.json", contract: "dokkan-events-database-first-assets", project: payload => ({ e6Paths: strings(payload.pathAssets?.map((value) => value?.rawPath)) }) },
    { key: "e7", sourceClass: "database_events", manifestPath: "database-events/events-e7-manifest.json", contract: "dokkan-events-database-first-shadow-parity", project: payload => ({ e7Classifications: classifications(payload.comparisons?.map((value) => value?.classification)) }) },
    { key: "e9", sourceClass: "database_events", manifestPath: "database-events/events-e9-manifest.json", contract: "dokkan-events-database-first-readiness", project: payload => ({ e9DecisionIds: strings(payload.decisions?.map((value) => value?.id)) }) },
];
function sha256(text) { return (0, crypto_1.createHash)("sha256").update(text).digest("hex"); }
function numbers(values) { return [...new Set((Array.isArray(values) ? values : []).map(Number).filter(value => Number.isSafeInteger(value) && value > 0))].sort((a, b) => a - b); }
function strings(values) { return [...new Set((Array.isArray(values) ? values : []).filter(value => typeof value === "string" && /^[A-Za-z0-9_./:-]{1,256}$/.test(value)))].sort((a, b) => a.localeCompare(b)); }
function classifications(values) { return (Array.isArray(values) ? values : []).filter(value => typeof value === "string" && /^(?:agreement|representation_gain|confirmed_conflict|unknown|unjoinable)$/.test(value)); }
function gashaPeriods(values) { return (Array.isArray(values) ? values : []).flatMap(value => { const id = Number(value?.identity?.id), startAt = Date.parse(value?.period?.startsAt?.normalizedInstant) / 1000, endAt = Date.parse(value?.period?.endsAt?.normalizedInstant) / 1000; return Number.isSafeInteger(id) && id > 0 && Number.isSafeInteger(startAt) && Number.isSafeInteger(endAt) ? [{ id, startAt, endAt }] : []; }).sort((a, b) => a.id - b.id); }
function identities(values) { return (Array.isArray(values) ? values : []).flatMap(value => value && typeof value.kind === "string" && /^[a-z0-9_]{1,64}$/.test(value.kind) && Number.isSafeInteger(Number(value.id)) && Number(value.id) > 0 ? [{ kind: value.kind, id: Number(value.id) }] : []).sort((a, b) => `${a.kind}:${a.id}`.localeCompare(`${b.kind}:${b.id}`)); }
function nonNegative(value) { return Number.isSafeInteger(value) && value >= 0 ? value : 0; }
function objectCounts(value) { const result = {}; if (value && typeof value === "object")
    for (const [key, item] of Object.entries(value))
        if (/^[A-Za-z][A-Za-z0-9]{0,63}$/.test(key) && Number.isSafeInteger(item) && item >= 0)
            result[key] = item; return result; }
function familyIds(payload, key) { const family = Array.isArray(payload?.families) ? payload.families.find((value) => value?.key === key) : null; return numbers(family?.identitySets?.flatMap((set) => set?.ids ?? []) ?? []); }
function safeRead(root, relativePath, maximumBytes) {
    if (!/^[A-Za-z0-9_.\/-]+$/.test(relativePath) || relativePath.includes("..") || relativePath.startsWith("/") || /^[A-Za-z]:/.test(relativePath))
        throw new Error("H7 artifact path is unsafe");
    if ((0, fs_1.lstatSync)(root).isSymbolicLink())
        throw new Error("H7 artifact root is a link");
    const rootReal = (0, fs_1.realpathSync)(root), path = (0, path_1.resolve)(rootReal, relativePath), inside = (0, path_1.relative)(rootReal, path);
    if (!inside || inside.startsWith("..") || (0, path_1.resolve)(rootReal, inside) !== path)
        throw new Error("H7 artifact escaped root");
    let cursor = rootReal;
    for (const segment of inside.split(/[\\/]/)) {
        cursor = (0, path_1.resolve)(cursor, segment);
        if ((0, fs_1.lstatSync)(cursor).isSymbolicLink())
            throw new Error("H7 artifact path contains a link");
    }
    const link = (0, fs_1.lstatSync)(path);
    if (link.isSymbolicLink() || !link.isFile())
        throw new Error("H7 artifact is not a regular file");
    const before = (0, fs_1.statSync)(path);
    if (before.size <= 0 || before.size > maximumBytes)
        throw new Error("H7 artifact size is outside limit");
    const text = (0, fs_1.readFileSync)(path, "utf8"), after = (0, fs_1.statSync)(path);
    if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ino !== after.ino || Buffer.byteLength(text) !== before.size)
        throw new Error("H7 artifact changed during read");
    return { text, sizeBytes: before.size, sha256: sha256(text) };
}
function loadCaptureH7ExternalInputs(root, lock) {
    if (lock.schemaVersion !== 1 || lock.contract !== "dokkan-official-capture-h7-external-source-lock" || lock.contractVersion !== "1.0.0" || lock.artifacts.length !== configs.length || JSON.stringify(lock.artifacts.map(value => value.key).sort()) !== JSON.stringify(configs.map(value => value.key).sort()))
        throw new Error("H7 source lock contract mismatch");
    const inputs = { s1GashaIds: [], s1GashaPeriods: [], s2UltimateClashIds: [], s2BurstModeIds: [], s4CapturedManifestJoinCount: 0, s6Totals: {}, s7DecisionKeys: [], e1Identities: [], e2QuestStageIds: [], e2QuestLevelIds: [], e5MissionIds: [], e5MissionCategoryIds: [], e6Paths: [], e7Classifications: [], e9DecisionIds: [] };
    const lineage = [];
    for (const config of configs) {
        const pinned = lock.artifacts.find(value => value.key === config.key);
        if (pinned.artifactContract !== config.contract || pinned.manifestPath !== config.manifestPath || !/^[0-9]+\.[0-9]+\.[0-9]+$/.test(pinned.artifactContractVersion) || ![pinned.manifestSha256, pinned.payloadSha256, pinned.validationSha256].every(value => /^[a-f0-9]{64}$/.test(value)) || ![pinned.manifestSizeBytes, pinned.payloadSizeBytes, pinned.validationSizeBytes].every(value => Number.isSafeInteger(value) && value > 0))
            throw new Error(`H7 invalid source lock entry ${config.key}`);
        const manifestFile = safeRead(root, config.manifestPath, 1024 * 1024);
        if (manifestFile.sizeBytes !== pinned.manifestSizeBytes || manifestFile.sha256 !== pinned.manifestSha256)
            throw new Error(`H7 manifest lock mismatch ${config.key}`);
        const manifest = JSON.parse(manifestFile.text);
        if (manifest.schemaVersion !== 1 || typeof manifest.fileName !== "string" || (0, path_1.basename)(manifest.fileName) !== manifest.fileName || !/^[A-Za-z0-9_.-]+\.json$/.test(manifest.fileName))
            throw new Error(`H7 invalid manifest ${config.key}`);
        const payloadPath = `${(0, path_1.dirname)(config.manifestPath).replace(/\\/g, "/")}/${manifest.fileName}`, payloadFile = safeRead(root, payloadPath, 128 * 1024 * 1024);
        if (payloadPath !== pinned.payloadPath || payloadFile.sizeBytes !== pinned.payloadSizeBytes || payloadFile.sha256 !== pinned.payloadSha256 || payloadFile.sizeBytes !== manifest.sizeBytes || payloadFile.sha256 !== manifest.sha256)
            throw new Error(`H7 payload lineage mismatch ${config.key}`);
        const validationPath = `${(0, path_1.dirname)(config.manifestPath).replace(/\\/g, "/")}/${manifest.validation?.fileName}`, validationFile = safeRead(root, validationPath, 1024 * 1024), validation = JSON.parse(validationFile.text);
        if (validationPath !== pinned.validationPath || validationFile.sizeBytes !== pinned.validationSizeBytes || validationFile.sha256 !== pinned.validationSha256 || validationFile.sizeBytes !== manifest.validation?.sizeBytes || validationFile.sha256 !== manifest.validation?.sha256 || validation.valid !== true)
            throw new Error(`H7 validation lineage mismatch ${config.key}`);
        const payload = JSON.parse(payloadFile.text);
        if (payload.schemaVersion !== 1 || payload.contract !== config.contract || payload.contractVersion !== pinned.artifactContractVersion || payload.contractVersion !== manifest.contractVersion)
            throw new Error(`H7 payload contract mismatch ${config.key}`);
        if (config.project)
            Object.assign(inputs, config.project(payload));
        lineage.push({ key: config.key, sourceClass: config.sourceClass, artifactPath: payloadPath, artifactContract: payload.contract, artifactContractVersion: payload.contractVersion, artifactSizeBytes: payloadFile.sizeBytes, artifactSha256: payloadFile.sha256, manifestPath: config.manifestPath, manifestSha256: manifestFile.sha256, validationSha256: validationFile.sha256 });
    }
    return { inputs, lineage: lineage.sort((a, b) => a.key.localeCompare(b.key)) };
}
exports.loadCaptureH7ExternalInputs = loadCaptureH7ExternalInputs;
function captureH7LocalLineage(key, artifactPath, text, contract, contractVersion) {
    return { key, sourceClass: "capture_sidecar", artifactPath, artifactContract: contract, artifactContractVersion: contractVersion, artifactSizeBytes: Buffer.byteLength(text), artifactSha256: sha256(text), manifestPath: null, manifestSha256: null, validationSha256: null };
}
exports.captureH7LocalLineage = captureH7LocalLineage;
//# sourceMappingURL=capture-h7-inputs.js.map