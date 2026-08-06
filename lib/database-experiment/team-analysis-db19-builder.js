"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDatabaseTeamAnalysisDb19Coverage = exports.buildDatabaseTeamAnalysisDb19Dataset = void 0;
const REASONS = ["occurrence_count_mismatch", "logical_context_mismatch", "polarity_mismatch", "comparator_mismatch", "threshold_mismatch", "absent_in_other"];
function pairKey(value) { return `${value.stateKey}|${value.databaseRuleKey}|${value.currentRuleKey}`; }
function parse(value) { const parsed = JSON.parse(value); if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new Error("DB19 invalid structural signature"); return parsed; }
function same(left, right, keys) { return keys.every(key => left[key] === right[key]); }
function core(left, right) { return same(left, right, ["kind", "scope", "eventMode"]); }
function candidates(values, atom, filter) { return values.map(value => ({ signature: value, atom: parse(value) })).filter(value => core(atom, value.atom) && filter(value.atom)).map(value => value.signature).sort(); }
function classify(signature, oppositeAll) {
    const atom = parse(signature);
    let found = oppositeAll.filter(value => value === signature).sort();
    if (found.length)
        return { reason: "occurrence_count_mismatch", candidateSignatures: found };
    found = candidates(oppositeAll, atom, value => value.logicalContext !== atom.logicalContext && same(atom, value, ["kind", "scope", "eventMode", "comparator", "value", "negated"]));
    if (found.length)
        return { reason: "logical_context_mismatch", candidateSignatures: found };
    found = candidates(oppositeAll, atom, value => value.negated !== atom.negated && same(atom, value, ["kind", "scope", "eventMode", "comparator", "value", "logicalContext"]));
    if (found.length)
        return { reason: "polarity_mismatch", candidateSignatures: found };
    found = candidates(oppositeAll, atom, value => value.comparator !== atom.comparator && same(atom, value, ["kind", "scope", "eventMode", "value", "logicalContext", "negated"]));
    if (found.length)
        return { reason: "comparator_mismatch", candidateSignatures: found };
    found = candidates(oppositeAll, atom, value => value.value !== atom.value && same(atom, value, ["kind", "scope", "eventMode", "comparator", "logicalContext", "negated"]));
    if (found.length)
        return { reason: "threshold_mismatch", candidateSignatures: found };
    return { reason: "absent_in_other", candidateSignatures: [] };
}
function attribute(record, view, side) {
    const residual = side === "database" ? view.databaseOnlySignatures : view.currentOnlySignatures;
    const oppositeAll = side === "database" ? view.currentSignatures : view.databaseSignatures;
    return residual.map(structuralSignature => { const classified = classify(structuralSignature, oppositeAll); return { stateKey: record.stateKey, databaseRuleKey: record.databaseRuleKey, currentRuleKey: record.currentRuleKey, side, structuralSignature, reason: classified.reason, candidateSignatures: classified.candidateSignatures }; });
}
function patterns(attributions) {
    const grouped = new Map();
    for (const value of attributions) {
        const atom = parse(value.structuralSignature);
        const key = JSON.stringify({ side: value.side, reason: value.reason, kind: atom.kind, comparatorOrEventMode: atom.comparator ?? atom.eventMode ?? "none", logicalContext: atom.logicalContext, negated: atom.negated });
        const values = grouped.get(key) ?? [];
        values.push(value);
        grouped.set(key, values);
    }
    return [...grouped.entries()].map(([patternKey, values]) => { const parsed = JSON.parse(patternKey); const pairs = [...new Set(values.map(pairKey))].sort((left, right) => left.localeCompare(right, "en", { numeric: true })); return { patternKey, side: parsed.side, reason: parsed.reason, kind: parsed.kind, comparatorOrEventMode: parsed.comparatorOrEventMode, logicalContext: parsed.logicalContext, negated: parsed.negated, occurrenceCount: values.length, rulePairCount: pairs.length, sampleRulePairKeys: pairs.slice(0, 8) }; }).sort((left, right) => right.occurrenceCount - left.occurrenceCount || left.patternKey.localeCompare(right.patternKey));
}
function buildDatabaseTeamAnalysisDb19Dataset(options) {
    if (options.db15.contractVersion !== "0.14.0" || options.db18.contractVersion !== "0.17.1" || options.db18.sourceDb15.sha256 !== options.db15Sha256 || options.db15.sourceDatabaseSha256 !== options.db18.sourceDatabaseSha256 || options.db15.sourceCurrentTeamAnalysis.sha256 !== options.db18.sourceCurrentTeamAnalysis.sha256 || options.db15.comparisonUniverse !== options.db18.comparisonUniverse || options.db15.semanticPromotionCount !== 0 || options.db18.inheritedSemanticPromotionCount !== 3 || options.db18.semanticPromotionCount !== 0)
        throw new Error("DB19 source lineage mismatch");
    const sourcePairs = new Map(options.db15.ruleConditionParity.map(value => [pairKey(value), value]));
    const overrides = new Map(options.db18.affectedRuleParity.map(value => [pairKey(value), value.withLifecycleCompatibility]));
    if (overrides.size !== options.db18.affectedRuleParity.length)
        throw new Error("DB19 duplicate DB18 rule pair");
    for (const override of options.db18.affectedRuleParity) {
        const source = sourcePairs.get(pairKey(override));
        if (!source)
            throw new Error("DB19 orphan DB18 rule pair");
        if (JSON.stringify(override.beforeLifecycleCompatibility) !== JSON.stringify(source.withCompatibilityAliases))
            throw new Error("DB19 DB18 before-view lineage mismatch");
    }
    const residualAttributions = options.db15.ruleConditionParity.flatMap(record => { const view = overrides.get(pairKey(record)) ?? record.withCompatibilityAliases; return [...attribute(record, view, "database"), ...attribute(record, view, "current")]; }).sort((left, right) => left.stateKey.localeCompare(right.stateKey, "en", { numeric: true }) || left.databaseRuleKey.localeCompare(right.databaseRuleKey, "en", { numeric: true }) || left.currentRuleKey.localeCompare(right.currentRuleKey, "en", { numeric: true }) || left.side.localeCompare(right.side) || left.structuralSignature.localeCompare(right.structuralSignature));
    return { schemaVersion: 1, contract: "dokkan-team-analysis-post-lifecycle-residual-attribution", contractVersion: "0.18.0", generatedAt: options.db18.generatedAt, sourceDb15: { fileName: "team-analysis-db15-rule-condition-parity.json.gz", sha256: options.db15Sha256, contractVersion: "0.14.0" }, sourceDb18: { fileName: "team-analysis-db18-lifecycle-compatibility-parity.json.gz", sha256: options.db18Sha256, contractVersion: "0.17.1" }, sourceSnapshotVersion: options.db15.sourceSnapshotVersion, sourceDatabaseSha256: options.db15.sourceDatabaseSha256, sourceCurrentTeamAnalysis: options.db15.sourceCurrentTeamAnalysis, comparisonUniverse: options.db15.comparisonUniverse, inheritedSemanticPromotionCount: 3, semanticPromotionCount: 0, residualAttributions, residualPatterns: patterns(residualAttributions) };
}
exports.buildDatabaseTeamAnalysisDb19Dataset = buildDatabaseTeamAnalysisDb19Dataset;
function buildDatabaseTeamAnalysisDb19Coverage(dataset, comparableRulePairCount) {
    const bySide = (side) => Object.fromEntries(REASONS.map(reason => [reason, dataset.residualAttributions.filter(value => value.side === side && value.reason === reason).length]));
    const top = dataset.residualPatterns[0];
    return { schemaVersion: 1, comparableRulePairCount, residualRulePairCount: new Set(dataset.residualAttributions.map(pairKey)).size, residualAttributionCount: dataset.residualAttributions.length, databaseResidualCount: dataset.residualAttributions.filter(value => value.side === "database").length, currentResidualCount: dataset.residualAttributions.filter(value => value.side === "current").length, countsBySideAndReason: { database: bySide("database"), current: bySide("current") }, residualPatternCount: dataset.residualPatterns.length, topPatternKey: top?.patternKey ?? "none", topPatternOccurrenceCount: top?.occurrenceCount ?? 0, inheritedSemanticPromotionCount: 3, semanticPromotionCount: 0 };
}
exports.buildDatabaseTeamAnalysisDb19Coverage = buildDatabaseTeamAnalysisDb19Coverage;
//# sourceMappingURL=team-analysis-db19-builder.js.map