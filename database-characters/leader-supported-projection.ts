import { createHash } from "crypto";
import { gzipSync } from "zlib";
import type { CharacterLeaderAssociationProjectionArtifactSet } from "./leader-association-projection-contract";
import { CHARACTER_LEADER_CAUSALITY_PIN, CharacterLeaderCausalityDatabaseSource, CharacterLeaderCausalityK3Source } from "./leader-causality-semantics-contract";
import { CHARACTER_LEADER_CAUSALITY_COLLECTION_PIN } from "./leader-causality-collection-contract";
import { CHARACTER_LEADER_CAUSALITY_DECK_INDEX_PIN } from "./leader-causality-deck-index-contract";
import type { CharacterLeaderLifecycleSemanticsReport } from "./leader-lifecycle-semantics-contract";
import { CHARACTER_LEADER_LIFECYCLE_SEMANTICS_PIN } from "./leader-lifecycle-semantics-contract";
import { CHARACTER_LEADER_NATIVE_PIN } from "./leader-native-semantics-contract";
import {
    CHARACTER_LEADER_SUPPORTED_PROJECTION_CONTRACT_VERSION,
    CHARACTER_LEADER_SUPPORTED_PROJECTION_FILES,
    CHARACTER_LEADER_SUPPORTED_PROJECTION_GZIP_LIMIT_BYTES,
    CHARACTER_LEADER_SUPPORTED_PROJECTION_METADATA_LIMIT_BYTES,
    CHARACTER_LEADER_SUPPORTED_PROJECTION_PIN,
    CHARACTER_LEADER_SUPPORTED_PROJECTION_RAW_LIMIT_BYTES,
    CharacterLeaderSupportedProjectionArtifactSet,
    CharacterLeaderSupportedProjectionCorroborativeDomainRule,
    CharacterLeaderSupportedProjectionCoverage,
    CharacterLeaderSupportedProjectionDataset,
    CharacterLeaderSupportedProjectionLineage,
    CharacterLeaderSupportedProjectionManifest,
    CharacterLeaderSupportedProjectionRecord,
    CharacterLeaderSupportedProjectionValidation,
    CharacterLeaderSupportedTargetScope,
} from "./leader-supported-projection-contract";
import type { CharacterLeaderTargetK3Source } from "./leader-target-semantics-contract";
import type { CharacterLeaderValueK3Source, CharacterLeaderValueK48Identity } from "./leader-value-scope-contract";

const hash = (bytes: Buffer | string): string => createHash("sha256").update(bytes).digest("hex");
const jsonBytes = (value: unknown): Buffer => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
const structuralOrder = (left: string, right: string): number => left.localeCompare(right, undefined, { numeric: true });
const exactKeys = (value: unknown, keys: string[]): boolean => !!value && typeof value === "object" && !Array.isArray(value)
    && JSON.stringify(Object.keys(value)) === JSON.stringify(keys);
const CORROBORATIVE_DOMAIN_RULE: CharacterLeaderSupportedProjectionCorroborativeDomainRule = {
    ruleId: "k56-conditional-domain-rule-v1",
    provenance: "user_confirmed_domain_rule",
    communityCorroboration: "user_reported_not_independently_source_bound",
    firstPartyRuntimeDeckIndexEvidence: false,
    usedToAuthorizeSupportedProjection: false,
    appliesToExcludedConditionalEffectsOnly: true,
    elementTypeDomain: ["agl", "teq", "int", "str", "phy"],
    battleClassDomain: ["super", "extreme", "none"],
    awakeningState: {
        source: "selected_card_state",
        preZBattleClass: "none",
        postZBattleClass: "acquired_after_z_awakening",
    },
    condition: {
        scope: "team_including_friend",
        ownUnitSlots: 6,
        friendUnitSlots: 1,
        effectTarget: "eligible_matching_units",
        currentElementTypeRequired: true,
        currentBattleClassRequired: true,
    },
    friend: {
        conditionParticipation: "may_satisfy_condition",
        effectReceipt: "only_if_effect_target_matches",
    },
    passiveCrossScope: {
        allFiveElementTypesScope: "team_including_friend",
        authority: "corroborative_only",
    },
    dualSuperExtremeClause: {
        proofComposition: "separate_required_proofs",
        requiredProofs: ["super_class_presence", "extreme_class_presence", "all_five_element_types"],
    },
};

export interface CharacterLeaderSupportedProductiveSource {
    identity: { fileName: "characters.json"; sha256: string; sizeBytes: number; topLevelCount: number };
    cardIds: Set<string>;
}

export interface CharacterLeaderSupportedProjectionInputs {
    k48: CharacterLeaderAssociationProjectionArtifactSet;
    k3Value: CharacterLeaderValueK3Source;
    k3Target: CharacterLeaderTargetK3Source;
    k3Causality: CharacterLeaderCausalityK3Source;
    causalityDatabase: CharacterLeaderCausalityDatabaseSource;
    productive: CharacterLeaderSupportedProductiveSource;
    upstreamK55: CharacterLeaderLifecycleSemanticsReport;
}

const targetScope = (raw: number): CharacterLeaderSupportedTargetScope => {
    if (raw === 2) return "team_allies";
    if (raw === 12) return "super_class_allies";
    if (raw === 13) return "extreme_class_allies";
    throw new Error(`K56 unsupported type82 target_type ${raw}`);
};

function assertConservativeK55(report: CharacterLeaderLifecycleSemanticsReport): void {
    const go = [
        "oneStatusPerSourceRow", "startTurnSharedExecutionInvocation", "type82MatchingRowsAdditiveInCalculator",
        "calcOption0IntegerConversionAtHandler", "calcOption2DivideBy100FloatAtHandler", "postConditionIndependentOfType35",
    ] as const;
    const noGo = [
        "conditionalType82RuntimeBranch", "singleEvaluationOrReevaluation", "duration", "resetOrRemovalOutcome",
        "enterExitLifecycle", "leaderFriendComposition", "finalStackingOrComposition", "finalOperationOrderingOutsideHandler",
        "transformationDeathReviveExchangeStandby", "finalRounding", "productProjection", "authority", "production",
        "writer", "publisher", "network", "r2", "android",
    ] as const;
    if (report.schemaVersion !== 1 || report.contract !== "dokkan-database-character-leader-lifecycle-semantics-audit"
        || report.contractVersion !== "1.0.0" || report.mode !== "offline_local_explicit_opt_in_stdout_only") throw new Error("K56 upstream K55 contract changed");
    for (const key of go) if (report.readiness[key] !== "GO") throw new Error(`K56 requires K55 ${key} GO`);
    for (const key of noGo) if (report.readiness[key] !== "NO-GO") throw new Error(`K56 requires conservative K55 ${key} NO-GO`);
    if (report.scope.unconditional.effects !== 3_836 || report.scope.unconditional.references !== 12_265
        || report.scope.conditional.effects !== 17 || report.scope.conditional.references !== 45
        || report.scope.conditional.reason !== "runtime_deck_index_unresolved"
        || report.inputIntegrity.k54RealAudit !== "GO" || report.inputIntegrity.k54StructuralGosAndAllNoGosPreserved !== true
        || report.inputIntegrity.nativeProofBefore !== "GO" || report.inputIntegrity.nativeProofAfter !== "GO"
        || report.inputIntegrity.nativeProofStableAcrossK54 !== true || report.inputIntegrity.rssStayedBelowExclusiveLimit !== true
        || report.policy.runtimeDeckIndexReopened !== false || report.policy.lifecycleDerived !== false
        || report.policy.removalOutcomeDerived !== false || report.policy.leaderFriendCompositionDerived !== false
        || report.policy.finalStackingDerived !== false || report.policy.finalRoundingDerived !== false
        || report.policy.authoritySelected !== false || report.policy.productionModified !== false
        || report.policy.networkEnabled !== false || report.policy.r2Enabled !== false || report.policy.androidImplemented !== false) {
        throw new Error("K56 upstream K55 integrity or conservative boundary changed");
    }
}

function lineage(inputs: CharacterLeaderSupportedProjectionInputs, k48Identity: CharacterLeaderValueK48Identity): CharacterLeaderSupportedProjectionLineage {
    return {
        k48: k48Identity,
        k3Value: inputs.k3Value.identity,
        k3Target: inputs.k3Target.identity,
        k3Causality: { causalityInputFingerprintSha256: inputs.k3Causality.identity.causalityInputFingerprintSha256 },
        causalityDatabase: {
            sha256: inputs.causalityDatabase.identity.sha256,
            sizeBytes: inputs.causalityDatabase.identity.sizeBytes,
            rowsFingerprintSha256: inputs.causalityDatabase.identity.rowsFingerprintSha256,
        },
        native: {
            elfSha256: CHARACTER_LEADER_NATIVE_PIN.elfSha256,
            k50EvidenceSha256: CHARACTER_LEADER_NATIVE_PIN.evidenceSha256,
            k52EvidenceSha256: CHARACTER_LEADER_CAUSALITY_PIN.nativeEvidenceSha256,
            k53EvidenceSha256: CHARACTER_LEADER_CAUSALITY_COLLECTION_PIN.nativeEvidenceSha256,
            k54EvidenceSha256: CHARACTER_LEADER_CAUSALITY_DECK_INDEX_PIN.nativeEvidenceSha256,
            k55EvidenceSha256: CHARACTER_LEADER_LIFECYCLE_SEMANTICS_PIN.nativeEvidenceSha256,
        },
        productive: inputs.productive.identity,
    };
}

export function buildCharacterLeaderSupportedProjection(
    inputs: CharacterLeaderSupportedProjectionInputs,
): { dataset: CharacterLeaderSupportedProjectionDataset; coverage: CharacterLeaderSupportedProjectionCoverage } {
    assertConservativeK55(inputs.upstreamK55);
    const k48Dataset = inputs.k48.dataset;
    if (!inputs.k48.validation.valid || inputs.k48.validation.readiness.sourceBoundValidation !== "NOT_EXECUTED"
        || !k48Dataset.policy.structuralIdsOnly || !k48Dataset.policy.sourceOrderAndMultiplicityPreserved
        || k48Dataset.policy.semanticAssociationSelected) throw new Error("K56 requires conservative source-bound K48 artifacts");
    const valueById = new Map(inputs.k3Value.effects.map(effect => [effect.rowId, effect]));
    const targetById = new Map(inputs.k3Target.rows.map(row => [row.rowId, row]));
    const conditionalById = new Map(inputs.k3Causality.effects.map(effect => [effect.rowId, effect]));
    const conditionalEffectRowIds = inputs.k3Causality.effects.map(effect => effect.rowId);
    const type82 = inputs.k3Value.effects.filter(effect => effect.efficacyType === 82);
    const expectedDatabaseRows = CHARACTER_LEADER_CAUSALITY_PIN.referencedIds.map(id => ({
        id,
        causalityType: 35,
        cauVal1: CHARACTER_LEADER_CAUSALITY_PIN.masks[id as keyof typeof CHARACTER_LEADER_CAUSALITY_PIN.masks],
        cauVal2: 0,
        cauVal3: 0,
    }));
    if (type82.length !== CHARACTER_LEADER_SUPPORTED_PROJECTION_PIN.totalEffects
        || conditionalById.size !== CHARACTER_LEADER_SUPPORTED_PROJECTION_PIN.excludedEffects
        || JSON.stringify(conditionalEffectRowIds) !== JSON.stringify(CHARACTER_LEADER_SUPPORTED_PROJECTION_PIN.conditionalEffectRowIds)
        || JSON.stringify(inputs.k3Causality.missingReferencedRowIds) !== JSON.stringify(CHARACTER_LEADER_CAUSALITY_PIN.referencedIds)
        || inputs.causalityDatabase.identity.sha256 !== CHARACTER_LEADER_CAUSALITY_PIN.databaseSha256
        || inputs.causalityDatabase.identity.sizeBytes !== CHARACTER_LEADER_CAUSALITY_PIN.databaseSizeBytes
        || inputs.causalityDatabase.identity.rowsFingerprintSha256 !== CHARACTER_LEADER_CAUSALITY_PIN.databaseRowsFingerprintSha256
        || inputs.causalityDatabase.identity.descriptorBoundReadOnly !== true
        || JSON.stringify(inputs.causalityDatabase.rows) !== JSON.stringify(expectedDatabaseRows)) {
        throw new Error("K56 type82 or causality corpus pin changed");
    }

    const records: CharacterLeaderSupportedProjectionRecord[] = [];
    const affected = new Map<string, Array<{ stateId: string; sourceEffectOccurrenceIndex: number }>>();
    const allType82References: Array<{ effectRowId: string; conditional: boolean }> = [];
    for (const state of k48Dataset.states) for (let occurrence = 0; occurrence < state.leader.effects.length; occurrence++) {
        const association = state.leader.effects[occurrence];
        const effect = valueById.get(association.effect.rowId);
        if (!effect || effect.efficacyType !== 82) continue;
        if (effect.leaderSkillSetId !== state.leader.set.rowId || effect.subTargetTypeSetId !== association.targetSetId) {
            throw new Error(`K56 structural effect association changed for ${effect.rowId}`);
        }
        const conditional = conditionalById.has(effect.rowId);
        allType82References.push({ effectRowId: effect.rowId, conditional });
        if (conditional) {
            const refs = affected.get(effect.rowId) ?? [];
            refs.push({ stateId: state.stateId, sourceEffectOccurrenceIndex: occurrence });
            affected.set(effect.rowId, refs);
            continue;
        }
        if (!effect.efficacyVector || effect.efficacyVector.length !== 3 || !effect.efficacyVector.every(Number.isFinite)
            || ![0, 2].includes(effect.calcOption) || ![2, 12, 13].includes(effect.targetType)) throw new Error(`K56 unsupported type82 row ${effect.rowId}`);
        const filters = association.targets.map((ref, targetOccurrence) => {
            const row = targetById.get(ref.rowId);
            if (!row || row.targetSetId !== association.targetSetId || ![1, 2].includes(row.valueType)) throw new Error(`K56 target row binding changed for ${ref.rowId}`);
            return {
                sourceTargetOccurrenceIndex: targetOccurrence,
                operation: row.valueType === 1 ? "include" as const : "exclude" as const,
                selector: "card_category_id" as const,
                categoryId: row.valueId,
            };
        });
        records.push({
            stateId: state.stateId,
            sourceStateKey: state.sourceStateKey,
            cardId: state.cardId,
            releaseState: state.releaseState,
            leaderSetRowId: state.leader.set.rowId,
            effectRowId: effect.rowId,
            sourceEffectOccurrenceIndex: occurrence,
            selector: { kind: "structural_mask", mask: effect.efficacyVector[0] },
            commonModifier: effect.efficacyVector[1],
            stats: ["hp", "atk", "def"],
            calculation: effect.calcOption === 0
                ? { kind: "flat_points", value: effect.efficacyVector[1], integerConversion: "at_handler" }
                : { kind: "proportional_percent_divided_by_100", numerator: effect.efficacyVector[1], divisor: 100 },
            targetScope: targetScope(effect.targetType),
            targetFilters: filters,
            targetFilterComposition: { operator: "and_sequential", emptyBehavior: "identity", duplicateBehavior: "preserved_and_reapplied" },
        });
    }
    const projectedIds = new Set(records.map(record => record.effectRowId));
    const conditionalReferenceCount = allType82References.filter(ref => ref.conditional).length;
    if (allType82References.length !== CHARACTER_LEADER_SUPPORTED_PROJECTION_PIN.totalReferences
        || records.length !== CHARACTER_LEADER_SUPPORTED_PROJECTION_PIN.projectedReferences
        || projectedIds.size !== CHARACTER_LEADER_SUPPORTED_PROJECTION_PIN.projectedEffects
        || conditionalReferenceCount !== CHARACTER_LEADER_SUPPORTED_PROJECTION_PIN.excludedReferences) throw new Error("K56 exact projected/excluded corpus changed");

    const excluded = inputs.k3Causality.effects.map(effect => ({
        effectRowId: effect.rowId,
        affectedReferences: affected.get(effect.rowId) ?? [],
        expression: effect.expression,
        reason: "runtime_deck_index_unresolved" as const,
        provenance: {
            k52NativeEvidenceSha256: CHARACTER_LEADER_CAUSALITY_PIN.nativeEvidenceSha256,
            k53NativeEvidenceSha256: CHARACTER_LEADER_CAUSALITY_COLLECTION_PIN.nativeEvidenceSha256,
            k54NativeEvidenceSha256: CHARACTER_LEADER_CAUSALITY_DECK_INDEX_PIN.nativeEvidenceSha256,
        },
        corroborativeRule: {
            ruleId: CORROBORATIVE_DOMAIN_RULE.ruleId,
            provenance: CORROBORATIVE_DOMAIN_RULE.provenance,
            usedToAuthorizeSupportedProjection: false as const,
        },
    }));
    if (excluded.some(item => item.affectedReferences.length === 0)
        || excluded.reduce((sum, item) => sum + item.affectedReferences.length, 0) !== CHARACTER_LEADER_SUPPORTED_PROJECTION_PIN.excludedReferences) {
        throw new Error("K56 exclusion coverage changed");
    }

    const k48Identity: CharacterLeaderValueK48Identity = {
        manifestSha256: hash(inputs.k48.manifestBytes),
        payloadSha256: inputs.k48.manifest.sha256,
        rawSha256: inputs.k48.manifest.uncompressedSha256,
        stateFingerprintSha256: hash(JSON.stringify(k48Dataset.states.map(state => ({
            stateId: state.stateId, sourceStateKey: state.sourceStateKey, cardId: state.cardId, releaseState: state.releaseState,
            leaderSetRowId: state.leader.set.rowId,
            effects: state.leader.effects.map(effect => ({ effectRowId: effect.effect.rowId, targetSetId: effect.targetSetId })),
        })))),
        k46: k48Dataset.source.k46,
        k3: k48Dataset.source.k3,
    };
    const source = lineage(inputs, k48Identity);
    const dataset: CharacterLeaderSupportedProjectionDataset = {
        schemaVersion: 1,
        contract: "dokkan-database-character-leader-supported-only-projection",
        contractVersion: CHARACTER_LEADER_SUPPORTED_PROJECTION_CONTRACT_VERSION,
        mode: "explicit_opt_in_offline_local_supported_only_default_off",
        source,
        policy: {
            supportedOnly: true, structuralIdsOnly: true, sourceOrderAndMultiplicityPreserved: true,
            outputNamespaceThreatModel: "caller_controlled_stable_during_operation",
            concurrentSameUserAncestorReplacementProtected: false,
            conditionalEffectsIncluded: false, unknownValuesMaterialized: false, execTimingTypeIncluded: false,
            causalityIncluded: false, ignoredPosition2Included: false, textOrDescriptionIncluded: false,
            aggregateOrFinalValueIncluded: false, primarySecondaryOrHybridInvented: false, characterArrayIncluded: false,
            patchOrApplyImplemented: false, authoritySelected: false, productionModified: false, publisherImplemented: false,
            networkEnabled: false, r2Enabled: false, androidImplemented: false,
        },
        records,
    };
    const projectedCardIds = [...new Set(records.map(record => record.cardId))];
    const joined = new Set(projectedCardIds.filter(cardId => inputs.productive.cardIds.has(cardId)));
    const joinedReferences = records.filter(record => joined.has(record.cardId)).length;
    const coverage: CharacterLeaderSupportedProjectionCoverage = {
        schemaVersion: 1,
        contract: "dokkan-database-character-leader-supported-only-projection-coverage",
        contractVersion: CHARACTER_LEADER_SUPPORTED_PROJECTION_CONTRACT_VERSION,
        counts: { totalEffects: 3_853, totalReferences: 12_310, projectedEffects: 3_836, projectedReferences: 12_265, excludedEffects: 17, excludedReferences: 45 },
        projected: { effects: 3_836, references: 12_265, classification: "supported" },
        excluded,
        corroborativeDomainRules: [CORROBORATIVE_DOMAIN_RULE],
        partial: { creation: "factory_per_source_row", application: "shared_start_turn_execution_invocation", deactivation: "apis_invoked_outcome_unbound" },
        unknown: {
            recurrence: "unknown", duration: "unknown", removalOutcome: "unknown", enterExitLifecycle: "unknown",
            leaderFriendComposition: "unknown", finalStackingOrComposition: "unknown", operationOrderingOutsideHandler: "unknown",
            finalRounding: "unknown", transformationDeathReviveExchangeStandby: "unknown", effectiveConditionalBranch: "unknown",
        },
        unjoinable: {
            scope: "productive_card_id",
            distinctCardIds: projectedCardIds.length - joined.size,
            references: records.length - joinedReferences,
        },
        shadowParity: {
            comparisonMode: "card_id_only_no_value_authority",
            cardIdCoverage: {
                projectedDistinctCardIds: projectedCardIds.length,
                productiveJoinedCardIds: joined.size,
                productiveUnjoinableCardIds: projectedCardIds.length - joined.size,
            },
            structuralRepresentationGainReferences: joinedReferences,
            comparableValueReferences: 0,
            representationMismatchComparableReferences: 0,
            comparableAgreementCardIds: joined.size,
            confirmedConflictComparableValues: 0,
            unknownValueReferences: joinedReferences,
            unjoinableReferences: records.length - joinedReferences,
            zeroConflictIsCompleteness: false,
            authoritySelected: false,
        },
        provenance: {
            k52CausalityInputFingerprintSha256: inputs.k3Causality.identity.causalityInputFingerprintSha256,
            k52DatabaseSha256: inputs.causalityDatabase.identity.sha256,
            k52DatabaseRowsFingerprintSha256: inputs.causalityDatabase.identity.rowsFingerprintSha256,
            k52NativeEvidenceSha256: CHARACTER_LEADER_CAUSALITY_PIN.nativeEvidenceSha256,
            k53NativeEvidenceSha256: CHARACTER_LEADER_CAUSALITY_COLLECTION_PIN.nativeEvidenceSha256,
            k54NativeEvidenceSha256: CHARACTER_LEADER_CAUSALITY_DECK_INDEX_PIN.nativeEvidenceSha256,
            k55NativeEvidenceSha256: CHARACTER_LEADER_LIFECYCLE_SEMANTICS_PIN.nativeEvidenceSha256,
        },
    };
    return { dataset, coverage };
}

export function validateCharacterLeaderSupportedProjection(
    dataset: CharacterLeaderSupportedProjectionDataset,
    coverage: CharacterLeaderSupportedProjectionCoverage,
    sizes = { rawSizeBytes: 0, gzipSizeBytes: 0, metadataSizeBytes: 0 },
): CharacterLeaderSupportedProjectionValidation {
    const failures: string[] = [];
    let conditionalLeakageCount = 0, unsupportedOrExtraFieldCount = 0, sourceOrderOrOccurrenceMismatchCount = 0, unknownMaterializedCount = 0;
    if (!exactKeys(dataset, ["schemaVersion", "contract", "contractVersion", "mode", "source", "policy", "records"])
        || dataset.schemaVersion !== 1 || dataset.contract !== "dokkan-database-character-leader-supported-only-projection"
        || dataset.contractVersion !== "1.0.0" || dataset.mode !== "explicit_opt_in_offline_local_supported_only_default_off") failures.push("dataset contract rejected");
    const policy = dataset?.policy;
    if (!policy || !policy.supportedOnly || !policy.structuralIdsOnly || !policy.sourceOrderAndMultiplicityPreserved
        || policy.outputNamespaceThreatModel !== "caller_controlled_stable_during_operation"
        || policy.concurrentSameUserAncestorReplacementProtected !== false
        || Object.entries(policy).some(([key, value]) => ![
            "supportedOnly", "structuralIdsOnly", "sourceOrderAndMultiplicityPreserved", "outputNamespaceThreatModel",
        ].includes(key) && value !== false)) failures.push("policy boundary rejected");
    const conditionalIds = new Set(coverage?.excluded?.map(item => item.effectRowId) ?? []);
    const seenReferences = new Set<string>();
    let previousState = "", previousOccurrence = -1;
    if (!Array.isArray(dataset?.records)) failures.push("records rejected");
    else for (const record of dataset.records as any[]) {
        if (!exactKeys(record, ["stateId", "sourceStateKey", "cardId", "releaseState", "leaderSetRowId", "effectRowId", "sourceEffectOccurrenceIndex", "selector", "commonModifier", "stats", "calculation", "targetScope", "targetFilters", "targetFilterComposition"])) unsupportedOrExtraFieldCount++;
        if (conditionalIds.has(record?.effectRowId)) conditionalLeakageCount++;
        const key = `${record?.stateId}:${record?.sourceEffectOccurrenceIndex}`;
        if (seenReferences.has(key)) sourceOrderOrOccurrenceMismatchCount++; else seenReferences.add(key);
        if (typeof record?.stateId !== "string" || !record.stateId || typeof record.sourceStateKey !== "string" || !record.sourceStateKey
            || typeof record.cardId !== "string" || !record.cardId || !["initial", "eza", "seza"].includes(record.releaseState)
            || typeof record.leaderSetRowId !== "string" || !record.leaderSetRowId || typeof record.effectRowId !== "string" || !record.effectRowId
            || !Number.isSafeInteger(record.sourceEffectOccurrenceIndex) || record.sourceEffectOccurrenceIndex < 0
            || !exactKeys(record.selector, ["kind", "mask"]) || record.selector.kind !== "structural_mask" || !Number.isFinite(record.selector.mask)
            || !Number.isFinite(record.commonModifier) || JSON.stringify(record.stats) !== JSON.stringify(["hp", "atk", "def"])
            || !["team_allies", "super_class_allies", "extreme_class_allies"].includes(record.targetScope)
            || !exactKeys(record.targetFilterComposition, ["operator", "emptyBehavior", "duplicateBehavior"])
            || record.targetFilterComposition.operator !== "and_sequential" || record.targetFilterComposition.emptyBehavior !== "identity"
            || record.targetFilterComposition.duplicateBehavior !== "preserved_and_reapplied") unsupportedOrExtraFieldCount++;
        if (record?.calculation?.kind === "flat_points") {
            if (!exactKeys(record.calculation, ["kind", "value", "integerConversion"]) || !Number.isFinite(record.calculation.value)
                || record.calculation.integerConversion !== "at_handler") unsupportedOrExtraFieldCount++;
        } else if (record?.calculation?.kind === "proportional_percent_divided_by_100") {
            if (!exactKeys(record.calculation, ["kind", "numerator", "divisor"]) || !Number.isFinite(record.calculation.numerator)
                || record.calculation.divisor !== 100) unsupportedOrExtraFieldCount++;
        } else unsupportedOrExtraFieldCount++;
        if (!Array.isArray(record?.targetFilters)) unsupportedOrExtraFieldCount++;
        else record.targetFilters.forEach((filter: any, index: number) => {
            if (!exactKeys(filter, ["sourceTargetOccurrenceIndex", "operation", "selector", "categoryId"])
                || filter.sourceTargetOccurrenceIndex !== index || !["include", "exclude"].includes(filter.operation)
                || filter.selector !== "card_category_id" || typeof filter.categoryId !== "string" || !filter.categoryId) unsupportedOrExtraFieldCount++;
        });
        if (previousState && structuralOrder(previousState, record.stateId) > 0
            || previousState === record.stateId && record.sourceEffectOccurrenceIndex <= previousOccurrence) sourceOrderOrOccurrenceMismatchCount++;
        previousOccurrence = previousState === record.stateId ? record.sourceEffectOccurrenceIndex : record.sourceEffectOccurrenceIndex;
        previousState = record.stateId;
        const serialized = JSON.stringify(record);
        if (/execTimingType|causality|position2|description|primary|secondary|hybrid|deckIndex|fallback|aggregate|finalValue|text|label/i.test(serialized)) unknownMaterializedCount++;
    }
    if (dataset?.records?.length !== CHARACTER_LEADER_SUPPORTED_PROJECTION_PIN.projectedReferences
        || new Set(dataset?.records?.map(record => record.effectRowId)).size !== CHARACTER_LEADER_SUPPORTED_PROJECTION_PIN.projectedEffects) failures.push("projected corpus pin changed");
    if (!coverage || !exactKeys(coverage, [
        "schemaVersion", "contract", "contractVersion", "counts", "projected", "excluded", "corroborativeDomainRules",
        "partial", "unknown", "unjoinable", "shadowParity", "provenance",
    ]) || JSON.stringify(coverage.counts) !== JSON.stringify({ totalEffects: 3853, totalReferences: 12310, projectedEffects: 3836, projectedReferences: 12265, excludedEffects: 17, excludedReferences: 45 })
        || JSON.stringify(coverage.projected) !== JSON.stringify({ effects: 3836, references: 12265, classification: "supported" })
        || !Array.isArray(coverage.excluded) || coverage.excluded.length !== 17
        || JSON.stringify(coverage.excluded.map(item => item.effectRowId)) !== JSON.stringify(CHARACTER_LEADER_SUPPORTED_PROJECTION_PIN.conditionalEffectRowIds)
        || coverage.excluded.reduce((sum, item) => sum + item.affectedReferences.length, 0) !== 45
        || coverage.excluded.some(item => !exactKeys(item, ["effectRowId", "affectedReferences", "expression", "reason", "provenance", "corroborativeRule"])
            || item.affectedReferences.some(ref => !exactKeys(ref, ["stateId", "sourceEffectOccurrenceIndex"]))
            || item.reason !== "runtime_deck_index_unresolved"
            || !exactKeys(item.provenance, ["k52NativeEvidenceSha256", "k53NativeEvidenceSha256", "k54NativeEvidenceSha256"])
            || JSON.stringify(item.provenance) !== JSON.stringify({
                k52NativeEvidenceSha256: CHARACTER_LEADER_CAUSALITY_PIN.nativeEvidenceSha256,
                k53NativeEvidenceSha256: CHARACTER_LEADER_CAUSALITY_COLLECTION_PIN.nativeEvidenceSha256,
                k54NativeEvidenceSha256: CHARACTER_LEADER_CAUSALITY_DECK_INDEX_PIN.nativeEvidenceSha256,
            }) || !exactKeys(item.corroborativeRule, ["ruleId", "provenance", "usedToAuthorizeSupportedProjection"])
            || JSON.stringify(item.corroborativeRule) !== JSON.stringify({
                ruleId: CORROBORATIVE_DOMAIN_RULE.ruleId,
                provenance: CORROBORATIVE_DOMAIN_RULE.provenance,
                usedToAuthorizeSupportedProjection: false,
            }))
        || JSON.stringify(coverage.corroborativeDomainRules) !== JSON.stringify([CORROBORATIVE_DOMAIN_RULE])) failures.push("coverage pin changed");
    if (conditionalLeakageCount) failures.push("conditional effect leaked into payload");
    if (unsupportedOrExtraFieldCount) failures.push("unsupported or extra payload field");
    if (sourceOrderOrOccurrenceMismatchCount) failures.push("source order or occurrence changed");
    if (unknownMaterializedCount) failures.push("unknown field materialized");
    if (coverage?.shadowParity?.comparableValueReferences !== 0
        || coverage?.shadowParity?.representationMismatchComparableReferences !== 0
        || coverage?.shadowParity?.confirmedConflictComparableValues !== 0 || coverage?.shadowParity?.zeroConflictIsCompleteness !== false
        || coverage?.shadowParity?.authoritySelected !== false || coverage?.shadowParity?.comparisonMode !== "card_id_only_no_value_authority") failures.push("shadow parity authority boundary changed");
    if (sizes.rawSizeBytes >= CHARACTER_LEADER_SUPPORTED_PROJECTION_RAW_LIMIT_BYTES) failures.push("raw byte budget reached");
    if (sizes.gzipSizeBytes >= CHARACTER_LEADER_SUPPORTED_PROJECTION_GZIP_LIMIT_BYTES) failures.push("gzip byte budget reached");
    if (sizes.metadataSizeBytes >= CHARACTER_LEADER_SUPPORTED_PROJECTION_METADATA_LIMIT_BYTES) failures.push("metadata byte budget reached");
    const uniqueFailures = [...new Set(failures)].sort();
    return {
        schemaVersion: 1,
        contract: "dokkan-database-character-leader-supported-only-projection-validation",
        contractVersion: CHARACTER_LEADER_SUPPORTED_PROJECTION_CONTRACT_VERSION,
        valid: uniqueFailures.length === 0,
        failures: uniqueFailures,
        sizes: {
            ...sizes,
            rawMaximumBytesExclusive: CHARACTER_LEADER_SUPPORTED_PROJECTION_RAW_LIMIT_BYTES,
            gzipMaximumBytesExclusive: CHARACTER_LEADER_SUPPORTED_PROJECTION_GZIP_LIMIT_BYTES,
            metadataMaximumBytesExclusive: CHARACTER_LEADER_SUPPORTED_PROJECTION_METADATA_LIMIT_BYTES,
        },
        safety: {
            conditionalLeakageCount, unsupportedOrExtraFieldCount, sourceOrderOrOccurrenceMismatchCount,
            duplicateReferencesPreserved: true, unknownMaterializedCount, characterArrayRecordCount: 0, applyCount: 0,
            networkRequestCount: 0, automaticCleanupAttempted: false,
            outputNamespaceThreatModel: "caller_controlled_stable_during_operation",
            concurrentSameUserAncestorReplacementProtected: false,
        },
        readiness: {
            offlineSupportedOnlyProjection: uniqueFailures.length ? "NOT_EXECUTED" : "GO",
            sourceBoundValidation: "NOT_EXECUTED",
            localShadowAuditDefaultOff: "NOT_EXECUTED",
            conditional17: "NO-GO", deckFallback: "NO-GO", effectiveCombinedLeaderValue: "NO-GO", authority: "NO-GO",
            apply: "NO-GO", production: "NO-GO", publisher: "NO-GO", network: "NO-GO", r2: "NO-GO",
            android: "NO-GO", ui: "NO-GO", fyiRemoval: "NO-GO", combatCalculation: "NO-GO", dynamicInstrumentation: "NO-GO",
            concurrentOutputAncestorReplacement: "NO-GO",
        },
    };
}

export function materializeCharacterLeaderSupportedProjection(
    dataset: CharacterLeaderSupportedProjectionDataset,
    coverage: CharacterLeaderSupportedProjectionCoverage,
): CharacterLeaderSupportedProjectionArtifactSet {
    const raw = jsonBytes(dataset), gzip = gzipSync(raw, { level: 9 }), coverageBytes = jsonBytes(coverage), payloadSha256 = hash(gzip);
    let metadataSizeBytes = 0;
    for (let attempt = 0; attempt < 8; attempt++) {
        const validation = validateCharacterLeaderSupportedProjection(dataset, coverage, { rawSizeBytes: raw.length, gzipSizeBytes: gzip.length, metadataSizeBytes });
        if (!validation.valid) throw new Error(`K56 projection validation failed: ${validation.failures.join("; ")}`);
        const validationBytes = jsonBytes(validation);
        const manifest: CharacterLeaderSupportedProjectionManifest = {
            schemaVersion: 1,
            contract: "dokkan-database-character-leader-supported-only-projection-manifest",
            contractVersion: CHARACTER_LEADER_SUPPORTED_PROJECTION_CONTRACT_VERSION,
            fileName: `database-characters-k56-leader-supported-projection.${payloadSha256}.json.gz`,
            compression: "gzip",
            sha256: payloadSha256,
            sizeBytes: gzip.length,
            uncompressedSha256: hash(raw),
            uncompressedSizeBytes: raw.length,
            counts: coverage.counts,
            source: dataset.source,
            outputNamespaceThreatModel: "caller_controlled_stable_during_operation",
            concurrentSameUserAncestorReplacementProtected: false,
            coverageFile: CHARACTER_LEADER_SUPPORTED_PROJECTION_FILES.coverage,
            coverageSha256: hash(coverageBytes),
            coverageSizeBytes: coverageBytes.length,
            validationFile: CHARACTER_LEADER_SUPPORTED_PROJECTION_FILES.validation,
            validationSha256: hash(validationBytes),
            validationSizeBytes: validationBytes.length,
        };
        const manifestBytes = jsonBytes(manifest);
        const actual = coverageBytes.length + validationBytes.length + manifestBytes.length;
        if (actual >= CHARACTER_LEADER_SUPPORTED_PROJECTION_METADATA_LIMIT_BYTES) throw new Error(`K56 metadata byte budget reached: ${actual}`);
        if (actual === metadataSizeBytes) return { dataset, coverage, validation, manifest, raw, gzip, coverageBytes, validationBytes, manifestBytes };
        metadataSizeBytes = actual;
    }
    throw new Error("K56 metadata size did not converge");
}

export { assertConservativeK55 as assertConservativeK55ForSupportedProjection };
