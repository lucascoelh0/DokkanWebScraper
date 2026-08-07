import { Db48RuleProjection, DatabaseTeamAnalysisDb48Dataset } from "../database-experiment/team-analysis-db48-contract";
import { Db49RuleProjection, DatabaseTeamAnalysisDb49Dataset } from "../database-experiment/team-analysis-db49-contract";
import { DatabaseTeamAnalysisDb50Dataset, Db50Projection } from "../database-experiment/team-analysis-db50-contract";
import { IntegrationC1Dataset, IntegrationC1Validation, IntegrationDimension, IntegrationRuleDimensions } from "./integration-c1-contract";
import { buildIntegrationC1Dataset, IntegrationC1Sources, parseIntegrationStateKey, sha256Json } from "./integration-c1-builder";

const key = (value: { stateKey: string; ruleKey: string; efficacyType: number }) => `${value.stateKey}|${value.ruleKey}|${value.efficacyType}`;
export function isExplicitIntegrationDimension(value: IntegrationDimension<unknown>): boolean {
    const hasValue = Object.prototype.hasOwnProperty.call(value, "value"), hasMissing = Array.isArray((value as { missing?: unknown }).missing) && (value as { missing: unknown[] }).missing.length > 0;
    return value.status === "supported" ? hasValue && !hasMissing : !hasValue && hasMissing;
}
export const hasExpectedIntegrationDimensions = (actual: IntegrationRuleDimensions, expected: IntegrationRuleDimensions) => JSON.stringify(actual) === JSON.stringify(expected);
function db48Raw(source: Db48RuleProjection): Record<string, unknown> { return { sourceEffectCount: source.sourceEffectCount, effValue1: source.damageRateInput.rawRemainingDamageRatePercentPoints, effValue2: source.ignoredHandlerParameters.rawEffValue2, effValue3: source.ignoredHandlerParameters.rawEffValue3, calculationOption: source.ignoredHandlerParameters.rawCalculationOption, probability: source.rawProbability, executionTimingType: source.rawExecutionTimingType, targetType: source.target.candidate.raw, subTargetTypeSetId: source.target.subTarget.rawSetId, turn: source.lifecycle.duration.rawTurn, isOnce: source.lifecycle.onceOnly.rawIsOnce }; }
function db49Raw(source: Db49RuleProjection): Record<string, unknown> { return { sourceEffectCount: source.sourceEffectCount, effValue1: source.effect.handlerParameters.rawEffValue1, effValue2: source.effect.handlerParameters.rawEffValue2, effValue3: source.effect.handlerParameters.rawEffValue3, calculationOption: source.effect.handlerParameters.rawCalculationOption, probability: source.rawProbability, executionTimingType: source.rawExecutionTimingType, targetType: source.target.candidate.raw, subTargetTypeSetId: source.target.subTarget.rawSetId, turn: source.lifecycle.duration.rawTurn, isOnce: source.lifecycle.onceOnly.rawIsOnce }; }
function db50Raw(source: Db50Projection): Record<string, unknown> { return { sourceEffectCount: source.sourceEffectCount, resistDamageRate: source.payload.resistDamageRate.raw, increaseDamagePercent: source.payload.increaseDamagePercent.raw, battleScriptNo: source.payload.battleScriptNo.raw, activation: source.rawActivation }; }
type LocatedSource = { gate: "DB48"; sha256: string; value: Db48RuleProjection; raw: Record<string, unknown> } | { gate: "DB49"; sha256: string; value: Db49RuleProjection; raw: Record<string, unknown> } | { gate: "DB50"; sha256: string; value: Db50Projection; raw: Record<string, unknown> };
function sourceMap(sources: IntegrationC1Sources): Map<string, LocatedSource> {
    const result = new Map<string, LocatedSource>();
    for (const value of sources.db48.ruleProjections) result.set(key(value), { gate: "DB48", sha256: sources.db48Sha256, value, raw: db48Raw(value) });
    for (const value of sources.db49.ruleProjections) result.set(key(value), { gate: "DB49", sha256: sources.db49Sha256, value, raw: db49Raw(value) });
    for (const value of sources.db50.projections) result.set(key(value), { gate: "DB50", sha256: sources.db50Sha256, value, raw: db50Raw(value) });
    return result;
}
export function validateIntegrationC1Dataset(dataset: IntegrationC1Dataset, sources: IntegrationC1Sources): IntegrationC1Validation {
    const failures: string[] = [];
    if (dataset.schemaVersion !== 1 || dataset.contract !== "dokkan-team-analysis-database-first-sidecar-audit" || dataset.contractVersion !== "1.0.0" || dataset.generatedAt !== sources.db48.generatedAt || dataset.sourceSnapshotVersion !== sources.db48.sourceSnapshotVersion || dataset.sourceDatabaseSha256 !== sources.db48.sourceDatabaseSha256 || dataset.nativeRuntimeSha256 !== sources.db48.nativeRuntime.sha256) failures.push("dataset identity");
    const expectedSources = [{ gate: "DB48", fileName: "team-analysis-db48-damage-mitigation.json.gz", sha256: sources.db48Sha256, contractVersion: "0.47.0", recordCount: sources.db48.ruleProjections.length }, { gate: "DB49", fileName: "team-analysis-db49-forced-guard.json.gz", sha256: sources.db49Sha256, contractVersion: "0.48.0", recordCount: sources.db49.ruleProjections.length }, { gate: "DB50", fileName: "team-analysis-db50-counter-consumer.json.gz", sha256: sources.db50Sha256, contractVersion: "0.49.0", recordCount: sources.db50.projections.length }];
    if (JSON.stringify(dataset.sources) !== JSON.stringify(expectedSources)) failures.push("source lineage");
    const sourcesByKey = sourceMap(sources), expectedByKey = new Map(buildIntegrationC1Dataset(sources).rules.map(value => [`${value.identity.stateKey}|${value.identity.ruleKey}|${value.identity.efficacyType}`, value])), seen = new Set<string>();
    let sourceProjectionHashMatchCount = 0, losslessRawTupleCount = 0;
    const dimensionNames = ["condition", "timing", "target", "operation", "valueUnit", "lifecycle", "probability", "calculationBucket", "attackKind", "finalHpApplication"] as Array<keyof IntegrationRuleDimensions>;
    for (const rule of dataset.rules) {
        const ruleKey = `${rule.identity.stateKey}|${rule.identity.ruleKey}|${rule.identity.efficacyType}`, source = sourcesByKey.get(ruleKey);
        if (seen.has(ruleKey)) failures.push(`duplicate ${ruleKey}`); seen.add(ruleKey);
        if (!source || source.gate !== rule.audit.provenance.sourceGate || source.sha256 !== rule.audit.provenance.sourceArtifact.sha256) { failures.push(`source ${ruleKey}`); continue; }
        const parsed = parseIntegrationStateKey(rule.identity.stateKey);
        if (rule.identity.snapshotVersion !== dataset.sourceSnapshotVersion || rule.identity.cardId !== parsed.cardId || rule.identity.formId !== parsed.formId || rule.identity.releaseState !== parsed.releaseState || rule.identity.passiveSkillId !== source.value.passiveSkillId || rule.identity.ruleKey !== source.value.ruleKey || rule.identity.effectOrdinal !== 0 || rule.identity.effectKey !== `${rule.identity.ruleKey}:${rule.identity.efficacyType}:0`) failures.push(`structural identity ${ruleKey}`);
        if (sha256Json(source.value) === rule.audit.provenance.sourceProjectionSha256) sourceProjectionHashMatchCount++; else failures.push(`projection hash ${ruleKey}`);
        if (JSON.stringify(source.raw) === JSON.stringify(rule.audit.raw)) losslessRawTupleCount++; else failures.push(`raw tuple ${ruleKey}`);
        if (dimensionNames.some(name => !isExplicitIntegrationDimension(rule.dimensions[name]))) failures.push(`dimension encoding ${ruleKey}`);
        if (!expectedByKey.has(ruleKey) || !hasExpectedIntegrationDimensions(rule.dimensions, expectedByKey.get(ruleKey)!.dimensions)) failures.push(`semantic dimensions ${ruleKey}`);
        if (rule.dimensions.operation.status !== "supported" || rule.dimensions.valueUnit.status !== "supported" || rule.dimensions.target.status !== "supported" || rule.dimensions.calculationBucket.status !== "supported" || rule.dimensions.condition.status === "supported" || rule.dimensions.probability.status === "supported" || rule.dimensions.attackKind.status === "supported" || rule.dimensions.finalHpApplication.status === "supported") failures.push(`conservative boundary ${ruleKey}`);
        if (JSON.stringify(rule.audit.provenance.database) !== JSON.stringify(source.value.provenance.database) || JSON.stringify(rule.audit.provenance.runtime) !== JSON.stringify(source.value.provenance.runtime) || JSON.stringify(rule.audit.provenance.inherited) !== JSON.stringify(source.value.provenance.inherited)) failures.push(`provenance ${ruleKey}`);
    }
    if (dataset.rules.length !== sourcesByKey.size || seen.size !== sourcesByKey.size || [...sourcesByKey.keys()].some(value => !seen.has(value))) failures.push(`cardinality ${dataset.rules.length}/${sourcesByKey.size}`);
    return { schemaVersion: 1, valid: failures.length === 0, ruleCount: dataset.rules.length, sourceProjectionHashMatchCount, losslessRawTupleCount, failures };
}

export type IntegrationC1SourceDatasets = { db48: DatabaseTeamAnalysisDb48Dataset; db49: DatabaseTeamAnalysisDb49Dataset; db50: DatabaseTeamAnalysisDb50Dataset };
