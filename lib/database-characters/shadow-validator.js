"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyOptionalCharacterShadowInMemory = exports.validateCharacterShadowProjection = void 0;
const shadow_builder_1 = require("./shadow-builder");
const presentationFields = new Set(["name", "title", "categories", "links"]);
const key = (item) => `${item.cardId}:${item.field}`;
function validateCharacterShadowProjection(projection, coverage) {
    const failures = [];
    if (projection?.schemaVersion !== 1 || projection.contract !== "dokkan-database-character-field-shadow" || projection.contractVersion !== "1.0.0")
        failures.push("projection schema");
    if (!projection?.policy?.structuralIdsOnly || projection.policy.nameTextOrNumericProximityInference || !projection.policy.fieldScopedPatches
        || projection.policy.unsupportedDefaults || projection.policy.k7ValuesConsumed || projection.policy.productionModified || projection.policy.publisherEnabled || projection.policy.androidEnabled)
        failures.push("projection policy");
    const matrixFields = projection?.authorityMatrix?.map(item => item.field) ?? [];
    if (matrixFields.length !== new Set(matrixFields).size)
        failures.push("duplicate authority field");
    const identities = projection?.fields?.map(key) ?? [];
    const duplicateProjectionIdentityCount = identities.length - new Set(identities).size;
    if (duplicateProjectionIdentityCount)
        failures.push("duplicate projection identity");
    let partialOrUnknownPatchCount = 0;
    let unjoinableDatabaseCandidateCount = 0;
    let conflictWinnerCount = 0;
    let ambiguousStateBindingCount = 0;
    const bindingByCard = new Map();
    for (const item of projection?.fields ?? []) {
        if (!matrixFields.includes(item.field))
            failures.push(`field outside authority matrix:${key(item)}`);
        if ((item.evidenceStatus === "partial" || item.evidenceStatus === "unknown") && item.authority === "database_candidate")
            partialOrUnknownPatchCount++;
        if (item.productionJoin.status === "unjoinable" && item.authority === "database_candidate")
            unjoinableDatabaseCandidateCount++;
        if (item.comparison === "confirmed_conflict" && (item.authority === "database_candidate" || JSON.stringify(item.effectiveShadowValue) !== JSON.stringify(item.externalValue.production)))
            conflictWinnerCount++;
        if (presentationFields.has(item.field) && item.sourceComparisons.production === "representation_gain" && item.authority === "database_candidate")
            failures.push(`missing locale presentation patch:${key(item)}`);
        if (item.authority === "database_candidate" && (item.evidenceStatus !== "supported" || !["agreement", "representation_gain"].includes(item.comparison)))
            failures.push(`unsafe database candidate:${key(item)}`);
        if (item.authority !== "database_candidate" && JSON.stringify(item.effectiveShadowValue) !== JSON.stringify(item.externalValue.production))
            failures.push(`fallback value changed:${key(item)}`);
        if (!item.provenance.some(value => value.sidecar === "k7" && value.sidecarSha256 === projection.source.sidecars.k7.sha256 && value.sourceState?.stateId === item.stateId))
            failures.push(`K7 state provenance:${key(item)}`);
        const binding = JSON.stringify({ stateId: item.stateId, releaseState: item.releaseState, growthRowId: item.growthRowId, production: item.productionJoin.comparisonState, fyi: item.fyiJoin.comparisonState });
        const previous = bindingByCard.get(item.cardId);
        if (previous !== undefined && previous !== binding)
            ambiguousStateBindingCount++;
        else
            bindingByCard.set(item.cardId, binding);
    }
    if (partialOrUnknownPatchCount)
        failures.push("partial or unknown database patch");
    if (unjoinableDatabaseCandidateCount)
        failures.push("unjoinable database patch");
    if (conflictWinnerCount)
        failures.push("conflict winner selected");
    if (ambiguousStateBindingCount)
        failures.push("ambiguous state binding");
    if (coverage)
        validateCoverage(projection, coverage, failures);
    return {
        schemaVersion: 1,
        valid: failures.length === 0,
        failures: [...new Set(failures)].sort(),
        safety: { productionFilesWritten: false, publisherEnabled: false, androidEnabled: false, partialOrUnknownPatchCount, unjoinableDatabaseCandidateCount, conflictWinnerCount, ambiguousStateBindingCount, duplicateProjectionIdentityCount },
    };
}
exports.validateCharacterShadowProjection = validateCharacterShadowProjection;
function validateCoverage(projection, coverage, failures) {
    if (coverage.schemaVersion !== 1 || coverage.contract !== "dokkan-database-character-field-shadow-coverage" || coverage.contractVersion !== "1.0.0")
        failures.push("coverage schema");
    if (coverage.cardCount !== new Set(projection.fields.map(item => item.cardId)).size || coverage.fieldProjectionCount !== projection.fields.length)
        failures.push("coverage cardinality");
    if (coverage.cardCount === 5759 && (coverage.productionUnjoinableCount !== 1463 || coverage.productionJoinedCount !== 4296 || coverage.fyiJoinedCount !== 1625 || coverage.fyiUnjoinableCount !== 4134))
        failures.push("K7 join inventory");
    for (const field of coverage.fieldCoverage) {
        const productionTotal = Object.values(field.production).reduce((sum, value) => sum + value, 0);
        const fyiTotal = Object.values(field.fyi).reduce((sum, value) => sum + value, 0);
        if (productionTotal !== coverage.cardCount || fyiTotal !== coverage.cardCount)
            failures.push(`non-exclusive classification:${field.field}`);
        if (field.patchableCharacterCount > coverage.productionJoinedCount)
            failures.push(`patchable cardinality:${field.field}`);
    }
    const expectedConflicts = ["1027621:maxLevel:4885", "1027621:maxSALevel:4885", "1028161:maxLevel:4844", "1028161:maxSALevel:4844"];
    const actualConflicts = coverage.preservedK7Conflicts.map(item => `${item.cardId}:${item.field}:${item.growthRow.rowId}`);
    if (JSON.stringify(actualConflicts) !== JSON.stringify(expectedConflicts))
        failures.push("K7 conflict inventory");
    if (coverage.catalogImpact.charactersCreatedByShadow !== 0 || coverage.catalogImpact.productionCatalogSizeChange !== 0)
        failures.push("catalog mutation");
    if (coverage.orderingAudits.some(item => item.policy !== "report_both_orders_no_silent_selection"))
        failures.push("ordering policy");
    const externalMatrix = projection.authorityMatrix.filter(item => item.owner === "external").map(item => item.field);
    if (JSON.stringify(coverage.fullyExternalFallbackFields) !== JSON.stringify(externalMatrix))
        failures.push("external fallback inventory");
}
/** Fail-closed optional consumer: invalid/unknown input returns the exact original value. */
function applyOptionalCharacterShadowInMemory(characters, projection, coverage) {
    if (projection === null || projection === undefined)
        return { characters, applied: false, reason: "absent" };
    if (typeof projection !== "object")
        return { characters, applied: false, reason: "invalid" };
    const validation = validateCharacterShadowProjection(projection, coverage);
    if (!validation.valid)
        return { characters, applied: false, reason: "invalid", validation };
    return { characters: (0, shadow_builder_1.applyCharacterShadowInMemory)(characters, projection), applied: true, reason: "applied_in_memory", validation };
}
exports.applyOptionalCharacterShadowInMemory = applyOptionalCharacterShadowInMemory;
//# sourceMappingURL=shadow-validator.js.map