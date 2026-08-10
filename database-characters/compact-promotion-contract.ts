export const CHARACTER_COMPACT_PROMOTION_SCHEMA_VERSION = 1 as const;
export const CHARACTER_COMPACT_PROMOTION_CONTRACT_VERSION = "1.0.0" as const;
export const CHARACTER_COMPACT_PROMOTION_EXAMPLE_LIMIT = 5;

export type CharacterCompactPromotionReadiness = "GO" | "NO-GO";
export type CharacterCompactPromotionBlockerField = "binding" | "rarity" | "type";
export type CharacterCompactPromotionExampleKind = "null_fill_candidate" | "blocker";

export interface CharacterCompactPromotionExample {
    kind: CharacterCompactPromotionExampleKind;
    cardId: string;
    stateId: string;
    field: CharacterCompactPromotionBlockerField;
    reason: string;
    k15Value: string;
    productionValue: string | null;
    productionPath: string | null;
    ambiguousPaths?: string[];
}

export interface CharacterCompactPromotionReport {
    schemaVersion: 1;
    contract: "dokkan-database-character-compact-promotion-report";
    contractVersion: "1.0.0";
    generatedAt: string;
    mode: "offline_in_memory_overlay_proof";
    sources: {
        k15: {
            contract: "dokkan-database-character-compact-shadow";
            contractVersion: "1.0.0";
            datasetVersion: string;
            manifestFile: string;
            manifestSha256: string;
            payloadFile: string;
            payloadSha256: string;
            recordCount: number;
        };
        productionCharacters: {
            contract: "Character[]";
            fileName: "characters.json";
            sha256: string;
            sizeBytes: number;
            topLevelCount: number;
        };
    };
    policy: {
        explicitOptIn: true;
        offlineOnly: true;
        inMemoryCloneOnly: true;
        k15Only: true;
        structuralIdJoinOnly: true;
        recordSelection: "top_level_then_first_equal_nested_structural_id";
        ambiguousDuplicatesFailClosed: true;
        rarityPolicy: "null_fill_only";
        typePolicy: "agreement_only";
        exampleLimit: 5;
        returnsCharacters: false;
        catalogWritten: false;
        k11Read: false;
        sidecarsK0K14Read: false;
    };
    inventory: {
        k15Records: number;
        productionTopLevelRecords: number;
        selectedProductiveStates: number;
        ambiguousProductiveIds: number;
    };
    evaluation: {
        binding: { selected: number; missing: number; ambiguous: number };
        type: { agreements: number; changes: 0; differences: number; missing: number; ambiguous: number };
        rarity: {
            agreementsBeforeOverlay: number;
            nullFillCandidates: number;
            nonNullDifferences: number;
            missing: number;
            ambiguous: number;
            nonNullOverwrites: 0;
        };
        blockers: {
            total: number;
            missingBindings: number;
            ambiguousBindings: number;
            typeMissing: number;
            typeDifferences: number;
            rarityMissing: number;
            rarityNonNullDifferences: number;
        };
    };
    candidates: {
        count: number;
        canonicalization: "utf8-json-array-v1";
        sha256: string;
    };
    examples: CharacterCompactPromotionExample[];
    overlayProof: {
        candidatesAppliedToClone: number;
        candidateOnlyMutations: true;
        originalProductionRecordsMutated: 0;
        charactersCreated: 0;
        charactersRemoved: 0;
        postOverlay: {
            recordsEvaluated: number;
            idAgreements: number;
            rarityAgreements: number;
            typeAgreements: number;
            allFieldAgreements: number;
            blockers: number;
        };
    };
    inputIntegrity: {
        k15ArtifactsByteRevalidated: true;
        k15ProjectionDeepEqual: true;
        productionBytesEqual: true;
        productionCharactersDeepEqual: true;
        originalInputsUnchanged: true;
        overlayCloneIsolated: true;
    };
    readiness: {
        experimentalInMemoryOverlay: CharacterCompactPromotionReadiness;
        authority: "NO-GO";
        production: "NO-GO";
        android: "NO-GO";
        r2: "NO-GO";
        publisher: "NO-GO";
        fyiRemoval: "NO-GO";
        dokkanInfoRemoval: "NO-GO";
    };
}
