import type { CharacterLeaderSupportedProjectionRecord } from "./leader-supported-projection-contract";

export const CHARACTER_LEADER_SUPPORTED_SHADOW_CONTRACT_VERSION = "1.0.0" as const;
export const CHARACTER_LEADER_SUPPORTED_SHADOW_REPORT_LIMIT_BYTES = 64 * 1024;
export const CHARACTER_LEADER_SUPPORTED_SHADOW_RSS_LIMIT_BYTES = 1024 * 1024 * 1024;

export const CHARACTER_LEADER_SUPPORTED_SHADOW_PIN = {
    references: 12_265,
    distinctStateIds: 7_248,
    distinctCardIds: 3_434,
    distinctEffectRowIds: 3_836,
    totalEffects: 3_853,
    totalReferences: 12_310,
    excludedEffects: 17,
    excludedReferences: 45,
    raw: { sizeBytes: 12_847_768, sha256: "345f7ab587fe893c58971799e220548896f2bf803b667b18a70595f32ac78154" },
    payload: { sizeBytes: 185_908, sha256: "5579ed50704453cae29e97d770c05b02492c4f5130d2e4075da1e961817f2473" },
    coverage: { sizeBytes: 21_196, sha256: "e8e7a372d87ee3fc0b7393a15e83a191290cee61f88c303c25178504dffd6a8f" },
    validation: { sizeBytes: 1_498, sha256: "c24b898cbbd4da324ac4cf83068f2d9ec9603b3276993f48736a40fa99eddf4e" },
    manifest: { sizeBytes: 7_146, sha256: "e5213cc11b141e585eff1cffdfd3043e790cff718569367e26c5dd581bdd1546" },
} as const;

export interface CharacterLeaderSupportedShadowInventory {
    references: 12_265;
    distinctStateIds: 7_248;
    distinctCardIds: 3_434;
    distinctEffectRowIds: 3_836;
    samples: {
        stateIds: string[];
        cardIds: string[];
        effectRowIds: string[];
        references: Array<{ stateId: string; sourceEffectOccurrenceIndex: number }>;
    };
}

export interface CharacterLeaderSupportedShadowMemberIdentity {
    sizeBytes: number;
    sha256: string;
}

export interface CharacterLeaderSupportedShadowReport {
    schemaVersion: 1;
    contract: "dokkan-database-character-leader-supported-shadow-consumer";
    contractVersion: typeof CHARACTER_LEADER_SUPPORTED_SHADOW_CONTRACT_VERSION;
    mode: "explicit_opt_in_offline_local_stdout_only_timestamp_free";
    inventory: CharacterLeaderSupportedShadowInventory;
    source: {
        members: {
            raw: CharacterLeaderSupportedShadowMemberIdentity;
            payload: CharacterLeaderSupportedShadowMemberIdentity;
            coverage: CharacterLeaderSupportedShadowMemberIdentity;
            validation: CharacterLeaderSupportedShadowMemberIdentity;
            manifest: CharacterLeaderSupportedShadowMemberIdentity;
        };
        fullArtifactFingerprintSha256: string;
        lineageFingerprintSha256: string;
        exactRealK56Identity: boolean;
        sourceBoundValidationBefore: "GO" | "NOT_EXECUTED";
        sourceBoundValidationAfter: "GO" | "NOT_EXECUTED";
        fullArtifactStableAcrossLookup: true | "NOT_EXECUTED";
        fullLineageStableAcrossLookup: true | "NOT_EXECUTED";
    };
    boundaries: {
        supportedOnly: true;
        structuralIdsOnly: true;
        sourceOrderAndMultiplicityPreserved: true;
        conditionalEffectsIncluded: false;
        excludedConditionalEffects: 17;
        excludedConditionalReferences: 45;
        excludedReason: "runtime_deck_index_unresolved";
        corroborativeRuleId: "k56-conditional-domain-rule-v1";
        corroborativeRuleCoverageOnly: true;
        firstPartyRuntimeDeckIndexEvidence: false;
        corroborativeRuleUsedToAuthorizeSupportedProjection: false;
        corroborativeRulePresentInDataset: false;
        persistedConsumer: false;
        writerOrOutputArtifact: false;
        applyOrOverlay: false;
        authoritySelected: false;
        productionModified: false;
        networkEnabled: false;
    };
    rssAccounting: {
        scope: "per_process_not_process_tree";
        measurements: null | {
            k55BeforeProcessPeakRssBytes: number;
            k55AfterProcessPeakRssBytes: number;
            k57ParentProcessPeakRssBytes: number;
            maximumIndividualProcessPeakRssBytes: number;
        };
    };
    readiness: {
        consumerShadow: "GO" | "NOT_EXECUTED";
        sourceBoundValidation: "GO" | "NOT_EXECUTED";
        perProcessRssUnder1GiB: "GO" | "NOT_EXECUTED";
        processTreeRssUnder1GiB: "NO-GO";
        persistedConsumer: "NO-GO";
        writerOrOutputArtifact: "NO-GO";
        applyOrOverlay: "NO-GO";
        combinedLeaderFriendOrEffectiveValue: "NO-GO";
        finalCombatCalculation: "NO-GO";
        conditional17: "NO-GO";
        deckFallback: "NO-GO";
        authority: "NO-GO";
        production: "NO-GO";
        publisher: "NO-GO";
        network: "NO-GO";
        r2: "NO-GO";
        android: "NO-GO";
        ui: "NO-GO";
        fyiRemoval: "NO-GO";
        dynamicInstrumentation: "NO-GO";
    };
}

export type CharacterLeaderSupportedShadowRecord = Readonly<CharacterLeaderSupportedProjectionRecord>;
