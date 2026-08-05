"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDatabaseTeamAnalysisDb13Coverage = exports.buildDatabaseTeamAnalysisDb13Dataset = void 0;
const team_analysis_db3_parity_1 = require("./team-analysis-db3-parity");
function object(value) { return value !== null && typeof value === "object" && !Array.isArray(value) ? value : undefined; }
function unique(values) { return [...new Set(values)].sort(); }
function currentRuleKey(rule, index) { return typeof rule.id === "string" ? rule.id : `current-rule-${index}`; }
function databaseRuleShape(rule) {
    const effectSignatures = unique(rule.effects.filter(effect => effect.kind !== "unknown").map(team_analysis_db3_parity_1.databaseEffectSignature));
    if (effectSignatures.length === 0)
        return undefined;
    return { ruleKey: rule.ruleKey, effectSignatures, databaseSource: { passiveSkillRelationId: rule.source.passiveSkillRelationId, passiveSkillId: rule.source.passiveSkillId, efficacyType: rule.source.efficacyType } };
}
function currentRuleShape(value, index) {
    const rule = object(value);
    if (!rule)
        return undefined;
    const effects = Array.isArray(rule.effects) ? rule.effects.map(object).filter((effect) => Boolean(effect) && typeof effect.kind === "string" && effect.kind !== "unknown") : [];
    const effectSignatures = unique(effects.map(team_analysis_db3_parity_1.currentTeamAnalysisEffectSignature));
    if (effectSignatures.length === 0)
        return undefined;
    return { ruleKey: currentRuleKey(rule, index), effectSignatures };
}
function signatureRules(rules) {
    const result = new Map();
    for (const rule of rules)
        for (const signature of rule.effectSignatures) {
            const values = result.get(signature) ?? [];
            values.push(rule.ruleKey);
            result.set(signature, values);
        }
    for (const [signature, values] of result)
        result.set(signature, unique(values));
    return result;
}
function setKey(values) { return JSON.stringify(values); }
function buildAlignments(stateKey, databaseRules, currentRules) {
    const databaseBySignature = signatureRules(databaseRules);
    const currentBySignature = signatureRules(currentRules);
    const ambiguousSignatures = [];
    for (const signature of new Set([...databaseBySignature.keys()].filter(value => currentBySignature.has(value)))) {
        const databaseRuleKeys = databaseBySignature.get(signature);
        const currentRuleKeys = currentBySignature.get(signature);
        if (databaseRuleKeys.length > 1 || currentRuleKeys.length > 1)
            ambiguousSignatures.push({ stateKey, effectSignature: signature, databaseRuleKeys, currentRuleKeys });
    }
    const databaseSets = new Map();
    const currentSets = new Map();
    for (const rule of databaseRules) {
        const values = databaseSets.get(setKey(rule.effectSignatures)) ?? [];
        values.push(rule.ruleKey);
        databaseSets.set(setKey(rule.effectSignatures), values);
    }
    for (const rule of currentRules) {
        const values = currentSets.get(setKey(rule.effectSignatures)) ?? [];
        values.push(rule.ruleKey);
        currentSets.set(setKey(rule.effectSignatures), values);
    }
    const alignments = [];
    for (const database of databaseRules)
        for (const current of currentRules) {
            const shared = database.effectSignatures.filter(signature => current.effectSignatures.includes(signature));
            if (shared.length === 0)
                continue;
            const exactUnique = setKey(database.effectSignatures) === setKey(current.effectSignatures) && databaseSets.get(setKey(database.effectSignatures))?.length === 1 && currentSets.get(setKey(current.effectSignatures))?.length === 1;
            const uniqueAnchor = shared.some(signature => databaseBySignature.get(signature)?.length === 1 && currentBySignature.get(signature)?.length === 1);
            if (!exactUnique && !uniqueAnchor)
                continue;
            alignments.push({ stateKey, databaseRuleKey: database.ruleKey, currentRuleKey: current.ruleKey, kind: exactUnique ? "exact_effect_set_unique" : "unique_effect_signature_anchor", sharedEffectSignatures: shared, databaseEffectSignatures: database.effectSignatures, currentEffectSignatures: current.effectSignatures, databaseSource: database.databaseSource });
        }
    return { alignments: alignments.sort((left, right) => left.databaseRuleKey.localeCompare(right.databaseRuleKey, "en", { numeric: true }) || left.currentRuleKey.localeCompare(right.currentRuleKey, "en", { numeric: true })), ambiguousSignatures: ambiguousSignatures.sort((left, right) => left.effectSignature.localeCompare(right.effectSignature)) };
}
function buildDatabaseTeamAnalysisDb13Dataset(options) {
    if (options.db11.contractVersion !== "0.10.0" || options.db12.contractVersion !== "0.11.0" || options.db12.sourceDb11.sha256 !== options.db11Sha256 || options.db12.sourceCurrentTeamAnalysis.sha256 !== options.currentSha256 || options.db12.sourceDatabaseSha256 !== options.db11.sourceSha256 || options.db12.semanticPromotionCount !== 0)
        throw new Error("DB13 source lineage mismatch");
    const aliases = new Map(options.siteAudit.formProjectionAliases.map(alias => [alias.databaseCardId, alias.projectedCardId]));
    const projectedKey = (state) => `${state.characterId}:${aliases.get(state.formId) ?? state.formId}:${state.releaseState}`;
    const currentByKey = new Map(options.current.states.map(state => [state.stateKey, state]));
    const ruleAlignments = [];
    const ambiguousEffectSignatures = [];
    let matchedStateCount = 0;
    for (const state of options.db11.states) {
        const stateKey = projectedKey(state);
        const currentState = currentByKey.get(stateKey);
        if (!currentState)
            continue;
        matchedStateCount += 1;
        const databaseRules = (state.passive?.rules ?? []).map(databaseRuleShape).filter((rule) => Boolean(rule));
        const currentRules = (currentState.passive?.rules ?? []).map(currentRuleShape).filter((rule) => Boolean(rule));
        const built = buildAlignments(stateKey, databaseRules, currentRules);
        ruleAlignments.push(...built.alignments);
        ambiguousEffectSignatures.push(...built.ambiguousSignatures);
    }
    if (matchedStateCount !== options.db12.matchedStateCount)
        throw new Error("DB13 matched-state lineage mismatch");
    const alignmentByPair = new Map(ruleAlignments.map(value => [`${value.stateKey}|${value.databaseRuleKey}|${value.currentRuleKey}`, value]));
    const exactTurnRuleAssessments = options.db12.exactTurnEncodingCandidates.map((candidate) => {
        const currentExactRuleKeys = unique(options.db12.diagnosticCurrentExactTurnAtoms.filter(value => value.stateKey === candidate.stateKey && value.atom.value === candidate.value && candidate.currentExactSignatures.includes(value.atom.structuralSignature)).flatMap(value => value.sourceRuleKeys));
        const alignments = currentExactRuleKeys.map(key => alignmentByPair.get(`${candidate.stateKey}|${candidate.databaseRuleKey}|${key}`)).filter((value) => Boolean(value));
        const alignedCurrentRuleKeys = unique(alignments.map(value => value.currentRuleKey));
        return { stateKey: candidate.stateKey, value: candidate.value, databaseRuleKey: candidate.databaseRuleKey, databaseLogicalContext: JSON.parse(candidate.databaseLowerSignature).logicalContext, databaseNegated: candidate.negated, currentExactRuleKeys, alignedCurrentRuleKeys, alignmentKinds: unique(alignments.map(value => value.kind)), status: alignedCurrentRuleKeys.length === 1 ? "rule_aligned_unique_effect_shape" : alignedCurrentRuleKeys.length > 1 ? "rule_alignment_ambiguous" : "rule_unaligned" };
    }).sort((left, right) => left.stateKey.localeCompare(right.stateKey, "en", { numeric: true }) || left.value - right.value || Number(left.databaseNegated) - Number(right.databaseNegated) || left.databaseLogicalContext.localeCompare(right.databaseLogicalContext));
    return { schemaVersion: 1, contract: "dokkan-team-analysis-rule-alignment-experiment", contractVersion: "0.12.1", generatedAt: options.db12.generatedAt,
        sourceDb11: { fileName: "team-analysis-db11-experiment.json.gz", sha256: options.db11Sha256, contractVersion: "0.10.0" }, sourceDb12: { fileName: "team-analysis-db12-divergence-attribution.json.gz", sha256: options.db12Sha256, contractVersion: "0.11.0" },
        sourceCurrentTeamAnalysis: { sha256: options.currentSha256, parserVersion: options.current.parserVersion }, sourceSnapshotVersion: options.db11.sourceSnapshotVersion, sourceDatabaseSha256: options.db11.sourceSha256,
        effectFingerprintVersion: "db3-normalized-effect-shape-v1", semanticPromotionCount: 0, matchedStateCount, ruleAlignments: ruleAlignments.sort((left, right) => left.stateKey.localeCompare(right.stateKey, "en", { numeric: true }) || left.databaseRuleKey.localeCompare(right.databaseRuleKey, "en", { numeric: true }) || left.currentRuleKey.localeCompare(right.currentRuleKey, "en", { numeric: true })), ambiguousEffectSignatures: ambiguousEffectSignatures.sort((left, right) => left.stateKey.localeCompare(right.stateKey, "en", { numeric: true }) || left.effectSignature.localeCompare(right.effectSignature)), exactTurnRuleAssessments };
}
exports.buildDatabaseTeamAnalysisDb13Dataset = buildDatabaseTeamAnalysisDb13Dataset;
function buildDatabaseTeamAnalysisDb13Coverage(dataset, db11, current, siteAudit) {
    const aliases = new Map(siteAudit.formProjectionAliases.map(alias => [alias.databaseCardId, alias.projectedCardId]));
    const currentKeys = new Set(current.states.map(state => state.stateKey));
    const projectedKey = (state) => `${state.characterId}:${aliases.get(state.formId) ?? state.formId}:${state.releaseState}`;
    const databaseRules = db11.states.filter(state => currentKeys.has(projectedKey(state))).flatMap(state => (state.passive?.rules ?? []).map(databaseRuleShape).filter((rule) => Boolean(rule)).map(rule => `${projectedKey(state)}|${rule.ruleKey}`));
    const databaseStateKeys = new Set(db11.states.map(projectedKey));
    const currentRules = current.states.filter(state => databaseStateKeys.has(state.stateKey)).flatMap(state => (state.passive?.rules ?? []).map(currentRuleShape).filter((rule) => Boolean(rule)).map(rule => `${state.stateKey}|${rule.ruleKey}`));
    const alignedDatabase = new Set(dataset.ruleAlignments.map(value => `${value.stateKey}|${value.databaseRuleKey}`));
    const alignedCurrent = new Set(dataset.ruleAlignments.map(value => `${value.stateKey}|${value.currentRuleKey}`));
    return { schemaVersion: 1, matchedStateCount: dataset.matchedStateCount, databaseRuleWithComparableEffectsCount: new Set(databaseRules).size, currentRuleWithComparableEffectsCount: new Set(currentRules).size,
        alignedDatabaseRuleCount: alignedDatabase.size, alignedCurrentRuleCount: alignedCurrent.size, unalignedDatabaseRuleCount: new Set(databaseRules).size - alignedDatabase.size, unalignedCurrentRuleCount: new Set(currentRules).size - alignedCurrent.size,
        ruleAlignmentCount: dataset.ruleAlignments.length, ruleAlignmentCountsByKind: { exact_effect_set_unique: dataset.ruleAlignments.filter(value => value.kind === "exact_effect_set_unique").length, unique_effect_signature_anchor: dataset.ruleAlignments.filter(value => value.kind === "unique_effect_signature_anchor").length }, ruleAlignmentStateCount: new Set(dataset.ruleAlignments.map(value => value.stateKey)).size, ambiguousEffectSignatureCount: dataset.ambiguousEffectSignatures.length,
        exactTurnCandidateCount: dataset.exactTurnRuleAssessments.length, exactTurnRuleAlignedCount: dataset.exactTurnRuleAssessments.filter(value => value.status === "rule_aligned_unique_effect_shape").length, exactTurnRuleAmbiguousCount: dataset.exactTurnRuleAssessments.filter(value => value.status === "rule_alignment_ambiguous").length, exactTurnRuleUnalignedCount: dataset.exactTurnRuleAssessments.filter(value => value.status === "rule_unaligned").length, semanticPromotionCount: 0 };
}
exports.buildDatabaseTeamAnalysisDb13Coverage = buildDatabaseTeamAnalysisDb13Coverage;
//# sourceMappingURL=team-analysis-db13-builder.js.map