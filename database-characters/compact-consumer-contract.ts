import type { Rarities, Types } from "../character";

export const CHARACTER_COMPACT_CONSUMER_SCHEMA_VERSION = 1 as const;
export const CHARACTER_COMPACT_CONSUMER_CONTRACT_VERSION = "1.0.0" as const;
export const CHARACTER_COMPACT_CONSUMER_EXAMPLE_LIMIT = 5;

export const CHARACTER_COMPACT_CONSUMER_PRODUCTION_PIN = {
    fileName: "characters.json",
    sha256: "421c8fec6f7ba22e270af19b2278da4fbba19b6299205a54cc3d1ed570319dbc",
    sizeBytes: 121_390_313,
    topLevelCount: 4_090,
} as const;

export type CharacterCompactConsumerField = "id" | "rarity" | "type";
export type CharacterCompactConsumerComparison = "difference" | "missing" | "ambiguous";

export interface CharacterCompactConsumerExample {
    cardId: string;
    stateId: string;
    comparison: CharacterCompactConsumerComparison;
    k15Value: string;
    productionValue: string | null;
    productionPath: string | null;
    ambiguousPaths?: string[];
}

export interface CharacterCompactConsumerFieldReport {
    agreements: number;
    differences: number;
    missing: number;
    ambiguous: number;
    examples: CharacterCompactConsumerExample[];
}

export interface CharacterCompactConsumerReport {
    schemaVersion: 1;
    contract: "dokkan-database-character-compact-consumer-report";
    contractVersion: "1.0.0";
    generatedAt: string;
    mode: "offline_compare_shadow";
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
        compareOnly: true;
        k15Only: true;
        structuralIdJoinOnly: true;
        recordSelection: "top_level_then_first_equal_nested_structural_id";
        ambiguousDuplicatesFailClosed: true;
        exampleLimit: number;
        effectiveValuesChanged: false;
        charactersCreated: 0;
        charactersRemoved: 0;
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
    fields: {
        id: CharacterCompactConsumerFieldReport;
        rarity: CharacterCompactConsumerFieldReport;
        type: CharacterCompactConsumerFieldReport;
    };
    inputIntegrity: {
        k15ArtifactsByteRevalidated: true;
        k15ProjectionDeepEqual: true;
        productionBytesEqual: true;
        productionCharactersDeepEqual: true;
    };
    readiness: {
        offlineCompareShadow: "GO";
        authority: "NO-GO";
        production: "NO-GO";
        android: "NO-GO";
        r2: "NO-GO";
        publisher: "NO-GO";
        fyiRemoval: "NO-GO";
        dokkanInfoRemoval: "NO-GO";
    };
}

export interface CharacterCompactConsumerComparableState {
    id: string;
    rarity: Rarities | string | null;
    type: Types | string | null;
    sourceRecordPath: string;
}
