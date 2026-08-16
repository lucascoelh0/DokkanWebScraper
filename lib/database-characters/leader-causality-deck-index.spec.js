"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const leader_causality_deck_index_contract_1 = require("./leader-causality-deck-index-contract");
const leader_causality_deck_index_run_1 = require("./leader-causality-deck-index-run");
const leader_causality_deck_index_source_1 = require("./leader-causality-deck-index-source");
const leader_causality_deck_index_1 = require("./leader-causality-deck-index");
const args = [
    "--opt-in-k54", "--sidecar-root", "s", "--production-root", "p", "--fyi-root", "f", "--k43-root", "43",
    "--k46-root", "46", "--k48-root", "48", "--native-runtime", "elf", "--database", "db",
];
function upstreamK53() {
    return {
        schemaVersion: 1,
        contract: "dokkan-database-character-leader-causality-collection-audit",
        contractVersion: "1.0.0",
        mode: "offline_local_explicit_opt_in_stdout_only",
        upstreamK52: { scope: { type82NonNullRows: 17 } },
        sources: {}, semantics: {}, offsets: {},
        policy: {
            nativeStructuralEvidenceOnly: true, effectiveLeaderBranchSelected: false, humanElementNamesDerived: false,
            lifecycleDerived: false, deathOrRemovalDerived: false, stackingDerived: false, sourceTextIncluded: false,
            payloadWritten: false, authoritySelected: false, productionModified: false, networkEnabled: false,
            r2Enabled: false, androidImplemented: false,
        },
        inputIntegrity: {
            k52RealAudit: "GO", k52ConservativeNoGosPreserved: true, nativeProofBefore: "GO", nativeProofAfter: "GO",
            nativeProofStableAcrossK52: true, rssStayedBelowExclusiveLimit: true,
        },
        readiness: {
            leaderCausalityCandidateCollection: "GO", deckIndex0And1StructuralCollection: "GO",
            effectiveLeaderRuntimeBranch: "NO-GO", humanElementNames: "NO-GO", lifecycle: "NO-GO",
            deathOrRemoval: "NO-GO", stacking: "NO-GO", productProjection: "NO-GO", authority: "NO-GO",
            production: "NO-GO", writer: "NO-GO", publisher: "NO-GO", network: "NO-GO", r2: "NO-GO", android: "NO-GO",
        },
    };
}
function nativeProof() {
    const pin = leader_causality_deck_index_contract_1.CHARACTER_LEADER_CAUSALITY_DECK_INDEX_PIN;
    return {
        elfSha256: pin.nativeSha256,
        elfSizeBytes: pin.nativeSizeBytes,
        evidenceSha256: pin.nativeEvidenceSha256,
        evidenceSizeBytes: pin.nativeEvidenceSizeBytes,
        codeRegionCount: pin.nativeCodeRegions,
        instructionFragmentCount: pin.nativeInstructionFragments,
        exactDirectCallCount: pin.nativeExactDirectCalls,
        exactPltCallCount: pin.nativeExactPltCalls,
        vtableCount: pin.nativeVtables,
        vtableBindingCount: pin.nativeVtableBindings,
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
describe("K54 leader causality deck-index provenance", () => {
    it("parses exactly one opt-in, every explicit path and no loose or duplicate arguments", () => {
        const parsed = (0, leader_causality_deck_index_run_1.parseCharacterLeaderCausalityDeckIndexCli)(args);
        (0, assert_1.equal)(parsed.database, "db");
        (0, assert_1.equal)(parsed.nativeRuntime, "elf");
        (0, assert_1.throws)(() => (0, leader_causality_deck_index_run_1.parseCharacterLeaderCausalityDeckIndexCli)(args.slice(1)), /exactly one/);
        (0, assert_1.throws)(() => (0, leader_causality_deck_index_run_1.parseCharacterLeaderCausalityDeckIndexCli)([...args, "loose"]), /unsupported argument/);
        (0, assert_1.throws)(() => (0, leader_causality_deck_index_run_1.parseCharacterLeaderCausalityDeckIndexCli)([...args, "--database", "again"]), /duplicate --database/);
        (0, assert_1.throws)(() => (0, leader_causality_deck_index_run_1.parseCharacterLeaderCausalityDeckIndexCli)(args.slice(0, -1)), /missing value/);
        (0, assert_1.throws)(() => (0, leader_causality_deck_index_run_1.parseCharacterLeaderCausalityDeckIndexCli)([...args, "--opt-in-k54"]), /exactly one/);
    });
    it("requires both K53 structural GOs, all K53 NO-GOs and the exact 17-row boundary", () => {
        const upstream = upstreamK53();
        (0, leader_causality_deck_index_1.assertConservativeK53ForDeckIndex)(upstream);
        const promoted = JSON.parse(JSON.stringify(upstream));
        promoted.readiness.effectiveLeaderRuntimeBranch = "GO";
        (0, assert_1.throws)(() => (0, leader_causality_deck_index_1.assertConservativeK53ForDeckIndex)(promoted), /conservative K53 effectiveLeaderRuntimeBranch NO-GO/);
        const drifted = JSON.parse(JSON.stringify(upstream));
        drifted.upstreamK52.scope.type82NonNullRows = 16;
        (0, assert_1.throws)(() => (0, leader_causality_deck_index_1.assertConservativeK53ForDeckIndex)(drifted), /integrity or conservative policy changed/);
    });
    it("accepts only the exact pinned native proof and detects proof drift", () => {
        const upstream = upstreamK53(), native = nativeProof();
        (0, leader_causality_deck_index_1.assertPinnedCharacterLeaderCausalityDeckIndex)(upstream, native);
        (0, leader_causality_deck_index_source_1.assertLeaderCausalityDeckIndexNativeStable)(native, { ...native });
        (0, assert_1.throws)(() => (0, leader_causality_deck_index_1.assertPinnedCharacterLeaderCausalityDeckIndex)(upstream, { ...native, exactPltCallCount: 5 }), /does not match pin/);
        (0, assert_1.throws)(() => (0, leader_causality_deck_index_source_1.assertLeaderCausalityDeckIndexNativeStable)(native, { ...native, evidenceSha256: "drift" }), /evidence changed/);
    });
    it("keeps the public factory NOT_EXECUTED and every branch/product boundary NO-GO", () => {
        const report = (0, leader_causality_deck_index_1.buildCharacterLeaderCausalityDeckIndexReport)(upstreamK53(), nativeProof());
        (0, assert_1.equal)(report.readiness.deckIndexRuntimeArgumentProvenance, "NOT_EXECUTED");
        (0, assert_1.equal)(report.readiness.deckIndexIndependentFromTargetType, "NOT_EXECUTED");
        (0, assert_1.equal)(report.readiness.effectiveLeaderRuntimeBranch, "NO-GO");
        (0, assert_1.equal)(report.readiness.dataLevelBranchSelection, "NO-GO");
        (0, assert_1.equal)(report.readiness.lifecycle, "NO-GO");
        (0, assert_1.equal)(report.readiness.stacking, "NO-GO");
        (0, assert_1.equal)(report.readiness.productProjection, "NO-GO");
        (0, assert_1.equal)(report.readiness.authority, "NO-GO");
        (0, assert_1.equal)(report.inputIntegrity.k53RealAudit, "NOT_EXECUTED");
        (0, assert_1.equal)(report.policy.effectiveLeaderRuntimeBranchSelected, false);
        (0, assert_1.equal)(report.policy.dataLevelBranchSelectionDerived, false);
        (0, assert_1.equal)(report.policy.sourceTextIncluded, false);
        (0, assert_1.equal)(Buffer.byteLength(`${JSON.stringify(report)}\n`) < 64 * 1024, true);
    });
    it("keeps deck index independent from target_type and binds only distinct runtime fields", () => {
        const report = (0, leader_causality_deck_index_1.buildCharacterLeaderCausalityDeckIndexReport)(upstreamK53(), nativeProof());
        (0, assert_1.deepStrictEqual)(report.offsets, {
            factoryCurrentCharacterVtableSlotBytes: 0x20,
            createAbilityStatusDeckIndexOffsetBytes: 0x0c,
            abilityStatusDeckIndexOffsetBytes: 0x10,
            leaderSkillTargetTypeOffsetBytes: 0x40,
            createAbilityStatusTargetTypeOffsetBytes: 0x2c,
            abilityStatusTargetTypeOffsetBytes: 0xe0,
        });
        (0, assert_1.equal)(report.scope.observedType82CausalityRows, 17);
        (0, assert_1.equal)(report.scope.staticallyBoundRuntimeDeckIndexRows, 0);
        (0, assert_1.equal)(report.semantics.observedRowBranch, "not_statically_bound");
        (0, assert_1.equal)(report.policy.targetTypeDoesNotSelectDeckIndexInAuditedCreationChain, true);
        (0, assert_1.equal)(report.sources.native.staticCallerOrSourceRowBindingFound, false);
    });
});
//# sourceMappingURL=leader-causality-deck-index.spec.js.map