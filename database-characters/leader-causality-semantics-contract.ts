import type { CharacterLeaderValueK3Identity, CharacterLeaderValueK48Identity } from "./leader-value-scope-contract";

export const CHARACTER_LEADER_CAUSALITY_SEMANTICS_CONTRACT_VERSION = "1.0.0" as const;
export const CHARACTER_LEADER_CAUSALITY_SEMANTICS_REPORT_LIMIT_BYTES = 64 * 1024;
export const CHARACTER_LEADER_CAUSALITY_SEMANTICS_RSS_LIMIT_BYTES = 1024 * 1024 * 1024;
export const CHARACTER_LEADER_CAUSALITY_PIN = {
    type82NonNullRows: 17,
    k48References: 45,
    scalarExpressions: 12,
    conjunctionExpressions: 5,
    leafOccurrences: 22,
    referencedIds: ["196", "197", "1562", "1563", "3591", "3592"],
    idOccurrences: { "196": 8, "197": 2, "1562": 1, "1563": 1, "3591": 5, "3592": 5 },
    masks: { "196": 126976, "197": 4063232, "1562": 126976, "1563": 4063232, "3591": 96, "3592": 31 },
    k3CausalityInputFingerprintSha256: "c0a4050845a2a31bc239320e773b0221c7dba93765545e0ddb5ab5670e7554ce",
    databaseRowsFingerprintSha256: "c23ca59b1edc8479f79ed08d62bcc6066b418c0adbe5e0df5b07df97707c9ab7",
    databaseSha256: "3654eb7db9e18dfe4c238abd02bcc06a688ffa6f30aa1ad93fd108dcfeb78265",
    databaseSizeBytes: 95_428_608,
    nativeSha256: "7d6c2c1e095fc20a71ec4764e88a17b4d4b82f3f12952b9ba8c6eb0405a7215a",
    nativeSizeBytes: 95_662_296,
    nativeEvidenceSha256: "61c0645084a1e12436e508c4a3526a79e7a3e505740086cb14e5c6c6b643aab1",
    nativeEvidenceSizeBytes: 6_070,
    nativeCodeRegions: 7,
    nativeExactCalls: 7,
} as const;

export type CharacterLeaderCausalityExpression = number | ["&", number, number];
export interface CharacterLeaderCausalityEffect {
    rowId: string;
    expression: CharacterLeaderCausalityExpression;
}
export interface CharacterLeaderCausalityK3Identity extends CharacterLeaderValueK3Identity {
    causalityInputFingerprintSha256: string;
}
export interface CharacterLeaderCausalityK3Source {
    identity: CharacterLeaderCausalityK3Identity;
    effects: CharacterLeaderCausalityEffect[];
    missingReferencedRowIds: string[];
}
export interface CharacterLeaderCausalityDatabaseRow {
    id: string;
    causalityType: number;
    cauVal1: number;
    cauVal2: number;
    cauVal3: number;
}
export interface CharacterLeaderCausalityDatabaseIdentity {
    sha256: string;
    sizeBytes: number;
    rowsFingerprintSha256: string;
    descriptorBoundReadOnly: true;
}
export interface CharacterLeaderCausalityDatabaseSource {
    identity: CharacterLeaderCausalityDatabaseIdentity;
    rows: CharacterLeaderCausalityDatabaseRow[];
}
export interface CharacterLeaderCausalityNativeProof {
    elfSha256: string;
    elfSizeBytes: number;
    evidenceSha256: string;
    evidenceSizeBytes: number;
    codeRegionCount: number;
    exactCallCount: number;
    executionChainBound: true;
    type35DispatchBound: true;
    onlyCauVal1Read: true;
    bitRangeInclusive: [0, 31];
    humanBitNamesBound: false;
    partySelectionContextBound: false;
    lifecycleBound: false;
    stackingBound: false;
}
export interface CharacterLeaderCausalityEvaluation {
    type82NonNullRows: number;
    k48References: number;
    scalarExpressions: number;
    conjunctionExpressions: number;
    leafOccurrences: number;
    referencedIds: string[];
    idOccurrences: Record<string, number>;
    masks: Record<string, number>;
    k3MissingReferencedRows: string[];
    separatelyBoundDatabaseRows: number;
    missingK48EffectRows: number;
    missingDatabaseRows: number;
    unsupportedExpressions: number;
    causalityTypeMismatches: number;
    unusedValueMismatches: number;
}
export interface CharacterLeaderCausalitySemanticsReport {
    schemaVersion: 1;
    contract: "dokkan-database-character-leader-causality-semantics-audit";
    contractVersion: typeof CHARACTER_LEADER_CAUSALITY_SEMANTICS_CONTRACT_VERSION;
    mode: "offline_local_explicit_opt_in_stdout_only";
    sources: {
        k48: CharacterLeaderValueK48Identity;
        k3: CharacterLeaderCausalityK3Identity;
        database: CharacterLeaderCausalityDatabaseIdentity;
        native: CharacterLeaderCausalityNativeProof;
    };
    scope: CharacterLeaderCausalityEvaluation;
    semantics: {
        compiledScalar: "single_predicate";
        compiledAmpersand: "both_predicates_required";
        type35: "each_requested_bit_witnessed_by_an_eligible_card";
    };
    policy: {
        structuralConditionEvidenceOnly: true;
        k3OmissionDisclosed: true;
        sqliteSeparatelyBoundToExactFirstPartySnapshot: true;
        sourceTextReadForIdentityOrJoin: false;
        sourceTextIncluded: false;
        humanBitNamesDerived: false;
        partySelectionContextDerived: false;
        lifecycleDerived: false;
        stackingDerived: false;
        payloadWritten: false;
        authoritySelected: false;
        productionModified: false;
        networkEnabled: false;
        r2Enabled: false;
        androidImplemented: false;
    };
    inputIntegrity: {
        k48SourceBoundBefore: "GO" | "NOT_EXECUTED";
        k48SourceBoundAfter: "GO" | "NOT_EXECUTED";
        k48K3DatabaseAndNativeStable: boolean;
        databaseDescriptorBoundReadOnly: boolean;
        reportTimestampIncluded: false;
        reportMaximumBytesExclusive: typeof CHARACTER_LEADER_CAUSALITY_SEMANTICS_REPORT_LIMIT_BYTES;
        rssMaximumBytesExclusive: typeof CHARACTER_LEADER_CAUSALITY_SEMANTICS_RSS_LIMIT_BYTES;
        rssStayedBelowExclusiveLimit: boolean;
    };
    readiness: {
        leaderCausalityStructuralSemantics: "GO" | "NOT_EXECUTED";
        type35StructuralCondition: "GO" | "NOT_EXECUTED";
        humanBitNames: "NO-GO";
        partySelectionContext: "NO-GO";
        lifecycle: "NO-GO";
        stacking: "NO-GO";
        productProjection: "NO-GO";
        authority: "NO-GO";
        production: "NO-GO";
        writer: "NO-GO";
        publisher: "NO-GO";
        network: "NO-GO";
        r2: "NO-GO";
        android: "NO-GO";
    };
}
