"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertCharacterLeaderNativeProofStable = exports.loadCharacterLeaderNativeProof = void 0;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const path_1 = require("path");
const native_runtime_elf_adapter_1 = require("../database-experiment/native-runtime-elf-adapter");
const leader_scope_source_1 = require("./leader-scope-source");
const leader_native_semantics_contract_1 = require("./leader-native-semantics-contract");
const hash = (bytes) => (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
const evidencePath = () => {
    const compiledSibling = (0, path_1.resolve)(__dirname, "..", "database-experiment", "native-leader-skill-semantics.json");
    return (0, fs_1.existsSync)(compiledSibling) ? compiledSibling : (0, path_1.resolve)(__dirname, "..", "..", "database-experiment", "native-leader-skill-semantics.json");
};
const expectedDecodedProofs = {
    type82Handler: {
        selector: "efficacy_values[0]_element_or_awakening_bitmask", modifier: "efficacy_values[1]",
        ignoredValue: "efficacy_values[2]", affectedStats: ["hp", "atk", "def"],
        calcOption0: "flat_points", calcOption2: "proportional_percent_divided_by_100",
    },
    teamingPower: { candidateTargetTypes: [2, 12, 13], subTargetSetFiltersCandidates: true, matchingRowsAccumulateAdditively: true },
    battleFactory: { transferredFields: [
            "exec_timing_type", "efficacy_type", "target_type", "calc_option", "causality_conditions",
            "efficacy_values[0]", "efficacy_values[1]", "efficacy_values[2]", "sub_target_type_set_id",
        ] },
};
function exactObject(actual, expected, label) {
    if (JSON.stringify(actual) !== JSON.stringify(expected))
        throw new Error(`K50 ${label} evidence changed`);
}
async function loadCharacterLeaderNativeProof(nativeRuntimePath) {
    if (!nativeRuntimePath)
        throw new Error("K50 requires explicit native runtime path");
    const pin = leader_native_semantics_contract_1.CHARACTER_LEADER_NATIVE_PIN;
    const [nativeBytes, evidenceBytes] = await Promise.all([
        (0, leader_scope_source_1.readPinnedLeaderScopeMember)((0, path_1.resolve)(nativeRuntimePath), { sha256: pin.elfSha256, sizeBytes: pin.elfSizeBytes }, "K50 native runtime"),
        (0, leader_scope_source_1.readPinnedLeaderScopeMember)(evidencePath(), { sha256: pin.evidenceSha256, sizeBytes: pin.evidenceSizeBytes }, "K50 native evidence"),
    ]);
    const evidence = JSON.parse(evidenceBytes.toString("utf8"));
    if (evidence.schemaVersion !== 1 || evidence.contract !== "dokkan-native-leader-skill-semantics-evidence"
        || evidence.contractVersion !== "1.0.0")
        throw new Error("K50 native evidence contract changed");
    exactObject(evidence.nativeRuntime, { fileName: "libcocos2dcpp.so", sha256: pin.elfSha256, sizeBytes: pin.elfSizeBytes, machine: 183 }, "runtime identity");
    exactObject(evidence.decodedProofs, expectedDecodedProofs, "decoded proofs");
    exactObject(evidence.unresolved, ["target_type_names", "sub_target_domain_meanings", "causality_behavior", "battle_lifecycle", "battle_stacking_and_composition", "product_authority"], "unresolved boundary");
    const inspection = (0, native_runtime_elf_adapter_1.parseNativeRuntimeElf)(nativeBytes);
    if (inspection.machine !== 183)
        throw new Error("K50 native machine changed");
    if (!Array.isArray(evidence.codeRegions) || evidence.codeRegions.length !== 8)
        throw new Error("K50 code-region evidence changed");
    for (const region of evidence.codeRegions) {
        if (!Number.isSafeInteger(region.vma) || !Number.isSafeInteger(region.sizeBytes) || region.sizeBytes <= 0 || typeof region.codeSha256 !== "string") {
            throw new Error("K50 malformed code-region evidence");
        }
        if (region.symbol !== null) {
            const matches = inspection.symbols.filter(symbol => symbol.name === region.symbol);
            if (matches.length !== 1 || matches[0].value !== region.vma || matches[0].size !== region.sizeBytes)
                throw new Error(`K50 symbol changed for ${region.role}`);
        }
        if (hash(inspection.readVirtualBytes(region.vma, region.sizeBytes)) !== region.codeSha256)
            throw new Error(`K50 code changed for ${region.role}`);
    }
    const expectedRoles = ["leader_skill_sqlite_constructor", "leader_skill_effect_value_accessor", "leader_skill_sub_target_accessor", "teaming_power_type82_handler", "teaming_power_calculator", "teaming_power_increase_value", "teaming_power_dispatch_initializer", "battle_ability_leader_skill_factory"];
    exactObject(evidence.codeRegions.map((region) => region.role), expectedRoles, "code roles");
    const expectedColumns = [
        ["exec_timing_type", 32456068, 56], ["efficacy_type", 32246168, 60], ["target_type", 32873222, 64],
        ["calc_option", 33024419, 68], ["causality_conditions", 32873234, 72], ["efficacy_values", 31978297, 112],
        ["sub_target_type_set_id", 32490856, 136],
    ];
    if (!Array.isArray(evidence.constructorColumns) || evidence.constructorColumns.length !== expectedColumns.length)
        throw new Error("K50 constructor column evidence changed");
    for (let index = 0; index < expectedColumns.length; index++) {
        const [name, literalVma, objectOffset] = expectedColumns[index];
        exactObject(evidence.constructorColumns[index], { name, literalVma, objectOffset }, `constructor column ${name}`);
        const literal = inspection.readVirtualBytes(literalVma, Buffer.byteLength(name) + 1);
        if (literal.toString("utf8") !== `${name}\0`)
            throw new Error(`K50 constructor literal changed for ${name}`);
    }
    const mapSymbols = inspection.symbols.filter(symbol => symbol.name === evidence.dispatch.mapSymbol);
    if (mapSymbols.length !== 1 || mapSymbols[0].value !== evidence.dispatch.mapVma || mapSymbols[0].size !== evidence.dispatch.mapSizeBytes)
        throw new Error("K50 dispatch map symbol changed");
    const initializer = evidence.dispatch.initializerRelocation;
    const initRelocations = inspection.relocations.filter(value => value.offset === initializer.offset);
    if (initRelocations.length !== 1 || initRelocations[0].type !== initializer.type || initRelocations[0].addend !== initializer.addend)
        throw new Error("K50 dispatch initializer relocation changed");
    if (!Array.isArray(evidence.dispatch.entries) || evidence.dispatch.entries.length !== pin.dispatchEntries)
        throw new Error("K50 dispatch entry evidence changed");
    const efficacyDomain = evidence.dispatch.entries.map((entry) => entry.efficacyType);
    exactObject(efficacyDomain, [1, 2, 3, 5, 16, 17, 18, 19, 20, 43, 44, 82, 83, 93, 104], "dispatch efficacy domain");
    for (const entry of evidence.dispatch.entries) {
        const relocations = inspection.relocations.filter(value => value.offset === entry.gotVma);
        if (relocations.length !== 1 || relocations[0].type !== 1025 || relocations[0].symbolName !== entry.symbol
            || relocations[0].symbolValue !== entry.symbolVma || relocations[0].addend !== 0)
            throw new Error(`K50 dispatch binding changed for ${entry.efficacyType}`);
    }
    const type82 = evidence.dispatch.entries.find((entry) => entry.efficacyType === 82);
    const type82Region = evidence.codeRegions.find((region) => region.role === "teaming_power_type82_handler");
    return {
        nativeSha256: pin.elfSha256, nativeSizeBytes: pin.elfSizeBytes, evidenceSha256: hash(evidenceBytes),
        codeRegionCount: evidence.codeRegions.length, dispatchEntryCount: evidence.dispatch.entries.length,
        constructorColumnCount: evidence.constructorColumns.length,
        type82DispatchBound: !!type82 && !!type82Region && type82.symbol === type82Region.symbol && type82.symbolVma === type82Region.vma,
        battleFactoryFieldTransferBound: true,
    };
}
exports.loadCharacterLeaderNativeProof = loadCharacterLeaderNativeProof;
function assertCharacterLeaderNativeProofStable(before, after) {
    if (JSON.stringify(before) !== JSON.stringify(after))
        throw new Error("K50 native proof changed during audit");
}
exports.assertCharacterLeaderNativeProofStable = assertCharacterLeaderNativeProofStable;
//# sourceMappingURL=leader-native-semantics-source.js.map