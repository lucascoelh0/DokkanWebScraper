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
    const firstMigrationCandidates = fields.filter(item => item.decision === "GO" && item.field !== "id").map(item => item.field);
    return {
        schemaVersion: 1,
        contract: "dokkan-database-character-field-shadow-readiness",
        contractVersion: "1.0.0",
        generatedAt: projection.generatedAt,
        decisionPolicy: "all_six_field_criteria_required",
        fields,
        firstMigrationCandidates,
        fieldsRemainingExternal: projection.authorityMatrix.filter(rule => rule.owner === "external").map(rule => rule.field),
        preservedConflictCount: 4,
        production: { modified: false, publisherEnabled: false, r2Enabled: false, androidEnabled: false, authorityPromoted: false, fyiActive: true, dokkanInfoActive: true },
        nextSlice: {
            recommendation: "Review an opt-in, in-memory rarity/type consumer slice with the same manifest and external fallback contract; do not publish or promote authority in this campaign.",
            constraints: ["keep FYI and DokkanInfo active", "preserve 1,463 unjoinable cards", "no R2 or Android activation without separate authorization", "re-run field parity for a newer snapshot"],
        },
    };
}
