"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertLeaderCausalityNativeStable = exports.loadCharacterLeaderCausalityNativeProof = exports.assertLeaderCausalityDatabaseStable = exports.loadPinnedLeaderCausalityDatabase = exports.assertLeaderCausalityK48TargetStable = exports.assertLeaderCausalityK3Stable = exports.loadPinnedK3LeaderCausalitySource = exports.compactLeaderCausalityRawRows = exports.parseLeaderCausalityExpression = void 0;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const stream_1 = require("stream");
const zlib_1 = require("zlib");
const native_runtime_elf_adapter_1 = require("../database-experiment/native-runtime-elf-adapter");
const sqlite_readonly_adapter_1 = require("../database-experiment/sqlite-readonly-adapter");
const artifact_path_1 = require("./artifact-path");
const leader_causality_semantics_contract_1 = require("./leader-causality-semantics-contract");
const leader_scope_source_1 = require("./leader-scope-source");
const leader_value_scope_source_1 = require("./leader-value-scope-source");
const refresh_contract_1 = require("./refresh-contract");
const hash = (value) => (0, crypto_1.createHash)("sha256").update(value).digest("hex");
const K3 = refresh_contract_1.CHARACTER_REFRESH_PROFILE.sidecars.find(item => item.gate === "k3");
function integer(value, label) {
    const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
    if (!Number.isSafeInteger(parsed))
        throw new Error(`K52 malformed ${label}`);
    return parsed;
}
function rowId(row, label) {
    if (typeof row?.provenance?.rowId !== "string" || !row.provenance.rowId)
        throw new Error(`K52 malformed ${label} row ID`);
    return row.provenance.rowId;
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
            throw new Error("K52 K3 decompression exceeded pinned raw size");
        }
        chunks.push(value);
    }
    if (size !== K3.artifact.uncompressedSizeBytes)
        throw new Error("K52 K3 decompressed size changed");
    return Buffer.concat(chunks, size);
}
function parseLeaderCausalityExpression(value) {
    if (Number.isSafeInteger(value) && value > 0)
        return value;
    if (Array.isArray(value) && value.length === 3 && value[0] === "&"
        && Number.isSafeInteger(value[1]) && value[1] > 0 && Number.isSafeInteger(value[2]) && value[2] > 0) {
        return ["&", value[1], value[2]];
    }
    throw new Error("K52 unsupported causality expression");
}
exports.parseLeaderCausalityExpression = parseLeaderCausalityExpression;
function parseCompiledCondition(value, effectRowId) {
    if (typeof value !== "string" || !value)
        throw new Error(`K52 malformed causality JSON for leader effect ${effectRowId}`);
    let parsed;
    try {
        parsed = JSON.parse(value);
    }
    catch {
        throw new Error(`K52 malformed causality JSON for leader effect ${effectRowId}`);
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || !("compiled" in parsed)) {
        throw new Error(`K52 missing compiled causality for leader effect ${effectRowId}`);
    }
    return parseLeaderCausalityExpression(parsed.compiled);
}
function compactLeaderCausalityRawRows(rawRows) {
    if (!Array.isArray(rawRows))
        throw new Error("K52 malformed K3 rawRows");
    const effects = rawRows.filter(row => row?.provenance?.table === "leader_skills").flatMap(row => {
        if (!row.values || typeof row.values !== "object")
            throw new Error("K52 malformed leader effect row");
        if (integer(row.values.efficacy_type, "efficacy_type") !== 82 || row.values.causality_conditions === null)
            return [];
        const id = rowId(row, "leader effect");
        return [{ rowId: id, expression: parseCompiledCondition(row.values.causality_conditions, id) }];
    });
    if (new Set(effects.map(effect => effect.rowId)).size !== effects.length)
        throw new Error("K52 duplicate leader effect row ID");
    const referenced = [...new Set(effects.flatMap(effect => typeof effect.expression === "number"
            ? [String(effect.expression)] : [String(effect.expression[1]), String(effect.expression[2])]))].sort((a, b) => Number(a) - Number(b));
    const includedCausalityRows = new Set(rawRows.filter(row => row?.provenance?.table === "skill_causalities").map(row => rowId(row, "skill causality")));
    return { effects, missingReferencedRowIds: referenced.filter(id => !includedCausalityRows.has(id)) };
}
exports.compactLeaderCausalityRawRows = compactLeaderCausalityRawRows;
async function loadPinnedK3LeaderCausalitySource(sidecarRoot) {
    const base = await (0, leader_value_scope_source_1.loadPinnedK3LeaderValueSource)(sidecarRoot);
    const directory = await (0, artifact_path_1.resolveCharacterInputDirectory)((0, path_1.resolve)(sidecarRoot), "k3", "k3");
    const artifactPath = await (0, artifact_path_1.resolveCharacterInputFile)(directory, K3.artifact.fileName, K3.artifact.fileName);
    const artifact = await (0, leader_scope_source_1.readPinnedLeaderScopeMember)(artifactPath, K3.artifact, "K52 K3 artifact");
    let raw = await gunzipPinned(artifact);
    const parsed = JSON.parse(raw.toString("utf8"));
    raw = undefined;
    if (parsed.schemaVersion !== 1 || parsed.contract !== "dokkan-database-characters-skills"
        || parsed.contractVersion !== K3.contractVersion || !Array.isArray(parsed.rawRows))
        throw new Error("K52 K3 dataset contract changed");
    const compacted = compactLeaderCausalityRawRows(parsed.rawRows);
    const identity = {
        ...base.identity,
        causalityInputFingerprintSha256: hash(JSON.stringify(compacted.effects)),
    };
    parsed.rawRows.length = 0;
    if (Array.isArray(parsed.stateSkills))
        parsed.stateSkills.length = 0;
    return { identity, ...compacted };
}
exports.loadPinnedK3LeaderCausalitySource = loadPinnedK3LeaderCausalitySource;
function assertLeaderCausalityK3Stable(before, after) {
    (0, leader_value_scope_source_1.assertLeaderValueK3Stable)(before, after);
    if (before.causalityInputFingerprintSha256 !== after.causalityInputFingerprintSha256)
        throw new Error("K52 K3 causality fingerprint changed");
}
exports.assertLeaderCausalityK3Stable = assertLeaderCausalityK3Stable;
function assertLeaderCausalityK48TargetStable(before, after) {
    if (JSON.stringify(before) !== JSON.stringify(after))
        throw new Error("K52 K48 target associations changed");
}
exports.assertLeaderCausalityK48TargetStable = assertLeaderCausalityK48TargetStable;
function sameIdentity(left, right) {
    return String(left.dev) === String(right.dev) && String(left.ino) === String(right.ino) && left.size === right.size;
}
async function loadPinnedLeaderCausalityDatabase(databasePath) {
    if (!databasePath)
        throw new Error("K52 requires explicit database path");
    const before = await (0, promises_1.lstat)((0, path_1.resolve)(databasePath), { bigint: false });
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || before.size !== leader_causality_semantics_contract_1.CHARACTER_LEADER_CAUSALITY_PIN.databaseSizeBytes) {
        throw new Error("K52 database must be the pinned regular single-link file");
    }
    const flags = fs_1.constants.O_RDONLY | (fs_1.constants.O_NOFOLLOW ?? 0);
    const handle = await (0, promises_1.open)((0, path_1.resolve)(databasePath), flags);
    try {
        const opened = await handle.stat();
        if (!sameIdentity(before, opened))
            throw new Error("K52 database changed while opening");
        const digest = (0, crypto_1.createHash)("sha256");
        const buffer = Buffer.allocUnsafe(1024 * 1024);
        let offset = 0;
        while (offset < opened.size) {
            const requested = Math.min(buffer.length, opened.size - offset);
            const { bytesRead } = await handle.read(buffer, 0, requested, offset);
            if (bytesRead <= 0)
                throw new Error("K52 database ended before pinned size");
            digest.update(buffer.subarray(0, bytesRead));
            offset += bytesRead;
        }
        const sha256 = digest.digest("hex");
        if (sha256 !== leader_causality_semantics_contract_1.CHARACTER_LEADER_CAUSALITY_PIN.databaseSha256)
            throw new Error("K52 database SHA changed");
        const adapter = sqlite_readonly_adapter_1.ReadOnlySqliteAdapter.fromDescriptorBoundHandle((0, path_1.resolve)(databasePath), handle, opened.size, sha256, { stdoutLimitBytes: 16 * 1024 * 1024 });
        const rawRows = await adapter.readTable("skill_causalities", ["id", "causality_type", "cau_val1", "cau_val2", "cau_val3"]);
        const wanted = new Set(leader_causality_semantics_contract_1.CHARACTER_LEADER_CAUSALITY_PIN.referencedIds);
        const rows = rawRows.flatMap(row => {
            const id = String(row.id);
            if (!wanted.has(id))
                return [];
            return [{ id, causalityType: integer(row.causality_type, "causality_type"), cauVal1: integer(row.cau_val1, "cau_val1"), cauVal2: integer(row.cau_val2, "cau_val2"), cauVal3: integer(row.cau_val3, "cau_val3") }];
        }).sort((left, right) => Number(left.id) - Number(right.id));
        if (new Set(rows.map(row => row.id)).size !== rows.length)
            throw new Error("K52 duplicate database causality row");
        const afterHandle = await handle.stat();
        const afterPath = await (0, promises_1.lstat)((0, path_1.resolve)(databasePath), { bigint: false });
        if (!sameIdentity(opened, afterHandle) || !sameIdentity(opened, afterPath) || afterPath.nlink !== 1)
            throw new Error("K52 database changed during read");
        return { identity: { sha256, sizeBytes: opened.size, rowsFingerprintSha256: hash(JSON.stringify(rows)), descriptorBoundReadOnly: true }, rows };
    }
    finally {
        await handle.close();
    }
}
exports.loadPinnedLeaderCausalityDatabase = loadPinnedLeaderCausalityDatabase;
function assertLeaderCausalityDatabaseStable(before, after) {
    if (JSON.stringify(before) !== JSON.stringify(after))
        throw new Error("K52 database identity or causality rows changed");
}
exports.assertLeaderCausalityDatabaseStable = assertLeaderCausalityDatabaseStable;
function evidencePath() {
    const compiled = (0, path_1.resolve)(__dirname, "..", "database-experiment", "native-leader-causality-semantics.json");
    return (0, fs_1.existsSync)(compiled) ? compiled : (0, path_1.resolve)(__dirname, "..", "..", "database-experiment", "native-leader-causality-semantics.json");
}
function branchTarget(callerVma, instruction) {
    const word = instruction.readUInt32LE();
    if (((word & 0xfc000000) >>> 0) !== 0x94000000)
        throw new Error(`K52 native call opcode changed at ${callerVma}`);
    let immediate = word & 0x03ffffff;
    if (immediate & 0x02000000)
        immediate -= 0x04000000;
    return callerVma + immediate * 4;
}
function pltRelocationOffset(pltVma, bytes) {
    const adrp = bytes.readUInt32LE(0), ldr = bytes.readUInt32LE(4);
    if (((adrp & 0x9f00001f) >>> 0) !== 0x90000010 || ((ldr & 0xffc003ff) >>> 0) !== 0xf9400211
        || bytes.subarray(12, 16).toString("hex") !== "20021fd6")
        throw new Error(`K52 malformed PLT at ${pltVma}`);
    let pages = (((adrp >>> 5) & 0x7ffff) << 2) | ((adrp >>> 29) & 3);
    if (pages & 0x100000)
        pages -= 0x200000;
    return (pltVma & ~0xfff) + pages * 4096 + ((ldr >>> 10) & 0xfff) * 8;
}
async function loadCharacterLeaderCausalityNativeProof(nativeRuntimePath) {
    const pin = leader_causality_semantics_contract_1.CHARACTER_LEADER_CAUSALITY_PIN;
    const [native, evidenceBytes] = await Promise.all([
        (0, leader_scope_source_1.readPinnedLeaderScopeMember)((0, path_1.resolve)(nativeRuntimePath), { sha256: pin.nativeSha256, sizeBytes: pin.nativeSizeBytes }, "K52 native runtime"),
        (0, leader_scope_source_1.readPinnedLeaderScopeMember)(evidencePath(), { sha256: pin.nativeEvidenceSha256, sizeBytes: pin.nativeEvidenceSizeBytes }, "K52 native evidence"),
    ]);
    const evidence = JSON.parse(evidenceBytes.toString("utf8"));
    const inspection = (0, native_runtime_elf_adapter_1.parseNativeRuntimeElf)(native);
    if (evidence.schemaVersion !== 1 || evidence.contract !== "dokkan-database-native-leader-causality-semantics"
        || evidence.sourceSha256 !== pin.nativeSha256 || !Array.isArray(evidence.codeRegions) || evidence.codeRegions.length !== pin.nativeCodeRegions
        || !Array.isArray(evidence.exactPltCalls) || evidence.exactPltCalls.length !== pin.nativeExactCalls)
        throw new Error("K52 native evidence contract changed");
    for (const region of evidence.codeRegions) {
        if (!Number.isSafeInteger(region.vma) || !Number.isSafeInteger(region.sizeBytes)
            || hash(inspection.readVirtualBytes(region.vma, region.sizeBytes)) !== region.codeSha256)
            throw new Error(`K52 native code changed: ${region.role}`);
        const symbols = inspection.symbols.filter(symbol => symbol.name === region.symbol);
        if (symbols.length !== 1 || symbols[0].value !== region.vma || symbols[0].size !== region.sizeBytes)
            throw new Error(`K52 native symbol changed: ${region.role}`);
    }
    for (const call of evidence.exactPltCalls) {
        const instruction = inspection.readVirtualBytes(call.callerVma, 4), pltBytes = inspection.readVirtualBytes(call.pltVma, 16);
        if (instruction.toString("hex") !== call.instructionHex || branchTarget(call.callerVma, instruction) !== call.pltVma
            || pltBytes.toString("hex") !== call.pltBytesHex || pltRelocationOffset(call.pltVma, pltBytes) !== call.relocationOffset)
            throw new Error(`K52 native call changed at ${call.callerVma}`);
        const relocations = inspection.relocations.filter(relocation => relocation.offset === call.relocationOffset);
        if (relocations.length !== 1 || relocations[0].type !== 1026 || relocations[0].symbolName !== call.symbol
            || relocations[0].symbolValue !== call.symbolValue || relocations[0].addend !== 0)
            throw new Error(`K52 native PLT binding changed at ${call.callerVma}`);
    }
    const dispatch = evidence.dispatchTable;
    const tableSymbols = inspection.symbols.filter(symbol => symbol.name === dispatch.symbol);
    if (tableSymbols.length !== 1 || tableSymbols[0].value !== dispatch.vma || tableSymbols[0].size !== dispatch.sizeBytes
        || hash(inspection.readVirtualBytes(dispatch.vma, dispatch.sizeBytes)) !== dispatch.bytesSha256
        || dispatch.slotOffset !== dispatch.vma + dispatch.causalityType * 8)
        throw new Error("K52 native causality dispatch table changed");
    const slot = inspection.relocations.filter(relocation => relocation.offset === dispatch.slotOffset);
    if (slot.length !== 1 || slot[0].type !== dispatch.relocationType || slot[0].symbolName !== dispatch.handlerSymbol
        || slot[0].symbolValue !== dispatch.handlerVma || slot[0].addend !== 0)
        throw new Error("K52 native type-35 dispatch changed");
    const semantics = evidence.auditedSemantics;
    if (JSON.stringify(semantics.acceptedCompiledShapes) !== JSON.stringify(["integer", "binary_ampersand_array"])
        || semantics.binaryAmpersandMeaning !== "both_predicates_required" || semantics.type35ReadsOnlyCauVal1 !== true
        || JSON.stringify(semantics.selectedBitRangeInclusive) !== JSON.stringify([0, 31])
        || semantics.selectedBitRequirement !== "each_requested_bit_witnessed_by_an_eligible_card"
        || semantics.humanBitNamesBound !== false || semantics.partySelectionContextBound !== false
        || semantics.lifecycleBound !== false || semantics.stackingBound !== false)
        throw new Error("K52 native semantic boundary changed");
    return {
        elfSha256: pin.nativeSha256, elfSizeBytes: pin.nativeSizeBytes, evidenceSha256: pin.nativeEvidenceSha256,
        evidenceSizeBytes: pin.nativeEvidenceSizeBytes, codeRegionCount: evidence.codeRegions.length, exactCallCount: evidence.exactPltCalls.length,
        executionChainBound: true, type35DispatchBound: true, onlyCauVal1Read: true, bitRangeInclusive: [0, 31],
        humanBitNamesBound: false, partySelectionContextBound: false, lifecycleBound: false, stackingBound: false,
    };
}
exports.loadCharacterLeaderCausalityNativeProof = loadCharacterLeaderCausalityNativeProof;
function assertLeaderCausalityNativeStable(before, after) {
    if (JSON.stringify(before) !== JSON.stringify(after))
        throw new Error("K52 native evidence changed");
}
exports.assertLeaderCausalityNativeStable = assertLeaderCausalityNativeStable;
//# sourceMappingURL=leader-causality-semantics-source.js.map