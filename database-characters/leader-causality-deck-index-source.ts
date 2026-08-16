import { createHash } from "crypto";
import { existsSync } from "fs";
import { resolve } from "path";
import { parseNativeRuntimeElf } from "../database-experiment/native-runtime-elf-adapter";
import {
    CHARACTER_LEADER_CAUSALITY_DECK_INDEX_PIN,
    CharacterLeaderCausalityDeckIndexNativeProof,
} from "./leader-causality-deck-index-contract";
import { readPinnedLeaderScopeMember } from "./leader-scope-source";

const hash = (value: Buffer): string => createHash("sha256").update(value).digest("hex");

function evidencePath(): string {
    const compiled = resolve(__dirname, "..", "database-experiment", "native-leader-causality-deck-index.json");
    return existsSync(compiled) ? compiled : resolve(__dirname, "..", "..", "database-experiment", "native-leader-causality-deck-index.json");
}

function branchTarget(callerVma: number, instruction: Buffer): number {
    if (instruction.length !== 4) throw new Error(`K54 malformed call instruction at ${callerVma}`);
    const word = instruction.readUInt32LE();
    if (((word & 0xfc000000) >>> 0) !== 0x94000000) throw new Error(`K54 native call opcode changed at ${callerVma}`);
    let immediate = word & 0x03ffffff;
    if (immediate & 0x02000000) immediate -= 0x04000000;
    return callerVma + immediate * 4;
}

function pltRelocationOffset(pltVma: number, bytes: Buffer): number {
    if (bytes.length !== 16) throw new Error(`K54 malformed PLT size at ${pltVma}`);
    const adrp = bytes.readUInt32LE(0), ldr = bytes.readUInt32LE(4);
    if (((adrp & 0x9f00001f) >>> 0) !== 0x90000010 || ((ldr & 0xffc003ff) >>> 0) !== 0xf9400211
        || bytes.subarray(12, 16).toString("hex") !== "20021fd6") throw new Error(`K54 malformed PLT at ${pltVma}`);
    let pages = (((adrp >>> 5) & 0x7ffff) << 2) | ((adrp >>> 29) & 3);
    if (pages & 0x100000) pages -= 0x200000;
    return (pltVma & ~0xfff) + pages * 4096 + ((ldr >>> 10) & 0xfff) * 8;
}

const EXPECTED_OFFSETS = {
    factoryCurrentCharacterVtableSlotBytes: 0x20,
    createAbilityStatusDeckIndexOffsetBytes: 0x0c,
    abilityStatusDeckIndexOffsetBytes: 0x10,
    leaderSkillTargetTypeOffsetBytes: 0x40,
    createAbilityStatusTargetTypeOffsetBytes: 0x2c,
    abilityStatusTargetTypeOffsetBytes: 0xe0,
};

const EXPECTED_SEMANTICS = {
    factoryFirstRuntimeArgument: "w1_captured_as_w22",
    sameArgumentSelectsCurrentCharacter: true,
    currentCharacterCreationGuardRequiredWhenPresent: true,
    deckIndexPropagation: "factory_w1_to_create_plus_0x0c_to_status_plus_0x10",
    targetTypePropagation: "leader_skill_plus_0x40_to_create_plus_0x2c_to_status_plus_0xe0",
    deckIndexAndTargetTypeIndependentFields: true,
    staticCallerOrSourceRowBindingFound: false,
    effectiveLeaderRuntimeBranchBound: false,
    dataLevelBranchSelectionBound: false,
    lifecycleBound: false,
    stackingBound: false,
    productAuthorityBound: false,
};

export async function loadCharacterLeaderCausalityDeckIndexNativeProof(
    nativeRuntimePath: string,
): Promise<CharacterLeaderCausalityDeckIndexNativeProof> {
    if (!nativeRuntimePath) throw new Error("K54 requires explicit native runtime path");
    const pin = CHARACTER_LEADER_CAUSALITY_DECK_INDEX_PIN;
    const [native, evidenceBytes] = await Promise.all([
        readPinnedLeaderScopeMember(resolve(nativeRuntimePath), { sha256: pin.nativeSha256, sizeBytes: pin.nativeSizeBytes }, "K54 native runtime"),
        readPinnedLeaderScopeMember(evidencePath(), { sha256: pin.nativeEvidenceSha256, sizeBytes: pin.nativeEvidenceSizeBytes }, "K54 native evidence"),
    ]);
    const evidence = JSON.parse(evidenceBytes.toString("utf8"));
    const inspection = parseNativeRuntimeElf(native);
    if (inspection.elfClass !== 64 || inspection.endian !== "little" || inspection.machine !== 183
        || evidence.schemaVersion !== 1 || evidence.contract !== "dokkan-database-native-leader-causality-deck-index"
        || evidence.sourceSha256 !== pin.nativeSha256
        || !Array.isArray(evidence.codeRegions) || evidence.codeRegions.length !== pin.nativeCodeRegions
        || !Array.isArray(evidence.instructionFragments) || evidence.instructionFragments.length !== pin.nativeInstructionFragments
        || !Array.isArray(evidence.exactDirectCalls) || evidence.exactDirectCalls.length !== pin.nativeExactDirectCalls
        || !Array.isArray(evidence.exactPltCalls) || evidence.exactPltCalls.length !== pin.nativeExactPltCalls
        || !Array.isArray(evidence.vtables) || evidence.vtables.length !== pin.nativeVtables) {
        throw new Error("K54 native evidence contract changed");
    }

    for (const region of evidence.codeRegions) {
        if (typeof region.role !== "string" || (region.symbol !== null && typeof region.symbol !== "string")
            || !Number.isSafeInteger(region.vma) || !Number.isSafeInteger(region.sizeBytes)
            || typeof region.codeSha256 !== "string"
            || hash(inspection.readVirtualBytes(region.vma, region.sizeBytes)) !== region.codeSha256) {
            throw new Error(`K54 native code changed: ${region.role}`);
        }
        if (region.symbol !== null) {
            const symbols = inspection.symbols.filter(symbol => symbol.name === region.symbol);
            if (symbols.length !== 1 || symbols[0].value !== region.vma || symbols[0].size !== region.sizeBytes) {
                throw new Error(`K54 native symbol changed: ${region.role}`);
            }
        }
    }

    for (const fragment of evidence.instructionFragments) {
        if (typeof fragment.role !== "string" || !Number.isSafeInteger(fragment.vma) || !Number.isSafeInteger(fragment.sizeBytes)
            || typeof fragment.instructionHex !== "string" || fragment.instructionHex.length !== fragment.sizeBytes * 2
            || inspection.readVirtualBytes(fragment.vma, fragment.sizeBytes).toString("hex") !== fragment.instructionHex) {
            throw new Error(`K54 native instruction fragment changed: ${fragment.role}`);
        }
    }

    for (const call of evidence.exactDirectCalls) {
        const instruction = inspection.readVirtualBytes(call.callerVma, 4);
        if (typeof call.role !== "string" || instruction.toString("hex") !== call.instructionHex
            || branchTarget(call.callerVma, instruction) !== call.targetVma) {
            throw new Error(`K54 native direct call changed at ${call.callerVma}`);
        }
    }

    for (const call of evidence.exactPltCalls) {
        const instruction = inspection.readVirtualBytes(call.callerVma, 4);
        const pltBytes = inspection.readVirtualBytes(call.pltVma, 16);
        if (typeof call.role !== "string" || instruction.toString("hex") !== call.instructionHex
            || branchTarget(call.callerVma, instruction) !== call.pltVma || pltBytes.toString("hex") !== call.pltBytesHex
            || pltRelocationOffset(call.pltVma, pltBytes) !== call.relocationOffset) {
            throw new Error(`K54 native PLT call changed at ${call.callerVma}`);
        }
        const relocations = inspection.relocations.filter(relocation => relocation.offset === call.relocationOffset);
        if (relocations.length !== 1 || relocations[0].type !== 1026 || relocations[0].symbolName !== call.symbol
            || relocations[0].symbolValue !== call.symbolValue || relocations[0].addend !== 0) {
            throw new Error(`K54 native PLT binding changed at ${call.callerVma}`);
        }
    }

    let vtableBindingCount = 0;
    for (const vtable of evidence.vtables) {
        const symbols = inspection.symbols.filter(symbol => symbol.name === vtable.symbol);
        if (typeof vtable.role !== "string" || symbols.length !== 1 || symbols[0].value !== vtable.vma
            || symbols[0].size !== vtable.sizeBytes || hash(inspection.readVirtualBytes(vtable.vma, vtable.sizeBytes)) !== vtable.bytesSha256
            || !Number.isSafeInteger(vtable.vptrBiasBytes) || vtable.vptrBiasBytes < 0
            || !Array.isArray(vtable.bindings)) throw new Error(`K54 native vtable changed: ${vtable.role}`);
        for (const binding of vtable.bindings) {
            const relocations = inspection.relocations.filter(relocation => relocation.offset === binding.relocationOffset);
            if (!Number.isSafeInteger(binding.objectVirtualSlotOffset) || relocations.length !== 1
                || binding.relocationOffset !== vtable.vma + vtable.vptrBiasBytes + binding.objectVirtualSlotOffset
                || relocations[0].type !== binding.relocationType || relocations[0].symbolName !== binding.symbol
                || relocations[0].symbolValue !== binding.symbolValue || relocations[0].addend !== 0) {
                throw new Error(`K54 native vtable binding changed at ${binding.relocationOffset}`);
            }
            vtableBindingCount++;
        }
    }
    if (vtableBindingCount !== pin.nativeVtableBindings
        || JSON.stringify(evidence.runtimeOffsets) !== JSON.stringify(EXPECTED_OFFSETS)
        || JSON.stringify(evidence.auditedSemantics) !== JSON.stringify(EXPECTED_SEMANTICS)) {
        throw new Error("K54 native deck-index semantic boundary changed");
    }

    return {
        elfSha256: pin.nativeSha256,
        elfSizeBytes: pin.nativeSizeBytes,
        evidenceSha256: pin.nativeEvidenceSha256,
        evidenceSizeBytes: pin.nativeEvidenceSizeBytes,
        codeRegionCount: evidence.codeRegions.length,
        instructionFragmentCount: evidence.instructionFragments.length,
        exactDirectCallCount: evidence.exactDirectCalls.length,
        exactPltCallCount: evidence.exactPltCalls.length,
        vtableCount: evidence.vtables.length,
        vtableBindingCount,
        factoryVtableSlotBound: true,
        firstRuntimeArgumentCapturedAsW22: true,
        sameArgumentSelectsCurrentCharacter: true,
        currentCharacterVtableSlotBound: true,
        currentCharacterCreationGuardBound: true,
        passiveConstructorChainBound: true,
        deckIndexCreateToStatusCopyBound: true,
        deckIndexGetterReadsStatusOffset0x10: true,
        targetTypeLeaderToCreateCopyBound: true,
        targetTypeGetterReadsStatusOffset0xe0: true,
        deckIndexAndTargetTypeIndependentFields: true,
        staticCallerOrSourceRowBindingFound: false,
        effectiveLeaderRuntimeBranchBound: false,
        dataLevelBranchSelectionBound: false,
        lifecycleBound: false,
        stackingBound: false,
        productAuthorityBound: false,
    };
}

export function assertLeaderCausalityDeckIndexNativeStable(
    before: CharacterLeaderCausalityDeckIndexNativeProof,
    after: CharacterLeaderCausalityDeckIndexNativeProof,
): void {
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error("K54 native deck-index evidence changed");
}
