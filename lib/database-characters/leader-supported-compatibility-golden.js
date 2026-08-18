"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_DIMENSION_GOLDEN = exports.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_ANDROID_SOURCE_PIN = exports.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_SOURCE_PINS = void 0;
exports.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_SOURCE_PINS = {
    scraper: [
        ["character.ts", 14959, "583adccdd75006e8ff01ac840305924abdfb7619d9986a7a1d984a5ea4e71f0b"],
        ["scraper.ts", 72543, "8cff1e8e7218f7c161020c31246c8a75a47a30f7ba58be745dd30f2d376c9009"],
        ["team-analysis.ts", 325308, "8aa8dc1bbf02382ae42bdf0b8882320140d48fbcbe1b7e8abed627321241f78a"],
        ["team-analysis-artifacts.ts", 4330, "b29e13ee38b9510945d8090db06a309670c8ee5c603e53028ad0d29fc996bd43"],
        ["team-analysis-delivery.ts", 14228, "4dcf0c9e12b179b774989b5ea0cced5aaa5bf02fe293b1e60f6fee8fc240d483"],
    ],
};
exports.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_ANDROID_SOURCE_PIN = {
    repositoryUrl: "https://github.com/lucascoelh0/Dokkanpanion.git",
    commit: "5afa5ee3de25755c9fffdfcd2f1fc3293d56b26a",
    files: [
        { path: "domain/src/main/java/com/luminay/domain/models/CharacterModel.kt", blobId: "d38b261714a9fc67f08cefbe146c03d0b18264a6", sizeBytes: 4127, sha256: "e1ab8d11fc4d5f402b57653f13f55f9a6fa68ed1c6e82ce05d10faee96298cd7" },
        { path: "domain/src/main/java/com/luminay/domain/models/LeaderSkillDetailsModel.kt", blobId: "bac4997dabaf3db783f3d934ca2a29720d1fa939", sizeBytes: 1101, sha256: "c16cbf0f82862f700f68c6c77c4d30c5389439bea299cfdc38f845b08d74a228" },
        { path: "domain/src/main/java/com/luminay/domain/models/ParsedLeaderSkill.kt", blobId: "f7f1a83c35afd17bd7a358686d8e703e73147d50", sizeBytes: 490, sha256: "520ad50c9b4e05f004a966557b0c5b1dd12664c6d18ef328815f9a1a19f46735" },
        { path: "domain/src/main/java/com/luminay/domain/models/team/LeaderCoverage.kt", blobId: "201b56d283a5a14ed4ced1e64e64af795f08362e", sizeBytes: 1930, sha256: "6889f228be2fbe5c670250c154c940d8c3936af9e2228245f2e0018817c6111d" },
        { path: "domain/src/main/java/com/luminay/domain/utils/LeaderCoverageEvaluator.kt", blobId: "33d1f7adf512abcffd4251f05bde050550f60881", sizeBytes: 17201, sha256: "a5c1d6e47a425c74b0d47441b8106f9b5dc4e0499c1d34f8cf24b2ceccbbf7d9" },
        { path: "domain/src/main/java/com/luminay/domain/startup/RoomCharacterDatabaseGateway.kt", blobId: "1e14e40e0c0ecb614131a1b65fc761632ce347f9", sizeBytes: 13695, sha256: "1db369fd1404302e111035aec0ba2a52e6b33a1251d1f430e4db34df039fbf64" },
        { path: "domain/src/main/java/com/luminay/domain/startup/TeamAnalysisManifest.kt", blobId: "3ccaff9c39ec37d929f267bb86d2d35e4f310bb0", sizeBytes: 1051, sha256: "0cedbd5c918a6d131888d7dbf71e11ea2f63699ea894ba0e2f0126e799014590" },
        { path: "domain/src/main/java/com/luminay/domain/startup/TeamAnalysisWireModels.kt", blobId: "c122f3bfb2cbd4f2cf13a768c7ea2e8d854e937b", sizeBytes: 30228, sha256: "acf2f62e3091258de282c67041a1dbe1fb12bbddf69f73cac72a467526db2f17" },
        { path: "domain/src/main/java/com/luminay/domain/models/teamanalysis/TeamAnalysisModels.kt", blobId: "9060450a447475e6cbc01dc99af392d26fae4919", sizeBytes: 15693, sha256: "66b60584fe49a84ffd4eb1517f62fbfd63ca85a8ebaf3f46babaf4bb343f98ef" },
    ],
};
exports.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_DIMENSION_GOLDEN = [
    { dimension: "state_card_release_identity", classification: "current_model_lossy", affectedReferences: 12265, reason: "The productive character model has cardId but no exact K61 stateId/sourceStateKey/release-state identity; Team Analysis has card/release fields but no K61 state key." },
    { dimension: "leader_set_effect_occurrence_identity", classification: "additive_contract_required", affectedReferences: 12265, reason: "Leader set, first-party effect row and source occurrence IDs are absent from productive scraper and Android Leader contracts." },
    { dimension: "structural_mask", classification: "additive_contract_required", affectedReferences: 12265, reason: "The opaque first-party structural mask has no lossless field in the current text-derived type/class/category model." },
    { dimension: "operation", classification: "directly_representable", affectedReferences: 12265, reason: "The current Leader contract distinguishes percentage and flat boost forms without needing textual identity." },
    { dimension: "common_modifier", classification: "current_model_lossy", affectedReferences: 12265, reason: "Current models expand a common modifier into three stat scalars and lose its single first-party identity and provenance." },
    { dimension: "flat_points", classification: "directly_representable", affectedReferences: 12, reason: "Flat HP/ATK/DEF points fit the existing flat boost form and exact numeric range." },
    { dimension: "proportional_percent", classification: "directly_representable", affectedReferences: 12253, reason: "The numerator divided by 100 maps to the existing percentage boost form for storage, without authorizing final arithmetic." },
    { dimension: "target_team", classification: "directly_representable", affectedReferences: 11971, reason: "The existing target model can express an unrestricted allies scope; the independent structural selector still requires an additive field." },
    { dimension: "target_super_class", classification: "directly_representable", affectedReferences: 161, reason: "The current class target domain explicitly contains Super." },
    { dimension: "target_extreme_class", classification: "directly_representable", affectedReferences: 133, reason: "The current class target domain explicitly contains Extreme." },
    { dimension: "included_categories", classification: "current_model_lossy", affectedReferences: 7292, reason: "Current category lists are evaluated as any-match, while K61 filters are source-ordered sequential AND occurrences." },
    { dimension: "excluded_categories", classification: "additive_contract_required", affectedReferences: 4614, reason: "Current Leader clauses have no structural category-exclusion operation." },
    { dimension: "sequential_and_composition", classification: "additive_contract_required", affectedReferences: 9038, reason: "The K61 AND-sequential composition and empty identity are absent from current Leader contracts." },
    { dimension: "order", classification: "additive_contract_required", affectedReferences: 12265, reason: "Current normalized target collections do not preserve first-party effect/filter source order." },
    { dimension: "multiplicity", classification: "additive_contract_required", affectedReferences: 12265, reason: "Current evaluators normalize and aggregate clauses, so occurrence multiplicity needs a separate evidence contract." },
    { dimension: "provenance", classification: "additive_contract_required", affectedReferences: 12265, reason: "K56-K61 source lineage and field-scoped first-party provenance have no current Leader wire/domain field." },
    { dimension: "lifecycle_timing", classification: "blocked_unknown", affectedReferences: 12265, reason: "K55 proves a shared start-turn invocation but recurrence, duration, removal and lifecycle outcomes remain explicitly unknown." },
    { dimension: "missing_runtime_dimensions", classification: "runtime_context_required", affectedReferences: 12265, reason: "Leader+Friend composition, final stacking, rounding and transformation/death/revive/exchange/standby behavior require runtime context outside K61." },
];
//# sourceMappingURL=leader-supported-compatibility-golden.js.map