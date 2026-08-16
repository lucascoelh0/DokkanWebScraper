import type { CharacterLeaderSupportedShadowInventory } from "./leader-supported-shadow-contract";

export const CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_CONTRACT_VERSION = "1.0.0" as const;
export const CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_BASE_URL = "https://assets.dkbcompanion.com/" as const;
export const CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_MANIFEST_KEY =
    "database-characters/leader-supported/v1/manifest.json" as const;
export const CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_MANIFEST_SHA256 =
    "370dc7026c4523d509a403a2fbfa91009d1bb9452f7ab277f9c6aaebb8a1441e" as const;
export const CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_MANIFEST_SIZE_BYTES = 11_561;
export const CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_RESPONSE_LIMIT_BYTES = 1024 * 1024;
export const CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_AGGREGATE_LIMIT_BYTES = 2 * 1024 * 1024;
export const CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_REPORT_LIMIT_BYTES = 64 * 1024;
export const CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_RSS_LIMIT_BYTES = 1024 * 1024 * 1024;
export const CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_REQUEST_TIMEOUT_MS = 30_000;

export interface CharacterLeaderSupportedPublicShadowReport {
    schemaVersion: 1;
    contract: "dokkan-database-character-leader-supported-public-shadow";
    contractVersion: typeof CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_CONTRACT_VERSION;
    checkedAt: string;
    mode: "explicit_opt_in_public_read_only_candidate_shadow";
    remote: {
        publicBaseUrl: typeof CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_BASE_URL;
        manifestKey: typeof CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_MANIFEST_KEY;
        method: "GET";
        requestCount: 6;
        order: ["manifest_before", "payload", "coverage", "validation", "source_manifest", "manifest_after"];
        redirects: "BLOCKED";
        acceptEncoding: "identity";
        requestTimeoutMs: typeof CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_REQUEST_TIMEOUT_MS;
        bytesRead: number;
    };
    source: {
        publicManifest: { sha256: typeof CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_MANIFEST_SHA256; sizeBytes: 11_561 };
        fullArtifactFingerprintSha256: string;
        lineageFingerprintSha256: string;
        k58SourceBoundBefore: "GO";
        k58SourceBoundAfter: "GO";
        k58StableAcrossShadow: true;
        publicManifestStableAcrossShadow: true;
        everyPublicMemberExact: true;
    };
    inventory: CharacterLeaderSupportedShadowInventory;
    lookupAudit: {
        referenceSamples: number;
        stateSamples: number;
        cardSamples: number;
        effectSamples: number;
        exactReferenceLookupPassed: true;
        stateLookupPassed: true;
        cardLookupPassed: true;
        effectLookupPassed: true;
        returnedClonesDeepFrozen: true;
    };
    boundaries: {
        candidateOnlyPublicManifest: true;
        publicManifestRemotePreflightField: "NOT_EXECUTED";
        publicManifestMutationExecutedField: false;
        supportedOnly: true;
        conditionalEffectsIncluded: false;
        excludedConditionalEffects: 17;
        excludedConditionalReferences: 45;
        excludedReason: "runtime_deck_index_unresolved";
        userConfirmedRuleCoverageOnly: true;
        firstPartyRuntimeDeckIndexEvidence: false;
        userConfirmedRuleUsedToAuthorizeProjection: false;
        persistedConsumer: false;
        writerOrOutputArtifact: false;
        authenticatedRequestCount: 0;
        remoteMutationCount: 0;
        characterArrayReadCount: 0;
        applyCount: 0;
    };
    rssAccounting: {
        scope: "per_process_not_process_tree";
        k58BeforeK55ProcessPeakRssBytes: number;
        k58AfterK55ProcessPeakRssBytes: number;
        k61ParentProcessPeakRssBytes: number;
        maximumIndividualProcessPeakRssBytes: number;
    };
    readiness: {
        publicDelivery: "GO";
        publicShadowLookup: "GO";
        sourceBoundValidation: "GO";
        candidateOnlyBoundary: "GO";
        perProcessRssUnder1GiB: "GO";
        processTreeRssUnder1GiB: "NO-GO";
        persistedConsumer: "NO-GO";
        writerOrOutputArtifact: "NO-GO";
        authenticatedNetwork: "NO-GO";
        r2Mutation: "NO-GO";
        conditional17: "NO-GO";
        combinedLeaderFriendOrEffectiveValue: "NO-GO";
        finalCombatCalculation: "NO-GO";
        authority: "NO-GO";
        production: "NO-GO";
        android: "NO-GO";
        ui: "NO-GO";
        dynamicInstrumentation: "NO-GO";
    };
}
