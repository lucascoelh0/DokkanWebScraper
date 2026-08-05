import { createHash } from "crypto";
import {
    Character,
    EffectStructuralEvidence,
    EffectStructuralSource,
    PassiveConditionEvidence,
    PassiveDetails,
    SuperAttackDetails,
    Transformation,
    UnitSuperAttack,
} from "./character";
import { FyiCharacterCatalogEntry } from "./fyi-character-catalog";
import {
    ChanceSemantic,
    QualitativeChanceTerm,
    validatedChancePercent,
} from "./team-analysis-chance-lexicon";
import { resolveFirstPartyProbability } from "./team-analysis-first-party-probabilities";

export const TEAM_ANALYSIS_SCHEMA_VERSION = 1;
export const TEAM_ANALYSIS_RULES_VERSION = "1";
export const TEAM_ANALYSIS_PARSER_VERSION = "1.7.1";
export const SUPER_ATTACK_STAT_RAISE_DOMAIN_RULE_VERSION = "sa-stat-raise-lifecycle-v1";

export type ParseStatus = "supported" | "partial" | "unknown";
export type ReleaseState = "initial" | "eza" | "seza";
export type SelfInclusion = "included" | "excluded" | "unknown";
export type PassiveEffectClassification = "support";
export type TeamAnalysisClass = "Super" | "Extreme";
export type TeamAnalysisType = "AGL" | "TEQ" | "INT" | "STR" | "PHY";
export type ConcreteKiSphereType = TeamAnalysisType | "rainbow";
export type KiSphereType = ConcreteKiSphereType | "non_rainbow" | "any";
export type KiContext = "final_attack_ki" | "collected_ki_spheres" | "board_state";
export type PassiveEvaluationMoment =
    | "start_of_turn"
    | "entry_turn"
    | "end_of_turn"
    | "before_attack"
    | "when_attacking";
export type EnemySelection =
    | "any_enemy"
    | "all_enemies"
    | "current_target"
    | "only_enemy"
    | "unknown";
export type EnemyStatus = "atk_down" | "def_down" | "stunned" | "super_attack_sealed";
export type EnemyNameMatch = "exact" | "includes";
export type EnemyReference = "that_enemy";
export type ProbabilitySource =
    | "explicit_text"
    | "first_party_game_db"
    | "qualitative_lexicon"
    | "unresolved";
export type CalculationPhaseResolutionSource =
    | "explicit_text"
    | "first_party_game_db"
    | "documented_domain_rule"
    | "dokkan_fyi_structural_marker"
    | "unresolved";
export type EffectApplicationTriggerKind = "per_super_attack" | "per_combat_event" | "entry" | "unknown";
export type EffectStackingScope = "current_turn" | "active_windows" | "battle" | "unknown";

export interface EffectDecisionProvenance {
    source: CalculationPhaseResolutionSource,
    evidenceId?: string,
    ruleVersion?: string,
}

export interface EffectActivationLimit {
    kind: "once" | "count" | "unknown",
    count?: number,
    source: CalculationPhaseResolutionSource,
    provenance: EffectDecisionProvenance,
}

export interface EffectApplicationTrigger {
    kind: EffectApplicationTriggerKind,
    source: CalculationPhaseResolutionSource,
    provenance: EffectDecisionProvenance,
}
export type PassiveActivationMoment =
    | "start_of_turn"
    | "before_attacking"
    | "when_attacking"
    | "when_performing_super_attack"
    | "before_incoming_attack"
    | "when_targeted_by_attack"
    | "when_attack_landed"
    | "after_incoming_attack_resolved"
    | "after_attacking"
    | "after_attack_landed"
    | "when_evading"
    | "after_evading"
    | "after_final_blow"
    | "unresolved";
export type PassiveCalculationBucket =
    | "passive_start_of_turn"
    | "passive_on_attack"
    | "unresolved";

export type SuperAttackVariant = "normal" | "ultra" | "extra" | "unit";
export type SuperAttackEffectKind =
    | "atk_raise"
    | "def_raise"
    | "enemy_atk_lowering"
    | "enemy_def_lowering"
    | "stun"
    | "super_attack_seal";
export type SuperAttackEffectMagnitude =
    | "raise"
    | "greatly_raise"
    | "massively_raise"
    | "lower"
    | "greatly_lower"
    | "massively_lower";
export type SuperAttackChanceTerm = QualitativeChanceTerm | "may";
export type SuperAttackActivationMoment = "when_super_attack_effect_resolves" | "unresolved";
export type SuperAttackCalculationBucket =
    | "super_attack_raise"
    | "super_attack_enemy_stat_lowering"
    | "unresolved";

export type CombatEventType =
    | "attack_performed"
    | "incoming_attack"
    | "attack_landed"
    | "attack_evaded"
    | "final_blow_delivered";
export type CombatEventActor = "self" | "enemy";
export type CombatAttackKind = "normal_attack" | "super_attack" | "unknown";
export type CombatAttackStyle = "ki_blast" | "unarmed" | "physical" | "unknown";
export type CombatEventMode = "current_event" | "accumulated_count" | "per_event";
export type CombatEventCountScope = "current_turn" | "battle" | "unknown";
export type CombatEventRelativeTiming = "before_event" | "during_event" | "after_event" | "unknown";

export interface CombatEventProvenance {
    eventType: CalculationPhaseResolutionSource,
    actor: CalculationPhaseResolutionSource,
    attackKind: CalculationPhaseResolutionSource,
    attackStyle?: CalculationPhaseResolutionSource,
    mode: CalculationPhaseResolutionSource,
    countScope?: CalculationPhaseResolutionSource,
    relativeTiming: CalculationPhaseResolutionSource,
}

export interface CombatEventDescriptor {
    eventType: CombatEventType,
    actor: CombatEventActor,
    attackKind: CombatAttackKind,
    attackStyle?: CombatAttackStyle,
    mode: CombatEventMode,
    countScope?: CombatEventCountScope,
    relativeTiming: CombatEventRelativeTiming,
    provenance: CombatEventProvenance,
}

export type PassivePredicateKind =
    | "ally_category_present"
    | "ally_name_present"
    | "ally_class_present"
    | "ally_type_present"
    | "ally_class_type_present"
    | "ally_category_class_present"
    | "team_category_count"
    | "team_class_count"
    | "team_type_count"
    | "all_rotation_allies_category"
    | "all_rotation_allies_class"
    | "character_class"
    | "character_type"
    | "rotation_partner_category"
    | "rotation_partner_name"
    | "rotation_partner_link_present"
    | "character_is_leader"
    | "character_is_friend"
    | "battle_slot"
    | "rotation_assignment"
    | "rotation_partner_present"
    | "floater_assignment"
    | "hp_percent"
    | "battle_turn"
    | "turn_from_entry"
    /** @deprecated Never emitted; use battle_turn. */
    | "turn_number"
    /** @deprecated Never emitted; use turn_from_entry. */
    | "turns_from_entry"
    | "enemy_count"
    | "enemy_category"
    | "enemy_name"
    | "enemy_class"
    | "enemy_type"
    | "enemy_class_type"
    | "enemy_hp_percent"
    | "enemy_status"
    | "domain_active"
    | "standby_active"
    | "active_skill_used"
    | "revive_triggered"
    | "ki_amount"
    | "ki_spheres_obtained"
    | "ki_sphere_type_obtained"
    | "incoming_attack"
    | "incoming_super_attack"
    | "attacks_performed"
    | "attacks_received"
    | "attacks_evaded"
    | "super_attacks_performed"
    | "super_attack_received"
    | "final_blow_delivered"
    | "chance_roll"
    | "unknown";

export type PassiveEffectKind =
    | "ki"
    | "hp"
    | "atk"
    | "def"
    | "damage_reduction"
    | "guard"
    | "evade_chance"
    | "critical_chance"
    | "additional_attack"
    | "additional_super_attack"
    | "effective_against_all_types"
    | "super_attack_seal"
    | "stun_chance"
    | "enemy_atk_down"
    | "enemy_def_down"
    | "ki_sphere_change"
    | "scouter"
    | "revive"
    | "domain"
    | "unknown";

export interface TeamAnalysisDataset {
    schemaVersion: number,
    rulesVersion: string,
    parserVersion: string,
    generatedAt: string,
    sourceCharacterDatasetVersion: string,
    sourceCharacterPayloadSha256: string,
    stateCount: number,
    supportedRuleCount: number,
    partialRuleCount: number,
    unknownRuleCount: number,
    states: CharacterStateAnalysis[],
}

export interface CharacterStateAnalysis {
    stateKey: string,
    characterId: string,
    canonicalId?: string,
    gameCharacterId?: string,
    baseCharacterId?: string,
    hardDuplicateGroupId: string,
    variantGroupId?: string,
    awakeningFamilyId?: string,
    formId: string,
    releaseState: ReleaseState,
    displayName: string,
    passive?: ParsedPassive,
    superAttacks?: ParsedSuperAttack[],
}

export interface ParsedSuperAttack {
    id: string,
    variant: SuperAttackVariant,
    ordinal: number,
    name?: string,
    ki?: number,
    attackType?: string,
    style?: string,
    effectOrigin: "super_attack",
    rawText: string,
    condition: ParsedSuperAttackCondition,
    effects: SuperAttackEffect[],
    effectStatus: ParseStatus,
    parseStatus: ParseStatus,
    sourceFragments: SourceFragment[],
    unparsedFragments: SourceFragment[],
    structuralEvidence?: EffectStructuralEvidence[],
}

export interface ParsedSuperAttackCondition {
    rawText: string,
    expression: ConditionExpression,
    parseStatus: ParseStatus,
    sourceFragments: SourceFragment[],
    unparsedFragments: SourceFragment[],
}

export interface SuperAttackEffect {
    kind: SuperAttackEffectKind,
    origin: "super_attack",
    target: SuperAttackEffectTarget,
    magnitude?: SuperAttackEffectMagnitude,
    value?: number,
    unit?: "percent",
    activationChancePercent?: number,
    qualitativeChanceTerm?: SuperAttackChanceTerm,
    probabilitySource?: ProbabilitySource,
    duration: SuperAttackEffectDuration,
    stacking?: SuperAttackEffectStacking,
    activationLimit?: EffectActivationLimit,
    applicationTrigger?: EffectApplicationTrigger,
    activationTiming: SuperAttackActivationTiming,
    calculationBucket?: SuperAttackCalculationBucketAssignment,
    parseStatus: ParseStatus,
    sourceText: string,
    source: SourceFragment[],
}

export interface SuperAttackEffectTarget {
    scope: "self" | "allies" | "current_target" | "all_enemies" | "unknown",
    selfInclusion?: SelfInclusion,
}

export interface SuperAttackEffectDuration {
    kind: "current_turn" | "turns" | "permanent" | "unknown",
    turns?: number,
    source: CalculationPhaseResolutionSource,
    provenance?: EffectDecisionProvenance,
}

export interface SuperAttackEffectStacking {
    kind: "stackable" | "not_stackable" | "unknown",
    capPercent?: number,
    source: CalculationPhaseResolutionSource,
    capSource?: CalculationPhaseResolutionSource,
    scope?: EffectStackingScope,
    provenance?: EffectDecisionProvenance,
}

export interface SuperAttackActivationTiming {
    moment: SuperAttackActivationMoment,
    source: CalculationPhaseResolutionSource,
}

export interface SuperAttackCalculationBucketAssignment {
    bucket: SuperAttackCalculationBucket,
    source: CalculationPhaseResolutionSource,
}

export interface ParsedPassive {
    name?: string,
    rawText: string,
    parseStatus: ParseStatus,
    rules: PassiveRule[],
    unparsedFragments: SourceFragment[],
    conditionEvidence?: PassiveConditionEvidence[],
    structuralEvidence?: EffectStructuralEvidence[],
}

export interface PassiveRule {
    id: string,
    condition: ConditionExpression,
    conditionStatus: ParseStatus,
    effects: PassiveEffect[],
    effectStatus: ParseStatus,
    source: SourceFragment[],
    parseStatus: ParseStatus,
    confidence: "high" | "medium" | "low",
}

export interface SourceFragment {
    lineIndex: number,
    text: string,
    start?: number,
    end?: number,
}

export interface MappedPassiveText {
    text: string,
    source: SourceFragment[],
    mapped: boolean,
}

export interface MappedPassiveSection {
    label?: MappedPassiveText,
    lines: MappedPassiveText[],
}

export interface PassiveSourceMap {
    rawText: string,
    sourceFragments: SourceFragment[],
    lines: MappedPassiveText[],
    sections: MappedPassiveSection[],
    unmappedTexts: string[],
}

export type ConditionExpression =
    | { op: "always" }
    | { op: "all", children: ConditionExpression[] }
    | { op: "any", children: ConditionExpression[] }
    | { op: "not", child: ConditionExpression }
    | { op: "predicate", predicate: PassivePredicate }
    | { op: "unknown", sourceText: string };

export interface PassivePredicate {
    kind: PassivePredicateKind,
    scope: "self" | "rotation" | "team" | "enemy" | "battle",
    selfInclusion?: SelfInclusion,
    comparator?: "eq" | "neq" | "lt" | "lte" | "gt" | "gte" | "between",
    value?: number,
    maxValue?: number,
    count?: number,
    categories?: string[],
    names?: string[],
    classes?: TeamAnalysisClass[],
    types?: TeamAnalysisType[],
    slots?: number[],
    kiSphereTypes?: KiSphereType[],
    kiContext?: KiContext,
    evaluationMoment?: PassiveEvaluationMoment,
    enemySelection?: EnemySelection,
    enemyStatuses?: EnemyStatus[],
    nameMatch?: EnemyNameMatch,
    excludedNames?: string[],
    excludedNameMatch?: EnemyNameMatch,
    enemyReference?: EnemyReference,
    combatEvent?: CombatEventDescriptor,
    sourceText: string,
}

export interface PassiveEffect {
    kind: PassiveEffectKind,
    target: PassiveTarget,
    value?: number,
    unit?: "percent" | "flat" | "ki" | "count" | "boolean",
    count?: number,
    activationChancePercent?: number,
    additionalToSuperChancePercent?: number,
    /** @deprecated Compatibility alias for activationChancePercent. */
    chancePercent?: number,
    qualitativeChanceTerm?: QualitativeChanceTerm,
    probabilitySource?: ProbabilitySource,
    additionalToSuperQualitativeChanceTerm?: QualitativeChanceTerm,
    additionalToSuperProbabilitySource?: ProbabilitySource,
    perStack?: number,
    stackCap?: number,
    scaling?: PassiveEffectScaling,
    kiSphereChange?: KiSphereChange,
    duration?: PassiveDuration,
    stacking?: SuperAttackEffectStacking,
    activationLimit?: EffectActivationLimit,
    applicationTrigger?: EffectApplicationTrigger,
    categories?: string[],
    names?: string[],
    classes?: TeamAnalysisClass[],
    types?: TeamAnalysisType[],
    classifications?: PassiveEffectClassification[],
    activationTiming?: PassiveActivationTiming,
    calculationBucket?: PassiveCalculationBucketAssignment,
    sourceText: string,
}

export interface PassiveActivationTiming {
    moment: PassiveActivationMoment,
    source: CalculationPhaseResolutionSource,
}

export interface PassiveCalculationBucketAssignment {
    bucket: PassiveCalculationBucket,
    source: CalculationPhaseResolutionSource,
}

export interface KiSphereEffectScaling {
    kind: "per_ki_sphere",
    kiSphereTypes: KiSphereType[],
    spheresPerIncrement: number,
    kiContext: "collected_ki_spheres",
}

export interface CombatEventEffectScaling {
    kind: "per_combat_event",
    connector: "single" | "and" | "or",
    eventsPerIncrement: number,
    events: CombatEventDescriptor[],
}

export type PassiveEffectScaling = KiSphereEffectScaling | CombatEventEffectScaling;

export interface KiSphereChange {
    sourceSelection: "listed_types" | "all" | "random_type",
    sourceTypes?: ConcreteKiSphereType[],
    excludedSourceTypes?: TeamAnalysisType[],
    destinationType: ConcreteKiSphereType,
    kiContext: "board_state",
}

export interface PassiveTarget {
    scope:
        | "self"
        | "rotation_allies"
        | "team_allies"
        | "category_allies"
        | "class_allies"
        | "type_allies"
        | "class_type_allies"
        | "enemy"
        | "all_enemies"
        | "unknown",
    selfInclusion?: SelfInclusion,
}

export interface PassiveDuration {
    kind: "instant" | "within_turn" | "turns" | "battle" | "until_trigger" | "unknown",
    turns?: number,
    source?: CalculationPhaseResolutionSource,
    provenance?: EffectDecisionProvenance,
}

export interface TeamAnalysisCoverageReport {
    generatedAt: string,
    sourceCharacterDatasetVersion: string,
    sourceCharacterPayloadSha256: string,
    sourceStateCount: number,
    passiveStateCount: number,
    passiveStatusCounts: Record<ParseStatus, number>,
    parsedRuleCount: number,
    ruleStatusCounts: Record<ParseStatus, number>,
    conditionStatusCounts: Record<ParseStatus, number>,
    effectStatusCounts: Record<ParseStatus, number>,
    conditionCounts: {
        always: number,
        predicate: number,
        unknown: number,
        composite: number,
    },
    supportedPredicateCounts: Record<string, number>,
    supportedEffectCounts: Record<string, number>,
    derivedSupportEffectCount: number,
    unknownEffectCount: number,
    unresolvedProbabilityEffectCount: number,
    probabilitySourceCounts: Record<ProbabilitySource, number>,
    unknownFragmentCount: number,
    teamEvaluableRuleCount: number,
    placementEvaluableRuleCount: number,
    scenarioRuleCount: number,
    scenarioEvaluableRuleCount: number,
    enemySelectionCounts: Record<string, number>,
    enemyStatusEvidence: {
        stateCount: number,
        evidenceCount: number,
        fullyRecoveredStateCount: number,
        partialStateCount: number,
        unresolvedStateCount: number,
        resolutionCounts: Record<"supported" | "partial" | "unresolved", number>,
        statusCounts: Record<string, number>,
        sourceCounts: Record<string, number>,
    },
    structuralEvidence: {
        evidenceCount: number,
        passiveEvidenceCount: number,
        superAttackEvidenceCount: number,
        markerCounts: Record<string, number>,
        resolutionCounts: Record<string, number>,
        superAttackVariantCounts: Record<string, number>,
        divergentCorroborationCount: number,
        semanticConflictCount: number,
    },
    lifecycle: {
        activationLimitKindCounts: Record<string, number>,
        applicationTriggerKindCounts: Record<string, number>,
        durationSourceCounts: Record<string, number>,
        stackingScopeCounts: Record<string, number>,
    },
    kiAnalysis: {
        predicateContextCounts: Record<string, number>,
        sphereTypePredicateCounts: Record<string, number>,
        scaledEffectCount: number,
        scaledEffectSphereTypeCounts: Record<string, number>,
        conversionSourceSelectionCounts: Record<string, number>,
        conversionDestinationTypeCounts: Record<string, number>,
    },
    calculationPhase: {
        activationEligibleEffectCount: number,
        activationMomentCounts: Record<PassiveActivationMoment, number>,
        activationSourceCounts: Record<CalculationPhaseResolutionSource, number>,
        bucketEligibleEffectCount: number,
        bucketCounts: Record<PassiveCalculationBucket, number>,
        bucketSourceCounts: Record<CalculationPhaseResolutionSource, number>,
    },
    combatEvents: {
        predicateCount: number,
        scaledEffectCount: number,
        currentEventRuleCount: number,
        historyRuleCount: number,
        predicateKindCounts: Record<string, number>,
        eventTypeCounts: Record<string, number>,
        attackKindCounts: Record<string, number>,
        attackStyleCounts: Record<string, number>,
        modeCounts: Record<string, number>,
        countScopeCounts: Record<string, number>,
        relativeTimingCounts: Record<string, number>,
    },
    superAttacks: {
        attackCount: number,
        attackStatusCounts: Record<ParseStatus, number>,
        conditionStatusCounts: Record<ParseStatus, number>,
        effectStatusCounts: Record<ParseStatus, number>,
        typedEffectCount: number,
        numericStatEffectCount: number,
        effectKindCounts: Record<string, number>,
        targetScopeCounts: Record<string, number>,
        durationKindCounts: Record<string, number>,
        stackingKindCounts: Record<string, number>,
        cappedStackingEffectCount: number,
        probabilitySourceCounts: Record<ProbabilitySource, number>,
        qualitativeChanceTermCounts: Record<string, number>,
        numericProbabilityEffectCount: number,
        calculationBucketCounts: Record<string, number>,
        unparsedFragmentCount: number,
    },
    runtimeOnlyRuleCount: number,
    identity: {
        variantGroupAssignedStateCount: number,
        variantGroupOmittedStateCount: number,
        awakeningFamilyAssignedStateCount: number,
    },
}

export interface TeamAnalysisValidationIssue {
    code: string,
    message: string,
    stateKey?: string,
    ruleId?: string,
}

interface AnalysisFormSource {
    id: string,
    name: string,
    passive: string,
    passiveDetails?: PassiveDetails,
    ezaPassive?: string,
    ezaPassiveDetails?: PassiveDetails,
    sezaPassive?: string,
    superAttack?: string,
    ezaSuperAttack?: string,
    ultraSuperAttack?: string,
    ezaUltraSuperAttack?: string,
    exSuperAttack?: string,
    ezaExSuperAttack?: string,
    superAttackDetails?: SuperAttackDetails,
    ezaSuperAttackDetails?: SuperAttackDetails,
    ultraSuperAttackDetails?: SuperAttackDetails,
    ezaUltraSuperAttackDetails?: SuperAttackDetails,
    exSuperAttackDetails?: SuperAttackDetails,
    ezaExSuperAttackDetails?: SuperAttackDetails,
    unitSuperAttacks?: UnitSuperAttack[],
    ezaReleaseDate?: string,
    sezaReleaseDate?: string,
}

interface AnalysisReleaseSource {
    releaseState: ReleaseState,
    passiveText: string,
    passiveName?: string,
    passiveDetails?: PassiveDetails,
}

export interface AnalysisSuperAttackSource {
    variant: SuperAttackVariant,
    ordinal: number,
    name?: string,
    ki?: number,
    attackType?: string,
    style?: string,
    effectText: string,
    conditionText: string,
    structuralSource?: EffectStructuralSource,
    sourceAttackId?: string,
}

interface ResolvedIdentity {
    characterId: string,
    canonicalId?: string,
    gameCharacterId?: string,
    baseCharacterId?: string,
    hardDuplicateGroupId: string,
    variantGroupId?: string,
    awakeningFamilyId?: string,
    formId: string,
    releaseState: ReleaseState,
}

export function buildStateKey(characterId: string, formId: string, releaseState: ReleaseState): string {
    return `${characterId}:${formId}:${releaseState}`;
}

export function buildHardDuplicateGroupId(characterId: string): string {
    return `card:${characterId}`;
}

export function buildVariantGroupId(canonicalId: string): string {
    return `canonical:${canonicalId}`;
}

export function buildAwakeningFamilyId(baseCharacterId: string): string {
    return `awakening:${baseCharacterId}`;
}

export function releaseStateFromForm(form: Pick<AnalysisFormSource, "ezaReleaseDate" | "sezaReleaseDate">): ReleaseState {
    if (form.sezaReleaseDate) {
        return "seza";
    }
    if (form.ezaReleaseDate) {
        return "eza";
    }
    return "initial";
}

export function buildTeamAnalysisDataset(
    characters: Character[],
    catalogEntries: FyiCharacterCatalogEntry[],
    options: {
        generatedAt: string,
        sourceCharacterDatasetVersion: string,
        sourceCharacterPayloadSha256: string,
        rulesVersion?: string,
        parserVersion?: string,
    },
): TeamAnalysisDataset {
    const catalogById = new Map(catalogEntries.map(entry => [entry.id, entry]));
    const states = characters
        .flatMap(character => buildCharacterStates(character, catalogById.get(character.id)))
        .sort(compareAnalysisStates);
    const ruleCounts = countRuleStatuses(states);

    return {
        schemaVersion: TEAM_ANALYSIS_SCHEMA_VERSION,
        rulesVersion: options.rulesVersion ?? TEAM_ANALYSIS_RULES_VERSION,
        parserVersion: options.parserVersion ?? TEAM_ANALYSIS_PARSER_VERSION,
        generatedAt: options.generatedAt,
        sourceCharacterDatasetVersion: options.sourceCharacterDatasetVersion,
        sourceCharacterPayloadSha256: options.sourceCharacterPayloadSha256,
        stateCount: states.length,
        supportedRuleCount: ruleCounts.supported,
        partialRuleCount: ruleCounts.partial,
        unknownRuleCount: ruleCounts.unknown,
        states,
    };
}

function buildCharacterStates(
    character: Character,
    catalogEntry: FyiCharacterCatalogEntry | undefined,
): CharacterStateAnalysis[] {
    const rootForm: AnalysisFormSource = character;
    const forms: AnalysisFormSource[] = [rootForm, ...(character.transformations ?? [])];

    return forms.flatMap(form => {
        const releaseSources = analysisReleaseSources(form);
        return releaseSources.map(releaseSource => {
        const identity = resolveIdentity(character, form, catalogEntry, releaseSource.releaseState);
        const stateKey = buildStateKey(identity.characterId, identity.formId, identity.releaseState);
        const passive = releaseSource.passiveText
            ? parsePassive(
                stateKey,
                releaseSource.passiveName,
                releaseSource.passiveText,
                releaseSource.passiveDetails,
                {
                    characterId: identity.characterId,
                    formId: identity.formId,
                    releaseState: identity.releaseState,
                },
            )
            : undefined;
        const superAttacks = analysisSuperAttackSources(
            form,
            releaseSource.releaseState,
            releaseSources.length === 1,
        ).map(source => parseSuperAttack(stateKey, source));

        return {
            stateKey,
            characterId: identity.characterId,
            ...(identity.canonicalId ? { canonicalId: identity.canonicalId } : {}),
            ...(identity.gameCharacterId ? { gameCharacterId: identity.gameCharacterId } : {}),
            ...(identity.baseCharacterId ? { baseCharacterId: identity.baseCharacterId } : {}),
            hardDuplicateGroupId: identity.hardDuplicateGroupId,
            ...(identity.variantGroupId ? { variantGroupId: identity.variantGroupId } : {}),
            ...(identity.awakeningFamilyId ? { awakeningFamilyId: identity.awakeningFamilyId } : {}),
            formId: identity.formId,
            releaseState: identity.releaseState,
            displayName: form.name,
            ...(passive ? { passive } : {}),
            ...(superAttacks.length > 0 ? { superAttacks } : {}),
        };
        });
    });
}

function resolveIdentity(
    character: Character,
    form: AnalysisFormSource,
    catalogEntry: FyiCharacterCatalogEntry | undefined,
    releaseState = releaseStateFromForm(form),
): ResolvedIdentity {
    const canonicalId = catalogEntry?.canonicalId;
    const baseCharacterId = catalogEntry?.baseCharacterId;
    return {
        characterId: character.id,
        canonicalId,
        gameCharacterId: catalogEntry?.characterId,
        baseCharacterId,
        hardDuplicateGroupId: buildHardDuplicateGroupId(character.id),
        variantGroupId: canonicalId ? buildVariantGroupId(canonicalId) : undefined,
        awakeningFamilyId: baseCharacterId ? buildAwakeningFamilyId(baseCharacterId) : undefined,
        formId: form.id,
        releaseState,
    };
}

function analysisReleaseSources(form: AnalysisFormSource): AnalysisReleaseSource[] {
    const initialPassiveText = form.passiveDetails?.text ?? form.passive;
    const ezaPassiveText = form.ezaPassiveDetails?.text ?? form.ezaPassive ?? "";
    const sezaPassiveText = form.sezaPassive ?? "";
    if (!ezaPassiveText && !sezaPassiveText) {
        return [{
            releaseState: releaseStateFromForm(form),
            passiveText: initialPassiveText,
            passiveName: form.passiveDetails?.name,
            passiveDetails: form.passiveDetails,
        }];
    }

    const releases: AnalysisReleaseSource[] = [{
        releaseState: "initial",
        passiveText: initialPassiveText,
        passiveName: form.passiveDetails?.name,
        passiveDetails: form.passiveDetails,
    }];
    if (ezaPassiveText) {
        releases.push({
            releaseState: "eza",
            passiveText: ezaPassiveText,
            passiveName: form.ezaPassiveDetails?.name,
            passiveDetails: form.ezaPassiveDetails,
        });
    }
    if (sezaPassiveText) {
        releases.push({
            releaseState: "seza",
            passiveText: sezaPassiveText,
        });
    }
    return releases;
}

function analysisSuperAttackSources(
    form: AnalysisFormSource,
    releaseState: ReleaseState,
    singleReleaseState: boolean,
): AnalysisSuperAttackSource[] {
    const useBaseFields = releaseState === "initial" || singleReleaseState;
    const slots: Array<{
        variant: Exclude<SuperAttackVariant, "unit">,
        baseText?: string,
        ezaText?: string,
        baseDetails?: SuperAttackDetails,
        ezaDetails?: SuperAttackDetails,
    }> = [
        {
            variant: "normal",
            baseText: form.superAttack,
            ezaText: form.ezaSuperAttack,
            baseDetails: form.superAttackDetails,
            ezaDetails: form.ezaSuperAttackDetails,
        },
        {
            variant: "ultra",
            baseText: form.ultraSuperAttack,
            ezaText: form.ezaUltraSuperAttack,
            baseDetails: form.ultraSuperAttackDetails,
            ezaDetails: form.ezaUltraSuperAttackDetails,
        },
        {
            variant: "extra",
            baseText: form.exSuperAttack,
            ezaText: form.ezaExSuperAttack,
            baseDetails: form.exSuperAttackDetails,
            ezaDetails: form.ezaExSuperAttackDetails,
        },
    ];
    const attacks: AnalysisSuperAttackSource[] = [];

    for (const slot of slots) {
        const details = releaseState === "eza"
            ? slot.ezaDetails ?? (singleReleaseState ? slot.baseDetails : undefined)
            : useBaseFields
                ? slot.baseDetails
                : undefined;
        const fallbackText = releaseState === "eza"
            ? slot.ezaText ?? (singleReleaseState ? slot.baseText : undefined)
            : useBaseFields
                ? slot.baseText
                : undefined;
        const effectText = details?.effect ?? fallbackText ?? "";
        if (!effectText) {
            continue;
        }
        attacks.push({
            variant: slot.variant,
            ordinal: 0,
            ...(details?.name ? { name: details.name } : {}),
            ...(details?.ki !== undefined ? { ki: details.ki } : {}),
            ...(details?.type !== undefined ? { attackType: String(details.type) } : {}),
            ...(details?.style ? { style: details.style } : {}),
            effectText,
            conditionText: details?.condition ?? "",
            ...(details?.structuralSource ? { structuralSource: details.structuralSource } : {}),
            ...(details?.sourceAttackId ? { sourceAttackId: details.sourceAttackId } : {}),
        });
    }

    if (releaseState === "initial" || singleReleaseState) {
        (form.unitSuperAttacks ?? []).forEach((unit, ordinal) => {
            const effectText = unit.effect ?? "";
            if (!effectText) {
                return;
            }
            attacks.push({
                variant: "unit",
                ordinal,
                ...(unit.name ? { name: unit.name } : {}),
                ...(unit.ki !== undefined ? { ki: unit.ki } : {}),
                ...(unit.type !== undefined ? { attackType: String(unit.type) } : {}),
                ...(unit.style ? { style: unit.style } : {}),
                effectText,
                conditionText: unit.unitSuperAttackCondition ?? "",
                ...(unit.structuralSource ? { structuralSource: unit.structuralSource } : {}),
                ...(unit.sourceAttackId ? { sourceAttackId: unit.sourceAttackId } : {}),
            });
        });
    }
    return attacks;
}

function compareAnalysisStates(left: CharacterStateAnalysis, right: CharacterStateAnalysis): number {
    const releaseOrder: Record<ReleaseState, number> = { initial: 0, eza: 1, seza: 2 };
    return left.characterId.localeCompare(right.characterId)
        || left.formId.localeCompare(right.formId)
        || releaseOrder[left.releaseState] - releaseOrder[right.releaseState];
}

interface SuperAttackEffectCandidate {
    start: number,
    end: number,
    effects: Array<Omit<SuperAttackEffect, "sourceText" | "source">>,
}

export function parseSuperAttack(
    stateKey: string,
    source: AnalysisSuperAttackSource,
): ParsedSuperAttack {
    const rawText = source.effectText;
    const structuralEvidence = validStructuralEvidence(
        stateKey,
        rawText,
        source.structuralSource,
        "super_attack",
        source.variant,
        source.sourceAttackId,
    );
    const candidates = superAttackEffectCandidates(rawText)
        .sort((left, right) => left.start - right.start || right.end - left.end);
    const accepted: SuperAttackEffectCandidate[] = [];
    for (const candidate of candidates) {
        if (!accepted.some(existing => candidate.start < existing.end && candidate.end > existing.start)) {
            accepted.push(candidate);
        }
    }
    accepted.sort((left, right) => left.start - right.start);

    const effects = accepted.flatMap(candidate => {
        const fragments = sourceFragmentsForAbsoluteRange(rawText, candidate.start, candidate.end);
        const sourceText = rawText.slice(candidate.start, candidate.end);
        return candidate.effects.map(effect => applySuperAttackStructuralSemantics(
            { ...effect, sourceText, source: fragments },
            structuralEvidence,
        ));
    });
    const unparsedFragments = complementSourceFragments(
        rawText,
        accepted.map(candidate => ({ start: candidate.start, end: candidate.end })),
    );
    const effectStatus = superAttackEffectListStatus(effects);
    const condition = parseSuperAttackCondition(source.conditionText);
    const parseStatus = effects.length === 0
        ? "unknown"
        : unparsedFragments.length > 0 || condition.parseStatus !== "supported" || effectStatus !== "supported"
            ? "partial"
            : "supported";

    return {
        id: `${stateKey}:super-attack:${source.variant}:${source.ordinal}`,
        variant: source.variant,
        ordinal: source.ordinal,
        ...(source.name ? { name: source.name } : {}),
        ...(source.ki !== undefined ? { ki: source.ki } : {}),
        ...(source.attackType ? { attackType: source.attackType } : {}),
        ...(source.style ? { style: source.style } : {}),
        effectOrigin: "super_attack",
        rawText,
        condition,
        effects,
        effectStatus,
        parseStatus,
        sourceFragments: wholeLineSourceFragments(rawText),
        unparsedFragments,
        ...(structuralEvidence.length > 0 ? { structuralEvidence } : {}),
    };
}

function validStructuralEvidence(
    stateKey: string,
    normalizedText: string,
    source: EffectStructuralSource | undefined,
    channel: "passive" | "super_attack",
    attackVariant?: SuperAttackVariant,
    sourceEntityId?: string,
): EffectStructuralEvidence[] {
    if (!source
        || source.rawTextSha256 !== sha256Text(source.rawText)
        || source.normalizedTextSha256 !== sha256Text(normalizedText)
        || cleanStructuralText(source.rawText) !== normalizedText) {
        return [];
    }
    let previousAnchorEnd = -1;
    const valid: EffectStructuralEvidence[] = [];
    for (const entry of source.evidence ?? []) {
        const anchor = entry.anchor;
        const start = anchor?.sourceSpan?.start;
        const end = anchor?.sourceSpan?.end;
        const expectedPayloadField = channel === "passive"
            ? entry.releaseState === "initial"
                ? "props.character.passive_skill.description"
                : "props.character.extreme_z_awakening.passive_skill.description"
            : "props.character.super_attacks[].description";
        const stateIdentity = stateKey.split(":");
        const markerResolution = entry.markers.every(marker => marker.resolution === "supported")
            ? "supported"
            : entry.markers.every(marker => marker.resolution === "unresolved")
                ? "unresolved"
                : "partial";
        if (entry.kind !== "effect_markers"
            || entry.stateKey !== stateKey
            || entry.characterId !== stateIdentity[0]
            || entry.formId !== stateIdentity[1]
            || entry.releaseState !== stateIdentity[2]
            || entry.channel !== channel
            || entry.rawTextSha256 !== source.rawTextSha256
            || entry.normalizedTextSha256 !== source.normalizedTextSha256
            || entry.provenance?.source !== "dokkan_fyi_payload"
            || entry.provenance.markerSyntax !== "passiveImg"
            || entry.provenance.payloadField !== expectedPayloadField
            || !/^[a-f0-9]{32}$/i.test(entry.provenance.sourceVersion)
            || (channel === "super_attack" && entry.attackVariant !== attackVariant)
            || (channel === "passive" && entry.passiveSkillId !== sourceEntityId)
            || (channel === "super_attack" && entry.superAttackId !== sourceEntityId)
            || entry.resolution !== markerResolution
            || !Number.isInteger(start) || !Number.isInteger(end)
            || start < 0 || end <= start || end > source.rawText.length
            || start < previousAnchorEnd
            || source.rawText.slice(start, end).trimEnd() !== anchor.structuralText
            || cleanStructuralAnchor(anchor.structuralText) !== anchor.normalizedText
            || !structuralAnchorMatchesDisplay(normalizedText, anchor)
            || !validStructuralMarkers(source.rawText, entry)) {
            continue;
        }
        const expectedIdPart = channel === "passive"
            ? entry.passiveSkillId ?? "unknown"
            : entry.superAttackId ?? "unknown";
        if (entry.id !== `${stateKey}:${channel}:${expectedIdPart}:${start}`) {
            continue;
        }
        previousAnchorEnd = end;
        const { semanticConflicts: _ignoredSourceConflicts, ...trustedEntry } = entry;
        const corroboration = (entry.corroboration ?? []).filter(validStructuralCorroboration);
        valid.push({
            ...trustedEntry,
            anchor: { ...entry.anchor, sourceSpan: { ...entry.anchor.sourceSpan } },
            markers: entry.markers.map(marker => ({ ...marker, sourceSpan: { ...marker.sourceSpan } })),
            ...(corroboration.length > 0 ? { corroboration: corroboration.map(item => ({ ...item })) } : {}),
        });
    }
    return valid;
}

function validStructuralCorroboration(
    item: NonNullable<EffectStructuralEvidence["corroboration"]>[number],
): boolean {
    return item?.source === "first_party_game_db"
        && ["corroborating", "divergent", "unresolved"].includes(item.resolution)
        && typeof item.sourceVersion === "string" && item.sourceVersion.length > 0
        && typeof item.reason === "string" && item.reason.length > 0
        && (item.passiveSkillSetId === undefined || /^\d+$/.test(item.passiveSkillSetId))
        && (item.passiveSkillIds === undefined || item.passiveSkillIds.every(id => /^\d+$/.test(id)));
}

function validStructuralMarkers(rawText: string, evidence: EffectStructuralEvidence): boolean {
    const tokens = [...evidence.anchor.structuralText.matchAll(/\{passiveImg:([^}]+)\}/g)];
    const prefixTokens: RegExpMatchArray[] = [];
    let prefixEnd = 0;
    for (const token of tokens) {
        const tokenIndex = token.index ?? 0;
        if (evidence.anchor.structuralText.slice(prefixEnd, tokenIndex).trim() === "") {
            prefixTokens.push(token);
            prefixEnd = tokenIndex + token[0].length;
        } else {
            break;
        }
    }
    if (prefixTokens.length !== evidence.markers.length) {
        return false;
    }
    return evidence.markers.every((marker, order) => {
        const expected = prefixTokens[order];
        const markerKind = marker.sourceToken === "once" || marker.sourceToken === "forever"
            ? marker.sourceToken
            : "unknown";
        return marker.order === order
            && marker.sourceToken === expected[1]
            && marker.markerKind === markerKind
            && marker.resolution === (markerKind === "unknown" ? "unresolved" : "supported")
            && marker.sourceSpan.start === evidence.anchor.sourceSpan.start + (expected.index ?? 0)
            && marker.sourceSpan.end === marker.sourceSpan.start + expected[0].length
            && rawText.slice(marker.sourceSpan.start, marker.sourceSpan.end) === expected[0];
    });
}

function cleanStructuralText(value: string): string {
    return value
        .replace(/\{[^}]+\}/g, "")
        .replace(/\r/g, "")
        .split("\n")
        .map(line => line.trim().replace(/^\*\s*/, "").replace(/\s*\*$/, "").trim())
        .filter(Boolean)
        .join("\n")
        .trim();
}

function cleanStructuralAnchor(value: string): string {
    return cleanStructuralText(value)
        .replace(/^\s*-\s*/, "")
        .replace(/\s*\n\s*/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function structuralAnchorMatchesDisplay(
    normalizedText: string,
    anchor: EffectStructuralEvidence["anchor"],
): boolean {
    const fragments = wholeLineSourceFragments(normalizedText);
    const endLineIndex = anchor.endLineIndex ?? anchor.lineIndex;
    if (!Number.isInteger(anchor.lineIndex)
        || !Number.isInteger(endLineIndex)
        || endLineIndex < anchor.lineIndex
        || endLineIndex >= fragments.length) {
        return false;
    }
    const displayText = fragments.slice(anchor.lineIndex, endLineIndex + 1)
        .map(fragment => fragment.text.replace(/^\s*-\s*/, ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
    return displayText === anchor.normalizedText || displayText.includes(anchor.normalizedText);
}

function sha256Text(value: string): string {
    return createHash("sha256").update(value, "utf8").digest("hex");
}

function evidenceMatchesEffect(
    evidence: EffectStructuralEvidence,
    sourceText: string,
    source: SourceFragment[],
): boolean {
    const endLineIndex = evidence.anchor.endLineIndex ?? evidence.anchor.lineIndex;
    return source.length > 0
        && source.every(fragment => fragment.lineIndex >= evidence.anchor.lineIndex
            && fragment.lineIndex <= endLineIndex)
        && evidence.anchor.normalizedText.replace(/\s+/g, " ").includes(sourceText.replace(/\s+/g, " ").trim());
}

function applySuperAttackStructuralSemantics(
    effect: SuperAttackEffect,
    evidenceEntries: EffectStructuralEvidence[],
): SuperAttackEffect {
    const matching = evidenceEntries.filter(entry => evidenceMatchesEffect(entry, effect.sourceText, effect.source));
    const once = matching.find(entry => entry.markers.some(marker => marker.markerKind === "once"));
    const forever = matching.find(entry => entry.markers.some(marker => marker.markerKind === "forever"));
    if (once) {
        effect.activationLimit = markerActivationLimit(once);
    }
    if (forever) {
        if (effect.duration.kind === "unknown" || effect.duration.kind === "permanent") {
            effect.duration = {
                kind: "permanent",
                source: "dokkan_fyi_structural_marker",
                provenance: markerDecisionProvenance(forever),
            };
        } else {
            recordStructuralConflict(forever, "duration", "battle", effect.duration.kind, "explicit_text");
        }
    }
    return effect;
}

function markerActivationLimit(evidence: EffectStructuralEvidence): EffectActivationLimit {
    return {
        kind: "once",
        source: "dokkan_fyi_structural_marker",
        provenance: markerDecisionProvenance(evidence),
    };
}

function markerDecisionProvenance(evidence: EffectStructuralEvidence): EffectDecisionProvenance {
    return { source: "dokkan_fyi_structural_marker", evidenceId: evidence.id };
}

function recordStructuralConflict(
    evidence: EffectStructuralEvidence,
    field: "activationLimit" | "duration" | "applicationTrigger" | "stacking" | "cap",
    structuralValue: string,
    competingValue: string,
    competingSource: "explicit_text" | "first_party_game_db" | "documented_domain_rule",
): void {
    evidence.semanticConflicts = [
        ...(evidence.semanticConflicts ?? []),
        { field, structuralValue, competingValue, competingSource },
    ];
}

function parseSuperAttackCondition(rawText: string): ParsedSuperAttackCondition {
    const sourceFragments = wholeLineSourceFragments(rawText);
    if (!rawText) {
        return {
            rawText,
            expression: { op: "always" },
            parseStatus: "supported",
            sourceFragments,
            unparsedFragments: [],
        };
    }
    return {
        rawText,
        expression: { op: "unknown", sourceText: rawText },
        parseStatus: "unknown",
        sourceFragments,
        unparsedFragments: sourceFragments,
    };
}

function superAttackEffectCandidates(rawText: string): SuperAttackEffectCandidate[] {
    const candidates: SuperAttackEffectCandidate[] = [];
    const raisePattern = /(?:(greatly|massively)\s+)?raises?\s+(?:(?:all\s+)?allies['’]\s+)?(ATK|DEF)(?:\s*&\s*(ATK|DEF))?(?:\s+by\s+(\d+(?:\.\d+)?)%|\s*\+(\d+(?:\.\d+)?)%)?(?:\s+(?:for\s+\d+\s+turns?|in\s+battle|permanently|for\s+the\s+rest\s+of\s+(?:the\s+)?battle))?(?:\s+(?:per|with\s+each)\s+Super\s+Attack)?(?:\s*\(up\s+to\s+\d+(?:\.\d+)?%\)|,?\s*(?:stacking|stacks?|accumulating|accumulates?)\s+up\s+to\s+\d+(?:\.\d+)?%)?/gi;
    for (const match of rawText.matchAll(raisePattern)) {
        if (match.index === undefined) continue;
        const text = match[0];
        const target = /allies['’]/i.test(text)
            ? { scope: "allies" as const, selfInclusion: "unknown" as const }
            : { scope: "self" as const };
        const magnitude = superAttackMagnitude(match[1], "raise");
        const value = numericMatch(match[4] ?? match[5]);
        const duration = superAttackDuration(text);
        const stacking = superAttackStacking(text);
        const stats = uniqueStrings([match[2], match[3]].filter(Boolean).map(value => value.toUpperCase()));
        candidates.push({
            start: match.index,
            end: match.index + text.length,
            effects: stats.map(stat => superAttackStatEffect(
                stat === "ATK" ? "atk_raise" : "def_raise",
                target,
                magnitude,
                value,
                duration,
                stacking,
            )),
        });
    }

    const boostPattern = /(?:(?:all\s+)?allies['’]\s+)?(ATK|DEF)(?:\s*&\s*(ATK|DEF))?\s*\+(\d+(?:\.\d+)?)%(?:\s+for\s+(?:all\s+)?allies)?(?:\s+(?:for\s+\d+\s+turns?|in\s+battle|permanently|for\s+the\s+rest\s+of\s+(?:the\s+)?battle))?(?:\s*\(up\s+to\s+\d+(?:\.\d+)?%\)|,?\s*(?:stacking|stacks?|accumulating|accumulates?)\s+up\s+to\s+\d+(?:\.\d+)?%)?/gi;
    for (const match of rawText.matchAll(boostPattern)) {
        if (match.index === undefined) continue;
        const text = match[0];
        const target = /allies/i.test(text)
            ? { scope: "allies" as const, selfInclusion: "unknown" as const }
            : { scope: "self" as const };
        const duration = superAttackDuration(text);
        const stacking = superAttackStacking(text);
        const stats = uniqueStrings([match[1], match[2]].filter(Boolean).map(value => value.toUpperCase()));
        candidates.push({
            start: match.index,
            end: match.index + text.length,
            effects: stats.map(stat => superAttackStatEffect(
                stat === "ATK" ? "atk_raise" : "def_raise",
                target,
                "raise",
                numericMatch(match[3]),
                duration,
                stacking,
            )),
        });
    }

    const lowerPattern = /(?:(greatly|massively)\s+)?lowers?\s+(?!own\b)(ATK|DEF)(?:\s*&\s*(ATK|DEF))?(?:\s+by\s+(\d+(?:\.\d+)?)%)?(?:\s+(?:for\s+\d+\s+turns?|in\s+battle|permanently|for\s+the\s+rest\s+of\s+(?:the\s+)?battle))?(?:\s+(?:per|with\s+each)\s+Super\s+Attack)?(?:\s*\(up\s+to\s+\d+(?:\.\d+)?%\)|,?\s*(?:stacking|stacks?|accumulating|accumulates?)\s+up\s+to\s+\d+(?:\.\d+)?%)?/gi;
    for (const match of rawText.matchAll(lowerPattern)) {
        if (match.index === undefined) continue;
        const text = match[0];
        const target = superAttackEnemyTarget(rawText, match.index, match.index + text.length);
        const magnitude = superAttackMagnitude(match[1], "lower");
        const value = numericMatch(match[4]);
        const duration = superAttackDuration(text);
        const stacking = superAttackStacking(text);
        const stats = uniqueStrings([match[2], match[3]].filter(Boolean).map(value => value.toUpperCase()));
        candidates.push({
            start: match.index,
            end: match.index + text.length,
            effects: stats.map(stat => ({
                kind: stat === "ATK" ? "enemy_atk_lowering" as const : "enemy_def_lowering" as const,
                origin: "super_attack" as const,
                target,
                magnitude,
                ...(value !== undefined ? { value, unit: "percent" as const } : {}),
                duration,
                stacking,
                activationTiming: superAttackActivationTiming(),
                calculationBucket: {
                    bucket: "super_attack_enemy_stat_lowering" as const,
                    source: "documented_domain_rule" as const,
                },
                parseStatus: "supported" as const,
            })),
        });
    }

    collectSuperAttackStatusCandidates(
        rawText,
        /(?:(?:with|and)\s+)?(?:(?:\d+(?:\.\d+)?%|(?:a\s+)?(?:rare|medium|high|great))\s+chance\s+(?:of|to)\s+|a\s+chance\s+(?:of|to)\s+|may\s+)?(?:stunning|stuns?|stun)\s+(?:the\s+)?(?:enemy|enemies|them)(?:\s+for\s+\d+\s+turns?)?/gi,
        "stun",
        candidates,
    );
    collectSuperAttackStatusCandidates(
        rawText,
        /(?:(?:with|and)\s+)?(?:(?:\d+(?:\.\d+)?%|(?:a\s+)?(?:rare|medium|high|great))\s+chance\s+(?:of|to)\s+|a\s+chance\s+(?:of|to)\s+|may\s+)?(?:sealing|seals?|seal)\s+(?:(?:the\s+)?enemy(?:'s)?\s+)?Super\s+Attack(?:\s+for\s+\d+\s+turns?)?/gi,
        "super_attack_seal",
        candidates,
    );
    return candidates;
}

function superAttackStatEffect(
    kind: "atk_raise" | "def_raise",
    target: SuperAttackEffectTarget,
    magnitude: SuperAttackEffectMagnitude,
    value: number | undefined,
    duration: SuperAttackEffectDuration,
    stacking: SuperAttackEffectStacking,
): Omit<SuperAttackEffect, "sourceText" | "source"> {
    const resolvedDuration: SuperAttackEffectDuration = duration.kind === "unknown"
        ? {
            kind: "permanent",
            source: "documented_domain_rule",
            provenance: domainRuleProvenance(),
        }
        : duration;
    const resolvedStacking: SuperAttackEffectStacking = stacking.kind === "not_stackable"
        ? stacking
        : {
            ...stacking,
            kind: "stackable",
            scope: superAttackStackingScope(resolvedDuration),
            source: stacking.kind === "stackable" ? stacking.source : "documented_domain_rule",
            provenance: stacking.kind === "stackable"
                ? { source: stacking.source }
                : domainRuleProvenance(),
        };
    return {
        kind,
        origin: "super_attack",
        target,
        magnitude,
        ...(value !== undefined ? { value, unit: "percent" as const } : {}),
        duration: resolvedDuration,
        stacking: resolvedStacking,
        applicationTrigger: {
            kind: "per_super_attack",
            source: "documented_domain_rule",
            provenance: domainRuleProvenance(),
        },
        activationTiming: superAttackActivationTiming(),
        calculationBucket: {
            bucket: "super_attack_raise",
            source: "documented_domain_rule",
        },
        parseStatus: "supported",
    };
}

function superAttackStackingScope(duration: SuperAttackEffectDuration): EffectStackingScope {
    if (duration.kind === "current_turn") return "current_turn";
    if (duration.kind === "turns") return "active_windows";
    if (duration.kind === "permanent") return "battle";
    return "unknown";
}

function domainRuleProvenance(): EffectDecisionProvenance {
    return {
        source: "documented_domain_rule",
        ruleVersion: SUPER_ATTACK_STAT_RAISE_DOMAIN_RULE_VERSION,
    };
}

function collectSuperAttackStatusCandidates(
    rawText: string,
    pattern: RegExp,
    kind: "stun" | "super_attack_seal",
    candidates: SuperAttackEffectCandidate[],
): void {
    for (const match of rawText.matchAll(pattern)) {
        if (match.index === undefined) continue;
        const text = match[0];
        const probability = superAttackProbability(text);
        candidates.push({
            start: match.index,
            end: match.index + text.length,
            effects: [{
                kind,
                origin: "super_attack",
                target: superAttackEnemyTarget(rawText, match.index, match.index + text.length),
                ...probability,
                duration: superAttackDuration(text),
                activationTiming: superAttackActivationTiming(),
                parseStatus: probability.probabilitySource === "unresolved" ? "partial" : "supported",
            }],
        });
    }
}

function superAttackActivationTiming(): SuperAttackActivationTiming {
    return {
        moment: "when_super_attack_effect_resolves",
        source: "documented_domain_rule",
    };
}

function superAttackMagnitude(
    qualifier: string | undefined,
    direction: "raise" | "lower",
): SuperAttackEffectMagnitude {
    const normalized = qualifier?.toLowerCase();
    if (normalized === "greatly") return direction === "raise" ? "greatly_raise" : "greatly_lower";
    if (normalized === "massively") return direction === "raise" ? "massively_raise" : "massively_lower";
    return direction;
}

function superAttackDuration(sourceText: string): SuperAttackEffectDuration {
    const turns = sourceText.match(/for\s+(\d+)\s+turns?/i);
    if (turns) {
        const value = Number(turns[1]);
        return value === 1
            ? { kind: "current_turn", source: "explicit_text" }
            : { kind: "turns", turns: value, source: "explicit_text" };
    }
    if (/\b(?:in\s+battle|permanently|for\s+the\s+rest\s+of\s+(?:the\s+)?battle)\b/i.test(sourceText)) {
        return { kind: "permanent", source: "explicit_text" };
    }
    return { kind: "unknown", source: "unresolved" };
}

function superAttackStacking(sourceText: string): SuperAttackEffectStacking {
    if (/\bnot\s+stackable\b/i.test(sourceText)) {
        return { kind: "not_stackable", source: "explicit_text" };
    }
    const cap = sourceText.match(/(?:up\s+to|maximum\s+of)\s+(\d+(?:\.\d+)?)%/i);
    if (cap) {
        return {
            kind: "stackable",
            capPercent: Number(cap[1]),
            source: "explicit_text",
            capSource: "explicit_text",
        };
    }
    if (/\b(?:stackable|stacks?|stacking|accumulates?|accumulating|per\s+Super\s+Attack|with\s+each\s+Super\s+Attack)\b/i.test(sourceText)) {
        return { kind: "stackable", source: "explicit_text" };
    }
    return { kind: "unknown", source: "unresolved" };
}

function superAttackProbability(sourceText: string): Pick<
    SuperAttackEffect,
    "activationChancePercent" | "qualitativeChanceTerm" | "probabilitySource"
> {
    const explicit = sourceText.match(/(\d+(?:\.\d+)?)%\s+chance/i);
    if (explicit) {
        return { activationChancePercent: Number(explicit[1]), probabilitySource: "explicit_text" };
    }
    const term = sourceText.match(/\b(rare|medium|high|great)\s+chance\b/i)?.[1]?.toLowerCase()
        ?? (sourceText.match(/\ba\s+chance\b/i) ? "a chance" : undefined)
        ?? (sourceText.match(/\bmay\b/i) ? "may" : undefined);
    if (term) {
        return {
            qualitativeChanceTerm: term as SuperAttackChanceTerm,
            probabilitySource: "unresolved",
        };
    }
    return {};
}

function superAttackEnemyTarget(rawText: string, start: number, end: number): SuperAttackEffectTarget {
    const effectText = rawText.slice(start, end);
    if (/\b(?:the\s+enemy|enemy)\b/i.test(effectText) && !/\ball\s+enemies\b/i.test(effectText)) {
        return { scope: "current_target" };
    }
    if (/\b(?:all\s+enemies|enemies|them)\b/i.test(effectText)) {
        return { scope: "all_enemies" };
    }
    const previousBoundary = Math.max(
        rawText.lastIndexOf(";", start - 1),
        rawText.lastIndexOf(".", start - 1),
        rawText.lastIndexOf("!", start - 1),
        rawText.lastIndexOf("?", start - 1),
    );
    const followingBoundaries = [";", ".", "!", "?"]
        .map(delimiter => rawText.indexOf(delimiter, end))
        .filter(index => index >= 0);
    const nextBoundary = followingBoundaries.length > 0 ? Math.min(...followingBoundaries) : rawText.length;
    const clauseText = rawText.slice(previousBoundary + 1, nextBoundary);
    return /\ball\s+enemies\b/i.test(clauseText)
        ? { scope: "all_enemies" }
        : { scope: "current_target" };
}

function superAttackEffectListStatus(effects: SuperAttackEffect[]): ParseStatus {
    return aggregateStatuses(effects.map(effect => effect.parseStatus));
}

function wholeLineSourceFragments(rawText: string): SourceFragment[] {
    return rawText.replace(/\r\n/g, "\n").split("\n").flatMap((text, lineIndex) => text.length > 0
        ? [{ lineIndex, text, start: 0, end: text.length }]
        : []);
}

function sourceFragmentsForAbsoluteRange(rawText: string, start: number, end: number): SourceFragment[] {
    const fragments: SourceFragment[] = [];
    const lines = rawText.split(/\r?\n/);
    let absoluteStart = 0;
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
        const line = lines[lineIndex];
        const lineEnd = absoluteStart + line.length;
        const fragmentStart = Math.max(start, absoluteStart);
        const fragmentEnd = Math.min(end, lineEnd);
        if (fragmentEnd > fragmentStart) {
            const localStart = fragmentStart - absoluteStart;
            const localEnd = fragmentEnd - absoluteStart;
            fragments.push({
                lineIndex,
                text: line.slice(localStart, localEnd),
                start: localStart,
                end: localEnd,
            });
        }
        const separatorLength = rawText.slice(lineEnd, lineEnd + 2) === "\r\n" ? 2 : 1;
        absoluteStart = lineEnd + (lineIndex < lines.length - 1 ? separatorLength : 0);
    }
    return fragments;
}

function complementSourceFragments(
    rawText: string,
    ranges: Array<{ start: number, end: number }>,
): SourceFragment[] {
    const merged: Array<{ start: number, end: number }> = [];
    for (const range of [...ranges].sort((left, right) => left.start - right.start)) {
        const previous = merged[merged.length - 1];
        if (previous && range.start <= previous.end) {
            previous.end = Math.max(previous.end, range.end);
        } else {
            merged.push({ ...range });
        }
    }
    const fragments: SourceFragment[] = [];
    let cursor = 0;
    for (const range of [...merged, { start: rawText.length, end: rawText.length }]) {
        if (range.start > cursor && /\S/.test(rawText.slice(cursor, range.start))) {
            fragments.push(...sourceFragmentsForAbsoluteRange(rawText, cursor, range.start)
                .filter(fragment => /\S/.test(fragment.text)));
        }
        cursor = Math.max(cursor, range.end);
    }
    return fragments;
}

function numericMatch(value: string | undefined): number | undefined {
    if (value === undefined) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}

function uniqueStrings(values: string[]): string[] {
    return Array.from(new Set(values));
}

interface LogicalPassiveBlock {
    kind: "condition" | "effect",
    text: string,
    source: SourceFragment[],
}

interface ParsedConditionResult {
    condition: ConditionExpression,
    status: ParseStatus,
}

interface ParsedEffectResult {
    effects: PassiveEffect[],
    status: ParseStatus,
}

export interface PassiveParseContext {
    characterId: string,
    formId: string,
    releaseState: ReleaseState,
}

export function parsePassive(
    stateKey: string,
    name: string | undefined,
    rawText: string,
    passiveDetails?: PassiveDetails,
    context?: PassiveParseContext,
): ParsedPassive {
    const sourceMap = mapPassiveDetailsToSource(rawText, passiveDetails);
    const conditionEvidence = validConditionEvidence(
        stateKey,
        rawText,
        sourceMap.sourceFragments,
        passiveDetails?.conditionEvidence ?? [],
        context,
    );
    const structuralEvidence = context
        ? validStructuralEvidence(
            stateKey,
            rawText,
            passiveDetails?.structuralSource,
            "passive",
            undefined,
            passiveDetails?.sourceSkillId,
        )
        : [];
    const blocks = buildLogicalPassiveBlocks(sourceMap.sourceFragments);
    const rules: PassiveRule[] = [];
    const unparsedFragments: SourceFragment[] = [];
    let currentCondition: LogicalPassiveBlock | undefined;
    let currentConditionUsed = false;

    const flushUnusedCondition = () => {
        if (!currentCondition || currentConditionUsed) {
            return;
        }
        rules.push(unknownStandaloneRule(stateKey, currentCondition));
        unparsedFragments.push(...currentCondition.source);
    };

    for (const block of blocks) {
        if (block.kind === "condition") {
            flushUnusedCondition();
            currentCondition = block;
            currentConditionUsed = false;
            continue;
        }

        const headerScaling = currentCondition
            ? parseKiSphereScalingHeader(currentCondition.text)
                ?? parseCombatEventScalingHeader(currentCondition.text)
            : undefined;
        const headerConditionResult = currentCondition
            ? headerScaling
                ? { condition: { op: "always" } as ConditionExpression, status: "supported" as ParseStatus }
                : parseCondition(
                    currentCondition.text,
                    enrichedConditionText(currentCondition, conditionEvidence),
                )
            : { condition: { op: "always" } as ConditionExpression, status: "supported" as ParseStatus };
        const inlineTemporal = splitInlineTemporalCondition(block.text);
        const conditionResult = inlineTemporal
            ? combineConditionResults(headerConditionResult, parseCondition(inlineTemporal.conditionText))
            : headerConditionResult;
        const effectResult = parseEffects(inlineTemporal?.effectText ?? block.text, {
            stateKey,
            rawText,
            ruleLineIndex: block.source[0]?.lineIndex ?? -1,
            ...((currentCondition || inlineTemporal?.activationContextText) ? {
                phaseContextText: [currentCondition?.text, inlineTemporal?.activationContextText]
                    .filter((value): value is string => Boolean(value))
                    .join(" "),
            } : {}),
            ...(headerScaling ? { headerScaling } : {}),
        });
        effectResult.effects = effectResult.effects.map(effect => applyPassiveStructuralSemantics(
            effect,
            block.source,
            structuralEvidence,
            currentCondition?.source,
        ));
        const source = uniqueOrderedFragments([
            ...(currentCondition?.source ?? []),
            ...block.source,
        ]);
        const parseStatus = combineParseStatuses(conditionResult.status, effectResult.status);
        rules.push({
            id: ruleIdFromFragment(stateKey, block.source[block.source.length - 1]),
            condition: conditionResult.condition,
            conditionStatus: conditionResult.status,
            effects: effectResult.effects,
            effectStatus: effectResult.status,
            source,
            parseStatus,
            confidence: confidenceFromStatus(parseStatus),
        });
        if (conditionResult.status !== "supported" && currentCondition) {
            unparsedFragments.push(...currentCondition.source);
        }
        if (effectResult.status !== "supported") {
            unparsedFragments.push(...block.source);
        }
        currentConditionUsed = true;
    }
    flushUnusedCondition();

    return {
        ...(name ? { name } : {}),
        rawText,
        parseStatus: aggregatePassiveStatus(rules),
        rules,
        unparsedFragments: uniqueOrderedFragments(unparsedFragments),
        ...(conditionEvidence.length > 0 ? { conditionEvidence } : {}),
        ...(structuralEvidence.length > 0 ? { structuralEvidence } : {}),
    };
}

function applyPassiveStructuralSemantics(
    effect: PassiveEffect,
    source: SourceFragment[],
    evidenceEntries: EffectStructuralEvidence[],
    triggerContext: SourceFragment[] = [],
): PassiveEffect {
    const matching = evidenceEntries.filter(entry => evidenceMatchesEffect(entry, effect.sourceText, source));
    if (matching.length === 0) {
        return effect;
    }
    const once = matching.find(entry => entry.markers.some(marker => marker.markerKind === "once"));
    const forever = matching.find(entry => entry.markers.some(marker => marker.markerKind === "forever"));
    if (once) {
        effect.activationLimit = markerActivationLimit(once);
    }
    if (forever) {
        if (!effect.duration || effect.duration.kind === "unknown" || effect.duration.kind === "battle") {
            effect.duration = {
                kind: "battle",
                source: "dokkan_fyi_structural_marker",
                provenance: markerDecisionProvenance(forever),
            };
        } else {
            recordStructuralConflict(forever, "duration", "battle", effect.duration.kind, "explicit_text");
        }
    }
    if (effect.scaling?.kind === "per_combat_event") {
        effect.applicationTrigger = {
            kind: "per_combat_event",
            source: "explicit_text",
            provenance: { source: "explicit_text" },
        };
        if (effect.stackCap !== undefined || effect.perStack !== undefined) {
            effect.stacking = {
                kind: "stackable",
                scope: passiveStackingScope(effect.duration),
                source: "explicit_text",
                ...(effect.stackCap !== undefined
                    ? { capPercent: effect.stackCap, capSource: "explicit_text" as const }
                    : {}),
                provenance: { source: "explicit_text" },
            };
        }
    } else if (triggerContext.some(fragment => /\b(?:entrance|entering|entry)\b/i.test(fragment.text))) {
        effect.applicationTrigger = {
            kind: "entry",
            source: "explicit_text",
            provenance: { source: "explicit_text" },
        };
    } else {
        effect.applicationTrigger = {
            kind: "unknown",
            source: "unresolved",
            provenance: { source: "unresolved" },
        };
    }
    return effect;
}

function passiveStackingScope(duration: PassiveDuration | undefined): EffectStackingScope {
    if (duration?.kind === "within_turn") return "current_turn";
    if (duration?.kind === "turns") return "active_windows";
    if (duration?.kind === "battle") return "battle";
    return "unknown";
}

function validConditionEvidence(
    stateKey: string,
    rawText: string,
    sourceFragments: SourceFragment[],
    evidenceEntries: PassiveConditionEvidence[],
    context?: PassiveParseContext,
): PassiveConditionEvidence[] {
    if (!context || evidenceEntries.length === 0) {
        return [];
    }
    const passiveTextSha256 = createHash("sha256").update(rawText, "utf8").digest("hex");
    const fragmentsByLine = new Map(sourceFragments.map(fragment => [fragment.lineIndex, fragment]));
    const seenLines = new Set<number>();
    return evidenceEntries.filter(evidence => {
        const endLineIndex = evidence.anchor?.endLineIndex ?? evidence.anchor?.lineIndex;
        const anchorLineIndexes = Number.isInteger(evidence.anchor?.lineIndex)
            && Number.isInteger(endLineIndex)
            && endLineIndex >= evidence.anchor.lineIndex
            ? Array.from(
                { length: endLineIndex - evidence.anchor.lineIndex + 1 },
                (_value, index) => evidence.anchor.lineIndex + index,
            )
            : [];
        if (evidence.kind !== "enemy_status"
            || evidence.stateKey !== stateKey
            || evidence.characterId !== context.characterId
            || evidence.formId !== context.formId
            || evidence.releaseState !== context.releaseState
            || evidence.passiveTextSha256 !== passiveTextSha256
            || evidence.provenance?.source !== "dokkan_fyi_payload"
            || evidence.provenance.markerSyntax !== "passiveImg"
            || !evidence.provenance.sourceVersion
            || anchorLineIndexes.length === 0
            || anchorLineIndexes.some(lineIndex => seenLines.has(lineIndex))) {
            return false;
        }
        const expectedPayloadField = context.releaseState === "initial"
            ? "props.character.passive_skill.description"
            : "props.character.extreme_z_awakening.passive_skill.description";
        const anchorFragments = anchorLineIndexes
            .map(lineIndex => fragmentsByLine.get(lineIndex))
            .filter((fragment): fragment is SourceFragment => fragment !== undefined);
        const normalizedAnchorText = logicalText("condition", anchorFragments);
        if (anchorFragments.length !== anchorLineIndexes.length
            || evidence.provenance.payloadField !== expectedPayloadField
            || normalizedAnchorText !== evidence.anchor.normalizedText
            || stripPassiveMarkers(evidence.anchor.structuralText).replace(/\s+/g, " ")
                !== evidence.anchor.normalizedText) {
            return false;
        }
        const statusSource = evidence.anchor.structuralText.slice(
            evidence.anchor.structuralText.toLowerCase().indexOf("following status:")
                + "following status:".length,
        );
        const sourceTokens = [...statusSource.matchAll(/\{passiveImg:([^}]+)\}/g)]
            .map(match => match[1]);
        if (sourceTokens.length !== evidence.statuses.length
            || evidence.statuses.some((status, order) => status.order !== order
                || status.sourceToken !== sourceTokens[order]
                || status.status !== enemyStatusFromEvidenceMarker(status.sourceToken)
                || status.resolution !== (status.status ? "supported" : "unresolved"))) {
            return false;
        }
        const expectedConnector = evidenceConnector(evidence.anchor.structuralText, sourceTokens.length);
        if (evidence.connector !== expectedConnector
            || evidence.resolution !== evidenceResolution(evidence.statuses, expectedConnector)) {
            return false;
        }
        anchorLineIndexes.forEach(lineIndex => seenLines.add(lineIndex));
        return true;
    }).sort((left, right) => left.anchor.lineIndex - right.anchor.lineIndex);
}

function stripPassiveMarkers(sourceText: string): string {
    return sourceText.replace(/\{[^}]+\}/g, "").trim();
}

function evidenceConnector(
    structuralText: string,
    markerCount: number,
): "and" | "or" | undefined {
    if (markerCount < 2) {
        return undefined;
    }
    const statusSource = structuralText.slice(
        structuralText.toLowerCase().indexOf("following status:") + "following status:".length,
    );
    const firstMarkerIndex = statusSource.search(/\{passiveImg:[^}]+\}/);
    const lastMarkerIndex = statusSource.lastIndexOf("{passiveImg:");
    const lastMarkerEnd = lastMarkerIndex >= 0 ? statusSource.indexOf("}", lastMarkerIndex) + 1 : -1;
    if (firstMarkerIndex < 0 || lastMarkerEnd <= firstMarkerIndex) {
        return undefined;
    }
    const markerList = statusSource.slice(firstMarkerIndex, lastMarkerEnd)
        .replace(/\{passiveImg:[^}]+\}/g, "#");
    const hasAnd = /\band\b/i.test(markerList);
    const hasOr = /\bor\b/i.test(markerList);
    if (hasAnd === hasOr) {
        return undefined;
    }
    return hasAnd ? "and" : "or";
}

function evidenceResolution(
    statuses: PassiveConditionEvidence["statuses"],
    connector: "and" | "or" | undefined,
): "supported" | "partial" | "unresolved" {
    if (statuses.length === 0) {
        return "unresolved";
    }
    return statuses.some(status => !status.status) || (statuses.length > 1 && !connector)
        ? "partial"
        : "supported";
}

function enemyStatusFromEvidenceMarker(sourceToken: string): EnemyStatus | undefined {
    if (sourceToken === "atk_down") return "atk_down";
    if (sourceToken === "def_down") return "def_down";
    if (sourceToken === "stun") return "stunned";
    if (sourceToken === "astute") return "super_attack_sealed";
    return undefined;
}

function enrichedConditionText(
    block: LogicalPassiveBlock,
    evidenceEntries: PassiveConditionEvidence[],
): string {
    const evidenceByLine = new Map<number, PassiveConditionEvidence>();
    evidenceEntries.forEach(evidence => {
        const endLineIndex = evidence.anchor.endLineIndex ?? evidence.anchor.lineIndex;
        for (let lineIndex = evidence.anchor.lineIndex; lineIndex <= endLineIndex; lineIndex += 1) {
            evidenceByLine.set(lineIndex, evidence);
        }
    });
    if (!block.source.some(fragment => evidenceByLine.has(fragment.lineIndex))) {
        return block.text;
    }
    const enrichedSource = block.source.map(fragment => {
        const evidence = evidenceByLine.get(fragment.lineIndex);
        if (!evidence) {
            return fragment;
        }
        return {
            ...fragment,
            text: fragment.lineIndex === evidence.anchor.lineIndex
                ? semanticEvidenceText(evidence)
                : "",
        };
    });
    return logicalText(block.kind, enrichedSource);
}

function semanticEvidenceText(evidence: PassiveConditionEvidence): string {
    let order = 0;
    const statusOffset = evidence.anchor.structuralText.toLowerCase().indexOf("following status:")
        + "following status:".length;
    return evidence.anchor.structuralText.replace(/\{passiveImg:([^}]+)\}/g, (
        _match,
        sourceToken: string,
        offset: number,
    ) => {
        if (offset < statusOffset) {
            return "";
        }
        const item = evidence.statuses[order++];
        if (!item || item.sourceToken !== sourceToken || !item.status) {
            return "unresolved enemy status";
        }
        if (item.status === "atk_down") return "ATK Down";
        if (item.status === "def_down") return "DEF Down";
        if (item.status === "stunned") return "stunned";
        return "Super Attack sealed";
    });
}

function combineConditionResults(
    left: ParsedConditionResult,
    right: ParsedConditionResult,
): ParsedConditionResult {
    if (left.condition.op === "always") {
        return right;
    }
    if (right.condition.op === "always") {
        return left;
    }
    const condition = resolveThatEnemyReferences({
        op: "all",
        children: [left.condition, right.condition],
    });
    return { condition, status: conditionExpressionStatus(condition) };
}

function splitInlineTemporalCondition(sourceText: string): {
    effectText: string,
    conditionText: string,
    activationContextText?: string,
} | undefined {
    const temporalSuffix = /\s+((?:starting from the \d+(?:st|nd|rd|th) turn|for \d+ turn(?:s|\(s\))?) from (?:the start of battle|the character['â€™]s entry turn))$/i.exec(sourceText);
    const kiSuffix = /\s+((?:when|if) attacking with (?:(?:between\s+)?\d+\s+(?:and|to)\s+\d+|(?:(?:exactly|at least|at most)\s+)?\d+(?:\s+or\s+(?:more|less))?) Ki)$/i.exec(sourceText)
        ?? /\s+((?:when attacking with\s+|with\s+)(?:(?:between\s+)?\d+\s+(?:and|to)\s+\d+|(?:(?:exactly|at least|at most)\s+)?\d+(?:\s+or\s+(?:more|less))?)\s*(?:AGL|TEQ|INT|STR|PHY|Rainbow|non[- ]Rainbow|Type)?\s*Ki Spheres? obtained)$/i.exec(sourceText);
    const combatSuffix = /\s+((?:before|when|after)\s+(?:(?:performing|receiving|evading)(?:\s+(?:an?|the|\d+(?:\s+or\s+(?:more|less))?)\s+(?:(?:Ki Blast|Unarmed|Physical)\s+)?(?:normal\s+|Super\s+)?attacks?)?|attacking|delivering\s+(?:a\s+|the\s+)?final blow)(?:\s+(?:in battle|within the turn))?)$/i.exec(sourceText);
    const againstNormalAttack = /\s+(against normal attacks?)$/i.exec(sourceText);
    const suffix = temporalSuffix ?? kiSuffix ?? combatSuffix ?? againstNormalAttack;
    if (!suffix || suffix.index === undefined) {
        return undefined;
    }
    const effectText = sourceText.slice(0, suffix.index).trim();
    const conditionText = againstNormalAttack && suffix === againstNormalAttack
        ? "When receiving a normal attack"
        : suffix[1];
    return effectText
        ? {
            effectText,
            conditionText,
            ...(!(againstNormalAttack && suffix === againstNormalAttack)
                ? { activationContextText: suffix[1] }
                : {}),
        }
        : undefined;
}

export function mapPassiveDetailsToSource(
    rawText: string,
    passiveDetails?: PassiveDetails,
): PassiveSourceMap {
    const normalizedRawText = rawText.replace(/\r\n/g, "\n");
    const rawLines = normalizedRawText.split("\n");
    const sourceFragments = rawLines
        .map((line, lineIndex) => trimmedFragment(line, lineIndex))
        .filter(fragment => fragment.text.length > 0);
    const lineTexts = passiveDetails?.lines ?? sourceFragments.map(fragment => fragment.text);
    const lines = alignPassiveTexts(rawLines, lineTexts);
    const sectionEntries = (passiveDetails?.sections ?? []).flatMap(section => [
        ...(section.label ? [{ type: "label" as const, text: section.label }] : []),
        ...section.lines.map(text => ({ type: "line" as const, text })),
    ]);
    const mappedSectionEntries = alignPassiveTexts(rawLines, sectionEntries.map(entry => entry.text));
    let mappedIndex = 0;
    const sections = (passiveDetails?.sections ?? []).map(section => ({
        ...(section.label ? { label: mappedSectionEntries[mappedIndex++] } : {}),
        lines: section.lines.map(() => mappedSectionEntries[mappedIndex++]),
    }));
    const unmappedTexts = [
        ...lines.filter(line => !line.mapped).map(line => line.text),
        ...mappedSectionEntries.filter(entry => !entry.mapped).map(entry => entry.text),
    ];
    return {
        rawText,
        sourceFragments,
        lines,
        sections,
        unmappedTexts,
    };
}

function alignPassiveTexts(rawLines: string[], texts: string[]): MappedPassiveText[] {
    const stream = buildAlignmentStream(rawLines);
    let cursor = 0;
    return texts.map(text => {
        const normalizedText = normalizeAlignmentText(text);
        const matchIndex = normalizedText ? stream.text.indexOf(normalizedText, cursor) : -1;
        if (matchIndex < 0) {
            return { text, source: [], mapped: false };
        }
        cursor = matchIndex + normalizedText.length;
        const positions = stream.positions.slice(matchIndex, cursor);
        return {
            text,
            source: fragmentsFromAlignmentPositions(rawLines, positions),
            mapped: true,
        };
    });
}

function buildAlignmentStream(rawLines: string[]): {
    text: string,
    positions: Array<{ lineIndex: number, column: number }>,
} {
    let text = "";
    const positions: Array<{ lineIndex: number, column: number }> = [];
    rawLines.forEach((line, lineIndex) => {
        const bullet = /^\s*-\s+/.exec(line);
        for (let column = 0; column < line.length; column += 1) {
            const character = line[column];
            const structuralBullet = Boolean(bullet && column >= (bullet.index ?? 0) && column < (bullet[0].length));
            if (/\s/.test(character) || character === "*" || structuralBullet) {
                continue;
            }
            text += character;
            positions.push({ lineIndex, column });
        }
    });
    return { text, positions };
}

function normalizeAlignmentText(text: string): string {
    return text.replace(/^\s*-\s+/, "").replace(/[\s*]/g, "");
}

function fragmentsFromAlignmentPositions(
    rawLines: string[],
    positions: Array<{ lineIndex: number, column: number }>,
): SourceFragment[] {
    const ranges = new Map<number, { start: number, end: number }>();
    for (const position of positions) {
        const range = ranges.get(position.lineIndex);
        if (range) {
            range.start = Math.min(range.start, position.column);
            range.end = Math.max(range.end, position.column + 1);
        } else {
            ranges.set(position.lineIndex, { start: position.column, end: position.column + 1 });
        }
    }
    return [...ranges.entries()].sort(([left], [right]) => left - right).map(([lineIndex, range]) => ({
        lineIndex,
        text: rawLines[lineIndex].slice(range.start, range.end),
        start: range.start,
        end: range.end,
    }));
}

function buildLogicalPassiveBlocks(sourceFragments: SourceFragment[]): LogicalPassiveBlock[] {
    const blocks: LogicalPassiveBlock[] = [];
    let current: { kind: "condition" | "effect", source: SourceFragment[] } | undefined;
    const flush = () => {
        if (!current) {
            return;
        }
        blocks.push({
            kind: current.kind,
            text: logicalText(current.kind, current.source),
            source: current.source,
        });
        current = undefined;
    };

    for (const fragment of sourceFragments) {
        const isBullet = /^-\s+/.test(fragment.text);
        if (isBullet) {
            flush();
            current = { kind: "effect", source: [fragment] };
            continue;
        }
        if (!current) {
            current = { kind: "condition", source: [fragment] };
            continue;
        }
        if (current.kind === "effect"
            && isLogicalHeaderStart(fragment.text)
            && !isEffectModifierContinuation(fragment.text)) {
            flush();
            current = { kind: "condition", source: [fragment] };
            continue;
        }
        if (current.kind === "condition"
            && /^When the target enemy is in the following status:/i.test(fragment.text)) {
            flush();
            current = { kind: "condition", source: [fragment] };
            continue;
        }
        current.source.push(fragment);
    }
    flush();
    return blocks;
}

function isEffectModifierContinuation(text: string): boolean {
    return /^for\s+\d+\s+turn(?:s|\(s\))?$/i.test(text.trim());
}

function logicalText(kind: "condition" | "effect", source: SourceFragment[]): string {
    return source.map((fragment, index) => {
        const text = fragment.text.replace(/^\*|\*$/g, "").trim();
        return kind === "effect" && index === 0 ? text.replace(/^-\s+/, "") : text;
    }).join(" ").replace(/\s+/g, " ").trim();
}

function isLogicalHeaderStart(text: string): boolean {
    const trimmed = text.trim();
    return /^(?:Activates the Entrance Animation|Basic effect\(s\)|When\b|If\b|Per\b|As the\b|After\b|Before\b|At the\b|With\b|Without\b|While\b|The less\b|The more\b|Upon\b|Once\b|Every\b|\d+ or more\b)/i.test(trimmed)
        || /^(?:For|Starting)\b/.test(trimmed)
        || /^(?:On the \d+(?:st|nd|rd|th)|Up to the \d+(?:st|nd|rd|th)|From the \d+(?:st|nd|rd|th) (?:through|to) the \d+(?:st|nd|rd|th))\b/.test(trimmed);
}

function isAlwaysHeader(text: string): boolean {
    return /^\*?Basic effect\(s\)\*?:?$/i.test(text.trim());
}

function parseCondition(sourceText: string, semanticText = sourceText): ParsedConditionResult {
    const text = sourceText.trim();
    if (isAlwaysHeader(text)) {
        return { condition: { op: "always" }, status: "supported" };
    }
    const parsed = parseBooleanCondition(semanticText.trim());
    const condition = resolveThatEnemyReferences(
        semanticText === sourceText ? parsed : rewriteConditionSourceText(parsed, sourceText),
    );
    return { condition, status: conditionExpressionStatus(condition) };
}

function rewriteConditionSourceText(
    condition: ConditionExpression,
    sourceText: string,
): ConditionExpression {
    if (condition.op === "predicate") {
        return predicateExpression({ ...condition.predicate, sourceText });
    }
    if (condition.op === "unknown") {
        return { op: "unknown", sourceText };
    }
    if (condition.op === "not") {
        return { op: "not", child: rewriteConditionSourceText(condition.child, sourceText) };
    }
    if (condition.op === "all" || condition.op === "any") {
        return {
            op: condition.op,
            children: condition.children.map(child => rewriteConditionSourceText(child, sourceText)),
        };
    }
    return condition;
}

function resolveThatEnemyReferences(condition: ConditionExpression): ConditionExpression {
    if (condition.op === "not") {
        return condition;
    }
    if (condition.op === "any") {
        return {
            op: "any",
            children: condition.children.map(resolveThatEnemyReferences),
        };
    }
    if (condition.op !== "all") {
        return condition;
    }
    return resolveThatEnemyReferencesInConjunction(
        condition,
        conjunctiveComponentProvesSingleEnemy(condition),
    );
}

function conjunctiveComponentProvesSingleEnemy(condition: ConditionExpression): boolean {
    if (condition.op === "predicate") {
        return condition.predicate.kind === "enemy_count"
            && condition.predicate.comparator === "eq"
            && condition.predicate.value === 1;
    }
    return condition.op === "all" && condition.children.some(conjunctiveComponentProvesSingleEnemy);
}

function resolveThatEnemyReferencesInConjunction(
    condition: ConditionExpression,
    provesSingleEnemy: boolean,
): ConditionExpression {
    if (condition.op === "predicate") {
        if (!provesSingleEnemy
            || condition.predicate.enemyReference !== "that_enemy"
            || condition.predicate.enemySelection !== "unknown") {
            return condition;
        }
        return predicateExpression({
            ...condition.predicate,
            enemySelection: "only_enemy",
        });
    }
    if (condition.op === "all") {
        return {
            op: "all",
            children: condition.children.map(child => child.op === "all" || child.op === "predicate"
                ? resolveThatEnemyReferencesInConjunction(child, provesSingleEnemy)
                : resolveThatEnemyReferences(child)),
        };
    }
    return resolveThatEnemyReferences(condition);
}

function parseBooleanCondition(sourceText: string): ConditionExpression {
    const original = sourceText.trim();
    const withoutPrefix = original.replace(/^(?:when|if)\s+/i, "").trim();
    const text = stripOuterConditionParentheses(withoutPrefix);
    const negated = /^not\s+(.+)$/i.exec(text);
    if (negated && isCombatEventLanguage(negated[1])) {
        const child = parseBooleanCondition(negated[1]);
        if (child.op !== "unknown") {
            return { op: "not", child };
        }
    }
    const exact = parseExactConditionClause(text, original);
    if (exact) {
        return exact;
    }

    for (const connector of ["or", "and"] as const) {
        const parts = splitTopLevelCondition(text, connector);
        if (parts.length > 1) {
            return {
                op: connector === "or" ? "any" : "all",
                children: parts.map(parseBooleanCondition),
            };
        }
    }

    const temporalSuffix = parseTemporalSuffixCondition(text);
    if (temporalSuffix) {
        return temporalSuffix;
    }

    return parsePartialSlotCondition(text) ?? { op: "unknown", sourceText: original };
}

function parseExactConditionClause(text: string, sourceText: string): ConditionExpression | undefined {
    const combatEvent = parseExactCombatEventCondition(text, sourceText);
    if (combatEvent) {
        return combatEvent;
    }

    const ki = parseExactKiCondition(text, sourceText);
    if (ki) {
        return ki;
    }

    const enemy = parseExactEnemyCondition(text, sourceText);
    if (enemy) {
        return enemy;
    }

    const hp = parseExactHpCondition(text, sourceText);
    if (hp) {
        return hp;
    }

    const temporal = parseExactTemporalCondition(text, sourceText);
    if (temporal) {
        return temporal;
    }

    const slot = parseExactSlotCondition(text, sourceText);
    if (slot) {
        return slot;
    }

    const allRotationCategory = /^all allies attacking in the same turn are (.+?) Category characters?$/i.exec(text);
    if (allRotationCategory) {
        const categoryValues = parseQuotedValues(allRotationCategory[1]);
        if (categoryValues) {
            return predicateExpression({
                kind: "all_rotation_allies_category",
                scope: "rotation",
                selfInclusion: "included",
                categories: categoryValues.values,
                sourceText,
            });
        }
    }

    const allRotationClass = /^all allies attacking in the same turn are (Super|Extreme) Class characters?$/i.exec(text);
    if (allRotationClass) {
        return predicateExpression({
            kind: "all_rotation_allies_class",
            scope: "rotation",
            selfInclusion: "included",
            classes: [normalizeClass(allRotationClass[1])],
            sourceText,
        });
    }

    if (/^(?:the team includes all five Types|all five Types are represented on the team)$/i.test(text)) {
        return {
            op: "all",
            children: TEAM_ANALYSIS_TYPES.map(type => predicateExpression({
                kind: "ally_type_present",
                scope: "team",
                selfInclusion: "included",
                types: [type],
                sourceText,
            })),
        };
    }

    const selfClass = /^(?:the|this) character is (Super|Extreme) Class$/i.exec(text);
    if (selfClass) {
        return predicateExpression({
            kind: "character_class",
            scope: "self",
            classes: [normalizeClass(selfClass[1])],
            sourceText,
        });
    }
    const selfType = /^(?:the|this) character is (AGL|TEQ|INT|STR|PHY) Type$/i.exec(text);
    if (selfType) {
        return predicateExpression({
            kind: "character_type",
            scope: "self",
            types: [normalizeType(selfType[1])],
            sourceText,
        });
    }

    const onlyTypeInRotation = /^(?:the|this) character is the only (AGL|TEQ|INT|STR|PHY) Type ally attacking in the (?:same )?turn$/i.exec(text);
    if (onlyTypeInRotation) {
        const type = normalizeType(onlyTypeInRotation[1]);
        return {
            op: "all",
            children: [
                predicateExpression({
                    kind: "character_type",
                    scope: "self",
                    types: [type],
                    sourceText,
                }),
                {
                    op: "not",
                    child: allyPredicate("type", type, "rotation", "excluded", undefined, undefined, sourceText),
                },
            ],
        };
    }

    return parseAllyConditionClause(text, sourceText);
}

interface ParsedCombatEventIdentity {
    eventType: CombatEventType,
    actor: CombatEventActor,
    attackKind: CombatAttackKind,
    attackStyle?: CombatAttackStyle,
    predicateKind: PassivePredicateKind,
    actorSource: CalculationPhaseResolutionSource,
    attackKindSource: CalculationPhaseResolutionSource,
    attackStyleSource?: CalculationPhaseResolutionSource,
}

function isCombatEventLanguage(sourceText: string): boolean {
    return /\b(?:attacks?|Super Attacks?|evad(?:e|ed|ing)|final blow)\b/i.test(sourceText);
}

type CombatEventDirection = "performed" | "targeted" | "landed" | "evaded" | "final_blow";

function combatEventIdentity(sourceText: string, direction: CombatEventDirection): ParsedCombatEventIdentity {
    if (direction === "final_blow") {
        return {
            eventType: "final_blow_delivered",
            actor: "self",
            attackKind: "unknown",
            predicateKind: "final_blow_delivered",
            actorSource: "explicit_text",
            attackKindSource: "unresolved",
        };
    }
    const superAttack = /\b(?:Super|Ultra Super) Attacks?\b/i.test(sourceText);
    const normalAttack = /\bnormal attacks?\b/i.test(sourceText);
    const attackStyle: CombatAttackStyle | undefined = /\bKi Blast Super Attack\b/i.test(sourceText)
        ? "ki_blast"
        : /\bUnarmed Super Attack\b/i.test(sourceText)
            ? "unarmed"
            : /\bPhysical Super Attack\b/i.test(sourceText)
                ? "physical"
                : superAttack
                    ? "unknown"
                    : undefined;
    const eventType: CombatEventType = direction === "performed"
        ? "attack_performed"
        : direction === "targeted"
            ? "incoming_attack"
            : direction === "landed"
                ? "attack_landed"
                : "attack_evaded";
    const predicateKind: PassivePredicateKind = direction === "performed"
        ? superAttack ? "super_attacks_performed" : "attacks_performed"
        : direction === "targeted"
            ? superAttack ? "incoming_super_attack" : "incoming_attack"
            : direction === "landed"
                ? superAttack ? "super_attack_received" : "attacks_received"
                : "attacks_evaded";
    return {
        eventType,
        actor: direction === "performed" ? "self" : "enemy",
        attackKind: superAttack ? "super_attack" : normalAttack ? "normal_attack" : "unknown",
        ...(attackStyle ? { attackStyle } : {}),
        predicateKind,
        actorSource: "documented_domain_rule",
        attackKindSource: superAttack || normalAttack ? "explicit_text" : "unresolved",
        ...(attackStyle ? { attackStyleSource: attackStyle === "unknown" ? "unresolved" : "explicit_text" } : {}),
    };
}

function combatEventDescriptor(
    identity: ParsedCombatEventIdentity,
    mode: CombatEventMode,
    relativeTiming: CombatEventRelativeTiming,
    options?: {
        countScope?: CombatEventCountScope,
        countScopeSource?: CalculationPhaseResolutionSource,
        relativeTimingSource?: CalculationPhaseResolutionSource,
        modeSource?: CalculationPhaseResolutionSource,
    },
): CombatEventDescriptor {
    return {
        eventType: identity.eventType,
        actor: identity.actor,
        attackKind: identity.attackKind,
        ...(identity.attackStyle ? { attackStyle: identity.attackStyle } : {}),
        mode,
        ...(options?.countScope ? { countScope: options.countScope } : {}),
        relativeTiming,
        provenance: {
            eventType: "explicit_text",
            actor: identity.actorSource,
            attackKind: identity.attackKindSource,
            ...(identity.attackStyleSource ? { attackStyle: identity.attackStyleSource } : {}),
            mode: options?.modeSource ?? "explicit_text",
            ...(options?.countScopeSource ? { countScope: options.countScopeSource } : {}),
            relativeTiming: options?.relativeTimingSource ?? "explicit_text",
        },
    };
}

function combatPredicate(
    identity: ParsedCombatEventIdentity,
    descriptor: CombatEventDescriptor,
    sourceText: string,
    comparator?: PassivePredicate["comparator"],
    value?: number,
): ConditionExpression {
    return predicateExpression({
        kind: identity.predicateKind,
        scope: "self",
        ...(comparator ? { comparator } : {}),
        ...(value !== undefined ? { value } : {}),
        combatEvent: descriptor,
        sourceText,
    });
}

function parseCombatCountScope(sourceText: string): {
    countScope: CombatEventCountScope,
    source: CalculationPhaseResolutionSource,
} {
    if (/\b(?:within|in) (?:the )?(?:current )?turn\b/i.test(sourceText)) {
        return { countScope: "current_turn", source: "explicit_text" };
    }
    if (/\b(?:in|throughout) (?:the )?battle\b/i.test(sourceText)) {
        return { countScope: "battle", source: "explicit_text" };
    }
    return { countScope: "unknown", source: "unresolved" };
}

function parseExactCombatEventCondition(text: string, sourceText: string): ConditionExpression | undefined {
    if (/^Every time\b/i.test(text)) {
        return undefined;
    }

    if (/^after receiving or evading an? attack$/i.test(text)) {
        const received = combatEventIdentity("attack", "landed");
        const evaded = combatEventIdentity("attack", "evaded");
        return {
            op: "any",
            children: [received, evaded].map(identity => combatPredicate(
                identity,
                combatEventDescriptor(identity, "current_event", "after_event"),
                sourceText,
            )),
        };
    }

    const interval = /^(?:after\s+)?(performing|receiving|evading)\s+between\s+(\d+)\s+and\s+(\d+)\s+((?:(?:Ki Blast|Unarmed|Physical)\s+)?(?:Super\s+)?attacks?)\s*((?:(?:in|throughout) (?:the )?battle|(?:within|in) (?:the )?(?:current )?turn)?)$/i.exec(text);
    if (interval) {
        const lower = Number(interval[2]);
        const upper = Number(interval[3]);
        if (!Number.isInteger(lower) || !Number.isInteger(upper) || lower < 0 || lower > upper) {
            return undefined;
        }
        const direction = /^performing$/i.test(interval[1]) ? "performed" : /^receiving$/i.test(interval[1]) ? "landed" : "evaded";
        const identity = combatEventIdentity(interval[4], direction);
        const scope = parseCombatCountScope(interval[5]);
        const descriptor = combatEventDescriptor(identity, "accumulated_count", "after_event", {
            countScope: scope.countScope,
            countScopeSource: scope.source,
        });
        return {
            op: "all",
            children: [
                combatPredicate(identity, descriptor, sourceText, "gte", lower),
                combatPredicate(identity, descriptor, sourceText, "lte", upper),
            ],
        };
    }

    const counted = /^(after|before)\s+(performing|receiving|evading)\s+(?:(exactly|at least|at most)\s+)?(\d+)(?:\s+or\s+(more|less))?\s+((?:(?:Ki Blast|Unarmed|Physical)\s+)?(?:Super\s+)?attacks?)\s*((?:(?:in|throughout) (?:the )?battle|(?:within|in) (?:the )?(?:current )?turn)?)$/i.exec(text);
    if (counted) {
        const value = Number(counted[4]);
        if (!Number.isInteger(value) || value < 0) {
            return undefined;
        }
        const direction = /^performing$/i.test(counted[2]) ? "performed" : /^receiving$/i.test(counted[2]) ? "landed" : "evaded";
        const identity = combatEventIdentity(counted[6], direction);
        const scope = parseCombatCountScope(counted[7]);
        const comparator: PassivePredicate["comparator"] = counted[5]
            ? /^more$/i.test(counted[5]) ? "gte" : "lte"
            : /^at least$/i.test(counted[3] ?? "") ? "gte"
                : /^at most$/i.test(counted[3] ?? "") ? "lte"
                    : /^exactly$/i.test(counted[3] ?? "") ? "eq"
            : /^before$/i.test(counted[1]) ? "lt" : "gte";
        // "Before receiving N attacks" is a comparator over already resolved
        // history (count < N), not proof that a landed outcome exists before
        // resolution. Completed event counters therefore remain after-event.
        return combatPredicate(
            identity,
            combatEventDescriptor(identity, "accumulated_count", "after_event", {
                countScope: scope.countScope,
                countScopeSource: scope.source,
            }),
            sourceText,
            comparator,
            value,
        );
    }

    const currentPatterns: Array<{
        pattern: RegExp,
        direction: CombatEventDirection,
        timing: CombatEventRelativeTiming,
    }> = [
        { pattern: /^(?:attacking|performing an? attack)$/i, direction: "performed", timing: "during_event" },
        { pattern: /^before (?:attacking|performing an? attack)$/i, direction: "performed", timing: "before_event" },
        { pattern: /^after (?:attacking|performing an? attack)$/i, direction: "performed", timing: "after_event" },
        { pattern: /^(?:when )?performing an? ((?:(?:Ki Blast|Unarmed|Physical)\s+)?(?:Super|Ultra Super) Attack)$/i, direction: "performed", timing: "during_event" },
        { pattern: /^after performing an? ((?:(?:Ki Blast|Unarmed|Physical)\s+)?(?:Super|Ultra Super) Attack)$/i, direction: "performed", timing: "after_event" },
        { pattern: /^(?:when )?receiving an? ((?:(?:Ki Blast|Unarmed|Physical)\s+)?(?:normal|Super) attack)$/i, direction: "targeted", timing: "during_event" },
        { pattern: /^(?:receiving|when receiving) an? attack$/i, direction: "targeted", timing: "during_event" },
        { pattern: /^before receiving an? attack(?: within the turn)?$/i, direction: "targeted", timing: "before_event" },
        { pattern: /^after (?:receiving|being hit by) an? attack$/i, direction: "landed", timing: "after_event" },
        { pattern: /^(?:when )?evading an? attack$/i, direction: "evaded", timing: "during_event" },
        { pattern: /^after evading an? attack$/i, direction: "evaded", timing: "after_event" },
        { pattern: /^after delivering (?:a |the )?final blow$/i, direction: "final_blow", timing: "after_event" },
        { pattern: /^(?:when )?delivering (?:a |the )?final blow$/i, direction: "final_blow", timing: "during_event" },
    ];
    for (const candidate of currentPatterns) {
        const match = candidate.pattern.exec(text);
        if (!match) {
            continue;
        }
        const identity = combatEventIdentity(match[1] ?? text, candidate.direction);
        return combatPredicate(
            identity,
            combatEventDescriptor(identity, "current_event", candidate.timing),
            sourceText,
        );
    }
    return undefined;
}

function parseExactKiCondition(text: string, sourceText: string): ConditionExpression | undefined {
    const interval = /^(?:attacking|before attacking) with (?:between\s+)?(\d+)\s+(?:and|to)\s+(\d+) Ki$/i.exec(text);
    if (interval) {
        const lower = Number(interval[1]);
        const upper = Number(interval[2]);
        if (!isKiAmount(lower) || !isKiAmount(upper) || lower > upper) {
            return undefined;
        }
        const evaluationMoment: PassiveEvaluationMoment = /^before attacking/i.test(text)
            ? "before_attack"
            : "when_attacking";
        return {
            op: "all",
            children: [
                kiAmountPredicate("gte", lower, evaluationMoment, sourceText),
                kiAmountPredicate("lte", upper, evaluationMoment, sourceText),
            ],
        };
    }

    const amount = /^(attacking|before attacking) with (?:(exactly|at least|at most)\s+)?(\d+)(?:\s+or\s+(more|less))? Ki$/i.exec(text);
    if (amount) {
        const value = Number(amount[3]);
        if (!isKiAmount(value)) {
            return undefined;
        }
        const comparator: PassivePredicate["comparator"] = /^at least$/i.test(amount[2] ?? "") || /^more$/i.test(amount[4] ?? "")
            ? "gte"
            : /^at most$/i.test(amount[2] ?? "") || /^less$/i.test(amount[4] ?? "")
                ? "lte"
                : "eq";
        return kiAmountPredicate(
            comparator,
            value,
            /^before attacking$/i.test(amount[1]) ? "before_attack" : "when_attacking",
            sourceText,
        );
    }

    const sphereInterval = /^(?:attacking with\s+|with\s+)?(?:between\s+)?(\d+)\s+(?:and|to)\s+(\d+)\s*(.*?)\s*Ki Spheres? obtained$/i.exec(text);
    if (sphereInterval) {
        const lower = Number(sphereInterval[1]);
        const upper = Number(sphereInterval[2]);
        const kiSphereTypes = parseKiSphereTypes(sphereInterval[3]);
        if (!isKiSphereCount(lower) || !isKiSphereCount(upper) || lower > upper || !kiSphereTypes) {
            return undefined;
        }
        return {
            op: "all",
            children: [
                kiSphereCountPredicate("gte", lower, kiSphereTypes, sourceText),
                kiSphereCountPredicate("lte", upper, kiSphereTypes, sourceText),
            ],
        };
    }

    const sphereCount = /^(?:attacking with\s+|with\s+)?(?:(exactly|at least|at most)\s+)?(\d+)(?:\s+or\s+(more|less))?\s*(.*?)\s*Ki Spheres? obtained$/i.exec(text);
    if (sphereCount) {
        const value = Number(sphereCount[2]);
        const kiSphereTypes = parseKiSphereTypes(sphereCount[4]);
        if (!isKiSphereCount(value) || !kiSphereTypes) {
            return undefined;
        }
        const comparator: PassivePredicate["comparator"] = /^at least$/i.test(sphereCount[1] ?? "") || /^more$/i.test(sphereCount[3] ?? "")
            ? "gte"
            : /^at most$/i.test(sphereCount[1] ?? "") || /^less$/i.test(sphereCount[3] ?? "")
                ? "lte"
                : "eq";
        return kiSphereCountPredicate(comparator, value, kiSphereTypes, sourceText);
    }

    const spherePresence = /^With\s+an?\s*(.*?)\s*Ki Sphere obtained$/i.exec(text);
    if (spherePresence) {
        const kiSphereTypes = parseKiSphereTypes(spherePresence[1]);
        if (kiSphereTypes) {
            return predicateExpression({
                kind: "ki_sphere_type_obtained",
                scope: "self",
                comparator: "gte",
                value: 1,
                kiSphereTypes,
                kiContext: "collected_ki_spheres",
                sourceText,
            });
        }
    }
    return undefined;
}

function kiAmountPredicate(
    comparator: PassivePredicate["comparator"],
    value: number,
    evaluationMoment: PassiveEvaluationMoment,
    sourceText: string,
): ConditionExpression {
    return predicateExpression({
        kind: "ki_amount",
        scope: "self",
        comparator,
        value,
        evaluationMoment,
        kiContext: "final_attack_ki",
        sourceText,
    });
}

function kiSphereCountPredicate(
    comparator: PassivePredicate["comparator"],
    value: number,
    kiSphereTypes: KiSphereType[],
    sourceText: string,
): ConditionExpression {
    return predicateExpression({
        kind: "ki_spheres_obtained",
        scope: "self",
        comparator,
        value,
        kiSphereTypes,
        kiContext: "collected_ki_spheres",
        sourceText,
    });
}

function isKiAmount(value: number): boolean {
    return Number.isInteger(value) && value >= 0 && value <= 24;
}

function isKiSphereCount(value: number): boolean {
    return Number.isInteger(value) && value >= 0;
}

function parseExactEnemyCondition(text: string, sourceText: string): ConditionExpression | undefined {
    const exact = parseEnemyCountCondition(text, sourceText)
        ?? parseEnemyHpCondition(text, sourceText)
        ?? parseEnemyStatusCondition(text, sourceText)
        ?? parseEnemyNameCondition(text, sourceText)
        ?? parseEnemyAttributeCondition(text, sourceText);
    if (exact) {
        return exact;
    }

    const qualifiedStatus = /^(.*?)\s+if\s+((?:the )?(?:target|attacked|selected) enemy is in the following status:\s*.+)$/i.exec(text);
    if (qualifiedStatus) {
        const status = parseEnemyStatusCondition(qualifiedStatus[2], sourceText);
        if (status) {
            return {
                op: "all",
                children: [
                    { op: "unknown", sourceText: qualifiedStatus[1].trim() },
                    status,
                ],
            };
        }
    }

    const missingStatusWithHp = /^((?:the )?(?:target|attacked|selected) enemy is in the following status:)\s+HP is\s+(.+?)(\s*,.*)?$/i.exec(text);
    if (missingStatusWithHp) {
        const hp = parseEnemyHpComparison(
            missingStatusWithHp[2],
            sourceText,
            "current_target",
        );
        if (hp) {
            return {
                op: "all",
                children: [
                    { op: "unknown", sourceText: missingStatusWithHp[1] },
                    hp,
                    ...(missingStatusWithHp[3]
                        ? [{ op: "unknown" as const, sourceText: missingStatusWithHp[3].trim() }]
                        : []),
                ],
            };
        }
    }

    const excludedQualifier = /^(.*?)\s+(\([^)]*\bexcluded\))$/i.exec(text);
    if (excludedQualifier) {
        const known = parseEnemyNameCondition(excludedQualifier[1], sourceText);
        if (known) {
            return {
                op: "all",
                children: [known, { op: "unknown", sourceText: excludedQualifier[2] }],
            };
        }
    }
    return undefined;
}

function parseEnemyCountCondition(text: string, sourceText: string): ConditionExpression | undefined {
    const matchingClassCount = /^facing\s+(\d+)\s+or more\s+(Super|Extreme) Class enemies$/i.exec(text);
    if (matchingClassCount && Number(matchingClassCount[1]) > 0) {
        return predicateExpression({
            kind: "enemy_class",
            scope: "enemy",
            enemySelection: "any_enemy",
            comparator: "gte",
            count: Number(matchingClassCount[1]),
            classes: [normalizeClass(matchingClassCount[2])],
            sourceText,
        });
    }
    if (/^(?:facing|there (?:is|are))\s+multiple enemies$/i.test(text)) {
        return enemyCountPredicate("gte", 2, sourceText);
    }
    if (/^(?:facing|there (?:is|are))\s+no enemies$/i.test(text)) {
        return enemyCountPredicate("eq", 0, sourceText);
    }

    const only = /^(?:facing|there (?:is|are))\s+only\s+(\d+)\s+enem(?:y|ies)$/i.exec(text);
    if (only) {
        return enemyCountPredicateIfValid("eq", Number(only[1]), sourceText);
    }
    const qualified = /^(?:facing|there (?:is|are))\s+(\d+)\s+or\s+(more|less)\s+enemies$/i.exec(text)
        ?? /^(\d+)\s+or\s+(more|less)\s+enemies$/i.exec(text);
    if (qualified) {
        return enemyCountPredicateIfValid(
            qualified[2].toLowerCase() === "more" ? "gte" : "lte",
            Number(qualified[1]),
            sourceText,
        );
    }
    const exact = /^(?:facing|there (?:is|are))\s+(\d+)\s+enem(?:y|ies)$/i.exec(text);
    return exact ? enemyCountPredicateIfValid("eq", Number(exact[1]), sourceText) : undefined;
}

function enemyCountPredicateIfValid(
    comparator: "eq" | "lte" | "gte",
    value: number,
    sourceText: string,
): ConditionExpression | undefined {
    return isEnemyCount(value) ? enemyCountPredicate(comparator, value, sourceText) : undefined;
}

function enemyCountPredicate(
    comparator: "eq" | "lte" | "gte",
    value: number,
    sourceText: string,
): ConditionExpression {
    return predicateExpression({
        kind: "enemy_count",
        scope: "battle",
        comparator,
        value,
        sourceText,
    });
}

function isEnemyCount(value: number): boolean {
    return Number.isInteger(value) && value >= 0;
}

function parseEnemyHpCondition(text: string, sourceText: string): ConditionExpression | undefined {
    let body = text.trim();
    let evaluationMoment: PassiveEvaluationMoment | undefined;

    const beforeAttack = /^before attacking\s+/i.exec(body);
    if (beforeAttack) {
        evaluationMoment = "before_attack";
        body = body.slice(beforeAttack[0].length).trim();
    }
    const momentSuffixes: Array<{ pattern: RegExp, moment: PassiveEvaluationMoment }> = [
        { pattern: /\s+at the start of (?:the )?turn$/i, moment: "start_of_turn" },
        { pattern: /\s+when attacking$/i, moment: "when_attacking" },
    ];
    for (const suffix of momentSuffixes) {
        const match = suffix.pattern.exec(body);
        if (match) {
            evaluationMoment = suffix.moment;
            body = body.slice(0, match.index).trim();
            break;
        }
    }

    let enemySelection: EnemySelection;
    let comparisonText: string;
    const selected = /^(?:(?:the )?(?:target|attacked|selected) enemy|an? enemy being attacked)['’]s HP is\s+(.+)$/i.exec(body);
    const whose = /^an? enemy whose HP is\s+(.+)$/i.exec(body);
    const withHp = /^facing an? enemy with\s+(.+)\s+HP$/i.exec(body);
    const only = /^that enemy['’]s HP is\s+(.+)$/i.exec(body);
    const ambiguous = /^(?:the )?enemy['’]s HP is\s+(.+)$/i.exec(body);
    if (selected) {
        enemySelection = "current_target";
        comparisonText = selected[1];
    } else if (whose) {
        enemySelection = evaluationMoment === "before_attack" ? "current_target" : "any_enemy";
        comparisonText = whose[1];
    } else if (withHp) {
        enemySelection = "any_enemy";
        comparisonText = withHp[1];
    } else if (only) {
        enemySelection = "unknown";
        comparisonText = only[1];
    } else if (ambiguous) {
        enemySelection = "unknown";
        comparisonText = ambiguous[1];
    } else {
        return undefined;
    }
    const condition = parseEnemyHpComparison(comparisonText, sourceText, enemySelection, evaluationMoment);
    if (!only || !condition) {
        return condition;
    }
    return mapConditionPredicates(condition, predicate => ({
        ...predicate,
        enemyReference: "that_enemy",
    }));
}

function mapConditionPredicates(
    condition: ConditionExpression,
    transform: (predicate: PassivePredicate) => PassivePredicate,
): ConditionExpression {
    if (condition.op === "predicate") {
        return predicateExpression(transform(condition.predicate));
    }
    if (condition.op === "all" || condition.op === "any") {
        return { op: condition.op, children: condition.children.map(child => mapConditionPredicates(child, transform)) };
    }
    if (condition.op === "not") {
        return { op: "not", child: mapConditionPredicates(condition.child, transform) };
    }
    return condition;
}

function parseEnemyHpComparison(
    comparisonText: string,
    sourceText: string,
    enemySelection: EnemySelection,
    evaluationMoment?: PassiveEvaluationMoment,
): ConditionExpression | undefined {
    const interval = /^between\s+(\d+)%\s+and\s+(\d+)%$/i.exec(comparisonText);
    if (interval) {
        const minimum = Number(interval[1]);
        const maximum = Number(interval[2]);
        if (!isHpPercent(minimum) || !isHpPercent(maximum) || minimum > maximum) {
            return undefined;
        }
        return {
            op: "all",
            children: [
                enemyHpPredicate("gte", minimum, sourceText, enemySelection, evaluationMoment),
                enemyHpPredicate("lte", maximum, sourceText, enemySelection, evaluationMoment),
            ],
        };
    }
    const exact = /^exactly\s+(\d+)%$/i.exec(comparisonText);
    if (exact) {
        return enemyHpPredicateIfValid("eq", Number(exact[1]), sourceText, enemySelection, evaluationMoment);
    }
    const strict = /^(above|below)\s+(\d+)%$/i.exec(comparisonText);
    if (strict) {
        return enemyHpPredicateIfValid(
            strict[1].toLowerCase() === "above" ? "gt" : "lt",
            Number(strict[2]),
            sourceText,
            enemySelection,
            evaluationMoment,
        );
    }
    const qualified = /^(\d+)%\s+or\s+(more|less|above|below)$/i.exec(comparisonText);
    if (qualified) {
        const qualifier = qualified[2].toLowerCase();
        return enemyHpPredicateIfValid(
            qualifier === "more" || qualifier === "above" ? "gte" : "lte",
            Number(qualified[1]),
            sourceText,
            enemySelection,
            evaluationMoment,
        );
    }
    const plain = /^(\d+)%$/i.exec(comparisonText);
    return plain
        ? enemyHpPredicateIfValid("eq", Number(plain[1]), sourceText, enemySelection, evaluationMoment)
        : undefined;
}

function enemyHpPredicateIfValid(
    comparator: "lt" | "lte" | "eq" | "gte" | "gt",
    value: number,
    sourceText: string,
    enemySelection: EnemySelection,
    evaluationMoment?: PassiveEvaluationMoment,
): ConditionExpression | undefined {
    return isHpPercent(value)
        ? enemyHpPredicate(comparator, value, sourceText, enemySelection, evaluationMoment)
        : undefined;
}

function enemyHpPredicate(
    comparator: "lt" | "lte" | "eq" | "gte" | "gt",
    value: number,
    sourceText: string,
    enemySelection: EnemySelection,
    evaluationMoment?: PassiveEvaluationMoment,
): ConditionExpression {
    return predicateExpression({
        kind: "enemy_hp_percent",
        scope: "enemy",
        comparator,
        value,
        enemySelection,
        ...(evaluationMoment ? { evaluationMoment } : {}),
        sourceText,
    });
}

function parseEnemyStatusCondition(text: string, sourceText: string): ConditionExpression | undefined {
    const header = /^(?:the )?(target|attacked|selected) enemy is in the following status:\s*(.+)$/i.exec(text);
    if (header) {
        return parseEnemyStatusValues(header[2], "current_target", sourceText);
    }

    const possessiveSeal = /^(?:the )?(target|attacked|selected) enemy['’]s Super Attack is (not )?sealed$/i.exec(text);
    if (possessiveSeal) {
        const predicate = enemyStatusPredicate("super_attack_sealed", "current_target", sourceText);
        return possessiveSeal[2] ? { op: "not", child: predicate } : predicate;
    }

    const forms: Array<{ pattern: RegExp, selection: EnemySelection }> = [
        { pattern: /^there (?:is|are) an? (.+?) enem(?:y|ies)$/i, selection: "any_enemy" },
        { pattern: /^all enemies are (.+)$/i, selection: "all_enemies" },
        { pattern: /^(?:the )?(?:target|attacked|selected) enemy (?:is|has) (.+)$/i, selection: "current_target" },
        { pattern: /^the only enemy (?:is|has) (.+)$/i, selection: "only_enemy" },
        { pattern: /^the enemy (?:is|has) (.+)$/i, selection: "unknown" },
    ];
    for (const form of forms) {
        const match = form.pattern.exec(text);
        if (!match) {
            continue;
        }
        let value = match[1].trim();
        let negated = false;
        if (/^not\s+/i.test(value)) {
            negated = true;
            value = value.replace(/^not\s+/i, "");
        }
        const status = parseEnemyStatusTerm(value);
        if (status) {
            const predicate = enemyStatusPredicate(status, form.selection, sourceText);
            return negated ? { op: "not", child: predicate } : predicate;
        }
    }

    const noStatus = /^there are no\s+(.+?)\s+enemies$/i.exec(text);
    if (noStatus) {
        const status = parseEnemyStatusTerm(noStatus[1]);
        return status
            ? { op: "not", child: enemyStatusPredicate(status, "any_enemy", sourceText) }
            : undefined;
    }
    return undefined;
}

function parseEnemyStatusValues(
    sourceText: string,
    selection: EnemySelection,
    predicateSourceText: string,
): ConditionExpression | undefined {
    const atomPattern = /ATK Down|DEF Down|stunned|Super Attack sealed|unresolved enemy status|HP is (?:between\s+\d+%\s+and\s+\d+%|exactly\s+\d+%|(?:above|below)\s+\d+%|\d+%(?:\s+or\s+(?:more|less|above|below))?)/gi;
    const matches = [...sourceText.matchAll(atomPattern)];
    const hasStatusAtom = matches.some(match => !/^HP is /i.test(match[0]));
    if (!hasStatusAtom || matches.some(match => match.index === undefined)) {
        return undefined;
    }
    const separators: string[] = [];
    let cursor = 0;
    for (const match of matches) {
        const separator = sourceText.slice(cursor, match.index).trim();
        if (cursor === 0) {
            if (separator) return undefined;
        } else {
            if (!/^(?:,|and|or|,\s*(?:and|or))$/i.test(separator)) return undefined;
            separators.push(separator.toLowerCase());
        }
        cursor = (match.index ?? 0) + match[0].length;
    }
    const trailing = sourceText.slice(cursor).trim();
    if (trailing && trailing !== ",") {
        return undefined;
    }
    const children: ConditionExpression[] = matches.map(match => {
        if (/^unresolved enemy status$/i.test(match[0])) {
            return { op: "unknown", sourceText: predicateSourceText } as ConditionExpression;
        }
        if (/^HP is /i.test(match[0])) {
            return parseEnemyHpComparison(
                match[0].replace(/^HP is\s+/i, ""),
                predicateSourceText,
                selection,
            ) ?? { op: "unknown" as const, sourceText: predicateSourceText };
        }
        return enemyStatusPredicate(
            parseEnemyStatusTerm(match[0]) as EnemyStatus,
            selection,
            predicateSourceText,
        );
    });
    if (children.length === 1) {
        return trailing
            ? { op: "all", children: [children[0], { op: "unknown", sourceText: predicateSourceText }] }
            : children[0];
    }
    const hasAnd = separators.some(separator => /\band\b/.test(separator));
    const hasOr = separators.some(separator => /\bor\b/.test(separator));
    if (!hasAnd && !hasOr) {
        return { op: "unknown", sourceText: predicateSourceText };
    }
    if (hasAnd && hasOr) {
        return combineStatusAtomsWithPrecedence(children, separators, predicateSourceText, trailing === ",");
    }
    const condition: ConditionExpression = {
        op: hasAnd ? "all" : "any",
        children,
    };
    return trailing
        ? { op: "all", children: [condition, { op: "unknown", sourceText: predicateSourceText }] }
        : condition;
}

function combineStatusAtomsWithPrecedence(
    children: ConditionExpression[],
    separators: string[],
    sourceText: string,
    hasTrailingResidual: boolean,
): ConditionExpression {
    const groups: ConditionExpression[][] = [[children[0]]];
    separators.forEach((separator, index) => {
        if (/\bor\b/.test(separator)) {
            groups.push([children[index + 1]]);
        } else {
            groups[groups.length - 1].push(children[index + 1]);
        }
    });
    const condition: ConditionExpression = groups.length === 1
        ? { op: "all", children: groups[0] }
        : {
            op: "any",
            children: groups.map(group => group.length === 1 ? group[0] : { op: "all", children: group }),
        };
    return hasTrailingResidual
        ? { op: "all", children: [condition, { op: "unknown", sourceText }] }
        : condition;
}

function parseEnemyStatusTerm(sourceText: string): EnemyStatus | undefined {
    const normalized = sourceText.trim().toLowerCase();
    if (normalized === "atk down") return "atk_down";
    if (normalized === "def down") return "def_down";
    if (normalized === "stunned") return "stunned";
    if (normalized === "super attack sealed") return "super_attack_sealed";
    return undefined;
}

function enemyStatusPredicate(
    status: EnemyStatus,
    enemySelection: EnemySelection,
    sourceText: string,
): ConditionExpression {
    return predicateExpression({
        kind: "enemy_status",
        scope: "enemy",
        enemySelection,
        enemyStatuses: [status],
        sourceText,
    });
}

function parseEnemyNameCondition(text: string, sourceText: string): ConditionExpression | undefined {
    const includesForms: Array<{ pattern: RegExp, selection: EnemySelection }> = [
        { pattern: /^there (?:is|are) an? enem(?:y|ies) whose name includes\s+(.+)$/i, selection: "any_enemy" },
        { pattern: /^attacking an? enemy whose name includes\s+(.+)$/i, selection: "current_target" },
        { pattern: /^(?:the )?(?:target|attacked|selected) enemy['’]s name includes\s+(.+)$/i, selection: "current_target" },
        { pattern: /^the only enemy['’]s name includes\s+(.+)$/i, selection: "only_enemy" },
        { pattern: /^the enemy['’]s name includes\s+(.+)$/i, selection: "unknown" },
    ];
    for (const form of includesForms) {
        const match = form.pattern.exec(text);
        if (match) {
            return buildEnemyNameExpression(match[1], "includes", form.selection, sourceText);
        }
    }

    const noIncludes = /^there (?:is|are) no enem(?:y|ies) whose name includes\s+(.+)$/i.exec(text);
    if (noIncludes) {
        const expression = buildEnemyNameExpression(noIncludes[1], "includes", "any_enemy", sourceText);
        return expression ? { op: "not", child: expression } : undefined;
    }

    const exactForms: Array<{ pattern: RegExp, selection: EnemySelection }> = [
        { pattern: /^(.+) is an enemy$/i, selection: "any_enemy" },
        { pattern: /^(?:the )?(?:target|attacked|selected) enemy['’]s name is\s+(.+)$/i, selection: "current_target" },
        { pattern: /^the only enemy['’]s name is\s+(.+)$/i, selection: "only_enemy" },
        { pattern: /^the enemy['’]s name is\s+(.+)$/i, selection: "unknown" },
    ];
    for (const form of exactForms) {
        const match = form.pattern.exec(text);
        if (match) {
            return buildEnemyNameExpression(match[1], "exact", form.selection, sourceText);
        }
    }
    return undefined;
}

function buildEnemyNameExpression(
    sourceValues: string,
    nameMatch: EnemyNameMatch,
    enemySelection: EnemySelection,
    sourceText: string,
): ConditionExpression | undefined {
    const exclusion = /^(.*?)\s*,?\s+excluding\s+(.+)$/i.exec(sourceValues);
    const includedText = exclusion?.[1] ?? sourceValues;
    const included = parseQuotedValues(includedText);
    if (!included) {
        return undefined;
    }
    const excluded = exclusion ? parseQuotedValues(exclusion[2]) : undefined;
    if (exclusion && !excluded) {
        return undefined;
    }
    const children = included.values.map(name => predicateExpression({
        kind: "enemy_name",
        scope: "enemy",
        enemySelection,
        names: [name],
        nameMatch,
        ...(excluded ? { excludedNames: excluded.values, excludedNameMatch: nameMatch } : {}),
        sourceText,
    }));
    return children.length === 1
        ? children[0]
        : { op: included.connector === "and" ? "all" : "any", children };
}

function parseEnemyAttributeCondition(text: string, sourceText: string): ConditionExpression | undefined {
    const forms: Array<{ pattern: RegExp, selection: EnemySelection, negated?: boolean }> = [
        { pattern: /^there (?:is|are) no\s+(.+?)\s+enemies$/i, selection: "any_enemy", negated: true },
        { pattern: /^there (?:is|are)\s+(?:an?\s+)?(.+?)\s+enem(?:y|ies)$/i, selection: "any_enemy" },
        { pattern: /^an?\s+(.+?)\s+enemy$/i, selection: "any_enemy" },
        { pattern: /^attacking\s+(?:an?\s+)?(.+?)\s+enemy$/i, selection: "current_target" },
        { pattern: /^all enemies are\s+(.+)$/i, selection: "all_enemies" },
        { pattern: /^the only enemy is\s+(.+)$/i, selection: "only_enemy" },
        { pattern: /^(?:the )?(?:target|attacked|selected) enemy is\s+(.+)$/i, selection: "current_target" },
        { pattern: /^the enemy is\s+(.+)$/i, selection: "unknown" },
    ];
    for (const form of forms) {
        const match = form.pattern.exec(text);
        if (!match) {
            continue;
        }
        const expression = parseEnemyAttribute(match[1], form.selection, sourceText);
        if (expression) {
            return form.negated ? { op: "not", child: expression } : expression;
        }
    }
    return undefined;
}

function parseEnemyAttribute(
    sourceText: string,
    enemySelection: EnemySelection,
    predicateSourceText: string,
): ConditionExpression | undefined {
    const classType = /^(Super|Extreme)(?: Class)?\s+(AGL|TEQ|INT|STR|PHY)(?: Type)?$/i.exec(sourceText);
    if (classType) {
        return predicateExpression({
            kind: "enemy_class_type",
            scope: "enemy",
            enemySelection,
            classes: [normalizeClass(classType[1])],
            types: [normalizeType(classType[2])],
            sourceText: predicateSourceText,
        });
    }
    const classMatch = /^(Super|Extreme) Class$/i.exec(sourceText);
    if (classMatch) {
        return predicateExpression({
            kind: "enemy_class",
            scope: "enemy",
            enemySelection,
            classes: [normalizeClass(classMatch[1])],
            sourceText: predicateSourceText,
        });
    }
    const typeMatch = /^(AGL|TEQ|INT|STR|PHY) Type$/i.exec(sourceText);
    if (typeMatch) {
        return predicateExpression({
            kind: "enemy_type",
            scope: "enemy",
            enemySelection,
            types: [normalizeType(typeMatch[1])],
            sourceText: predicateSourceText,
        });
    }
    const categoryMatch = /^(.+?) Category$/i.exec(sourceText);
    if (categoryMatch) {
        const categories = parseQuotedValues(categoryMatch[1]);
        if (!categories) {
            return undefined;
        }
        const children = categories.values.map(category => predicateExpression({
            kind: "enemy_category",
            scope: "enemy",
            enemySelection,
            categories: [category],
            sourceText: predicateSourceText,
        }));
        return children.length === 1
            ? children[0]
            : { op: categories.connector === "and" ? "all" : "any", children };
    }
    const status = parseEnemyStatusTerm(sourceText);
    return status ? enemyStatusPredicate(status, enemySelection, predicateSourceText) : undefined;
}

function parseExactHpCondition(text: string, sourceText: string): ConditionExpression | undefined {
    let body = text.trim();
    let evaluationMoment: PassiveEvaluationMoment | undefined;

    const startPrefix = /^at the start of (?:the )?turn,?\s+(?:when\s+)?/i.exec(body);
    if (startPrefix) {
        evaluationMoment = "start_of_turn";
        body = body.slice(startPrefix[0].length).trim();
    }

    const entryAtMatch = /^upon entering the attacking turn with HP at\s+(.+)$/i.exec(body);
    const entryValueMatch = /^upon entering the attacking turn with\s+(\d+)% HP(?:\s+(or more|or less|or above|or below))?$/i.exec(body);
    if (entryAtMatch) {
        evaluationMoment = "entry_turn";
        body = `HP is ${entryAtMatch[1]}`;
    } else if (entryValueMatch) {
        evaluationMoment = "entry_turn";
        body = `HP is ${entryValueMatch[1]}%${entryValueMatch[2] ? ` ${entryValueMatch[2]}` : ""}`;
    }

    const momentSuffixes: Array<{ pattern: RegExp, moment: PassiveEvaluationMoment }> = [
        { pattern: /\s+at the start of the character['â€™]s attacking turn$/i, moment: "start_of_turn" },
        { pattern: /\s+at the start of (?:the )?turn$/i, moment: "start_of_turn" },
        { pattern: /\s+at the end of (?:the )?turn$/i, moment: "end_of_turn" },
    ];
    for (const suffix of momentSuffixes) {
        const match = suffix.pattern.exec(body);
        if (match) {
            evaluationMoment = suffix.moment;
            body = body.slice(0, match.index).trim();
            break;
        }
    }

    const interval = /^HP is between\s+(\d+)%\s+and\s+(\d+)%$/i.exec(body);
    if (interval) {
        const minimum = Number(interval[1]);
        const maximum = Number(interval[2]);
        if (!isHpPercent(minimum) || !isHpPercent(maximum) || minimum > maximum) {
            return undefined;
        }
        return {
            op: "all",
            children: [
                hpPredicate("gte", minimum, sourceText, evaluationMoment),
                hpPredicate("lte", maximum, sourceText, evaluationMoment),
            ],
        };
    }

    const exact = /^HP is exactly\s+(\d+)%$/i.exec(body);
    if (exact) {
        return hpPredicateIfValid("eq", Number(exact[1]), sourceText, evaluationMoment);
    }

    const strict = /^HP is\s+(above|below)\s+(\d+)%$/i.exec(body);
    if (strict) {
        return hpPredicateIfValid(
            strict[1].toLowerCase() === "above" ? "gt" : "lt",
            Number(strict[2]),
            sourceText,
            evaluationMoment,
        );
    }

    const qualified = /^HP is\s+(\d+)%\s+or\s+(more|less|above|below)$/i.exec(body);
    if (qualified) {
        const qualifier = qualified[2].toLowerCase();
        return hpPredicateIfValid(
            qualifier === "more" || qualifier === "above" ? "gte" : "lte",
            Number(qualified[1]),
            sourceText,
            evaluationMoment,
        );
    }

    const plain = /^HP is\s+(\d+)%$/i.exec(body);
    return plain
        ? hpPredicateIfValid("eq", Number(plain[1]), sourceText, evaluationMoment)
        : undefined;
}

function hpPredicateIfValid(
    comparator: "lt" | "lte" | "eq" | "gte" | "gt",
    value: number,
    sourceText: string,
    evaluationMoment?: PassiveEvaluationMoment,
): ConditionExpression | undefined {
    return isHpPercent(value) ? hpPredicate(comparator, value, sourceText, evaluationMoment) : undefined;
}

function hpPredicate(
    comparator: "lt" | "lte" | "eq" | "gte" | "gt",
    value: number,
    sourceText: string,
    evaluationMoment?: PassiveEvaluationMoment,
): ConditionExpression {
    return predicateExpression({
        kind: "hp_percent",
        scope: "team",
        comparator,
        value,
        ...(evaluationMoment ? { evaluationMoment } : {}),
        sourceText,
    });
}

function isHpPercent(value: number): boolean {
    return Number.isFinite(value) && value >= 0 && value <= 100;
}

function parseExactTemporalCondition(text: string, sourceText: string): ConditionExpression | undefined {
    const starting = /^starting from the (\d+)(?:st|nd|rd|th) turn from (the start of battle|the character['â€™]s entry turn)$/i.exec(text);
    if (starting) {
        return temporalPredicateIfValid(starting[2], "gte", Number(starting[1]), sourceText);
    }

    const point = /^on the (\d+)(?:st|nd|rd|th) turn(?: from (the start of battle|the character['â€™]s entry turn))?$/i.exec(text);
    if (point) {
        return temporalPredicateIfValid(point[2] ?? "the start of battle", "eq", Number(point[1]), sourceText);
    }

    const pointList = /^on the (.+?) turns from (the start of battle|the character['â€™]s entry turn)$/i.exec(text);
    if (pointList) {
        const values = parseOrdinalValues(pointList[1]);
        if (values) {
            return {
                op: "any",
                children: values.map(value => temporalPredicate(pointList[2], "eq", value, sourceText)),
            };
        }
    }

    const upper = /^up to the (\d+)(?:st|nd|rd|th) turn(?: from (the start of battle|the character['â€™]s entry turn))?$/i.exec(text);
    if (upper) {
        return temporalPredicateIfValid(upper[2] ?? "the start of battle", "lte", Number(upper[1]), sourceText);
    }

    const durationWindow = /^for (\d+) turn(?:s|\(s\))? from (the start of battle|the character['â€™]s entry turn)$/i.exec(text);
    if (durationWindow) {
        const end = Number(durationWindow[1]);
        return temporalWindowIfValid(durationWindow[2], 1, end, sourceText);
    }

    const explicitWindow = /^from the (\d+)(?:st|nd|rd|th) (?:through|to) the (\d+)(?:st|nd|rd|th) turn from (the start of battle|the character['â€™]s entry turn)$/i.exec(text);
    if (explicitWindow) {
        return temporalWindowIfValid(
            explicitWindow[3],
            Number(explicitWindow[1]),
            Number(explicitWindow[2]),
            sourceText,
        );
    }
    return undefined;
}

function temporalWindowIfValid(
    origin: string,
    start: number,
    end: number,
    sourceText: string,
): ConditionExpression | undefined {
    if (!isTurnIndex(start) || !isTurnIndex(end) || start > end) {
        return undefined;
    }
    return {
        op: "all",
        children: [
            temporalPredicate(origin, "gte", start, sourceText),
            temporalPredicate(origin, "lte", end, sourceText),
        ],
    };
}

function temporalPredicateIfValid(
    origin: string,
    comparator: "eq" | "gte" | "lte",
    value: number,
    sourceText: string,
): ConditionExpression | undefined {
    return isTurnIndex(value) ? temporalPredicate(origin, comparator, value, sourceText) : undefined;
}

function temporalPredicate(
    origin: string,
    comparator: "eq" | "gte" | "lte",
    value: number,
    sourceText: string,
): ConditionExpression {
    const fromEntry = /character['â€™]s entry turn/i.test(origin);
    return predicateExpression({
        kind: fromEntry ? "turn_from_entry" : "battle_turn",
        scope: fromEntry ? "self" : "battle",
        comparator,
        value,
        sourceText,
    });
}

function isTurnIndex(value: number): boolean {
    return Number.isInteger(value) && value >= 1;
}

function parseOrdinalValues(sourceText: string): number[] | undefined {
    const values = [...sourceText.matchAll(/\b(\d+)(?:st|nd|rd|th)\b/gi)].map(match => Number(match[1]));
    const separators = sourceText.replace(/\b\d+(?:st|nd|rd|th)\b/gi, "#").trim();
    if (values.length === 0
        || values.some(value => !isTurnIndex(value))
        || !/^#(?:\s*(?:,|&|and|or)\s*#)*$/i.test(separators)) {
        return undefined;
    }
    return values;
}

function parseTemporalSuffixCondition(text: string): ConditionExpression | undefined {
    const suffix = /^(.*?)\s+(starting from the \d+(?:st|nd|rd|th) turn from (?:the start of battle|the character['â€™]s entry turn))$/i.exec(text);
    if (suffix && suffix[1].trim()) {
        const temporal = parseExactTemporalCondition(suffix[2], suffix[2]);
        if (temporal) {
            return {
                op: "all",
                children: [parseBooleanCondition(suffix[1]), temporal],
            };
        }
    }
    const combatSuffix = /^(.*?)\s+((?:when|before|after)\s+(?:attacking|(?:performing|receiving|evading)(?:\s+(?:an?|the)\s+(?:(?:Ki Blast|Unarmed|Physical)\s+)?(?:normal\s+|Super\s+)?attack)?|delivering\s+(?:a\s+|the\s+)?final blow))$/i.exec(text);
    if (combatSuffix && combatSuffix[1].trim()) {
        const combat = parseExactCombatEventCondition(combatSuffix[2], combatSuffix[2]);
        if (combat) {
            return {
                op: "all",
                children: [parseBooleanCondition(combatSuffix[1]), combat],
            };
        }
    }
    return undefined;
}

function parseAllyConditionClause(sourceBody: string, sourceText: string): ConditionExpression | undefined {
    let body = sourceBody.trim();
    let selfInclusion: SelfInclusion = "included";
    if (/\(self excluded\)/i.test(body)) {
        selfInclusion = "excluded";
        body = body.replace(/\s*\(self excluded\)\s*/ig, " ").trim();
    } else if (/\(self included\)/i.test(body)) {
        body = body.replace(/\s*\(self included\)\s*/ig, " ").trim();
    }
    let negated = false;
    if (/^without\s+/i.test(body)) {
        negated = true;
        body = body.replace(/^without\s+/i, "");
    }
    if (/^there (?:is|are) no\s+/i.test(body)) {
        negated = true;
        body = body.replace(/^there (?:is|are) no\s+/i, "");
    } else {
        body = body.replace(/^there (?:is|are)\s+/i, "");
    }
    const anotherMatch = /^another\s+/i.exec(body);
    if (anotherMatch) {
        selfInclusion = "excluded";
        body = body.slice(anotherMatch[0].length);
    }
    let count: number | undefined;
    let comparator: PassivePredicate["comparator"] | undefined;
    const countMatch = /^(\d+)\s+or more\s+/i.exec(body);
    if (countMatch) {
        count = Number(countMatch[1]);
        comparator = "gte";
        body = body.slice(countMatch[0].length);
    } else {
        const exactCountMatch = /^(\d+)\s+/i.exec(body);
        if (exactCountMatch) {
            count = Number(exactCountMatch[1]);
            comparator = "eq";
            body = body.slice(exactCountMatch[0].length);
        }
    }
    body = body.replace(/^an?\s+/i, "");

    let scope: "team" | "rotation";
    const teamMatch = /\s+(?:is\s+|are\s+)?on the team$/i.exec(body);
    const rotationMatch = /\s+(?:is\s+|are\s+)?attacking in the same turn$/i.exec(body);
    if (teamMatch) {
        scope = "team";
        body = body.slice(0, teamMatch.index).trim();
    } else if (rotationMatch) {
        scope = "rotation";
        body = body.slice(0, rotationMatch.index).trim();
    } else {
        return undefined;
    }

    const classCategoryMatch = /^(?:(Super|Extreme) Class\s+(.+?) Category|(.+?) Category\s+(Super|Extreme) Class) all(?:y|ies)$/i.exec(body);
    if (classCategoryMatch) {
        const className = normalizeClass(classCategoryMatch[1] ?? classCategoryMatch[4]);
        const categoryValues = parseQuotedValues(classCategoryMatch[2] ?? classCategoryMatch[3]);
        if (categoryValues) {
            const children = categoryValues.values.map(category => allyPredicate(
                "category_class",
                { category, className },
                scope,
                selfInclusion,
                count,
                comparator,
                sourceText,
            ));
            const expression: ConditionExpression = children.length === 1
                ? children[0]
                : { op: categoryValues.connector === "and" ? "all" : "any", children };
            return negated ? { op: "not", child: expression } : expression;
        }
    }

    const categoryAndName = /^(.+?) Category all(?:y|ies) whose name includes (.+)$/i.exec(body);
    if (categoryAndName) {
        const categoryExpression = buildQuotedPredicateExpression(
            categoryAndName[1],
            value => allyPredicate("category", value, scope, selfInclusion, count, comparator, sourceText),
        );
        const nameExpression = buildQuotedPredicateExpression(
            categoryAndName[2],
            value => allyPredicate("name", value, scope, selfInclusion, count, comparator, sourceText),
        );
        const expression = categoryExpression && nameExpression
            ? { op: "all" as const, children: [categoryExpression, nameExpression] }
            : undefined;
        return expression && negated ? { op: "not", child: expression } : expression;
    }

    const categoryMatch = /^(.+?) Category all(?:y|ies)$/i.exec(body);
    if (categoryMatch) {
        const expression = buildQuotedPredicateExpression(
            categoryMatch[1],
            value => allyPredicate("category", value, scope, selfInclusion, count, comparator, sourceText),
        );
        return expression && negated ? { op: "not", child: expression } : expression;
    }
    const nameMatch = /^all(?:y|ies) whose name includes (.+)$/i.exec(body);
    if (nameMatch) {
        const expression = buildQuotedPredicateExpression(
            nameMatch[1],
            value => allyPredicate("name", value, scope, selfInclusion, count, comparator, sourceText),
        );
        return expression && negated ? { op: "not", child: expression } : expression;
    }

    const classTypeMatch = /^(Super|Extreme)\s+(AGL|TEQ|INT|STR|PHY) Type all(?:y|ies)$/i.exec(body);
    if (classTypeMatch) {
        const expression = allyPredicate(
            "class_type",
            { className: normalizeClass(classTypeMatch[1]), typeName: normalizeType(classTypeMatch[2]) },
            scope,
            selfInclusion,
            count,
            comparator,
            sourceText,
        );
        return negated ? { op: "not", child: expression } : expression;
    }
    const classMatch = /^(Super|Extreme) Class all(?:y|ies)$/i.exec(body);
    if (classMatch) {
        const expression = allyPredicate(
            "class",
            normalizeClass(classMatch[1]),
            scope,
            selfInclusion,
            count,
            comparator,
            sourceText,
        );
        return negated ? { op: "not", child: expression } : expression;
    }
    const typeMatch = /^(AGL|TEQ|INT|STR|PHY) Type all(?:y|ies)$/i.exec(body);
    if (typeMatch) {
        const expression = allyPredicate(
            "type",
            normalizeType(typeMatch[1]),
            scope,
            selfInclusion,
            count,
            comparator,
            sourceText,
        );
        return negated ? { op: "not", child: expression } : expression;
    }
    return undefined;
}

function allyPredicate(
    type: "category" | "name" | "class" | "type" | "class_type" | "category_class",
    value: string | {
        className: TeamAnalysisClass,
        typeName?: TeamAnalysisType,
        category?: string,
    },
    scope: "team" | "rotation",
    selfInclusion: SelfInclusion,
    count: number | undefined,
    comparator: PassivePredicate["comparator"] | undefined,
    sourceText: string,
): ConditionExpression {
    const rotationPartner = scope === "rotation" && selfInclusion === "excluded";
    const kind: PassivePredicateKind = type === "category"
        ? (rotationPartner ? "rotation_partner_category" : "ally_category_present")
        : type === "name"
            ? (rotationPartner ? "rotation_partner_name" : "ally_name_present")
            : type === "class"
                ? "ally_class_present"
                : type === "type"
                    ? "ally_type_present"
                    : type === "class_type"
                        ? "ally_class_type_present"
                        : "ally_category_class_present";
    return predicateExpression({
        kind,
        scope,
        selfInclusion,
        ...(count !== undefined ? { comparator, count } : {}),
        ...(type === "category" ? { categories: [value as string] } : {}),
        ...(type === "name" ? { names: [value as string] } : {}),
        ...(type === "class" ? { classes: [value as TeamAnalysisClass] } : {}),
        ...(type === "type" ? { types: [value as TeamAnalysisType] } : {}),
        ...(type === "class_type" ? {
            classes: [(value as { className: TeamAnalysisClass }).className],
            types: [(value as { typeName: TeamAnalysisType }).typeName],
        } : {}),
        ...(type === "category_class" ? {
            categories: [(value as { category: string }).category],
            classes: [(value as { className: TeamAnalysisClass }).className],
        } : {}),
        sourceText,
    });
}

function predicateExpression(predicate: PassivePredicate): ConditionExpression {
    return { op: "predicate", predicate };
}

const TEAM_ANALYSIS_TYPES: readonly TeamAnalysisType[] = ["AGL", "TEQ", "INT", "STR", "PHY"];
const TEAM_ANALYSIS_CLASSES: readonly TeamAnalysisClass[] = ["Super", "Extreme"];
const KI_SPHERE_TYPES: readonly KiSphereType[] = [
    ...TEAM_ANALYSIS_TYPES,
    "rainbow",
    "non_rainbow",
    "any",
];
const SLOT_LIST_PATTERN = "(?:1st|2nd|3rd)(?:\\s*(?:,|and|or)\\s*(?:1st|2nd|3rd))*";

function normalizeClass(value: string): TeamAnalysisClass {
    return /^super$/i.test(value) ? "Super" : "Extreme";
}

function normalizeType(value: string): TeamAnalysisType {
    return value.toUpperCase() as TeamAnalysisType;
}

function parseKiSphereTypes(sourceText: string): KiSphereType[] | undefined {
    const text = sourceText.trim();
    if (!text || /^any$/i.test(text)) {
        return ["any"];
    }
    if (/^Rainbow$/i.test(text)) {
        return ["rainbow"];
    }
    if (/^(?:non[- ]Rainbow|Type)$/i.test(text)) {
        return ["non_rainbow"];
    }
    const parts = text.split(/\s*(?:,|&|\band\b|\bor\b)\s*/i).filter(Boolean);
    if (parts.length === 0 || parts.some(part => !/^(?:AGL|TEQ|INT|STR|PHY)$/i.test(part))) {
        return undefined;
    }
    return [...new Set(parts.map(normalizeType))];
}

function parseKiSphereDestination(sourceText: string): ConcreteKiSphereType | undefined {
    if (/^Rainbow$/i.test(sourceText.trim())) {
        return "rainbow";
    }
    return /^(?:AGL|TEQ|INT|STR|PHY)$/i.test(sourceText.trim())
        ? normalizeType(sourceText.trim())
        : undefined;
}

function parseConcreteKiSphereTypes(sourceText: string): ConcreteKiSphereType[] | undefined {
    const types = parseKiSphereTypes(sourceText);
    return types && types.every((type): type is ConcreteKiSphereType => type === "rainbow" || TEAM_ANALYSIS_TYPES.includes(type as TeamAnalysisType))
        ? types
        : undefined;
}

function parseExcludedKiSphereTypes(sourceText: string): TeamAnalysisType[] | undefined {
    const text = sourceText.replace(/\s+excluded$/i, "").trim();
    const types = parseKiSphereTypes(text);
    return types && types.every((type): type is TeamAnalysisType => TEAM_ANALYSIS_TYPES.includes(type as TeamAnalysisType))
        ? types
        : undefined;
}

function parseKiSphereScalingHeader(sourceText: string): PassiveEffectScaling | undefined {
    const match = /^For every(?:\s+(\d+))?\s*(.*?)\s*Ki Spheres? obtained$/i.exec(sourceText.trim());
    if (!match) {
        return undefined;
    }
    const spheresPerIncrement = Number(match[1] ?? 1);
    const kiSphereTypes = parseKiSphereTypes(match[2]);
    if (!kiSphereTypes || !Number.isInteger(spheresPerIncrement) || spheresPerIncrement < 1) {
        return undefined;
    }
    return {
        kind: "per_ki_sphere",
        kiSphereTypes,
        spheresPerIncrement,
        kiContext: "collected_ki_spheres",
    };
}

function parseCombatEventScalingHeader(sourceText: string): PassiveEffectScaling | undefined {
    const match = /^For every(?:\s+(\d+))?\s+(.+)$/i.exec(sourceText.trim());
    if (!match) {
        return undefined;
    }
    const eventsPerIncrement = Number(match[1] ?? 1);
    if (!Number.isInteger(eventsPerIncrement) || eventsPerIncrement < 1) {
        return undefined;
    }
    const body = match[2].trim();
    const connectors = [...body.matchAll(/\s+(and|or)\s+/gi)].map(item => item[1].toLowerCase());
    if (connectors.includes("and") && connectors.includes("or")) {
        return undefined;
    }
    const connector: CombatEventEffectScaling["connector"] = connectors[0] as "and" | "or" | undefined ?? "single";
    const parts = body.split(/\s+(?:and|or)\s+/i).map(part => part.trim());
    const identities = parts.map((part, index) => {
        const direct = parsePerEventIdentity(part);
        if (direct) {
            return direct;
        }
        if (/^evaded$/i.test(part) && index > 0 && /attack received$/i.test(parts[index - 1])) {
            return combatEventIdentity("attack evaded", "evaded");
        }
        return undefined;
    });
    if (identities.some(identity => !identity)) {
        return undefined;
    }
    return {
        kind: "per_combat_event",
        connector,
        eventsPerIncrement,
        events: (identities as ParsedCombatEventIdentity[]).map(identity => combatEventDescriptor(
            identity,
            "per_event",
            "after_event",
            {
                countScope: "battle",
                countScopeSource: "documented_domain_rule",
                relativeTimingSource: "documented_domain_rule",
            },
        )),
    };
}

function parsePerEventIdentity(sourceText: string): ParsedCombatEventIdentity | undefined {
    if (/^((?:(?:Ki Blast|Unarmed|Physical)\s+)?(?:Super\s+)?attack) performed$/i.test(sourceText)) {
        return combatEventIdentity(sourceText, "performed");
    }
    if (/^((?:(?:Ki Blast|Unarmed|Physical)\s+)?(?:Super\s+)?attack) received$/i.test(sourceText)) {
        return combatEventIdentity(sourceText, "landed");
    }
    if (/^attack evaded$/i.test(sourceText)) {
        return combatEventIdentity(sourceText, "evaded");
    }
    if (/^final blow delivered$/i.test(sourceText)) {
        return combatEventIdentity(sourceText, "final_blow");
    }
    return undefined;
}

function clonePassiveEffectScaling(scaling: PassiveEffectScaling): PassiveEffectScaling {
    return scaling.kind === "per_ki_sphere"
        ? { ...scaling, kiSphereTypes: [...scaling.kiSphereTypes] }
        : {
            ...scaling,
            events: scaling.events.map(event => ({
                ...event,
                provenance: { ...event.provenance },
            })),
        };
}

function parseSlotValues(sourceText: string): number[] {
    return [...sourceText.matchAll(/\b(1st|2nd|3rd)\b/gi)]
        .map(match => Number(match[1][0]));
}

function parseExactSlotCondition(text: string, sourceText: string): ConditionExpression | undefined {
    const attackerPattern = new RegExp(`^(?:As the|attacking as the)\\s+(${SLOT_LIST_PATTERN})\\s+attacker in a turn$`, "i");
    const slotPattern = new RegExp(`^attacking in the\\s+(${SLOT_LIST_PATTERN})\\s+slot$`, "i");
    const match = attackerPattern.exec(text) ?? slotPattern.exec(text);
    if (!match) {
        return undefined;
    }
    return predicateExpression({
        kind: "battle_slot",
        scope: "self",
        slots: parseSlotValues(match[1]),
        sourceText,
    });
}

function parsePartialSlotCondition(text: string): ConditionExpression | undefined {
    const pattern = new RegExp(`\\b(?:attacking as the|attacking in the|(?:the|this) character is the|as the)\\s+(${SLOT_LIST_PATTERN})\\s+(?:attacker(?:\\s+in a turn)?|slot)\\b`, "i");
    const match = pattern.exec(text);
    if (!match || match.index === undefined) {
        return undefined;
    }
    const prefix = text.slice(0, match.index).replace(/[\s,]+$/g, "");
    const suffix = text.slice(match.index + match[0].length).replace(/^[\s,]+/g, "");
    const slot = predicateExpression({
        kind: "battle_slot",
        scope: "self",
        slots: parseSlotValues(match[1]),
        sourceText: match[0],
    });
    const children: ConditionExpression[] = [
        ...(prefix ? [parseBooleanCondition(prefix)] : []),
        slot,
        ...(suffix ? [parseBooleanCondition(suffix)] : []),
    ];
    return children.length === 1 ? children[0] : { op: "all", children };
}

function stripOuterConditionParentheses(sourceText: string): string {
    let text = sourceText.trim();
    while (text.startsWith("(") && matchingOuterParenthesisIndex(text) === text.length - 1) {
        text = text.slice(1, -1).trim();
    }
    return text;
}

function matchingOuterParenthesisIndex(text: string): number {
    let depth = 0;
    let quoted = false;
    for (let index = 0; index < text.length; index += 1) {
        const character = text[index];
        if (character === "\"") {
            quoted = !quoted;
        } else if (!quoted && character === "(") {
            depth += 1;
        } else if (!quoted && character === ")") {
            depth -= 1;
            if (depth === 0) {
                return index;
            }
        }
    }
    return -1;
}

function splitTopLevelCondition(sourceText: string, connector: "and" | "or"): string[] {
    const matches = [...sourceText.matchAll(/\s+,?\s*(and|or)\s+/gi)];
    const parts: string[] = [];
    let lastIndex = 0;
    for (const match of matches) {
        const index = match.index ?? -1;
        if (index < 0
            || match[1].toLowerCase() !== connector
            || conditionDepthAt(sourceText, index) !== 0) {
            continue;
        }
        const right = sourceText.slice(index + match[0].length).trim();
        if (!/^(?:when|if|not\b|after\b|before\b|as|attacking|with|between|ki\b|\d+\b|there|all|the\s+(?:team|character|enemy|target|attacked|selected|only)|this\s+character|that\s+enemy|an?\s+(?:enemy|["']|(?:Super|Extreme|AGL|TEQ|INT|STR|PHY)\b)|another|no|for\b|starting\b|on the\b|up to the\b|from the\b|HP\b|facing\b|\()/i.test(right)) {
            continue;
        }
        parts.push(sourceText.slice(lastIndex, index).replace(/[\s,]+$/g, "").trim());
        lastIndex = index + match[0].length;
    }
    if (parts.length === 0) {
        return [sourceText];
    }
    parts.push(sourceText.slice(lastIndex).trim());
    return parts.filter(Boolean);
}

function conditionDepthAt(sourceText: string, targetIndex: number): number {
    let depth = 0;
    let quoted = false;
    for (let index = 0; index < targetIndex; index += 1) {
        if (sourceText[index] === "\"") {
            quoted = !quoted;
        } else if (!quoted && sourceText[index] === "(") {
            depth += 1;
        } else if (!quoted && sourceText[index] === ")") {
            depth -= 1;
        }
    }
    return depth;
}

function buildQuotedPredicateExpression(
    sourceText: string,
    build: (value: string) => ConditionExpression,
): ConditionExpression | undefined {
    const parsed = parseQuotedValues(sourceText);
    if (!parsed) {
        return undefined;
    }
    const children = parsed.values.map(build);
    if (children.length === 1) {
        return children[0];
    }
    return {
        op: parsed.connector === "and" ? "all" : "any",
        children,
    };
}

function parseQuotedValues(sourceText: string): {
    values: string[],
    connector: "single" | "and" | "or",
} | undefined {
    const values = [...sourceText.matchAll(/"([^"]+)"/g)].map(match => match[1].trim()).filter(Boolean);
    if (values.length === 0) {
        return undefined;
    }
    const separators = sourceText.replace(/"[^"]+"/g, "#").trim();
    if (!/^#(?:\s*(?:,\s*)?(?:and|or)?\s*#)*$/i.test(separators)) {
        return undefined;
    }
    const hasAnd = /\band\b/i.test(separators);
    const hasOr = /\bor\b/i.test(separators);
    if (hasAnd && hasOr) {
        return undefined;
    }
    if (values.length > 1 && !hasAnd && !hasOr) {
        return undefined;
    }
    return {
        values,
        connector: hasAnd ? "and" : hasOr ? "or" : "single",
    };
}

function parseTypeValues(sourceText: string): TeamAnalysisType[] | undefined {
    const parts = sourceText.split(/\s*(?:,|&|\band\b|\bor\b)\s*/i).filter(Boolean);
    if (parts.length === 0 || parts.some(part => !/^(?:AGL|TEQ|INT|STR|PHY)$/i.test(part))) {
        return undefined;
    }
    return [...new Set(parts.map(normalizeType))];
}

interface EffectParseContext {
    stateKey: string,
    rawText: string,
    ruleLineIndex: number,
    phaseContextText?: string,
    headerScaling?: PassiveEffectScaling,
}

function parseEffects(sourceText: string, context: EffectParseContext): ParsedEffectResult {
    const resolvedTarget = resolveEffectTarget(sourceText);
    const parsedAtoms = parseEffectAtoms(resolvedTarget.body, context);
    const effects = parsedAtoms.atoms.map(atom => enrichCalculationPhase(
        applyEffectTarget(
            context.headerScaling && atom.kind !== "ki_sphere_change" && !atom.scaling
                ? { ...atom, scaling: clonePassiveEffectScaling(context.headerScaling) }
                : atom,
            resolvedTarget,
        ),
        sourceText,
        context,
    ));
    effects.push(...parsedAtoms.unknownSegments.map(segment => unknownEffect(
        segment,
        resolvedTarget.target,
        resolvedTarget.categories,
        resolvedTarget.classes,
        resolvedTarget.types,
    )));
    return {
        effects,
        status: effectListStatus(effects),
    };
}

interface ResolvedEffectTarget {
    body: string,
    target: PassiveTarget,
    categories?: string[],
    classes?: TeamAnalysisClass[],
    types?: TeamAnalysisType[],
}

interface PassiveEffectAtom {
    kind:
        | "ki"
        | "hp"
        | "atk"
        | "def"
        | "damage_reduction"
        | "guard"
        | "evade_chance"
        | "critical_chance"
        | "additional_attack"
        | "additional_super_attack"
        | "stun_chance"
        | "super_attack_seal"
        | "effective_against_all_types"
        | "ki_sphere_change",
    value?: number,
    unit?: PassiveEffect["unit"],
    count?: number,
    activationChancePercent?: number,
    additionalToSuperChancePercent?: number,
    chancePercent?: number,
    qualitativeChanceTerm?: QualitativeChanceTerm,
    probabilitySource?: ProbabilitySource,
    additionalToSuperQualitativeChanceTerm?: QualitativeChanceTerm,
    additionalToSuperProbabilitySource?: ProbabilitySource,
    stackCap?: number,
    scaling?: PassiveEffectScaling,
    kiSphereChange?: KiSphereChange,
    duration?: PassiveDuration,
    sourceText: string,
}

interface EffectAtomCandidate {
    start: number,
    end: number,
    atoms: PassiveEffectAtom[],
}

interface EffectModifierCandidate {
    start: number,
    end: number,
    apply: (atom: PassiveEffectAtom) => void,
}

function resolveEffectTarget(sourceText: string): ResolvedEffectTarget {
    let text = sourceText.trim();
    let selfInclusion: SelfInclusion = "included";
    if (/\(self excluded\)/i.test(text)) {
        selfInclusion = "excluded";
        text = text.replace(/\s*\(self excluded\)\s*/ig, " ").trim();
    } else if (/\(self included\)/i.test(text)) {
        text = text.replace(/\s*\(self included\)\s*/ig, " ").trim();
    }

    const allAlliesMatch = /^All allies['’]\s+(.+)$/i.exec(text);
    const categoryAlliesMatch = /^(.+?) Category allies['’]\s+(.+)$/i.exec(text);
    const classTypeAlliesMatch = /^(Super|Extreme)\s+(AGL|TEQ|INT|STR|PHY) Type allies['’]\s+(.+)$/i.exec(text);
    const classAlliesMatch = /^(Super|Extreme) Class allies['’]\s+(.+)$/i.exec(text);
    const typeAlliesMatch = /^(.+?) Type allies['’]\s+(.+)$/i.exec(text);
    if (allAlliesMatch) {
        return {
            body: allAlliesMatch[1],
            target: { scope: "team_allies", selfInclusion },
        };
    }
    if (categoryAlliesMatch) {
        const parsedCategories = parseQuotedValues(categoryAlliesMatch[1]);
        if (!parsedCategories || parsedCategories.connector === "and") {
            return { body: text, target: { scope: "unknown" } };
        }
        return {
            body: categoryAlliesMatch[2],
            target: { scope: "category_allies", selfInclusion },
            categories: parsedCategories.values,
        };
    }
    if (classTypeAlliesMatch) {
        return {
            body: classTypeAlliesMatch[3],
            target: { scope: "class_type_allies", selfInclusion },
            classes: [normalizeClass(classTypeAlliesMatch[1])],
            types: [normalizeType(classTypeAlliesMatch[2])],
        };
    }
    if (classAlliesMatch) {
        return {
            body: classAlliesMatch[2],
            target: { scope: "class_allies", selfInclusion },
            classes: [normalizeClass(classAlliesMatch[1])],
        };
    }
    if (typeAlliesMatch) {
        const parsedTypes = parseTypeValues(typeAlliesMatch[1]);
        if (parsedTypes) {
            return {
                body: typeAlliesMatch[2],
                target: { scope: "type_allies", selfInclusion },
                types: parsedTypes,
            };
        }
    }
    if (/\b(?:stuns?|stunning|seals?|sealing)\s+(?:all enemies|all enemies['’])/i.test(text)) {
        return { body: text, target: { scope: "all_enemies" } };
    }
    if (/\b(?:stuns?|stunning|seals?|sealing)\s+(?:(?:the\s+)?attacked\s+enemy|(?:the\s+)?enemy)(?:['’]s)?/i.test(text)) {
        return { body: text, target: { scope: "enemy" } };
    }
    if (/^(?:.+?\s+allies|.+?\s+characters|All enemies|Attacked enemy|Enemy|Target enemy)['’]\s+/i.test(text)) {
        return { body: text, target: { scope: "unknown" } };
    }
    return { body: sourceText.trim(), target: { scope: "self" } };
}

function activationChanceFields(
    percent: number,
    probabilitySource: ProbabilitySource = "explicit_text",
    qualitativeChanceTerm?: QualitativeChanceTerm,
): Pick<PassiveEffectAtom, "activationChancePercent" | "chancePercent" | "probabilitySource" | "qualitativeChanceTerm"> {
    return {
        activationChancePercent: percent,
        chancePercent: percent,
        probabilitySource,
        ...(qualitativeChanceTerm ? { qualitativeChanceTerm } : {}),
    };
}

function explicitAttackCount(sourceCount: string): number {
    return /^an?$/i.test(sourceCount) ? 1 : Number(sourceCount);
}

interface ResolvedProbability {
    percent?: number,
    qualitativeChanceTerm?: QualitativeChanceTerm,
    probabilitySource: ProbabilitySource,
}

function normalizeQualitativeChanceTerm(sourceTerm: string | undefined): QualitativeChanceTerm | undefined {
    if (!sourceTerm) {
        return undefined;
    }
    const normalized = sourceTerm.trim().toLowerCase();
    if (normalized === "a" || normalized === "a chance") {
        return "a chance";
    }
    if (["rare", "medium", "high", "great"].includes(normalized)) {
        return normalized as QualitativeChanceTerm;
    }
    return undefined;
}

function resolveProbability(
    context: EffectParseContext,
    semantic: ChanceSemantic,
    sourceTerm: string | undefined,
    sourcePercent: string | undefined,
): ResolvedProbability {
    const qualitativeChanceTerm = normalizeQualitativeChanceTerm(sourceTerm);
    if (sourcePercent !== undefined) {
        return {
            percent: Number(sourcePercent),
            ...(qualitativeChanceTerm ? { qualitativeChanceTerm } : {}),
            probabilitySource: "explicit_text",
        };
    }
    if (qualitativeChanceTerm) {
        const firstParty = resolveFirstPartyProbability(
            context.stateKey,
            context.rawText,
            context.ruleLineIndex,
            qualitativeChanceTerm,
            semantic,
        );
        if (firstParty) {
            return {
                percent: firstParty.percent,
                qualitativeChanceTerm,
                probabilitySource: "first_party_game_db",
            };
        }
        const lexiconPercent = validatedChancePercent(qualitativeChanceTerm, semantic);
        if (lexiconPercent !== undefined) {
            return {
                percent: lexiconPercent,
                qualitativeChanceTerm,
                probabilitySource: "qualitative_lexicon",
            };
        }
        return { qualitativeChanceTerm, probabilitySource: "unresolved" };
    }
    return { probabilitySource: "unresolved" };
}

function activationProbabilityFields(probability: ResolvedProbability): Pick<
    PassiveEffectAtom,
    "activationChancePercent" | "chancePercent" | "qualitativeChanceTerm" | "probabilitySource"
> {
    return {
        ...(probability.percent !== undefined ? {
            activationChancePercent: probability.percent,
            chancePercent: probability.percent,
        } : {}),
        ...(probability.qualitativeChanceTerm ? { qualitativeChanceTerm: probability.qualitativeChanceTerm } : {}),
        probabilitySource: probability.probabilitySource,
    };
}

function additionalToSuperProbabilityFields(probability: ResolvedProbability): Pick<
    PassiveEffectAtom,
    "additionalToSuperChancePercent" | "additionalToSuperQualitativeChanceTerm" | "additionalToSuperProbabilitySource"
> {
    return {
        ...(probability.percent !== undefined ? { additionalToSuperChancePercent: probability.percent } : {}),
        ...(probability.qualitativeChanceTerm
            ? { additionalToSuperQualitativeChanceTerm: probability.qualitativeChanceTerm }
            : {}),
        additionalToSuperProbabilitySource: probability.probabilitySource,
    };
}

function parseEffectAtoms(body: string, context: EffectParseContext): {
    atoms: PassiveEffectAtom[],
    unknownSegments: string[],
} {
    const candidates: EffectAtomCandidate[] = [];
    const addMatches = (
        pattern: RegExp,
        build: (match: RegExpMatchArray) => PassiveEffectAtom[],
        rejectUnknownChancePrefix = false,
    ) => {
        for (const match of body.matchAll(pattern)) {
            const start = match.index ?? 0;
            if (rejectUnknownChancePrefix
                && /\bchance of\s+$/i.test(body.slice(Math.max(0, start - 48), start))) {
                continue;
            }
            const atoms = build(match);
            if (atoms.length > 0) {
                candidates.push({ start, end: start + match[0].length, atoms });
            }
        }
    };

    addMatches(/\b(?:(?:(?<activationTerm>rare|medium|high|great)\s+chance(?:\s*\((?<activationParenPercent>\d+(?:\.\d+)?)%\))?|(?<activationPercent>\d+(?:\.\d+)?)%\s+chance|(?<activationArticle>a)\s+chance|(?<activationBare>chance))\s+of\s+)?launch(?:es|ing)\s+(?<attackCount>an?|\d+)\s+additional attack(?:\(s\)|s)?(?:,?\s*each of which|\s+that|\s+which)\s+(?:has|have)\s+(?:(?<conversionArticle>a)\s+chance|(?:a\s+)?(?:(?<conversionTerm>rare|medium|high|great)\s+chance(?:\s*\((?<conversionParenPercent>\d+(?:\.\d+)?)%\))?|(?<conversionPercent>\d+(?:\.\d+)?)%\s+chance)|(?<conversionBare>chance))\s+of becoming a Super Attack(?:\s+(?<conversionTrailingPercent>\d+(?:\.\d+)?)%)?/gi, match => {
        const groups = match.groups ?? {};
        const hasActivationChance = [groups.activationTerm, groups.activationPercent, groups.activationArticle, groups.activationBare].some(Boolean);
        const activation = hasActivationChance
            ? resolveProbability(context, "additional_super_activation", groups.activationTerm ?? groups.activationArticle, groups.activationParenPercent ?? groups.activationPercent)
            : { percent: 100, probabilitySource: "explicit_text" as ProbabilitySource };
        const conversion = resolveProbability(
            context,
            "additional_to_super",
            groups.conversionTerm ?? groups.conversionArticle,
            groups.conversionTrailingPercent ?? groups.conversionParenPercent ?? groups.conversionPercent,
        );
        return [{
            kind: "additional_attack",
            count: explicitAttackCount(groups.attackCount),
            ...activationProbabilityFields(activation),
            ...additionalToSuperProbabilityFields(conversion),
            sourceText: match[0],
        }];
    });
    addMatches(/\b(?:(?:(rare|medium|high|great)\s+chance(?:\s*\((\d+(?:\.\d+)?)%\))?|(\d+(?:\.\d+)?)%\s+chance|(a)\s+chance|(chance))\s+of\s+)?launch(?:es|ing)\s+(an?|\d+)\s+additional Super Attack(?:\(s\)|s)?(?:\s+(\d+(?:\.\d+)?)%)?/gi, match => {
        const hasActivationChance = match.slice(1, 6).some(Boolean);
        const activation = hasActivationChance
            ? resolveProbability(context, "additional_super_activation", match[1] ?? match[4], match[7] ?? match[2] ?? match[3])
            : { percent: 100, probabilitySource: "explicit_text" as ProbabilitySource };
        return [{
            kind: "additional_super_attack",
            count: explicitAttackCount(match[6]),
            ...activationProbabilityFields(activation),
            sourceText: match[0],
        }];
    });
    addMatches(/\b(?:(?:(rare|medium|high|great)\s+chance(?:\s*\((\d+(?:\.\d+)?)%\))?|(\d+(?:\.\d+)?)%\s+chance|(a)\s+chance|(chance))\s+of\s+)?launch(?:es|ing)\s+(an?|\d+)\s+additional attack(?:\(s\)|s)?/gi, match => {
        const hasActivationChance = match.slice(1, 6).some(Boolean);
        const activation = hasActivationChance
            ? resolveProbability(context, "additional_super_activation", match[1] ?? match[4], match[2] ?? match[3])
            : { percent: 100, probabilitySource: "explicit_text" as ProbabilitySource };
        return [{
            kind: "additional_attack",
            count: explicitAttackCount(match[6]),
            ...activationProbabilityFields(activation),
            sourceText: match[0],
        }];
    });
    addMatches(/\bChance of performing a critical hit\s*(?:&|and|,)\s*damage reduction(?: rate)?\s+(\d+(?:\.\d+)?)%/gi, match => {
        const percent = Number(match[1]);
        return [{
            kind: "critical_chance",
            value: percent,
            unit: "percent",
            ...activationChanceFields(percent),
            sourceText: match[0],
        }, {
            kind: "damage_reduction",
            value: percent,
            unit: "percent",
            sourceText: match[0],
        }];
    });
    addMatches(/\bChance of performing a critical hit\s*(?:&|and|,)\s*(?:chance of\s+)?evading enemy(?:'s|’s) attack\s+(\d+(?:\.\d+)?)%/gi, match => {
        const percent = Number(match[1]);
        return ["critical_chance", "evade_chance"].map(kind => ({
            kind: kind as "critical_chance" | "evade_chance",
            value: percent,
            unit: "percent",
            ...activationChanceFields(percent),
            sourceText: match[0],
        }));
    });
    addMatches(/\b(?:(rare|medium|high|great)\s+chance(?:\s*\((\d+(?:\.\d+)?)%\))?|(a)\s+chance|(chance))\s+of performing a critical hit(?:\s+(\d+(?:\.\d+)?)%)?/gi, match => {
        const probability = resolveProbability(context, "critical_activation", match[1] ?? match[3], match[5] ?? match[2]);
        return [{
            kind: "critical_chance",
            ...(probability.percent !== undefined ? { value: probability.percent } : {}),
            unit: "percent",
            ...activationProbabilityFields(probability),
            sourceText: match[0],
        }];
    });
    addMatches(/\b(\d+(?:\.\d+)?)%\s+chance of performing a critical hit/gi, match => {
        const activationChancePercent = Number(match[1]);
        return [{
            kind: "critical_chance",
            value: activationChancePercent,
            unit: "percent",
            ...activationChanceFields(activationChancePercent),
            sourceText: match[0],
        }];
    });
    addMatches(/\bPerforms a critical hit\b/gi, match => [{
        kind: "critical_chance",
        value: 100,
        unit: "percent",
        ...activationChanceFields(100),
        sourceText: match[0],
    }]);
    addMatches(/\b(?:(rare|medium|high|great)\s+chance(?:\s*\((\d+(?:\.\d+)?)%\))?|(a)\s+chance|(chance))\s+of evading enemy(?:'s|’s) attack(?:\s+(\d+(?:\.\d+)?)%)?/gi, match => {
        const probability = resolveProbability(context, "evade_activation", match[1] ?? match[3], match[5] ?? match[2]);
        return [{
            kind: "evade_chance",
            ...(probability.percent !== undefined ? { value: probability.percent } : {}),
            unit: "percent",
            ...activationProbabilityFields(probability),
            sourceText: match[0],
        }];
    });
    addMatches(/\b(\d+(?:\.\d+)?)%\s+chance of evading enemy(?:'s|’s) attack/gi, match => {
        const activationChancePercent = Number(match[1]);
        return [{
            kind: "evade_chance",
            value: activationChancePercent,
            unit: "percent",
            ...activationChanceFields(activationChancePercent),
            sourceText: match[0],
        }];
    });
    addMatches(/\bEvades enemy(?:'s|’s) attack\b/gi, match => [{
        kind: "evade_chance",
        value: 100,
        unit: "percent",
        ...activationChanceFields(100),
        sourceText: match[0],
    }]);
    addMatches(/\b(?:(?:(rare|medium|high|great)\s+chance(?:\s*\((\d+(?:\.\d+)?)%\))?|(\d+(?:\.\d+)?)%\s+chance|(a)\s+chance|(chance))\s+of\s+)?(?:stunning|stuns?)\s+((?:(?:the\s+)?attacked\s+enemy)|(?:(?:the\s+)?enemy)|all enemies)\b/gi, match => {
        const hasActivationChance = match.slice(1, 6).some(Boolean);
        const probability = hasActivationChance
            ? resolveProbability(context, "stun_activation", match[1] ?? match[4], match[2] ?? match[3])
            : { percent: 100, probabilitySource: "explicit_text" as ProbabilitySource };
        return [{
            kind: "stun_chance",
            value: 1,
            unit: "boolean",
            ...activationProbabilityFields(probability),
            sourceText: match[0],
        }];
    });
    addMatches(/\b(?:(?:(rare|medium|high|great)\s+chance(?:\s*\((\d+(?:\.\d+)?)%\))?|(\d+(?:\.\d+)?)%\s+chance|(a)\s+chance|(chance))\s+of\s+)?(?:sealing|seals?)\s+((?:(?:the\s+)?attacked\s+enemy)|(?:(?:the\s+)?enemy))['’]s\s+Super Attack(?:s)?\b/gi, match => {
        const hasActivationChance = match.slice(1, 6).some(Boolean);
        const probability = hasActivationChance
            ? resolveProbability(context, "seal_activation", match[1] ?? match[4], match[2] ?? match[3])
            : { percent: 100, probabilitySource: "explicit_text" as ProbabilitySource };
        return [{
            kind: "super_attack_seal",
            value: 1,
            unit: "boolean",
            ...activationProbabilityFields(probability),
            sourceText: match[0],
        }];
    });
    addMatches(/\b(?:(?:(rare|medium|high|great)\s+chance(?:\s*\((\d+(?:\.\d+)?)%\))?|(\d+(?:\.\d+)?)%\s+chance|(a)\s+chance|(chance))\s+of\s+)?(?:sealing|seals?)\s+all enemies['’]\s+Super Attacks?\b/gi, match => {
        const hasActivationChance = match.slice(1, 6).some(Boolean);
        const probability = hasActivationChance
            ? resolveProbability(context, "seal_activation", match[1] ?? match[4], match[2] ?? match[3])
            : { percent: 100, probabilitySource: "explicit_text" as ProbabilitySource };
        return [{
            kind: "super_attack_seal",
            value: 1,
            unit: "boolean",
            ...activationProbabilityFields(probability),
            sourceText: match[0],
        }];
    });

    addMatches(/\bChanges Ki Spheres:\s*(All|(?:(?:AGL|TEQ|INT|STR|PHY|Rainbow)(?:\s*(?:,|&|and|or)\s*(?:AGL|TEQ|INT|STR|PHY|Rainbow))*))\s+to\s+(AGL|TEQ|INT|STR|PHY|Rainbow)\b/gi, match => {
        const sourceSelection = /^All$/i.test(match[1]) ? "all" as const : "listed_types" as const;
        const sourceTypes = sourceSelection === "listed_types" ? parseConcreteKiSphereTypes(match[1]) : undefined;
        const destinationType = parseKiSphereDestination(match[2]);
        if (!destinationType || (sourceSelection === "listed_types" && !sourceTypes)) {
            return [];
        }
        return [{
            kind: "ki_sphere_change",
            kiSphereChange: {
                sourceSelection,
                ...(sourceTypes ? { sourceTypes } : {}),
                destinationType,
                kiContext: "board_state",
            },
            sourceText: match[0],
        }];
    });
    addMatches(/\bRandomly changes Ki Spheres of a certain Type(?:\s*\(((?:(?:AGL|TEQ|INT|STR|PHY)(?:\s*(?:,|&|and|or)\s*(?:AGL|TEQ|INT|STR|PHY))*)\s+excluded)\))?\s+to\s+(AGL|TEQ|INT|STR|PHY|Rainbow)(?:\s+Ki Spheres?)?\b/gi, match => {
        const destinationType = parseKiSphereDestination(match[2]);
        const excludedSourceTypes = match[1] ? parseExcludedKiSphereTypes(match[1]) : undefined;
        if (!destinationType || (match[1] && !excludedSourceTypes)) {
            return [];
        }
        return [{
            kind: "ki_sphere_change",
            kiSphereChange: {
                sourceSelection: "random_type",
                ...(excludedSourceTypes ? { excludedSourceTypes } : {}),
                destinationType,
                kiContext: "board_state",
            },
            sourceText: match[0],
        }];
    });

    addMatches(/\b(?:(?:Receives|Gains)\s+)?(?:an additional\s+)?Ki\s*\+\s*(\d+(?:\.\d+)?)/gi, match => [{
        kind: "ki",
        value: Number(match[1]),
        unit: "ki",
        sourceText: match[0],
    }]);
    addMatches(/\b(?:(?:Receives|Gains)\s+)?(?:an additional\s+)?((?:HP|ATK|DEF)(?:\s*(?:,|&|and)\s*(?:HP|ATK|DEF))*)\s*\+?\s*(\d+(?:\.\d+)?)(%)?/gi, match => {
        const value = Number(match[2]);
        const unit: "percent" | "flat" = match[3] ? "percent" : "flat";
        return (match[1].match(/HP|ATK|DEF/gi) ?? []).map(kind => ({
            kind: kind.toLowerCase() as "hp" | "atk" | "def",
            value,
            unit,
            sourceText: match[0],
        }));
    });
    addMatches(/\bRecovers\s+(\d+(?:\.\d+)?)%\s+HP\b/gi, match => [{
        kind: "hp",
        value: Number(match[1]),
        unit: "percent",
        sourceText: match[0],
    }]);
    addMatches(/\bDamage reduction rate\s+(\d+(?:\.\d+)?)%/gi, match => [{
        kind: "damage_reduction",
        value: Number(match[1]),
        unit: "percent",
        sourceText: match[0],
    }]);
    addMatches(/\bChance of evading enemy(?:'s|’s) attack\s+(\d+(?:\.\d+)?)%/gi, match => {
        const chancePercent = Number(match[1]);
        return [{
            kind: "evade_chance",
            value: chancePercent,
            unit: "percent",
            ...activationChanceFields(chancePercent),
            sourceText: match[0],
        }];
    });
    addMatches(/\bChance of performing a critical hit\s+(\d+(?:\.\d+)?)%/gi, match => {
        const chancePercent = Number(match[1]);
        return [{
            kind: "critical_chance",
            value: chancePercent,
            unit: "percent",
            ...activationChanceFields(chancePercent),
            sourceText: match[0],
        }];
    });
    addMatches(/\bGuards all attacks\b/gi, match => [{
        kind: "guard",
        value: 1,
        unit: "boolean",
        sourceText: match[0],
    }]);
    addMatches(/\bAttacks are effective against all Types\b/gi, match => [{
        kind: "effective_against_all_types",
        value: 1,
        unit: "boolean",
        sourceText: match[0],
    }]);

    const selected: EffectAtomCandidate[] = [];
    for (const candidate of candidates.sort((left, right) => left.start - right.start || right.end - left.end)) {
        if (!selected.some(existing => candidate.start < existing.end && candidate.end > existing.start)) {
            selected.push(candidate);
        }
    }
    selected.sort((left, right) => left.start - right.start);
    const modifiers = applyEffectModifiers(body, selected);
    return {
        atoms: selected.flatMap(candidate => candidate.atoms),
        unknownSegments: unknownSegmentsBetweenAtoms(body, [...selected, ...modifiers]),
    };
}

function applyEffectModifiers(body: string, atoms: EffectAtomCandidate[]): EffectModifierCandidate[] {
    const candidates: EffectModifierCandidate[] = [];
    const addModifiers = (
        pattern: RegExp,
        build: (match: RegExpMatchArray) => (atom: PassiveEffectAtom) => void,
    ) => {
        for (const match of body.matchAll(pattern)) {
            const start = match.index ?? 0;
            candidates.push({
                start,
                end: start + match[0].length,
                apply: build(match),
            });
        }
    };

    addModifiers(/\bwithin the turn\b/gi, () => atom => {
        atom.duration = { kind: "within_turn" };
    });
    addModifiers(/\bfor\s+(\d+)\s+turn(?:s\b|\(s\)(?!\w)|\b)/gi, match => atom => {
        atom.duration = { kind: "turns", turns: Number(match[1]) };
    });
    addModifiers(/\b(?:for the rest of (?:the )?battle|throughout (?:the )?battle|permanently)\b/gi, () => atom => {
        atom.duration = { kind: "battle" };
    });
    addModifiers(/\(\s*up to\s+(\d+(?:\.\d+)?)%\s*\)/gi, match => atom => {
        atom.stackCap = Number(match[1]);
    });
    addModifiers(/\(\s*up to\s+\+(\d+(?:\.\d+)?)\s*\)/gi, match => atom => {
        atom.stackCap = Number(match[1]);
    });
    for (const match of body.matchAll(/\bper\s+(?:(\d+)\s+)?(.*?)\s*Ki Spheres? obtained\b/gi)) {
        const start = match.index ?? 0;
        const spheresPerIncrement = Number(match[1] ?? 1);
        const kiSphereTypes = parseKiSphereTypes(match[2]);
        if (!kiSphereTypes || !Number.isInteger(spheresPerIncrement) || spheresPerIncrement < 1) {
            continue;
        }
        candidates.push({
            start,
            end: start + match[0].length,
            apply: atom => {
                atom.scaling = {
                    kind: "per_ki_sphere",
                    kiSphereTypes,
                    spheresPerIncrement,
                    kiContext: "collected_ki_spheres",
                };
            },
        });
    }
    for (const match of body.matchAll(/\b(?:per|with each)\s+((?:(?:Ki Blast|Unarmed|Physical)\s+)?(?:Super\s+)?attack\s+(?:performed|received)|attack\s+evaded|final blow\s+delivered)\b/gi)) {
        const scaling = parseCombatEventScalingHeader(`For every ${match[1]}`);
        if (!scaling || scaling.kind !== "per_combat_event") {
            continue;
        }
        const start = match.index ?? 0;
        candidates.push({
            start,
            end: start + match[0].length,
            apply: atom => {
                atom.scaling = clonePassiveEffectScaling(scaling);
            },
        });
    }

    const applied: EffectModifierCandidate[] = [];
    for (const modifier of candidates.sort((left, right) => left.start - right.start || left.end - right.end)) {
        const preceding = [...atoms]
            .reverse()
            .find(atom => atom.end <= modifier.start && !body.slice(atom.end, modifier.start).includes(";"));
        if (!preceding) {
            continue;
        }
        const bridge = stripKnownModifierText(body.slice(preceding.end, modifier.start));
        if (!/^[\s,()]*$/.test(bridge)) {
            continue;
        }
        if (/up to/i.test(modifierText(body, modifier))
            && /%/.test(modifierText(body, modifier))
            && preceding.atoms.some(atom => atom.unit !== "percent")) {
            continue;
        }
        for (const atom of preceding.atoms) {
            modifier.apply(atom);
        }
        applied.push(modifier);
    }
    return applied;
}

function stripKnownModifierText(sourceText: string): string {
    return sourceText
        .replace(/\bwithin the turn\b/gi, "")
        .replace(/\bfor\s+\d+\s+turn(?:s\b|\(s\)(?!\w)|\b)/gi, "")
        .replace(/\b(?:for the rest of (?:the )?battle|throughout (?:the )?battle|permanently)\b/gi, "")
        .replace(/\(\s*up to\s+\+?\d+(?:\.\d+)?%?\s*\)/gi, "")
        .replace(/\bper\s+(?:\d+\s+)?(?:AGL|TEQ|INT|STR|PHY|Rainbow|non[- ]Rainbow|Type)?\s*Ki Spheres? obtained\b/gi, "")
        .replace(/\b(?:per|with each)\s+(?:(?:Ki Blast|Unarmed|Physical)\s+)?(?:Super\s+)?attack\s+(?:performed|received)\b/gi, "")
        .replace(/\b(?:per|with each)\s+(?:attack\s+evaded|final blow\s+delivered)\b/gi, "");
}

function modifierText(body: string, modifier: EffectModifierCandidate): string {
    return body.slice(modifier.start, modifier.end);
}

function unknownSegmentsBetweenAtoms(
    body: string,
    atoms: Array<Pick<EffectAtomCandidate, "start" | "end">>,
): string[] {
    if (atoms.length === 0) {
        return body.trim() ? [body.trim()] : [];
    }
    const segments: string[] = [];
    let cursor = 0;
    for (const atom of [...atoms].sort((left, right) => left.start - right.start || left.end - right.end)) {
        if (atom.start < cursor) {
            cursor = Math.max(cursor, atom.end);
            continue;
        }
        const segment = cleanUnknownEffectSegment(body.slice(cursor, atom.start));
        if (segment) {
            segments.push(segment);
        }
        cursor = atom.end;
    }
    const finalSegment = cleanUnknownEffectSegment(body.slice(cursor));
    if (finalSegment) {
        segments.push(finalSegment);
    }
    return segments;
}

function cleanUnknownEffectSegment(sourceText: string): string {
    let text = sourceText.trim();
    let previous: string;
    do {
        previous = text;
        text = text
            .replace(/^(?:and|plus)\b\s*/i, "")
            .replace(/\s*\b(?:and|plus)$/i, "")
            .replace(/^[,;&]+\s*/, "")
            .replace(/\s*[,;&]+$/, "")
            .trim();
    } while (text !== previous);
    return text.replace(/\s+/g, " ");
}

const BENEFICIAL_EFFECT_KINDS = new Set<PassiveEffectKind>([
    "ki", "hp", "atk", "def", "damage_reduction", "guard", "evade_chance",
    "critical_chance", "additional_attack", "additional_super_attack",
    "effective_against_all_types", "ki_sphere_change", "scouter", "revive", "domain",
]);

function applyEffectTarget(atom: PassiveEffectAtom, resolvedTarget: ResolvedEffectTarget): PassiveEffect {
    const target: PassiveTarget = atom.kind === "ki_sphere_change"
        ? { scope: "self" }
        : { ...resolvedTarget.target };
    const allyTarget = isAllyTarget(target);
    return {
        ...atom,
        target,
        ...(resolvedTarget.categories ? { categories: resolvedTarget.categories } : {}),
        ...(resolvedTarget.classes ? { classes: resolvedTarget.classes } : {}),
        ...(resolvedTarget.types ? { types: resolvedTarget.types } : {}),
        ...(allyTarget && BENEFICIAL_EFFECT_KINDS.has(atom.kind)
            ? { classifications: ["support" as const] }
            : {}),
    };
}

const CALCULATION_BUCKET_EFFECT_KINDS = new Set<PassiveEffectKind>(["atk", "def"]);

function enrichCalculationPhase(
    effect: PassiveEffect,
    effectSourceText: string,
    context: EffectParseContext,
): PassiveEffect {
    if (effect.kind === "unknown") {
        return effect;
    }

    const explicitMoment = explicitActivationMoment(effectSourceText)
        ?? explicitActivationMoment(context.phaseContextText ?? "");
    const domainMoment = explicitMoment
        ? undefined
        : domainActivationMoment(context.phaseContextText, effect.scaling ?? context.headerScaling);
    const activationTiming: PassiveActivationTiming = explicitMoment
        ? { moment: explicitMoment, source: "explicit_text" }
        : domainMoment
            ? { moment: domainMoment, source: "documented_domain_rule" }
            : { moment: "unresolved", source: "unresolved" };

    if (!CALCULATION_BUCKET_EFFECT_KINDS.has(effect.kind)) {
        return { ...effect, activationTiming };
    }

    return {
        ...effect,
        activationTiming,
        calculationBucket: resolveCalculationBucket(
            effectSourceText,
            context.phaseContextText,
            context.headerScaling,
        ),
    };
}

function explicitActivationMoment(sourceText: string): PassiveActivationMoment | undefined {
    if (/\bwhen performing (?:a|an) (?:Super|Ultra Super) Attack\b/i.test(sourceText)) {
        return "when_performing_super_attack";
    }
    if (/\bafter (?:performing (?:a|an|\d+(?:\s+or\s+more)?) (?:Super |Ultra Super )?Attacks?|attacking)\b/i.test(sourceText)
        || /\bfor every (?:Super )?Attack performed\b/i.test(sourceText)) {
        return "after_attacking";
    }
    if (/\bbefore receiving (?:an?|the) attack\b/i.test(sourceText)) {
        return "before_incoming_attack";
    }
    if (/\bwhen receiving (?:an?|the) (?:(?:Ki Blast|Unarmed|Physical) )?(?:normal |Super )?Attack\b/i.test(sourceText)) {
        return "when_targeted_by_attack";
    }
    if (/\bafter receiving or evading (?:an?|the) attack\b/i.test(sourceText)
        || /\bfor every attack received or evaded\b/i.test(sourceText)) {
        return "after_incoming_attack_resolved";
    }
    if (/\bafter (?:receiving|being hit by) (?:an?|the|\d+(?:\s+or\s+more)?) (?:(?:Ki Blast|Unarmed|Physical) )?(?:normal |Super )?Attacks?\b/i.test(sourceText)
        || /\bfor every attack received(?!\s+or\s+evaded)\b/i.test(sourceText)) {
        return "after_attack_landed";
    }
    if (/\bwhen evading (?:an?|the) attack\b/i.test(sourceText)) {
        return "when_evading";
    }
    if (/\bafter evading (?:an?|the|\d+(?:\s+or\s+more)?) attacks?\b/i.test(sourceText)
        || /\bfor every attack evaded\b/i.test(sourceText)) {
        return "after_evading";
    }
    if (/\bafter (?:delivering (?:a|the)?\s*final blow|a final blow is delivered)\b/i.test(sourceText)
        || /\bfor every final blow delivered\b/i.test(sourceText)) {
        return "after_final_blow";
    }
    if (/\bbefore attacking\b/i.test(sourceText)) {
        return "before_attacking";
    }
    if (/\bwhen attacking\b/i.test(sourceText)) {
        return "when_attacking";
    }
    if (/\bat (?:the )?start of (?:each |the )?(?:attacking )?turn\b/i.test(sourceText)) {
        return "start_of_turn";
    }
    return undefined;
}

function activationMomentFromCombatEvent(event: CombatEventDescriptor): PassiveActivationMoment {
    if (event.eventType === "final_blow_delivered") {
        return event.relativeTiming === "after_event" ? "after_final_blow" : "unresolved";
    }
    if (event.eventType === "attack_evaded") {
        return event.relativeTiming === "after_event" ? "after_evading"
            : event.relativeTiming === "during_event" ? "when_evading"
                : "unresolved";
    }
    if (event.eventType === "incoming_attack") {
        return event.relativeTiming === "before_event" ? "before_incoming_attack"
            : event.relativeTiming === "during_event" ? "when_targeted_by_attack"
                : "unresolved";
    }
    if (event.eventType === "attack_landed") {
        return event.relativeTiming === "during_event" ? "when_attack_landed"
            : event.relativeTiming === "after_event" ? "after_attack_landed"
                : "unresolved";
    }
    if (event.attackKind === "super_attack" && event.relativeTiming === "during_event") {
        return "when_performing_super_attack";
    }
    return event.relativeTiming === "before_event" ? "before_attacking"
        : event.relativeTiming === "during_event" ? "when_attacking"
            : event.relativeTiming === "after_event" ? "after_attacking"
                : "unresolved";
}

function domainActivationMoment(
    phaseContextText: string | undefined,
    headerScaling: PassiveEffectScaling | undefined,
): PassiveActivationMoment | undefined {
    if (/^Basic effect\(s\)$/i.test(phaseContextText?.trim() ?? "")) {
        return "start_of_turn";
    }
    if (headerScaling?.kind === "per_ki_sphere" && /^For every\b/i.test(phaseContextText?.trim() ?? "")) {
        return "start_of_turn";
    }
    if (headerScaling?.kind === "per_combat_event") {
        const events = headerScaling.events;
        if (events.length > 1
            && events.every(event => event.relativeTiming === "after_event")
            && events.some(event => event.eventType === "attack_landed")
            && events.some(event => event.eventType === "attack_evaded")) {
            return "after_incoming_attack_resolved";
        }
        const moments = [...new Set(events.map(activationMomentFromCombatEvent))];
        return moments.length === 1 && moments[0] !== "unresolved" ? moments[0] : undefined;
    }
    return undefined;
}

function resolveCalculationBucket(
    effectSourceText: string,
    phaseContextText: string | undefined,
    headerScaling: PassiveEffectScaling | undefined,
): PassiveCalculationBucketAssignment {
    const inlineMoment = explicitActivationMoment(effectSourceText);
    if (/\b(?:when|after) performing (?:a|an) (?:Super|Ultra Super) Attack\b/i.test(effectSourceText)) {
        return { bucket: "passive_on_attack", source: "documented_domain_rule" };
    }
    if (/\bat (?:the )?start of (?:each |the )?(?:attacking )?turn\b/i.test(effectSourceText)) {
        return { bucket: "passive_start_of_turn", source: "documented_domain_rule" };
    }
    if (inlineMoment) {
        return { bucket: "unresolved", source: "unresolved" };
    }
    if (/\b(?:when|after) performing (?:a|an) (?:Super|Ultra Super) Attack\b/i.test(phaseContextText ?? "")) {
        return { bucket: "passive_on_attack", source: "documented_domain_rule" };
    }
    if (/\bat (?:the )?start of (?:each |the )?(?:attacking )?turn\b/i.test(phaseContextText ?? "")) {
        return { bucket: "passive_start_of_turn", source: "documented_domain_rule" };
    }
    if (/^Basic effect\(s\)$/i.test(phaseContextText?.trim() ?? "")) {
        return { bucket: "passive_start_of_turn", source: "documented_domain_rule" };
    }
    if (headerScaling?.kind === "per_ki_sphere" && /^For every\b/i.test(phaseContextText?.trim() ?? "")) {
        return { bucket: "passive_start_of_turn", source: "documented_domain_rule" };
    }
    return { bucket: "unresolved", source: "unresolved" };
}

function combineParseStatuses(conditionStatus: ParseStatus, effectStatus: ParseStatus): ParseStatus {
    if (conditionStatus === "supported" && effectStatus === "supported") {
        return "supported";
    }
    if (conditionStatus === "unknown" && effectStatus === "unknown") {
        return "unknown";
    }
    return "partial";
}

function confidenceFromStatus(status: ParseStatus): "high" | "medium" | "low" {
    return status === "supported" ? "high" : status === "partial" ? "medium" : "low";
}

function unknownEffect(
    sourceText: string,
    target: PassiveTarget = { scope: "unknown" },
    categories?: string[],
    classes?: TeamAnalysisClass[],
    types?: TeamAnalysisType[],
): PassiveEffect {
    return {
        kind: "unknown",
        target: { ...target },
        ...(categories ? { categories } : {}),
        ...(classes ? { classes } : {}),
        ...(types ? { types } : {}),
        sourceText,
    };
}

function unknownStandaloneRule(stateKey: string, block: LogicalPassiveBlock): PassiveRule {
    const fragment = block.source[block.source.length - 1];
    return {
        id: ruleIdFromFragment(stateKey, fragment),
        condition: { op: "unknown", sourceText: block.text },
        conditionStatus: "unknown",
        effects: [unknownEffect(block.text)],
        effectStatus: "unknown",
        source: block.source,
        parseStatus: "unknown",
        confidence: "low",
    };
}

function trimmedFragment(rawLine: string, lineIndex: number): SourceFragment {
    const text = rawLine.trim();
    const start = rawLine.indexOf(text);
    return {
        lineIndex,
        text,
        start,
        end: start + text.length,
    };
}

function ruleIdFromFragment(stateKey: string, fragment: SourceFragment): string {
    return `${stateKey}:r${fragment.lineIndex}:${fragment.start ?? 0}:${fragment.end ?? fragment.text.length}`;
}

function uniqueOrderedFragments(fragments: SourceFragment[]): SourceFragment[] {
    const byPosition = new Map<string, SourceFragment>();
    for (const fragment of fragments) {
        const key = `${fragment.lineIndex}:${fragment.start ?? ""}:${fragment.end ?? ""}:${fragment.text}`;
        byPosition.set(key, fragment);
    }
    return [...byPosition.values()].sort(compareFragments);
}

function compareFragments(left: SourceFragment, right: SourceFragment): number {
    return left.lineIndex - right.lineIndex
        || (left.start ?? 0) - (right.start ?? 0)
        || (left.end ?? left.text.length) - (right.end ?? right.text.length)
        || left.text.localeCompare(right.text);
}

function aggregatePassiveStatus(rules: PassiveRule[]): ParseStatus {
    if (rules.length === 0 || rules.every(rule => rule.parseStatus === "unknown")) {
        return "unknown";
    }
    if (rules.every(rule => rule.parseStatus === "supported")) {
        return "supported";
    }
    return "partial";
}

function countRuleStatuses(states: CharacterStateAnalysis[]): Record<ParseStatus, number> {
    const counts: Record<ParseStatus, number> = { supported: 0, partial: 0, unknown: 0 };
    for (const state of states) {
        for (const rule of state.passive?.rules ?? []) {
            counts[rule.parseStatus] += 1;
        }
    }
    return counts;
}

export function buildTeamAnalysisCoverageReport(dataset: TeamAnalysisDataset): TeamAnalysisCoverageReport {
    const passiveStatusCounts: Record<ParseStatus, number> = { supported: 0, partial: 0, unknown: 0 };
    const ruleStatusCounts: Record<ParseStatus, number> = { supported: 0, partial: 0, unknown: 0 };
    const conditionStatusCounts: Record<ParseStatus, number> = { supported: 0, partial: 0, unknown: 0 };
    const effectStatusCounts: Record<ParseStatus, number> = { supported: 0, partial: 0, unknown: 0 };
    const supportedPredicateCounts: Record<string, number> = {};
    const supportedEffectCounts: Record<string, number> = {};
    const probabilitySourceCounts: Record<ProbabilitySource, number> = {
        explicit_text: 0,
        first_party_game_db: 0,
        qualitative_lexicon: 0,
        unresolved: 0,
    };
    const conditionCounts = { always: 0, predicate: 0, unknown: 0, composite: 0 };
    const enemySelectionCounts: Record<string, number> = {};
    const kiPredicateContextCounts: Record<string, number> = {};
    const kiSphereTypePredicateCounts: Record<string, number> = {};
    const scaledEffectSphereTypeCounts: Record<string, number> = {};
    const combatPredicateKindCounts: Record<string, number> = {};
    const combatEventTypeCounts: Record<string, number> = {};
    const combatAttackKindCounts: Record<string, number> = {};
    const combatAttackStyleCounts: Record<string, number> = {};
    const combatModeCounts: Record<string, number> = {};
    const combatCountScopeCounts: Record<string, number> = {};
    const combatRelativeTimingCounts: Record<string, number> = {};
    const conversionSourceSelectionCounts: Record<string, number> = {};
    const conversionDestinationTypeCounts: Record<string, number> = {};
    const activationMomentCounts: Record<PassiveActivationMoment, number> = {
        start_of_turn: 0,
        before_attacking: 0,
        when_attacking: 0,
        when_performing_super_attack: 0,
        before_incoming_attack: 0,
        when_targeted_by_attack: 0,
        when_attack_landed: 0,
        after_incoming_attack_resolved: 0,
        after_attacking: 0,
        after_attack_landed: 0,
        when_evading: 0,
        after_evading: 0,
        after_final_blow: 0,
        unresolved: 0,
    };
    const activationSourceCounts: Record<CalculationPhaseResolutionSource, number> = {
        explicit_text: 0,
        first_party_game_db: 0,
        documented_domain_rule: 0,
        dokkan_fyi_structural_marker: 0,
        unresolved: 0,
    };
    const bucketCounts: Record<PassiveCalculationBucket, number> = {
        passive_start_of_turn: 0,
        passive_on_attack: 0,
        unresolved: 0,
    };
    const bucketSourceCounts: Record<CalculationPhaseResolutionSource, number> = {
        explicit_text: 0,
        first_party_game_db: 0,
        documented_domain_rule: 0,
        dokkan_fyi_structural_marker: 0,
        unresolved: 0,
    };
    const enemyStatusEvidenceResolutionCounts = { supported: 0, partial: 0, unresolved: 0 };
    const enemyStatusEvidenceStatusCounts: Record<string, number> = {};
    const enemyStatusEvidenceSourceCounts: Record<string, number> = {};
    let enemyStatusEvidenceStateCount = 0;
    let fullyRecoveredEnemyStatusStateCount = 0;
    let partialEnemyStatusStateCount = 0;
    let unresolvedEnemyStatusStateCount = 0;
    let enemyStatusEvidenceCount = 0;
    let passiveStructuralEvidenceCount = 0;
    let superAttackStructuralEvidenceCount = 0;
    let divergentStructuralCorroborationCount = 0;
    let structuralSemanticConflictCount = 0;
    const structuralMarkerCounts: Record<string, number> = {};
    const structuralResolutionCounts: Record<string, number> = {};
    const structuralSuperAttackVariantCounts: Record<string, number> = {};
    const activationLimitKindCounts: Record<string, number> = {};
    const applicationTriggerKindCounts: Record<string, number> = {};
    const lifecycleDurationSourceCounts: Record<string, number> = {};
    const stackingScopeCounts: Record<string, number> = {};
    let passiveStateCount = 0;
    let unknownEffectCount = 0;
    let unresolvedProbabilityEffectCount = 0;
    let derivedSupportEffectCount = 0;
    let unknownFragmentCount = 0;
    let teamEvaluableRuleCount = 0;
    let placementEvaluableRuleCount = 0;
    let scenarioRuleCount = 0;
    let scenarioEvaluableRuleCount = 0;
    let runtimeOnlyRuleCount = 0;
    let scaledEffectCount = 0;
    let activationEligibleEffectCount = 0;
    let bucketEligibleEffectCount = 0;
    let combatPredicateCount = 0;
    let combatScaledEffectCount = 0;
    let currentEventRuleCount = 0;
    let historyRuleCount = 0;
    const superAttackStatusCounts: Record<ParseStatus, number> = { supported: 0, partial: 0, unknown: 0 };
    const superAttackConditionStatusCounts: Record<ParseStatus, number> = { supported: 0, partial: 0, unknown: 0 };
    const superAttackEffectStatusCounts: Record<ParseStatus, number> = { supported: 0, partial: 0, unknown: 0 };
    const superAttackEffectKindCounts: Record<string, number> = {};
    const superAttackTargetScopeCounts: Record<string, number> = {};
    const superAttackDurationKindCounts: Record<string, number> = {};
    const superAttackStackingKindCounts: Record<string, number> = {};
    const superAttackProbabilitySourceCounts: Record<ProbabilitySource, number> = {
        explicit_text: 0,
        first_party_game_db: 0,
        qualitative_lexicon: 0,
        unresolved: 0,
    };
    const superAttackCalculationBucketCounts: Record<string, number> = {};
    const superAttackQualitativeChanceTermCounts: Record<string, number> = {};
    let superAttackCount = 0;
    let superAttackTypedEffectCount = 0;
    let superAttackNumericStatEffectCount = 0;
    let superAttackCappedStackingEffectCount = 0;
    let superAttackNumericProbabilityEffectCount = 0;
    let superAttackUnparsedFragmentCount = 0;

    for (const state of dataset.states) {
        for (const attack of state.superAttacks ?? []) {
            superAttackCount += 1;
            superAttackStatusCounts[attack.parseStatus] += 1;
            superAttackConditionStatusCounts[attack.condition.parseStatus] += 1;
            superAttackEffectStatusCounts[attack.effectStatus] += 1;
            superAttackUnparsedFragmentCount += attack.unparsedFragments.length;
            for (const evidence of attack.structuralEvidence ?? []) {
                superAttackStructuralEvidenceCount += 1;
                structuralSuperAttackVariantCounts[attack.variant] =
                    (structuralSuperAttackVariantCounts[attack.variant] ?? 0) + 1;
                collectStructuralEvidenceMetrics(
                    evidence,
                    structuralMarkerCounts,
                    structuralResolutionCounts,
                    value => { divergentStructuralCorroborationCount += value; },
                    value => { structuralSemanticConflictCount += value; },
                );
            }
            for (const effect of attack.effects) {
                superAttackTypedEffectCount += 1;
                if (effect.value !== undefined) superAttackNumericStatEffectCount += 1;
                superAttackEffectKindCounts[effect.kind] = (superAttackEffectKindCounts[effect.kind] ?? 0) + 1;
                superAttackTargetScopeCounts[effect.target.scope] = (superAttackTargetScopeCounts[effect.target.scope] ?? 0) + 1;
                superAttackDurationKindCounts[effect.duration.kind] = (superAttackDurationKindCounts[effect.duration.kind] ?? 0) + 1;
                lifecycleDurationSourceCounts[effect.duration.source] =
                    (lifecycleDurationSourceCounts[effect.duration.source] ?? 0) + 1;
                if (effect.activationLimit) {
                    activationLimitKindCounts[effect.activationLimit.kind] =
                        (activationLimitKindCounts[effect.activationLimit.kind] ?? 0) + 1;
                }
                if (effect.applicationTrigger) {
                    applicationTriggerKindCounts[effect.applicationTrigger.kind] =
                        (applicationTriggerKindCounts[effect.applicationTrigger.kind] ?? 0) + 1;
                }
                if (effect.stacking) {
                    superAttackStackingKindCounts[effect.stacking.kind] =
                        (superAttackStackingKindCounts[effect.stacking.kind] ?? 0) + 1;
                    if (effect.stacking.capPercent !== undefined) superAttackCappedStackingEffectCount += 1;
                    const scope = effect.stacking.scope ?? "unknown";
                    stackingScopeCounts[scope] = (stackingScopeCounts[scope] ?? 0) + 1;
                }
                if (effect.probabilitySource) {
                    superAttackProbabilitySourceCounts[effect.probabilitySource] += 1;
                }
                if (effect.qualitativeChanceTerm) {
                    superAttackQualitativeChanceTermCounts[effect.qualitativeChanceTerm] =
                        (superAttackQualitativeChanceTermCounts[effect.qualitativeChanceTerm] ?? 0) + 1;
                }
                if (effect.activationChancePercent !== undefined) superAttackNumericProbabilityEffectCount += 1;
                if (effect.calculationBucket) {
                    superAttackCalculationBucketCounts[effect.calculationBucket.bucket] =
                        (superAttackCalculationBucketCounts[effect.calculationBucket.bucket] ?? 0) + 1;
                }
            }
        }
        if (!state.passive) {
            continue;
        }
        passiveStateCount += 1;
        passiveStatusCounts[state.passive.parseStatus] += 1;
        unknownFragmentCount += state.passive.unparsedFragments.length;
        const statusEvidence = state.passive.conditionEvidence ?? [];
        for (const evidence of state.passive.structuralEvidence ?? []) {
            passiveStructuralEvidenceCount += 1;
            collectStructuralEvidenceMetrics(
                evidence,
                structuralMarkerCounts,
                structuralResolutionCounts,
                value => { divergentStructuralCorroborationCount += value; },
                value => { structuralSemanticConflictCount += value; },
            );
        }
        if (statusEvidence.length > 0) {
            enemyStatusEvidenceStateCount += 1;
            enemyStatusEvidenceCount += statusEvidence.length;
            statusEvidence.forEach(evidence => {
                enemyStatusEvidenceResolutionCounts[evidence.resolution] += 1;
                enemyStatusEvidenceSourceCounts[evidence.provenance.source] =
                    (enemyStatusEvidenceSourceCounts[evidence.provenance.source] ?? 0) + 1;
                evidence.statuses.forEach(status => {
                    if (status.status) {
                        enemyStatusEvidenceStatusCounts[status.status] =
                            (enemyStatusEvidenceStatusCounts[status.status] ?? 0) + 1;
                    }
                });
            });
            if (statusEvidence.every(evidence => evidence.resolution === "supported")) {
                fullyRecoveredEnemyStatusStateCount += 1;
            } else if (statusEvidence.every(evidence => evidence.resolution === "unresolved")) {
                unresolvedEnemyStatusStateCount += 1;
            } else {
                partialEnemyStatusStateCount += 1;
            }
        }

        for (const rule of state.passive.rules) {
            ruleStatusCounts[rule.parseStatus] += 1;
            conditionStatusCounts[rule.conditionStatus] += 1;
            effectStatusCounts[rule.effectStatus] += 1;
            const conditionKind = classifyCondition(rule.condition);
            conditionCounts[conditionKind] += 1;
            const hasScenario = hasScenarioPredicate(rule.condition);
            const hasRuntime = hasRuntimePredicate(rule.condition);
            const hasPlacement = hasPlacementPredicate(rule.condition);
            if (hasScenario) {
                scenarioRuleCount += 1;
            }
            if (hasRuntime) {
                runtimeOnlyRuleCount += 1;
            }
            if (rule.conditionStatus === "supported" && !hasRuntime) {
                if (hasScenario) {
                    scenarioEvaluableRuleCount += 1;
                } else if (hasPlacement) {
                    placementEvaluableRuleCount += 1;
                } else {
                    teamEvaluableRuleCount += 1;
                }
            }
            collectPredicates(rule.condition, supportedPredicateCounts);
            collectEnemySelections(rule.condition, enemySelectionCounts);
            collectKiPredicateMetrics(rule.condition, kiPredicateContextCounts, kiSphereTypePredicateCounts);
            const combatPredicates = collectCombatPredicates(rule.condition);
            let ruleHasCurrentCombatEvent = false;
            let ruleHasCombatHistory = false;
            for (const predicate of combatPredicates) {
                combatPredicateCount += 1;
                combatPredicateKindCounts[predicate.kind] = (combatPredicateKindCounts[predicate.kind] ?? 0) + 1;
                if (predicate.combatEvent) {
                    collectCombatEventMetrics(
                        predicate.combatEvent,
                        combatEventTypeCounts,
                        combatAttackKindCounts,
                        combatAttackStyleCounts,
                        combatModeCounts,
                        combatCountScopeCounts,
                        combatRelativeTimingCounts,
                    );
                    ruleHasCurrentCombatEvent ||= predicate.combatEvent.mode === "current_event";
                    ruleHasCombatHistory ||= predicate.combatEvent.mode === "accumulated_count";
                }
            }
            for (const effect of rule.effects) {
                if (effect.kind === "unknown") {
                    unknownEffectCount += 1;
                } else {
                    supportedEffectCounts[effect.kind] = (supportedEffectCounts[effect.kind] ?? 0) + 1;
                }
                if (effect.classifications?.includes("support")) {
                    derivedSupportEffectCount += 1;
                }
                if (effect.activationLimit) {
                    activationLimitKindCounts[effect.activationLimit.kind] =
                        (activationLimitKindCounts[effect.activationLimit.kind] ?? 0) + 1;
                }
                if (effect.applicationTrigger) {
                    applicationTriggerKindCounts[effect.applicationTrigger.kind] =
                        (applicationTriggerKindCounts[effect.applicationTrigger.kind] ?? 0) + 1;
                }
                if (effect.duration?.source) {
                    lifecycleDurationSourceCounts[effect.duration.source] =
                        (lifecycleDurationSourceCounts[effect.duration.source] ?? 0) + 1;
                }
                if (effect.stacking) {
                    const scope = effect.stacking.scope ?? "unknown";
                    stackingScopeCounts[scope] = (stackingScopeCounts[scope] ?? 0) + 1;
                }
                const probabilitySources = [effect.probabilitySource, effect.additionalToSuperProbabilitySource]
                    .filter((source): source is ProbabilitySource => source !== undefined);
                for (const source of probabilitySources) {
                    probabilitySourceCounts[source] += 1;
                }
                if (probabilitySources.includes("unresolved")) {
                    unresolvedProbabilityEffectCount += 1;
                }
                if (effect.scaling?.kind === "per_ki_sphere") {
                    scaledEffectCount += 1;
                    for (const type of effect.scaling.kiSphereTypes) {
                        scaledEffectSphereTypeCounts[type] = (scaledEffectSphereTypeCounts[type] ?? 0) + 1;
                    }
                }
                if (effect.scaling?.kind === "per_combat_event") {
                    combatScaledEffectCount += 1;
                    ruleHasCombatHistory = true;
                    effect.scaling.events.forEach(event => collectCombatEventMetrics(
                        event,
                        combatEventTypeCounts,
                        combatAttackKindCounts,
                        combatAttackStyleCounts,
                        combatModeCounts,
                        combatCountScopeCounts,
                        combatRelativeTimingCounts,
                    ));
                }
                if (effect.kiSphereChange) {
                    const selection = effect.kiSphereChange.sourceSelection;
                    const destination = effect.kiSphereChange.destinationType;
                    conversionSourceSelectionCounts[selection] = (conversionSourceSelectionCounts[selection] ?? 0) + 1;
                    conversionDestinationTypeCounts[destination] = (conversionDestinationTypeCounts[destination] ?? 0) + 1;
                }
                if (effect.kind !== "unknown") {
                    activationEligibleEffectCount += 1;
                    activationMomentCounts[effect.activationTiming?.moment ?? "unresolved"] += 1;
                    activationSourceCounts[effect.activationTiming?.source ?? "unresolved"] += 1;
                }
                if (CALCULATION_BUCKET_EFFECT_KINDS.has(effect.kind)) {
                    bucketEligibleEffectCount += 1;
                    bucketCounts[effect.calculationBucket?.bucket ?? "unresolved"] += 1;
                    bucketSourceCounts[effect.calculationBucket?.source ?? "unresolved"] += 1;
                }
            }
            if (ruleHasCurrentCombatEvent) {
                currentEventRuleCount += 1;
            }
            if (ruleHasCombatHistory) {
                historyRuleCount += 1;
            }
        }
    }

    return {
        generatedAt: dataset.generatedAt,
        sourceCharacterDatasetVersion: dataset.sourceCharacterDatasetVersion,
        sourceCharacterPayloadSha256: dataset.sourceCharacterPayloadSha256,
        sourceStateCount: dataset.stateCount,
        passiveStateCount,
        passiveStatusCounts,
        parsedRuleCount: dataset.supportedRuleCount + dataset.partialRuleCount + dataset.unknownRuleCount,
        ruleStatusCounts,
        conditionStatusCounts,
        effectStatusCounts,
        conditionCounts,
        supportedPredicateCounts: sortedRecord(supportedPredicateCounts),
        supportedEffectCounts: sortedRecord(supportedEffectCounts),
        derivedSupportEffectCount,
        unknownEffectCount,
        unresolvedProbabilityEffectCount,
        probabilitySourceCounts,
        unknownFragmentCount,
        teamEvaluableRuleCount,
        placementEvaluableRuleCount,
        scenarioRuleCount,
        scenarioEvaluableRuleCount,
        enemySelectionCounts: sortedRecord(enemySelectionCounts),
        enemyStatusEvidence: {
            stateCount: enemyStatusEvidenceStateCount,
            evidenceCount: enemyStatusEvidenceCount,
            fullyRecoveredStateCount: fullyRecoveredEnemyStatusStateCount,
            partialStateCount: partialEnemyStatusStateCount,
            unresolvedStateCount: unresolvedEnemyStatusStateCount,
            resolutionCounts: enemyStatusEvidenceResolutionCounts,
            statusCounts: sortedRecord(enemyStatusEvidenceStatusCounts),
            sourceCounts: sortedRecord(enemyStatusEvidenceSourceCounts),
        },
        structuralEvidence: {
            evidenceCount: passiveStructuralEvidenceCount + superAttackStructuralEvidenceCount,
            passiveEvidenceCount: passiveStructuralEvidenceCount,
            superAttackEvidenceCount: superAttackStructuralEvidenceCount,
            markerCounts: sortedRecord(structuralMarkerCounts),
            resolutionCounts: sortedRecord(structuralResolutionCounts),
            superAttackVariantCounts: sortedRecord(structuralSuperAttackVariantCounts),
            divergentCorroborationCount: divergentStructuralCorroborationCount,
            semanticConflictCount: structuralSemanticConflictCount,
        },
        lifecycle: {
            activationLimitKindCounts: sortedRecord(activationLimitKindCounts),
            applicationTriggerKindCounts: sortedRecord(applicationTriggerKindCounts),
            durationSourceCounts: sortedRecord(lifecycleDurationSourceCounts),
            stackingScopeCounts: sortedRecord(stackingScopeCounts),
        },
        kiAnalysis: {
            predicateContextCounts: sortedRecord(kiPredicateContextCounts),
            sphereTypePredicateCounts: sortedRecord(kiSphereTypePredicateCounts),
            scaledEffectCount,
            scaledEffectSphereTypeCounts: sortedRecord(scaledEffectSphereTypeCounts),
            conversionSourceSelectionCounts: sortedRecord(conversionSourceSelectionCounts),
            conversionDestinationTypeCounts: sortedRecord(conversionDestinationTypeCounts),
        },
        calculationPhase: {
            activationEligibleEffectCount,
            activationMomentCounts,
            activationSourceCounts,
            bucketEligibleEffectCount,
            bucketCounts,
            bucketSourceCounts,
        },
        combatEvents: {
            predicateCount: combatPredicateCount,
            scaledEffectCount: combatScaledEffectCount,
            currentEventRuleCount,
            historyRuleCount,
            predicateKindCounts: sortedRecord(combatPredicateKindCounts),
            eventTypeCounts: sortedRecord(combatEventTypeCounts),
            attackKindCounts: sortedRecord(combatAttackKindCounts),
            attackStyleCounts: sortedRecord(combatAttackStyleCounts),
            modeCounts: sortedRecord(combatModeCounts),
            countScopeCounts: sortedRecord(combatCountScopeCounts),
            relativeTimingCounts: sortedRecord(combatRelativeTimingCounts),
        },
        superAttacks: {
            attackCount: superAttackCount,
            attackStatusCounts: superAttackStatusCounts,
            conditionStatusCounts: superAttackConditionStatusCounts,
            effectStatusCounts: superAttackEffectStatusCounts,
            typedEffectCount: superAttackTypedEffectCount,
            numericStatEffectCount: superAttackNumericStatEffectCount,
            effectKindCounts: sortedRecord(superAttackEffectKindCounts),
            targetScopeCounts: sortedRecord(superAttackTargetScopeCounts),
            durationKindCounts: sortedRecord(superAttackDurationKindCounts),
            stackingKindCounts: sortedRecord(superAttackStackingKindCounts),
            cappedStackingEffectCount: superAttackCappedStackingEffectCount,
            probabilitySourceCounts: superAttackProbabilitySourceCounts,
            qualitativeChanceTermCounts: sortedRecord(superAttackQualitativeChanceTermCounts),
            numericProbabilityEffectCount: superAttackNumericProbabilityEffectCount,
            calculationBucketCounts: sortedRecord(superAttackCalculationBucketCounts),
            unparsedFragmentCount: superAttackUnparsedFragmentCount,
        },
        runtimeOnlyRuleCount,
        identity: {
            variantGroupAssignedStateCount: dataset.states.filter(state => Boolean(state.variantGroupId)).length,
            variantGroupOmittedStateCount: dataset.states.filter(state => !state.variantGroupId).length,
            awakeningFamilyAssignedStateCount: dataset.states.filter(state => Boolean(state.awakeningFamilyId)).length,
        },
    };
}

function collectStructuralEvidenceMetrics(
    evidence: EffectStructuralEvidence,
    markerCounts: Record<string, number>,
    resolutionCounts: Record<string, number>,
    addDivergence: (value: number) => void,
    addConflict: (value: number) => void,
): void {
    resolutionCounts[evidence.resolution] = (resolutionCounts[evidence.resolution] ?? 0) + 1;
    for (const marker of evidence.markers) {
        markerCounts[marker.markerKind] = (markerCounts[marker.markerKind] ?? 0) + 1;
    }
    addDivergence((evidence.corroboration ?? []).filter(item => item.resolution === "divergent").length);
    addConflict(evidence.semanticConflicts?.length ?? 0);
}

function classifyCondition(condition: ConditionExpression): "always" | "predicate" | "unknown" | "composite" {
    if (condition.op === "always" || condition.op === "predicate" || condition.op === "unknown") {
        return condition.op;
    }
    return "composite";
}

const SCENARIO_PREDICATES = new Set<PassivePredicateKind>([
    "hp_percent", "battle_turn", "turn_from_entry", "turn_number", "turns_from_entry",
    "enemy_count", "enemy_category",
    "enemy_name", "enemy_class", "enemy_type", "enemy_class_type", "enemy_hp_percent",
    "enemy_status", "domain_active",
    "standby_active", "active_skill_used", "revive_triggered",
]);

const RUNTIME_PREDICATES = new Set<PassivePredicateKind>([
    "ki_amount", "ki_spheres_obtained", "ki_sphere_type_obtained", "incoming_attack",
    "incoming_super_attack", "attacks_performed",
    "attacks_received", "attacks_evaded", "super_attacks_performed", "super_attack_received",
    "final_blow_delivered", "chance_roll",
]);

const PLACEMENT_PREDICATES = new Set<PassivePredicateKind>([
    "battle_slot", "rotation_assignment", "rotation_partner_present", "floater_assignment",
]);

function hasScenarioPredicate(condition: ConditionExpression): boolean {
    return conditionHasPredicate(condition, predicate => SCENARIO_PREDICATES.has(predicate.kind));
}

function hasRuntimePredicate(condition: ConditionExpression): boolean {
    return conditionHasPredicate(condition, predicate => RUNTIME_PREDICATES.has(predicate.kind));
}

function hasPlacementPredicate(condition: ConditionExpression): boolean {
    return conditionHasPredicate(condition, predicate => PLACEMENT_PREDICATES.has(predicate.kind));
}

function conditionHasPredicate(
    condition: ConditionExpression,
    predicateMatcher: (predicate: PassivePredicate) => boolean,
): boolean {
    if (condition.op === "predicate") {
        return predicateMatcher(condition.predicate);
    }
    if (condition.op === "not") {
        return conditionHasPredicate(condition.child, predicateMatcher);
    }
    if (condition.op === "all" || condition.op === "any") {
        return condition.children.some(child => conditionHasPredicate(child, predicateMatcher));
    }
    return false;
}

function collectPredicates(condition: ConditionExpression, counts: Record<string, number>): void {
    if (condition.op === "predicate") {
        counts[condition.predicate.kind] = (counts[condition.predicate.kind] ?? 0) + 1;
        return;
    }
    if (condition.op === "not") {
        collectPredicates(condition.child, counts);
        return;
    }
    if (condition.op === "all" || condition.op === "any") {
        condition.children.forEach(child => collectPredicates(child, counts));
    }
}

function collectEnemySelections(condition: ConditionExpression, counts: Record<string, number>): void {
    if (condition.op === "predicate") {
        if (condition.predicate.enemySelection) {
            counts[condition.predicate.enemySelection] = (counts[condition.predicate.enemySelection] ?? 0) + 1;
        }
        return;
    }
    if (condition.op === "not") {
        collectEnemySelections(condition.child, counts);
        return;
    }
    if (condition.op === "all" || condition.op === "any") {
        condition.children.forEach(child => collectEnemySelections(child, counts));
    }
}

function collectKiPredicateMetrics(
    condition: ConditionExpression,
    contextCounts: Record<string, number>,
    sphereTypeCounts: Record<string, number>,
): void {
    if (condition.op === "predicate") {
        if (condition.predicate.kiContext) {
            contextCounts[condition.predicate.kiContext] = (contextCounts[condition.predicate.kiContext] ?? 0) + 1;
        }
        for (const type of condition.predicate.kiSphereTypes ?? []) {
            sphereTypeCounts[type] = (sphereTypeCounts[type] ?? 0) + 1;
        }
        return;
    }
    if (condition.op === "not") {
        collectKiPredicateMetrics(condition.child, contextCounts, sphereTypeCounts);
        return;
    }
    if (condition.op === "all" || condition.op === "any") {
        condition.children.forEach(child => collectKiPredicateMetrics(child, contextCounts, sphereTypeCounts));
    }
}

function collectCombatPredicates(condition: ConditionExpression): PassivePredicate[] {
    if (condition.op === "predicate") {
        return condition.predicate.combatEvent ? [condition.predicate] : [];
    }
    if (condition.op === "not") {
        return collectCombatPredicates(condition.child);
    }
    if (condition.op === "all" || condition.op === "any") {
        return condition.children.flatMap(collectCombatPredicates);
    }
    return [];
}

function collectCombatEventMetrics(
    event: CombatEventDescriptor,
    eventTypeCounts: Record<string, number>,
    attackKindCounts: Record<string, number>,
    attackStyleCounts: Record<string, number>,
    modeCounts: Record<string, number>,
    countScopeCounts: Record<string, number>,
    relativeTimingCounts: Record<string, number>,
): void {
    eventTypeCounts[event.eventType] = (eventTypeCounts[event.eventType] ?? 0) + 1;
    attackKindCounts[event.attackKind] = (attackKindCounts[event.attackKind] ?? 0) + 1;
    if (event.attackStyle) {
        attackStyleCounts[event.attackStyle] = (attackStyleCounts[event.attackStyle] ?? 0) + 1;
    }
    modeCounts[event.mode] = (modeCounts[event.mode] ?? 0) + 1;
    if (event.countScope) {
        countScopeCounts[event.countScope] = (countScopeCounts[event.countScope] ?? 0) + 1;
    }
    relativeTimingCounts[event.relativeTiming] = (relativeTimingCounts[event.relativeTiming] ?? 0) + 1;
}

function sortedRecord(record: Record<string, number>): Record<string, number> {
    return Object.fromEntries(Object.entries(record).sort(([left], [right]) => left.localeCompare(right)));
}

export function validateTeamAnalysisDataset(
    dataset: TeamAnalysisDataset,
    characters: Character[],
    catalogEntries: FyiCharacterCatalogEntry[],
): TeamAnalysisValidationIssue[] {
    const issues: TeamAnalysisValidationIssue[] = [];
    const stateKeys = new Set<string>();
    const ruleIds = new Set<string>();
    const expectedStates = expectedStateIdentities(characters, catalogEntries);
    const expectedSources = expectedStateSources(characters);

    if (dataset.stateCount !== dataset.states.length) {
        issues.push({ code: "state-count", message: `stateCount ${dataset.stateCount} does not match ${dataset.states.length} states.` });
    }
    const actualRuleCounts = countRuleStatuses(dataset.states);
    for (const status of ["supported", "partial", "unknown"] as ParseStatus[]) {
        const field = `${status}RuleCount` as "supportedRuleCount" | "partialRuleCount" | "unknownRuleCount";
        if (dataset[field] !== actualRuleCounts[status]) {
            issues.push({ code: "rule-count", message: `${field} ${dataset[field]} does not match ${actualRuleCounts[status]}.` });
        }
    }

    for (const state of dataset.states) {
        if (stateKeys.has(state.stateKey)) {
            issues.push({ code: "duplicate-state-key", message: `Duplicate state key ${state.stateKey}.`, stateKey: state.stateKey });
        }
        stateKeys.add(state.stateKey);
        const expected = expectedStates.get(state.stateKey);
        if (!expected) {
            issues.push({ code: "missing-reference", message: `State does not reference a character/form/release in the character payload.`, stateKey: state.stateKey });
        } else {
            validateStableIdentity(state, expected, issues);
            validateStateSource(state, expectedSources.get(state.stateKey), issues);
        }
        validatePassive(state, ruleIds, issues);
    }

    for (const stateKey of expectedStates.keys()) {
        if (!stateKeys.has(stateKey)) {
            issues.push({ code: "missing-state", message: `Character payload state ${stateKey} is absent.`, stateKey });
        }
    }
    return issues;
}

export function assertValidTeamAnalysisDataset(
    dataset: TeamAnalysisDataset,
    characters: Character[],
    catalogEntries: FyiCharacterCatalogEntry[],
): void {
    const issues = validateTeamAnalysisDataset(dataset, characters, catalogEntries);
    if (issues.length > 0) {
        const summary = issues.slice(0, 10).map(issue => {
            const location = [issue.stateKey, issue.ruleId].filter(Boolean).join(" / ");
            return `${issue.code}${location ? ` (${location})` : ""}: ${issue.message}`;
        }).join("\n");
        throw new Error(`Team analysis validation failed with ${issues.length} issue(s):\n${summary}`);
    }
}

/**
 * Validates a serialized delivery bundle against the exact character payload
 * without requiring the catalog that was used while generating it. Catalog-
 * derived identity values must remain internally consistent for every card;
 * all character/form/release sources are still validated by the normal
 * validator below.
 */
export function validateTeamAnalysisDatasetForDelivery(
    dataset: TeamAnalysisDataset,
    characters: Character[],
): TeamAnalysisValidationIssue[] {
    const issues: TeamAnalysisValidationIssue[] = [];
    const catalogEntries: FyiCharacterCatalogEntry[] = [];

    for (const character of characters) {
        const characterStates = dataset.states.filter(state => state.characterId === character.id);
        const firstState = characterStates[0];
        if (!firstState) {
            continue;
        }

        const expectedIdentity = JSON.stringify({
            canonicalId: firstState.canonicalId,
            gameCharacterId: firstState.gameCharacterId,
            baseCharacterId: firstState.baseCharacterId,
            variantGroupId: firstState.variantGroupId,
            awakeningFamilyId: firstState.awakeningFamilyId,
        });
        for (const state of characterStates.slice(1)) {
            const actualIdentity = JSON.stringify({
                canonicalId: state.canonicalId,
                gameCharacterId: state.gameCharacterId,
                baseCharacterId: state.baseCharacterId,
                variantGroupId: state.variantGroupId,
                awakeningFamilyId: state.awakeningFamilyId,
            });
            if (actualIdentity !== expectedIdentity) {
                issues.push({
                    code: "inconsistent-delivery-identity",
                    message: "Catalog-derived identity values differ across states of the same character.",
                    stateKey: state.stateKey,
                });
            }
        }

        catalogEntries.push({
            id: character.id,
            ...(firstState.canonicalId ? { canonicalId: firstState.canonicalId } : {}),
            ...(firstState.gameCharacterId ? { characterId: firstState.gameCharacterId } : {}),
            // The catalog type requires this field, but delivery validation must
            // preserve an actually absent catalog identity as undefined.
            baseCharacterId: firstState.baseCharacterId as string,
            name: character.name,
            hasEza: false,
            hasSeza: false,
            isReversiblyExchanged: false,
            isFreelyObtainable: false,
            isStageDropReward: false,
            isWorldTournamentReward: false,
            hasBattleMotion: false,
            sourceUrl: "",
        });
    }

    return [...issues, ...validateTeamAnalysisDataset(dataset, characters, catalogEntries)];
}

export function assertValidTeamAnalysisDatasetForDelivery(
    dataset: TeamAnalysisDataset,
    characters: Character[],
): void {
    const issues = validateTeamAnalysisDatasetForDelivery(dataset, characters);
    if (issues.length > 0) {
        const summary = issues.slice(0, 10).map(issue => {
            const location = [issue.stateKey, issue.ruleId].filter(Boolean).join(" / ");
            return `${issue.code}${location ? ` (${location})` : ""}: ${issue.message}`;
        }).join("\n");
        throw new Error(`Team analysis delivery validation failed with ${issues.length} issue(s):\n${summary}`);
    }
}

function expectedStateIdentities(
    characters: Character[],
    catalogEntries: FyiCharacterCatalogEntry[],
): Map<string, ResolvedIdentity> {
    const catalogById = new Map(catalogEntries.map(entry => [entry.id, entry]));
    const expected = new Map<string, ResolvedIdentity>();
    for (const character of characters) {
        const catalogEntry = catalogById.get(character.id);
        for (const form of [character, ...(character.transformations ?? [])] as AnalysisFormSource[]) {
            for (const releaseSource of analysisReleaseSources(form)) {
                const identity = resolveIdentity(character, form, catalogEntry, releaseSource.releaseState);
                expected.set(buildStateKey(identity.characterId, identity.formId, identity.releaseState), identity);
            }
        }
    }
    return expected;
}

function expectedStateSources(
    characters: Character[],
): Map<string, {
    displayName: string,
    passiveText: string,
    passiveDetails?: PassiveDetails,
    superAttacks: AnalysisSuperAttackSource[],
}> {
    const expected = new Map<string, {
        displayName: string,
        passiveText: string,
        passiveDetails?: PassiveDetails,
        superAttacks: AnalysisSuperAttackSource[],
    }>();
    for (const character of characters) {
        for (const form of [character, ...(character.transformations ?? [])] as AnalysisFormSource[]) {
            const releaseSources = analysisReleaseSources(form);
            for (const releaseSource of releaseSources) {
                expected.set(buildStateKey(character.id, form.id, releaseSource.releaseState), {
                    displayName: form.name,
                    passiveText: releaseSource.passiveText,
                    ...(releaseSource.passiveDetails ? { passiveDetails: releaseSource.passiveDetails } : {}),
                    superAttacks: analysisSuperAttackSources(
                        form,
                        releaseSource.releaseState,
                        releaseSources.length === 1,
                    ),
                });
            }
        }
    }
    return expected;
}

function validateStableIdentity(
    state: CharacterStateAnalysis,
    expected: ResolvedIdentity,
    issues: TeamAnalysisValidationIssue[],
): void {
    const fields: (keyof ResolvedIdentity)[] = [
        "characterId", "canonicalId", "gameCharacterId", "baseCharacterId", "hardDuplicateGroupId",
        "variantGroupId", "awakeningFamilyId", "formId", "releaseState",
    ];
    for (const field of fields) {
        if (state[field] !== expected[field]) {
            issues.push({
                code: "unstable-identity",
                message: `${field} is ${String(state[field])}; expected ${String(expected[field])} from source IDs.`,
                stateKey: state.stateKey,
            });
        }
    }
    const expectedStateKey = buildStateKey(state.characterId, state.formId, state.releaseState);
    if (state.stateKey !== expectedStateKey) {
        issues.push({ code: "unstable-state-key", message: `Expected ${expectedStateKey}.`, stateKey: state.stateKey });
    }
}

function validateStateSource(
    state: CharacterStateAnalysis,
    expected: {
        displayName: string,
        passiveText: string,
        passiveDetails?: PassiveDetails,
        superAttacks: AnalysisSuperAttackSource[],
    } | undefined,
    issues: TeamAnalysisValidationIssue[],
): void {
    if (!expected) {
        return;
    }
    if (state.displayName !== expected.displayName) {
        issues.push({ code: "display-name-source", message: `Display name does not match the character form.`, stateKey: state.stateKey });
    }
    if (expected.passiveText) {
        if (state.passive?.rawText !== expected.passiveText) {
            issues.push({ code: "passive-text-source", message: `Passive rawText does not exactly match the character form.`, stateKey: state.stateKey });
        }
        if (expected.passiveDetails) {
            const sourceMap = mapPassiveDetailsToSource(expected.passiveText, expected.passiveDetails);
            if (sourceMap.unmappedTexts.length > 0) {
                issues.push({
                    code: "passive-details-source-map",
                    message: `${sourceMap.unmappedTexts.length} PassiveDetails text(s) do not map to rawText offsets.`,
                    stateKey: state.stateKey,
                });
            }
            const sourceEvidence = expected.passiveDetails.conditionEvidence ?? [];
            const validEvidence = validConditionEvidence(
                state.stateKey,
                expected.passiveText,
                sourceMap.sourceFragments,
                sourceEvidence,
                {
                    characterId: state.characterId,
                    formId: state.formId,
                    releaseState: state.releaseState,
                },
            );
            if (validEvidence.length !== sourceEvidence.length) {
                issues.push({
                    code: "condition-evidence-source",
                    message: `${sourceEvidence.length - validEvidence.length} condition evidence record(s) failed source validation.`,
                    stateKey: state.stateKey,
                });
            }
            if (JSON.stringify(state.passive?.conditionEvidence ?? []) !== JSON.stringify(validEvidence)) {
                issues.push({
                    code: "condition-evidence-output",
                    message: `Serialized condition evidence does not match the validated PassiveDetails evidence.`,
                    stateKey: state.stateKey,
                });
            }
            const sourceStructuralEvidence = expected.passiveDetails.structuralSource?.evidence ?? [];
            const validStructural = validStructuralEvidence(
                state.stateKey,
                expected.passiveText,
                expected.passiveDetails.structuralSource,
                "passive",
                undefined,
                expected.passiveDetails.sourceSkillId,
            );
            if (validStructural.length !== sourceStructuralEvidence.length) {
                issues.push({
                    code: "structural-evidence-source",
                    message: `${sourceStructuralEvidence.length - validStructural.length} passive structural evidence record(s) failed source validation.`,
                    stateKey: state.stateKey,
                });
            }
            const expectedStructuralOutput = parsePassive(
                state.stateKey,
                expected.passiveDetails.name,
                expected.passiveText,
                expected.passiveDetails,
                { characterId: state.characterId, formId: state.formId, releaseState: state.releaseState },
            ).structuralEvidence ?? [];
            if (JSON.stringify(state.passive?.structuralEvidence ?? []) !== JSON.stringify(expectedStructuralOutput)) {
                issues.push({
                    code: "structural-evidence-output",
                    message: `Serialized passive structural evidence does not match validated source evidence.`,
                    stateKey: state.stateKey,
                });
            }
        }
    } else if (state.passive) {
        issues.push({ code: "unexpected-passive", message: `Analysis contains a passive absent from the character form.`, stateKey: state.stateKey });
    }
    validateSuperAttacks(state, expected.superAttacks, issues);
}

function validateSuperAttacks(
    state: CharacterStateAnalysis,
    expectedSources: AnalysisSuperAttackSource[],
    issues: TeamAnalysisValidationIssue[],
): void {
    const attacks = state.superAttacks ?? [];
    if (attacks.length !== expectedSources.length) {
        issues.push({
            code: "super-attack-count",
            message: `State has ${attacks.length} Super Attacks; expected ${expectedSources.length} from the character payload.`,
            stateKey: state.stateKey,
        });
    }
    const ids = new Set<string>();
    attacks.forEach((attack, index) => {
        const expected = expectedSources[index];
        if (ids.has(attack.id)) {
            issues.push({ code: "duplicate-super-attack-id", message: `Duplicate Super Attack ID ${attack.id}.`, stateKey: state.stateKey });
        }
        ids.add(attack.id);
        const expectedId = `${state.stateKey}:super-attack:${attack.variant}:${attack.ordinal}`;
        if (attack.id !== expectedId) {
            issues.push({ code: "unstable-super-attack-id", message: `Expected Super Attack ID ${expectedId}.`, stateKey: state.stateKey });
        }
        if (expected) {
            const fields: Array<[string, unknown, unknown]> = [
                ["variant", attack.variant, expected.variant],
                ["ordinal", attack.ordinal, expected.ordinal],
                ["name", attack.name, expected.name],
                ["ki", attack.ki, expected.ki],
                ["attackType", attack.attackType, expected.attackType],
                ["style", attack.style, expected.style],
                ["rawText", attack.rawText, expected.effectText],
                ["condition.rawText", attack.condition.rawText, expected.conditionText],
            ];
            for (const [field, actual, expectedValue] of fields) {
                if (actual !== expectedValue) {
                    issues.push({ code: "super-attack-source", message: `${field} does not match the character payload.`, stateKey: state.stateKey });
                }
            }
            const sourceStructuralEvidence = expected.structuralSource?.evidence ?? [];
            const expectedParsed = parseSuperAttack(state.stateKey, expected);
            if ((expectedParsed.structuralEvidence?.length ?? 0) !== sourceStructuralEvidence.length) {
                issues.push({
                    code: "super-attack-structural-evidence-source",
                    message: `${sourceStructuralEvidence.length - (expectedParsed.structuralEvidence?.length ?? 0)} Super Attack structural evidence record(s) failed source validation.`,
                    stateKey: state.stateKey,
                });
            }
            if (JSON.stringify(attack.structuralEvidence ?? []) !== JSON.stringify(expectedParsed.structuralEvidence ?? [])) {
                issues.push({
                    code: "super-attack-structural-evidence-output",
                    message: `Serialized Super Attack structural evidence does not match validated source evidence.`,
                    stateKey: state.stateKey,
                });
            }
        }
        validateSuperAttack(attack, state, issues);
    });
}

function validateSuperAttack(
    attack: ParsedSuperAttack,
    state: CharacterStateAnalysis,
    issues: TeamAnalysisValidationIssue[],
): void {
    const variants: SuperAttackVariant[] = ["normal", "ultra", "extra", "unit"];
    if (!variants.includes(attack.variant)) {
        issues.push({ code: "super-attack-variant", message: `Super Attack variant is not recognized.`, stateKey: state.stateKey });
    }
    if (!Number.isInteger(attack.ordinal) || attack.ordinal < 0) {
        issues.push({ code: "super-attack-ordinal", message: `Super Attack ordinal must be a non-negative integer.`, stateKey: state.stateKey });
    }
    if (attack.ki !== undefined && (!Number.isInteger(attack.ki) || attack.ki < 0 || attack.ki > 24)) {
        issues.push({ code: "super-attack-ki", message: `Super Attack Ki must be an integer within 0..24.`, stateKey: state.stateKey });
    }
    if (attack.effectOrigin !== "super_attack") {
        issues.push({ code: "super-attack-origin", message: `Super Attack channel cannot contain passive or Active Skill effects.`, stateKey: state.stateKey });
    }
    const rawLines = attack.rawText.replace(/\r\n/g, "\n").split("\n");
    validateFragmentList(attack.sourceFragments, rawLines, state, undefined, issues);
    validateFragmentList(attack.unparsedFragments, rawLines, state, undefined, issues);
    validateLosslessFragmentCoverage(attack.sourceFragments, rawLines, "super-attack-source-token-loss", state, issues);
    validateLosslessFragmentCoverage(
        uniqueOrderedFragments([
            ...attack.effects.flatMap(effect => effect.source),
            ...attack.unparsedFragments,
        ]),
        rawLines,
        "super-attack-effect-partition-token-loss",
        state,
        issues,
    );

    const conditionLines = attack.condition.rawText.replace(/\r\n/g, "\n").split("\n");
    validateFragmentList(attack.condition.sourceFragments, conditionLines, state, undefined, issues);
    validateFragmentList(attack.condition.unparsedFragments, conditionLines, state, undefined, issues);
    validateLosslessFragmentCoverage(
        attack.condition.sourceFragments,
        conditionLines,
        "super-attack-condition-token-loss",
        state,
        issues,
    );
    if (!attack.condition.rawText) {
        if (attack.condition.expression.op !== "always" || attack.condition.parseStatus !== "supported"
            || attack.condition.unparsedFragments.length !== 0) {
            issues.push({ code: "super-attack-condition-empty", message: `An empty Super Attack condition must be explicit always with no residual.`, stateKey: state.stateKey });
        }
    } else if (attack.condition.expression.op !== "unknown" || attack.condition.parseStatus !== "unknown") {
        issues.push({ code: "super-attack-condition-unsupported", message: `Unmodeled Super Attack conditions must remain unknown.`, stateKey: state.stateKey });
    }

    const expectedEffectStatus = superAttackEffectListStatus(attack.effects);
    if (attack.effectStatus !== expectedEffectStatus) {
        issues.push({ code: "super-attack-effect-status", message: `Super Attack effectStatus does not match its effects.`, stateKey: state.stateKey });
    }
    const expectedParseStatus: ParseStatus = attack.effects.length === 0
        ? "unknown"
        : attack.unparsedFragments.length > 0
            || attack.condition.parseStatus !== "supported"
            || attack.effectStatus !== "supported"
            ? "partial"
            : "supported";
    if (attack.parseStatus !== expectedParseStatus) {
        issues.push({ code: "super-attack-status", message: `Super Attack parseStatus does not match condition/effect/residual status.`, stateKey: state.stateKey });
    }
    attack.effects.forEach(effect => validateSuperAttackEffect(effect, attack, state, issues));
}

function validateSuperAttackEffect(
    effect: SuperAttackEffect,
    attack: ParsedSuperAttack,
    state: CharacterStateAnalysis,
    issues: TeamAnalysisValidationIssue[],
): void {
    const kinds: SuperAttackEffectKind[] = [
        "atk_raise", "def_raise", "enemy_atk_lowering", "enemy_def_lowering", "stun", "super_attack_seal",
    ];
    const magnitudes: SuperAttackEffectMagnitude[] = [
        "raise", "greatly_raise", "massively_raise", "lower", "greatly_lower", "massively_lower",
    ];
    const scopes: SuperAttackEffectTarget["scope"][] = ["self", "allies", "current_target", "all_enemies", "unknown"];
    const sources: CalculationPhaseResolutionSource[] = [
        "explicit_text", "first_party_game_db", "documented_domain_rule", "dokkan_fyi_structural_marker", "unresolved",
    ];
    if (!kinds.includes(effect.kind)) {
        issues.push({ code: "super-attack-effect-kind", message: `Super Attack effect kind is not recognized.`, stateKey: state.stateKey });
    }
    if (effect.origin !== "super_attack") {
        issues.push({ code: "super-attack-effect-origin", message: `Super Attack effects must retain super_attack origin.`, stateKey: state.stateKey });
    }
    if (!scopes.includes(effect.target.scope)) {
        issues.push({ code: "super-attack-target", message: `Super Attack effect target is not recognized.`, stateKey: state.stateKey });
    }
    if (effect.target.scope === "allies" && effect.target.selfInclusion === undefined) {
        issues.push({ code: "super-attack-target-self-inclusion", message: `Allies target must preserve self-inclusion uncertainty.`, stateKey: state.stateKey });
    }
    if (effect.target.scope !== "allies" && effect.target.selfInclusion !== undefined) {
        issues.push({ code: "super-attack-target-self-inclusion-kind", message: `Self inclusion belongs only to the allies target.`, stateKey: state.stateKey });
    }
    const statRaise = effect.kind === "atk_raise" || effect.kind === "def_raise";
    const enemyLowering = effect.kind === "enemy_atk_lowering" || effect.kind === "enemy_def_lowering";
    const statEffect = statRaise || enemyLowering;
    if (statRaise && !["self", "allies"].includes(effect.target.scope)) {
        issues.push({ code: "super-attack-raise-target", message: `ATK/DEF raises must target self or source-stated allies.`, stateKey: state.stateKey });
    }
    if ((enemyLowering || effect.kind === "stun" || effect.kind === "super_attack_seal")
        && !["current_target", "all_enemies"].includes(effect.target.scope)) {
        issues.push({ code: "super-attack-enemy-target", message: `Enemy effects must target the current target or all enemies.`, stateKey: state.stateKey });
    }
    if (statEffect && (!effect.magnitude || !magnitudes.includes(effect.magnitude))) {
        issues.push({ code: "super-attack-magnitude", message: `Stat effects require a recognized qualitative magnitude.`, stateKey: state.stateKey });
    }
    if (!statEffect && effect.magnitude !== undefined) {
        issues.push({ code: "super-attack-magnitude-kind", message: `Magnitude belongs only to Super Attack stat effects.`, stateKey: state.stateKey });
    }
    if ((effect.value === undefined) !== (effect.unit === undefined)) {
        issues.push({ code: "super-attack-value-unit", message: `Numeric Super Attack values and units must be paired.`, stateKey: state.stateKey });
    }
    if (effect.value !== undefined && (!Number.isFinite(effect.value) || effect.value < 0 || effect.unit !== "percent")) {
        issues.push({ code: "super-attack-value", message: `Numeric Super Attack stat values must be non-negative percentages.`, stateKey: state.stateKey });
    }
    if (!statEffect && effect.value !== undefined) {
        issues.push({ code: "super-attack-value-kind", message: `Numeric stat values belong only to raises or lowerings.`, stateKey: state.stateKey });
    }
    validateSuperAttackDuration(effect.duration, state, issues);
    if (statEffect && !effect.stacking) {
        issues.push({ code: "super-attack-stacking-required", message: `Stat effects must explicitly preserve stacking uncertainty.`, stateKey: state.stateKey });
    }
    if (!statEffect && effect.stacking) {
        issues.push({ code: "super-attack-stacking-kind", message: `Stacking metadata belongs only to stat effects.`, stateKey: state.stateKey });
    }
    if (effect.stacking) {
        const stackingKinds: SuperAttackEffectStacking["kind"][] = ["stackable", "not_stackable", "unknown"];
        if (!stackingKinds.includes(effect.stacking.kind) || !sources.includes(effect.stacking.source)) {
            issues.push({ code: "super-attack-stacking", message: `Stacking kind/source is not recognized.`, stateKey: state.stateKey });
        }
        if ((effect.stacking.kind === "unknown") !== (effect.stacking.source === "unresolved")) {
            issues.push({ code: "super-attack-stacking-resolution", message: `Unknown stacking and unresolved provenance must be paired.`, stateKey: state.stateKey });
        }
        if (effect.stacking.capPercent !== undefined
            && (effect.stacking.kind !== "stackable" || !Number.isFinite(effect.stacking.capPercent) || effect.stacking.capPercent < 0
                || !effect.stacking.capSource || !sources.includes(effect.stacking.capSource))) {
            issues.push({ code: "super-attack-stacking-cap", message: `A cap requires stackable semantics, a non-negative percentage, and provenance.`, stateKey: state.stateKey });
        }
        if (effect.stacking.capSource !== undefined && effect.stacking.capPercent === undefined) {
            issues.push({ code: "super-attack-stacking-cap-source", message: `Cap provenance requires an explicit cap.`, stateKey: state.stateKey });
        }
        const stackingScopes: EffectStackingScope[] = ["current_turn", "active_windows", "battle", "unknown"];
        if (effect.stacking.scope !== undefined && !stackingScopes.includes(effect.stacking.scope)) {
            issues.push({ code: "super-attack-stacking-scope", message: `Stacking scope is not recognized.`, stateKey: state.stateKey });
        }
    }
    validateEffectLifecycle(effect.activationLimit, effect.applicationTrigger, state, issues);
    if (statRaise && (effect.applicationTrigger?.kind !== "per_super_attack"
        || effect.stacking?.kind !== "stackable"
        || effect.stacking.scope !== superAttackStackingScope(effect.duration))) {
        issues.push({ code: "super-attack-raise-domain-rule", message: `Canonical stat raises must retain versioned per-Super cumulative window semantics.`, stateKey: state.stateKey });
    }
    validateSuperAttackProbability(effect, state, issues);
    const expectedParseStatus: ParseStatus = effect.probabilitySource === "unresolved" ? "partial" : "supported";
    if (effect.parseStatus !== expectedParseStatus) {
        issues.push({
            code: "super-attack-effect-parse-status",
            message: `Super Attack effect parse status does not match probability resolution.`,
            stateKey: state.stateKey,
        });
    }
    if (effect.activationTiming.moment !== "when_super_attack_effect_resolves"
        || effect.activationTiming.source !== "documented_domain_rule") {
        issues.push({ code: "super-attack-activation-timing", message: `Typed effects must remain in the Super Attack effect-resolution timing channel.`, stateKey: state.stateKey });
    }
    const expectedBucket = statRaise
        ? "super_attack_raise"
        : enemyLowering
            ? "super_attack_enemy_stat_lowering"
            : undefined;
    if (expectedBucket === undefined && effect.calculationBucket !== undefined) {
        issues.push({ code: "super-attack-bucket-kind", message: `Status effects do not receive a mathematical stat bucket.`, stateKey: state.stateKey });
    }
    if (expectedBucket !== undefined
        && (effect.calculationBucket?.bucket !== expectedBucket
            || effect.calculationBucket.source !== "documented_domain_rule")) {
        issues.push({ code: "super-attack-bucket", message: `Stat effect has the wrong future Super Attack calculation bucket.`, stateKey: state.stateKey });
    }
    const rawLines = attack.rawText.replace(/\r\n/g, "\n").split("\n");
    validateFragmentList(effect.source, rawLines, state, undefined, issues);
    if (effect.source.length === 0
        || effect.source.map(fragment => fragment.text).join("\n").replace(/\s/g, "") !== effect.sourceText.replace(/\s/g, "")) {
        issues.push({ code: "super-attack-effect-source", message: `Effect source fragments must reconstruct sourceText losslessly.`, stateKey: state.stateKey });
    }
}

function validateSuperAttackDuration(
    duration: SuperAttackEffectDuration,
    state: CharacterStateAnalysis,
    issues: TeamAnalysisValidationIssue[],
): void {
    const kinds: SuperAttackEffectDuration["kind"][] = ["current_turn", "turns", "permanent", "unknown"];
    const sources: CalculationPhaseResolutionSource[] = [
        "explicit_text", "first_party_game_db", "documented_domain_rule", "dokkan_fyi_structural_marker", "unresolved",
    ];
    if (!kinds.includes(duration.kind) || !sources.includes(duration.source)) {
        issues.push({ code: "super-attack-duration", message: `Super Attack duration kind/source is not recognized.`, stateKey: state.stateKey });
    }
    if ((duration.kind === "unknown") !== (duration.source === "unresolved")) {
        issues.push({ code: "super-attack-duration-resolution", message: `Unknown duration and unresolved provenance must be paired.`, stateKey: state.stateKey });
    }
    if (duration.kind === "turns") {
        if (!Number.isInteger(duration.turns) || (duration.turns ?? 0) <= 1) {
            issues.push({ code: "super-attack-duration-turns", message: `Multi-turn duration must declare an integer greater than 1.`, stateKey: state.stateKey });
        }
    } else if (duration.turns !== undefined) {
        issues.push({ code: "super-attack-duration-turns-kind", message: `Only a multi-turn duration may declare turns.`, stateKey: state.stateKey });
    }
}

function validateEffectLifecycle(
    activationLimit: EffectActivationLimit | undefined,
    applicationTrigger: EffectApplicationTrigger | undefined,
    state: CharacterStateAnalysis,
    issues: TeamAnalysisValidationIssue[],
    rule?: PassiveRule,
): void {
    const sources: CalculationPhaseResolutionSource[] = [
        "explicit_text", "first_party_game_db", "documented_domain_rule", "dokkan_fyi_structural_marker", "unresolved",
    ];
    if (activationLimit) {
        const kinds: EffectActivationLimit["kind"][] = ["once", "count", "unknown"];
        if (!kinds.includes(activationLimit.kind) || !sources.includes(activationLimit.source)) {
            issues.push({ code: "activation-limit", message: `Activation limit kind/source is not recognized.`, stateKey: state.stateKey, ruleId: rule?.id });
        }
        if (activationLimit.kind === "count") {
            if (!Number.isInteger(activationLimit.count) || (activationLimit.count ?? 0) <= 0) {
                issues.push({ code: "activation-limit-count", message: `Count activation limits require a positive integer.`, stateKey: state.stateKey, ruleId: rule?.id });
            }
        } else if (activationLimit.count !== undefined) {
            issues.push({ code: "activation-limit-count-kind", message: `Only count activation limits may carry count.`, stateKey: state.stateKey, ruleId: rule?.id });
        }
        validateDecisionProvenance(activationLimit.source, activationLimit.provenance, state, issues, rule);
    }
    if (applicationTrigger) {
        const kinds: EffectApplicationTriggerKind[] = ["per_super_attack", "per_combat_event", "entry", "unknown"];
        if (!kinds.includes(applicationTrigger.kind) || !sources.includes(applicationTrigger.source)
            || (applicationTrigger.kind === "unknown") !== (applicationTrigger.source === "unresolved")) {
            issues.push({ code: "application-trigger", message: `Application trigger kind/source is invalid.`, stateKey: state.stateKey, ruleId: rule?.id });
        }
        validateDecisionProvenance(applicationTrigger.source, applicationTrigger.provenance, state, issues, rule);
    }
}

function validateDecisionProvenance(
    source: CalculationPhaseResolutionSource,
    provenance: EffectDecisionProvenance | undefined,
    state: CharacterStateAnalysis,
    issues: TeamAnalysisValidationIssue[],
    rule?: PassiveRule,
): void {
    if (!provenance || provenance.source !== source
        || (source === "dokkan_fyi_structural_marker" && !provenance.evidenceId)
        || (source === "documented_domain_rule" && provenance.ruleVersion !== SUPER_ATTACK_STAT_RAISE_DOMAIN_RULE_VERSION)) {
        issues.push({ code: "effect-decision-provenance", message: `Effect lifecycle decision lacks matching provenance.`, stateKey: state.stateKey, ruleId: rule?.id });
    }
}

function validateSuperAttackProbability(
    effect: SuperAttackEffect,
    state: CharacterStateAnalysis,
    issues: TeamAnalysisValidationIssue[],
): void {
    const hasProbability = effect.activationChancePercent !== undefined
        || effect.qualitativeChanceTerm !== undefined
        || effect.probabilitySource !== undefined;
    if (hasProbability && effect.kind !== "stun" && effect.kind !== "super_attack_seal") {
        issues.push({ code: "super-attack-probability-kind", message: `Gate A7 probability belongs only to stun or Super Attack seal.`, stateKey: state.stateKey });
    }
    if ((effect.activationChancePercent !== undefined || effect.qualitativeChanceTerm !== undefined)
        && effect.probabilitySource === undefined) {
        issues.push({ code: "super-attack-probability-source", message: `Probability metadata requires provenance.`, stateKey: state.stateKey });
    }
    if (effect.activationChancePercent !== undefined
        && (!Number.isFinite(effect.activationChancePercent) || effect.activationChancePercent < 0 || effect.activationChancePercent > 100)) {
        issues.push({ code: "super-attack-probability-range", message: `Probability must be within 0..100.`, stateKey: state.stateKey });
    }
    if (effect.probabilitySource === "unresolved" && effect.activationChancePercent !== undefined) {
        issues.push({ code: "super-attack-probability-unresolved-value", message: `Unresolved probability cannot declare a percentage.`, stateKey: state.stateKey });
    }
    if (effect.probabilitySource !== undefined
        && effect.probabilitySource !== "unresolved"
        && effect.activationChancePercent === undefined) {
        issues.push({ code: "super-attack-probability-missing-value", message: `Resolved probability requires an explicit percentage.`, stateKey: state.stateKey });
    }
}

function validateLosslessFragmentCoverage(
    fragments: SourceFragment[],
    rawLines: string[],
    code: string,
    state: CharacterStateAnalysis,
    issues: TeamAnalysisValidationIssue[],
): void {
    const covered = rawLines.map(line => Array.from({ length: line.length }, () => false));
    for (const fragment of fragments) {
        if (fragment.start === undefined || fragment.end === undefined || !covered[fragment.lineIndex]) continue;
        for (let index = fragment.start; index < fragment.end; index += 1) covered[fragment.lineIndex][index] = true;
    }
    for (let lineIndex = 0; lineIndex < rawLines.length; lineIndex += 1) {
        for (let column = 0; column < rawLines[lineIndex].length; column += 1) {
            if (!/\s/.test(rawLines[lineIndex][column]) && !covered[lineIndex][column]) {
                issues.push({ code, message: `Source token at line ${lineIndex}, column ${column} is not referenced.`, stateKey: state.stateKey });
                return;
            }
        }
    }
}

function validatePassive(
    state: CharacterStateAnalysis,
    ruleIds: Set<string>,
    issues: TeamAnalysisValidationIssue[],
): void {
    const passive = state.passive;
    if (!passive) {
        return;
    }
    if (passive.parseStatus !== aggregatePassiveStatus(passive.rules)) {
        issues.push({ code: "passive-status", message: `Passive parse status does not match its rules.`, stateKey: state.stateKey });
    }
    const rawLines = passive.rawText.replace(/\r\n/g, "\n").split("\n");
    validateFragmentList(passive.unparsedFragments, rawLines, state, undefined, issues);
    for (const rule of passive.rules) {
        if (ruleIds.has(rule.id)) {
            issues.push({ code: "duplicate-rule-id", message: `Duplicate rule ID ${rule.id}.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        ruleIds.add(rule.id);
        const positionFragment = rule.source[rule.source.length - 1];
        if (!positionFragment || rule.id !== ruleIdFromFragment(state.stateKey, positionFragment)) {
            issues.push({ code: "unstable-rule-id", message: `Rule ID does not match state key and source position.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (rule.effects.length === 0) {
            issues.push({ code: "empty-effects", message: `Rule has no effects.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        const conditionStatus = conditionExpressionStatus(rule.condition);
        const effectStatus = effectListStatus(rule.effects);
        if (rule.conditionStatus !== conditionStatus) {
            issues.push({ code: "condition-status", message: `Condition status does not match its AST.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (rule.effectStatus !== effectStatus) {
            issues.push({ code: "effect-status", message: `Effect status does not match its effects.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (rule.parseStatus !== combineParseStatuses(rule.conditionStatus, rule.effectStatus)) {
            issues.push({ code: "rule-status", message: `Rule status does not match condition/effect status.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        validateCondition(rule.condition, 1, state, rule, issues);
        validateFragmentList(rule.source, rawLines, state, rule, issues);
        for (const effect of rule.effects) {
            validateFiniteNumbers(effect, state, rule, issues);
            validateEffectContract(effect, state, rule, issues);
            for (const field of ["activationChancePercent", "additionalToSuperChancePercent", "chancePercent"] as const) {
                const chance = effect[field];
                if (chance !== undefined && (chance < 0 || chance > 100)) {
                    issues.push({ code: "chance-range", message: `${field} is outside 0..100.`, stateKey: state.stateKey, ruleId: rule.id });
                }
            }
            if (effect.activationChancePercent !== undefined
                && effect.chancePercent !== undefined
                && effect.activationChancePercent !== effect.chancePercent) {
                issues.push({ code: "chance-alias", message: `chancePercent must equal activationChancePercent when both are present.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            if (effect.additionalToSuperChancePercent !== undefined && effect.kind !== "additional_attack") {
                issues.push({ code: "additional-to-super-kind", message: `additionalToSuperChancePercent is valid only for additional_attack.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            validateProbabilityChannel(effect, "activation", state, rule, issues);
            validateProbabilityChannel(effect, "additional_to_super", state, rule, issues);
            if (effect.count !== undefined && (!Number.isInteger(effect.count) || effect.count <= 0)) {
                issues.push({ code: "effect-count", message: `Effect count must be a positive integer.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            if (effect.stackCap !== undefined && effect.stackCap < 0) {
                issues.push({ code: "effect-cap", message: `Effect cap cannot be negative.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            if (effect.duration?.kind === "turns" && (!Number.isInteger(effect.duration.turns) || (effect.duration.turns ?? 0) <= 0)) {
                issues.push({ code: "duration-range", message: `Turn duration must be a positive integer.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            if (effect.duration?.kind !== "turns" && effect.duration?.turns !== undefined) {
                issues.push({ code: "duration-turns-kind", message: `Only a turns duration may declare turns.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            if (effect.duration?.source !== undefined) {
                const durationSources: CalculationPhaseResolutionSource[] = [
                    "explicit_text", "first_party_game_db", "documented_domain_rule", "dokkan_fyi_structural_marker", "unresolved",
                ];
                if (!durationSources.includes(effect.duration.source)) {
                    issues.push({ code: "duration-source", message: `Passive duration source is not recognized.`, stateKey: state.stateKey, ruleId: rule.id });
                }
                if (effect.duration.provenance) {
                    validateDecisionProvenance(effect.duration.source, effect.duration.provenance, state, issues, rule);
                }
            }
            validateEffectLifecycle(effect.activationLimit, effect.applicationTrigger, state, issues, rule);
            if (effect.stacking) {
                const scopes: EffectStackingScope[] = ["current_turn", "active_windows", "battle", "unknown"];
                if (!scopes.includes(effect.stacking.scope ?? "unknown")
                    || effect.stacking.kind === "unknown" && effect.stacking.source !== "unresolved") {
                    issues.push({ code: "passive-stacking", message: `Passive stacking metadata is invalid.`, stateKey: state.stateKey, ruleId: rule.id });
                }
                if (effect.stacking.capPercent !== undefined && effect.stacking.capPercent !== effect.stackCap) {
                    issues.push({ code: "passive-stacking-cap", message: `Passive stacking cap must match the existing cap channel.`, stateKey: state.stateKey, ruleId: rule.id });
                }
            }
        }
    }
    validateSourceTokenCoverage(passive, rawLines, state, issues);
}

function conditionExpressionStatus(condition: ConditionExpression): ParseStatus {
    if (condition.op === "always") {
        return "supported";
    }
    if (condition.op === "unknown") {
        return "unknown";
    }
    if (condition.op === "predicate") {
        if (condition.predicate.kind === "unknown") {
            return "unknown";
        }
        return condition.predicate.enemySelection === "unknown"
            || condition.predicate.combatEvent?.countScope === "unknown"
            || condition.predicate.combatEvent?.relativeTiming === "unknown"
            ? "partial"
            : "supported";
    }
    if (condition.op === "not") {
        return conditionExpressionStatus(condition.child);
    }
    return aggregateStatuses(condition.children.map(conditionExpressionStatus));
}

function effectListStatus(effects: PassiveEffect[]): ParseStatus {
    return aggregateStatuses(effects.map(effect => {
        if (effect.kind === "unknown") {
            return "unknown";
        }
        if (effect.probabilitySource === "unresolved"
            || effect.additionalToSuperProbabilitySource === "unresolved") {
            return "partial";
        }
        return "supported";
    }));
}

function validateProbabilityChannel(
    effect: PassiveEffect,
    channel: "activation" | "additional_to_super",
    state: CharacterStateAnalysis,
    rule: PassiveRule,
    issues: TeamAnalysisValidationIssue[],
): void {
    const percent = channel === "activation"
        ? effect.activationChancePercent
        : effect.additionalToSuperChancePercent;
    const term = channel === "activation"
        ? effect.qualitativeChanceTerm
        : effect.additionalToSuperQualitativeChanceTerm;
    const source = channel === "activation"
        ? effect.probabilitySource
        : effect.additionalToSuperProbabilitySource;
    const prefix = channel === "activation" ? "probability" : "additional-to-super-probability";

    if ((percent !== undefined || term !== undefined) && source === undefined) {
        issues.push({ code: `${prefix}-source`, message: `Probability metadata requires a source.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (source === "unresolved" && percent !== undefined) {
        issues.push({ code: `${prefix}-unresolved-value`, message: `An unresolved probability cannot declare a numeric value.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (source !== undefined && source !== "unresolved" && percent === undefined) {
        issues.push({ code: `${prefix}-missing-value`, message: `A resolved probability must declare a numeric value.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if ((source === "first_party_game_db" || source === "qualitative_lexicon") && term === undefined) {
        issues.push({ code: `${prefix}-missing-term`, message: `Non-text numeric resolution requires a qualitative term.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (channel === "additional_to_super" && source !== undefined && effect.kind !== "additional_attack") {
        issues.push({ code: "additional-to-super-kind", message: `Additional-to-Super probability metadata is valid only for additional_attack.`, stateKey: state.stateKey, ruleId: rule.id });
    }
}

function aggregateStatuses(statuses: ParseStatus[]): ParseStatus {
    if (statuses.length === 0 || statuses.every(status => status === "unknown")) {
        return "unknown";
    }
    if (statuses.every(status => status === "supported")) {
        return "supported";
    }
    return "partial";
}

const ALLY_PREDICATE_KINDS = new Set<PassivePredicateKind>([
    "ally_category_present", "ally_name_present", "all_rotation_allies_category",
    "rotation_partner_category", "rotation_partner_name", "ally_class_present",
    "ally_type_present", "ally_class_type_present", "ally_category_class_present",
    "all_rotation_allies_class",
]);

const ENEMY_PREDICATE_KINDS = new Set<PassivePredicateKind>([
    "enemy_category", "enemy_name", "enemy_class", "enemy_type", "enemy_class_type",
    "enemy_hp_percent", "enemy_status",
]);

const ALLY_TARGET_SCOPES = new Set<PassiveTarget["scope"]>([
    "rotation_allies", "team_allies", "category_allies", "class_allies", "type_allies",
    "class_type_allies",
]);

function isAllyTarget(target: PassiveTarget): boolean {
    return ALLY_TARGET_SCOPES.has(target.scope);
}

function validateEffectContract(
    effect: PassiveEffect,
    state: CharacterStateAnalysis,
    rule: PassiveRule,
    issues: TeamAnalysisValidationIssue[],
): void {
    validateCalculationPhase(effect, state, rule, issues);
    const allyTarget = isAllyTarget(effect.target);
    if (allyTarget && effect.target.selfInclusion === undefined) {
        issues.push({ code: "target-self-inclusion", message: `Ally target must declare self inclusion.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (effect.target.scope === "category_allies" && (effect.categories?.length ?? 0) === 0) {
        issues.push({ code: "target-categories", message: `Category ally target must name affected categories.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (["class_allies", "class_type_allies"].includes(effect.target.scope) && (effect.classes?.length ?? 0) === 0) {
        issues.push({ code: "target-classes", message: `Class ally target must name an affected class.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (["type_allies", "class_type_allies"].includes(effect.target.scope) && (effect.types?.length ?? 0) === 0) {
        issues.push({ code: "target-types", message: `Type ally target must name an affected type.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    validateClassAndTypeValues(effect.classes, effect.types, state, rule, issues);
    if ((effect.kind as string) === "support") {
        issues.push({ code: "standalone-support", message: `Support must be a derived classification, not an isolated effect.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    const isDerivedSupport = effect.classifications?.includes("support") === true;
    if (isDerivedSupport && (!allyTarget || !BENEFICIAL_EFFECT_KINDS.has(effect.kind))) {
        issues.push({ code: "invalid-support-classification", message: `Support classification requires a beneficial typed ally effect.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (allyTarget && BENEFICIAL_EFFECT_KINDS.has(effect.kind) && !isDerivedSupport) {
        issues.push({ code: "missing-support-classification", message: `Beneficial typed ally effect must carry derived support classification.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (effect.scaling) {
        if (effect.scaling.kind === "per_ki_sphere") {
            if (effect.scaling.kiContext !== "collected_ki_spheres") {
                issues.push({ code: "effect-scaling-context", message: `Ki Sphere scaling must use collected_ki_spheres context.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            if (!Number.isInteger(effect.scaling.spheresPerIncrement) || effect.scaling.spheresPerIncrement < 1) {
                issues.push({ code: "effect-scaling-unit", message: `Ki Sphere scaling units must be positive integers.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            validateKiSphereTypes(effect.scaling.kiSphereTypes, "effect-scaling-sphere-types", state, rule, issues);
        } else if (effect.scaling.kind === "per_combat_event") {
            if (!["single", "and", "or"].includes(effect.scaling.connector)) {
                issues.push({ code: "combat-scaling-connector", message: `Combat-event scaling connector is not recognized.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            if (!Number.isInteger(effect.scaling.eventsPerIncrement) || effect.scaling.eventsPerIncrement < 1) {
                issues.push({ code: "combat-scaling-unit", message: `Combat-event scaling units must be positive integers.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            if (effect.scaling.events.length === 0) {
                issues.push({ code: "combat-scaling-events", message: `Combat-event scaling requires at least one event.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            if ((effect.scaling.connector === "single") !== (effect.scaling.events.length === 1)) {
                issues.push({ code: "combat-scaling-arity", message: `Single scaling requires one event; logical scaling requires multiple events.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            effect.scaling.events.forEach(event => validateCombatEventDescriptor(event, state, rule, issues, true));
        } else {
            issues.push({ code: "effect-scaling-kind", message: `Effect scaling kind is not recognized.`, stateKey: state.stateKey, ruleId: rule.id });
            const external = effect.scaling as unknown as Partial<KiSphereEffectScaling>;
            if (external.kiContext !== "collected_ki_spheres") {
                issues.push({ code: "effect-scaling-context", message: `Ki Sphere scaling must use collected_ki_spheres context.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            if (!Number.isInteger(external.spheresPerIncrement) || (external.spheresPerIncrement ?? 0) < 1) {
                issues.push({ code: "effect-scaling-unit", message: `Ki Sphere scaling units must be positive integers.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            validateKiSphereTypes(external.kiSphereTypes, "effect-scaling-sphere-types", state, rule, issues);
        }
        if (effect.kind === "unknown" || effect.kind === "ki_sphere_change") {
            issues.push({ code: "effect-scaling-effect-kind", message: `Effect scaling requires a scalable typed effect.`, stateKey: state.stateKey, ruleId: rule.id });
        }
    }
    if (effect.kind === "ki_sphere_change" && !effect.kiSphereChange) {
        issues.push({ code: "ki-sphere-change-fields", message: `Ki Sphere change effects require structured conversion fields.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (effect.kind !== "ki_sphere_change" && effect.kiSphereChange) {
        issues.push({ code: "ki-sphere-change-kind", message: `Ki Sphere conversion fields are valid only on ki_sphere_change effects.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (effect.kiSphereChange) {
        validateKiSphereChange(effect.kiSphereChange, effect, state, rule, issues);
    }
}

function validateCalculationPhase(
    effect: PassiveEffect,
    state: CharacterStateAnalysis,
    rule: PassiveRule,
    issues: TeamAnalysisValidationIssue[],
): void {
    const activationMoments: PassiveActivationMoment[] = [
        "start_of_turn", "before_attacking", "when_attacking",
        "when_performing_super_attack", "before_incoming_attack", "when_targeted_by_attack",
        "when_attack_landed", "after_incoming_attack_resolved", "after_attacking",
        "after_attack_landed", "when_evading", "after_evading",
        "after_final_blow", "unresolved",
    ];
    const buckets: PassiveCalculationBucket[] = [
        "passive_start_of_turn", "passive_on_attack", "unresolved",
    ];
    const sources: CalculationPhaseResolutionSource[] = [
        "explicit_text", "first_party_game_db", "documented_domain_rule", "unresolved",
    ];

    if (effect.kind === "unknown") {
        if (effect.activationTiming || effect.calculationBucket) {
            issues.push({ code: "unknown-effect-calculation-phase", message: `Unknown effects cannot carry calculation-phase claims.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        return;
    }
    if (!effect.activationTiming) {
        issues.push({ code: "activation-timing-required", message: `Typed effects must preserve a resolved or unresolved activation timing.`, stateKey: state.stateKey, ruleId: rule.id });
    } else {
        if (!activationMoments.includes(effect.activationTiming.moment)) {
            issues.push({ code: "activation-moment", message: `Activation moment is not recognized.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (!sources.includes(effect.activationTiming.source)) {
            issues.push({ code: "activation-source", message: `Activation timing source is not recognized.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if ((effect.activationTiming.moment === "unresolved") !== (effect.activationTiming.source === "unresolved")) {
            issues.push({ code: "activation-resolution", message: `Unresolved activation moment and source must be paired.`, stateKey: state.stateKey, ruleId: rule.id });
        }
    }

    const bucketEligible = CALCULATION_BUCKET_EFFECT_KINDS.has(effect.kind);
    if (bucketEligible && !effect.calculationBucket) {
        issues.push({ code: "calculation-bucket-required", message: `ATK and DEF effects must preserve a resolved or unresolved passive calculation bucket.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (!bucketEligible && effect.calculationBucket) {
        issues.push({ code: "calculation-bucket-effect-kind", message: `Passive calculation buckets currently apply only to typed ATK and DEF effects.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (effect.calculationBucket) {
        if (!buckets.includes(effect.calculationBucket.bucket)) {
            issues.push({ code: "calculation-bucket", message: `Passive calculation bucket is not recognized.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (!sources.includes(effect.calculationBucket.source)) {
            issues.push({ code: "calculation-bucket-source", message: `Calculation bucket source is not recognized.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if ((effect.calculationBucket.bucket === "unresolved") !== (effect.calculationBucket.source === "unresolved")) {
            issues.push({ code: "calculation-bucket-resolution", message: `Unresolved calculation bucket and source must be paired.`, stateKey: state.stateKey, ruleId: rule.id });
        }
    }
}

function validateKiSphereChange(
    change: KiSphereChange,
    effect: PassiveEffect,
    state: CharacterStateAnalysis,
    rule: PassiveRule,
    issues: TeamAnalysisValidationIssue[],
): void {
    const selections: KiSphereChange["sourceSelection"][] = ["listed_types", "all", "random_type"];
    if (!selections.includes(change.sourceSelection)) {
        issues.push({ code: "ki-sphere-change-source-selection", message: `Ki Sphere conversion source selection is not recognized.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (change.kiContext !== "board_state") {
        issues.push({ code: "ki-sphere-change-context", message: `Ki Sphere conversion must use board_state context.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (![...TEAM_ANALYSIS_TYPES, "rainbow"].includes(change.destinationType as TeamAnalysisType | "rainbow")) {
        issues.push({ code: "ki-sphere-change-destination", message: `Ki Sphere conversion destination must be a concrete color or rainbow.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (change.sourceSelection === "listed_types") {
        validateKiSphereTypes(change.sourceTypes, "ki-sphere-change-source-types", state, rule, issues);
        if (((change.sourceTypes as unknown as string[] | undefined) ?? [])
            .some(type => type === "any" || type === "non_rainbow")) {
            issues.push({ code: "ki-sphere-change-concrete-source", message: `Listed conversion sources must be concrete colors or rainbow.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (change.excludedSourceTypes !== undefined) {
            issues.push({ code: "ki-sphere-change-listed-exclusions", message: `Listed conversion sources cannot also declare exclusions.`, stateKey: state.stateKey, ruleId: rule.id });
        }
    } else if (change.sourceTypes !== undefined) {
        issues.push({ code: "ki-sphere-change-source-kind", message: `Only listed conversion sources may declare sourceTypes.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (change.sourceSelection !== "random_type" && change.excludedSourceTypes !== undefined) {
        issues.push({ code: "ki-sphere-change-exclusion-kind", message: `Only random Type conversion may declare exclusions.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if ((change.excludedSourceTypes ?? []).some(type => !TEAM_ANALYSIS_TYPES.includes(type))) {
        issues.push({ code: "ki-sphere-change-exclusions", message: `Conversion exclusions must be concrete Type colors.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (effect.target.scope !== "self") {
        issues.push({ code: "ki-sphere-change-target", message: `Ki Sphere board conversion must use the self effect channel.`, stateKey: state.stateKey, ruleId: rule.id });
    }
}

function validateSourceTokenCoverage(
    passive: ParsedPassive,
    rawLines: string[],
    state: CharacterStateAnalysis,
    issues: TeamAnalysisValidationIssue[],
): void {
    const fragments = uniqueOrderedFragments([
        ...passive.rules.flatMap(rule => rule.source),
        ...passive.unparsedFragments,
    ]);
    const covered = rawLines.map(line => Array.from({ length: line.length }, () => false));
    for (const fragment of fragments) {
        const start = fragment.start ?? rawLines[fragment.lineIndex]?.indexOf(fragment.text) ?? -1;
        const end = fragment.end ?? (start >= 0 ? start + fragment.text.length : -1);
        if (start < 0 || end < start || !covered[fragment.lineIndex]) {
            continue;
        }
        for (let index = start; index < end; index += 1) {
            covered[fragment.lineIndex][index] = true;
        }
    }
    for (let lineIndex = 0; lineIndex < rawLines.length; lineIndex += 1) {
        for (let column = 0; column < rawLines[lineIndex].length; column += 1) {
            if (!/\s/.test(rawLines[lineIndex][column]) && !covered[lineIndex][column]) {
                issues.push({
                    code: "source-token-loss",
                    message: `Source token at line ${lineIndex}, column ${column} is not referenced.`,
                    stateKey: state.stateKey,
                });
                return;
            }
        }
    }
}

function validateFragmentList(
    fragments: SourceFragment[],
    rawLines: string[],
    state: CharacterStateAnalysis,
    rule: PassiveRule | undefined,
    issues: TeamAnalysisValidationIssue[],
): void {
    for (let index = 0; index < fragments.length; index += 1) {
        const fragment = fragments[index];
        if (index > 0 && compareFragments(fragments[index - 1], fragment) > 0) {
            issues.push({ code: "fragment-order", message: `Source fragments are not ordered.`, stateKey: state.stateKey, ruleId: rule?.id });
        }
        const line = rawLines[fragment.lineIndex];
        if (line === undefined) {
            issues.push({ code: "fragment-line", message: `Fragment line ${fragment.lineIndex} is outside raw text.`, stateKey: state.stateKey, ruleId: rule?.id });
            continue;
        }
        if (fragment.start !== undefined || fragment.end !== undefined) {
            if (fragment.start === undefined || fragment.end === undefined || fragment.start < 0 || fragment.end < fragment.start) {
                issues.push({ code: "fragment-range", message: `Fragment has an invalid range.`, stateKey: state.stateKey, ruleId: rule?.id });
            } else if (line.slice(fragment.start, fragment.end) !== fragment.text) {
                issues.push({ code: "fragment-text", message: `Fragment does not point to original raw text.`, stateKey: state.stateKey, ruleId: rule?.id });
            }
        } else if (!line.includes(fragment.text)) {
            issues.push({ code: "fragment-text", message: `Fragment text is absent from its raw line.`, stateKey: state.stateKey, ruleId: rule?.id });
        }
    }
}

function validateCondition(
    condition: ConditionExpression,
    depth: number,
    state: CharacterStateAnalysis,
    rule: PassiveRule,
    issues: TeamAnalysisValidationIssue[],
): void {
    if (depth === 1) {
        validateEnemyReferenceBindings(condition, state, rule, issues);
    }
    if (depth > 16) {
        issues.push({ code: "ast-depth", message: `Condition AST exceeds depth 16.`, stateKey: state.stateKey, ruleId: rule.id });
        return;
    }
    if (condition.op === "all" || condition.op === "any") {
        if (condition.children.length === 0) {
            issues.push({ code: "empty-ast", message: `${condition.op} condition has no children.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        condition.children.forEach(child => validateCondition(child, depth + 1, state, rule, issues));
        if (condition.op === "all") {
            validateScenarioWindow(condition.children, state, rule, issues);
        }
    } else if (condition.op === "not") {
        validateCondition(condition.child, depth + 1, state, rule, issues);
    } else if (condition.op === "predicate") {
        validateFiniteNumbers(condition.predicate, state, rule, issues);
        if (ALLY_PREDICATE_KINDS.has(condition.predicate.kind) && condition.predicate.selfInclusion === undefined) {
            issues.push({ code: "condition-self-inclusion", message: `Ally condition must declare self inclusion.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (condition.predicate.count !== undefined
            && (!Number.isInteger(condition.predicate.count) || condition.predicate.count <= 0)) {
            issues.push({ code: "condition-count", message: `Ally count must be a positive integer.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (["ally_category_present", "ally_category_class_present", "all_rotation_allies_category", "rotation_partner_category", "enemy_category"].includes(condition.predicate.kind)
            && (condition.predicate.categories?.length ?? 0) === 0) {
            issues.push({ code: "condition-categories", message: `Category condition must name at least one category.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (["ally_name_present", "rotation_partner_name", "enemy_name"].includes(condition.predicate.kind)
            && (condition.predicate.names?.length ?? 0) === 0) {
            issues.push({ code: "condition-names", message: `Name condition must name at least one character.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (["ally_class_present", "ally_class_type_present", "ally_category_class_present", "all_rotation_allies_class", "character_class", "enemy_class", "enemy_class_type"].includes(condition.predicate.kind)
            && (condition.predicate.classes?.length ?? 0) === 0) {
            issues.push({ code: "condition-classes", message: `Class condition must name at least one class.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (["ally_type_present", "ally_class_type_present", "character_type", "enemy_type", "enemy_class_type"].includes(condition.predicate.kind)
            && (condition.predicate.types?.length ?? 0) === 0) {
            issues.push({ code: "condition-types", message: `Type condition must name at least one type.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        validateEnemyPredicate(condition.predicate, state, rule, issues);
        validateKiPredicate(condition.predicate, state, rule, issues);
        validateCombatEventPredicate(condition.predicate, state, rule, issues);
        validateClassAndTypeValues(condition.predicate.classes, condition.predicate.types, state, rule, issues);
        validateScenarioPredicate(condition.predicate, state, rule, issues);
        if (condition.predicate.kind === "battle_slot" && condition.predicate.scope !== "self") {
            issues.push({ code: "slot-scope", message: `Battle slot must describe the current character.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (condition.predicate.kind === "battle_slot" && (condition.predicate.slots?.length ?? 0) === 0) {
            issues.push({ code: "slot-values", message: `Battle slot must name at least one position.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        for (const slot of condition.predicate.slots ?? []) {
            if (!Number.isInteger(slot) || slot < 1 || slot > 3) {
                issues.push({ code: "slot-range", message: `Battle slot must be 1, 2, or 3.`, stateKey: state.stateKey, ruleId: rule.id });
            }
        }
    }
}

function validateEnemyPredicate(
    predicate: PassivePredicate,
    state: CharacterStateAnalysis,
    rule: PassiveRule,
    issues: TeamAnalysisValidationIssue[],
): void {
    const enemySelections: EnemySelection[] = [
        "any_enemy", "all_enemies", "current_target", "only_enemy", "unknown",
    ];
    const enemyStatuses: EnemyStatus[] = ["atk_down", "def_down", "stunned", "super_attack_sealed"];
    const nameMatches: EnemyNameMatch[] = ["exact", "includes"];
    const isEnemyPredicate = ENEMY_PREDICATE_KINDS.has(predicate.kind);

    if (isEnemyPredicate && predicate.scope !== "enemy") {
        issues.push({ code: "enemy-scope", message: `Enemy attribute predicates must use enemy scope.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (isEnemyPredicate && predicate.enemySelection === undefined) {
        issues.push({ code: "enemy-selection", message: `Enemy attribute predicates must declare enemy selection.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (predicate.enemySelection !== undefined && !enemySelections.includes(predicate.enemySelection)) {
        issues.push({ code: "enemy-selection-value", message: `Enemy selection is not recognized.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (!isEnemyPredicate && predicate.enemySelection !== undefined) {
        issues.push({ code: "enemy-selection-kind", message: `Enemy selection is valid only on enemy attribute predicates.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (predicate.enemyReference !== undefined && predicate.enemyReference !== "that_enemy") {
        issues.push({ code: "enemy-reference-value", message: `Enemy reference is not recognized.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (predicate.enemyReference !== undefined && !isEnemyPredicate) {
        issues.push({ code: "enemy-reference-kind", message: `Enemy references are valid only on enemy attribute predicates.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (predicate.enemyReference === "that_enemy"
        && predicate.enemySelection !== "unknown"
        && predicate.enemySelection !== "only_enemy") {
        issues.push({ code: "enemy-reference-selection", message: `That-enemy references must be unresolved or bound to the only enemy.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (predicate.kind === "enemy_status"
        && ((predicate.enemyStatuses?.length ?? 0) === 0
            || (predicate.enemyStatuses ?? []).some(status => !enemyStatuses.includes(status)))) {
        issues.push({ code: "enemy-status-value", message: `Enemy status must use a recognized non-empty value.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (predicate.kind === "enemy_name") {
        if (predicate.nameMatch === undefined || !nameMatches.includes(predicate.nameMatch)) {
            issues.push({ code: "enemy-name-match", message: `Enemy name predicates require a recognized match mode.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if ((predicate.excludedNames?.length ?? 0) > 0
            && (predicate.excludedNameMatch === undefined || !nameMatches.includes(predicate.excludedNameMatch))) {
            issues.push({ code: "enemy-excluded-name-match", message: `Excluded enemy names require a recognized match mode.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (predicate.excludedNameMatch !== undefined && (predicate.excludedNames?.length ?? 0) === 0) {
            issues.push({ code: "enemy-excluded-names", message: `Excluded enemy name match mode requires excluded names.`, stateKey: state.stateKey, ruleId: rule.id });
        }
    }
}

function validateKiPredicate(
    predicate: PassivePredicate,
    state: CharacterStateAnalysis,
    rule: PassiveRule,
    issues: TeamAnalysisValidationIssue[],
): void {
    const kiKinds: PassivePredicateKind[] = ["ki_amount", "ki_spheres_obtained", "ki_sphere_type_obtained"];
    const isKiPredicate = kiKinds.includes(predicate.kind);
    const comparatorAllowed = ["lt", "lte", "eq", "gte", "gt"].includes(predicate.comparator ?? "");
    if (isKiPredicate && predicate.scope !== "self") {
        issues.push({ code: "ki-scope", message: `Ki runtime predicates must describe the current character.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (isKiPredicate && !comparatorAllowed) {
        issues.push({ code: "ki-comparator", message: `Ki runtime predicates require an explicit scalar comparator.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (isKiPredicate && predicate.value === undefined) {
        issues.push({ code: "ki-value", message: `Ki runtime predicates require a scalar value.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (predicate.kind === "ki_amount") {
        if (predicate.value !== undefined && !isKiAmount(predicate.value)) {
            issues.push({ code: "ki-amount-range", message: `Attack Ki must be an integer within 0..24.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (predicate.kiContext !== "final_attack_ki") {
            issues.push({ code: "ki-amount-context", message: `Attack Ki must use final_attack_ki context.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (predicate.evaluationMoment !== "when_attacking" && predicate.evaluationMoment !== "before_attack") {
            issues.push({ code: "ki-amount-moment", message: `Attack Ki requires an explicit attack evaluation moment.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (predicate.kiSphereTypes !== undefined) {
            issues.push({ code: "ki-amount-sphere-types", message: `Attack Ki cannot declare Ki Sphere types.`, stateKey: state.stateKey, ruleId: rule.id });
        }
    }
    if (predicate.kind === "ki_spheres_obtained" || predicate.kind === "ki_sphere_type_obtained") {
        if (predicate.value !== undefined && !isKiSphereCount(predicate.value)) {
            issues.push({ code: "ki-sphere-count-range", message: `Ki Sphere counts must be non-negative integers.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (predicate.kiContext !== "collected_ki_spheres") {
            issues.push({ code: "ki-sphere-context", message: `Obtained Ki Sphere predicates must use collected_ki_spheres context.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        validateKiSphereTypes(predicate.kiSphereTypes, "ki-sphere-types", state, rule, issues);
        if (predicate.kind === "ki_sphere_type_obtained"
            && (predicate.comparator !== "gte" || predicate.value !== 1)) {
            issues.push({ code: "ki-sphere-presence", message: `Ki Sphere type presence must mean at least one obtained sphere.`, stateKey: state.stateKey, ruleId: rule.id });
        }
    }
    if (!isKiPredicate && (predicate.kiContext !== undefined || predicate.kiSphereTypes !== undefined)) {
        issues.push({ code: "ki-fields-kind", message: `Ki context and Ki Sphere types are valid only on Ki predicates.`, stateKey: state.stateKey, ruleId: rule.id });
    }
}

const COMBAT_EVENT_PREDICATE_KINDS = new Set<PassivePredicateKind>([
    "incoming_attack", "incoming_super_attack", "attacks_performed", "attacks_received",
    "attacks_evaded", "super_attacks_performed", "super_attack_received", "final_blow_delivered",
]);

function validateCombatEventPredicate(
    predicate: PassivePredicate,
    state: CharacterStateAnalysis,
    rule: PassiveRule,
    issues: TeamAnalysisValidationIssue[],
): void {
    const isCombatPredicate = COMBAT_EVENT_PREDICATE_KINDS.has(predicate.kind);
    if (isCombatPredicate && !predicate.combatEvent) {
        issues.push({ code: "combat-event-required", message: `Combat-event predicates require a structured event descriptor.`, stateKey: state.stateKey, ruleId: rule.id });
        return;
    }
    if (!isCombatPredicate && predicate.combatEvent) {
        issues.push({ code: "combat-event-kind", message: `Combat-event descriptors are valid only on combat-event predicates.`, stateKey: state.stateKey, ruleId: rule.id });
        return;
    }
    if (!predicate.combatEvent) {
        return;
    }
    if (predicate.scope !== "self") {
        issues.push({ code: "combat-event-scope", message: `Combat-event predicates describe the current character and must use self scope.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    validateCombatEventDescriptor(predicate.combatEvent, state, rule, issues, false);
    const expectedKind: Partial<Record<CombatEventType, PassivePredicateKind[]>> = {
        attack_performed: predicate.combatEvent.attackKind === "super_attack" ? ["super_attacks_performed"] : ["attacks_performed"],
        incoming_attack: predicate.combatEvent.attackKind === "super_attack" ? ["incoming_super_attack"] : ["incoming_attack"],
        attack_landed: predicate.combatEvent.attackKind === "super_attack" ? ["super_attack_received"] : ["attacks_received"],
        attack_evaded: ["attacks_evaded"],
        final_blow_delivered: ["final_blow_delivered"],
    };
    if (!(expectedKind[predicate.combatEvent.eventType] ?? []).includes(predicate.kind)) {
        issues.push({ code: "combat-event-predicate-kind", message: `Combat-event descriptor does not match its predicate kind.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (predicate.combatEvent.mode === "accumulated_count") {
        if (!(["lt", "lte", "eq", "gte", "gt"] as Array<PassivePredicate["comparator"]>).includes(predicate.comparator)) {
            issues.push({ code: "combat-event-comparator", message: `Accumulated combat-event conditions require an explicit scalar comparator.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (predicate.value === undefined || !Number.isInteger(predicate.value) || predicate.value < 0) {
            issues.push({ code: "combat-event-count", message: `Accumulated combat-event conditions require a non-negative integer count.`, stateKey: state.stateKey, ruleId: rule.id });
        }
    } else if (predicate.comparator !== undefined || predicate.value !== undefined) {
        issues.push({ code: "combat-current-event-count", message: `Current combat events cannot carry an accumulated comparator or count.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (predicate.combatEvent.mode === "per_event") {
        issues.push({ code: "combat-predicate-per-event", message: `Per-event repetition belongs to effect scaling, not a condition predicate.`, stateKey: state.stateKey, ruleId: rule.id });
    }
}

function validateCombatEventDescriptor(
    event: CombatEventDescriptor,
    state: CharacterStateAnalysis,
    rule: PassiveRule,
    issues: TeamAnalysisValidationIssue[],
    scaling: boolean,
): void {
    const eventTypes: CombatEventType[] = ["attack_performed", "incoming_attack", "attack_landed", "attack_evaded", "final_blow_delivered"];
    const actors: CombatEventActor[] = ["self", "enemy"];
    const attackKinds: CombatAttackKind[] = ["normal_attack", "super_attack", "unknown"];
    const attackStyles: CombatAttackStyle[] = ["ki_blast", "unarmed", "physical", "unknown"];
    const modes: CombatEventMode[] = ["current_event", "accumulated_count", "per_event"];
    const countScopes: CombatEventCountScope[] = ["current_turn", "battle", "unknown"];
    const relativeTimings: CombatEventRelativeTiming[] = ["before_event", "during_event", "after_event", "unknown"];
    const sources: CalculationPhaseResolutionSource[] = ["explicit_text", "first_party_game_db", "documented_domain_rule", "unresolved"];
    if (!eventTypes.includes(event.eventType)) issues.push({ code: "combat-event-type", message: `Combat event type is not recognized.`, stateKey: state.stateKey, ruleId: rule.id });
    if (!actors.includes(event.actor)) issues.push({ code: "combat-event-actor", message: `Combat event actor is not recognized.`, stateKey: state.stateKey, ruleId: rule.id });
    if (!attackKinds.includes(event.attackKind)) issues.push({ code: "combat-attack-kind", message: `Combat attack kind is not recognized.`, stateKey: state.stateKey, ruleId: rule.id });
    if (event.attackStyle !== undefined && !attackStyles.includes(event.attackStyle)) issues.push({ code: "combat-attack-style", message: `Combat attack style is not recognized.`, stateKey: state.stateKey, ruleId: rule.id });
    if (!modes.includes(event.mode)) issues.push({ code: "combat-event-mode", message: `Combat event mode is not recognized.`, stateKey: state.stateKey, ruleId: rule.id });
    if (event.countScope !== undefined && !countScopes.includes(event.countScope)) issues.push({ code: "combat-count-scope", message: `Combat count scope is not recognized.`, stateKey: state.stateKey, ruleId: rule.id });
    if (!relativeTimings.includes(event.relativeTiming)) issues.push({ code: "combat-relative-timing", message: `Combat relative timing is not recognized.`, stateKey: state.stateKey, ruleId: rule.id });
    if (scaling ? event.mode !== "per_event" : event.mode === "per_event") {
        issues.push({ code: "combat-event-mode-channel", message: `Combat event mode does not match its condition or scaling channel.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (event.mode === "current_event" && event.countScope !== undefined) {
        issues.push({ code: "combat-current-count-scope", message: `A current combat event cannot declare a counter scope.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (event.mode !== "current_event" && event.countScope === undefined) {
        issues.push({ code: "combat-history-count-scope", message: `Historical and per-event combat data require an explicit or unknown count scope.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (event.eventType === "incoming_attack" && event.mode !== "current_event") {
        issues.push({ code: "combat-targeting-history", message: `Incoming targeting is a pre-resolution current event and cannot increment hit history or effect scaling.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (event.eventType === "incoming_attack" && event.relativeTiming === "after_event") {
        issues.push({ code: "combat-targeting-timing", message: `Incoming targeting cannot prove a post-resolution outcome.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if ((event.eventType === "attack_landed" || event.eventType === "attack_evaded")
        && event.relativeTiming === "before_event") {
        issues.push({ code: "combat-outcome-timing", message: `A hit or evade outcome cannot be confirmed before resolution.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (event.attackStyle !== undefined && event.attackKind !== "super_attack") {
        issues.push({ code: "combat-style-kind", message: `Attack style is valid only for Super Attacks.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (event.eventType === "final_blow_delivered" && (event.actor !== "self" || event.attackKind !== "unknown")) {
        issues.push({ code: "combat-final-blow-shape", message: `Final-blow events must be self-authored without an invented attack kind.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (event.eventType === "attack_performed" && event.actor !== "self") {
        issues.push({ code: "combat-performed-actor", message: `Performed attacks must use self as actor.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if ((event.eventType === "incoming_attack" || event.eventType === "attack_landed" || event.eventType === "attack_evaded") && event.actor !== "enemy") {
        issues.push({ code: "combat-incoming-actor", message: `Targeted, landed, or evaded attacks must use enemy as actor.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    const provenanceEntries: Array<[string, CalculationPhaseResolutionSource | undefined]> = [
        ["eventType", event.provenance?.eventType], ["actor", event.provenance?.actor],
        ["attackKind", event.provenance?.attackKind], ["mode", event.provenance?.mode],
        ["relativeTiming", event.provenance?.relativeTiming],
        ...(event.attackStyle !== undefined ? [["attackStyle", event.provenance?.attackStyle] as [string, CalculationPhaseResolutionSource | undefined]] : []),
        ...(event.countScope !== undefined ? [["countScope", event.provenance?.countScope] as [string, CalculationPhaseResolutionSource | undefined]] : []),
    ];
    for (const [field, source] of provenanceEntries) {
        if (!source || !sources.includes(source)) {
            issues.push({ code: "combat-provenance", message: `Combat ${field} requires recognized provenance.`, stateKey: state.stateKey, ruleId: rule.id });
        }
    }
    if ((event.attackKind === "unknown") !== (event.provenance.attackKind === "unresolved")) {
        issues.push({ code: "combat-attack-kind-resolution", message: `Unknown attack kind and unresolved provenance must be paired.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (event.attackStyle !== undefined && ((event.attackStyle === "unknown") !== (event.provenance.attackStyle === "unresolved"))) {
        issues.push({ code: "combat-attack-style-resolution", message: `Unknown attack style and unresolved provenance must be paired.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (event.countScope !== undefined && ((event.countScope === "unknown") !== (event.provenance.countScope === "unresolved"))) {
        issues.push({ code: "combat-count-scope-resolution", message: `Unknown count scope and unresolved provenance must be paired.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if ((event.relativeTiming === "unknown") !== (event.provenance.relativeTiming === "unresolved")) {
        issues.push({ code: "combat-relative-timing-resolution", message: `Unknown relative timing and unresolved provenance must be paired.`, stateKey: state.stateKey, ruleId: rule.id });
    }
}

function validateEnemyReferenceBindings(
    condition: ConditionExpression,
    state: CharacterStateAnalysis,
    rule: PassiveRule,
    issues: TeamAnalysisValidationIssue[],
): void {
    if (condition.op === "not") {
        rejectBoundEnemyReferences(condition.child, state, rule, issues);
        return;
    }
    if (condition.op === "any") {
        condition.children.forEach(child => validateEnemyReferenceBindings(child, state, rule, issues));
        return;
    }
    if (condition.op === "all") {
        validateEnemyReferencesInConjunction(
            condition,
            conjunctiveComponentProvesSingleEnemy(condition),
            state,
            rule,
            issues,
        );
        return;
    }
    rejectBoundEnemyReferences(condition, state, rule, issues);
}

function validateEnemyReferencesInConjunction(
    condition: ConditionExpression,
    provesSingleEnemy: boolean,
    state: CharacterStateAnalysis,
    rule: PassiveRule,
    issues: TeamAnalysisValidationIssue[],
): void {
    if (condition.op === "predicate") {
        if (condition.predicate.enemyReference === "that_enemy"
            && condition.predicate.enemySelection === "only_enemy"
            && !provesSingleEnemy) {
            enemyReferenceBindingIssue(state, rule, issues);
        }
        return;
    }
    if (condition.op === "all") {
        condition.children.forEach(child => {
            if (child.op === "all" || child.op === "predicate") {
                validateEnemyReferencesInConjunction(child, provesSingleEnemy, state, rule, issues);
            } else {
                validateEnemyReferenceBindings(child, state, rule, issues);
            }
        });
    }
}

function rejectBoundEnemyReferences(
    condition: ConditionExpression,
    state: CharacterStateAnalysis,
    rule: PassiveRule,
    issues: TeamAnalysisValidationIssue[],
): void {
    if (condition.op === "predicate") {
        if (condition.predicate.enemyReference === "that_enemy"
            && condition.predicate.enemySelection === "only_enemy") {
            enemyReferenceBindingIssue(state, rule, issues);
        }
        return;
    }
    if (condition.op === "not") {
        rejectBoundEnemyReferences(condition.child, state, rule, issues);
    } else if (condition.op === "all" || condition.op === "any") {
        condition.children.forEach(child => rejectBoundEnemyReferences(child, state, rule, issues));
    }
}

function enemyReferenceBindingIssue(
    state: CharacterStateAnalysis,
    rule: PassiveRule,
    issues: TeamAnalysisValidationIssue[],
): void {
    issues.push({
        code: "enemy-reference-binding",
        message: `That-enemy reference is bound without an enemy_count eq 1 proof in the same conjunctive branch.`,
        stateKey: state.stateKey,
        ruleId: rule.id,
    });
}

function validateScenarioPredicate(
    predicate: PassivePredicate,
    state: CharacterStateAnalysis,
    rule: PassiveRule,
    issues: TeamAnalysisValidationIssue[],
): void {
    const scalarScenarioKinds: PassivePredicateKind[] = [
        "hp_percent", "battle_turn", "turn_from_entry", "enemy_count", "enemy_hp_percent",
    ];
    const isScalarScenario = scalarScenarioKinds.includes(predicate.kind);
    const isScenario = SCENARIO_PREDICATES.has(predicate.kind);
    const comparatorAllowed = ["lt", "lte", "eq", "gte", "gt"].includes(predicate.comparator ?? "");
    if (isScalarScenario && !comparatorAllowed) {
        issues.push({ code: "scenario-comparator", message: `HP and turn predicates require an explicit scalar comparator.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (isScalarScenario && predicate.value === undefined) {
        issues.push({ code: "scenario-value", message: `HP and turn predicates require a scalar value.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (isScalarScenario && predicate.maxValue !== undefined) {
        issues.push({ code: "scenario-max-value", message: `Scenario intervals must use an all AST of scalar bounds.`, stateKey: state.stateKey, ruleId: rule.id });
    }

    if (predicate.kind === "hp_percent") {
        if (predicate.scope !== "team") {
            issues.push({ code: "hp-scope", message: `HP is shared team HP and must use team scope.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (predicate.value !== undefined && (!Number.isFinite(predicate.value) || predicate.value < 0 || predicate.value > 100)) {
            issues.push({ code: "hp-range", message: `HP percent must be within 0..100.`, stateKey: state.stateKey, ruleId: rule.id });
        }
    }
    if (predicate.kind === "enemy_hp_percent"
        && predicate.value !== undefined
        && (!Number.isFinite(predicate.value) || predicate.value < 0 || predicate.value > 100)) {
        issues.push({ code: "enemy-hp-range", message: `Enemy HP percent must be within 0..100.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (predicate.kind === "enemy_count") {
        if (predicate.scope !== "battle") {
            issues.push({ code: "enemy-count-scope", message: `Enemy count must use battle scope.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (predicate.value !== undefined && !isEnemyCount(predicate.value)) {
            issues.push({ code: "enemy-count-range", message: `Enemy count must be a non-negative integer.`, stateKey: state.stateKey, ruleId: rule.id });
        }
    }
    if (predicate.kind === "battle_turn" && predicate.scope !== "battle") {
        issues.push({ code: "battle-turn-scope", message: `Battle turn must use battle scope.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (predicate.kind === "turn_from_entry" && predicate.scope !== "self") {
        issues.push({ code: "entry-turn-scope", message: `Turn from entry must use self scope.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (["battle_turn", "turn_from_entry"].includes(predicate.kind)
        && predicate.value !== undefined
        && (!Number.isInteger(predicate.value) || predicate.value < 1)) {
        issues.push({ code: "turn-index", message: `Turn indexes are 1-based positive integers.`, stateKey: state.stateKey, ruleId: rule.id });
    }

    const knownMoments: PassiveEvaluationMoment[] = [
        "start_of_turn", "entry_turn", "end_of_turn", "before_attack", "when_attacking",
    ];
    if (predicate.evaluationMoment !== undefined && !knownMoments.includes(predicate.evaluationMoment)) {
        issues.push({ code: "evaluation-moment", message: `Evaluation moment is not recognized.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (predicate.evaluationMoment !== undefined && !isScenario && predicate.kind !== "ki_amount") {
        issues.push({ code: "evaluation-moment-kind", message: `Evaluation moment is valid only on scenario or attack-Ki predicates.`, stateKey: state.stateKey, ruleId: rule.id });
    }
}

function validateScenarioWindow(
    children: ConditionExpression[],
    state: CharacterStateAnalysis,
    rule: PassiveRule,
    issues: TeamAnalysisValidationIssue[],
): void {
    for (const kind of ["hp_percent", "enemy_hp_percent", "battle_turn", "turn_from_entry"] as const) {
        const predicates = children
            .filter((child): child is Extract<ConditionExpression, { op: "predicate" }> => child.op === "predicate")
            .map(child => child.predicate)
            .filter(predicate => predicate.kind === kind && predicate.value !== undefined);
        const lowerValues = predicates
            .filter(predicate => predicate.comparator === "gte" || predicate.comparator === "gt")
            .map(predicate => predicate.value as number);
        const upperValues = predicates
            .filter(predicate => predicate.comparator === "lte" || predicate.comparator === "lt")
            .map(predicate => predicate.value as number);
        const lower = lowerValues.length > 0 ? Math.max(...lowerValues) : undefined;
        const upper = upperValues.length > 0 ? Math.min(...upperValues) : undefined;
        if (lower !== undefined && upper !== undefined && lower > upper) {
            issues.push({ code: "condition-window-range", message: `Scenario window lower bound exceeds its upper bound.`, stateKey: state.stateKey, ruleId: rule.id });
        }
    }
}

function validateClassAndTypeValues(
    classes: TeamAnalysisClass[] | undefined,
    types: TeamAnalysisType[] | undefined,
    state: CharacterStateAnalysis,
    rule: PassiveRule,
    issues: TeamAnalysisValidationIssue[],
): void {
    if ((classes ?? []).some(value => !TEAM_ANALYSIS_CLASSES.includes(value))) {
        issues.push({ code: "class-value", message: `Class must be Super or Extreme.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if ((types ?? []).some(value => !TEAM_ANALYSIS_TYPES.includes(value))) {
        issues.push({ code: "type-value", message: `Type must be AGL, TEQ, INT, STR, or PHY.`, stateKey: state.stateKey, ruleId: rule.id });
    }
}

function validateKiSphereTypes(
    types: KiSphereType[] | undefined,
    code: string,
    state: CharacterStateAnalysis,
    rule: PassiveRule,
    issues: TeamAnalysisValidationIssue[],
): void {
    if (!types || types.length === 0 || types.some(type => !KI_SPHERE_TYPES.includes(type))) {
        issues.push({ code, message: `Ki Sphere types must use a recognized non-empty selector.`, stateKey: state.stateKey, ruleId: rule.id });
        return;
    }
    if ((types.includes("any") || types.includes("non_rainbow")) && types.length !== 1) {
        issues.push({ code: `${code}-exclusive`, message: `any and non_rainbow Ki Sphere selectors cannot be combined with other values.`, stateKey: state.stateKey, ruleId: rule.id });
    }
}

function validateFiniteNumbers(
    value: object,
    state: CharacterStateAnalysis,
    rule: PassiveRule,
    issues: TeamAnalysisValidationIssue[],
): void {
    for (const [key, fieldValue] of Object.entries(value)) {
        if (typeof fieldValue === "number" && !Number.isFinite(fieldValue)) {
            issues.push({ code: "non-finite-number", message: `${key} must be finite.`, stateKey: state.stateKey, ruleId: rule.id });
        }
    }
}
