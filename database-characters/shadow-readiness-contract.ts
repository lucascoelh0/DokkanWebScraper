import { CharacterShadowField } from "./shadow-contract";

export interface CharacterShadowFieldReadiness {
    field: CharacterShadowField;
    decision: "GO" | "NO-GO";
    criteria: {
        unequivocalStructuralBinding: boolean;
        supportedEvidence: boolean;
        sufficientParity: boolean;
        fallbackProven: boolean;
        zeroUnresolvedConflict: boolean;
        productFieldExists: boolean;
    };
    blockers: string[];
    patchableCharacterCount: number;
}

export interface DatabaseCharacterShadowReadiness {
    schemaVersion: 1;
    contract: "dokkan-database-character-field-shadow-readiness";
    contractVersion: "1.0.0";
    generatedAt: string;
    decisionPolicy: "all_six_field_criteria_required";
    fields: CharacterShadowFieldReadiness[];
    firstMigrationCandidates: CharacterShadowField[];
    fieldsRemainingExternal: CharacterShadowField[];
    preservedConflictCount: 4;
    production: {
        modified: false;
        publisherEnabled: false;
        r2Enabled: false;
        androidEnabled: false;
        authorityPromoted: false;
        fyiActive: true;
        dokkanInfoActive: true;
    };
    nextSlice: {
        recommendation: string;
        constraints: string[];
    };
}
