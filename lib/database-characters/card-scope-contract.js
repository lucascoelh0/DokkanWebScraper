"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CARD_SCOPE_DB1_LAYOUTS = exports.CARD_SCOPE_TABLE_LAYOUTS = exports.CARD_SCOPE_SOURCE_PIN = exports.CARD_SCOPE_FILES = exports.CARD_SCOPE_EXPECTED_COUNTS = exports.CARD_SCOPE_RSS_LIMIT_BYTES = exports.CARD_SCOPE_MAX_EXAMPLES_PER_REASON = exports.CARD_SCOPE_CONTRACT_VERSION = void 0;
const source_1 = require("./source");
const structural_sidecar_contract_1 = require("./structural-sidecar-contract");
exports.CARD_SCOPE_CONTRACT_VERSION = "1.0.0";
exports.CARD_SCOPE_MAX_EXAMPLES_PER_REASON = 5;
exports.CARD_SCOPE_RSS_LIMIT_BYTES = 1024 * 1024 * 1024;
exports.CARD_SCOPE_EXPECTED_COUNTS = {
    cardCount: 5759,
    growthStateCount: 4895,
    distinctGrowthRowCount: 4874,
    categoryAssignmentCount: 54072,
    linkAssignmentCount: 34018,
    nativeCodeRegionCount: 26,
    nativeDirectCallCount: 16,
    nativeRelocationCount: 17,
};
exports.CARD_SCOPE_FILES = {
    sqlite: "dokkan-global-current.db",
    db1Manifest: "manifest.json",
    db1SourceManifest: "source-manifest.json",
    db1Payload: "characters-db-experiment.json.gz",
    k2Manifest: "database-characters-k2-manifest.json",
    k2Payload: "database-characters-k2-taxonomy.json.gz",
    k2Coverage: "database-characters-k2-coverage.json",
    k2Validation: "database-characters-k2-validation.json",
    elf: "libcocos2dcpp.so",
    nativeLayout: "native-runtime-layout.json",
};
exports.CARD_SCOPE_SOURCE_PIN = {
    profileId: "global-6.4.0-v338-2026-08-05-card-scope-k34-v1",
    snapshotVersion: source_1.CHARACTER_SOURCE_PROFILE.snapshotVersion,
    sqlite: {
        sha256: source_1.CHARACTER_SOURCE_PROFILE.databaseSha256,
        sizeBytes: source_1.CHARACTER_SOURCE_PROFILE.databaseSizeBytes,
        tableCount: 232,
    },
    db1: {
        sha256: source_1.CHARACTER_SOURCE_PROFILE.db1ArtifactSha256,
        sizeBytes: source_1.CHARACTER_SOURCE_PROFILE.db1ArtifactSizeBytes,
        uncompressedSizeBytes: source_1.CHARACTER_SOURCE_PROFILE.db1UncompressedSizeBytes,
        cardCount: source_1.CHARACTER_SOURCE_PROFILE.db1CardCount,
    },
    k2: { ...structural_sidecar_contract_1.CHARACTER_STRUCTURAL_SIDECAR_SOURCE_PIN.k2 },
    elf: {
        sha256: "7d6c2c1e095fc20a71ec4764e88a17b4d4b82f3f12952b9ba8c6eb0405a7215a",
        sizeBytes: 95662296,
        format: "ELF64-LE-AArch64",
    },
    nativeLayout: {
        sha256: "463dc1c5405a14a32efd4d024dfcae01c146801d746b4e2e2ddb9297e677eb68",
        sizeBytes: 761,
    },
};
exports.CARD_SCOPE_TABLE_LAYOUTS = {
    cards: [
        "id", "name", "character_id", "card_unique_info_id", "cost", "rarity", "hp_init", "hp_max", "atk_init", "atk_max", "def_init", "def_max",
        "element", "lv_max", "skill_lv_max", "grow_type", "optimal_awakening_grow_type", "price", "exp_type", "training_exp", "special_motion",
        "passive_skill_set_id", "leader_skill_set_id", "link_skill1_id", "link_skill2_id", "link_skill3_id", "link_skill4_id", "link_skill5_id",
        "link_skill6_id", "link_skill7_id", "eball_mod_min", "eball_mod_num100", "eball_mod_mid", "eball_mod_mid_num", "eball_mod_max",
        "eball_mod_max_num", "max_level_reward_id", "max_level_reward_type", "collectable_type", "face_x", "face_y", "aura_id", "aura_scale",
        "aura_offset_x", "aura_offset_y", "is_aura_front", "is_selling_only", "awakening_number", "resource_id", "bg_effect_id",
        "selling_exchange_point", "awakening_element_type", "potential_board_id", "open_at", "created_at", "updated_at",
    ],
    card_card_categories: ["id", "card_id", "card_category_id", "num", "created_at", "updated_at"],
    optimal_awakening_growths: ["id", "optimal_awakening_grow_type", "step", "lv_max", "skill_lv_max", "passive_skill_set_id", "leader_skill_set_id"],
};
exports.CARD_SCOPE_DB1_LAYOUTS = {
    cards: [
        "id", "name", "character_id", "card_unique_info_id", "cost", "rarity", "hp_init", "hp_max", "atk_init", "atk_max", "def_init", "def_max",
        "element", "lv_max", "skill_lv_max", "optimal_awakening_grow_type", "passive_skill_set_id", "leader_skill_set_id", "link_skill1_id",
        "link_skill2_id", "link_skill3_id", "link_skill4_id", "link_skill5_id", "link_skill6_id", "link_skill7_id", "collectable_type",
        "is_selling_only", "resource_id", "potential_board_id", "open_at", "created_at", "updated_at",
    ],
    card_card_categories: exports.CARD_SCOPE_TABLE_LAYOUTS.card_card_categories,
    card_categories: ["id", "name", "kana", "priority", "open_at", "created_at", "updated_at"],
    link_skills: ["id", "name", "kana", "description", "created_at", "updated_at"],
    optimal_awakening_growths: exports.CARD_SCOPE_TABLE_LAYOUTS.optimal_awakening_growths,
};
//# sourceMappingURL=card-scope-contract.js.map