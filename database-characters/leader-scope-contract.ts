export const CHARACTER_LEADER_SCOPE_CONTRACT_VERSION = "1.0.0" as const;
export const CHARACTER_LEADER_SCOPE_REPORT_LIMIT_BYTES = 64 * 1024;
export const CHARACTER_LEADER_SCOPE_RSS_LIMIT_BYTES = 1024 * 1024 * 1024;
export const CHARACTER_LEADER_SCOPE_SAMPLE_LIMIT = 5 as const;

export const CHARACTER_LEADER_SCOPE_EXCLUDED_STATE_IDS = [
    "card-state:1010900:growth:716",
    "card-state:1010900:growth:717",
    "card-state:1010900:growth:718",
] as const;

export const CHARACTER_LEADER_SCOPE_PIN = {
    k3States: 10_654,
    includedStates: 10_651,
    excludedStates: 3,
    uniqueLeaderSetRows: 3_506,
    effectReferences: 49_435,
    targetReferences: 34_914,
    structuredPercentValues: 9_405,
    multiEffectStates: 10_600,
    multiTargetStates: 5_359,
    multiPercentStates: 2_088,
    maximumEffectsPerState: 18,
    maximumTargetsPerState: 54,
    maximumPercentValuesPerState: 3,
    emptyEffectStates: 2,
    emptyTargetStates: 5_290,
    emptyPercentStates: 3_358,
    k9PassiveC3UnknownRules: 59,
} as const;

export interface CharacterLeaderRowRef { table: string; rowId: string }

export interface CharacterLeaderScopeK3State {
    stateId: string;
    sourceStateKey: string;
    cardId: string;
    releaseState: "initial" | "eza" | "seza" | "unknown";
    leader: {
        set: CharacterLeaderRowRef;
        effects: CharacterLeaderRowRef[];
        targets: CharacterLeaderRowRef[];
        structuredPercentValues: number[];
    };
}

export interface CharacterLeaderScopeK3Identity {
    profileId: string;
    snapshotVersion: string;
    manifest: { sha256: string; sizeBytes: number };
    artifact: { sha256: string; sizeBytes: number; uncompressedSizeBytes: number; uncompressedSha256: string };
    coverage: { sha256: string; sizeBytes: number };
    validation: { sha256: string; sizeBytes: number };
    compactFingerprintSha256: string;
}

export interface CharacterLeaderScopeK3Source {
    identity: CharacterLeaderScopeK3Identity;
    states: CharacterLeaderScopeK3State[];
}

export interface CharacterLeaderScopeK43State {
    stateId: string;
    sourceStateKey: string;
    cardId: string;
    releaseState: "initial" | "eza" | "seza";
}

export interface CharacterLeaderScopeK43Identity {
    manifestSha256: string;
    payloadSha256: string;
    rawSha256: string;
    k42SourceFingerprintSha256: string;
    stateFingerprintSha256: string;
}

export interface CharacterLeaderScopeK43Source {
    identity: CharacterLeaderScopeK43Identity;
    states: CharacterLeaderScopeK43State[];
}

export interface CharacterLeaderScopeEvaluation {
    includedStates: number;
    excludedStates: number;
    excludedStateIds: string[];
    uniqueLeaderSetRows: number;
    effectReferences: number;
    targetReferences: number;
    structuredPercentValues: number;
    multiEffectStates: number;
    multiTargetStates: number;
    multiPercentStates: number;
    maximumEffectsPerState: number;
    maximumTargetsPerState: number;
    maximumPercentValuesPerState: number;
    emptyEffectStates: number;
    emptyTargetStates: number;
    emptyPercentStates: number;
    samples: {
        multiEffectStateIds: string[];
        multiTargetStateIds: string[];
        multiPercentStateIds: string[];
        maximumEffectStateIds: string[];
        maximumTargetStateIds: string[];
        maximumPercentStateIds: string[];
        limitPerKind: typeof CHARACTER_LEADER_SCOPE_SAMPLE_LIMIT;
    };
}

export interface CharacterLeaderScopeReport {
    schemaVersion: 1;
    contract: "dokkan-database-character-leader-structural-scope-audit";
    contractVersion: typeof CHARACTER_LEADER_SCOPE_CONTRACT_VERSION;
    mode: "offline_local_explicit_opt_in_stdout_only";
    sources: { k43: CharacterLeaderScopeK43Identity; k3: CharacterLeaderScopeK3Identity };
    policy: {
        structuralIdsOnly: true;
        presentationIncluded: false;
        rawRowsIncluded: false;
        leaderClauseSemanticsSelected: false;
        k9PassiveBoundaryFiltersLeaderScope: false;
        characterArrayIncluded: false;
        consumerImplemented: false;
        applyOrOverlayImplemented: false;
        authoritySelected: false;
        productionModified: false;
        writerImplemented: false;
        outputArtifactWritten: false;
        publisherImplemented: false;
        networkEnabled: false;
        r2Enabled: false;
        androidImplemented: false;
    };
    scope: CharacterLeaderScopeEvaluation;
    passiveComparisonBoundary: {
        channel: "C2_C3_passive_mechanics_comparison";
        c3UnknownRuleCount: 59;
        usedToFilterLeaderScope: false;
        k9ReadinessChanged: false;
    };
    inputIntegrity: {
        k43SourceBoundBefore: "GO" | "NOT_EXECUTED";
        k43SourceBoundAfter: "GO" | "NOT_EXECUTED";
        k43IdentityAndFingerprintStable: boolean;
        k3ExactPinnedFilesBeforeAndAfter: boolean;
        k3IdentityAndFingerprintStable: boolean;
        k3DecodeBoundedToPinnedRawSize: boolean;
        reportTimestampIncluded: false;
        reportMaximumBytesExclusive: typeof CHARACTER_LEADER_SCOPE_REPORT_LIMIT_BYTES;
        rssMaximumBytesExclusive: typeof CHARACTER_LEADER_SCOPE_RSS_LIMIT_BYTES;
    };
    readiness: {
        structuralScope: "GO" | "NOT_EXECUTED";
        nextStructuralIdOnlyProjection: "GO" | "NOT_EXECUTED";
        leaderClauseOrVsSumSemantics: "NO-GO";
        localizedText: "NO-GO";
        productReplacement: "NO-GO";
        consumer: "NO-GO";
        applyOrOverlay: "NO-GO";
        authority: "NO-GO";
        production: "NO-GO";
        writer: "NO-GO";
        publisher: "NO-GO";
        network: "NO-GO";
        r2: "NO-GO";
        android: "NO-GO";
        fyiRemoval: "NO-GO";
        dokkanInfoRemoval: "NO-GO";
    };
}
