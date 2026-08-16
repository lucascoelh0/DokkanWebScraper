"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertLeaderLifecycleSemanticsNativeStable = exports.loadCharacterLeaderLifecycleSemanticsNativeProof = void 0;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const path_1 = require("path");
const native_runtime_elf_adapter_1 = require("../database-experiment/native-runtime-elf-adapter");
const leader_lifecycle_semantics_contract_1 = require("./leader-lifecycle-semantics-contract");
const leader_scope_source_1 = require("./leader-scope-source");
const hash = (value) => (0, crypto_1.createHash)("sha256").update(value).digest("hex");
function evidencePath() {
    const compiled = (0, path_1.resolve)(__dirname, "..", "database-experiment", "native-leader-lifecycle-semantics.json");
    return (0, fs_1.existsSync)(compiled) ? compiled : (0, path_1.resolve)(__dirname, "..", "..", "database-experiment", "native-leader-lifecycle-semantics.json");
}
function branchTarget(callerVma, instruction, link) {
    if (instruction.length !== 4)
        throw new Error(`K55 malformed branch instruction at ${callerVma}`);
    const word = instruction.readUInt32LE();
    const expected = link ? 0x94000000 : 0x14000000;
    if (((word & 0xfc000000) >>> 0) !== expected)
        throw new Error(`K55 native branch opcode changed at ${callerVma}`);
    let immediate = word & 0x03ffffff;
    if (immediate & 0x02000000)
        immediate -= 0x04000000;
    return callerVma + immediate * 4;
}
function pltRelocationOffset(pltVma, bytes) {
    if (bytes.length !== 16)
        throw new Error(`K55 malformed PLT size at ${pltVma}`);
    const adrp = bytes.readUInt32LE(0), ldr = bytes.readUInt32LE(4);
    if (((adrp & 0x9f00001f) >>> 0) !== 0x90000010 || ((ldr & 0xffc003ff) >>> 0) !== 0xf9400211
        || bytes.subarray(12, 16).toString("hex") !== "20021fd6")
        throw new Error(`K55 malformed PLT at ${pltVma}`);
    let pages = (((adrp >>> 5) & 0x7ffff) << 2) | ((adrp >>> 29) & 3);
    if (pages & 0x100000)
        pages -= 0x200000;
    return (pltVma & ~0xfff) + pages * 4096 + ((ldr >>> 10) & 0xfff) * 8;
}
const EXPECTED_SEMANTICS = {
    oneStatusPerSourceRow: true,
    statusCreationSite: "factory_loop_over_leader_skill_set_rows",
    statusApplicationSite: "shared_start_turn_status_execution_invocation",
    startTurnRawArguments: [[0, 0, 1, 3], [6, 0, 1, 3]],
    type82MatchingRowsAdditiveInCalculator: true,
    calcOption0IntegerConversionAtHandler: true,
    calcOption2DivideBy100FloatAtHandler: true,
    type35RequiredForPostCondition: false,
    deactivationApisInvoked: true,
    deactivationOutcomeBound: false,
    db37PassiveTurnOrIsOnceLeaderBindingFound: false,
    singleEvaluationOrReevaluationBound: false,
    durationBound: false,
    resetOrRemovalOutcomeBound: false,
    enterExitBound: false,
    leaderFriendCompositionBound: false,
    finalStackingOrCompositionBound: false,
    finalOperationOrderingOutsideHandlerBound: false,
    transformationDeathReviveExchangeStandbyBound: false,
    finalRoundingBound: false,
};
async function loadCharacterLeaderLifecycleSemanticsNativeProof(nativeRuntimePath) {
    if (!nativeRuntimePath)
        throw new Error("K55 requires explicit native runtime path");
    const pin = leader_lifecycle_semantics_contract_1.CHARACTER_LEADER_LIFECYCLE_SEMANTICS_PIN;
    const [native, evidenceBytes] = await Promise.all([
        (0, leader_scope_source_1.readPinnedLeaderScopeMember)((0, path_1.resolve)(nativeRuntimePath), { sha256: pin.nativeSha256, sizeBytes: pin.nativeSizeBytes }, "K55 native runtime"),
        (0, leader_scope_source_1.readPinnedLeaderScopeMember)(evidencePath(), { sha256: pin.nativeEvidenceSha256, sizeBytes: pin.nativeEvidenceSizeBytes }, "K55 native evidence"),
    ]);
    const evidence = JSON.parse(evidenceBytes.toString("utf8"));
    const inspection = (0, native_runtime_elf_adapter_1.parseNativeRuntimeElf)(native);
    if (inspection.elfClass !== 64 || inspection.endian !== "little" || inspection.machine !== 183
        || evidence.schemaVersion !== 1 || evidence.contract !== "dokkan-database-native-leader-lifecycle-semantics"
        || evidence.sourceSha256 !== pin.nativeSha256
        || !Array.isArray(evidence.codeRegions) || evidence.codeRegions.length !== pin.nativeCodeRegions
        || !Array.isArray(evidence.instructionFragments) || evidence.instructionFragments.length !== pin.nativeInstructionFragments
        || !Array.isArray(evidence.exactDirectBranches) || evidence.exactDirectBranches.length !== pin.nativeExactDirectBranches
        || !Array.isArray(evidence.exactPltCalls) || evidence.exactPltCalls.length !== pin.nativeExactPltCalls
        || !Array.isArray(evidence.vtables) || evidence.vtables.length !== pin.nativeVtables) {
        throw new Error("K55 native evidence contract changed");
    }
    for (const region of evidence.codeRegions) {
        if (typeof region.role !== "string" || typeof region.symbol !== "string"
            || !Number.isSafeInteger(region.vma) || !Number.isSafeInteger(region.sizeBytes)
            || typeof region.codeSha256 !== "string"
            || hash(inspection.readVirtualBytes(region.vma, region.sizeBytes)) !== region.codeSha256) {
            throw new Error(`K55 native code changed: ${region.role}`);
        }
        const symbols = inspection.symbols.filter(symbol => symbol.name === region.symbol);
        if (symbols.length !== 1 || symbols[0].value !== region.vma || symbols[0].size !== region.sizeBytes) {
            throw new Error(`K55 native symbol changed: ${region.role}`);
        }
    }
    for (const fragment of evidence.instructionFragments) {
        if (typeof fragment.role !== "string" || !Number.isSafeInteger(fragment.vma) || !Number.isSafeInteger(fragment.sizeBytes)
            || typeof fragment.instructionHex !== "string" || fragment.instructionHex.length !== fragment.sizeBytes * 2
            || inspection.readVirtualBytes(fragment.vma, fragment.sizeBytes).toString("hex") !== fragment.instructionHex) {
            throw new Error(`K55 native instruction fragment changed: ${fragment.role}`);
        }
    }
    for (const branch of evidence.exactDirectBranches) {
        const instruction = inspection.readVirtualBytes(branch.callerVma, 4);
        if (typeof branch.role !== "string" || instruction.toString("hex") !== branch.instructionHex
            || branchTarget(branch.callerVma, instruction, false) !== branch.targetVma) {
            throw new Error(`K55 native direct branch changed at ${branch.callerVma}`);
        }
    }
    for (const call of evidence.exactPltCalls) {
        const instruction = inspection.readVirtualBytes(call.callerVma, 4);
        const pltBytes = inspection.readVirtualBytes(call.pltVma, 16);
        if (typeof call.role !== "string" || instruction.toString("hex") !== call.instructionHex
            || branchTarget(call.callerVma, instruction, true) !== call.pltVma || pltBytes.toString("hex") !== call.pltBytesHex
            || pltRelocationOffset(call.pltVma, pltBytes) !== call.relocationOffset) {
            throw new Error(`K55 native PLT call changed at ${call.callerVma}`);
        }
        const relocations = inspection.relocations.filter(relocation => relocation.offset === call.relocationOffset);
        if (relocations.length !== 1 || relocations[0].type !== 1026 || relocations[0].symbolName !== call.symbol
            || relocations[0].symbolValue !== call.symbolValue || relocations[0].addend !== 0) {
            throw new Error(`K55 native PLT binding changed at ${call.callerVma}`);
        }
    }
    let vtableBindingCount = 0;
    for (const vtable of evidence.vtables) {
        const symbols = inspection.symbols.filter(symbol => symbol.name === vtable.symbol);
        if (typeof vtable.role !== "string" || symbols.length !== 1 || symbols[0].value !== vtable.vma
            || symbols[0].size !== vtable.sizeBytes || hash(inspection.readVirtualBytes(vtable.vma, vtable.sizeBytes)) !== vtable.bytesSha256
            || !Number.isSafeInteger(vtable.vptrBiasBytes) || !Array.isArray(vtable.bindings)) {
            throw new Error(`K55 native vtable changed: ${vtable.role}`);
        }
        for (const binding of vtable.bindings) {
            const relocations = inspection.relocations.filter(relocation => relocation.offset === binding.relocationOffset);
            if (!Number.isSafeInteger(binding.objectVirtualSlotOffset) || relocations.length !== 1
                || binding.relocationOffset !== vtable.vma + vtable.vptrBiasBytes + binding.objectVirtualSlotOffset
                || relocations[0].type !== binding.relocationType || relocations[0].symbolName !== binding.symbol
                || relocations[0].symbolValue !== binding.symbolValue || relocations[0].addend !== 0) {
                throw new Error(`K55 native vtable binding changed at ${binding.relocationOffset}`);
            }
            vtableBindingCount++;
        }
    }
    if (vtableBindingCount !== pin.nativeVtableBindings
        || JSON.stringify(evidence.auditedSemantics) !== JSON.stringify(EXPECTED_SEMANTICS)) {
        throw new Error("K55 native lifecycle semantic boundary changed");
    }
    return {
        elfSha256: pin.nativeSha256,
        elfSizeBytes: pin.nativeSizeBytes,
        evidenceSha256: pin.nativeEvidenceSha256,
        evidenceSizeBytes: pin.nativeEvidenceSizeBytes,
        codeRegionCount: evidence.codeRegions.length,
        instructionFragmentCount: evidence.instructionFragments.length,
        exactDirectBranchCount: evidence.exactDirectBranches.length,
        exactPltCallCount: evidence.exactPltCalls.length,
        vtableCount: evidence.vtables.length,
        vtableBindingCount,
        oneStatusPerSourceRowBound: true,
        startTurnSharedExecutionInvocationBound: true,
        type82MatchingRowsAdditiveInCalculatorBound: true,
        calcOption0IntegerConversionAtHandlerBound: true,
        calcOption2DivideBy100FloatAtHandlerBound: true,
        independentOfType35PostConditionBound: true,
        deactivationApisInvoked: true,
        deactivationOutcomeBound: false,
        db37PassiveTurnOrIsOnceLeaderBindingFound: false,
        singleEvaluationOrReevaluationBound: false,
        durationBound: false,
        resetOrRemovalOutcomeBound: false,
        enterExitBound: false,
        leaderFriendCompositionBound: false,
        finalStackingOrCompositionBound: false,
        finalOperationOrderingOutsideHandlerBound: false,
        transformationDeathReviveExchangeStandbyBound: false,
        finalRoundingBound: false,
    };
}
exports.loadCharacterLeaderLifecycleSemanticsNativeProof = loadCharacterLeaderLifecycleSemanticsNativeProof;
function assertLeaderLifecycleSemanticsNativeStable(before, after) {
    if (JSON.stringify(before) !== JSON.stringify(after))
        throw new Error("K55 native lifecycle evidence changed");
}
exports.assertLeaderLifecycleSemanticsNativeStable = assertLeaderLifecycleSemanticsNativeStable;
//# sourceMappingURL=leader-lifecycle-semantics-source.js.map