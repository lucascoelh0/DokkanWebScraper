import { CHARACTER_SOURCE_PROFILE } from "./source";
import { CHARACTER_STRUCTURAL_SIDECAR_SOURCE_PIN } from "./structural-sidecar-contract";

export const CARD_SCOPE_CONTRACT_VERSION = "1.0.0" as const;
export const CARD_SCOPE_MAX_EXAMPLES_PER_REASON = 5;
export const CARD_SCOPE_RSS_LIMIT_BYTES = 1024 * 1024 * 1024;
export const CARD_SCOPE_EXPECTED_COUNTS = {
    cardCount: 5_759,
    growthStateCount: 4_895,
    distinctGrowthRowCount: 4_874,
    categoryAssignmentCount: 54_072,
    linkAssignmentCount: 34_018,
    nativeCodeRegionCount: 26,
    nativeDirectCallCount: 16,
    nativeRelocationCount: 17,
} as const;

export const CARD_SCOPE_FILES = {
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
} as const;

export const CARD_SCOPE_SOURCE_PIN = {
    profileId: "global-6.4.0-v338-2026-08-05-card-scope-k34-v1",
    snapshotVersion: CHARACTER_SOURCE_PROFILE.snapshotVersion,
    sqlite: {
        sha256: CHARACTER_SOURCE_PROFILE.databaseSha256,
        sizeBytes: CHARACTER_SOURCE_PROFILE.databaseSizeBytes,
        tableCount: 232,
    },
    db1: {
        sha256: CHARACTER_SOURCE_PROFILE.db1ArtifactSha256,
        sizeBytes: CHARACTER_SOURCE_PROFILE.db1ArtifactSizeBytes,
        uncompressedSizeBytes: CHARACTER_SOURCE_PROFILE.db1UncompressedSizeBytes,
        cardCount: CHARACTER_SOURCE_PROFILE.db1CardCount,
    },
    k2: { ...CHARACTER_STRUCTURAL_SIDECAR_SOURCE_PIN.k2 },
    elf: {
        sha256: "7d6c2c1e095fc20a71ec4764e88a17b4d4b82f3f12952b9ba8c6eb0405a7215a",
        sizeBytes: 95_662_296,
        format: "ELF64-LE-AArch64",
    },
    nativeLayout: {
        sha256: "463dc1c5405a14a32efd4d024dfcae01c146801d746b4e2e2ddb9297e677eb68",
        sizeBytes: 761,
    },
} as const;

export const CARD_SCOPE_TABLE_LAYOUTS = {
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
} as const;

export const CARD_SCOPE_DB1_LAYOUTS = {
    cards: [
        "id", "name", "character_id", "card_unique_info_id", "cost", "rarity", "hp_init", "hp_max", "atk_init", "atk_max", "def_init", "def_max",
        "element", "lv_max", "skill_lv_max", "optimal_awakening_grow_type", "passive_skill_set_id", "leader_skill_set_id", "link_skill1_id",
        "link_skill2_id", "link_skill3_id", "link_skill4_id", "link_skill5_id", "link_skill6_id", "link_skill7_id", "collectable_type",
        "is_selling_only", "resource_id", "potential_board_id", "open_at", "created_at", "updated_at",
    ],
    card_card_categories: CARD_SCOPE_TABLE_LAYOUTS.card_card_categories,
    card_categories: ["id", "name", "kana", "priority", "open_at", "created_at", "updated_at"],
    link_skills: ["id", "name", "kana", "description", "created_at", "updated_at"],
    optimal_awakening_growths: CARD_SCOPE_TABLE_LAYOUTS.optimal_awakening_growths,
} as const;

export type CardScopeDimension = "characterClass" | "categories" | "links";
export type CardScopeEvidenceStatus = "supported" | "partial" | "unknown";

export interface CardScopeSchemaProof {
    status: "supported";
    tableCount: number;
    cardsColumns: string[];
    categoryRelationColumns: string[];
    optimalAwakeningGrowthColumns: string[];
    replacementColumns: Record<CardScopeDimension, string[]>;
}

export interface CardScopeJoinProof {
    status: "supported";
    db1CardCount: number;
    k2CardCount: number;
    joinedCardCount: number;
    growthStateCount: number;
    distinctGrowthRowCount: number;
    categoryAssignmentCount: number;
    linkAssignmentCount: number;
    duplicateCardIdCount: 0;
    missingCardJoinCount: 0;
    duplicateCategoryRelationIdCount: 0;
    missingCategoryJoinCount: 0;
    duplicateLinkSlotCount: 0;
    missingLinkJoinCount: 0;
    identityPolicy: "structural_ids_only_no_names_or_labels";
}

export interface CardScopeNativeDimensionProof {
    status: CardScopeEvidenceStatus;
    reasons: string[];
    proofRoles: string[];
}

export interface CardScopeNativeProof {
    status: CardScopeEvidenceStatus;
    sourceSha256: string;
    sourceSizeBytes: number;
    layoutSha256: string;
    codeRegionCount: number;
    directCallCount: number;
    relocationCount: number;
    dimensions: Record<CardScopeDimension, CardScopeNativeDimensionProof>;
}

export interface CardScopeDimensionDecision {
    schemaStatus: CardScopeEvidenceStatus;
    db1K2Status: CardScopeEvidenceStatus;
    nativeStatus: CardScopeEvidenceStatus;
    stability: CardScopeEvidenceStatus;
    conclusion: "stable_for_exact_pinned_profile" | "not_fully_proved";
    reasons: string[];
    authority: "NO-GO";
}

export interface DatabaseCharacterCardScopeReport {
    schemaVersion: 1;
    contract: "dokkan-database-characters-card-scope-audit";
    contractVersion: typeof CARD_SCOPE_CONTRACT_VERSION;
    profileId: typeof CARD_SCOPE_SOURCE_PIN.profileId;
    execution: {
        mode: "explicit_opt_in_offline_report_only";
        decision: "GO";
        stdoutOnly: true;
        maxExamplesPerReason: typeof CARD_SCOPE_MAX_EXAMPLES_PER_REASON;
        rssLimitBytesExclusive: typeof CARD_SCOPE_RSS_LIMIT_BYTES;
    };
    provenance: {
        snapshotVersion: string;
        sqlite: { fileName: string; sha256: string; sizeBytes: number };
        db1: { fileName: string; sha256: string; sizeBytes: number; uncompressedSizeBytes: number };
        k2: { fileName: string; manifestSha256: string; payloadSha256: string; payloadSizeBytes: number };
        nativeRuntime: { fileName: string; sha256: string; sizeBytes: number; format: string };
        nativeEvidence: { fileName: string; sha256: string; sizeBytes: number };
    };
    policy: {
        identity: "card_id_and_row_id_only";
        namesOrLabelsAsIdentity: false;
        absentReplacementColumnsAloneProveStability: false;
        productiveStateBinding: "unavailable";
        mutationSurface: "none";
    };
    schemaProof: CardScopeSchemaProof;
    joinProof: CardScopeJoinProof;
    nativeProof: CardScopeNativeProof;
    dimensions: Record<CardScopeDimension, CardScopeDimensionDecision>;
    gates: {
        reportExecution: "GO";
        productiveAuthority: "NO-GO";
        applyOrCharacterMutation: "NO-GO";
        publisherOrR2: "NO-GO";
        android: "NO-GO";
        fyiRemoval: "NO-GO";
        dokkanInfoRemoval: "NO-GO";
    };
    residualUnknowns: string[];
}
