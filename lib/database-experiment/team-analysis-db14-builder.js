"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDatabaseTeamAnalysisDb14Coverage = exports.buildDatabaseTeamAnalysisDb14Dataset = void 0;
function signatureObject(value) { const parsed = JSON.parse(value); if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new Error("DB14 invalid compatibility signature"); return parsed; }
function runtimeBound(values, type, value) {
    const matches = values.filter(item => item.causalityType === type && item.predicate.kind === "turn_from_entry" && item.predicate.value === value);
    if (matches.length !== 1)
        throw new Error(`DB14 expected one native bound type ${type} value ${value}, got ${matches.length}`);
    return matches[0];
}
function buildDatabaseTeamAnalysisDb14Dataset(options) {
    if (options.db11.contractVersion !== "0.10.0" || options.db12.contractVersion !== "0.11.0" || options.db13.contractVersion !== "0.12.1" ||
        options.db12.sourceDb11.sha256 !== options.db11Sha256 || options.db13.sourceDb11.sha256 !== options.db11Sha256 || options.db13.sourceDb12.sha256 !== options.db12Sha256 ||
        options.db12.sourceCurrentTeamAnalysis.sha256 !== options.currentSha256 || options.db13.sourceCurrentTeamAnalysis.sha256 !== options.currentSha256 ||
        options.db11.sourceSha256 !== options.db12.sourceDatabaseSha256 || options.db11.sourceSha256 !== options.db13.sourceDatabaseSha256 || options.db12.semanticPromotionCount !== 0 || options.db13.semanticPromotionCount !== 0)
        throw new Error("DB14 source lineage mismatch");
    const aliases = new Map(options.siteAudit.formProjectionAliases.map(alias => [alias.databaseCardId, alias.projectedCardId]));
    const stateByKey = new Map(options.db11.states.map(state => [`${state.characterId}:${aliases.get(state.formId) ?? state.formId}:${state.releaseState}`, state]));
    const candidateEntries = options.db12.exactTurnEncodingCandidates.map(value => [`${value.stateKey}|${value.databaseRuleKey}|${value.value}|${value.negated}|${signatureObject(value.databaseLowerSignature).logicalContext}`, value]);
    const candidateByKey = new Map(candidateEntries);
    if (candidateByKey.size !== candidateEntries.length)
        throw new Error("DB14 duplicate DB12 exact-turn candidate key");
    const alignmentByPair = new Map(options.db13.ruleAlignments.map(value => [`${value.stateKey}|${value.databaseRuleKey}|${value.currentRuleKey}`, value]));
    const exactAtoms = options.db12.diagnosticCurrentExactTurnAtoms;
    const exactTurnCompatibilityAliases = [];
    for (const assessment of options.db13.exactTurnRuleAssessments.filter(value => value.status === "rule_aligned_unique_effect_shape")) {
        if (assessment.alignedCurrentRuleKeys.length !== 1)
            throw new Error("DB14 aligned assessment must name exactly one current rule");
        const currentRuleKey = assessment.alignedCurrentRuleKeys[0];
        const candidate = candidateByKey.get(`${assessment.stateKey}|${assessment.databaseRuleKey}|${assessment.value}|${assessment.databaseNegated}|${assessment.databaseLogicalContext}`);
        if (!candidate)
            throw new Error("DB14 DB12 exact-turn candidate missing");
        const exact = exactAtoms.filter(value => value.stateKey === assessment.stateKey && value.atom.value === assessment.value && value.atom.negated === assessment.databaseNegated && value.sourceRuleKeys.includes(currentRuleKey) && candidate.currentExactSignatures.includes(value.atom.structuralSignature));
        if (exact.length !== 1)
            throw new Error(`DB14 expected one current exact atom, got ${exact.length}`);
        const alignment = alignmentByPair.get(`${assessment.stateKey}|${assessment.databaseRuleKey}|${currentRuleKey}`);
        if (!alignment)
            throw new Error("DB14 DB13 rule alignment missing");
        const state = stateByKey.get(assessment.stateKey);
        const rule = state?.passive?.rules.find(value => value.ruleKey === assessment.databaseRuleKey);
        if (!rule)
            throw new Error("DB14 DB11 source rule missing");
        const lower = runtimeBound(rule.runtimeConditions, 55, assessment.value);
        const upper = runtimeBound(rule.runtimeConditions, 51, assessment.value);
        const atom = exact[0].atom;
        const parsed = signatureObject(atom.structuralSignature);
        if (parsed.kind !== "turn_from_entry" || parsed.scope !== "self" || parsed.comparator !== "eq" || parsed.value !== assessment.value || typeof parsed.logicalContext !== "string" || parsed.negated !== assessment.databaseNegated)
            throw new Error("DB14 current exact signature shape mismatch");
        exactTurnCompatibilityAliases.push({ stateKey: assessment.stateKey, databaseRuleKey: assessment.databaseRuleKey, currentRuleKey, value: assessment.value,
            compatibilityPredicate: { kind: "turn_from_entry", scope: "self", comparator: "eq", value: assessment.value }, compatibilityLogicalContext: parsed.logicalContext, compatibilityNegated: parsed.negated, compatibilitySignature: atom.structuralSignature,
            nativeBounds: { conjunctionGroup: candidate.databaseConjunctionGroup, negated: candidate.negated, lower, upper }, ruleAlignment: { kind: alignment.kind, sharedEffectSignatures: alignment.sharedEffectSignatures }, status: "supported_compatibility_alias" });
    }
    const expected = options.db13.exactTurnRuleAssessments.filter(value => value.status === "rule_aligned_unique_effect_shape").length;
    if (exactTurnCompatibilityAliases.length !== expected)
        throw new Error("DB14 compatibility alias count mismatch");
    return { schemaVersion: 1, contract: "dokkan-team-analysis-exact-turn-compatibility-experiment", contractVersion: "0.13.0", generatedAt: options.db13.generatedAt,
        sourceDb11: { fileName: "team-analysis-db11-experiment.json.gz", sha256: options.db11Sha256, contractVersion: "0.10.0" }, sourceDb12: { fileName: "team-analysis-db12-divergence-attribution.json.gz", sha256: options.db12Sha256, contractVersion: "0.11.0" }, sourceDb13: { fileName: "team-analysis-db13-rule-alignment.json.gz", sha256: options.db13Sha256, contractVersion: "0.12.1" },
        sourceCurrentTeamAnalysis: options.db13.sourceCurrentTeamAnalysis, sourceSnapshotVersion: options.db11.sourceSnapshotVersion, sourceDatabaseSha256: options.db11.sourceSha256, semanticPromotionCount: 0,
        exactTurnCompatibilityAliases: exactTurnCompatibilityAliases.sort((left, right) => left.stateKey.localeCompare(right.stateKey, "en", { numeric: true }) || left.value - right.value || Number(left.compatibilityNegated) - Number(right.compatibilityNegated) || left.databaseRuleKey.localeCompare(right.databaseRuleKey, "en", { numeric: true })) };
}
exports.buildDatabaseTeamAnalysisDb14Dataset = buildDatabaseTeamAnalysisDb14Dataset;
function buildDatabaseTeamAnalysisDb14Coverage(dataset, db13) {
    const assessments = db13.exactTurnRuleAssessments;
    return { schemaVersion: 1, sourceExactTurnCandidateCount: assessments.length, sourceRuleAlignedCount: assessments.filter(value => value.status === "rule_aligned_unique_effect_shape").length,
        sourceRuleAmbiguousCount: assessments.filter(value => value.status === "rule_alignment_ambiguous").length, sourceRuleUnalignedCount: assessments.filter(value => value.status === "rule_unaligned").length,
        compatibilityAliasCount: dataset.exactTurnCompatibilityAliases.length, compatibilityAliasStateCount: new Set(dataset.exactTurnCompatibilityAliases.map(value => value.stateKey)).size,
        compatibilityAliasDatabaseRuleCount: new Set(dataset.exactTurnCompatibilityAliases.map(value => `${value.stateKey}|${value.databaseRuleKey}`)).size, compatibilityAliasCurrentRuleCount: new Set(dataset.exactTurnCompatibilityAliases.map(value => `${value.stateKey}|${value.currentRuleKey}`)).size,
        compatibilityAliasValues: [...new Set(dataset.exactTurnCompatibilityAliases.map(value => value.value))].sort((left, right) => left - right), currentExactSignatureMatchCount: dataset.exactTurnCompatibilityAliases.length,
        skippedAmbiguousCount: assessments.filter(value => value.status === "rule_alignment_ambiguous").length, skippedUnalignedCount: assessments.filter(value => value.status === "rule_unaligned").length, semanticPromotionCount: 0 };
}
exports.buildDatabaseTeamAnalysisDb14Coverage = buildDatabaseTeamAnalysisDb14Coverage;
//# sourceMappingURL=team-analysis-db14-builder.js.map