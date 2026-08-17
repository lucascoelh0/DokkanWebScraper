import type { CharacterLeaderCompatibilityDimensionAssessment } from "./leader-supported-compatibility-contract";

export const CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_SOURCE_PINS = {
    scraper: [
        ["character.ts", 14_959, "583adccdd75006e8ff01ac840305924abdfb7619d9986a7a1d984a5ea4e71f0b"],
        ["scraper.ts", 72_543, "8cff1e8e7218f7c161020c31246c8a75a47a30f7ba58be745dd30f2d376c9009"],
        ["team-analysis.ts", 325_308, "8aa8dc1bbf02382ae42bdf0b8882320140d48fbcbe1b7e8abed627321241f78a"],
        ["team-analysis-artifacts.ts", 4_330, "b29e13ee38b9510945d8090db06a309670c8ee5c603e53028ad0d29fc996bd43"],
        ["team-analysis-delivery.ts", 14_228, "4dcf0c9e12b179b774989b5ea0cced5aaa5bf02fe293b1e60f6fee8fc240d483"],
    ],
    android: [
        ["domain/src/main/java/com/luminay/domain/models/CharacterModel.kt", 4_216, "e5b076c9fb535d6d8c61d3d2cbf55621c9403970b8873f2089589335fe8ee358"],
        ["domain/src/main/java/com/luminay/domain/models/LeaderSkillDetailsModel.kt", 1_114, "42f52039f09e830123f55afa480ac17c9e70cfa0aa2a6e70fcc7c72d5164e76b"],
        ["domain/src/main/java/com/luminay/domain/models/ParsedLeaderSkill.kt", 510, "c4d1d4107b5669b00da095bd4dcd688f7063229924244376de059838b5c3fdd8"],
        ["domain/src/main/java/com/luminay/domain/models/team/LeaderCoverage.kt", 1_930, "6889f228be2fbe5c670250c154c940d8c3936af9e2228245f2e0018817c6111d"],
        ["domain/src/main/java/com/luminay/domain/utils/LeaderCoverageEvaluator.kt", 17_201, "a5c1d6e47a425c74b0d47441b8106f9b5dc4e0499c1d34f8cf24b2ceccbbf7d9"],
        ["domain/src/main/java/com/luminay/domain/startup/RoomCharacterDatabaseGateway.kt", 12_044, "b7681f2ee904c19ec320292288fb77f5345e28831332483467a315dfe729cd96"],
        ["domain/src/main/java/com/luminay/domain/startup/TeamAnalysisManifest.kt", 1_051, "0cedbd5c918a6d131888d7dbf71e11ea2f63699ea894ba0e2f0126e799014590"],
        ["domain/src/main/java/com/luminay/domain/startup/TeamAnalysisWireModels.kt", 30_228, "acf2f62e3091258de282c67041a1dbe1fb12bbddf69f73cac72a467526db2f17"],
        ["domain/src/main/java/com/luminay/domain/models/teamanalysis/TeamAnalysisModels.kt", 15_693, "66b60584fe49a84ffd4eb1517f62fbfd63ca85a8ebaf3f46babaf4bb343f98ef"],
    ],
} as const;

export const CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_DIMENSION_GOLDEN: CharacterLeaderCompatibilityDimensionAssessment[] = [
    { dimension: "state_card_release_identity", classification: "current_model_lossy", affectedReferences: 12_265, reason: "The productive character model has cardId but no exact K61 stateId/sourceStateKey/release-state identity; Team Analysis has card/release fields but no K61 state key." },
    { dimension: "leader_set_effect_occurrence_identity", classification: "additive_contract_required", affectedReferences: 12_265, reason: "Leader set, first-party effect row and source occurrence IDs are absent from productive scraper and Android Leader contracts." },
    { dimension: "structural_mask", classification: "additive_contract_required", affectedReferences: 12_265, reason: "The opaque first-party structural mask has no lossless field in the current text-derived type/class/category model." },
    { dimension: "operation", classification: "directly_representable", affectedReferences: 12_265, reason: "The current Leader contract distinguishes percentage and flat boost forms without needing textual identity." },
    { dimension: "common_modifier", classification: "current_model_lossy", affectedReferences: 12_265, reason: "Current models expand a common modifier into three stat scalars and lose its single first-party identity and provenance." },
    { dimension: "flat_points", classification: "directly_representable", affectedReferences: 12, reason: "Flat HP/ATK/DEF points fit the existing flat boost form and exact numeric range." },
    { dimension: "proportional_percent", classification: "directly_representable", affectedReferences: 12_253, reason: "The numerator divided by 100 maps to the existing percentage boost form for storage, without authorizing final arithmetic." },
    { dimension: "target_team", classification: "directly_representable", affectedReferences: 11_971, reason: "The existing target model can express an unrestricted allies scope; the independent structural selector still requires an additive field." },
    { dimension: "target_super_class", classification: "directly_representable", affectedReferences: 161, reason: "The current class target domain explicitly contains Super." },
    { dimension: "target_extreme_class", classification: "directly_representable", affectedReferences: 133, reason: "The current class target domain explicitly contains Extreme." },
    { dimension: "included_categories", classification: "current_model_lossy", affectedReferences: 7_292, reason: "Current category lists are evaluated as any-match, while K61 filters are source-ordered sequential AND occurrences." },
    { dimension: "excluded_categories", classification: "additive_contract_required", affectedReferences: 4_614, reason: "Current Leader clauses have no structural category-exclusion operation." },
    { dimension: "sequential_and_composition", classification: "additive_contract_required", affectedReferences: 9_038, reason: "The K61 AND-sequential composition and empty identity are absent from current Leader contracts." },
    { dimension: "order", classification: "additive_contract_required", affectedReferences: 12_265, reason: "Current normalized target collections do not preserve first-party effect/filter source order." },
    { dimension: "multiplicity", classification: "additive_contract_required", affectedReferences: 12_265, reason: "Current evaluators normalize and aggregate clauses, so occurrence multiplicity needs a separate evidence contract." },
    { dimension: "provenance", classification: "additive_contract_required", affectedReferences: 12_265, reason: "K56-K61 source lineage and field-scoped first-party provenance have no current Leader wire/domain field." },
    { dimension: "lifecycle_timing", classification: "blocked_unknown", affectedReferences: 12_265, reason: "K55 proves a shared start-turn invocation but recurrence, duration, removal and lifecycle outcomes remain explicitly unknown." },
    { dimension: "missing_runtime_dimensions", classification: "runtime_context_required", affectedReferences: 12_265, reason: "Leader+Friend composition, final stacking, rounding and transformation/death/revive/exchange/standby behavior require runtime context outside K61." },
];
