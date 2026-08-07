export type ServerS3Classification = "agreement" | "confirmed_conflict" | "partial_candidate" | "unjoinable";
export type ServerS3Status = "supported" | "partial" | "unknown";

export interface ServerS3ItemIdentity { itemType: string; itemId: string; quantity: number | null }

export interface ServerS3Assessment {
    remoteKey: string;
    eventId: string;
    eventType: string;
    stageId: string | null;
    remoteRewardId: string;
    remoteItem: ServerS3ItemIdentity;
    classification: ServerS3Classification;
    rewardChannel: "drop_candidate" | "first_clear_candidate" | "unknown";
    target: null | {
        family: "quest_boss_drop" | "z_battle_first_reward";
        sourceRowId: string;
        parentId: string;
        parentLevel: number | null;
        firstPartyItem: ServerS3ItemIdentity;
        itemComparison: "agreement" | "conflict";
        quantityComparison: "not_comparable" | "agreement" | "conflict";
    };
    boundary: string;
}

export interface ServerS3RewardChannel {
    channel: "preview" | "drop" | "first_clear" | "mission" | "ranking" | "server_grant";
    rowCount: number;
    identityStatus: ServerS3Status;
    semanticStatus: ServerS3Status;
    sources: string[];
    boundary: string;
}

export interface ServerS3SourceLineage {
    key: "events_e5" | "events_e7" | "dokkaninfo_event_rewards" | "dokkaninfo_reward_parser";
    path: string;
    sha256: string;
    sizeBytes: number;
    authority: "sqlite_first_party" | "community_shadow" | "repository_implementation";
    fetchedAt: string | null;
}

export interface ServerS3Dataset {
    schemaVersion: 1;
    contract: "dokkan-server-reward-identity";
    contractVersion: "0.4.0";
    generatedAt: string;
    generatedAtPolicy: "pinned_to_static_evidence_checkpoint";
    sourceSnapshotVersion: string;
    collectionMode: "local_validated_artifacts_no_network";
    authorityPolicy: {
        staticRewardIdentity: "sqlite_first_party";
        remoteRows: "community_shadow";
        structuralIdsOnly: true;
        titleJoinAllowed: false;
        remoteQuantityPromotedWhenFirstPartyMissing: false;
        chanceOrRepeatabilityInferred: false;
        legacyRewardIdentityOrigin: "unknown_payload_id_or_synthetic_index";
        normalizedRowCollisionStatus: "unknown";
        normalizedRowsLossless: false;
    };
    sourceLineage: ServerS3SourceLineage[];
    channels: ServerS3RewardChannel[];
    assessments: ServerS3Assessment[];
}

export interface ServerS3Coverage {
    schemaVersion: 1;
    normalizedRemoteRewardCount: number;
    rawRemoteRewardCount: null;
    possibleCollisionCount: null;
    byClassification: Record<ServerS3Classification, number>;
    byEventType: Record<string, { total: number; agreement: number; confirmedConflict: number; partialCandidate: number; unjoinable: number }>;
    supportedQuestDropJoinCount: number;
    traditionalCandidateCount: number;
    traditionalCandidateItemAgreementCount: number;
    traditionalCandidateItemConflictCount: number;
    zBattleCandidateCount: number;
    zBattleCandidateQuantityAgreementCount: number;
    zBattleCandidateQuantityConflictCount: number;
    titleJoinCount: 0;
    chanceInferenceCount: 0;
    repeatabilityInferenceCount: 0;
    networkRequestCount: 0;
}

export interface ServerS3Validation {
    schemaVersion: 1;
    valid: boolean;
    exactNormalizedArtifactAccounting: boolean;
    losslessRemoteAccountingProven: false;
    exclusiveClassifications: boolean;
    staticAuthorityPreserved: boolean;
    unknownSemanticsPreserved: boolean;
    failures: string[];
}

export interface ServerS3Manifest {
    schemaVersion: 1;
    contractVersion: "0.4.0";
    generatedAt: string;
    generatedAtPolicy: "pinned_to_static_evidence_checkpoint";
    fileName: "server-s3-reward-joins.json";
    compression: "none";
    sha256: string;
    sizeBytes: number;
    sourceSnapshotVersion: string;
    sourceLineageAggregateSha256: string;
    coverage: { fileName: "server-s3-coverage.json"; sha256: string; sizeBytes: number };
    validation: { fileName: "server-s3-validation.json"; sha256: string; sizeBytes: number };
}

export interface ServerS3Observation {
    sourceSnapshotVersion: string;
    sourceLineage: ServerS3SourceLineage[];
    questBossDrops: Array<{ identity: { id: string }; mapId: string; reward: { item: { rawType: string; itemId: string }; quantity: number | null } }>;
    questDropPreviewCount: number;
    zFirstAnchors: Array<{ stageId: string; level: number; rewardSetId: string }>;
    zFirstSets: Array<{ rewardSetId: string; rewards: Array<{ sourceRowId: string; value: { item: { rawType: string; itemId: string }; quantity: number | null } }> }>;
    channelCounts: { questBossDrops: number; zFirstRewards: number; zNormalRewards: number; missionRewards: number; rankingRewards: number };
    remoteEvents: Array<{ id: string; type: string; rewards: Array<{ key: string; itemId: string; itemType: string; quantity: number; eventId: string; eventType: string; stageId?: string }> }>;
    declaredRemoteRewardCount: number;
}
