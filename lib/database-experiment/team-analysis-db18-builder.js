"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDatabaseTeamAnalysisDb18Coverage = exports.buildDatabaseTeamAnalysisDb18Dataset = void 0;
const PRECONDITION = "appearance_gate_true_and_normal_runtime_lifecycle";
function pairKey(value) { return `${value.stateKey}|${value.databaseRuleKey}|${value.currentRuleKey}`; }
function removeOne(values, signature, label) { const index = values.indexOf(signature); if (index < 0)
    throw new Error(`DB18 ${label} signature missing`); values.splice(index, 1); }
function atom(signature) { const parsed = JSON.parse(signature); if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new Error("DB18 invalid structural signature"); return parsed; }
function same(left, right, keys) { return keys.every(key => left[key] === right[key]); }
function view(database, current) {
    const db = [...database].sort();
    const site = [...current].sort();
    const remaining = new Map();
    for (const value of site)
        remaining.set(value, (remaining.get(value) ?? 0) + 1);
    const matchedSignatures = [];
    const databaseOnlySignatures = [];
    for (const value of db) {
        const count = remaining.get(value) ?? 0;
        if (count > 0) {
            matchedSignatures.push(value);
            remaining.set(value, count - 1);
        }
        else
            databaseOnlySignatures.push(value);
    }
    const currentOnlySignatures = [...remaining.entries()].flatMap(([value, count]) => Array.from({ length: count }, () => value)).sort();
    const status = databaseOnlySignatures.length === 0 && currentOnlySignatures.length === 0 ? "exact" : matchedSignatures.length > 0 ? "partial" : "divergent";
    return { databaseSignatures: db, currentSignatures: site, matchedSignatures, databaseOnlySignatures, currentOnlySignatures, status };
}
function requireConclusion(db17, kind) { const matches = db17.conclusions.filter(value => value.kind === kind && value.status === "confirmed_normal_lifecycle" && value.precondition === PRECONDITION); if (matches.length !== 1)
    throw new Error(`DB18 requires one scoped ${kind} conclusion`); }
function buildDatabaseTeamAnalysisDb18Dataset(options) {
    if (options.db15.contractVersion !== "0.14.0" || options.db16.contractVersion !== "0.15.0" || options.db17.contractVersion !== "0.16.0" || options.db16.sourceDb15.sha256 !== options.db15Sha256 || options.db17.sourceDb16.sha256 !== options.db16Sha256 || options.db15.sourceDatabaseSha256 !== options.db16.sourceDatabaseSha256 || options.db15.sourceDatabaseSha256 !== options.db17.sourceDatabaseSha256 || options.db15.sourceCurrentTeamAnalysis.sha256 !== options.db16.sourceCurrentTeamAnalysis.sha256 || options.db15.sourceCurrentTeamAnalysis.sha256 !== options.db17.sourceCurrentTeamAnalysis.sha256 || options.db15.semanticPromotionCount !== 0 || options.db16.semanticPromotionCount !== 0 || options.db17.semanticPromotionCount !== 3)
        throw new Error("DB18 source lineage mismatch");
    requireConclusion(options.db17, "appearance_turn_minimum_one");
    requireConclusion(options.db17, "gte_one_tautology");
    requireConclusion(options.db17, "lte_one_equals_eq_one");
    const targetAttributions = options.db16.residualAttributions.filter(value => value.reason === "current_turn_one_lower_bound_without_database_atom_unproven" || value.reason === "turn_one_exact_boundary_candidate_unproven");
    const attributionsByPair = new Map();
    for (const item of targetAttributions) {
        const key = pairKey(item);
        const values = attributionsByPair.get(key) ?? [];
        values.push(item);
        attributionsByPair.set(key, values);
    }
    const records = new Map(options.db15.ruleConditionParity.map(value => [pairKey(value), value]));
    const affectedRuleParity = [];
    let consumedAttributions = 0;
    for (const [key, attributions] of attributionsByPair) {
        const record = records.get(key);
        if (!record)
            throw new Error("DB18 DB15 rule pair missing");
        const database = [...record.withCompatibilityAliases.databaseSignatures];
        const current = [...record.withCompatibilityAliases.currentSignatures];
        const remainingDatabaseOnly = [...record.withCompatibilityAliases.databaseOnlySignatures];
        const remainingCurrentOnly = [...record.withCompatibilityAliases.currentOnlySignatures];
        const applications = [];
        for (const item of attributions.filter(value => value.reason === "current_turn_one_lower_bound_without_database_atom_unproven")) {
            if (item.side !== "current")
                throw new Error("DB18 tautology attribution must be current-only");
            const parsed = atom(item.structuralSignature);
            const context = String(parsed.logicalContext);
            if (parsed.kind !== "turn_from_entry" || parsed.scope !== "self" || parsed.comparator !== "gte" || parsed.value !== 1 || parsed.negated !== false || context.split(">").at(-1) !== "all")
                throw new Error("DB18 current tautology signature shape mismatch");
            removeOne(remainingCurrentOnly, item.structuralSignature, "current-only tautology attribution");
            removeOne(current, item.structuralSignature, "current tautology");
            applications.push({ kind: "remove_current_turn_one_tautology", sourceSignature: item.structuralSignature, conclusion: "gte_one_tautology", precondition: PRECONDITION, structuralPrecondition: "non_negated_conjunctive_atom", sourceDb16Reason: "current_turn_one_lower_bound_without_database_atom_unproven" });
            consumedAttributions += 1;
        }
        const databaseBoundaries = attributions.filter(value => value.reason === "turn_one_exact_boundary_candidate_unproven" && value.side === "database");
        const currentBoundaries = attributions.filter(value => value.reason === "turn_one_exact_boundary_candidate_unproven" && value.side === "current");
        const usedCurrent = new Set();
        for (const item of databaseBoundaries) {
            const index = currentBoundaries.findIndex((candidate, candidateIndex) => !usedCurrent.has(candidateIndex) && item.candidateSignatures.includes(candidate.structuralSignature) && candidate.candidateSignatures.includes(item.structuralSignature));
            if (index < 0)
                throw new Error("DB18 reciprocal turn-one boundary attribution missing");
            const compatible = currentBoundaries[index].structuralSignature;
            const databaseAtom = atom(item.structuralSignature);
            const currentAtom = atom(compatible);
            if (databaseAtom.kind !== "turn_from_entry" || databaseAtom.scope !== "self" || databaseAtom.comparator !== "lte" || databaseAtom.value !== 1 || currentAtom.comparator !== "eq" || currentAtom.value !== 1 || !same(databaseAtom, currentAtom, ["kind", "scope", "value", "logicalContext", "negated"]))
                throw new Error("DB18 turn-one boundary signature shape mismatch");
            usedCurrent.add(index);
            removeOne(remainingDatabaseOnly, item.structuralSignature, "database-only lte-one attribution");
            removeOne(remainingCurrentOnly, compatible, "current-only eq-one attribution");
            removeOne(database, item.structuralSignature, "database lte one");
            database.push(compatible);
            applications.push({ kind: "normalize_database_lte_one_to_eq_one", sourceSignature: item.structuralSignature, compatibilitySignature: compatible, conclusion: "lte_one_equals_eq_one", precondition: PRECONDITION, structuralPrecondition: "same_context_and_polarity", sourceDb16Reason: "turn_one_exact_boundary_candidate_unproven" });
            consumedAttributions += 2;
        }
        if (usedCurrent.size !== currentBoundaries.length)
            throw new Error("DB18 unconsumed current turn-one boundary attribution");
        const projected = view(database, current);
        if (JSON.stringify(projected.databaseOnlySignatures) !== JSON.stringify(remainingDatabaseOnly.sort()) || JSON.stringify(projected.currentOnlySignatures) !== JSON.stringify(remainingCurrentOnly.sort()))
            throw new Error("DB18 residual occurrence reconciliation mismatch");
        affectedRuleParity.push({ stateKey: record.stateKey, databaseRuleKey: record.databaseRuleKey, currentRuleKey: record.currentRuleKey, applications, beforeLifecycleCompatibility: record.withCompatibilityAliases, withLifecycleCompatibility: projected });
    }
    if (consumedAttributions !== targetAttributions.length || affectedRuleParity.length !== options.db17.affectedRulePairCount || consumedAttributions !== options.db17.affectedUnprovenAttributionCount)
        throw new Error("DB18 attribution reconciliation mismatch");
    return { schemaVersion: 1, contract: "dokkan-team-analysis-lifecycle-compatibility-parity-experiment", contractVersion: "0.17.1", generatedAt: options.db17.generatedAt, sourceDb15: { fileName: "team-analysis-db15-rule-condition-parity.json.gz", sha256: options.db15Sha256, contractVersion: "0.14.0" }, sourceDb16: { fileName: "team-analysis-db16-residual-attribution.json.gz", sha256: options.db16Sha256, contractVersion: "0.15.0" }, sourceDb17: { fileName: "team-analysis-db17-appearance-turn-evidence.json.gz", sha256: options.db17Sha256, contractVersion: "0.16.0" }, sourceSnapshotVersion: options.db15.sourceSnapshotVersion, sourceDatabaseSha256: options.db15.sourceDatabaseSha256, sourceCurrentTeamAnalysis: options.db15.sourceCurrentTeamAnalysis, comparisonUniverse: options.db15.comparisonUniverse, compatibilityPrecondition: PRECONDITION, inheritedSemanticPromotionCount: 3, semanticPromotionCount: 0, affectedRuleParity: affectedRuleParity.sort((left, right) => left.stateKey.localeCompare(right.stateKey, "en", { numeric: true }) || left.databaseRuleKey.localeCompare(right.databaseRuleKey, "en", { numeric: true }) || left.currentRuleKey.localeCompare(right.currentRuleKey, "en", { numeric: true })) };
}
exports.buildDatabaseTeamAnalysisDb18Dataset = buildDatabaseTeamAnalysisDb18Dataset;
function buildDatabaseTeamAnalysisDb18Coverage(dataset, db15) {
    const affected = new Map(dataset.affectedRuleParity.map(value => [pairKey(value), value.withLifecycleCompatibility]));
    const finalViews = db15.ruleConditionParity.map(record => affected.get(pairKey(record)) ?? record.withCompatibilityAliases);
    const beforeViews = db15.ruleConditionParity.map(record => record.withCompatibilityAliases);
    const counts = (views) => ({ exact: views.filter(value => value.status === "exact").length, partial: views.filter(value => value.status === "partial").length, divergent: views.filter(value => value.status === "divergent").length });
    const sum = (views, select) => views.reduce((total, value) => total + select(value), 0);
    const applications = dataset.affectedRuleParity.flatMap(value => value.applications);
    const beforePairCounts = counts(beforeViews);
    const lifecycleCompatibilityPairCounts = counts(finalViews);
    return { schemaVersion: 1, comparableRulePairCount: db15.ruleConditionParity.length, affectedRulePairCount: dataset.affectedRuleParity.length, beforePairCounts, lifecycleCompatibilityPairCounts, exactPairDelta: lifecycleCompatibilityPairCounts.exact - beforePairCounts.exact, removedCurrentTautologyOccurrenceCount: applications.filter(value => value.kind === "remove_current_turn_one_tautology").length, normalizedTurnOneBoundaryOccurrenceCount: applications.filter(value => value.kind === "normalize_database_lte_one_to_eq_one").length, resolvedDb16AttributionCount: applications.reduce((total, value) => total + (value.kind === "normalize_database_lte_one_to_eq_one" ? 2 : 1), 0), beforeDatabaseOnlySignatureOccurrenceCount: sum(beforeViews, value => value.databaseOnlySignatures.length), lifecycleDatabaseOnlySignatureOccurrenceCount: sum(finalViews, value => value.databaseOnlySignatures.length), beforeCurrentOnlySignatureOccurrenceCount: sum(beforeViews, value => value.currentOnlySignatures.length), lifecycleCurrentOnlySignatureOccurrenceCount: sum(finalViews, value => value.currentOnlySignatures.length), remainingResidualRulePairCount: finalViews.filter(value => value.databaseOnlySignatures.length > 0 || value.currentOnlySignatures.length > 0).length, inheritedSemanticPromotionCount: 3, semanticPromotionCount: 0 };
}
exports.buildDatabaseTeamAnalysisDb18Coverage = buildDatabaseTeamAnalysisDb18Coverage;
//# sourceMappingURL=team-analysis-db18-builder.js.map