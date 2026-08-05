import { basename } from "path";
import { dispatchSlots, NativeRuntimeElfInspection } from "./native-runtime-elf-adapter";
import { SqliteScalar } from "./contract";
import { DatabaseTeamAnalysisDb8Dataset } from "./team-analysis-db8-contract";
import { DatabaseTeamAnalysisDb9Coverage, DatabaseTeamAnalysisDb9Dataset, Db9DispatchSlot, Db9GapRuntimeEvidence, Db9NativeLayout } from "./team-analysis-db9-contract";

const LABELS: Record<string, string> = {
    "_ZN35AbilityEfficacyGuardElementCoefFunc24callChangeGuardBreakFuncEPN19AbilityEfficacyCore15CallChangeParamE": "guard_break",
    "_ZN39AbilityEfficacyStatusUpByEnergyBallFunc42callChangeEnergyBallProportionalAtkDefFuncEPN19AbilityEfficacyCore15CallChangeParamE": "ki_sphere_proportional_atk_def",
    "_ZN36AbilityEfficacyIncrementalStatusFunc30callChangeIncrementalParamFuncEPN19AbilityEfficacyCore15CallChangeParamE": "incremental_status",
    "_ZN25AbilityEfficacyRemoveFunc49removeAbilityEfficacyInfoAndInactiveAbilityStatusEPN19AbilityEfficacyCore15CallChangeParamE": "remove_efficacy_and_inactivate_status",
    "_ZN31AbilityEfficacyBadConditionFunc34callChangeConditionAttackBreakFuncEPN19AbilityEfficacyCore15CallChangeParamE": "attack_break_condition",
    "_ZN26AbilityEfficacyCounterFunc30callCounterAttackBehaviourFuncEPN19AbilityEfficacyCore15CallChangeParamE": "counterattack_behavior",
    "_ZN25AbilityEfficacyBattleFunc18callReversibleFuncEPN19AbilityEfficacyCore15CallChangeParamE": "reversible_battle_transition",
    "_ZN20AbilityCausalityFunc12isOverEnergyERKNSt6__ndk110shared_ptrI22AbilityStatusCausalityEERKNS1_I14SkillCausalityEE": "energy_over_threshold",
    "_ZN20AbilityCausalityFunc21isOverTeamCategoryNumERKNSt6__ndk110shared_ptrI22AbilityStatusCausalityEERKNS1_I14SkillCausalityEE": "team_category_count_over_threshold",
    "_ZN20AbilityCausalityFunc23isOverTeamUniqueCardNumERKNSt6__ndk110shared_ptrI22AbilityStatusCausalityEERKNS1_I14SkillCausalityEE": "team_unique_card_count_over_threshold",
    "_ZN20AbilityCausalityFunc14isDodgeSuccessERKNSt6__ndk110shared_ptrI22AbilityStatusCausalityEERKNS1_I14SkillCausalityEE": "dodge_success",
    "_ZN20AbilityCausalityFunc9isCountUpERKNSt6__ndk110shared_ptrI22AbilityStatusCausalityEERKNS1_I14SkillCausalityEE": "count_up",
    "_ZN20AbilityCausalityFunc27isContainsSpecifiedElementsERKNSt6__ndk110shared_ptrI22AbilityStatusCausalityEERKNS1_I14SkillCausalityEE": "contains_specified_elements",
    "_ZN20AbilityCausalityFunc30isUnderTurnCountFromAppearanceERKNSt6__ndk110shared_ptrI22AbilityStatusCausalityEERKNS1_I14SkillCausalityEE": "turns_from_appearance_under_threshold",
    "_ZN20AbilityCausalityFunc29isOverTurnCountFromAppearanceERKNSt6__ndk110shared_ptrI22AbilityStatusCausalityEERKNS1_I14SkillCausalityEE": "turns_from_appearance_over_threshold",
};

function decorate(values: ReturnType<typeof dispatchSlots>): Db9DispatchSlot[] { return values.map(value => ({ ...value, minimumOperationLabel: value.symbol ? LABELS[value.symbol] : undefined })); }
function parseEnumValue(value: SqliteScalar): number | undefined {
    if (value === null || typeof value === "string" && value.trim() === "") return undefined;
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined;
}
function gapEvidence(sourceEnumValue: SqliteScalar, count: number, states: number, slots: Db9DispatchSlot[], unresolvedFields: string[]): Db9GapRuntimeEvidence {
    const enumValue = parseEnumValue(sourceEnumValue);
    if (enumValue === undefined) return { sourceEnumValue, occurrenceCount: count, affectedStateCount: states, identityStatus: "invalid_value", unresolvedFields };
    const slot = slots[enumValue];
    if (!slot) return { sourceEnumValue, enumValue, occurrenceCount: count, affectedStateCount: states, identityStatus: "out_of_range", unresolvedFields };
    if (slot.status === "null") return { sourceEnumValue, enumValue, occurrenceCount: count, affectedStateCount: states, identityStatus: "unsupported_null", slotVma: slot.slotVma, unresolvedFields };
    return { sourceEnumValue, enumValue, occurrenceCount: count, affectedStateCount: states, identityStatus: "runtime_identified", slotVma: slot.slotVma, symbol: slot.symbol, symbolAddress: slot.symbolAddress, minimumOperationLabel: slot.minimumOperationLabel, unresolvedFields };
}

export function buildDatabaseTeamAnalysisDb9Dataset(options: { db8: DatabaseTeamAnalysisDb8Dataset, db8Sha256: string, inspection: NativeRuntimeElfInspection, layout: Db9NativeLayout, layoutSha256: string, nativePath: string, nativeSizeBytes: number, nativeSha256: string }): DatabaseTeamAnalysisDb9Dataset {
    const efficacySlots = decorate(dispatchSlots(options.inspection, options.layout.tables.efficacy.baseVma, options.layout.tables.efficacy.slotCount));
    const causalitySlots = decorate(dispatchSlots(options.inspection, options.layout.tables.causality.baseVma, options.layout.tables.causality.slotCount));
    const efficacyGapEvidence = options.db8.efficacyGaps.map(value => gapEvidence(value.efficacyType, value.ruleCount, value.affectedStateCount, efficacySlots, ["eff_value_semantics", "target", "timing", "stacking", "calculation_bucket"]));
    const causalityGapEvidence = options.db8.causalityGaps.map(value => gapEvidence(value.causalityType, value.occurrenceCount, value.affectedStateCount, causalitySlots, ["cau_val_semantics", "scope", "comparator"]));
    return { schemaVersion: 1, contract: "dokkan-team-analysis-native-runtime-evidence-experiment", contractVersion: "0.8.0", generatedAt: options.db8.generatedAt,
        sourceDb8ContractVersion: "0.7.0", sourceSnapshotVersion: options.db8.sourceSnapshotVersion, sourceDatabaseSha256: options.db8.sourceSha256,
        sourceDb8: { fileName: "team-analysis-db8-evidence-experiment.json.gz", sha256: options.db8Sha256 }, nativeRuntimeLayout: { fileName: "native-runtime-layout.json", sha256: options.layoutSha256 },
        nativeRuntime: { fileName: basename(options.nativePath), sizeBytes: options.nativeSizeBytes, sha256: options.nativeSha256, elfClass: options.inspection.elfClass, endian: options.inspection.endian, machine: options.inspection.machine }, semanticPromotionCount: 0,
        runtimeIdentityResolutionCount: [...efficacyGapEvidence, ...causalityGapEvidence].filter(value => value.identityStatus === "runtime_identified").length,
        efficacyDispatchSlots: efficacySlots, causalityDispatchSlots: causalitySlots, efficacyGapEvidence, causalityGapEvidence };
}

export function buildDatabaseTeamAnalysisDb9Coverage(dataset: DatabaseTeamAnalysisDb9Dataset): DatabaseTeamAnalysisDb9Coverage {
    const counts = (values: Db9GapRuntimeEvidence[]) => ({ total: values.length, identified: values.filter(value => value.identityStatus === "runtime_identified").length, null: values.filter(value => value.identityStatus === "unsupported_null").length, outOfRange: values.filter(value => value.identityStatus === "out_of_range").length, invalid: values.filter(value => value.identityStatus === "invalid_value").length });
    const efficacy = counts(dataset.efficacyGapEvidence); const causality = counts(dataset.causalityGapEvidence);
    const efficacyTotal = dataset.efficacyGapEvidence.reduce((sum, value) => sum + value.occurrenceCount, 0); const efficacyIdentified = dataset.efficacyGapEvidence.filter(value => value.identityStatus === "runtime_identified").reduce((sum, value) => sum + value.occurrenceCount, 0);
    const causalityTotal = dataset.causalityGapEvidence.reduce((sum, value) => sum + value.occurrenceCount, 0); const causalityIdentified = dataset.causalityGapEvidence.filter(value => value.identityStatus === "runtime_identified").reduce((sum, value) => sum + value.occurrenceCount, 0);
    return { schemaVersion: 1, semanticPromotionCount: 0, efficacyGapTypes: efficacy, efficacyGapRules: { total: efficacyTotal, identified: efficacyIdentified, unresolved: efficacyTotal - efficacyIdentified }, causalityGapTypes: causality, causalityGapOccurrences: { total: causalityTotal, identified: causalityIdentified, unresolved: causalityTotal - causalityIdentified } };
}
