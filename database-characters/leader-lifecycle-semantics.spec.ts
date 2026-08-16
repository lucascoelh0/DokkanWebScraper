import { deepStrictEqual, equal, throws } from "assert";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import {
    CHARACTER_LEADER_LIFECYCLE_SEMANTICS_PIN,
    CharacterLeaderLifecycleSemanticsNativeProof,
} from "./leader-lifecycle-semantics-contract";
import { parseCharacterLeaderLifecycleSemanticsCli } from "./leader-lifecycle-semantics-run";
import {
    assertLeaderLifecycleSemanticsNativeStable,
    loadCharacterLeaderLifecycleSemanticsNativeProof,
} from "./leader-lifecycle-semantics-source";
import {
    assertConservativeK54ForLifecycle,
    assertPinnedCharacterLeaderLifecycleSemantics,
    buildCharacterLeaderLifecycleSemanticsReport,
} from "./leader-lifecycle-semantics";

const args = [
    "--opt-in-k55", "--sidecar-root", "s", "--production-root", "p", "--fyi-root", "f", "--k43-root", "43",
    "--k46-root", "46", "--k48-root", "48", "--native-runtime", "elf", "--database", "db",
];

function upstreamK54(): any {
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

function nativeProof(): CharacterLeaderLifecycleSemanticsNativeProof {
    const pin = CHARACTER_LEADER_LIFECYCLE_SEMANTICS_PIN;
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
        const parsed = parseCharacterLeaderLifecycleSemanticsCli(args);
        equal(parsed.database, "db");
        equal(parsed.nativeRuntime, "elf");
        throws(() => parseCharacterLeaderLifecycleSemanticsCli(args.slice(1)), /exactly one/);
        throws(() => parseCharacterLeaderLifecycleSemanticsCli([...args, "loose"]), /unsupported argument/);
        throws(() => parseCharacterLeaderLifecycleSemanticsCli([...args, "--database", "again"]), /duplicate --database/);
        throws(() => parseCharacterLeaderLifecycleSemanticsCli(args.slice(0, -1)), /missing value/);
        throws(() => parseCharacterLeaderLifecycleSemanticsCli([...args, "--opt-in-k55"]), /exactly one/);
    });

    it("requires a real conservative K54 and keeps the 17/45 deck-index branch excluded", () => {
        const upstream = upstreamK54();
        assertConservativeK54ForLifecycle(upstream);
        const promoted = JSON.parse(JSON.stringify(upstream));
        promoted.readiness.lifecycle = "GO";
        throws(() => assertConservativeK54ForLifecycle(promoted), /conservative K54 lifecycle NO-GO/);
        const reopened = JSON.parse(JSON.stringify(upstream));
        reopened.scope.staticallyBoundRuntimeDeckIndexRows = 17;
        throws(() => assertConservativeK54ForLifecycle(reopened), /integrity, scope or conservative policy changed/);
        const drifted = JSON.parse(JSON.stringify(upstream));
        drifted.upstreamK53.upstreamK52.scope.k48References = 44;
        throws(() => assertConservativeK54ForLifecycle(drifted), /integrity, scope or conservative policy changed/);
    });

    it("accepts only the exact pinned proof and detects proof drift", () => {
        const upstream = upstreamK54(), native = nativeProof();
        assertPinnedCharacterLeaderLifecycleSemantics(upstream, native);
        assertLeaderLifecycleSemanticsNativeStable(native, { ...native });
        throws(() => assertPinnedCharacterLeaderLifecycleSemantics(upstream, { ...native, exactPltCallCount: 11 }), /does not match pin/);
        throws(() => assertLeaderLifecycleSemanticsNativeStable(native, { ...native, evidenceSha256: "drift" }), /evidence changed/);
    });

    it("keeps the public factory NOT_EXECUTED and every lifecycle/composition dimension unknown and NO-GO", () => {
        const report = buildCharacterLeaderLifecycleSemanticsReport(upstreamK54(), nativeProof());
        for (const value of Object.values(report.readiness).slice(0, 6)) equal(value, "NOT_EXECUTED");
        for (const value of Object.values(report.readiness).slice(6)) equal(value, "NO-GO");
        for (const value of Object.values(report.unknown)) equal(value, true);
        equal(report.inputIntegrity.k54RealAudit, "NOT_EXECUTED");
        equal(report.inputIntegrity.nativeProofStableAcrossK54, false);
        equal(report.policy.lifecycleDerived, false);
        equal(report.policy.removalOutcomeDerived, false);
        equal(report.policy.leaderFriendCompositionDerived, false);
        equal(report.policy.finalStackingDerived, false);
        equal(report.policy.finalRoundingDerived, false);
        equal(report.policy.runtimeDeckIndexReopened, false);
        equal(Buffer.byteLength(`${JSON.stringify(report)}\n`) < 64 * 1024, true);
    });

    it("separates the supported 3836/12265 scope from 17/45 unresolved conditionals", () => {
        const report = buildCharacterLeaderLifecycleSemanticsReport(upstreamK54(), nativeProof());
        deepStrictEqual(report.scope, {
            unconditional: { effects: 3836, references: 12265, status: "supported" },
            conditional: { effects: 17, references: 45, status: "excluded", reason: "runtime_deck_index_unresolved" },
        });
        equal(report.supported.oneStatusPerSourceRow, true);
        equal(report.supported.startTurnSharedExecutionInvocation, true);
        equal(report.supported.type82MatchingRowsAdditiveInCalculator, true);
        equal(report.partial.creationToApplicationCardinality, "unknown");
        equal(report.partial.deactivation, "apis_invoked_outcome_unbound");
        equal(report.policy.db37PassiveTurnOrIsOnceUsedAsLeaderBinding, false);
    });

    it("pins CRLF evidence and validates bytes, opcodes, branches, relocations and vtable against the exact ELF", async function () {
        const compiledEvidence = resolve(__dirname, "..", "database-experiment", "native-leader-lifecycle-semantics.json");
        const evidence = existsSync(compiledEvidence)
            ? compiledEvidence
            : resolve(__dirname, "..", "..", "database-experiment", "native-leader-lifecycle-semantics.json");
        const native = "D:\\Dokkan\\database\\apk\\extracted\\lib\\arm64-v8a\\libcocos2dcpp.so";
        if (!existsSync(evidence) || !existsSync(native)) this.skip();
        equal(/(^|[^\r])\n/.test(readFileSync(evidence, "utf8")), false);
        const proof = await loadCharacterLeaderLifecycleSemanticsNativeProof(native);
        deepStrictEqual(proof, nativeProof());
    });
});
