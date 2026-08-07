"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateIntegrationC1Dataset = exports.hasExpectedIntegrationDimensions = exports.isExplicitIntegrationDimension = void 0;
const integration_c1_builder_1 = require("./integration-c1-builder");
const key = (value) => `${value.stateKey}|${value.ruleKey}|${value.efficacyType}`;
function isExplicitIntegrationDimension(value) {
    const hasValue = Object.prototype.hasOwnProperty.call(value, "value"), hasMissing = Array.isArray(value.missing) && value.missing.length > 0;
    return value.status === "supported" ? hasValue && !hasMissing : !hasValue && hasMissing;
}
exports.isExplicitIntegrationDimension = isExplicitIntegrationDimension;
const hasExpectedIntegrationDimensions = (actual, expected) => JSON.stringify(actual) === JSON.stringify(expected);
exports.hasExpectedIntegrationDimensions = hasExpectedIntegrationDimensions;
function db48Raw(source) { return { sourceEffectCount: source.sourceEffectCount, effValue1: source.damageRateInput.rawRemainingDamageRatePercentPoints, effValue2: source.ignoredHandlerParameters.rawEffValue2, effValue3: source.ignoredHandlerParameters.rawEffValue3, calculationOption: source.ignoredHandlerParameters.rawCalculationOption, probability: source.rawProbability, executionTimingType: source.rawExecutionTimingType, targetType: source.target.candidate.raw, subTargetTypeSetId: source.target.subTarget.rawSetId, turn: source.lifecycle.duration.rawTurn, isOnce: source.lifecycle.onceOnly.rawIsOnce }; }
function db49Raw(source) { return { sourceEffectCount: source.sourceEffectCount, effValue1: source.effect.handlerParameters.rawEffValue1, effValue2: source.effect.handlerParameters.rawEffValue2, effValue3: source.effect.handlerParameters.rawEffValue3, calculationOption: source.effect.handlerParameters.rawCalculationOption, probability: source.rawProbability, executionTimingType: source.rawExecutionTimingType, targetType: source.target.candidate.raw, subTargetTypeSetId: source.target.subTarget.rawSetId, turn: source.lifecycle.duration.rawTurn, isOnce: source.lifecycle.onceOnly.rawIsOnce }; }
function db50Raw(source) { return { sourceEffectCount: source.sourceEffectCount, resistDamageRate: source.payload.resistDamageRate.raw, increaseDamagePercent: source.payload.increaseDamagePercent.raw, battleScriptNo: source.payload.battleScriptNo.raw, activation: source.rawActivation }; }
function sourceMap(sources) {
    const result = new Map();
    for (const value of sources.db48.ruleProjections)
        result.set(key(value), { gate: "DB48", sha256: sources.db48Sha256, value, raw: db48Raw(value) });
    for (const value of sources.db49.ruleProjections)
        result.set(key(value), { gate: "DB49", sha256: sources.db49Sha256, value, raw: db49Raw(value) });
    for (const value of sources.db50.projections)
        result.set(key(value), { gate: "DB50", sha256: sources.db50Sha256, value, raw: db50Raw(value) });
    return result;
}
function validateIntegrationC1Dataset(dataset, sources) {
    const failures = [];
    if (dataset.schemaVersion !== 1 || dataset.contract !== "dokkan-team-analysis-database-first-sidecar-audit" || dataset.contractVersion !== "1.0.0" || dataset.generatedAt !== sources.db48.generatedAt || dataset.sourceSnapshotVersion !== sources.db48.sourceSnapshotVersion || dataset.sourceDatabaseSha256 !== sources.db48.sourceDatabaseSha256 || dataset.nativeRuntimeSha256 !== sources.db48.nativeRuntime.sha256)
        failures.push("dataset identity");
    const expectedSources = [{ gate: "DB48", fileName: "team-analysis-db48-damage-mitigation.json.gz", sha256: sources.db48Sha256, contractVersion: "0.47.0", recordCount: sources.db48.ruleProjections.length }, { gate: "DB49", fileName: "team-analysis-db49-forced-guard.json.gz", sha256: sources.db49Sha256, contractVersion: "0.48.0", recordCount: sources.db49.ruleProjections.length }, { gate: "DB50", fileName: "team-analysis-db50-counter-consumer.json.gz", sha256: sources.db50Sha256, contractVersion: "0.49.0", recordCount: sources.db50.projections.length }];
    if (JSON.stringify(dataset.sources) !== JSON.stringify(expectedSources))
        failures.push("source lineage");
    const sourcesByKey = sourceMap(sources), expectedByKey = new Map((0, integration_c1_builder_1.buildIntegrationC1Dataset)(sources).rules.map(value => [`${value.identity.stateKey}|${value.identity.ruleKey}|${value.identity.efficacyType}`, value])), seen = new Set();
    let sourceProjectionHashMatchCount = 0, losslessRawTupleCount = 0;
    const dimensionNames = ["condition", "timing", "target", "operation", "valueUnit", "lifecycle", "probability", "calculationBucket", "attackKind", "finalHpApplication"];
    for (const rule of dataset.rules) {
        const ruleKey = `${rule.identity.stateKey}|${rule.identity.ruleKey}|${rule.identity.efficacyType}`, source = sourcesByKey.get(ruleKey);
        if (seen.has(ruleKey))
            failures.push(`duplicate ${ruleKey}`);
        seen.add(ruleKey);
        if (!source || source.gate !== rule.audit.provenance.sourceGate || source.sha256 !== rule.audit.provenance.sourceArtifact.sha256) {
            failures.push(`source ${ruleKey}`);
            continue;
        }
        const parsed = (0, integration_c1_builder_1.parseIntegrationStateKey)(rule.identity.stateKey);
        if (rule.identity.snapshotVersion !== dataset.sourceSnapshotVersion || rule.identity.cardId !== parsed.cardId || rule.identity.formId !== parsed.formId || rule.identity.releaseState !== parsed.releaseState || rule.identity.passiveSkillId !== source.value.passiveSkillId || rule.identity.ruleKey !== source.value.ruleKey || rule.identity.effectOrdinal !== 0 || rule.identity.effectKey !== `${rule.identity.ruleKey}:${rule.identity.efficacyType}:0`)
            failures.push(`structural identity ${ruleKey}`);
        if ((0, integration_c1_builder_1.sha256Json)(source.value) === rule.audit.provenance.sourceProjectionSha256)
            sourceProjectionHashMatchCount++;
        else
            failures.push(`projection hash ${ruleKey}`);
        if (JSON.stringify(source.raw) === JSON.stringify(rule.audit.raw))
            losslessRawTupleCount++;
        else
            failures.push(`raw tuple ${ruleKey}`);
        if (dimensionNames.some(name => !isExplicitIntegrationDimension(rule.dimensions[name])))
            failures.push(`dimension encoding ${ruleKey}`);
        if (!expectedByKey.has(ruleKey) || !(0, exports.hasExpectedIntegrationDimensions)(rule.dimensions, expectedByKey.get(ruleKey).dimensions))
            failures.push(`semantic dimensions ${ruleKey}`);
        if (rule.dimensions.operation.status !== "supported" || rule.dimensions.valueUnit.status !== "supported" || rule.dimensions.target.status !== "supported" || rule.dimensions.calculationBucket.status !== "supported" || rule.dimensions.condition.status === "supported" || rule.dimensions.probability.status === "supported" || rule.dimensions.attackKind.status === "supported" || rule.dimensions.finalHpApplication.status === "supported")
            failures.push(`conservative boundary ${ruleKey}`);
        if (JSON.stringify(rule.audit.provenance.database) !== JSON.stringify(source.value.provenance.database) || JSON.stringify(rule.audit.provenance.runtime) !== JSON.stringify(source.value.provenance.runtime) || JSON.stringify(rule.audit.provenance.inherited) !== JSON.stringify(source.value.provenance.inherited))
            failures.push(`provenance ${ruleKey}`);
    }
    if (dataset.rules.length !== sourcesByKey.size || seen.size !== sourcesByKey.size || [...sourcesByKey.keys()].some(value => !seen.has(value)))
        failures.push(`cardinality ${dataset.rules.length}/${sourcesByKey.size}`);
    return { schemaVersion: 1, valid: failures.length === 0, ruleCount: dataset.rules.length, sourceProjectionHashMatchCount, losslessRawTupleCount, failures };
}
exports.validateIntegrationC1Dataset = validateIntegrationC1Dataset;
//# sourceMappingURL=integration-c1-validator.js.map