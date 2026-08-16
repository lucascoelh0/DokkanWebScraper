import {
    CHARACTER_LEADER_LIFECYCLE_SEMANTICS_CONTRACT_VERSION,
    CHARACTER_LEADER_LIFECYCLE_SEMANTICS_PIN,
    CHARACTER_LEADER_LIFECYCLE_SEMANTICS_REPORT_LIMIT_BYTES,
    CHARACTER_LEADER_LIFECYCLE_SEMANTICS_RSS_LIMIT_BYTES,
    CharacterLeaderLifecycleSemanticsNativeProof,
    CharacterLeaderLifecycleSemanticsReport,
} from "./leader-lifecycle-semantics-contract";
import type { CharacterLeaderCausalityDeckIndexReport } from "./leader-causality-deck-index-contract";
import { CHARACTER_LEADER_NATIVE_PIN } from "./leader-native-semantics-contract";

const K54_GO = ["deckIndexRuntimeArgumentProvenance", "deckIndexIndependentFromTargetType"] as const;
const K54_NO_GO = [
    "effectiveLeaderRuntimeBranch", "dataLevelBranchSelection", "lifecycle", "stacking", "productProjection",
    "authority", "production", "writer", "publisher", "network", "r2", "android",
] as const;

export function assertConservativeK54ForLifecycle(report: CharacterLeaderCausalityDeckIndexReport): void {
    if (report.schemaVersion !== 1 || report.contract !== "dokkan-database-character-leader-causality-deck-index-audit"
        || report.contractVersion !== "1.0.0" || report.mode !== "offline_local_explicit_opt_in_stdout_only") {
        throw new Error("K55 upstream K54 contract changed");
    }
    for (const key of K54_GO) if (report.readiness[key] !== "GO") throw new Error(`K55 requires K54 ${key} GO`);
    for (const key of K54_NO_GO) if (report.readiness[key] !== "NO-GO") throw new Error(`K55 requires conservative K54 ${key} NO-GO`);
    const conditional = report.upstreamK53.upstreamK52.scope;
    if (conditional.type82NonNullRows !== CHARACTER_LEADER_LIFECYCLE_SEMANTICS_PIN.conditionalType82Effects
        || conditional.k48References !== CHARACTER_LEADER_LIFECYCLE_SEMANTICS_PIN.conditionalType82References
        || report.scope.observedType82CausalityRows !== CHARACTER_LEADER_LIFECYCLE_SEMANTICS_PIN.conditionalType82Effects
        || report.scope.staticallyBoundRuntimeDeckIndexRows !== 0
        || CHARACTER_LEADER_NATIVE_PIN.type82Rows !== CHARACTER_LEADER_LIFECYCLE_SEMANTICS_PIN.totalType82Effects
        || CHARACTER_LEADER_NATIVE_PIN.type82References !== CHARACTER_LEADER_LIFECYCLE_SEMANTICS_PIN.totalType82References
        || report.inputIntegrity.k53RealAudit !== "GO" || report.inputIntegrity.k53StructuralGosAndNoGosPreserved !== true
        || report.inputIntegrity.nativeProofBefore !== "GO" || report.inputIntegrity.nativeProofAfter !== "GO"
        || report.inputIntegrity.nativeProofStableAcrossK53 !== true || report.inputIntegrity.rssStayedBelowExclusiveLimit !== true
        || report.sources.native.staticCallerOrSourceRowBindingFound !== false
        || report.sources.native.effectiveLeaderRuntimeBranchBound !== false || report.sources.native.dataLevelBranchSelectionBound !== false
        || report.sources.native.lifecycleBound !== false || report.sources.native.stackingBound !== false
        || report.policy.nativeStructuralEvidenceOnly !== true || report.policy.runtimeArgumentProvenanceOnly !== true
        || report.policy.targetTypeDoesNotSelectDeckIndexInAuditedCreationChain !== true
        || report.policy.staticCallerOrSourceRowBindingDerived !== false || report.policy.effectiveLeaderRuntimeBranchSelected !== false
        || report.policy.dataLevelBranchSelectionDerived !== false || report.policy.lifecycleDerived !== false
        || report.policy.stackingDerived !== false || report.policy.sourceTextIncluded !== false || report.policy.payloadWritten !== false
        || report.policy.authoritySelected !== false || report.policy.productionModified !== false
        || report.policy.networkEnabled !== false || report.policy.r2Enabled !== false || report.policy.androidImplemented !== false) {
        throw new Error("K55 upstream K54 integrity, scope or conservative policy changed");
    }
}

export function assertPinnedCharacterLeaderLifecycleSemantics(
    upstreamK54: CharacterLeaderCausalityDeckIndexReport,
    native: CharacterLeaderLifecycleSemanticsNativeProof,
): void {
    assertConservativeK54ForLifecycle(upstreamK54);
    const pin = CHARACTER_LEADER_LIFECYCLE_SEMANTICS_PIN;
    if (native.elfSha256 !== pin.nativeSha256 || native.elfSizeBytes !== pin.nativeSizeBytes
        || native.evidenceSha256 !== pin.nativeEvidenceSha256 || native.evidenceSizeBytes !== pin.nativeEvidenceSizeBytes
        || native.codeRegionCount !== pin.nativeCodeRegions || native.instructionFragmentCount !== pin.nativeInstructionFragments
        || native.exactDirectBranchCount !== pin.nativeExactDirectBranches || native.exactPltCallCount !== pin.nativeExactPltCalls
        || native.vtableCount !== pin.nativeVtables || native.vtableBindingCount !== pin.nativeVtableBindings
        || native.oneStatusPerSourceRowBound !== true || native.startTurnSharedExecutionInvocationBound !== true
        || native.type82MatchingRowsAdditiveInCalculatorBound !== true
        || native.calcOption0IntegerConversionAtHandlerBound !== true || native.calcOption2DivideBy100FloatAtHandlerBound !== true
        || native.independentOfType35PostConditionBound !== true || native.deactivationApisInvoked !== true
        || native.deactivationOutcomeBound !== false || native.db37PassiveTurnOrIsOnceLeaderBindingFound !== false
        || native.singleEvaluationOrReevaluationBound !== false || native.durationBound !== false
        || native.resetOrRemovalOutcomeBound !== false || native.enterExitBound !== false
        || native.leaderFriendCompositionBound !== false || native.finalStackingOrCompositionBound !== false
        || native.finalOperationOrderingOutsideHandlerBound !== false
        || native.transformationDeathReviveExchangeStandbyBound !== false || native.finalRoundingBound !== false) {
        throw new Error("K55 native lifecycle proof does not match pin");
    }
}

export function buildCharacterLeaderLifecycleSemanticsReport(
    upstreamK54: CharacterLeaderCausalityDeckIndexReport,
    native: CharacterLeaderLifecycleSemanticsNativeProof,
): CharacterLeaderLifecycleSemanticsReport {
    assertPinnedCharacterLeaderLifecycleSemantics(upstreamK54, native);
    const pin = CHARACTER_LEADER_LIFECYCLE_SEMANTICS_PIN;
    const report: CharacterLeaderLifecycleSemanticsReport = {
        schemaVersion: 1,
        contract: "dokkan-database-character-leader-lifecycle-semantics-audit",
        contractVersion: CHARACTER_LEADER_LIFECYCLE_SEMANTICS_CONTRACT_VERSION,
        mode: "offline_local_explicit_opt_in_stdout_only",
        upstreamK54,
        sources: { native },
        scope: {
            unconditional: { effects: pin.unconditionalType82Effects, references: pin.unconditionalType82References, status: "supported" },
            conditional: {
                effects: pin.conditionalType82Effects,
                references: pin.conditionalType82References,
                status: "excluded",
                reason: "runtime_deck_index_unresolved",
            },
        },
        supported: {
            oneStatusPerSourceRow: true,
            startTurnSharedExecutionInvocation: true,
            type82MatchingRowsAdditiveInCalculator: true,
            calcOption0IntegerConversionAtHandler: true,
            calcOption2DivideBy100FloatAtHandler: true,
            independentOfType35ForPostCondition: true,
        },
        partial: {
            creation: "factory_per_source_row",
            application: "shared_start_turn_execution_invocation",
            creationToApplicationCardinality: "unknown",
            deactivation: "apis_invoked_outcome_unbound",
        },
        unknown: {
            singleEvaluationOrReevaluation: true,
            duration: true,
            resetOrRemovalOutcome: true,
            enterExitLifecycle: true,
            leaderFriendComposition: true,
            finalStackingOrComposition: true,
            finalOperationOrderingOutsideHandler: true,
            transformationDeathReviveExchangeStandby: true,
            finalRounding: true,
        },
        policy: {
            nativeStructuralEvidenceOnly: true,
            postConditionIndependentOfType35Only: true,
            runtimeDeckIndexReopened: false,
            db37PassiveTurnOrIsOnceUsedAsLeaderBinding: false,
            lifecycleDerived: false,
            removalOutcomeDerived: false,
            leaderFriendCompositionDerived: false,
            finalStackingDerived: false,
            finalRoundingDerived: false,
            sourceTextIncluded: false,
            payloadWritten: false,
            authoritySelected: false,
            productionModified: false,
            networkEnabled: false,
            r2Enabled: false,
            androidImplemented: false,
        },
        inputIntegrity: {
            k54RealAudit: "NOT_EXECUTED",
            k54StructuralGosAndAllNoGosPreserved: false,
            nativeProofBefore: "NOT_EXECUTED",
            nativeProofAfter: "NOT_EXECUTED",
            nativeProofStableAcrossK54: false,
            reportTimestampIncluded: false,
            reportMaximumBytesExclusive: CHARACTER_LEADER_LIFECYCLE_SEMANTICS_REPORT_LIMIT_BYTES,
            rssMaximumBytesExclusive: CHARACTER_LEADER_LIFECYCLE_SEMANTICS_RSS_LIMIT_BYTES,
            rssStayedBelowExclusiveLimit: false,
        },
        readiness: {
            oneStatusPerSourceRow: "NOT_EXECUTED",
            startTurnSharedExecutionInvocation: "NOT_EXECUTED",
            type82MatchingRowsAdditiveInCalculator: "NOT_EXECUTED",
            calcOption0IntegerConversionAtHandler: "NOT_EXECUTED",
            calcOption2DivideBy100FloatAtHandler: "NOT_EXECUTED",
            postConditionIndependentOfType35: "NOT_EXECUTED",
            conditionalType82RuntimeBranch: "NO-GO",
            singleEvaluationOrReevaluation: "NO-GO",
            duration: "NO-GO",
            resetOrRemovalOutcome: "NO-GO",
            enterExitLifecycle: "NO-GO",
            leaderFriendComposition: "NO-GO",
            finalStackingOrComposition: "NO-GO",
            finalOperationOrderingOutsideHandler: "NO-GO",
            transformationDeathReviveExchangeStandby: "NO-GO",
            finalRounding: "NO-GO",
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
    if (Buffer.byteLength(`${JSON.stringify(report)}\n`) >= CHARACTER_LEADER_LIFECYCLE_SEMANTICS_REPORT_LIMIT_BYTES) {
        throw new Error("K55 report byte limit reached");
    }
    return report;
}
