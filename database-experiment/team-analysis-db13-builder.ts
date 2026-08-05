import { SiteAuditFixtures } from "./parity";
import { databaseEffectSignature, currentTeamAnalysisEffectSignature } from "./team-analysis-db3-parity";
import { CurrentTeamAnalysisDataset } from "./team-analysis-parity";
import { DatabaseTeamAnalysisDb11Dataset, Db11PassiveRule } from "./team-analysis-db11-contract";
import { DatabaseTeamAnalysisDb12Dataset } from "./team-analysis-db12-contract";
import { DatabaseTeamAnalysisDb13Coverage, DatabaseTeamAnalysisDb13Dataset, Db13AmbiguousEffectSignature, Db13ExactTurnRuleAssessment, Db13RuleAlignment } from "./team-analysis-db13-contract";

type JsonObject = Record<string, unknown>;
interface RuleShape {
    ruleKey: string,
    effectSignatures: string[],
    databaseSource?: Db13RuleAlignment["databaseSource"],
}
function object(value: unknown): JsonObject | undefined { return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : undefined; }
function unique(values: string[]): string[] { return [...new Set(values)].sort(); }
function currentRuleKey(rule: JsonObject, index: number): string { return typeof rule.id === "string" ? rule.id : `current-rule-${index}`; }
function databaseRuleShape(rule: Db11PassiveRule): RuleShape | undefined {
    const effectSignatures = unique(rule.effects.filter(effect => effect.kind !== "unknown").map(databaseEffectSignature)); if (effectSignatures.length === 0) return undefined;
    return { ruleKey: rule.ruleKey, effectSignatures, databaseSource: { passiveSkillRelationId: rule.source.passiveSkillRelationId, passiveSkillId: rule.source.passiveSkillId, efficacyType: rule.source.efficacyType } };
}
function currentRuleShape(value: unknown, index: number): RuleShape | undefined {
    const rule = object(value); if (!rule) return undefined; const effects = Array.isArray(rule.effects) ? rule.effects.map(object).filter((effect): effect is JsonObject => Boolean(effect) && typeof effect!.kind === "string" && effect!.kind !== "unknown") : [];
    const effectSignatures = unique(effects.map(currentTeamAnalysisEffectSignature)); if (effectSignatures.length === 0) return undefined;
    return { ruleKey: currentRuleKey(rule, index), effectSignatures };
}
function signatureRules(rules: RuleShape[]): Map<string, string[]> {
    const result = new Map<string, string[]>(); for (const rule of rules) for (const signature of rule.effectSignatures) { const values = result.get(signature) ?? []; values.push(rule.ruleKey); result.set(signature, values); }
    for (const [signature, values] of result) result.set(signature, unique(values)); return result;
}
function setKey(values: string[]): string { return JSON.stringify(values); }
function buildAlignments(stateKey: string, databaseRules: RuleShape[], currentRules: RuleShape[]): { alignments: Db13RuleAlignment[], ambiguousSignatures: Db13AmbiguousEffectSignature[] } {
    const databaseBySignature = signatureRules(databaseRules); const currentBySignature = signatureRules(currentRules); const ambiguousSignatures: Db13AmbiguousEffectSignature[] = [];
    for (const signature of new Set([...databaseBySignature.keys()].filter(value => currentBySignature.has(value)))) { const databaseRuleKeys = databaseBySignature.get(signature)!; const currentRuleKeys = currentBySignature.get(signature)!; if (databaseRuleKeys.length > 1 || currentRuleKeys.length > 1) ambiguousSignatures.push({ stateKey, effectSignature: signature, databaseRuleKeys, currentRuleKeys }); }
    const databaseSets = new Map<string, string[]>(); const currentSets = new Map<string, string[]>();
    for (const rule of databaseRules) { const values = databaseSets.get(setKey(rule.effectSignatures)) ?? []; values.push(rule.ruleKey); databaseSets.set(setKey(rule.effectSignatures), values); }
    for (const rule of currentRules) { const values = currentSets.get(setKey(rule.effectSignatures)) ?? []; values.push(rule.ruleKey); currentSets.set(setKey(rule.effectSignatures), values); }
    const alignments: Db13RuleAlignment[] = [];
    for (const database of databaseRules) for (const current of currentRules) {
        const shared = database.effectSignatures.filter(signature => current.effectSignatures.includes(signature)); if (shared.length === 0) continue;
        const exactUnique = setKey(database.effectSignatures) === setKey(current.effectSignatures) && databaseSets.get(setKey(database.effectSignatures))?.length === 1 && currentSets.get(setKey(current.effectSignatures))?.length === 1;
        const uniqueAnchor = shared.some(signature => databaseBySignature.get(signature)?.length === 1 && currentBySignature.get(signature)?.length === 1);
        if (!exactUnique && !uniqueAnchor) continue;
        alignments.push({ stateKey, databaseRuleKey: database.ruleKey, currentRuleKey: current.ruleKey, kind: exactUnique ? "exact_effect_set_unique" : "unique_effect_signature_anchor", sharedEffectSignatures: shared, databaseEffectSignatures: database.effectSignatures, currentEffectSignatures: current.effectSignatures, databaseSource: database.databaseSource! });
    }
    return { alignments: alignments.sort((left, right) => left.databaseRuleKey.localeCompare(right.databaseRuleKey, "en", { numeric: true }) || left.currentRuleKey.localeCompare(right.currentRuleKey, "en", { numeric: true })), ambiguousSignatures: ambiguousSignatures.sort((left, right) => left.effectSignature.localeCompare(right.effectSignature)) };
}

export function buildDatabaseTeamAnalysisDb13Dataset(options: {
    db11: DatabaseTeamAnalysisDb11Dataset, db11Sha256: string, db12: DatabaseTeamAnalysisDb12Dataset, db12Sha256: string,
    current: CurrentTeamAnalysisDataset, currentSha256: string, siteAudit: SiteAuditFixtures,
}): DatabaseTeamAnalysisDb13Dataset {
    if (options.db11.contractVersion !== "0.10.0" || options.db12.contractVersion !== "0.11.0" || options.db12.sourceDb11.sha256 !== options.db11Sha256 || options.db12.sourceCurrentTeamAnalysis.sha256 !== options.currentSha256 || options.db12.sourceDatabaseSha256 !== options.db11.sourceSha256 || options.db12.semanticPromotionCount !== 0) throw new Error("DB13 source lineage mismatch");
    const aliases = new Map(options.siteAudit.formProjectionAliases.map(alias => [alias.databaseCardId, alias.projectedCardId])); const projectedKey = (state: DatabaseTeamAnalysisDb11Dataset["states"][number]) => `${state.characterId}:${aliases.get(state.formId) ?? state.formId}:${state.releaseState}`;
    const currentByKey = new Map(options.current.states.map(state => [state.stateKey, state])); const ruleAlignments: Db13RuleAlignment[] = []; const ambiguousEffectSignatures: Db13AmbiguousEffectSignature[] = []; let matchedStateCount = 0;
    for (const state of options.db11.states) {
        const stateKey = projectedKey(state); const currentState = currentByKey.get(stateKey); if (!currentState) continue; matchedStateCount += 1;
        const databaseRules = (state.passive?.rules ?? []).map(databaseRuleShape).filter((rule): rule is RuleShape => Boolean(rule)); const currentRules = (currentState.passive?.rules ?? []).map(currentRuleShape).filter((rule): rule is RuleShape => Boolean(rule));
        const built = buildAlignments(stateKey, databaseRules, currentRules); ruleAlignments.push(...built.alignments); ambiguousEffectSignatures.push(...built.ambiguousSignatures);
    }
    if (matchedStateCount !== options.db12.matchedStateCount) throw new Error("DB13 matched-state lineage mismatch");
    const alignmentByPair = new Map(ruleAlignments.map(value => [`${value.stateKey}|${value.databaseRuleKey}|${value.currentRuleKey}`, value]));
    const exactTurnRuleAssessments: Db13ExactTurnRuleAssessment[] = options.db12.exactTurnEncodingCandidates.map((candidate): Db13ExactTurnRuleAssessment => {
        const currentExactRuleKeys = unique(options.db12.diagnosticCurrentExactTurnAtoms.filter(value => value.stateKey === candidate.stateKey && value.atom.value === candidate.value && candidate.currentExactSignatures.includes(value.atom.structuralSignature)).flatMap(value => value.sourceRuleKeys));
        const alignments = currentExactRuleKeys.map(key => alignmentByPair.get(`${candidate.stateKey}|${candidate.databaseRuleKey}|${key}`)).filter((value): value is Db13RuleAlignment => Boolean(value)); const alignedCurrentRuleKeys = unique(alignments.map(value => value.currentRuleKey));
        return { stateKey: candidate.stateKey, value: candidate.value, databaseRuleKey: candidate.databaseRuleKey, databaseLogicalContext: JSON.parse(candidate.databaseLowerSignature).logicalContext, currentExactRuleKeys, alignedCurrentRuleKeys, alignmentKinds: unique(alignments.map(value => value.kind)) as Db13ExactTurnRuleAssessment["alignmentKinds"], status: alignedCurrentRuleKeys.length === 1 ? "rule_aligned_unique_effect_shape" : alignedCurrentRuleKeys.length > 1 ? "rule_alignment_ambiguous" : "rule_unaligned" };
    }).sort((left, right) => left.stateKey.localeCompare(right.stateKey, "en", { numeric: true }) || left.value - right.value || left.databaseLogicalContext.localeCompare(right.databaseLogicalContext));
    return { schemaVersion: 1, contract: "dokkan-team-analysis-rule-alignment-experiment", contractVersion: "0.12.0", generatedAt: options.db12.generatedAt,
        sourceDb11: { fileName: "team-analysis-db11-experiment.json.gz", sha256: options.db11Sha256, contractVersion: "0.10.0" }, sourceDb12: { fileName: "team-analysis-db12-divergence-attribution.json.gz", sha256: options.db12Sha256, contractVersion: "0.11.0" },
        sourceCurrentTeamAnalysis: { sha256: options.currentSha256, parserVersion: options.current.parserVersion }, sourceSnapshotVersion: options.db11.sourceSnapshotVersion, sourceDatabaseSha256: options.db11.sourceSha256,
        effectFingerprintVersion: "db3-normalized-effect-shape-v1", semanticPromotionCount: 0, matchedStateCount, ruleAlignments: ruleAlignments.sort((left, right) => left.stateKey.localeCompare(right.stateKey, "en", { numeric: true }) || left.databaseRuleKey.localeCompare(right.databaseRuleKey, "en", { numeric: true }) || left.currentRuleKey.localeCompare(right.currentRuleKey, "en", { numeric: true })), ambiguousEffectSignatures: ambiguousEffectSignatures.sort((left, right) => left.stateKey.localeCompare(right.stateKey, "en", { numeric: true }) || left.effectSignature.localeCompare(right.effectSignature)), exactTurnRuleAssessments };
}

export function buildDatabaseTeamAnalysisDb13Coverage(dataset: DatabaseTeamAnalysisDb13Dataset, db11: DatabaseTeamAnalysisDb11Dataset, current: CurrentTeamAnalysisDataset, siteAudit: SiteAuditFixtures): DatabaseTeamAnalysisDb13Coverage {
    const aliases = new Map(siteAudit.formProjectionAliases.map(alias => [alias.databaseCardId, alias.projectedCardId])); const currentKeys = new Set(current.states.map(state => state.stateKey)); const projectedKey = (state: DatabaseTeamAnalysisDb11Dataset["states"][number]) => `${state.characterId}:${aliases.get(state.formId) ?? state.formId}:${state.releaseState}`;
    const databaseRules = db11.states.filter(state => currentKeys.has(projectedKey(state))).flatMap(state => (state.passive?.rules ?? []).map(databaseRuleShape).filter((rule): rule is RuleShape => Boolean(rule)).map(rule => `${projectedKey(state)}|${rule.ruleKey}`));
    const databaseStateKeys = new Set(db11.states.map(projectedKey)); const currentRules = current.states.filter(state => databaseStateKeys.has(state.stateKey)).flatMap(state => (state.passive?.rules ?? []).map(currentRuleShape).filter((rule): rule is RuleShape => Boolean(rule)).map(rule => `${state.stateKey}|${rule.ruleKey}`));
    const alignedDatabase = new Set(dataset.ruleAlignments.map(value => `${value.stateKey}|${value.databaseRuleKey}`)); const alignedCurrent = new Set(dataset.ruleAlignments.map(value => `${value.stateKey}|${value.currentRuleKey}`));
    return { schemaVersion: 1, matchedStateCount: dataset.matchedStateCount, databaseRuleWithComparableEffectsCount: new Set(databaseRules).size, currentRuleWithComparableEffectsCount: new Set(currentRules).size,
        alignedDatabaseRuleCount: alignedDatabase.size, alignedCurrentRuleCount: alignedCurrent.size, unalignedDatabaseRuleCount: new Set(databaseRules).size - alignedDatabase.size, unalignedCurrentRuleCount: new Set(currentRules).size - alignedCurrent.size,
        ruleAlignmentCount: dataset.ruleAlignments.length, ruleAlignmentCountsByKind: { exact_effect_set_unique: dataset.ruleAlignments.filter(value => value.kind === "exact_effect_set_unique").length, unique_effect_signature_anchor: dataset.ruleAlignments.filter(value => value.kind === "unique_effect_signature_anchor").length }, ruleAlignmentStateCount: new Set(dataset.ruleAlignments.map(value => value.stateKey)).size, ambiguousEffectSignatureCount: dataset.ambiguousEffectSignatures.length,
        exactTurnCandidateCount: dataset.exactTurnRuleAssessments.length, exactTurnRuleAlignedCount: dataset.exactTurnRuleAssessments.filter(value => value.status === "rule_aligned_unique_effect_shape").length, exactTurnRuleAmbiguousCount: dataset.exactTurnRuleAssessments.filter(value => value.status === "rule_alignment_ambiguous").length, exactTurnRuleUnalignedCount: dataset.exactTurnRuleAssessments.filter(value => value.status === "rule_unaligned").length, semanticPromotionCount: 0 };
}
