"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertLeaderCausalityCollectionNativeStable = exports.loadCharacterLeaderCausalityCollectionNativeProof = void 0;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const path_1 = require("path");
const native_runtime_elf_adapter_1 = require("../database-experiment/native-runtime-elf-adapter");
const leader_causality_collection_contract_1 = require("./leader-causality-collection-contract");
const leader_scope_source_1 = require("./leader-scope-source");
const hash = (value) => (0, crypto_1.createHash)("sha256").update(value).digest("hex");
function evidencePath() {
    const compiled = (0, path_1.resolve)(__dirname, "..", "database-experiment", "native-leader-causality-collection.json");
    return (0, fs_1.existsSync)(compiled) ? compiled : (0, path_1.resolve)(__dirname, "..", "..", "database-experiment", "native-leader-causality-collection.json");
}
function branchTarget(callerVma, instruction) {
    if (instruction.length !== 4)
        throw new Error(`K53 malformed call instruction at ${callerVma}`);
    const word = instruction.readUInt32LE();
    if (((word & 0xfc000000) >>> 0) !== 0x94000000)
        throw new Error(`K53 native call opcode changed at ${callerVma}`);
    let immediate = word & 0x03ffffff;
    if (immediate & 0x02000000)
        immediate -= 0x04000000;
    return callerVma + immediate * 4;
}
function pltRelocationOffset(pltVma, bytes) {
    if (bytes.length !== 16)
        throw new Error(`K53 malformed PLT size at ${pltVma}`);
    const adrp = bytes.readUInt32LE(0), ldr = bytes.readUInt32LE(4);
    if (((adrp & 0x9f00001f) >>> 0) !== 0x90000010 || ((ldr & 0xffc003ff) >>> 0) !== 0xf9400211
        || bytes.subarray(12, 16).toString("hex") !== "20021fd6")
        throw new Error(`K53 malformed PLT at ${pltVma}`);
    let pages = (((adrp >>> 5) & 0x7ffff) << 2) | ((adrp >>> 29) & 3);
    if (pages & 0x100000)
        pages -= 0x200000;
    return (pltVma & ~0xfff) + pages * 4096 + ((ldr >>> 10) & 0xfff) * 8;
}
const EXPECTED_OFFSETS = {
    playerCandidateStrideBytes: 0x590,
    playerUserCardReferenceOffsetBytes: 0xa0,
    puzzleEnemyVectorBeginOffsetBytes: 0x100,
    puzzleEnemyVectorEndOffsetBytes: 0x108,
    puzzleEnemyVectorElementSizeBytes: 8,
};
const EXPECTED_SEMANTICS = {
    deckIndex0: "exactly_seven_ingame_data_indexed_character_records",
    deckIndex1: "puzzle_enemy_runtime_vector",
    deckIndex1Empty: "condition_false",
    otherDeckIndices: "unsupported",
    candidateResolution: "runtime_reference_to_master_card_element_and_awakening_element_type",
    cauVal1Read: true,
    cauVal2Read: false,
    cauVal3Read: false,
    explicitAliveFilter: false,
    explicitActiveFilter: false,
    explicitCategoryFilter: false,
    explicitTargetFilter: false,
    effectiveLeaderBranchBound: false,
    humanElementNamesBound: false,
    lifecycleBound: false,
    deathOrRemovalBound: false,
    stackingBound: false,
    productAuthorityBound: false,
};
async function loadCharacterLeaderCausalityCollectionNativeProof(nativeRuntimePath) {
    if (!nativeRuntimePath)
        throw new Error("K53 requires explicit native runtime path");
    const pin = leader_causality_collection_contract_1.CHARACTER_LEADER_CAUSALITY_COLLECTION_PIN;
    const [native, evidenceBytes] = await Promise.all([
        (0, leader_scope_source_1.readPinnedLeaderScopeMember)((0, path_1.resolve)(nativeRuntimePath), { sha256: pin.nativeSha256, sizeBytes: pin.nativeSizeBytes }, "K53 native runtime"),
        (0, leader_scope_source_1.readPinnedLeaderScopeMember)(evidencePath(), { sha256: pin.nativeEvidenceSha256, sizeBytes: pin.nativeEvidenceSizeBytes }, "K53 native evidence"),
    ]);
    const evidence = JSON.parse(evidenceBytes.toString("utf8"));
    const inspection = (0, native_runtime_elf_adapter_1.parseNativeRuntimeElf)(native);
    if (inspection.elfClass !== 64 || inspection.endian !== "little" || inspection.machine !== 183
        || evidence.schemaVersion !== 1 || evidence.contract !== "dokkan-database-native-leader-causality-collection"
        || evidence.sourceSha256 !== pin.nativeSha256
        || !Array.isArray(evidence.codeRegions) || evidence.codeRegions.length !== pin.nativeCodeRegions
        || !Array.isArray(evidence.instructionFragments) || evidence.instructionFragments.length !== pin.nativeInstructionFragments
        || !Array.isArray(evidence.exactPltCalls) || evidence.exactPltCalls.length !== pin.nativeExactCalls
        || !Array.isArray(evidence.vtables) || evidence.vtables.length !== pin.nativeVtables) {
        throw new Error("K53 native evidence contract changed");
    }
    for (const region of evidence.codeRegions) {
        if (typeof region.role !== "string" || typeof region.symbol !== "string" || !Number.isSafeInteger(region.vma)
            || !Number.isSafeInteger(region.sizeBytes) || typeof region.codeSha256 !== "string"
            || hash(inspection.readVirtualBytes(region.vma, region.sizeBytes)) !== region.codeSha256) {
            throw new Error(`K53 native code changed: ${region.role}`);
        }
        const symbols = inspection.symbols.filter(symbol => symbol.name === region.symbol);
        if (symbols.length !== 1 || symbols[0].value !== region.vma || symbols[0].size !== region.sizeBytes) {
            throw new Error(`K53 native symbol changed: ${region.role}`);
        }
    }
    for (const fragment of evidence.instructionFragments) {
        if (typeof fragment.role !== "string" || !Number.isSafeInteger(fragment.vma) || !Number.isSafeInteger(fragment.sizeBytes)
            || typeof fragment.instructionHex !== "string" || fragment.instructionHex.length !== fragment.sizeBytes * 2
            || inspection.readVirtualBytes(fragment.vma, fragment.sizeBytes).toString("hex") !== fragment.instructionHex) {
            throw new Error(`K53 native instruction fragment changed: ${fragment.role}`);
        }
    }
    for (const call of evidence.exactPltCalls) {
        const instruction = inspection.readVirtualBytes(call.callerVma, 4);
        const pltBytes = inspection.readVirtualBytes(call.pltVma, 16);
        if (instruction.toString("hex") !== call.instructionHex || branchTarget(call.callerVma, instruction) !== call.pltVma
            || pltBytes.toString("hex") !== call.pltBytesHex || pltRelocationOffset(call.pltVma, pltBytes) !== call.relocationOffset) {
            throw new Error(`K53 native call changed at ${call.callerVma}`);
        }
        const relocations = inspection.relocations.filter(relocation => relocation.offset === call.relocationOffset);
        if (relocations.length !== 1 || relocations[0].type !== 1026 || relocations[0].symbolName !== call.symbol
            || relocations[0].symbolValue !== call.symbolValue || relocations[0].addend !== 0) {
            throw new Error(`K53 native PLT binding changed at ${call.callerVma}`);
        }
    }
    let vtableBindingCount = 0;
    for (const vtable of evidence.vtables) {
        const symbols = inspection.symbols.filter(symbol => symbol.name === vtable.symbol);
        if (typeof vtable.role !== "string" || symbols.length !== 1 || symbols[0].value !== vtable.vma
            || symbols[0].size !== vtable.sizeBytes || hash(inspection.readVirtualBytes(vtable.vma, vtable.sizeBytes)) !== vtable.bytesSha256
            || !Number.isSafeInteger(vtable.vptrBiasBytes) || vtable.vptrBiasBytes < 0
            || !Array.isArray(vtable.bindings))
            throw new Error(`K53 native vtable changed: ${vtable.role}`);
        for (const binding of vtable.bindings) {
            const relocations = inspection.relocations.filter(relocation => relocation.offset === binding.relocationOffset);
            if (!Number.isSafeInteger(binding.objectVirtualSlotOffset) || relocations.length !== 1
                || binding.relocationOffset !== vtable.vma + vtable.vptrBiasBytes + binding.objectVirtualSlotOffset
                || relocations[0].type !== binding.relocationType || relocations[0].symbolName !== binding.symbol
                || relocations[0].symbolValue !== binding.symbolValue || relocations[0].addend !== 0) {
                throw new Error(`K53 native vtable binding changed at ${binding.relocationOffset}`);
            }
            vtableBindingCount++;
        }
    }
    if (vtableBindingCount !== pin.nativeVtableBindings || JSON.stringify(evidence.runtimeOffsets) !== JSON.stringify(EXPECTED_OFFSETS)
        || JSON.stringify(evidence.auditedSemantics) !== JSON.stringify(EXPECTED_SEMANTICS)) {
        throw new Error("K53 native collection semantic boundary changed");
    }
    return {
        elfSha256: pin.nativeSha256,
        elfSizeBytes: pin.nativeSizeBytes,
        evidenceSha256: pin.nativeEvidenceSha256,
        evidenceSizeBytes: pin.nativeEvidenceSizeBytes,
        codeRegionCount: evidence.codeRegions.length,
        instructionFragmentCount: evidence.instructionFragments.length,
        exactCallCount: evidence.exactPltCalls.length,
        vtableCount: evidence.vtables.length,
        vtableBindingCount,
        deckIndexVirtualDispatchBound: true,
        deckIndex0SevenPlayerRecordsBound: true,
        deckIndex1PuzzleEnemyVectorBound: true,
        deckIndex1EmptyFailsBound: true,
        otherDeckIndicesSupported: false,
        playerRuntimeUserCardOffsetBound: true,
        masterCardResolutionBound: true,
        cardElementGettersBound: true,
        elementBitPatternCallBound: true,
        onlyCauVal1Read: true,
        explicitAliveActiveCategoryOrTargetFilterFound: false,
        effectiveLeaderBranchBound: false,
        humanElementNamesBound: false,
        lifecycleBound: false,
        deathOrRemovalBound: false,
        stackingBound: false,
        productAuthorityBound: false,
    };
}
exports.loadCharacterLeaderCausalityCollectionNativeProof = loadCharacterLeaderCausalityCollectionNativeProof;
function assertLeaderCausalityCollectionNativeStable(before, after) {
    if (JSON.stringify(before) !== JSON.stringify(after))
        throw new Error("K53 native collection evidence changed");
}
exports.assertLeaderCausalityCollectionNativeStable = assertLeaderCausalityCollectionNativeStable;
//# sourceMappingURL=leader-causality-collection-source.js.map