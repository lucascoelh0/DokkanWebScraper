"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCharacterShadowCoverage = void 0;
const emptyCounts = () => ({ agreements: 0, representationGains: 0, representationMismatches: 0, confirmedConflicts: 0, unknown: 0, unjoinable: 0, externalFallback: 0 });
const emptyStateCounts = () => ({ initial: 0, eza: 0, seza: 0, form: 0 });
const add = (counts, value) => {
    const key = {
        agreement: "agreements", representation_gain: "representationGains", representation_mismatch: "representationMismatches",
        confirmed_conflict: "confirmedConflicts", unknown: "unknown", unjoinable: "unjoinable", external_fallback: "externalFallback",
    };
    counts[key[value]]++;
};
const sumCounts = (target, source) => {
    for (const key of Object.keys(target))
        target[key] += source[key];
};
function orderingAudit(fields, field, source) {
    const result = { field, source, exactOrderAgreement: 0, sameSetDifferentOrder: 0, differentRepresentation: 0, unavailable: 0, policy: "report_both_orders_no_silent_selection" };
    for (const item of fields.filter(value => value.field === field)) {
        const external = item.externalValue[source];
        if (!Array.isArray(item.databaseValue) || !Array.isArray(external)) {
            result.unavailable++;
            continue;
        }
        const database = item.databaseValue.map(String);
        const current = external.map(String);
        if (JSON.stringify(database) === JSON.stringify(current))
            result.exactOrderAgreement++;
        else if (JSON.stringify(database.slice().sort()) === JSON.stringify(current.slice().sort()))
            result.sameSetDifferentOrder++;
        else
            result.differentRepresentation++;
    }
    return result;
}
function preserveK7Conflicts(k7, k7Sha256) {
    const conflicts = [];
    for (const card of k7.cards) {
        for (const conflict of card.fyi.conflicts) {
            if (!(["1027621", "1028161"].includes(card.cardId) && ["maxLevel", "maxSALevel"].includes(conflict.field)))
                continue;
            const state = card.fyi.comparisonState;
            if (state.releaseState !== "eza" || !state.stateKey || state.growthStepSource?.table !== "optimal_awakening_growths")
                throw new Error(`K7 conflict lost EZA growth provenance: ${card.cardId}:${conflict.field}`);
            conflicts.push({
                cardId: card.cardId, field: conflict.field,
                databaseValue: conflict.databaseValue, externalValue: conflict.externalValue,
                comparison: "confirmed_conflict", sourceStateKey: state.stateKey, releaseState: "eza", growthRow: { table: "optimal_awakening_growths", rowId: state.growthStepSource.rowId }, k7SidecarSha256: k7Sha256,
            });
        }
    }
    return conflicts.sort((a, b) => a.cardId.localeCompare(b.cardId) || a.field.localeCompare(b.field));
}
function buildCharacterShadowCoverage(projection, k7) {
    const cardIds = [...new Set(projection.fields.map(item => item.cardId))];
    const firstByCard = new Map();
    projection.fields.forEach(item => { if (!firstByCard.has(item.cardId))
        firstByCard.set(item.cardId, item); });
    const productionJoinedCount = [...firstByCard.values()].filter(item => item.productionJoin.status === "joined").length;
    const fyiJoinedCount = [...firstByCard.values()].filter(item => item.fyiJoin.status === "joined").length;
    const byField = new Map();
    projection.fields.forEach(item => byField.set(item.field, [...(byField.get(item.field) ?? []), item]));
    const fieldCoverage = projection.authorityMatrix.map(rule => {
        const values = byField.get(rule.field) ?? [];
        const production = emptyCounts();
        const fyi = emptyCounts();
        if (rule.owner === "external") {
            production.externalFallback = productionJoinedCount;
            production.unjoinable = cardIds.length - productionJoinedCount;
            fyi.externalFallback = fyiJoinedCount;
            fyi.unjoinable = cardIds.length - fyiJoinedCount;
        }
        else {
            values.forEach(item => { add(production, item.sourceComparisons.production); add(fyi, item.sourceComparisons.fyi); });
        }
        const stateCoverage = emptyStateCounts();
        const comparisonStateCoverage = { production: emptyStateCounts(), fyi: emptyStateCounts() };
        values.filter(item => item.evidenceStatus === "supported").forEach(item => {
            for (const [target, release] of [
                [stateCoverage, item.releaseState],
                [comparisonStateCoverage.production, item.productionJoin.comparisonState.releaseState],
                [comparisonStateCoverage.fyi, item.fyiJoin.comparisonState.releaseState],
            ]) {
                if (item.recordKind === "form")
                    target.form++;
                else if (release === "eza" || release === "seza")
                    target[release]++;
                else
                    target.initial++;
            }
        });
        return {
            field: rule.field, characterField: rule.characterField, matrixAuthority: rule.authority, production, fyi,
            supported: values.filter(item => item.evidenceStatus === "supported").length,
            partial: values.filter(item => item.evidenceStatus === "partial").length,
            unknownEvidence: values.filter(item => item.evidenceStatus === "unknown").length,
            patchableCharacterCount: values.filter(item => item.characterField && item.authority === "database_candidate" && item.productionJoin.status === "joined").length,
            stateCoverage, comparisonStateCoverage,
        };
    });
    const totals = emptyCounts();
    fieldCoverage.forEach(item => sumCounts(totals, item.production));
    const preservedK7Conflicts = preserveK7Conflicts(k7, projection.source.sidecars.k7.sha256);
    totals.confirmedConflicts += preservedK7Conflicts.length;
    const coverage = (field) => fieldCoverage.find(item => item.field === field);
    return {
        schemaVersion: 1, contract: "dokkan-database-character-field-shadow-coverage", contractVersion: "1.0.0",
        cardCount: cardIds.length, productionJoinedCount, productionUnjoinableCount: cardIds.length - productionJoinedCount,
        fyiJoinedCount, fyiUnjoinableCount: cardIds.length - fyiJoinedCount, fieldProjectionCount: projection.fields.length, fieldCoverage, totals,
        catalogImpact: { productionTopLevelCount: projection.source.productionCharacters.characterCount, productionStructurallyJoinedCardCount: productionJoinedCount, databaseCardCount: cardIds.length, charactersCreatedByShadow: 0, productionCatalogSizeChange: 0 },
        orderingAudits: [orderingAudit(projection.fields, "categories", "production"), orderingAudit(projection.fields, "categories", "fyi"), orderingAudit(projection.fields, "links", "production"), orderingAudit(projection.fields, "links", "fyi")],
        labelStability: { categoryIdsSupportedCards: coverage("categoryIds")?.supported ?? 0, categoryLabelAgreements: coverage("categories")?.production.agreements ?? 0, linkIdsSupportedCards: coverage("linkIds")?.supported ?? 0, linkLabelAgreements: coverage("links")?.production.agreements ?? 0 },
        fullyExternalFallbackFields: projection.authorityMatrix.filter(rule => rule.owner === "external").map(rule => rule.field),
        preservedK7Conflicts,
        comparisonInventory: ["agreement", "representation_gain", "representation_mismatch", "confirmed_conflict", "unjoinable", "unknown", "external_fallback"],
    };
}
exports.buildCharacterShadowCoverage = buildCharacterShadowCoverage;
//# sourceMappingURL=shadow-parity-builder.js.map