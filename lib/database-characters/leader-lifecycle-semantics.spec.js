"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const fs_1 = require("fs");
const path_1 = require("path");
const leader_lifecycle_semantics_contract_1 = require("./leader-lifecycle-semantics-contract");
const leader_lifecycle_semantics_run_1 = require("./leader-lifecycle-semantics-run");
const leader_lifecycle_semantics_source_1 = require("./leader-lifecycle-semantics-source");
const leader_lifecycle_semantics_1 = require("./leader-lifecycle-semantics");
const args = [
    "--opt-in-k55", "--sidecar-root", "s", "--production-root", "p", "--fyi-root", "f", "--k43-root", "43",
    "--k46-root", "46", "--k48-root", "48", "--native-runtime", "elf", "--database", "db",
];
function upstreamK54() {
    return {
        schemaVersion: 1,
        contract: "dokkan-database-character-leader-causality-deck-index-audit",
        contractVersion: "1.0.0",
        mode: "offline_local_explicit_opt_in_stdout_only",
        upstreamK53: { upstreamK52: { scope: { type82NonNullRows: 17, k48References: 45 } } },
        sources: { native: {
                staticCallerOrSourceRowBindingFound: false,
                effectiveLeaderRuntimeBranchBound: false,
                dataLevelBranchSelectionBound: false,
                lifecycleBound: false,
                stackingBound: false,
            } },
        scope: { observedType82CausalityRows: 17, staticallyBoundRuntimeDeckIndexRows: 0 },
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
            k53RealAudit: "GO",
            k53StructuralGosAndNoGosPreserved: true,
            nativeProofBefore: "GO",
            nativeProofAfter: "GO",
            nativeProofStableAcrossK53: true,
            rssStayedBelowExclusiveLimit: true,
        },
        readiness: {
            deckIndexRuntimeArgumentProvenance: "GO",
            deckIndexIndependentFromTargetType: "GO",
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
}
function nativeProof() {
    const pin = leader_lifecycle_semantics_contract_1.CHARACTER_LEADER_LIFECYCLE_SEMANTICS_PIN;
    return {
        elfSha256: pin.nativeSha256,
        elfSizeBytes: pin.nativeSizeBytes,
        evidenceSha256: pin.nativeEvidenceSha256,
        evidenceSizeBytes: pin.nativeEvidenceSizeBytes,
        codeRegionCount: pin.nativeCodeRegions,
        instructionFragmentCount: pin.nativeInstructionFragments,
        exactDirectBranchCount: pin.nativeExactDirectBranches,
        exactPltCallCount: pin.nativeExactPltCalls,
        vtableCount: pin.nativeVtables,
        vtableBindingCount: pin.nativeVtableBindings,
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
describe("K55 leader lifecycle and type-82 composition semantics", () => {
    it("parses exactly one opt-in, all eight values and no loose or duplicate arguments", () => {
        const parsed = (0, leader_lifecycle_semantics_run_1.parseCharacterLeaderLifecycleSemanticsCli)(args);
        (0, assert_1.equal)(parsed.database, "db");
        (0, assert_1.equal)(parsed.nativeRuntime, "elf");
        (0, assert_1.throws)(() => (0, leader_lifecycle_semantics_run_1.parseCharacterLeaderLifecycleSemanticsCli)(args.slice(1)), /exactly one/);
        (0, assert_1.throws)(() => (0, leader_lifecycle_semantics_run_1.parseCharacterLeaderLifecycleSemanticsCli)([...args, "loose"]), /unsupported argument/);
        (0, assert_1.throws)(() => (0, leader_lifecycle_semantics_run_1.parseCharacterLeaderLifecycleSemanticsCli)([...args, "--database", "again"]), /duplicate --database/);
        (0, assert_1.throws)(() => (0, leader_lifecycle_semantics_run_1.parseCharacterLeaderLifecycleSemanticsCli)(args.slice(0, -1)), /missing value/);
        (0, assert_1.throws)(() => (0, leader_lifecycle_semantics_run_1.parseCharacterLeaderLifecycleSemanticsCli)([...args, "--opt-in-k55"]), /exactly one/);
    });
    it("requires a real conservative K54 and keeps the 17/45 deck-index branch excluded", () => {
        const upstream = upstreamK54();
        (0, leader_lifecycle_semantics_1.assertConservativeK54ForLifecycle)(upstream);
        const promoted = JSON.parse(JSON.stringify(upstream));
        promoted.readiness.lifecycle = "GO";
        (0, assert_1.throws)(() => (0, leader_lifecycle_semantics_1.assertConservativeK54ForLifecycle)(promoted), /conservative K54 lifecycle NO-GO/);
        const reopened = JSON.parse(JSON.stringify(upstream));
        reopened.scope.staticallyBoundRuntimeDeckIndexRows = 17;
        (0, assert_1.throws)(() => (0, leader_lifecycle_semantics_1.assertConservativeK54ForLifecycle)(reopened), /integrity, scope or conservative policy changed/);
        const drifted = JSON.parse(JSON.stringify(upstream));
        drifted.upstreamK53.upstreamK52.scope.k48References = 44;
        (0, assert_1.throws)(() => (0, leader_lifecycle_semantics_1.assertConservativeK54ForLifecycle)(drifted), /integrity, scope or conservative policy changed/);
    });
    it("accepts only the exact pinned proof and detects proof drift", () => {
        const upstream = upstreamK54(), native = nativeProof();
        (0, leader_lifecycle_semantics_1.assertPinnedCharacterLeaderLifecycleSemantics)(upstream, native);
        (0, leader_lifecycle_semantics_source_1.assertLeaderLifecycleSemanticsNativeStable)(native, { ...native });
        (0, assert_1.throws)(() => (0, leader_lifecycle_semantics_1.assertPinnedCharacterLeaderLifecycleSemantics)(upstream, { ...native, exactPltCallCount: 11 }), /does not match pin/);
        (0, assert_1.throws)(() => (0, leader_lifecycle_semantics_source_1.assertLeaderLifecycleSemanticsNativeStable)(native, { ...native, evidenceSha256: "drift" }), /evidence changed/);
    });
    it("keeps the public factory NOT_EXECUTED and every lifecycle/composition dimension unknown and NO-GO", () => {
        const report = (0, leader_lifecycle_semantics_1.buildCharacterLeaderLifecycleSemanticsReport)(upstreamK54(), nativeProof());
        for (const value of Object.values(report.readiness).slice(0, 6))
            (0, assert_1.equal)(value, "NOT_EXECUTED");
        for (const value of Object.values(report.readiness).slice(6))
            (0, assert_1.equal)(value, "NO-GO");
        for (const value of Object.values(report.unknown))
            (0, assert_1.equal)(value, true);
        (0, assert_1.equal)(report.inputIntegrity.k54RealAudit, "NOT_EXECUTED");
        (0, assert_1.equal)(report.inputIntegrity.nativeProofStableAcrossK54, false);
        (0, assert_1.equal)(report.policy.lifecycleDerived, false);
        (0, assert_1.equal)(report.policy.removalOutcomeDerived, false);
        (0, assert_1.equal)(report.policy.leaderFriendCompositionDerived, false);
        (0, assert_1.equal)(report.policy.finalStackingDerived, false);
        (0, assert_1.equal)(report.policy.finalRoundingDerived, false);
        (0, assert_1.equal)(report.policy.runtimeDeckIndexReopened, false);
        (0, assert_1.equal)(Buffer.byteLength(`${JSON.stringify(report)}\n`) < 64 * 1024, true);
    });
    it("separates the supported 3836/12265 scope from 17/45 unresolved conditionals", () => {
        const report = (0, leader_lifecycle_semantics_1.buildCharacterLeaderLifecycleSemanticsReport)(upstreamK54(), nativeProof());
        (0, assert_1.deepStrictEqual)(report.scope, {
            unconditional: { effects: 3836, references: 12265, status: "supported" },
            conditional: { effects: 17, references: 45, status: "excluded", reason: "runtime_deck_index_unresolved" },
        });
        (0, assert_1.equal)(report.supported.oneStatusPerSourceRow, true);
        (0, assert_1.equal)(report.supported.startTurnSharedExecutionInvocation, true);
        (0, assert_1.equal)(report.supported.type82MatchingRowsAdditiveInCalculator, true);
        (0, assert_1.equal)(report.partial.creationToApplicationCardinality, "unknown");
        (0, assert_1.equal)(report.partial.deactivation, "apis_invoked_outcome_unbound");
        (0, assert_1.equal)(report.policy.db37PassiveTurnOrIsOnceUsedAsLeaderBinding, false);
    });
    it("pins CRLF evidence and validates bytes, opcodes, branches, relocations and vtable against the exact ELF", async function () {
        const compiledEvidence = (0, path_1.resolve)(__dirname, "..", "database-experiment", "native-leader-lifecycle-semantics.json");
        const evidence = (0, fs_1.existsSync)(compiledEvidence)
            ? compiledEvidence
            : (0, path_1.resolve)(__dirname, "..", "..", "database-experiment", "native-leader-lifecycle-semantics.json");
        const native = "D:\\Dokkan\\database\\apk\\extracted\\lib\\arm64-v8a\\libcocos2dcpp.so";
        if (!(0, fs_1.existsSync)(evidence) || !(0, fs_1.existsSync)(native))
            this.skip();
        (0, assert_1.equal)(/(^|[^\r])\n/.test((0, fs_1.readFileSync)(evidence, "utf8")), false);
        const proof = await (0, leader_lifecycle_semantics_source_1.loadCharacterLeaderLifecycleSemanticsNativeProof)(native);
        (0, assert_1.deepStrictEqual)(proof, nativeProof());
    });
});
//# sourceMappingURL=leader-lifecycle-semantics.spec.js.map