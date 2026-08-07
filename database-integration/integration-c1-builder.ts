import { createHash } from "crypto";
import { DatabaseTeamAnalysisDb48Dataset, Db48RuleProjection } from "../database-experiment/team-analysis-db48-contract";
import { DatabaseTeamAnalysisDb49Dataset, Db49RuleProjection } from "../database-experiment/team-analysis-db49-contract";
import { DatabaseTeamAnalysisDb50Dataset, Db50Projection } from "../database-experiment/team-analysis-db50-contract";
import { IntegrationC1Coverage, IntegrationC1Dataset, IntegrationC1Rule, IntegrationDimensionStatus, IntegrationReleaseState, IntegrationRuleDimensions, IntegrationSourceGate, IntegrationStructuralIdentity, IntegrationTargetValue } from "./integration-c1-contract";

export interface IntegrationC1Sources { db48: DatabaseTeamAnalysisDb48Dataset; db48Sha256: string; db49: DatabaseTeamAnalysisDb49Dataset; db49Sha256: string; db50: DatabaseTeamAnalysisDb50Dataset; db50Sha256: string }
export const sha256Json = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export function parseIntegrationStateKey(stateKey: string): { cardId: string; formId: string; releaseState: IntegrationReleaseState } {
    const parts = stateKey.split(":");
    if (parts.length !== 3 || !/^\d+$/.test(parts[0]) || !/^\d+$/.test(parts[1]) || !["initial", "eza", "seza"].includes(parts[2])) throw Error(`C1 invalid structural state key ${stateKey}`);
    return { cardId: parts[0], formId: parts[1], releaseState: parts[2] as IntegrationReleaseState };
}
const identity = (snapshotVersion: string, source: { stateKey: string; ruleKey: string; passiveSkillId: string; efficacyType: 13 | 78 | 120 }): IntegrationStructuralIdentity => {
    const parsed = parseIntegrationStateKey(source.stateKey);
    return { snapshotVersion, cardId: parsed.cardId, stateKey: source.stateKey, formId: parsed.formId, releaseState: parsed.releaseState, passiveSkillId: source.passiveSkillId, ruleKey: source.ruleKey, efficacyType: source.efficacyType, effectOrdinal: 0, effectKey: `${source.ruleKey}:${source.efficacyType}:0` };
};
const timing = (raw: unknown, value: { status: string; event?: string; sequence?: string }) => value.status === "supported" && typeof raw === "number" && value.event && value.sequence ? { status: "supported" as const, value: { raw, event: value.event, sequence: value.sequence } } : { status: "unknown" as const, missing: ["native_execution_timing"] };
const target = (candidate: { raw: number; scope: IntegrationTargetValue["scope"]; selfInclusion: IntegrationTargetValue["selfInclusion"] }, subTarget?: IntegrationTargetValue["subTarget"]) => ({ status: "supported" as const, value: { raw: candidate.raw, scope: candidate.scope, selfInclusion: candidate.selfInclusion, ...(subTarget ? { subTarget } : {}) } });
const unsupported = (status: "partial" | "unknown", ...missing: string[]) => ({ status, missing });
const artifact = (gate: IntegrationSourceGate, sha256: string) => gate === "DB48" ? { gate, fileName: "team-analysis-db48-damage-mitigation.json.gz", sha256, contractVersion: "0.47.0" } : gate === "DB49" ? { gate, fileName: "team-analysis-db49-forced-guard.json.gz", sha256, contractVersion: "0.48.0" } : { gate, fileName: "team-analysis-db50-counter-consumer.json.gz", sha256, contractVersion: "0.49.0" };
function provenance(gate: IntegrationSourceGate, sourceSha256: string, source: { provenance: { database: unknown; runtime: unknown; inherited: unknown } }) {
    const sourceArtifact = artifact(gate, sourceSha256);
    return { sourceGate: gate, sourceArtifact: { fileName: sourceArtifact.fileName, sha256: sourceArtifact.sha256, contractVersion: sourceArtifact.contractVersion }, sourceProjectionSha256: sha256Json(source), database: source.provenance.database, runtime: source.provenance.runtime, inherited: source.provenance.inherited };
}
function fromDb48(snapshotVersion: string, sourceSha256: string, source: Db48RuleProjection): IntegrationC1Rule {
    if (source.damageRateInput.status !== "supported" || source.damageRateInput.runtimeRemainingDamageRateFloat32 === null || source.damageRateInput.reductionContributionPercentPoints === null) throw Error(`C1 DB48 unsupported value ${source.stateKey}|${source.ruleKey}`);
    const dimensions: IntegrationRuleDimensions = {
        condition: unsupported("unknown", "condition_projection_not_consumed_by_db48"), timing: timing(source.rawExecutionTimingType, source.executionTiming),
        target: target(source.target.candidate, { rawSetId: source.target.subTarget.rawSetId, composition: source.target.subTarget.composition, emptySetBehavior: source.target.subTarget.emptySetBehavior, filters: source.target.subTarget.filters }),
        operation: { status: "supported", value: { kind: "damage_mitigation", aggregation: "subtract_reduction_contributions_then_clamp_0_100", filterKeys: ["deck_index", "skill_category_type"] } },
        valueUnit: { status: "supported", value: { kind: "remaining_damage_rate", unit: "percent_points", runtimeFloat32: source.damageRateInput.runtimeRemainingDamageRateFloat32, reductionContributionPercentPoints: source.damageRateInput.reductionContributionPercentPoints } },
        lifecycle: unsupported("partial", "probability_application", "recurrence", "reset", "expiry"), probability: unsupported("unknown", "probability_application"),
        calculationBucket: { status: "supported", value: { paths: [{ channel: "player_source", bucket: source.consumers.playerSource.bucket, formula: source.consumers.playerSource.formula }, { channel: "enemy_source", bucket: source.consumers.enemySource.bucket, formula: source.consumers.enemySource.formula }] } },
        attackKind: unsupported("unknown", "attack_kind_partition"), finalHpApplication: unsupported("unknown", "final_hp_application"),
    };
    return { identity: identity(snapshotVersion, source), dimensions, audit: { raw: { sourceEffectCount: source.sourceEffectCount, effValue1: source.damageRateInput.rawRemainingDamageRatePercentPoints, effValue2: source.ignoredHandlerParameters.rawEffValue2, effValue3: source.ignoredHandlerParameters.rawEffValue3, calculationOption: source.ignoredHandlerParameters.rawCalculationOption, probability: source.rawProbability, executionTimingType: source.rawExecutionTimingType, targetType: source.target.candidate.raw, subTargetTypeSetId: source.target.subTarget.rawSetId, turn: source.lifecycle.duration.rawTurn, isOnce: source.lifecycle.onceOnly.rawIsOnce }, provenance: provenance("DB48", sourceSha256, source) } };
}
function fromDb49(snapshotVersion: string, sourceSha256: string, source: Db49RuleProjection): IntegrationC1Rule {
    const dimensions: IntegrationRuleDimensions = {
        condition: unsupported("unknown", "condition_projection_not_consumed_by_db49"), timing: timing(source.rawExecutionTimingType, source.executionTiming),
        target: target(source.target.candidate, { rawSetId: source.target.subTarget.rawSetId, composition: source.target.subTarget.composition, emptySetBehavior: source.target.subTarget.emptySetBehavior, filters: source.target.subTarget.filters }),
        operation: { status: "supported", value: { kind: "force_guard", normalGuardFormula: source.effect.normalGuardFormula, guardCoefficient: source.effect.guardCoefficient } }, valueUnit: { status: "supported", value: { kind: "boolean_presence", value: true } },
        lifecycle: unsupported("partial", "probability_application", "recurrence", "reset", "expiry"), probability: unsupported("unknown", "probability_application"),
        calculationBucket: { status: "supported", value: { paths: [{ channel: "player_source", bucket: source.consumers.playerSource.bucket, formula: source.consumers.playerSource.formula }, { channel: "enemy_source", bucket: source.consumers.enemySource.bucket, formula: source.consumers.enemySource.formula }] } },
        attackKind: unsupported("unknown", "attack_kind_partition"), finalHpApplication: unsupported("unknown", "final_hp_application"),
    };
    return { identity: identity(snapshotVersion, source), dimensions, audit: { raw: { sourceEffectCount: source.sourceEffectCount, effValue1: source.effect.handlerParameters.rawEffValue1, effValue2: source.effect.handlerParameters.rawEffValue2, effValue3: source.effect.handlerParameters.rawEffValue3, calculationOption: source.effect.handlerParameters.rawCalculationOption, probability: source.rawProbability, executionTimingType: source.rawExecutionTimingType, targetType: source.target.candidate.raw, subTargetTypeSetId: source.target.subTarget.rawSetId, turn: source.lifecycle.duration.rawTurn, isOnce: source.lifecycle.onceOnly.rawIsOnce }, provenance: provenance("DB49", sourceSha256, source) } };
}
function fromDb50(snapshotVersion: string, sourceSha256: string, source: Db50Projection): IntegrationC1Rule {
    const rate = source.payload.resistDamageRate.runtimeInteger;
    if (rate === undefined) throw Error(`C1 DB50 unsupported value ${source.stateKey}|${source.ruleKey}`);
    const dimensions: IntegrationRuleDimensions = {
        condition: unsupported("unknown", "condition_projection_not_consumed_by_db50"), timing: timing(source.rawActivation.executionTimingType, source.executionTiming), target: target(source.target.value),
        operation: { status: "supported", value: { kind: "counter_resistance", selection: "highest_resist_damage_rate_first_wins_ties", preference: source.selection.preference, formula: source.damage.formula } },
        valueUnit: { status: "supported", value: { kind: "counter_resist_damage_rate", unit: "percent_points", runtimeInteger: rate, rateAbove99SetsFlag: true } },
        lifecycle: unsupported("unknown", "duration", "recurrence", "reset", "expiry"), probability: unsupported("unknown", "probability_application"),
        calculationBucket: { status: "supported", value: { paths: [{ channel: "enemy_source", bucket: source.damage.bucket, formula: source.damage.formula }] } }, attackKind: unsupported("unknown", "attack_kind_partition"), finalHpApplication: unsupported("unknown", "final_hp_application"),
    };
    return { identity: identity(snapshotVersion, source), dimensions, audit: { raw: { sourceEffectCount: source.sourceEffectCount, resistDamageRate: source.payload.resistDamageRate.raw, increaseDamagePercent: source.payload.increaseDamagePercent.raw, battleScriptNo: source.payload.battleScriptNo.raw, activation: source.rawActivation }, provenance: provenance("DB50", sourceSha256, source) } };
}
export function buildIntegrationC1Dataset(sources: IntegrationC1Sources): IntegrationC1Dataset {
    const datasets = [sources.db48, sources.db49, sources.db50];
    if (sources.db48.contractVersion !== "0.47.0" || sources.db49.contractVersion !== "0.48.0" || sources.db50.contractVersion !== "0.49.0") throw Error("C1 source contract lineage");
    if (datasets.some(value => value.sourceSnapshotVersion !== sources.db48.sourceSnapshotVersion || value.sourceDatabaseSha256 !== sources.db48.sourceDatabaseSha256 || value.nativeRuntime.sha256 !== sources.db48.nativeRuntime.sha256 || value.generatedAt !== sources.db48.generatedAt)) throw Error("C1 source snapshot lineage");
    const rules = [...sources.db48.ruleProjections.map(value => fromDb48(sources.db48.sourceSnapshotVersion, sources.db48Sha256, value)), ...sources.db49.ruleProjections.map(value => fromDb49(sources.db48.sourceSnapshotVersion, sources.db49Sha256, value)), ...sources.db50.projections.map(value => fromDb50(sources.db48.sourceSnapshotVersion, sources.db50Sha256, value))];
    rules.sort((left, right) => left.identity.stateKey.localeCompare(right.identity.stateKey, "en", { numeric: true }) || left.identity.ruleKey.localeCompare(right.identity.ruleKey, "en", { numeric: true }) || left.identity.efficacyType - right.identity.efficacyType);
    return { schemaVersion: 1, contract: "dokkan-team-analysis-database-first-sidecar-audit", contractVersion: "1.0.0", generatedAt: sources.db48.generatedAt, sourceSnapshotVersion: sources.db48.sourceSnapshotVersion, sourceDatabaseSha256: sources.db48.sourceDatabaseSha256, nativeRuntimeSha256: sources.db48.nativeRuntime.sha256, sources: [artifact("DB48", sources.db48Sha256), artifact("DB49", sources.db49Sha256), artifact("DB50", sources.db50Sha256)].map(value => ({ ...value, recordCount: value.gate === "DB48" ? sources.db48.ruleProjections.length : value.gate === "DB49" ? sources.db49.ruleProjections.length : sources.db50.projections.length })), rules };
}
export function buildIntegrationC1Coverage(dataset: IntegrationC1Dataset): IntegrationC1Coverage {
    const dimensions = ["condition", "timing", "target", "operation", "valueUnit", "lifecycle", "probability", "calculationBucket", "attackKind", "finalHpApplication"] as Array<keyof IntegrationRuleDimensions>;
    const dimensionStatusCounts = Object.fromEntries(dimensions.map(name => [name, { supported: 0, partial: 0, unknown: 0 }])) as IntegrationC1Coverage["dimensionStatusCounts"];
    for (const rule of dataset.rules) for (const name of dimensions) dimensionStatusCounts[name][rule.dimensions[name].status as IntegrationDimensionStatus]++;
    const identities = dataset.rules.map(value => JSON.stringify(value.identity));
    return { schemaVersion: 1, ruleCount: dataset.rules.length, stateCount: new Set(dataset.rules.map(value => value.identity.stateKey)).size, passiveSkillCount: new Set(dataset.rules.map(value => value.identity.passiveSkillId)).size, countsByGate: { DB48: dataset.rules.filter(value => value.audit.provenance.sourceGate === "DB48").length, DB49: dataset.rules.filter(value => value.audit.provenance.sourceGate === "DB49").length, DB50: dataset.rules.filter(value => value.audit.provenance.sourceGate === "DB50").length }, dimensionStatusCounts, duplicateIdentityCount: identities.length - new Set(identities).size };
}
