import type { CharacterLeaderAssociationK3Identity, CharacterLeaderAssociationK46Identity } from "./leader-association-scope-contract";

export const CHARACTER_LEADER_VALUE_SCOPE_CONTRACT_VERSION = "1.0.0" as const;
export const CHARACTER_LEADER_VALUE_SCOPE_REPORT_LIMIT_BYTES = 64 * 1024;
export const CHARACTER_LEADER_VALUE_SCOPE_RSS_LIMIT_BYTES = 1024 * 1024 * 1024;
export const CHARACTER_LEADER_VALUE_SCOPE_SAMPLE_LIMIT = 5 as const;

export const CHARACTER_LEADER_VALUE_SCOPE_PIN = {
    includedEffectReferences: 49_435,
    uniqueEffectRows: 16_119,
    efficacyTypeDomainSize: 23,
    uniqueType82Rows: 3_853,
    includedType82References: 12_310,
    type82InvalidVectorRows: 0,
    type82NonTiming1Rows: 0,
    type82NonzeroPosition2Rows: 0,
    type82DescriptionMismatchRows: 5,
    partialRows: 3_848,
    partialReferences: 12_296,
    unknownRows: 12_271,
    unknownReferences: 37_139,
    setsContainingType82: 2_296,
    onlyType82Sets: 0,
    timing1Rows: 16_024,
    timing0Rows: 95,
    causalityNullRows: 15_703,
    causalityNonNullRows: 416,
    causalitySerializedShapes: 12,
    missingEffectRows: 0,
    structuralMismatchReferences: 0,
} as const;

export type CharacterLeaderValueClassification =
    | "partial:text_correlated_common_hp_atk_def_percent"
    | "unknown";

export interface CharacterLeaderValueRawEffect {
    rowId: string;
    leaderSkillSetId: string;
    efficacyType: number;
    efficacyVector: number[] | null;
    calcOption: number;
    targetType: number;
    subTargetTypeSetId: string | null;
    causalitySerializedShapeSha256: string | null;
    execTimingType: number;
    descriptionCorrelatedToVectorPosition1: boolean;
}

export interface CharacterLeaderValueK3Identity extends CharacterLeaderAssociationK3Identity {
    valueInputFingerprintSha256: string;
}
export interface CharacterLeaderValueK3Source {
    identity: CharacterLeaderValueK3Identity;
    effects: CharacterLeaderValueRawEffect[];
}

export interface CharacterLeaderValueK48State {
    stateId: string;
    sourceStateKey: string;
    cardId: string;
    releaseState: "initial" | "eza" | "seza";
    leaderSetRowId: string;
    effects: Array<{ effectRowId: string; targetSetId: string | null }>;
}
export interface CharacterLeaderValueK48Identity {
    manifestSha256: string;
    payloadSha256: string;
    rawSha256: string;
    stateFingerprintSha256: string;
    k46: CharacterLeaderAssociationK46Identity;
    k3: CharacterLeaderAssociationK3Identity;
}
export interface CharacterLeaderValueK48Source {
    identity: CharacterLeaderValueK48Identity;
    states: CharacterLeaderValueK48State[];
    policy: {
        structuralIdsOnly: true;
        sourceOrderAndMultiplicityPreserved: true;
        semanticAssociationSelected: false;
    };
    coverage: { states: number; effectReferences: number; targetReferences: number; repeatedTargetReferences: number };
}

export interface CharacterLeaderValueScopeEvaluation {
    includedEffectReferences: number;
    uniqueEffectRows: number;
    efficacyTypeDomain: number[];
    uniqueType82Rows: number;
    includedType82References: number;
    partialRows: number;
    partialReferences: number;
    unknownRows: number;
    unknownReferences: number;
    type82InvalidVectorRows: number;
    type82NonTiming1Rows: number;
    type82NonzeroPosition2Rows: number;
    type82DescriptionMismatchRows: number;
    setsContainingType82: number;
    onlyType82Sets: number;
    calcOptionDomain: number[];
    targetTypeDomain: number[];
    timingRows: Array<{ id: number; rows: number }>;
    causalityNullRows: number;
    causalityNonNullRows: number;
    causalitySerializedShapes: number;
    missingEffectRows: number;
    structuralMismatchReferences: number;
    samples: {
        partialEffectRowIds: string[];
        unknownEffectRowIds: string[];
        mismatchEffectRowIds: string[];
        limitPerKind: typeof CHARACTER_LEADER_VALUE_SCOPE_SAMPLE_LIMIT;
    };
}

export interface CharacterLeaderValueScopeReport {
    schemaVersion: 1;
    contract: "dokkan-database-character-leader-value-scope-audit";
    contractVersion: typeof CHARACTER_LEADER_VALUE_SCOPE_CONTRACT_VERSION;
    mode: "offline_local_explicit_opt_in_stdout_only";
    sources: { k48: CharacterLeaderValueK48Identity; k3: CharacterLeaderValueK3Identity };
    policy: {
        rawFieldsRemainOpaque: true;
        type82PartialClassificationOnly: true;
        descriptionCorrelationAuditOnly: true;
        descriptionTextIncluded: false;
        textUsedAsIdentityOrJoin: false;
        hpAtkDefDerived: false;
        selectorOrBitmaskDerived: false;
        clauseOrCompositionDerived: false;
        calculationTargetOrTimingSemanticsDerived: false;
        payloadWritten: false;
        consumerImplemented: false;
        applyOrOverlayImplemented: false;
        authoritySelected: false;
        productionModified: false;
        publisherImplemented: false;
        networkEnabled: false;
        r2Enabled: false;
        androidImplemented: false;
    };
    scope: CharacterLeaderValueScopeEvaluation;
    inputIntegrity: {
        k48SourceBoundBefore: "GO" | "NOT_EXECUTED";
        k48SourceBoundAfter: "GO" | "NOT_EXECUTED";
        k48IdentityAndFingerprintStable: boolean;
        k3ExactPinnedBeforeAndAfter: boolean;
        k3ValueFingerprintStable: boolean;
        k3DecodeBoundedToPinnedRawSize: boolean;
        reportTimestampIncluded: false;
        reportMaximumBytesExclusive: typeof CHARACTER_LEADER_VALUE_SCOPE_REPORT_LIMIT_BYTES;
        rssMaximumBytesExclusive: typeof CHARACTER_LEADER_VALUE_SCOPE_RSS_LIMIT_BYTES;
    };
    readiness: {
        leaderValueScope: "GO" | "NOT_EXECUTED";
        nextOpaquePartialProjection: "NO-GO";
        hpAtkDefSemantics: "NO-GO";
        selectorOrBitmaskSemantics: "NO-GO";
        clauseOrCompositionSemantics: "NO-GO";
        calculationTargetOrTimingSemantics: "NO-GO";
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
    };
}
