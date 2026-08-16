"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCharacterLeaderCausalityDeckIndexReport = exports.assertPinnedCharacterLeaderCausalityDeckIndex = exports.assertConservativeK53ForDeckIndex = void 0;
const leader_causality_deck_index_contract_1 = require("./leader-causality-deck-index-contract");
const K53_GO = ["leaderCausalityCandidateCollection", "deckIndex0And1StructuralCollection"];
const K53_NO_GO = [
    "effectiveLeaderRuntimeBranch", "humanElementNames", "lifecycle", "deathOrRemoval", "stacking",
    "productProjection", "authority", "production", "writer", "publisher", "network", "r2", "android",
];
function assertConservativeK53ForDeckIndex(report) {
    if (report.schemaVersion !== 1 || report.contract !== "dokkan-database-character-leader-causality-collection-audit"
        || report.contractVersion !== "1.0.0" || report.mode !== "offline_local_explicit_opt_in_stdout_only") {
        throw new Error("K54 upstream K53 contract changed");
    }
    for (const key of K53_GO)
        if (report.readiness[key] !== "GO")
            throw new Error(`K54 requires K53 ${key} GO`);
    for (const key of K53_NO_GO)
        if (report.readiness[key] !== "NO-GO")
            throw new Error(`K54 requires conservative K53 ${key} NO-GO`);
    if (report.upstreamK52.scope.type82NonNullRows !== leader_causality_deck_index_contract_1.CHARACTER_LEADER_CAUSALITY_DECK_INDEX_PIN.observedCausalityRows
        || report.inputIntegrity.k52RealAudit !== "GO" || report.inputIntegrity.k52ConservativeNoGosPreserved !== true
        || report.inputIntegrity.nativeProofBefore !== "GO" || report.inputIntegrity.nativeProofAfter !== "GO"
        || report.inputIntegrity.nativeProofStableAcrossK52 !== true || report.inputIntegrity.rssStayedBelowExclusiveLimit !== true
        || report.policy.nativeStructuralEvidenceOnly !== true || report.policy.effectiveLeaderBranchSelected !== false
        || report.policy.humanElementNamesDerived !== false || report.policy.lifecycleDerived !== false
        || report.policy.deathOrRemovalDerived !== false || report.policy.stackingDerived !== false
        || report.policy.sourceTextIncluded !== false || report.policy.payloadWritten !== false
        || report.policy.authoritySelected !== false || report.policy.productionModified !== false
        || report.policy.networkEnabled !== false || report.policy.r2Enabled !== false
        || report.policy.androidImplemented !== false) {
        throw new Error("K54 upstream K53 integrity or conservative policy changed");
    }
}
exports.assertConservativeK53ForDeckIndex = assertConservativeK53ForDeckIndex;
function assertPinnedCharacterLeaderCausalityDeckIndex(upstreamK53, native) {
    assertConservativeK53ForDeckIndex(upstreamK53);
    const pin = leader_causality_deck_index_contract_1.CHARACTER_LEADER_CAUSALITY_DECK_INDEX_PIN;
    if (native.elfSha256 !== pin.nativeSha256 || native.elfSizeBytes !== pin.nativeSizeBytes
        || native.evidenceSha256 !== pin.nativeEvidenceSha256 || native.evidenceSizeBytes !== pin.nativeEvidenceSizeBytes
        || native.codeRegionCount !== pin.nativeCodeRegions || native.instructionFragmentCount !== pin.nativeInstructionFragments
        || native.exactDirectCallCount !== pin.nativeExactDirectCalls || native.exactPltCallCount !== pin.nativeExactPltCalls
        || native.vtableCount !== pin.nativeVtables || native.vtableBindingCount !== pin.nativeVtableBindings
        || native.factoryVtableSlotBound !== true || native.firstRuntimeArgumentCapturedAsW22 !== true
        || native.sameArgumentSelectsCurrentCharacter !== true || native.currentCharacterVtableSlotBound !== true
        || native.currentCharacterCreationGuardBound !== true || native.passiveConstructorChainBound !== true
        || native.deckIndexCreateToStatusCopyBound !== true || native.deckIndexGetterReadsStatusOffset0x10 !== true
        || native.targetTypeLeaderToCreateCopyBound !== true || native.targetTypeGetterReadsStatusOffset0xe0 !== true
        || native.deckIndexAndTargetTypeIndependentFields !== true || native.staticCallerOrSourceRowBindingFound !== false
        || native.effectiveLeaderRuntimeBranchBound !== false || native.dataLevelBranchSelectionBound !== false
        || native.lifecycleBound !== false || native.stackingBound !== false || native.productAuthorityBound !== false) {
        throw new Error("K54 native deck-index proof does not match pin");
    }
}
exports.assertPinnedCharacterLeaderCausalityDeckIndex = assertPinnedCharacterLeaderCausalityDeckIndex;
function buildCharacterLeaderCausalityDeckIndexReport(upstreamK53, native) {
    const pin = leader_causality_deck_index_contract_1.CHARACTER_LEADER_CAUSALITY_DECK_INDEX_PIN;
    const report = {
        schemaVersion: 1,
        contract: "dokkan-database-character-leader-causality-deck-index-audit",
        contractVersion: leader_causality_deck_index_contract_1.CHARACTER_LEADER_CAUSALITY_DECK_INDEX_CONTRACT_VERSION,
        mode: "offline_local_explicit_opt_in_stdout_only",
        upstreamK53,
        sources: { native },
        scope: {
            observedType82CausalityRows: pin.observedCausalityRows,
            staticallyBoundRuntimeDeckIndexRows: 0,
        },
        semantics: {
            deckIndexSource: "first_runtime_argument_to_AbilityManager_createLeaderSkill",
            deckIndexPropagation: "factory_w1_to_create_status_0x0c_to_ability_status_0x10",
            sameArgumentCharacterSelection: "InGameData_getCharaDataCurrent_vtable_slot_0x20_then_canCreateLeaderSkill_guard",
            targetTypePropagation: "leader_skill_0x40_to_create_status_0x2c_to_ability_status_0xe0",
            fieldRelationship: "deck_index_and_target_type_are_independent_runtime_fields",
            observedRowBranch: "not_statically_bound",
        },
        offsets: {
            factoryCurrentCharacterVtableSlotBytes: pin.factoryCurrentCharacterVtableSlotBytes,
            createAbilityStatusDeckIndexOffsetBytes: pin.createAbilityStatusDeckIndexOffsetBytes,
            abilityStatusDeckIndexOffsetBytes: pin.abilityStatusDeckIndexOffsetBytes,
            leaderSkillTargetTypeOffsetBytes: pin.leaderSkillTargetTypeOffsetBytes,
            createAbilityStatusTargetTypeOffsetBytes: pin.createAbilityStatusTargetTypeOffsetBytes,
            abilityStatusTargetTypeOffsetBytes: pin.abilityStatusTargetTypeOffsetBytes,
        },
        policy: {
            nativeStructuralEvidenceOnly: true,
            runtimeArgumentProvenanceOnly: true,
            targetTypeDoesNotSelectDeckIndexInAuditedCreationChain: true,
            staticCallerOrSourceRowBindingDerived: false,
            effectiveLeaderRuntimeBranchSelected: false,
            dataLevelBranchSelectionDerived: false,
            lifecycleDerived: false,
            stackingDerived: false,
            sourceTextIncluded: false,
            payloadWritten: false,
            authoritySelected: false,
            productionModified: false,
            networkEnabled: false,
            r2Enabled: false,
            androidImplemented: false,
        },
        inputIntegrity: {
            k53RealAudit: "NOT_EXECUTED",
            k53StructuralGosAndNoGosPreserved: false,
            nativeProofBefore: "NOT_EXECUTED",
            nativeProofAfter: "NOT_EXECUTED",
            nativeProofStableAcrossK53: false,
            reportTimestampIncluded: false,
            reportMaximumBytesExclusive: leader_causality_deck_index_contract_1.CHARACTER_LEADER_CAUSALITY_DECK_INDEX_REPORT_LIMIT_BYTES,
            rssMaximumBytesExclusive: leader_causality_deck_index_contract_1.CHARACTER_LEADER_CAUSALITY_DECK_INDEX_RSS_LIMIT_BYTES,
            rssStayedBelowExclusiveLimit: false,
        },
        readiness: {
            deckIndexRuntimeArgumentProvenance: "NOT_EXECUTED",
            deckIndexIndependentFromTargetType: "NOT_EXECUTED",
            effectiveLeaderRuntimeBranch: "NO-GO",
            dataLevelBranchSelection: "NO-GO",
            lifecycle: "NO-GO",
            stacking: "NO-GO",
            productProjection: "NO-GO",
            authority: "NO-GO",
            production: "NO-GO",
            writer: "NO-GO",
            publisher: "NO-GO",
            network: "NO-GO",
            r2: "NO-GO",
            android: "NO-GO",
        },
    };
    if (Buffer.byteLength(`${JSON.stringify(report)}\n`) >= leader_causality_deck_index_contract_1.CHARACTER_LEADER_CAUSALITY_DECK_INDEX_REPORT_LIMIT_BYTES) {
        throw new Error("K54 report byte limit reached");
    }
    return report;
}
exports.buildCharacterLeaderCausalityDeckIndexReport = buildCharacterLeaderCausalityDeckIndexReport;
//# sourceMappingURL=leader-causality-deck-index.js.map