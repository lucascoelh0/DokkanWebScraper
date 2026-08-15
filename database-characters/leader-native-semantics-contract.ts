import type { CharacterLeaderValueK3Identity, CharacterLeaderValueK48Identity } from "./leader-value-scope-contract";

export const CHARACTER_LEADER_NATIVE_SEMANTICS_CONTRACT_VERSION = "1.0.0" as const;
export const CHARACTER_LEADER_NATIVE_SEMANTICS_REPORT_LIMIT_BYTES = 64 * 1024;
export const CHARACTER_LEADER_NATIVE_SEMANTICS_RSS_LIMIT_BYTES = 1024 * 1024 * 1024;
export const CHARACTER_LEADER_NATIVE_PIN = {
    elfSha256: "7d6c2c1e095fc20a71ec4764e88a17b4d4b82f3f12952b9ba8c6eb0405a7215a",
    elfSizeBytes: 95_662_296,
    type82Rows: 3_853,
    type82References: 12_310,
    flatRows: 4,
    proportionalRows: 3_849,
    invalidRows: 0,
    nonzeroIgnoredPositionRows: 0,
    maskDomainSize: 38,
    modifierDomainSize: 36,
    targetTypeDomain: [2, 12, 13] as const,
    nonNullCausalityRows: 17,
    dispatchEntries: 15,
    evidenceSha256: "c61c3267da54b43846333735f77a79e05dd1acd9adb3e7a6c7943684e833c68e",
    evidenceSizeBytes: 7_094,
} as const;

export interface CharacterLeaderNativeProof {
    nativeSha256: string;
    nativeSizeBytes: number;
    evidenceSha256: string;
    codeRegionCount: number;
    dispatchEntryCount: number;
    constructorColumnCount: number;
    type82DispatchBound: boolean;
    battleFactoryFieldTransferBound: boolean;
}

export interface CharacterLeaderNativeEvaluation {
    type82Rows: number;
    type82References: number;
    flatRows: number;
    proportionalRows: number;
    invalidRows: number;
    nonzeroIgnoredPositionRows: number;
    maskDomain: number[];
    modifierDomain: number[];
    targetTypeDomain: number[];
    nonNullCausalityRows: number;
}

export interface CharacterLeaderNativeSemanticsReport {
    schemaVersion: 1;
    contract: "dokkan-database-character-leader-native-semantics-audit";
    contractVersion: typeof CHARACTER_LEADER_NATIVE_SEMANTICS_CONTRACT_VERSION;
    mode: "offline_local_explicit_opt_in_stdout_only";
    sources: { k48: CharacterLeaderValueK48Identity; k3: CharacterLeaderValueK3Identity; native: CharacterLeaderNativeProof };
    semantics: {
        efficacyType82: "supported_native_structural";
        selector: "element_or_awakening_type_bitmask";
        modifier: "efficacy_values_position_1";
        position2: "not_read_by_type82_handler";
        affectedStats: ["hp", "atk", "def"];
        calcOption0: "flat_points";
        calcOption2: "proportional_percent_divided_by_100";
        candidateTargetTypes: [2, 12, 13];
        subTargetSetFiltersCandidates: true;
        matchingRowsAccumulateAdditivelyInTeamingPower: true;
        battleFactoryTransfersRuntimeFields: true;
    };
    scope: CharacterLeaderNativeEvaluation;
    policy: {
        nativeEvidenceOnly: true;
        targetTypeNamesDerived: false;
        subTargetDomainMeaningsDerived: false;
        causalityBehaviorDerived: false;
        battleLifecycleDerived: false;
        battleStackingOrCompositionDerived: false;
        productAuthoritySelected: false;
        payloadWritten: false;
        networkEnabled: false;
        r2Enabled: false;
        androidImplemented: false;
    };
    inputIntegrity: {
        k48SourceBoundBefore: "GO" | "NOT_EXECUTED";
        k48SourceBoundAfter: "GO" | "NOT_EXECUTED";
        k48AndK3Stable: boolean;
        nativeExactPinnedBeforeAndAfter: boolean;
        evidenceAndCodeRegionsExactPinned: boolean;
        reportTimestampIncluded: false;
        reportMaximumBytesExclusive: typeof CHARACTER_LEADER_NATIVE_SEMANTICS_REPORT_LIMIT_BYTES;
        rssMaximumBytesExclusive: typeof CHARACTER_LEADER_NATIVE_SEMANTICS_RSS_LIMIT_BYTES;
    };
    readiness: {
        nativeLeaderSemantics: "GO" | "NOT_EXECUTED";
        type82FieldSemantics: "GO" | "NOT_EXECUTED";
        targetTypeNames: "NO-GO";
        subTargetDomainMeanings: "NO-GO";
        causalityBehavior: "NO-GO";
        battleLifecycle: "NO-GO";
        battleStackingOrComposition: "NO-GO";
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
