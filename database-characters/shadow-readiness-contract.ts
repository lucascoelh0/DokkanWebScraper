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
    contractVersion: "1.0.1";
    generatedAt: string;
    decisionPolicy: "all_six_field_criteria_required";
    decisionScope: "field_evidence_only_no_delivery_authorization";
    fields: CharacterShadowFieldReadiness[];
    /** K14 authorizes no direct field migration; K15 generation is modeled separately. */
    firstMigrationCandidates: [];
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
    artifactPolicy: {
        k11: {
            classification: "audit_only";
            uncompressedSizeBytes: 511_791_355;
            runtimeConsumption: "NO-GO";
            optInConsumption: "NO-GO";
            publication: "NO-GO";
            androidConsumption: "NO-GO";
        };
        k15: {
            status: "not_implemented";
            projection: "compact_supported_only";
            fields: ["id", "rarity", "type"];
            provenance: "compact_hashes_and_versions";
            contentAddressed: true;
            ownManifestRequired: true;
            lineageRequired: ["k11", "k0", "k1", "k2"];
            futureConsumerInput: "k15_only";
        };
    };
    nextGate: {
        action: "generate_compact_supported_projection";
        artifact: "k15";
        decision: "GO";
        gates: {
            generateAndValidate: "GO";
            publication: "NO-GO";
            consumption: "NO-GO";
            authorityPromotion: "NO-GO";
            r2: "NO-GO";
            android: "NO-GO";
            production: "NO-GO";
        };
    };
    nextSlice: {
        recommendation: string;
        constraints: string[];
    };
}
