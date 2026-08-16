"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCharacterLeaderCausalityCollectionReport = exports.assertPinnedCharacterLeaderCausalityCollection = exports.assertConservativeK52ForCollection = void 0;
const leader_causality_collection_contract_1 = require("./leader-causality-collection-contract");
const K52_GO = ["leaderCausalityStructuralSemantics", "type35StructuralCondition"];
const K52_NO_GO = [
    "humanBitNames", "partySelectionContext", "lifecycle", "stacking", "productProjection", "authority",
    "production", "writer", "publisher", "network", "r2", "android",
];
function assertConservativeK52ForCollection(report) {
    if (report.schemaVersion !== 1 || report.contract !== "dokkan-database-character-leader-causality-semantics-audit"
        || report.contractVersion !== "1.0.0" || report.mode !== "offline_local_explicit_opt_in_stdout_only") {
        throw new Error("K53 upstream K52 contract changed");
    }
    for (const key of K52_GO)
        if (report.readiness[key] !== "GO")
            throw new Error(`K53 requires K52 ${key} GO`);
    for (const key of K52_NO_GO)
        if (report.readiness[key] !== "NO-GO")
            throw new Error(`K53 requires conservative K52 ${key} NO-GO`);
    if (report.inputIntegrity.k48SourceBoundBefore !== "GO" || report.inputIntegrity.k48SourceBoundAfter !== "GO"
        || report.inputIntegrity.k48K3DatabaseAndNativeStable !== true || report.inputIntegrity.databaseDescriptorBoundReadOnly !== true
        || report.inputIntegrity.rssStayedBelowExclusiveLimit !== true || report.policy.structuralConditionEvidenceOnly !== true
        || report.policy.k3OmissionDisclosed !== true || report.policy.sqliteSeparatelyBoundToExactFirstPartySnapshot !== true
        || report.policy.sourceTextReadForIdentityOrJoin !== false || report.policy.sourceTextIncluded !== false
        || report.policy.humanBitNamesDerived !== false || report.policy.partySelectionContextDerived !== false
        || report.policy.lifecycleDerived !== false || report.policy.stackingDerived !== false || report.policy.payloadWritten !== false
        || report.policy.authoritySelected !== false
        || report.policy.productionModified !== false || report.policy.networkEnabled !== false
        || report.policy.r2Enabled !== false || report.policy.androidImplemented !== false) {
        throw new Error("K53 upstream K52 integrity or conservative policy changed");
    }
}
exports.assertConservativeK52ForCollection = assertConservativeK52ForCollection;
function assertPinnedCharacterLeaderCausalityCollection(upstreamK52, native) {
    assertConservativeK52ForCollection(upstreamK52);
    const pin = leader_causality_collection_contract_1.CHARACTER_LEADER_CAUSALITY_COLLECTION_PIN;
    if (native.elfSha256 !== pin.nativeSha256 || native.elfSizeBytes !== pin.nativeSizeBytes
        || native.evidenceSha256 !== pin.nativeEvidenceSha256 || native.evidenceSizeBytes !== pin.nativeEvidenceSizeBytes
        || native.codeRegionCount !== pin.nativeCodeRegions || native.instructionFragmentCount !== pin.nativeInstructionFragments
        || native.exactCallCount !== pin.nativeExactCalls || native.vtableCount !== pin.nativeVtables
        || native.vtableBindingCount !== pin.nativeVtableBindings || native.deckIndexVirtualDispatchBound !== true
        || native.deckIndex0SevenPlayerRecordsBound !== true || native.deckIndex1PuzzleEnemyVectorBound !== true
        || native.deckIndex1EmptyFailsBound !== true || native.otherDeckIndicesSupported !== false
        || native.playerRuntimeUserCardOffsetBound !== true || native.masterCardResolutionBound !== true
        || native.cardElementGettersBound !== true || native.elementBitPatternCallBound !== true
        || native.onlyCauVal1Read !== true || native.explicitAliveActiveCategoryOrTargetFilterFound !== false
        || native.effectiveLeaderBranchBound !== false || native.humanElementNamesBound !== false
        || native.lifecycleBound !== false || native.deathOrRemovalBound !== false || native.stackingBound !== false
        || native.productAuthorityBound !== false)
        throw new Error("K53 native collection proof does not match pin");
}
exports.assertPinnedCharacterLeaderCausalityCollection = assertPinnedCharacterLeaderCausalityCollection;
function buildCharacterLeaderCausalityCollectionReport(upstreamK52, native) {
    const pin = leader_causality_collection_contract_1.CHARACTER_LEADER_CAUSALITY_COLLECTION_PIN;
    const report = {
        schemaVersion: 1,
        contract: "dokkan-database-character-leader-causality-collection-audit",
        contractVersion: leader_causality_collection_contract_1.CHARACTER_LEADER_CAUSALITY_COLLECTION_CONTRACT_VERSION,
        mode: "offline_local_explicit_opt_in_stdout_only",
        upstreamK52,
        sources: { native },
        semantics: {
            deckIndex0Collection: "exactly_seven_ingame_data_indexed_character_records",
            deckIndex1Collection: "puzzle_enemy_runtime_vector_at_ingame_data_0x100_0x108",
            deckIndex1Empty: "condition_false",
            otherDeckIndices: "unsupported",
            playerCandidateSource: "runtime_user_card_reference_at_candidate_index_times_0x590_plus_0xa0",
            candidatePredicate: "master_card_element_and_awakening_element_type_against_selected_bit",
        },
        offsets: {
            playerCandidateStrideBytes: pin.playerCandidateStrideBytes,
            playerUserCardReferenceOffsetBytes: pin.playerUserCardReferenceOffsetBytes,
            puzzleEnemyVectorBeginOffsetBytes: pin.puzzleEnemyVectorBeginOffsetBytes,
            puzzleEnemyVectorEndOffsetBytes: pin.puzzleEnemyVectorEndOffsetBytes,
            puzzleEnemyVectorElementSizeBytes: pin.puzzleEnemyVectorElementSizeBytes,
        },
        policy: {
            nativeStructuralEvidenceOnly: true,
            effectiveLeaderBranchSelected: false,
            humanElementNamesDerived: false,
            lifecycleDerived: false,
            deathOrRemovalDerived: false,
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
            k52RealAudit: "NOT_EXECUTED",
            k52ConservativeNoGosPreserved: false,
            nativeProofBefore: "NOT_EXECUTED",
            nativeProofAfter: "NOT_EXECUTED",
            nativeProofStableAcrossK52: false,
            reportTimestampIncluded: false,
            reportMaximumBytesExclusive: leader_causality_collection_contract_1.CHARACTER_LEADER_CAUSALITY_COLLECTION_REPORT_LIMIT_BYTES,
            rssMaximumBytesExclusive: leader_causality_collection_contract_1.CHARACTER_LEADER_CAUSALITY_COLLECTION_RSS_LIMIT_BYTES,
            rssStayedBelowExclusiveLimit: false,
        },
        readiness: {
            leaderCausalityCandidateCollection: "NOT_EXECUTED",
            deckIndex0And1StructuralCollection: "NOT_EXECUTED",
            effectiveLeaderRuntimeBranch: "NO-GO",
            humanElementNames: "NO-GO",
            lifecycle: "NO-GO",
            deathOrRemoval: "NO-GO",
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
    if (Buffer.byteLength(`${JSON.stringify(report)}\n`) >= leader_causality_collection_contract_1.CHARACTER_LEADER_CAUSALITY_COLLECTION_REPORT_LIMIT_BYTES) {
        throw new Error("K53 report byte limit reached");
    }
    return report;
}
exports.buildCharacterLeaderCausalityCollectionReport = buildCharacterLeaderCausalityCollectionReport;
//# sourceMappingURL=leader-causality-collection.js.map