import { IntegrationC3Classification } from "../database-integration/integration-c3-contract";

export type CharacterParityClassification = IntegrationC3Classification;
export type CharacterParitySource = "production" | "fyi";

export const CHARACTER_PARITY_AUDIT_ISSUES = [
    "z_awakened_duplicates",
    "original_rarity",
    "portraits_incomplete_or_incorrect",
    "leader_or_vs_sum",
    "flat_boost_vs_percent",
    "name_tag_transformation_linking",
    "standby_finish_transformation_chains",
    "ex_attacks",
    "entrance_animation_grouping",
    "eza_seza_base_selection",
    "ids_forms_without_join",
    "auxiliary_states",
] as const;

export type CharacterParityAuditIssue = typeof CHARACTER_PARITY_AUDIT_ISSUES[number];

export const CHARACTER_PARITY_UPSTREAM_PROFILE = {
    k1: {
        artifactSha256: "babe3061921a886271bceeb189bdc2f519e9dcf75104c9c759d8213300c6439e",
        artifactSizeBytes: 329_730,
        coverageSha256: "80dd0f0fab406864bc702b12409f0d7fef177e2f76cfbe2aeb2b373c1fee9789",
        stateCount: 10_654,
        zAwakenTransitionCount: 1_487,
        formTransitionCount: 558,
    },
    k2: {
        artifactSha256: "af1c84eb0d030fbf389ea0f1f5590e5f643234e2d6348bcc64fe2ffab4718b37",
        artifactSizeBytes: 511_837,
        coverageSha256: "f82d599b5507fa01cd83c1079779eb504ee739ea892037e279294ba77f65eba9",
        cardCount: 5_759,
    },
    k3: {
        artifactSha256: "6a9c18ae74e5e5e052615d75abbfa900337ea9eebfe0262d0943213f6afd03e0",
        artifactSizeBytes: 2_707_309,
        coverageSha256: "36f79c5266dc05e48663bd6f756e561c16e680867a24754d5de2641dccb5f019",
        exAttackCount: 20,
    },
    k6: {
        artifactSha256: "743b9128ba3b708a4ead6b436c7f6aa71f6885f29f7336fb91972bf7e09089a1",
        artifactSizeBytes: 901_984,
        coverageSha256: "8a3de274c1969dd1530257060be81e6a30d1515df3775ee9ba376d88d80f1892",
        firstPartyResourceIdCount: 75,
        missingCardResourceCount: 5_684,
    },
} as const;

export interface CharacterParityConflict {
    field: string;
    databaseValue: unknown;
    externalValue: unknown;
}

export interface CharacterComparisonState {
    stateKey: string | null;
    releaseState: string | null;
    availableAt: string | null;
    availableAtSnapshot: boolean | null;
    progressionStep: number | null;
    growthStepSource: { table: string; rowId: string } | null;
    selectionPolicy: "initial_state" | "highest_released_progression_at_external_snapshot";
    comparable: boolean;
}

export interface CharacterExternalParity {
    identity: "agreement" | "unjoinable";
    comparisonState: CharacterComparisonState;
    agreementFields: string[];
    representationGains: string[];
    conflicts: CharacterParityConflict[];
    unknownFields: string[];
    externalFormIds: string[];
}

export interface CharacterParityRecord {
    cardId: string;
    recordKind: "collectable" | "form";
    production: CharacterExternalParity;
    fyi: CharacterExternalParity;
}

export interface CharacterHistoricalAudit {
    issue: CharacterParityAuditIssue;
    classification: CharacterParityClassification;
    basis: string;
    counts: Record<string, number>;
    sourceSidecars: Array<"k1" | "k2" | "k3" | "k6" | "c3" | "k7">;
}

export interface CharacterParityUpstreamSidecar {
    artifactSha256: string;
    coverageSha256: string;
}

export interface DatabaseCharacterParityDataset {
    schemaVersion: 1;
    contract: "dokkan-database-characters-shadow-parity";
    contractVersion: "1.1.0";
    generatedAt: string;
    source: {
        snapshotVersion: string;
        db1ArtifactSha256: string;
        productionCharacters: { sha256: string; sizeBytes: number; characterCount: number; contract: "legacy-dokkaninfo-character-json"; asOf: "unversioned_content_hash_only" };
        fyiCharacters: { sha256: string; sizeBytes: number; characterCount: number; generatedAt: string; contract: "fyi-current-released-state" };
        teamAnalysis: { sha256: string; stateCount: number };
        c3Shadow: { sha256: string; ruleCount: number };
        upstreamSidecars: { k1: CharacterParityUpstreamSidecar; k2: CharacterParityUpstreamSidecar; k3: CharacterParityUpstreamSidecar; k6: CharacterParityUpstreamSidecar };
        dokkanInfoCharacterCache: "absent";
    };
    policy: {
        structuralIdsOnly: true;
        textJoin: false;
        productionModified: false;
        externalParserAuthoritative: false;
        incomparableDomainsBecomeUnknown: true;
    };
    cards: CharacterParityRecord[];
    teamAnalysisClassificationCounts: Record<CharacterParityClassification, number>;
    historicalAudits: CharacterHistoricalAudit[];
}

export interface DatabaseCharacterParityCoverage {
    schemaVersion: 1;
    cardCount: number;
    productionJoinedCount: number;
    productionUnjoinableCount: number;
    fyiJoinedCount: number;
    fyiUnjoinableCount: number;
    agreementFieldCount: number;
    representationGainCount: number;
    confirmedConflictCount: number;
    unknownFieldCount: number;
    c3ClassificationCounts: Record<CharacterParityClassification, number>;
    historicalAuditCount: number;
    duplicateHistoricalAuditCount: number;
    duplicateCardIdentityCount: number;
}

export interface DatabaseCharacterParityValidation {
    schemaVersion: 1;
    valid: boolean;
    failures: string[];
}
