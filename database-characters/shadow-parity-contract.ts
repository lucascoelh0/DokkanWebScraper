import { CharacterShadowComparison, CharacterShadowField } from "./shadow-contract";

export interface CharacterShadowClassificationCounts {
    agreements: number;
    representationGains: number;
    representationMismatches: number;
    confirmedConflicts: number;
    unknown: number;
    unjoinable: number;
    externalFallback: number;
}

export interface CharacterShadowFieldCoverage {
    field: CharacterShadowField;
    characterField: string | null;
    matrixAuthority: "database_candidate" | "external_fallback" | "unsupported";
    production: CharacterShadowClassificationCounts;
    fyi: CharacterShadowClassificationCounts;
    supported: number;
    partial: number;
    unknownEvidence: number;
    patchableCharacterCount: number;
    stateCoverage: Record<"initial" | "eza" | "seza" | "form", number>;
}

export interface CharacterShadowOrderingAudit {
    field: "categories" | "links";
    source: "production" | "fyi";
    exactOrderAgreement: number;
    sameSetDifferentOrder: number;
    differentRepresentation: number;
    unavailable: number;
    policy: "report_both_orders_no_silent_selection";
}

export interface PreservedK7Conflict {
    cardId: "1027621" | "1028161";
    field: "maxLevel" | "maxSALevel";
    databaseValue: 140 | 15;
    externalValue: 120 | 10;
    comparison: "confirmed_conflict";
    sourceStateKey: string;
    releaseState: "eza";
    growthRow: { table: "optimal_awakening_growths"; rowId: string };
    k7SidecarSha256: string;
}

export interface DatabaseCharacterShadowCoverage {
    schemaVersion: 1;
    contract: "dokkan-database-character-field-shadow-coverage";
    contractVersion: "1.0.0";
    cardCount: number;
    productionJoinedCount: number;
    productionUnjoinableCount: number;
    fyiJoinedCount: number;
    fyiUnjoinableCount: number;
    fieldProjectionCount: number;
    fieldCoverage: CharacterShadowFieldCoverage[];
    totals: CharacterShadowClassificationCounts;
    catalogImpact: {
        productionTopLevelCount: number;
        productionStructurallyJoinedCardCount: number;
        databaseCardCount: number;
        charactersCreatedByShadow: 0;
        productionCatalogSizeChange: 0;
    };
    orderingAudits: CharacterShadowOrderingAudit[];
    labelStability: {
        categoryIdsSupportedCards: number;
        categoryLabelAgreements: number;
        linkIdsSupportedCards: number;
        linkLabelAgreements: number;
    };
    fullyExternalFallbackFields: CharacterShadowField[];
    preservedK7Conflicts: PreservedK7Conflict[];
    comparisonInventory: CharacterShadowComparison[];
}
