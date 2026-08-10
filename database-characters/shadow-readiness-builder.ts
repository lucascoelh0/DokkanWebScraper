import { CharacterShadowProjection } from "./shadow-contract";
import { DatabaseCharacterShadowCoverage } from "./shadow-parity-contract";
import { DatabaseCharacterShadowReadiness } from "./shadow-readiness-contract";
import { DatabaseCharacterShadowValidation } from "./shadow-validator";

export function buildCharacterShadowReadiness(projection: CharacterShadowProjection, coverage: DatabaseCharacterShadowCoverage, validation: DatabaseCharacterShadowValidation): DatabaseCharacterShadowReadiness {
    const fallbackProven = validation.valid && coverage.productionUnjoinableCount === 1_463
        && validation.safety.partialOrUnknownPatchCount === 0 && validation.safety.unjoinableDatabaseCandidateCount === 0 && validation.safety.conflictWinnerCount === 0;
    const fields = projection.authorityMatrix.map(rule => {
        const field = coverage.fieldCoverage.find(item => item.field === rule.field);
        if (!field) throw new Error(`readiness coverage missing for ${rule.field}`);
        const joinedComparable = field.production.agreements + field.production.representationGains;
        const criteria = {
            unequivocalStructuralBinding: validation.safety.ambiguousStateBindingCount === 0 && rule.owner !== "external",
            supportedEvidence: field.supported === coverage.cardCount,
            sufficientParity: rule.owner !== "external" && joinedComparable === coverage.productionJoinedCount,
            fallbackProven,
            zeroUnresolvedConflict: field.production.confirmedConflicts === 0 && !coverage.preservedK7Conflicts.some(item => item.field === rule.field),
            productFieldExists: rule.characterField !== null,
        };
        const blockers: string[] = [];
        if (!criteria.unequivocalStructuralBinding) blockers.push(rule.owner === "external" ? "K0-K2 are not the field owner" : "state binding is ambiguous");
        if (!criteria.supportedEvidence) blockers.push("not all database cards have supported evidence");
        if (!criteria.sufficientParity) blockers.push("joined production values include mismatch, unknown, or conflict");
        if (!criteria.fallbackProven) blockers.push("fallback safety validation is not green");
        if (!criteria.zeroUnresolvedConflict) blockers.push("unresolved field conflict exists");
        if (!criteria.productFieldExists) blockers.push("shadow-only structural dimension has no Character field");
        return { field: rule.field, decision: Object.values(criteria).every(Boolean) ? "GO" as const : "NO-GO" as const, criteria, blockers, patchableCharacterCount: field.patchableCharacterCount };
    });
    return {
        schemaVersion: 1,
        contract: "dokkan-database-character-field-shadow-readiness",
        contractVersion: "1.0.1",
        generatedAt: projection.generatedAt,
        decisionPolicy: "all_six_field_criteria_required",
        decisionScope: "field_evidence_only_no_delivery_authorization",
        fields,
        firstMigrationCandidates: [],
        fieldsRemainingExternal: projection.authorityMatrix.filter(rule => rule.owner === "external").map(rule => rule.field),
        preservedConflictCount: 4,
        production: { modified: false, publisherEnabled: false, r2Enabled: false, androidEnabled: false, authorityPromoted: false, fyiActive: true, dokkanInfoActive: true },
        artifactPolicy: {
            k11: {
                classification: "audit_only",
                uncompressedSizeBytes: 511_791_355,
                runtimeConsumption: "NO-GO",
                optInConsumption: "NO-GO",
                publication: "NO-GO",
                androidConsumption: "NO-GO",
            },
            k15: {
                status: "not_implemented",
                projection: "compact_supported_only",
                fields: ["id", "rarity", "type"],
                provenance: "compact_hashes_and_versions",
                contentAddressed: true,
                ownManifestRequired: true,
                lineageRequired: ["k11", "k0", "k1", "k2"],
                futureConsumerInput: "k15_only",
            },
        },
        nextGate: {
            action: "generate_compact_supported_projection",
            artifact: "k15",
            decision: "GO",
            gates: {
                generateAndValidate: "GO",
                publication: "NO-GO",
                consumption: "NO-GO",
                authorityPromotion: "NO-GO",
                r2: "NO-GO",
                android: "NO-GO",
                production: "NO-GO",
            },
        },
        nextSlice: {
            recommendation: "Generate and validate K15 as a new compact, supported-only, content-addressed id/rarity/type projection with its own manifest and explicit K11/K0-K2 lineage.",
            constraints: ["K11 remains audit-only and is never a consumer input", "K15 does not exist in this campaign", "keep generation, publication and consumption as separate gates", "keep FYI and DokkanInfo active", "preserve 1,463 unjoinable cards", "keep publication, consumption, authority promotion, R2, Android and production NO-GO"],
        },
    };
}
