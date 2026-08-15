"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertLeaderTargetNativeStable = exports.loadCharacterLeaderTargetNativeProof = exports.compactK48LeaderTargetSource = exports.assertLeaderTargetK3Stable = exports.loadPinnedK3LeaderTargetSource = exports.compactLeaderTargetRawRows = void 0;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const path_1 = require("path");
const stream_1 = require("stream");
const zlib_1 = require("zlib");
const native_runtime_elf_adapter_1 = require("../database-experiment/native-runtime-elf-adapter");
const artifact_path_1 = require("./artifact-path");
const leader_scope_source_1 = require("./leader-scope-source");
const refresh_contract_1 = require("./refresh-contract");
const leader_native_semantics_contract_1 = require("./leader-native-semantics-contract");
const leader_native_semantics_source_1 = require("./leader-native-semantics-source");
const leader_value_scope_source_1 = require("./leader-value-scope-source");
const leader_target_semantics_contract_1 = require("./leader-target-semantics-contract");
const hash = (bytes) => (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
const K3 = refresh_contract_1.CHARACTER_REFRESH_PROFILE.sidecars.find(item => item.gate === "k3");
function fixedEvidencePath(name) {
    const compiled = (0, path_1.resolve)(__dirname, "..", "database-experiment", name);
    return (0, fs_1.existsSync)(compiled) ? compiled : (0, path_1.resolve)(__dirname, "..", "..", "database-experiment", name);
}
async function gunzipPinned(bytes) {
    const chunks = [];
    let size = 0;
    const stream = stream_1.Readable.from(bytes).pipe((0, zlib_1.createGunzip)());
    for await (const chunk of stream) {
        const value = chunk;
        size += value.length;
        if (size > K3.artifact.uncompressedSizeBytes) {
            stream.destroy();
            throw new Error("K51 K3 decompression exceeded pinned raw size");
        }
        chunks.push(value);
    }
    if (size !== K3.artifact.uncompressedSizeBytes)
        throw new Error("K51 K3 decompressed size changed");
    return Buffer.concat(chunks, size);
}
function integer(value, label) { const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN; if (!Number.isSafeInteger(parsed))
    throw new Error(`K51 malformed ${label}`); return parsed; }
function id(value, label) { if ((typeof value !== "string" && typeof value !== "number") || value === "" || value === null || value === undefined || typeof value === "number" && !Number.isFinite(value))
    throw new Error(`K51 malformed ${label}`); return String(value); }
function compactLeaderTargetRawRows(rawRows) {
    if (!Array.isArray(rawRows))
        throw new Error("K51 malformed K3 rawRows");
    const rows = rawRows.filter(row => row?.provenance?.table === "sub_target_types").map(row => {
        if (typeof row.provenance.rowId !== "string" || !row.provenance.rowId || !row.values || typeof row.values !== "object")
            throw new Error("K51 malformed sub-target row");
        return { rowId: row.provenance.rowId, targetSetId: id(row.values.sub_target_type_set_id, "target set ID"), valueType: integer(row.values.target_value_type, "target value type"), valueId: id(row.values.target_value, "target value") };
    });
    if (new Set(rows.map(row => row.rowId)).size !== rows.length)
        throw new Error("K51 duplicate sub-target row ID");
    return rows;
}
exports.compactLeaderTargetRawRows = compactLeaderTargetRawRows;
async function loadPinnedK3LeaderTargetSource(sidecarRoot) {
    const directory = await (0, artifact_path_1.resolveCharacterInputDirectory)((0, path_1.resolve)(sidecarRoot), "k3", "k3");
    const artifactPath = await (0, artifact_path_1.resolveCharacterInputFile)(directory, K3.artifact.fileName, K3.artifact.fileName);
    const artifact = await (0, leader_scope_source_1.readPinnedLeaderScopeMember)(artifactPath, K3.artifact, "K51 artifact");
    let raw = await gunzipPinned(artifact);
    const parsed = JSON.parse(raw.toString("utf8"));
    raw = undefined;
    if (parsed.schemaVersion !== 1 || parsed.contract !== "dokkan-database-characters-skills" || parsed.contractVersion !== K3.contractVersion || !Array.isArray(parsed.rawRows))
        throw new Error("K51 K3 dataset contract changed");
    const rows = compactLeaderTargetRawRows(parsed.rawRows);
    parsed.rawRows.length = 0;
    parsed.stateSkills.length = 0;
    return { identity: { artifactSha256: K3.artifact.sha256, targetInputFingerprintSha256: hash(JSON.stringify(rows)) }, rows };
}
exports.loadPinnedK3LeaderTargetSource = loadPinnedK3LeaderTargetSource;
function assertLeaderTargetK3Stable(before, after) { if (JSON.stringify(before) !== JSON.stringify(after))
    throw new Error("K51 K3 target identity changed"); }
exports.assertLeaderTargetK3Stable = assertLeaderTargetK3Stable;
function compactK48LeaderTargetSource(artifacts) {
    const identity = (0, leader_value_scope_source_1.compactK48LeaderValueSource)(artifacts).identity;
    const effects = artifacts.dataset.states.flatMap(state => state.leader.effects.map(effect => {
        if (effect.effect.table !== "leader_skills" || effect.targets.some(target => target.table !== "sub_target_types"))
            throw new Error("K51 K48 table binding changed");
        return { effectRowId: effect.effect.rowId, targetSetId: effect.targetSetId, targetRowIds: effect.targets.map(target => target.rowId) };
    }));
    return { identity, effects };
}
exports.compactK48LeaderTargetSource = compactK48LeaderTargetSource;
function validateRegions(inspection, regions, label) {
    for (const region of regions) {
        if (!Number.isSafeInteger(region.vma) || !Number.isSafeInteger(region.sizeBytes) || hash(inspection.readVirtualBytes(region.vma, region.sizeBytes)) !== region.codeSha256)
            throw new Error(`K51 ${label} code region changed: ${region.role}`);
        if (!String(region.symbol).startsWith("local@")) {
            const matches = inspection.symbols.filter(symbol => symbol.name === region.symbol);
            if (matches.length !== 1 || matches[0].value !== region.vma || matches[0].size !== region.sizeBytes)
                throw new Error(`K51 ${label} symbol changed: ${region.role}`);
        }
    }
}
function exactSymbol(inspection, expected, label) {
    const matches = inspection.symbols.filter(symbol => symbol.name === expected.symbol);
    if (matches.length !== 1 || matches[0].value !== expected.vma || matches[0].size !== expected.sizeBytes)
        throw new Error(`K51 ${label} symbol changed`);
}
function exactAbs64Binding(inspection, expected) {
    const matches = inspection.relocations.filter(relocation => relocation.offset === expected.offset);
    if (matches.length !== 1 || matches[0].type !== 257 || matches[0].symbolName !== expected.symbol || matches[0].symbolValue !== expected.symbolValue || matches[0].addend !== 0) {
        throw new Error(`K51 runtime bridge vtable binding changed at ${expected.offset}`);
    }
}
function branchTarget(callerVma, instruction) {
    const word = instruction.readUInt32LE();
    if (((word & 0xfc000000) >>> 0) !== 0x94000000)
        throw new Error(`K51 runtime bridge call opcode changed at ${callerVma}`);
    let immediate = word & 0x03ffffff;
    if (immediate & 0x02000000)
        immediate -= 0x04000000;
    return callerVma + immediate * 4;
}
function pltRelocationOffset(pltVma, bytes) {
    const adrp = bytes.readUInt32LE(0), ldr = bytes.readUInt32LE(4);
    if (((adrp & 0x9f00001f) >>> 0) !== 0x90000010 || ((ldr & 0xffc003ff) >>> 0) !== 0xf9400211 || bytes.subarray(12, 16).toString("hex") !== "20021fd6")
        throw new Error(`K51 malformed runtime bridge PLT at ${pltVma}`);
    let pages = (((adrp >>> 5) & 0x7ffff) << 2) | ((adrp >>> 29) & 3);
    if (pages & 0x100000)
        pages -= 0x200000;
    return (pltVma & ~0xfff) + pages * 4096 + ((ldr >>> 10) & 0xfff) * 8;
}
function exactPltCall(inspection, expected) {
    const instruction = inspection.readVirtualBytes(expected.callerVma, 4), pltBytes = inspection.readVirtualBytes(expected.pltVma, 16);
    if (instruction.toString("hex") !== expected.instructionHex || branchTarget(expected.callerVma, instruction) !== expected.pltVma
        || pltBytes.toString("hex") !== expected.pltBytesHex || pltRelocationOffset(expected.pltVma, pltBytes) !== expected.relocationOffset)
        throw new Error(`K51 runtime bridge call changed at ${expected.callerVma}`);
    const matches = inspection.relocations.filter(relocation => relocation.offset === expected.relocationOffset);
    if (matches.length !== 1 || matches[0].type !== 1026 || matches[0].symbolName !== expected.symbol || matches[0].symbolValue !== expected.symbolValue || matches[0].addend !== 0) {
        throw new Error(`K51 runtime bridge PLT binding changed at ${expected.callerVma}`);
    }
}
async function loadCharacterLeaderTargetNativeProof(nativeRuntimePath) {
    const pin = leader_target_semantics_contract_1.CHARACTER_LEADER_TARGET_PIN, k50 = await (0, leader_native_semantics_source_1.loadCharacterLeaderNativeProof)(nativeRuntimePath);
    const [native, targetBytes, subBytes] = await Promise.all([
        (0, leader_scope_source_1.readPinnedLeaderScopeMember)((0, path_1.resolve)(nativeRuntimePath), { sha256: leader_native_semantics_contract_1.CHARACTER_LEADER_NATIVE_PIN.elfSha256, sizeBytes: leader_native_semantics_contract_1.CHARACTER_LEADER_NATIVE_PIN.elfSizeBytes }, "K51 native runtime"),
        (0, leader_scope_source_1.readPinnedLeaderScopeMember)(fixedEvidencePath("native-passive-target-dispatch-semantics.json"), { sha256: pin.targetDispatchEvidenceSha256, sizeBytes: pin.targetDispatchEvidenceSizeBytes }, "K51 target evidence"),
        (0, leader_scope_source_1.readPinnedLeaderScopeMember)(fixedEvidencePath("native-sub-target-type-semantics.json"), { sha256: pin.subTargetEvidenceSha256, sizeBytes: pin.subTargetEvidenceSizeBytes }, "K51 sub-target evidence"),
    ]);
    const target = JSON.parse(targetBytes.toString("utf8")), sub = JSON.parse(subBytes.toString("utf8")), inspection = (0, native_runtime_elf_adapter_1.parseNativeRuntimeElf)(native);
    if (target.schemaVersion !== 1 || sub.schemaVersion !== 1 || target.sourceSha256 !== k50.nativeSha256 || sub.sourceSha256 !== k50.nativeSha256)
        throw new Error("K51 evidence lineage changed");
    validateRegions(inspection, target.codeRegions, "target");
    validateRegions(inspection, sub.codeRegions, "sub-target");
    const targetMeanings = [2, 12, 13].map(raw => target.supportedTargets.find((item) => item.raw === raw)?.scope);
    const valueMeanings = [1, 2].map(raw => sub.valueTypes.find((item) => item.raw === raw));
    const targetTypesBound = JSON.stringify(targetMeanings) === JSON.stringify(["team_allies", "super_class_allies", "extreme_class_allies"]);
    const subTargetTypesBound = valueMeanings[0]?.status === "supported" && valueMeanings[0]?.selector === "card_category_id" && valueMeanings[0]?.inclusion === "include"
        && valueMeanings[1]?.status === "supported" && valueMeanings[1]?.selector === "card_category_id" && valueMeanings[1]?.inclusion === "exclude"
        && sub.composition?.operator === "and" && sub.composition?.emptySetBehavior === "identity" && sub.composition?.duplicateBehavior === "reapplied_filter";
    const bridge = leader_target_semantics_contract_1.CHARACTER_LEADER_TARGET_RUNTIME_BRIDGE_PIN;
    validateRegions(inspection, bridge.codeRegions, "runtime bridge");
    for (const vtable of [bridge.managerVtable, bridge.passiveVtable]) {
        exactSymbol(inspection, vtable, "runtime bridge vtable");
        if (hash(inspection.readVirtualBytes(vtable.vma, vtable.sizeBytes)) !== vtable.bytesSha256)
            throw new Error(`K51 runtime bridge vtable bytes changed: ${vtable.symbol}`);
    }
    for (const binding of bridge.vtableBindings)
        exactAbs64Binding(inspection, binding);
    for (const call of bridge.pltCalls)
        exactPltCall(inspection, call);
    const dispatchBlock = bridge.managerAddDispatchBlock;
    if (hash(inspection.readVirtualBytes(dispatchBlock.vma, dispatchBlock.sizeBytes)) !== dispatchBlock.bytesSha256)
        throw new Error("K51 leader manager add-status dispatch changed");
    const leaderRuntimeBridgeBound = k50.battleFactoryFieldTransferBound && k50.type82DispatchBound
        && sub.codeRegions.some((region) => region.role === "skill_model_set_lookup" && region.symbol === "_ZN10SkillModel24getSubTargetTypesBySetIdEi")
        && target.codeRegions.some((region) => region.role === "dispatch_consumer" && region.symbol === bridge.codeRegions[4].symbol)
        && bridge.codeRegions.length === 5 && bridge.vtableBindings.length === 4 && bridge.pltCalls.length === 3;
    return { k50, targetDispatchEvidenceSha256: hash(targetBytes), subTargetEvidenceSha256: hash(subBytes), targetCodeRegionCount: target.codeRegions.length, subTargetCodeRegionCount: sub.codeRegions.length, leaderRuntimeBridgeCodeRegionCount: bridge.codeRegions.length, leaderRuntimeBridgeVtableBindingCount: bridge.vtableBindings.length, leaderRuntimeBridgeCallSiteCount: bridge.pltCalls.length + 1, targetTypesBound, subTargetTypesBound, leaderRuntimeBridgeBound };
}
exports.loadCharacterLeaderTargetNativeProof = loadCharacterLeaderTargetNativeProof;
function assertLeaderTargetNativeStable(before, after) { if (JSON.stringify(before) !== JSON.stringify(after))
    throw new Error("K51 native target proof changed"); }
exports.assertLeaderTargetNativeStable = assertLeaderTargetNativeStable;
//# sourceMappingURL=leader-target-semantics-source.js.map