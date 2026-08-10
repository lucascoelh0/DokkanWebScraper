"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadFrontierF5Inputs = void 0;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const path_1 = require("path");
function sha256(value) { return (0, crypto_1.createHash)("sha256").update(value).digest("hex"); }
function safeRead(root, path, max) { if (!/^[A-Za-z0-9_.\/-]+$/.test(path) || path.includes("..") || path.startsWith("/") || /^[A-Za-z]:/.test(path))
    throw new Error("F5 source path unsafe"); const rootReal = (0, fs_1.realpathSync)(root), candidate = (0, path_1.resolve)(rootReal, path), inside = (0, path_1.relative)(rootReal, candidate); if (!inside || inside.startsWith("..") || (0, path_1.resolve)(rootReal, inside) !== candidate)
    throw new Error("F5 source escaped root"); let cursor = rootReal; for (const part of inside.split(/[\\/]/)) {
    cursor = (0, path_1.resolve)(cursor, part);
    if ((0, fs_1.lstatSync)(cursor).isSymbolicLink())
        throw new Error("F5 source path contains a link");
} const before = (0, fs_1.statSync)(candidate); if (!before.isFile() || before.size <= 0 || before.size > max)
    throw new Error("F5 source size gate"); const text = (0, fs_1.readFileSync)(candidate, "utf8"), after = (0, fs_1.statSync)(candidate); if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ino !== after.ino || Buffer.byteLength(text) !== before.size)
    throw new Error("F5 source changed during read"); return { text, sizeBytes: before.size, sha256: sha256(text) }; }
function positive(value) { const parsed = Number(value); return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null; }
function numbers(values) { return [...new Set((Array.isArray(values) ? values : []).map(positive).filter((value) => value !== null))].sort((a, b) => a - b); }
function loadFrontierF5Inputs(root, lock) {
    const expected = ["e1", "e2", "e3", "e4", "e5", "e6", "e7", "e9"];
    if (lock.schemaVersion !== 1 || lock.contract !== "dokkan-frontier-e0-e9-source-lock" || lock.contractVersion !== "0.6.0" || JSON.stringify(lock.artifacts.map(value => value.key).sort()) !== JSON.stringify(expected))
        throw new Error("F5 source lock mismatch");
    const payloads = new Map(), lineage = [];
    for (const item of lock.artifacts) {
        if (![item.manifestSha256, item.payloadSha256, item.validationSha256].every(value => /^[a-f0-9]{64}$/.test(value)) || ![item.manifestSizeBytes, item.payloadSizeBytes, item.validationSizeBytes].every(value => Number.isSafeInteger(value) && value > 0))
            throw new Error(`F5 invalid lock ${item.key}`);
        const manifestFile = safeRead(root, item.manifestPath, 2 * 1024 * 1024), payloadFile = safeRead(root, item.payloadPath, 128 * 1024 * 1024), validationFile = safeRead(root, item.validationPath, 2 * 1024 * 1024);
        if (manifestFile.sizeBytes !== item.manifestSizeBytes || manifestFile.sha256 !== item.manifestSha256 || payloadFile.sizeBytes !== item.payloadSizeBytes || payloadFile.sha256 !== item.payloadSha256 || validationFile.sizeBytes !== item.validationSizeBytes || validationFile.sha256 !== item.validationSha256)
            throw new Error(`F5 source identity mismatch ${item.key}`);
        const manifest = JSON.parse(manifestFile.text), payload = JSON.parse(payloadFile.text), validation = JSON.parse(validationFile.text);
        if (payload.contract !== item.artifactContract || payload.contractVersion !== item.artifactContractVersion || manifest.contractVersion !== item.artifactContractVersion || manifest.fileName !== item.payloadPath.split("/").at(-1) || manifest.sha256 !== item.payloadSha256 || manifest.sizeBytes !== item.payloadSizeBytes || validation.valid !== true)
            throw new Error(`F5 source contract mismatch ${item.key}`);
        payloads.set(item.key, payload);
        lineage.push({ key: item.key, contract: item.artifactContract, contractVersion: item.artifactContractVersion, payloadPath: item.payloadPath, payloadSizeBytes: item.payloadSizeBytes, payloadSha256: item.payloadSha256, manifestSha256: item.manifestSha256, validationSha256: item.validationSha256 });
    }
    const e1 = payloads.get("e1"), e2 = payloads.get("e2"), e3 = payloads.get("e3"), e4 = payloads.get("e4"), e5 = payloads.get("e5"), e6 = payloads.get("e6"), e7 = payloads.get("e7"), e9 = payloads.get("e9"), catalog = Array.isArray(e1.catalog) ? e1.catalog : [], relation = (value, kind) => positive(value?.relations?.find((item) => item?.kind === kind)?.targetId);
    const originBindings = (Array.isArray(e6.bindings) ? e6.bindings : []).filter((value) => /^origin_/.test(String(value?.source?.entityKind ?? ""))), assetKeys = new Set(originBindings.map((value) => value.assetKey)), originAssetPaths = [...new Set((Array.isArray(e6.pathAssets) ? e6.pathAssets : []).filter((value) => assetKeys.has(value.assetKey) && typeof value.rawPath === "string").map((value) => String(value.rawPath)))].sort();
    const inputs = { series: catalog.filter((value) => value?.identity?.kind === "origin_series").flatMap((value) => positive(value.identity.id) === null ? [] : [{ id: positive(value.identity.id) }]), episodes: catalog.filter((value) => value?.identity?.kind === "origin_episode").flatMap((value) => { const id = positive(value.identity.id), seriesId = relation(value, "origin_series"); return id === null || seriesId === null ? [] : [{ id, seriesId }]; }), pages: catalog.filter((value) => value?.identity?.kind === "origin_page").flatMap((value) => { const id = positive(value.identity.id), episodeId = relation(value, "origin_episode"); return id === null || episodeId === null ? [] : [{ id, episodeId, order: Number.isSafeInteger(value.order) ? value.order : null }]; }), battles: (Array.isArray(e2.originBattles) ? e2.originBattles : []).flatMap((value) => { const id = positive(value?.identity?.id), spotId = positive(value?.originSpotIdRaw); return id === null || spotId === null ? [] : [{ id, spotId }]; }), encounters: (Array.isArray(e3.originEncounters) ? e3.originEncounters : []).flatMap((value) => { const battleId = positive(value?.identity?.sourceId); return battleId === null ? [] : [{ battleId, enemyCardIds: numbers(value?.battles?.flatMap((battle) => battle?.rounds?.flatMap((round) => round?.enemies?.map((enemy) => enemy?.cardId) ?? []) ?? []) ?? []) }]; }), heatUpSets: (Array.isArray(e4.originHeatUpMechanics) ? e4.originHeatUpMechanics : []).flatMap((value) => { const id = positive(value?.heatUpGimmickSetId); return id === null ? [] : [{ id, battleIds: numbers(value.originBattleIds) }]; }), originMissions: (Array.isArray(e5.linkedEventMissions) ? e5.linkedEventMissions : []).filter((value) => value?.targets?.originEpisodeId !== null || value?.targets?.originBattleId !== null || /Origin/.test(String(value?.rawType ?? ""))).flatMap((value) => { const id = positive(value?.identity?.id); return id === null ? [] : [{ id, episodeId: positive(value?.targets?.originEpisodeId), battleId: positive(value?.targets?.originBattleId), rewardCount: Array.isArray(value?.rewards) ? value.rewards.length : 0 }]; }), originAssetPaths, originNumericAssetCount: (Array.isArray(e6.numericAssets) ? e6.numericAssets : []).filter((value) => assetKeys.has(value.assetKey)).length, priorFrontierComparisonCount: (Array.isArray(e7.comparisons) ? e7.comparisons : []).filter((value) => /frontier|origin/i.test(`${value.key ?? ""} ${value.boundary ?? ""}`)).length, readinessDecisionCount: Array.isArray(e9.decisions) ? e9.decisions.length : 0 };
    return { inputs, lineage: lineage.sort((a, b) => a.key.localeCompare(b.key)) };
}
exports.loadFrontierF5Inputs = loadFrontierF5Inputs;
//# sourceMappingURL=frontier-f5-inputs.js.map