export const COMBAT_RULES_SCHEMA_VERSION = 1;
export const COMBAT_RULES_VERSION = "1.0.0";
export const COMBAT_RULES_GENERATED_AT = "2026-08-04T00:00:00.000Z";
export const COMBAT_RULES_EVIDENCE_POLICY_VERSION = "1";
export const COMPATIBLE_TEAM_ANALYSIS_SCHEMA_VERSION = 1;
export const MINIMUM_TEAM_ANALYSIS_PARSER_VERSION = "1.7.1";
export const REQUIRED_TEAM_ANALYSIS_CAPABILITIES = ["sa-stat-raise-lifecycle-v1"] as const;
export const COMPATIBLE_TEAM_ANALYSIS_RULES_VERSION_RANGE = {
    minInclusive: "1",
    maxInclusive: "1",
} as const;

export type CombatRuleStatus = "verified" | "corroborated" | "candidate";
export type CombatRuleChannel =
    | "atk_pipeline"
    | "def_pipeline"
    | "super_attack"
    | "hidden_potential_critical"
    | "hidden_potential_additional"
    | "hidden_potential_dodge"
    | "hidden_potential_type_attack_boost"
    | "hidden_potential_type_defense_boost"
    | "type_class_alignment"
    | "guard"
    | "damage_dealt"
    | "damage_received"
    | "atk_lowering"
    | "damage_reduction"
    | "variance"
    | "minimum_damage"
    | "rounding"
    | "compatibility";
export type CombatRuleUnit =
    | "coefficient"
    | "percent"
    | "probability"
    | "probability_per_level"
    | "turns"
    | "damage"
    | "ordered_stages"
    | "formula"
    | "mapping"
    | "reference"
    | "none";
export type CombatEvidenceSource =
    | "first_party_export"
    | "first_party_structural_join"
    | "reproducible_fixture"
    | "community_guide"
    | "community_workbook"
    | "versioned_contract"
    | "unresolved";
export type CombatEvidenceLevel =
    | "direct"
    | "structural"
    | "reproduced"
    | "corroborating"
    | "unresolved";
export type CombatEvidenceSupport =
    | "identity"
    | "structure"
    | "value"
    | "order"
    | "rounding"
    | "corroboration"
    | "conflict";

export interface CombatRulesVersionRange {
    minInclusive: string;
    maxInclusive: string;
}

export interface CombatRuleProvenance {
    id: string;
    source: CombatEvidenceSource;
    evidenceLevel: CombatEvidenceLevel;
    reference: string;
    snapshotVersion?: string;
    locator?: string;
    supports: CombatEvidenceSupport[];
    notes?: string;
}

export interface CombatRuleOrder {
    status: "verified" | "candidate" | "unresolved";
    before?: string[];
    after?: string[];
    notes?: string;
}

export interface CombatRuleRounding {
    status: "verified" | "candidate" | "unresolved";
    mode: "floor" | "truncate" | "none" | "unresolved";
    boundaries: string[];
    notes?: string;
}

export interface CombatPipelineStep {
    id: string;
    order: number;
    evidenceStatus: CombatRuleStatus | "unresolved";
    rounding: "floor" | "truncate" | "none" | "unresolved";
}

export type CombatRuleValue =
    | { kind: "scalar"; amount: number }
    | { kind: "range"; min: number; max: number; minInclusive: boolean; maxInclusive: boolean }
    | { kind: "rate_per_level"; amountPerLevel: number; levelUnit: "hidden_potential_skill_level" }
    | { kind: "pipeline"; steps: CombatPipelineStep[] }
    | { kind: "formula"; expression: string; variables: string[]; groupSemantics?: string[] }
    | {
        kind: "mapping";
        dimensions: string[];
        completeness: "complete" | "partial";
        entries: Array<{ key: string[]; amount: number }>;
    }
    | { kind: "reference"; dataset: "team_analysis"; ruleId: string }
    | { kind: "structured"; fields: Record<string, string | number | boolean | string[]> };

export interface CombatRule {
    id: string;
    channel: CombatRuleChannel;
    version: string;
    status: CombatRuleStatus;
    normative: boolean;
    value: CombatRuleValue;
    unit: CombatRuleUnit;
    applicationOrder?: CombatRuleOrder;
    rounding?: CombatRuleRounding;
    provenance: CombatRuleProvenance[];
    evidenceLevel: CombatEvidenceLevel;
    structuralReferences: string[];
    compatibilityNotes: string[];
    risk: "low" | "medium" | "high";
}

export interface UnresolvedCombatRule {
    id: string;
    channel: CombatRuleChannel;
    version: string;
    status: "unresolved";
    normative: false;
    requiredEvidence: string;
    blockedOutputs: string[];
    provenance: CombatRuleProvenance[];
    structuralReferences: string[];
    compatibilityNotes: string[];
    risk: "medium" | "high";
}

export interface CombatRulesDataset {
    schemaVersion: number;
    combatRulesVersion: string;
    generatedAt: string;
    compatibleTeamAnalysisSchemaVersion: number;
    compatibleTeamAnalysisRulesVersionRange: CombatRulesVersionRange;
    minimumTeamAnalysisParserVersion: string;
    requiredTeamAnalysisCapabilities: string[];
    evidencePolicyVersion: string;
    rules: CombatRule[];
    unresolvedRules: UnresolvedCombatRule[];
}

export interface CombatRulesCoverageReport {
    schemaVersion: number;
    combatRulesVersion: string;
    evidencePolicyVersion: string;
    ruleCount: number;
    normativeRuleCount: number;
    verifiedRuleCount: number;
    corroboratedRuleCount: number;
    candidateRuleCount: number;
    unresolvedRuleCount: number;
    byChannel: Record<string, number>;
    byEvidenceSource: Record<string, number>;
    rulesWithVerifiedOrder: number;
    rulesWithCandidateOrder: number;
    rulesWithUnresolvedOrder: number;
    rulesWithVerifiedRounding: number;
    rulesWithCandidateRounding: number;
    rulesWithUnresolvedRounding: number;
}

export interface CombatRulesValidationIssue {
    code: string;
    path: string;
    message: string;
}

const GLOBAL_EXPORT = "game-db/data/game-db-acquisition/first-party/latest/metadata.json";
const TEAM_CONTRACT = "docs/specs/team-builder-analysis-contract.md";
const ROADMAP = "docs/specs/combat-calculation-roadmap.md";
const A7_AUDIT = "docs/specs/team-analysis-gate-a7-audit.md";
const A71_AUDIT = "docs/specs/team-analysis-gate-a71-audit.md";
const COMMUNITY_GUIDE = "https://docs.google.com/document/d/1Kjk7QnNmfax80qXM8LL4b9woN_GxR0rqyAibR8BoDFY/edit";
const DAMAGE_GUIDE = "https://docs.google.com/document/d/11S78tMJsqVr-_bQuvdwi4uR6M5sDB51gpKpnPwzwiZA/edit";
const DAMAGE_WORKBOOK = "https://docs.google.com/spreadsheets/d/1Fk5jVGUxSAnupWcBNAC5WuqFBaSQYBPsCTMkj7Plyzs/edit";

function provenance(
    id: string,
    source: CombatEvidenceSource,
    evidenceLevel: CombatEvidenceLevel,
    reference: string,
    supports: CombatEvidenceSupport[],
    options: Partial<Pick<CombatRuleProvenance, "snapshotVersion" | "locator" | "notes">> = {},
): CombatRuleProvenance {
    return { id, source, evidenceLevel, reference, supports, ...options };
}

const communityCalculationGuide = (id: string, supports: CombatEvidenceSupport[], locator: string) =>
    provenance(id, "community_guide", "corroborating", COMMUNITY_GUIDE, supports, { locator });
const damageGuide = (id: string, supports: CombatEvidenceSupport[], locator: string) =>
    provenance(id, "community_guide", "corroborating", DAMAGE_GUIDE, supports, { locator });
const damageWorkbook = (id: string, supports: CombatEvidenceSupport[], locator: string) =>
    provenance(id, "community_workbook", "corroborating", DAMAGE_WORKBOOK, supports, { locator });
const roadmapReference = (id: string, supports: CombatEvidenceSupport[], locator: string) =>
    provenance(id, "versioned_contract", "structural", ROADMAP, supports, { locator });
const firstPartyJoin = (id: string, supports: CombatEvidenceSupport[], reference: string, locator: string, notes: string) =>
    provenance(id, "first_party_structural_join", "structural", reference, supports, {
        snapshotVersion: "db-1782367825/asset-1782367204",
        locator,
        notes,
    });

export function buildCombatRulesDataset(options: {
    generatedAt?: string;
    combatRulesVersion?: string;
} = {}): CombatRulesDataset {
    const rules: CombatRule[] = [
        {
            id: "compat.sa-stat-raise-lifecycle",
            channel: "compatibility",
            version: "1",
            status: "verified",
            normative: true,
            value: { kind: "reference", dataset: "team_analysis", ruleId: "sa-stat-raise-lifecycle-v1" },
            unit: "reference",
            provenance: [
                provenance("a71-lifecycle-contract", "versioned_contract", "direct", A71_AUDIT, ["structure"], {
                    locator: "§1 and §4",
                    notes: "Gate A8 references the existing lifecycle rule and does not reinterpret it.",
                }),
            ],
            evidenceLevel: "direct",
            structuralReferences: ["ParsedSuperAttack.effects[].duration", "ParsedSuperAttack.effects[].stacking", "ParsedSuperAttack.effects[].applicationTrigger"],
            compatibilityNotes: ["Requires Team Analysis schema 1/rules 1.", "Magnitude remains outside this rule."],
            risk: "low",
        },
        {
            id: "compat.separate-condition-timing-bucket-duration",
            channel: "compatibility",
            version: "1",
            status: "verified",
            normative: true,
            value: {
                kind: "structured",
                fields: {
                    independentChannels: ["condition", "activation_timing", "calculation_bucket", "duration", "stacking", "global_rule", "character_value", "runtime_state", "calculated_result"],
                    missingEvidenceResult: "unresolved",
                },
            },
            unit: "none",
            provenance: [
                provenance("team-analysis-separation-contract", "versioned_contract", "direct", TEAM_CONTRACT, ["structure"], { locator: "§4 and §6" }),
                roadmapReference("combat-roadmap-separation", ["structure"], "Evidence policy"),
            ],
            evidenceLevel: "direct",
            structuralReferences: ["PassiveRule.condition", "PassiveEffect.activationTiming", "PassiveEffect.calculationBucket", "SuperAttackEffect.duration", "SuperAttackEffect.stacking"],
            compatibilityNotes: ["Consumers must not infer one channel from another.", "No runtime state or calculated result is serialized."],
            risk: "low",
        },
        {
            id: "atk.pipeline.order-candidate",
            channel: "atk_pipeline",
            version: "1",
            status: "candidate",
            normative: false,
            value: {
                kind: "pipeline",
                steps: [
                    "base_stats", "leader_skill", "passive_start_of_turn", "item_support_memory", "links",
                    "active_skill_stat_buff", "ki_multiplier", "passive_on_attack", "super_attack_effect_raise",
                    "super_attack_multiplier", "final_modifiers",
                ].map((id, index) => ({ id, order: index + 1, evidenceStatus: "candidate", rounding: "unresolved" })),
            },
            unit: "ordered_stages",
            applicationOrder: { status: "candidate", notes: "Order is corroborated by community calculations but not by a first-party global formula table." },
            rounding: { status: "unresolved", mode: "unresolved", boundaries: [], notes: "No rounding boundary is promoted by this pipeline." },
            provenance: [firstPartyJoin("global-card-stat-fields", ["identity", "structure"], GLOBAL_EXPORT, "cards/card_specials/leader/passive/link tables", "The export identifies source values but does not expose their calculation order."), communityCalculationGuide("ultimate-atk-order", ["order"], "The Calculation Order"), roadmapReference("roadmap-atk-order", ["structure"], "Future calculation order")],
            evidenceLevel: "corroborating",
            structuralReferences: ["PassiveEffect.calculationBucket", "ParsedSuperAttack.effects[].calculationBucket"],
            compatibilityNotes: ["Scenario activation and per-character values are supplied outside this dataset."],
            risk: "high",
        },
        {
            id: "def.pipeline.order-candidate",
            channel: "def_pipeline",
            version: "1",
            status: "candidate",
            normative: false,
            value: {
                kind: "pipeline",
                steps: [
                    "base_stats", "leader_skill", "passive_start_of_turn", "item_support_memory", "links",
                    "active_skill_stat_buff", "passive_on_attack", "super_attack_effect_raise", "final_modifiers",
                ].map((id, index) => ({ id, order: index + 1, evidenceStatus: "candidate", rounding: "unresolved" })),
            },
            unit: "ordered_stages",
            applicationOrder: { status: "candidate" },
            rounding: { status: "candidate", mode: "floor", boundaries: ["after_each_resolved_def_stage"], notes: "Workbook reproduction corroborates floor boundaries for DEF only; runtime verification is still required." },
            provenance: [firstPartyJoin("global-def-source-fields", ["identity", "structure"], GLOBAL_EXPORT, "cards/leader/passive/link tables", "The export identifies source values but does not expose their calculation order or rounding."), communityCalculationGuide("ultimate-def-order", ["order"], "The Calculation Order"), damageGuide("damage-guide-def-rounding", ["order", "rounding"], "DEF calculation and round down after each step"), damageWorkbook("workbook-def-stages", ["corroboration", "rounding"], "DEF Stack & Lower!E28:E31")],
            evidenceLevel: "corroborating",
            structuralReferences: ["PassiveEffect.calculationBucket", "SuperAttackEffect.calculationBucket"],
            compatibilityNotes: ["This does not authorize rounding at any damage-received stage."],
            risk: "high",
        },
        ...hiddenPotentialRules(),
        {
            id: "super-attack.qualitative-stat-raise-mapping",
            channel: "super_attack",
            version: "1",
            status: "candidate",
            normative: false,
            value: {
                kind: "mapping",
                dimensions: ["magnitude", "affected_stats", "duration_family"],
                completeness: "partial",
                entries: [
                    { key: ["raise", "atk", "finite_or_atk_only"], amount: 30 },
                    { key: ["greatly_raise", "atk_or_def", "any"], amount: 50 },
                    { key: ["massively_raise", "atk_or_def", "any"], amount: 100 },
                    { key: ["raise", "def", "any"], amount: 30 },
                    { key: ["raise", "atk_and_def", "persistent"], amount: 20 },
                    { key: ["raise", "atk_and_def", "current_turn"], amount: 30 },
                ],
            },
            unit: "mapping",
            provenance: [firstPartyJoin("a7-special-text-joins", ["identity", "structure"], A7_AUDIT, "§3 First-party cross-check", "1,913/1,922 attacks join exact first-party text/identity, but no numeric effect table is exposed."), communityCalculationGuide("ultimate-sa-raise-terms", ["value"], "Super Attack Effect Raises")],
            evidenceLevel: "corroborating",
            structuralReferences: ["SuperAttackEffect.magnitude", "SuperAttackEffect.duration", "SuperAttackEffect.target"],
            compatibilityNotes: ["Partial mapping must never be used as a universal fallback.", "Gate A7.1 lifecycle is unchanged."],
            risk: "high",
        },
        {
            id: "super-attack.attack-stacking-penalty",
            channel: "super_attack",
            version: "1",
            status: "candidate",
            normative: false,
            value: { kind: "formula", expression: "adjusted_sa_multiplier = base_sa_multiplier - persistent_atk_raise_per_application", variables: ["base_sa_multiplier", "persistent_atk_raise_per_application"] },
            unit: "formula",
            applicationOrder: { status: "candidate", notes: "Candidate penalty applies before the first persistent ATK raise contributes." },
            provenance: [communityCalculationGuide("ultimate-atk-stack-penalty", ["value", "order", "conflict"], "Attack Stacking")],
            evidenceLevel: "corroborating",
            structuralReferences: ["SuperAttackEffect.kind=atk_raise", "SuperAttackEffect.duration=permanent"],
            compatibilityNotes: ["Known community-described exceptions prevent universal application."],
            risk: "high",
        },
        {
            id: "guard.coefficient-after-defense",
            channel: "guard",
            version: "1",
            status: "corroborated",
            normative: false,
            value: { kind: "scalar", amount: 0.5 },
            unit: "coefficient",
            applicationOrder: { status: "candidate", after: ["damage_received.subtract_resolved_def"], notes: "Both guide and workbook put guard after DEF subtraction." },
            rounding: { status: "unresolved", mode: "unresolved", boundaries: [] },
            provenance: [damageGuide("damage-guide-guard", ["value", "order"], "Overall Calculations and Guard"), damageWorkbook("workbook-guard", ["corroboration", "value", "order"], "Guard!H5:H8")],
            evidenceLevel: "corroborating",
            structuralReferences: ["PassiveEffect.kind=guard", "runtime.naturalTypeAdvantage"],
            compatibilityNotes: ["Alignment modifier remains separate from guard coefficient."],
            risk: "high",
        },
        {
            id: "type-defense-boost.natural-advantage-rate",
            channel: "hidden_potential_type_defense_boost",
            version: "1",
            status: "candidate",
            normative: false,
            value: { kind: "rate_per_level", amountPerLevel: -0.01, levelUnit: "hidden_potential_skill_level" },
            unit: "coefficient",
            applicationOrder: { status: "candidate", notes: "Candidate adjustment belongs to Class/Type alignment, not the guard coefficient." },
            provenance: [damageGuide("damage-guide-tdb", ["value", "order"], "Type Defense Boost and Guard"), damageWorkbook("workbook-tdb", ["corroboration", "value"], "DEF Stack & Lower!E42")],
            evidenceLevel: "corroborating",
            structuralReferences: ["runtime.naturalTypeAdvantage", "runtime.hiddenPotential.typeDefenseBoostLevel"],
            compatibilityNotes: ["Passive guard alone must not activate this candidate rule."],
            risk: "high",
        },
        {
            id: "damage-dealt.channel-order",
            channel: "damage_dealt",
            version: "1",
            status: "candidate",
            normative: false,
            value: { kind: "formula", expression: "((atk_stat * attack_modifier * variance) - enemy_def) * enemy_damage_reduction", variables: ["atk_stat", "attack_modifier", "variance", "enemy_def", "enemy_damage_reduction"], groupSemantics: ["critical_effective_type_guard_are_distinct", "enemy_general_and_attack_kind_dr_are_distinct"] },
            unit: "formula",
            applicationOrder: { status: "candidate" },
            rounding: { status: "unresolved", mode: "unresolved", boundaries: [] },
            provenance: [communityCalculationGuide("ultimate-damage-dealt", ["order"], "Damage Dealt"), roadmapReference("roadmap-damage-dealt", ["structure"], "Future calculation order")],
            evidenceLevel: "corroborating",
            structuralReferences: ["runtime.enemyDef", "runtime.enemyDamageReduction", "runtime.attackOutcome"],
            compatibilityNotes: ["Critical DEF bypass is not normative in A8.", "No damage is calculated by the scraper."],
            risk: "high",
        },
        {
            id: "damage-received.channel-order",
            channel: "damage_received",
            version: "1",
            status: "candidate",
            normative: false,
            value: { kind: "formula", expression: "(enemy_atk * adjusted_sa_multiplier * product(atk_lowering_groups) * general_dr * attack_kind_dr * class_type_alignment * variance - resolved_character_def) * guard_coefficient", variables: ["enemy_atk", "adjusted_sa_multiplier", "atk_lowering_groups", "general_dr", "attack_kind_dr", "class_type_alignment", "variance", "resolved_character_def", "guard_coefficient"], groupSemantics: ["add_inside_source_group", "multiply_between_source_groups", "support_memory_uses_item_channel"] },
            unit: "formula",
            applicationOrder: { status: "candidate" },
            rounding: { status: "unresolved", mode: "unresolved", boundaries: [] },
            provenance: [damageGuide("damage-guide-received-formula", ["order", "value"], "Overall Calculations"), damageWorkbook("workbook-received-formula", ["corroboration", "order"], "Basic, Damage Reduction, ATK Lower, Guard"), roadmapReference("roadmap-received-formula", ["structure"], "Candidate damage-received model")],
            evidenceLevel: "corroborating",
            structuralReferences: ["PassiveEffect.kind=damage_reduction", "SuperAttackEffect.kind=enemy_atk_lowering", "runtime.enemyAttack"],
            compatibilityNotes: ["Normal/Super-specific DR remains distinct from general DR.", "Minimum damage is a separate unresolved path."],
            risk: "high",
        },
        {
            id: "atk-lowering.source-groups",
            channel: "atk_lowering",
            version: "1",
            status: "candidate",
            normative: false,
            value: { kind: "structured", fields: { additiveInsideGroup: true, multiplicativeBetweenGroups: true, groups: ["passive", "item_support_memory", "super_attack_effect"] } },
            unit: "none",
            provenance: [damageGuide("damage-guide-atk-lowering-groups", ["order", "value"], "Attack Lowering"), damageWorkbook("workbook-atk-lowering-groups", ["corroboration"], "ATK Lower!F75:F81 and F125:F131")],
            evidenceLevel: "corroborating",
            structuralReferences: ["SuperAttackEffect.calculationBucket=super_attack_enemy_stat_lowering", "PassiveEffect.kind=enemy_atk_down"],
            compatibilityNotes: ["SA-effect lowering adjusts the SA multiplier for incoming Supers in the candidate model."],
            risk: "high",
        },
        {
            id: "damage-reduction.source-groups",
            channel: "damage_reduction",
            version: "1",
            status: "candidate",
            normative: false,
            value: { kind: "structured", fields: { additiveInsideGroup: true, multiplicativeBetweenGroups: true, groups: ["general", "normal_only", "super_only"], supportMemoryChannel: "item" } },
            unit: "none",
            provenance: [damageGuide("damage-guide-dr-groups", ["order", "value"], "Damage Reduction"), damageWorkbook("workbook-dr-groups", ["corroboration"], "Damage Reduction!P125:P130")],
            evidenceLevel: "corroborating",
            structuralReferences: ["PassiveEffect.kind=damage_reduction", "CombatEventDescriptor.attackKind"],
            compatibilityNotes: ["Attack-kind applicability is runtime state, not duplicated on the effect."],
            risk: "high",
        },
        {
            id: "variance.observed-range",
            channel: "variance",
            version: "1",
            status: "corroborated",
            normative: false,
            value: { kind: "range", min: 1, max: 1.03, minInclusive: true, maxInclusive: true },
            unit: "coefficient",
            applicationOrder: { status: "candidate", before: ["damage_received.subtract_resolved_def"] },
            provenance: [communityCalculationGuide("ultimate-variance", ["value", "order"], "Variance"), damageGuide("damage-guide-variance", ["value"], "Variance"), damageWorkbook("workbook-variance", ["corroboration", "value"], "Basic!G22:I22")],
            evidenceLevel: "corroborating",
            structuralReferences: ["runtime.varianceRoll"],
            compatibilityNotes: ["Distribution is unresolved.", "1.015 is only the arithmetic midpoint in A8."],
            risk: "medium",
        },
        {
            id: "minimum-damage.observed-trigger-and-range",
            channel: "minimum_damage",
            version: "1",
            status: "candidate",
            normative: false,
            value: { kind: "structured", fields: { equationResultBelow: 150, enemyZeroKiObservedMinimum: 9, enemyZeroKiObservedMaximum: 132, algorithm: "unresolved_special_path" } },
            unit: "damage",
            provenance: [damageGuide("damage-guide-minimum", ["value"], "Minimum Damage"), roadmapReference("roadmap-minimum", ["structure"], "Candidate damage-received model")],
            evidenceLevel: "corroborating",
            structuralReferences: ["runtime.enemyKi", "runtime.preMinimumDamage"],
            compatibilityNotes: ["This is not a clamp and cannot be executed without the unresolved algorithm."],
            risk: "high",
        },
    ];

    const unresolvedRules: UnresolvedCombatRule[] = [
        unresolved("super-attack.base-and-level-progression", "super_attack", "First-party or reproducible tables for base multiplier and level progression across Super, Ultra, Unit and EX.", ["exact ATK stat", "damage dealt"], ["ParsedSuperAttack.variant", "ParsedSuperAttack.ki"]),
        unresolved("super-attack.qualitative-mapping-exceptions", "super_attack", "First-party effect values or exhaustive reproducible fixtures for every wording/stat/duration combination and exceptions.", ["exact ATK", "exact DEF"], ["SuperAttackEffect.magnitude", "SuperAttackEffect.duration"]),
        unresolved("super-attack.attack-stacking-penalty-exceptions", "super_attack", "Stable structural exception identifiers and reproduced first-hit/next-hit behavior.", ["exact ATK after persistent raises"], ["SuperAttackEffect.kind=atk_raise"]),
        unresolved("type-class.complete-alignment-table", "type_class_alignment", "A complete first-party or reproducible matrix over attacker/defender Class, Type, advantage state and no-Class state.", ["damage dealt", "damage received"], ["Character.class", "Character.type", "runtime.enemyClass", "runtime.enemyType"]),
        unresolved("guard.natural-versus-passive-alignment", "guard", "Reproducible fixtures separating natural guard alignment from passive guard alignment for all Class/Type dimensions.", ["damage received with guard"], ["PassiveEffect.kind=guard", "runtime.naturalTypeAdvantage"]),
        unresolved("hidden-potential.type-attack-boost", "hidden_potential_type_attack_boost", "First-party or exhaustive reproducible TAB applicability and modifier formula.", ["critical damage", "type-effective damage"], ["runtime.hiddenPotential.typeAttackBoostLevel"]),
        unresolved("variance.distribution", "variance", "Observed roll distribution or first-party RNG mapping; endpoints alone do not prove uniformity.", ["expected damage", "probability distribution"], ["runtime.varianceRoll"]),
        unresolved("variance.mean", "variance", "Distribution evidence proving an expected value; 1.015 is only the midpoint of 1.00–1.03.", ["expected damage"], ["runtime.varianceRoll"]),
        unresolved("minimum-damage.algorithm", "minimum_damage", "Reproducible mapping from Ki/RNG/runtime state to the special minimum-damage output.", ["exact damage below threshold"], ["runtime.enemyKi", "runtime.preMinimumDamage"]),
        unresolved("rounding.integer-operation-order", "rounding", "Frame-by-frame or first-party proof for every integer truncation boundary in ATK, damage dealt and damage received.", ["exact ATK", "exact DEF", "exact damage"], ["all combat pipeline stages"]),
        unresolved("damage-reduction.typed-applicability", "damage_reduction", "Typed source data for general, normal-only and Super-only reduction across characters and enemies.", ["exact damage received", "exact damage dealt"], ["CombatEventDescriptor.attackKind", "PassiveEffect.kind=damage_reduction"]),
        unresolved("enemy-phase.combat-facts", "damage_received", "A separate source-neutral boss-phase dataset with ATK, SA multiplier, DEF, Class/Type, DR, kind and immunities.", ["any scenario-specific combat result"], ["runtime.enemyPhase"]),
    ];

    return {
        schemaVersion: COMBAT_RULES_SCHEMA_VERSION,
        combatRulesVersion: options.combatRulesVersion ?? COMBAT_RULES_VERSION,
        generatedAt: options.generatedAt ?? COMBAT_RULES_GENERATED_AT,
        compatibleTeamAnalysisSchemaVersion: COMPATIBLE_TEAM_ANALYSIS_SCHEMA_VERSION,
        compatibleTeamAnalysisRulesVersionRange: { ...COMPATIBLE_TEAM_ANALYSIS_RULES_VERSION_RANGE },
        minimumTeamAnalysisParserVersion: MINIMUM_TEAM_ANALYSIS_PARSER_VERSION,
        requiredTeamAnalysisCapabilities: [...REQUIRED_TEAM_ANALYSIS_CAPABILITIES],
        evidencePolicyVersion: COMBAT_RULES_EVIDENCE_POLICY_VERSION,
        rules,
        unresolvedRules,
    };
}

function hiddenPotentialRules(): CombatRule[] {
    return [
        ["hidden-potential.critical-rate", "hidden_potential_critical", 0.02, "Critical"],
        ["hidden-potential.additional-rate", "hidden_potential_additional", 0.02, "Additional"],
        ["hidden-potential.dodge-rate", "hidden_potential_dodge", 0.01, "Dodge"],
    ].map(([id, channel, amount, label]) => ({
        id: id as string,
        channel: channel as CombatRuleChannel,
        version: "1",
        status: "corroborated" as const,
        normative: false,
        value: { kind: "rate_per_level" as const, amountPerLevel: amount as number, levelUnit: "hidden_potential_skill_level" as const },
        unit: "probability_per_level" as const,
        provenance: [
            communityCalculationGuide(`${id}-guide`, ["value"], "Understanding The Hidden Potential System"),
            roadmapReference(`${id}-roadmap`, ["corroboration"], "Data still missing / Hidden Potential boundary"),
        ],
        evidenceLevel: "corroborating" as const,
        structuralReferences: [`runtime.hiddenPotential.${String(label).toLowerCase()}Level`],
        compatibilityNotes: [`${label} Hidden Potential rolls remain separate from passive probability channels.`],
        risk: "medium" as const,
    }));
}

function unresolved(
    id: string,
    channel: CombatRuleChannel,
    requiredEvidence: string,
    blockedOutputs: string[],
    structuralReferences: string[],
): UnresolvedCombatRule {
    return {
        id,
        channel,
        version: "1",
        status: "unresolved",
        normative: false,
        requiredEvidence,
        blockedOutputs,
        provenance: [
            provenance(`${id}-gap`, "unresolved", "unresolved", ROADMAP, ["conflict"], { locator: "Data still missing" }),
            provenance(`${id}-export-scope`, "first_party_export", "structural", GLOBAL_EXPORT, ["structure"], {
                snapshotVersion: "db-1782367825/asset-1782367204",
                notes: "The frozen export has no global mechanics table that resolves this rule.",
            }),
        ],
        structuralReferences,
        compatibilityNotes: ["Consumers must return unknown or request explicit assumptions."],
        risk: "high",
    };
}

export function buildCombatRulesCoverageReport(dataset: CombatRulesDataset): CombatRulesCoverageReport {
    const all = [...dataset.rules, ...dataset.unresolvedRules];
    return {
        schemaVersion: dataset.schemaVersion,
        combatRulesVersion: dataset.combatRulesVersion,
        evidencePolicyVersion: dataset.evidencePolicyVersion,
        ruleCount: dataset.rules.length,
        normativeRuleCount: dataset.rules.filter(rule => rule.normative).length,
        verifiedRuleCount: dataset.rules.filter(rule => rule.status === "verified").length,
        corroboratedRuleCount: dataset.rules.filter(rule => rule.status === "corroborated").length,
        candidateRuleCount: dataset.rules.filter(rule => rule.status === "candidate").length,
        unresolvedRuleCount: dataset.unresolvedRules.length,
        byChannel: countBy(all.map(rule => rule.channel)),
        byEvidenceSource: countBy(all.flatMap(rule => rule.provenance.map(item => item.source))),
        rulesWithVerifiedOrder: dataset.rules.filter(rule => rule.applicationOrder?.status === "verified").length,
        rulesWithCandidateOrder: dataset.rules.filter(rule => rule.applicationOrder?.status === "candidate").length,
        rulesWithUnresolvedOrder: dataset.rules.filter(rule => rule.applicationOrder?.status === "unresolved").length,
        rulesWithVerifiedRounding: dataset.rules.filter(rule => rule.rounding?.status === "verified").length,
        rulesWithCandidateRounding: dataset.rules.filter(rule => rule.rounding?.status === "candidate").length,
        rulesWithUnresolvedRounding: dataset.rules.filter(rule => rule.rounding?.status === "unresolved").length,
    };
}

export function validateCombatRulesDataset(value: unknown): CombatRulesValidationIssue[] {
    const issues: CombatRulesValidationIssue[] = [];
    const issue = (code: string, path: string, message: string) => issues.push({ code, path, message });
    if (!isRecord(value)) {
        issue("schema-type", "$", "Dataset must be an object.");
        return issues;
    }
    if (value.schemaVersion !== COMBAT_RULES_SCHEMA_VERSION) issue("schema-version", "schemaVersion", "Unsupported combat-rules schema version.");
    if (!isSemver(value.combatRulesVersion)) issue("combat-rules-version", "combatRulesVersion", "combatRulesVersion must be semantic versioning.");
    if (!isIsoDate(value.generatedAt)) issue("generated-at", "generatedAt", "generatedAt must be an ISO timestamp.");
    if (value.compatibleTeamAnalysisSchemaVersion !== COMPATIBLE_TEAM_ANALYSIS_SCHEMA_VERSION) issue("team-schema-compatibility", "compatibleTeamAnalysisSchemaVersion", "Unsupported Team Analysis schema compatibility.");
    validateVersionRange(value.compatibleTeamAnalysisRulesVersionRange, "compatibleTeamAnalysisRulesVersionRange", issue);
    if (value.minimumTeamAnalysisParserVersion !== MINIMUM_TEAM_ANALYSIS_PARSER_VERSION) issue("team-parser-compatibility", "minimumTeamAnalysisParserVersion", "Unsupported minimum Team Analysis parser version.");
    if (!Array.isArray(value.requiredTeamAnalysisCapabilities)
        || value.requiredTeamAnalysisCapabilities.length !== REQUIRED_TEAM_ANALYSIS_CAPABILITIES.length
        || REQUIRED_TEAM_ANALYSIS_CAPABILITIES.some(capability => !value.requiredTeamAnalysisCapabilities.includes(capability))) {
        issue("team-capability-compatibility", "requiredTeamAnalysisCapabilities", "Required Team Analysis capabilities do not match this combat-rules version.");
    }
    if (value.evidencePolicyVersion !== COMBAT_RULES_EVIDENCE_POLICY_VERSION) issue("evidence-policy-version", "evidencePolicyVersion", "Unsupported evidence policy version.");
    if (!Array.isArray(value.rules)) issue("schema-rules", "rules", "rules must be an array.");
    if (!Array.isArray(value.unresolvedRules)) issue("schema-unresolved", "unresolvedRules", "unresolvedRules must be an array.");
    if (!Array.isArray(value.rules) || !Array.isArray(value.unresolvedRules)) return issues;

    const ids = new Set<string>();
    value.rules.forEach((rawRule, index) => {
        const path = `rules[${index}]`;
        if (!isRecord(rawRule)) {
            issue("schema-rule", path, "Rule must be an object.");
            return;
        }
        validateCommonRule(rawRule, path, ids, issue);
        if (!isEnum(rawRule.status, RULE_STATUSES)) issue("rule-status", `${path}.status`, "Unknown rule status.");
        if (typeof rawRule.normative !== "boolean") issue("rule-normative", `${path}.normative`, "normative must be boolean.");
        if (rawRule.normative !== (rawRule.status === "verified")) issue("normative-status", `${path}.normative`, "Only verified rules may be normative and every verified rule must be normative.");
        validateRuleValue(rawRule.value, `${path}.value`, issue);
        if (!isEnum(rawRule.unit, RULE_UNITS)) issue("rule-unit", `${path}.unit`, "Unknown rule unit.");
        else validateValueUnitCompatibility(rawRule.value, rawRule.unit, `${path}.value`, issue);
        if (!isEnum(rawRule.evidenceLevel, EVIDENCE_LEVELS)) issue("evidence-level", `${path}.evidenceLevel`, "Unknown evidence level.");
        validateOrder(rawRule.applicationOrder, `${path}.applicationOrder`, issue);
        validateRounding(rawRule.rounding, `${path}.rounding`, issue);
        if (rawRule.normative && !hasSufficientNormativeEvidence(rawRule)) issue("normative-evidence", `${path}.provenance`, "Normative rule lacks claim-specific evidence permitted by policy.");
    });
    value.unresolvedRules.forEach((rawRule, index) => {
        const path = `unresolvedRules[${index}]`;
        if (!isRecord(rawRule)) {
            issue("schema-unresolved-rule", path, "Unresolved rule must be an object.");
            return;
        }
        validateCommonRule(rawRule, path, ids, issue);
        if (rawRule.status !== "unresolved" || rawRule.normative !== false) issue("unresolved-normative", path, "Unresolved rules must be non-normative and have unresolved status.");
        if (!nonEmptyString(rawRule.requiredEvidence)) issue("unresolved-required-evidence", `${path}.requiredEvidence`, "requiredEvidence is required.");
        if (!isNonEmptyStringArray(rawRule.blockedOutputs)) issue("unresolved-blocked-outputs", `${path}.blockedOutputs`, "blockedOutputs must be non-empty.");
    });
    validateCrossRuleReferences(value.rules, ids, issue);
    return issues;
}

export function assertValidCombatRulesDataset(value: unknown): asserts value is CombatRulesDataset {
    const issues = validateCombatRulesDataset(value);
    if (issues.length > 0) {
        throw new Error(`Combat rules validation failed:\n${issues.map(item => `${item.code} at ${item.path}: ${item.message}`).join("\n")}`);
    }
}

const RULE_STATUSES: CombatRuleStatus[] = ["verified", "corroborated", "candidate"];
const RULE_CHANNELS: CombatRuleChannel[] = ["atk_pipeline", "def_pipeline", "super_attack", "hidden_potential_critical", "hidden_potential_additional", "hidden_potential_dodge", "hidden_potential_type_attack_boost", "hidden_potential_type_defense_boost", "type_class_alignment", "guard", "damage_dealt", "damage_received", "atk_lowering", "damage_reduction", "variance", "minimum_damage", "rounding", "compatibility"];
const RULE_UNITS: CombatRuleUnit[] = ["coefficient", "percent", "probability", "probability_per_level", "turns", "damage", "ordered_stages", "formula", "mapping", "reference", "none"];
const EVIDENCE_SOURCES: CombatEvidenceSource[] = ["first_party_export", "first_party_structural_join", "reproducible_fixture", "community_guide", "community_workbook", "versioned_contract", "unresolved"];
const EVIDENCE_LEVELS: CombatEvidenceLevel[] = ["direct", "structural", "reproduced", "corroborating", "unresolved"];
const EVIDENCE_SUPPORTS: CombatEvidenceSupport[] = ["identity", "structure", "value", "order", "rounding", "corroboration", "conflict"];

function validateCommonRule(rawRule: Record<string, unknown>, path: string, ids: Set<string>, issue: (code: string, path: string, message: string) => void): void {
    const forbiddenKeys = findForbiddenKeys(rawRule);
    if (forbiddenKeys.length > 0) issue("source-neutrality", path, `Rules cannot contain per-character, runtime-state, or calculated-result fields: ${forbiddenKeys.join(", ")}.`);
    if (!nonEmptyString(rawRule.id)) issue("rule-id", `${path}.id`, "Stable rule ID is required.");
    else if (ids.has(rawRule.id)) issue("rule-id-unique", `${path}.id`, "Rule ID must be unique.");
    else ids.add(rawRule.id);
    if (!isEnum(rawRule.channel, RULE_CHANNELS)) issue("rule-channel", `${path}.channel`, "Unknown rule channel.");
    if (!nonEmptyString(rawRule.version)) issue("rule-version", `${path}.version`, "Rule version is required.");
    validateProvenance(rawRule.provenance, `${path}.provenance`, issue);
    if (!isNonEmptyStringArray(rawRule.structuralReferences)) issue("structural-references", `${path}.structuralReferences`, "At least one structural reference is required.");
    if (!isNonEmptyStringArray(rawRule.compatibilityNotes)) issue("compatibility-notes", `${path}.compatibilityNotes`, "At least one compatibility note is required.");
    if (!isEnum(rawRule.risk, ["low", "medium", "high"])) issue("rule-risk", `${path}.risk`, "Unknown risk.");
}

function validateProvenance(raw: unknown, path: string, issue: (code: string, path: string, message: string) => void): void {
    if (!Array.isArray(raw) || raw.length === 0) {
        issue("provenance-required", path, "At least one provenance record is required.");
        return;
    }
    raw.forEach((entry, index) => {
        const entryPath = `${path}[${index}]`;
        if (!isRecord(entry)) {
            issue("provenance-schema", entryPath, "Provenance record must be an object.");
            return;
        }
        if (!nonEmptyString(entry.id)) issue("provenance-id", `${entryPath}.id`, "Provenance ID is required.");
        if (!isEnum(entry.source, EVIDENCE_SOURCES)) issue("provenance-source", `${entryPath}.source`, "Unknown provenance source.");
        if (!isEnum(entry.evidenceLevel, EVIDENCE_LEVELS)) issue("provenance-level", `${entryPath}.evidenceLevel`, "Unknown provenance evidence level.");
        if (!nonEmptyString(entry.reference)) issue("provenance-reference", `${entryPath}.reference`, "Provenance reference is required.");
        if (!Array.isArray(entry.supports) || entry.supports.length === 0 || entry.supports.some(item => !isEnum(item, EVIDENCE_SUPPORTS))) issue("provenance-supports", `${entryPath}.supports`, "Provenance supports must use known non-empty enums.");
    });
}

function validateRuleValue(raw: unknown, path: string, issue: (code: string, path: string, message: string) => void): void {
    if (!isRecord(raw) || !nonEmptyString(raw.kind)) {
        issue("rule-value-schema", path, "Rule value must be a tagged object.");
        return;
    }
    if (raw.kind === "scalar") validateFinite(raw.amount, `${path}.amount`, issue);
    else if (raw.kind === "range") {
        validateFinite(raw.min, `${path}.min`, issue);
        validateFinite(raw.max, `${path}.max`, issue);
        if (typeof raw.min === "number" && typeof raw.max === "number" && raw.min > raw.max) issue("range-order", path, "Range min must not exceed max.");
        if (typeof raw.minInclusive !== "boolean" || typeof raw.maxInclusive !== "boolean") issue("range-inclusivity", path, "Range inclusivity flags are required.");
    } else if (raw.kind === "rate_per_level") {
        validateFinite(raw.amountPerLevel, `${path}.amountPerLevel`, issue);
        if (raw.levelUnit !== "hidden_potential_skill_level") issue("rate-level-unit", `${path}.levelUnit`, "Unknown per-level unit.");
        if (typeof raw.amountPerLevel === "number" && (raw.amountPerLevel < -1 || raw.amountPerLevel > 1)) issue("percentage-range", `${path}.amountPerLevel`, "Per-level coefficient must be within -1..1.");
    } else if (raw.kind === "pipeline") {
        if (!Array.isArray(raw.steps) || raw.steps.length === 0) issue("pipeline-steps", `${path}.steps`, "Pipeline requires steps.");
        else {
            const orders = new Set<number>();
            raw.steps.forEach((step, index) => {
                if (!isRecord(step) || !nonEmptyString(step.id) || !Number.isInteger(step.order) || (step.order as number) < 1) issue("pipeline-step", `${path}.steps[${index}]`, "Pipeline step requires ID and positive integer order.");
                else if (orders.has(step.order as number)) issue("pipeline-order-unique", `${path}.steps[${index}].order`, "Pipeline step order must be unique.");
                else orders.add(step.order as number);
                if (isRecord(step) && !isEnum(step.evidenceStatus, [...RULE_STATUSES, "unresolved"])) issue("pipeline-evidence-status", `${path}.steps[${index}].evidenceStatus`, "Unknown pipeline evidence status.");
                if (isRecord(step) && !isEnum(step.rounding, ["floor", "truncate", "none", "unresolved"])) issue("pipeline-rounding", `${path}.steps[${index}].rounding`, "Unknown pipeline rounding.");
            });
            const sorted = [...orders].sort((a, b) => a - b);
            if (sorted.some((order, index) => order !== index + 1)) issue("pipeline-order-contiguous", `${path}.steps`, "Pipeline order must be contiguous from 1.");
        }
    } else if (raw.kind === "formula") {
        if (!nonEmptyString(raw.expression) || !isNonEmptyStringArray(raw.variables)) issue("formula-schema", path, "Formula requires expression and variables.");
    } else if (raw.kind === "mapping") {
        if (!isNonEmptyStringArray(raw.dimensions) || !isEnum(raw.completeness, ["complete", "partial"]) || !Array.isArray(raw.entries) || raw.entries.length === 0) issue("mapping-schema", path, "Mapping requires dimensions, completeness, and entries.");
        else raw.entries.forEach((entry, index) => {
            if (!isRecord(entry) || !Array.isArray(entry.key) || entry.key.length !== (raw.dimensions as string[]).length || entry.key.some(key => !nonEmptyString(key))) issue("mapping-key", `${path}.entries[${index}].key`, "Mapping key must cover every dimension.");
            if (isRecord(entry)) validateFinite(entry.amount, `${path}.entries[${index}].amount`, issue);
        });
    } else if (raw.kind === "reference") {
        if (raw.dataset !== "team_analysis" || !nonEmptyString(raw.ruleId)) issue("reference-schema", path, "Reference must name a Team Analysis rule.");
    } else if (raw.kind === "structured") {
        if (!isRecord(raw.fields) || Object.keys(raw.fields).length === 0) issue("structured-schema", `${path}.fields`, "Structured value requires fields.");
    } else issue("rule-value-kind", `${path}.kind`, "Unknown rule value kind.");
}

function validateValueUnitCompatibility(raw: unknown, unit: CombatRuleUnit, path: string, issue: (code: string, path: string, message: string) => void): void {
    if (!isRecord(raw)) return;
    if (unit === "probability" || unit === "probability_per_level") {
        const values = raw.kind === "scalar" ? [raw.amount] : raw.kind === "range" ? [raw.min, raw.max] : raw.kind === "rate_per_level" ? [raw.amountPerLevel] : [];
        if (values.some(value => typeof value !== "number" || value < 0 || value > 1)) issue("probability-range", path, "Probabilities must be within 0..1.");
    }
    if (unit === "percent") {
        const values = raw.kind === "scalar" ? [raw.amount] : raw.kind === "range" ? [raw.min, raw.max] : [];
        if (values.some(value => typeof value !== "number" || value < -100 || value > 100)) issue("percent-range", path, "Percent values must be within -100..100.");
    }
}

function validateOrder(raw: unknown, path: string, issue: (code: string, path: string, message: string) => void): void {
    if (raw === undefined) return;
    if (!isRecord(raw) || !isEnum(raw.status, ["verified", "candidate", "unresolved"])) {
        issue("order-schema", path, "Application order must use a known status.");
        return;
    }
    if (raw.before !== undefined && !isNonEmptyStringArray(raw.before)) issue("order-before", `${path}.before`, "before must be a non-empty string array when present.");
    if (raw.after !== undefined && !isNonEmptyStringArray(raw.after)) issue("order-after", `${path}.after`, "after must be a non-empty string array when present.");
    const before = Array.isArray(raw.before) ? raw.before : [];
    const after = Array.isArray(raw.after) ? raw.after : [];
    if (before.some(item => after.includes(item))) issue("order-contradiction", path, "The same rule cannot be both before and after.");
}

function validateRounding(raw: unknown, path: string, issue: (code: string, path: string, message: string) => void): void {
    if (raw === undefined) return;
    if (!isRecord(raw) || !isEnum(raw.status, ["verified", "candidate", "unresolved"]) || !isEnum(raw.mode, ["floor", "truncate", "none", "unresolved"]) || !Array.isArray(raw.boundaries) || raw.boundaries.some(item => !nonEmptyString(item))) {
        issue("rounding-schema", path, "Rounding must use known status/mode and string boundaries.");
        return;
    }
    if (raw.status === "unresolved" && raw.mode !== "unresolved") issue("rounding-contradiction", path, "Unresolved rounding cannot select a mode.");
    if (raw.mode === "unresolved" && raw.boundaries.length > 0) issue("rounding-boundary-contradiction", path, "Unresolved rounding cannot assert boundaries.");
    if (raw.mode !== "unresolved" && raw.mode !== "none" && raw.boundaries.length === 0) issue("rounding-boundaries-required", path, "Resolved rounding mode requires boundaries.");
}

function validateCrossRuleReferences(rules: unknown[], ids: Set<string>, issue: (code: string, path: string, message: string) => void): void {
    rules.forEach((raw, index) => {
        if (!isRecord(raw) || !isRecord(raw.applicationOrder)) return;
        for (const direction of ["before", "after"] as const) {
            const refs = raw.applicationOrder[direction];
            if (!Array.isArray(refs)) continue;
            refs.forEach((ref, refIndex) => {
                if (typeof ref !== "string" || (!ids.has(ref) && !ref.includes("."))) issue("order-reference", `rules[${index}].applicationOrder.${direction}[${refIndex}]`, "Order reference must be a stable rule/stage ID.");
                if (ref === raw.id) issue("order-self-reference", `rules[${index}].applicationOrder.${direction}[${refIndex}]`, "Rule cannot order itself.");
            });
        }
    });
}

function validateVersionRange(raw: unknown, path: string, issue: (code: string, path: string, message: string) => void): void {
    if (!isRecord(raw) || !nonEmptyString(raw.minInclusive) || !nonEmptyString(raw.maxInclusive)) {
        issue("version-range", path, "Compatibility range requires inclusive minimum and maximum.");
        return;
    }
    if (compareNumericVersions(raw.minInclusive, raw.maxInclusive) > 0) issue("version-range-order", path, "Compatibility minimum must not exceed maximum.");
    if (raw.minInclusive !== COMPATIBLE_TEAM_ANALYSIS_RULES_VERSION_RANGE.minInclusive || raw.maxInclusive !== COMPATIBLE_TEAM_ANALYSIS_RULES_VERSION_RANGE.maxInclusive) issue("team-rules-compatibility", path, "Unsupported Team Analysis rules range.");
}

function hasSufficientNormativeEvidence(rule: Record<string, unknown>): boolean {
    const evidence = Array.isArray(rule.provenance) ? rule.provenance.filter(isRecord) : [];
    const value = isRecord(rule.value) ? rule.value : undefined;
    if (!value) return false;
    const direct = (sources: CombatEvidenceSource[], support: CombatEvidenceSupport) => evidence.some(entry =>
        sources.includes(entry.source)
        && ["direct", "reproduced"].includes(String(entry.evidenceLevel))
        && Array.isArray(entry.supports)
        && entry.supports.includes(support));
    const structuralContract = () => evidence.some(entry =>
        entry.source === "versioned_contract"
        && entry.evidenceLevel === "direct"
        && Array.isArray(entry.supports)
        && entry.supports.includes("structure"));

    const numericKinds = ["scalar", "range", "rate_per_level", "mapping", "formula"];
    if (numericKinds.includes(String(value.kind)) && !direct(["first_party_export", "reproducible_fixture"], "value")) return false;
    if (value.kind === "pipeline" && !direct(["first_party_export", "reproducible_fixture"], "order")) return false;
    if (value.kind === "reference" && !structuralContract()) return false;
    if (value.kind === "structured") {
        if (!isRecord(value.fields) || Object.values(value.fields).some(field => typeof field === "number")) return false;
        if (!structuralContract()) return false;
    }
    const order = isRecord(rule.applicationOrder) ? rule.applicationOrder : undefined;
    if (order?.status === "verified" && !direct(["first_party_export", "reproducible_fixture"], "order")) return false;
    const rounding = isRecord(rule.rounding) ? rule.rounding : undefined;
    if (rounding?.status === "verified" && !direct(["first_party_export", "reproducible_fixture"], "rounding")) return false;
    return true;
}

const FORBIDDEN_RULE_KEYS = new Set([
    "characterId", "stateKey", "canonicalId", "gameCharacterId", "baseCharacterId", "displayName",
    "runtimeState", "calculatedResult", "calculatedDamage", "calculatedAtk", "calculatedDef",
]);

function findForbiddenKeys(value: unknown, path = ""): string[] {
    if (Array.isArray(value)) return value.flatMap((entry, index) => findForbiddenKeys(entry, `${path}[${index}]`));
    if (!isRecord(value)) return [];
    return Object.entries(value).flatMap(([key, child]) => {
        const childPath = path ? `${path}.${key}` : key;
        return [...(FORBIDDEN_RULE_KEYS.has(key) ? [childPath] : []), ...findForbiddenKeys(child, childPath)];
    });
}

function countBy(values: string[]): Record<string, number> {
    return values.sort().reduce<Record<string, number>>((result, value) => {
        result[value] = (result[value] ?? 0) + 1;
        return result;
    }, {});
}

function compareNumericVersions(left: string, right: string): number {
    const a = left.split(".").map(Number);
    const b = right.split(".").map(Number);
    for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
        const diff = (a[index] ?? 0) - (b[index] ?? 0);
        if (diff !== 0) return diff;
    }
    return 0;
}

function validateFinite(value: unknown, path: string, issue: (code: string, path: string, message: string) => void): void {
    if (typeof value !== "number" || !Number.isFinite(value)) issue("finite-number", path, "Value must be finite.");
}

function isRecord(value: unknown): value is Record<string, any> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
}

function isNonEmptyStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.length > 0 && value.every(nonEmptyString);
}

function isEnum<T extends string>(value: unknown, allowed: readonly T[]): value is T {
    return typeof value === "string" && allowed.includes(value as T);
}

function isSemver(value: unknown): value is string {
    return typeof value === "string" && /^\d+\.\d+\.\d+$/.test(value);
}

function isIsoDate(value: unknown): value is string {
    return typeof value === "string" && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value;
}
