import { SiteAuditFixtures } from "./parity";
import { CurrentTeamAnalysisDataset } from "./team-analysis-parity";
import { DatabaseTeamAnalysisDb11Dataset, Db11ConditionExpression, Db11PassiveRule, Db11RuntimePredicate } from "./team-analysis-db11-contract";
import { DatabaseTeamAnalysisDb13Dataset } from "./team-analysis-db13-contract";
import { DatabaseTeamAnalysisDb14Dataset, Db14ExactTurnCompatibilityAlias } from "./team-analysis-db14-contract";
import { DatabaseTeamAnalysisDb15Coverage, DatabaseTeamAnalysisDb15Dataset, Db15AppliedCompatibilityAlias, Db15RuleConditionParity, Db15RuleParityStatus, Db15RuleParityView } from "./team-analysis-db15-contract";

type JsonObject = Record<string, unknown>;
type DbPredicate = Extract<Db11ConditionExpression, { op: "predicate" }>["predicate"];
interface LogicalContext { combinators: Array<"all" | "any">, negated: boolean }
interface DatabaseAtom { structuralSignature: string, causalityId: string, conjunctionGroup?: string }

function object(value: unknown): JsonObject | undefined { return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : undefined; }
function signature(value: Record<string, unknown>): string { return JSON.stringify(Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).sort(([left], [right]) => left.localeCompare(right)))); }
function descend(context: LogicalContext, combinator: "all" | "any"): LogicalContext { return { combinators: context.combinators[context.combinators.length - 1] === combinator ? context.combinators : [...context.combinators, combinator], negated: context.negated }; }
function isRuntimePredicate(value: DbPredicate): value is Db11RuntimePredicate { const type = (value as Partial<Db11RuntimePredicate>).sourceCausalityType; return type === 43 || type === 51 || type === 55; }
function predicateSignature(predicate: Db11RuntimePredicate, context: LogicalContext): string {
    const logicalContext = context.combinators.join(">") || "direct";
    return predicate.kind === "attacks_evaded"
        ? signature({ kind: predicate.kind, scope: predicate.scope, eventMode: predicate.eventMode, logicalContext, negated: context.negated })
        : signature({ kind: predicate.kind, scope: predicate.scope, comparator: predicate.comparator, value: predicate.value, logicalContext, negated: context.negated });
}
function walkDatabase(value: Db11ConditionExpression, context: LogicalContext, ruleKey: string, path: string, conjunction: string | undefined, output: DatabaseAtom[]): void {
    if (value.op === "predicate" && isRuntimePredicate(value.predicate)) { output.push({ structuralSignature: predicateSignature(value.predicate, context), causalityId: value.predicate.sourceCausalityId, conjunctionGroup: conjunction }); return; }
    if (value.op === "all" || value.op === "any") { const nextContext = descend(context, value.op); const nextConjunction = value.op === "all" ? `${ruleKey}:${path}` : undefined; value.children.forEach((child, index) => walkDatabase(child, nextContext, ruleKey, `${path}.${index}`, nextConjunction, output)); return; }
    if (value.op === "not") walkDatabase(value.child, { combinators: context.combinators, negated: !context.negated }, ruleKey, `${path}.not`, undefined, output);
}
function currentPredicateSignature(predicate: JsonObject, context: LogicalContext): string | undefined {
    const logicalContext = context.combinators.join(">") || "direct";
    if (predicate.kind === "attacks_evaded" && predicate.scope === "self" && object(predicate.combatEvent)?.mode === "current_event") return signature({ kind: "attacks_evaded", scope: "self", eventMode: "current_event", logicalContext, negated: context.negated });
    if (predicate.kind !== "turn_from_entry" || predicate.scope !== "self" || !["lte", "gte", "eq"].includes(String(predicate.comparator)) || !Number.isSafeInteger(predicate.value)) return undefined;
    return signature({ kind: "turn_from_entry", scope: "self", comparator: predicate.comparator, value: predicate.value, logicalContext, negated: context.negated });
}
function walkCurrent(value: unknown, context: LogicalContext, output: string[]): void {
    const expression = object(value); if (!expression) return;
    if (expression.op === "predicate") { const predicate = object(expression.predicate); const normalized = predicate ? currentPredicateSignature(predicate, context) : undefined; if (normalized) output.push(normalized); return; }
    if ((expression.op === "all" || expression.op === "any") && Array.isArray(expression.children)) { const op = expression.op as "all" | "any"; expression.children.forEach(child => walkCurrent(child, descend(context, op), output)); return; }
    if (expression.op === "not") walkCurrent(expression.child, { combinators: context.combinators, negated: !context.negated }, output);
}
function view(database: string[], current: string[]): Db15RuleParityView {
    const db = [...database].sort(); const site = [...current].sort(); const remainingCurrent = new Map<string, number>(); for (const value of site) remainingCurrent.set(value, (remainingCurrent.get(value) ?? 0) + 1);
    const matchedSignatures: string[] = []; const databaseOnlySignatures: string[] = []; for (const value of db) { const count = remainingCurrent.get(value) ?? 0; if (count > 0) { matchedSignatures.push(value); remainingCurrent.set(value, count - 1); } else databaseOnlySignatures.push(value); }
    const currentOnlySignatures = [...remainingCurrent.entries()].flatMap(([value, count]) => Array.from({ length: count }, () => value)).sort();
    const status: Db15RuleParityStatus = databaseOnlySignatures.length === 0 && currentOnlySignatures.length === 0 ? "exact" : matchedSignatures.length > 0 ? "partial" : "divergent";
    return { databaseSignatures: db, currentSignatures: site, matchedSignatures, databaseOnlySignatures, currentOnlySignatures, status };
}
function currentRuleKey(value: JsonObject, index: number): string { return typeof value.id === "string" ? value.id : `current-rule-${index}`; }
function applyAlias(alias: Db14ExactTurnCompatibilityAlias, atoms: DatabaseAtom[], databaseSignatures: string[], currentSignatures: string[]): Db15AppliedCompatibilityAlias {
    const find = (causalityId: string) => atoms.filter(atom => atom.causalityId === causalityId && atom.conjunctionGroup === alias.nativeBounds.conjunctionGroup);
    const lower = find(alias.nativeBounds.lower.causalityId); const upper = find(alias.nativeBounds.upper.causalityId);
    if (lower.length !== 1 || upper.length !== 1) throw new Error(`DB15 expected one native atom per alias bound, got ${lower.length}/${upper.length}`);
    const lowerSignature = lower[0].structuralSignature; const upperSignature = upper[0].structuralSignature;
    if (JSON.parse(lowerSignature).negated !== alias.nativeBounds.negated || JSON.parse(upperSignature).negated !== alias.nativeBounds.negated || alias.compatibilityNegated !== alias.nativeBounds.negated) throw new Error("DB15 alias polarity mismatch");
    const removeOne = (value: string) => { const index = databaseSignatures.indexOf(value); if (index < 0) throw new Error("DB15 native alias signature already consumed"); databaseSignatures.splice(index, 1); };
    removeOne(lowerSignature); removeOne(upperSignature);
    if (!currentSignatures.includes(alias.compatibilitySignature)) throw new Error("DB15 current exact signature missing");
    databaseSignatures.push(alias.compatibilitySignature);
    return { value: alias.value, negated: alias.compatibilityNegated, nativeLowerSignature: lowerSignature, nativeUpperSignature: upperSignature, compatibilitySignature: alias.compatibilitySignature };
}

export function buildDatabaseTeamAnalysisDb15Dataset(options: {
    db11: DatabaseTeamAnalysisDb11Dataset, db11Sha256: string, db13: DatabaseTeamAnalysisDb13Dataset, db13Sha256: string,
    db14: DatabaseTeamAnalysisDb14Dataset, db14Sha256: string, current: CurrentTeamAnalysisDataset, currentSha256: string, siteAudit: SiteAuditFixtures,
}): DatabaseTeamAnalysisDb15Dataset {
    if (options.db11.contractVersion !== "0.10.0" || options.db13.contractVersion !== "0.12.1" || options.db14.contractVersion !== "0.13.0" ||
        options.db13.sourceDb11.sha256 !== options.db11Sha256 || options.db14.sourceDb11.sha256 !== options.db11Sha256 || options.db14.sourceDb13.sha256 !== options.db13Sha256 ||
        options.db13.sourceCurrentTeamAnalysis.sha256 !== options.currentSha256 || options.db14.sourceCurrentTeamAnalysis.sha256 !== options.currentSha256 ||
        options.db11.sourceSha256 !== options.db13.sourceDatabaseSha256 || options.db11.sourceSha256 !== options.db14.sourceDatabaseSha256 || options.db13.semanticPromotionCount !== 0 || options.db14.semanticPromotionCount !== 0) throw new Error("DB15 source lineage mismatch");
    const aliases = new Map(options.siteAudit.formProjectionAliases.map(alias => [alias.databaseCardId, alias.projectedCardId])); const projectedKey = (state: DatabaseTeamAnalysisDb11Dataset["states"][number]) => `${state.characterId}:${aliases.get(state.formId) ?? state.formId}:${state.releaseState}`;
    const databaseStates = new Map(options.db11.states.map(state => [projectedKey(state), state])); const currentStates = new Map(options.current.states.map(state => [state.stateKey, state]));
    const aliasesByPair = new Map<string, Db14ExactTurnCompatibilityAlias[]>(); for (const alias of options.db14.exactTurnCompatibilityAliases) { const key = `${alias.stateKey}|${alias.databaseRuleKey}|${alias.currentRuleKey}`; const values = aliasesByPair.get(key) ?? []; values.push(alias); aliasesByPair.set(key, values); }
    const ruleConditionParity: Db15RuleConditionParity[] = []; let appliedAliasCount = 0;
    for (const alignment of options.db13.ruleAlignments) {
        const databaseState = databaseStates.get(alignment.stateKey); const currentState = currentStates.get(alignment.stateKey); if (!databaseState || !currentState) throw new Error("DB15 aligned state missing");
        const databaseRule = databaseState.passive?.rules.find(rule => rule.ruleKey === alignment.databaseRuleKey); if (!databaseRule) throw new Error("DB15 aligned database rule missing");
        const currentRules = (currentState.passive?.rules ?? []).map((rule, index) => ({ key: currentRuleKey(rule as JsonObject, index), rule: rule as JsonObject })); const currentRule = currentRules.find(value => value.key === alignment.currentRuleKey)?.rule; if (!currentRule) throw new Error("DB15 aligned current rule missing");
        const databaseAtoms: DatabaseAtom[] = []; walkDatabase((databaseRule as Db11PassiveRule).condition, { combinators: [], negated: false }, alignment.databaseRuleKey, "root", undefined, databaseAtoms); const nativeSignatures = databaseAtoms.map(atom => atom.structuralSignature).sort();
        const currentSignatures: string[] = []; walkCurrent(currentRule.condition, { combinators: [], negated: false }, currentSignatures); currentSignatures.sort();
        if (nativeSignatures.length === 0 && currentSignatures.length === 0) continue;
        const comparisonDatabase = [...nativeSignatures]; const comparisonCurrent = [...currentSignatures]; const pairKey = `${alignment.stateKey}|${alignment.databaseRuleKey}|${alignment.currentRuleKey}`;
        const appliedCompatibilityAliases = (aliasesByPair.get(pairKey) ?? []).sort((left, right) => left.value - right.value || Number(left.compatibilityNegated) - Number(right.compatibilityNegated)).map(alias => applyAlias(alias, databaseAtoms, comparisonDatabase, comparisonCurrent)); appliedAliasCount += appliedCompatibilityAliases.length;
        ruleConditionParity.push({ stateKey: alignment.stateKey, databaseRuleKey: alignment.databaseRuleKey, currentRuleKey: alignment.currentRuleKey, ruleAlignmentKind: alignment.kind, appliedCompatibilityAliases,
            baseline: view(nativeSignatures, currentSignatures), withCompatibilityAliases: view(comparisonDatabase, comparisonCurrent) });
    }
    if (appliedAliasCount !== options.db14.exactTurnCompatibilityAliases.length) throw new Error(`DB15 applied ${appliedAliasCount}/${options.db14.exactTurnCompatibilityAliases.length} aliases`);
    return { schemaVersion: 1, contract: "dokkan-team-analysis-rule-condition-parity-experiment", contractVersion: "0.14.0", generatedAt: options.db14.generatedAt,
        sourceDb11: { fileName: "team-analysis-db11-experiment.json.gz", sha256: options.db11Sha256, contractVersion: "0.10.0" }, sourceDb13: { fileName: "team-analysis-db13-rule-alignment.json.gz", sha256: options.db13Sha256, contractVersion: "0.12.1" }, sourceDb14: { fileName: "team-analysis-db14-exact-turn-compatibility.json.gz", sha256: options.db14Sha256, contractVersion: "0.13.0" },
        sourceCurrentTeamAnalysis: options.db14.sourceCurrentTeamAnalysis, sourceSnapshotVersion: options.db11.sourceSnapshotVersion, sourceDatabaseSha256: options.db11.sourceSha256, comparisonUniverse: "runtime-types-43-51-55-plus-current-exact-turn", semanticPromotionCount: 0,
        alignedRulePairCount: options.db13.ruleAlignments.length, ruleConditionParity: ruleConditionParity.sort((left, right) => left.stateKey.localeCompare(right.stateKey, "en", { numeric: true }) || left.databaseRuleKey.localeCompare(right.databaseRuleKey, "en", { numeric: true }) || left.currentRuleKey.localeCompare(right.currentRuleKey, "en", { numeric: true })) };
}

export function buildDatabaseTeamAnalysisDb15Coverage(dataset: DatabaseTeamAnalysisDb15Dataset): DatabaseTeamAnalysisDb15Coverage {
    const records = dataset.ruleConditionParity; const counts = (select: (record: Db15RuleConditionParity) => Db15RuleParityView) => ({ exact: records.filter(record => select(record).status === "exact").length, partial: records.filter(record => select(record).status === "partial").length, divergent: records.filter(record => select(record).status === "divergent").length });
    const baselinePairCounts = counts(record => record.baseline); const compatibilityPairCounts = counts(record => record.withCompatibilityAliases); const sum = (select: (record: Db15RuleConditionParity) => number) => records.reduce((total, record) => total + select(record), 0);
    return { schemaVersion: 1, alignedRulePairCount: dataset.alignedRulePairCount, comparableRulePairCount: records.length, noComparableConditionRulePairCount: dataset.alignedRulePairCount - records.length, baselinePairCounts, compatibilityPairCounts, exactPairDelta: compatibilityPairCounts.exact - baselinePairCounts.exact,
        baselineMatchedSignatureOccurrenceCount: sum(record => record.baseline.matchedSignatures.length), compatibilityMatchedSignatureOccurrenceCount: sum(record => record.withCompatibilityAliases.matchedSignatures.length), baselineDatabaseOnlySignatureOccurrenceCount: sum(record => record.baseline.databaseOnlySignatures.length), compatibilityDatabaseOnlySignatureOccurrenceCount: sum(record => record.withCompatibilityAliases.databaseOnlySignatures.length), baselineCurrentOnlySignatureOccurrenceCount: sum(record => record.baseline.currentOnlySignatures.length), compatibilityCurrentOnlySignatureOccurrenceCount: sum(record => record.withCompatibilityAliases.currentOnlySignatures.length),
        appliedCompatibilityAliasCount: sum(record => record.appliedCompatibilityAliases.length), resolvedNativeSignatureOccurrenceCount: sum(record => record.appliedCompatibilityAliases.length * 2), matchedCurrentExactSignatureOccurrenceCount: sum(record => record.appliedCompatibilityAliases.length), semanticPromotionCount: 0 };
}
