import { SiteAuditFixtures } from "./parity";
import { CurrentTeamAnalysisDataset } from "./team-analysis-parity";
import { DatabaseTeamAnalysisDb11Dataset, DatabaseTeamAnalysisDb11Parity, Db11ConditionExpression, Db11RuntimePredicate } from "./team-analysis-db11-contract";
import { DatabaseTeamAnalysisDb12Coverage, DatabaseTeamAnalysisDb12Dataset, Db12AttributionReason, Db12ComparableAtom, Db12DivergenceAttribution, Db12ExactTurnEncodingCandidate } from "./team-analysis-db12-contract";

type JsonObject = Record<string, unknown>;
type Db11Predicate = Extract<Db11ConditionExpression, { op: "predicate" }>["predicate"];
interface LogicalContext { combinators: Array<"all" | "any">, negated: boolean }
interface InternalAtom extends Db12ComparableAtom { ruleKey: string, conjunctionGroup?: string }
interface Conjunction { id: string }

function object(value: unknown): JsonObject | undefined { return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : undefined; }
function isRuntimePredicate(value: Db11Predicate): value is Db11RuntimePredicate {
    const type = (value as Partial<Db11RuntimePredicate>).sourceCausalityType; return type === 43 || type === 51 || type === 55;
}
function descend(context: LogicalContext, combinator: "all" | "any"): LogicalContext {
    return { combinators: context.combinators[context.combinators.length - 1] === combinator ? context.combinators : [...context.combinators, combinator], negated: context.negated };
}
function structuralSignature(atom: Omit<Db12ComparableAtom, "structuralSignature" | "causalityType">): string {
    return JSON.stringify(Object.fromEntries(Object.entries(atom).filter(([, value]) => value !== undefined).sort(([left], [right]) => left.localeCompare(right))));
}
function atomCore(atom: Db12ComparableAtom): string {
    return JSON.stringify({ kind: atom.kind, scope: atom.scope, comparator: atom.comparator, value: atom.value, eventMode: atom.eventMode });
}
function databaseAtom(predicate: Db11RuntimePredicate, context: LogicalContext, ruleKey: string, conjunction?: Conjunction): InternalAtom {
    const base = predicate.kind === "attacks_evaded"
        ? { kind: predicate.kind, scope: predicate.scope, eventMode: predicate.eventMode, logicalContext: context.combinators.join(">") || "direct", negated: context.negated }
        : { kind: predicate.kind, scope: predicate.scope, comparator: predicate.comparator, value: predicate.value, logicalContext: context.combinators.join(">") || "direct", negated: context.negated };
    return { ...base, causalityType: predicate.sourceCausalityType, structuralSignature: structuralSignature(base), ruleKey, conjunctionGroup: conjunction?.id };
}
function currentAtom(predicate: JsonObject, context: LogicalContext, ruleKey: string, conjunction?: Conjunction): InternalAtom | undefined {
    const logicalContext = context.combinators.join(">") || "direct";
    if (predicate.kind === "attacks_evaded" && predicate.scope === "self" && object(predicate.combatEvent)?.mode === "current_event") {
        const base = { kind: "attacks_evaded" as const, scope: "self" as const, eventMode: "current_event" as const, logicalContext, negated: context.negated };
        return { ...base, causalityType: 43, structuralSignature: structuralSignature(base), ruleKey, conjunctionGroup: conjunction?.id };
    }
    if (predicate.kind !== "turn_from_entry" || predicate.scope !== "self" || !Number.isSafeInteger(predicate.value) || !["lte", "gte", "eq"].includes(String(predicate.comparator))) return undefined;
    const comparator = predicate.comparator as "lte" | "gte" | "eq"; const base = { kind: "turn_from_entry" as const, scope: "self" as const, comparator, value: predicate.value as number, logicalContext, negated: context.negated };
    return { ...base, causalityType: comparator === "lte" ? 51 : comparator === "gte" ? 55 : undefined, structuralSignature: structuralSignature(base), ruleKey, conjunctionGroup: conjunction?.id };
}
function walkDatabase(value: Db11ConditionExpression, context: LogicalContext, ruleKey: string, path: string, conjunction: Conjunction | undefined, output: InternalAtom[]): void {
    if (value.op === "predicate" && isRuntimePredicate(value.predicate)) { output.push(databaseAtom(value.predicate, context, ruleKey, conjunction)); return; }
    if (value.op === "all" || value.op === "any") {
        const nextContext = descend(context, value.op); const nextConjunction = value.op === "all" ? { id: `${ruleKey}:${path}` } : undefined;
        value.children.forEach((child, index) => walkDatabase(child, nextContext, ruleKey, `${path}.${index}`, nextConjunction, output)); return;
    }
    if (value.op === "not") walkDatabase(value.child, { combinators: context.combinators, negated: !context.negated }, ruleKey, `${path}.not`, undefined, output);
}
function walkCurrent(value: unknown, context: LogicalContext, ruleKey: string, path: string, conjunction: Conjunction | undefined, output: InternalAtom[]): void {
    const expression = object(value); if (!expression) return;
    if (expression.op === "predicate") { const predicate = object(expression.predicate); const atom = predicate ? currentAtom(predicate, context, ruleKey, conjunction) : undefined; if (atom) output.push(atom); return; }
    if ((expression.op === "all" || expression.op === "any") && Array.isArray(expression.children)) {
        const op = expression.op as "all" | "any"; const nextContext = descend(context, op); const nextConjunction = op === "all" ? { id: `${ruleKey}:${path}` } : undefined;
        expression.children.forEach((child, index) => walkCurrent(child, nextContext, ruleKey, `${path}.${index}`, nextConjunction, output)); return;
    }
    if (expression.op === "not") walkCurrent(expression.child, { combinators: context.combinators, negated: !context.negated }, ruleKey, `${path}.not`, undefined, output);
}
function uniqueAtoms(values: InternalAtom[]): InternalAtom[] { return [...new Map(values.map(value => [value.structuralSignature, value])).values()].sort((left, right) => left.structuralSignature.localeCompare(right.structuralSignature)); }
function publicAtom(value: InternalAtom): Db12ComparableAtom { const { ruleKey: _ruleKey, conjunctionGroup: _conjunctionGroup, ...atom } = value; return atom; }
function exactTurnCandidates(stateKey: string, database: InternalAtom[], current: InternalAtom[]): Db12ExactTurnEncodingCandidate[] {
    const currentExact = current.filter(value => value.kind === "turn_from_entry" && value.comparator === "eq"); const candidates = new Map<string, Db12ExactTurnEncodingCandidate>();
    const grouped = new Map<string, InternalAtom[]>();
    for (const atom of database.filter(value => value.kind === "turn_from_entry" && value.conjunctionGroup)) {
        const key = `${atom.ruleKey}|${atom.conjunctionGroup}|${atom.negated}|${atom.value}`; const values = grouped.get(key) ?? []; values.push(atom); grouped.set(key, values);
    }
    for (const atoms of grouped.values()) {
        const lower = atoms.find(value => value.comparator === "gte"); const upper = atoms.find(value => value.comparator === "lte"); if (!lower || !upper || lower.value !== upper.value) continue;
        const exact = currentExact.filter(value => value.value === lower.value && value.negated === lower.negated); if (exact.length === 0) continue;
        const key = `${stateKey}|${lower.value}|${lower.negated}|${lower.logicalContext}`;
        if (!candidates.has(key)) candidates.set(key, {
            stateKey, value: lower.value!, negated: lower.negated, databaseRuleKey: lower.ruleKey, databaseConjunctionGroup: lower.conjunctionGroup!,
            databaseLowerSignature: lower.structuralSignature, databaseUpperSignature: upper.structuralSignature,
            currentExactSignatures: [...new Set(exact.map(value => value.structuralSignature))].sort(), status: "candidate_not_rule_aligned",
        });
    }
    return [...candidates.values()].sort((left, right) => left.value - right.value || left.databaseRuleKey.localeCompare(right.databaseRuleKey, "en", { numeric: true }));
}
function classify(atom: InternalAtom, comparableOthers: InternalAtom[], diagnosticOthers: InternalAtom[], exactCandidateSignatures: Set<string>, side: "database" | "current"): { reason: Db12AttributionReason, candidates: string[] } {
    const sameCore = comparableOthers.filter(value => atomCore(value) === atomCore(atom));
    const context = sameCore.filter(value => value.negated === atom.negated && value.logicalContext !== atom.logicalContext);
    if (context.length > 0) return { reason: "logical_context_mismatch", candidates: context.map(value => value.structuralSignature) };
    const polarity = sameCore.filter(value => value.negated !== atom.negated);
    if (polarity.length > 0) return { reason: "polarity_mismatch", candidates: polarity.map(value => value.structuralSignature) };
    if (exactCandidateSignatures.has(atom.structuralSignature)) return { reason: "exact_turn_encoding_candidate", candidates: diagnosticOthers.filter(value => value.kind === "turn_from_entry" && value.comparator === "eq" && value.value === atom.value).map(value => value.structuralSignature) };
    const threshold = comparableOthers.filter(value => value.kind === atom.kind && value.scope === atom.scope && value.comparator === atom.comparator && value.logicalContext === atom.logicalContext && value.negated === atom.negated && value.value !== atom.value);
    if (threshold.length > 0) return { reason: "threshold_mismatch", candidates: threshold.map(value => value.structuralSignature) };
    const comparator = comparableOthers.filter(value => value.kind === atom.kind && value.scope === atom.scope && value.value === atom.value && value.logicalContext === atom.logicalContext && value.negated === atom.negated && value.comparator !== atom.comparator);
    if (comparator.length > 0) return { reason: "comparator_mismatch", candidates: comparator.map(value => value.structuralSignature) };
    return { reason: side === "database" ? "absent_in_current" : "absent_in_database", candidates: [] };
}
function attribution(side: "database" | "current", stateKey: string, atom: InternalAtom, ownOccurrences: InternalAtom[], comparableOthers: InternalAtom[], diagnosticOthers: InternalAtom[], exactCandidateSignatures: Set<string>): Db12DivergenceAttribution {
    const classified = classify(atom, comparableOthers, diagnosticOthers, exactCandidateSignatures, side); const candidates = [...new Set(classified.candidates)].sort();
    const sourceRuleKeys = [...new Set(ownOccurrences.filter(value => value.structuralSignature === atom.structuralSignature).map(value => value.ruleKey))].sort((left, right) => left.localeCompare(right, "en", { numeric: true }));
    return { side, stateKey, atom: publicAtom(atom), sourceRuleKeys, reason: classified.reason, candidateSignatureCount: candidates.length, candidateSignatures: candidates.slice(0, 12) };
}
function emptyReasonCounts(): Record<Db12AttributionReason, number> { return { logical_context_mismatch: 0, polarity_mismatch: 0, exact_turn_encoding_candidate: 0, threshold_mismatch: 0, comparator_mismatch: 0, absent_in_current: 0, absent_in_database: 0 }; }

export function buildDatabaseTeamAnalysisDb12Dataset(options: {
    db11: DatabaseTeamAnalysisDb11Dataset, db11Sha256: string, db11Parity: DatabaseTeamAnalysisDb11Parity, db11ParitySha256: string,
    current: CurrentTeamAnalysisDataset, currentSha256: string, siteAudit: SiteAuditFixtures,
}): DatabaseTeamAnalysisDb12Dataset {
    if (options.db11.contractVersion !== "0.10.0" || options.db11Parity.schemaVersion !== 1) throw new Error("DB12 source contract mismatch");
    const aliases = new Map(options.siteAudit.formProjectionAliases.map(alias => [alias.databaseCardId, alias.projectedCardId]));
    const projectedKey = (state: DatabaseTeamAnalysisDb11Dataset["states"][number]) => `${state.characterId}:${aliases.get(state.formId) ?? state.formId}:${state.releaseState}`;
    const currentByKey = new Map(options.current.states.map(state => [state.stateKey, state])); const projectedDatabaseKeys = new Set(options.db11.states.map(projectedKey));
    const databaseOnlyStateKeys = [...new Set(options.db11.states.map(projectedKey).filter(key => !currentByKey.has(key)))].sort((left, right) => left.localeCompare(right, "en", { numeric: true }));
    const currentOnlyStateKeys = [...new Set(options.current.states.map(state => state.stateKey).filter(key => !projectedDatabaseKeys.has(key)))].sort((left, right) => left.localeCompare(right, "en", { numeric: true }));
    const databaseOnlyAttributions: Db12DivergenceAttribution[] = []; const currentOnlyAttributions: Db12DivergenceAttribution[] = []; const diagnosticCurrentExactTurnAtoms: Array<{ stateKey: string, atom: Db12ComparableAtom, sourceRuleKeys: string[] }> = []; const exactTurnEncodingCandidates: Db12ExactTurnEncodingCandidate[] = []; let matchedStateCount = 0; let exactMatchCount = 0;
    for (const state of options.db11.states) {
        const stateKey = projectedKey(state); const currentState = currentByKey.get(stateKey); if (!currentState) continue; matchedStateCount += 1;
        const databaseAtoms: InternalAtom[] = []; const currentAtoms: InternalAtom[] = [];
        (state.passive?.rules ?? []).forEach((rule, index) => walkDatabase(rule.condition, { combinators: [], negated: false }, rule.ruleKey || `db-rule-${index}`, "root", undefined, databaseAtoms));
        (currentState.passive?.rules ?? []).forEach((rule, index) => { const value = rule as JsonObject; walkCurrent(value.condition, { combinators: [], negated: false }, typeof value.id === "string" ? value.id : `current-rule-${index}`, "root", undefined, currentAtoms); });
        const databaseUnique = uniqueAtoms(databaseAtoms); const currentComparable = uniqueAtoms(currentAtoms.filter(value => value.comparator !== "eq")); const currentUnique = uniqueAtoms(currentAtoms);
        diagnosticCurrentExactTurnAtoms.push(...currentUnique.filter(value => value.kind === "turn_from_entry" && value.comparator === "eq").map(atom => ({
            stateKey, atom: publicAtom(atom), sourceRuleKeys: [...new Set(currentAtoms.filter(value => value.structuralSignature === atom.structuralSignature).map(value => value.ruleKey))].sort((left, right) => left.localeCompare(right, "en", { numeric: true })),
        })));
        const currentSignatures = new Set(currentComparable.map(value => value.structuralSignature)); const databaseSignatures = new Set(databaseUnique.map(value => value.structuralSignature));
        exactMatchCount += databaseUnique.filter(value => currentSignatures.has(value.structuralSignature)).length;
        const candidates = exactTurnCandidates(stateKey, databaseAtoms, currentAtoms); exactTurnEncodingCandidates.push(...candidates);
        const candidateDatabaseSignatures = new Set(candidates.flatMap(value => [value.databaseLowerSignature, value.databaseUpperSignature]));
        const candidateCurrentSignatures = new Set(candidates.flatMap(value => value.currentExactSignatures));
        for (const atom of databaseUnique.filter(value => !currentSignatures.has(value.structuralSignature))) databaseOnlyAttributions.push(attribution("database", stateKey, atom, databaseAtoms, currentComparable, currentUnique, candidateDatabaseSignatures));
        for (const atom of currentComparable.filter(value => !databaseSignatures.has(value.structuralSignature))) currentOnlyAttributions.push(attribution("current", stateKey, atom, currentAtoms, databaseUnique, databaseUnique, candidateCurrentSignatures));
    }
    const expectedDatabaseOnly = options.db11Parity.promotedStructuralSignatures.database - options.db11Parity.promotedStructuralSignatures.matched;
    const expectedCurrentOnly = options.db11Parity.promotedStructuralSignatures.current - options.db11Parity.promotedStructuralSignatures.matched;
    if (matchedStateCount !== options.db11Parity.matchedStateCount || exactMatchCount !== options.db11Parity.promotedStructuralSignatures.matched || databaseOnlyAttributions.length !== expectedDatabaseOnly || currentOnlyAttributions.length !== expectedCurrentOnly) throw new Error("DB12 DB11 parity reconciliation mismatch");
    const compare = (left: Db12DivergenceAttribution, right: Db12DivergenceAttribution) => left.stateKey.localeCompare(right.stateKey, "en", { numeric: true }) || left.atom.structuralSignature.localeCompare(right.atom.structuralSignature);
    return {
        schemaVersion: 1, contract: "dokkan-team-analysis-divergence-attribution-experiment", contractVersion: "0.11.0", generatedAt: options.db11.generatedAt,
        sourceDb11: { fileName: "team-analysis-db11-experiment.json.gz", sha256: options.db11Sha256, contractVersion: "0.10.0" },
        sourceDb11Parity: { fileName: "team-analysis-db11-parity.json", sha256: options.db11ParitySha256, schemaVersion: 1 },
        sourceCurrentTeamAnalysis: { sha256: options.currentSha256, parserVersion: options.current.parserVersion }, sourceSnapshotVersion: options.db11.sourceSnapshotVersion, sourceDatabaseSha256: options.db11.sourceSha256,
        semanticPromotionCount: 0, matchedStateCount, databaseOnlyStateKeys, currentOnlyStateKeys, databaseOnlyAttributions: databaseOnlyAttributions.sort(compare), currentOnlyAttributions: currentOnlyAttributions.sort(compare),
        diagnosticCurrentExactTurnAtoms: diagnosticCurrentExactTurnAtoms.sort((left, right) => left.stateKey.localeCompare(right.stateKey, "en", { numeric: true }) || left.atom.structuralSignature.localeCompare(right.atom.structuralSignature)),
        exactTurnEncodingCandidates: exactTurnEncodingCandidates.sort((left, right) => left.stateKey.localeCompare(right.stateKey, "en", { numeric: true }) || left.value - right.value || left.databaseRuleKey.localeCompare(right.databaseRuleKey, "en", { numeric: true })),
    };
}

export function buildDatabaseTeamAnalysisDb12Coverage(dataset: DatabaseTeamAnalysisDb12Dataset, db11Parity: DatabaseTeamAnalysisDb11Parity): DatabaseTeamAnalysisDb12Coverage {
    const counts = (values: Db12DivergenceAttribution[]) => { const result = emptyReasonCounts(); values.forEach(value => result[value.reason] += 1); return result; };
    const types = (values: Db12DivergenceAttribution[]) => Object.fromEntries([43, 51, 55].map(type => [String(type), values.filter(value => value.atom.causalityType === type).length]));
    return {
        schemaVersion: 1, matchedStateCount: dataset.matchedStateCount, databaseOnlyStateCount: dataset.databaseOnlyStateKeys.length, currentOnlyStateCount: dataset.currentOnlyStateKeys.length,
        exactStructuralMatchCount: db11Parity.promotedStructuralSignatures.matched, databaseOnlySignatureCount: dataset.databaseOnlyAttributions.length, currentOnlySignatureCount: dataset.currentOnlyAttributions.length,
        databaseOnlyCountsByReason: counts(dataset.databaseOnlyAttributions), currentOnlyCountsByReason: counts(dataset.currentOnlyAttributions),
        databaseOnlyCountsByType: types(dataset.databaseOnlyAttributions), currentOnlyCountsByType: types(dataset.currentOnlyAttributions),
        exactTurnEncodingCandidateCount: dataset.exactTurnEncodingCandidates.length, exactTurnEncodingCandidateStateCount: new Set(dataset.exactTurnEncodingCandidates.map(value => value.stateKey)).size,
        diagnosticCurrentExactTurnAtomCount: dataset.diagnosticCurrentExactTurnAtoms.length,
        candidateCurrentExactTurnAtomCount: new Set(dataset.exactTurnEncodingCandidates.flatMap(value => value.currentExactSignatures.map(signature => `${value.stateKey}|${signature}`))).size, semanticPromotionCount: 0,
    };
}
