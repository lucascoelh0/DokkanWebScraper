"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateIntegrationC2Dataset = void 0;
const integration_c2_builder_1 = require("./integration-c2-builder");
const key = (value) => `${value.identity.stateKey}|${value.identity.ruleKey}|${value.identity.efficacyType}|${value.identity.effectOrdinal}`;
function validateIntegrationC2Dataset(dataset, source, sourceSha256) {
    const failures = [];
    if (dataset.schemaVersion !== 1 || dataset.contract !== "dokkan-team-analysis-database-first-supported-sidecar" || dataset.contractVersion !== "1.0.0" || dataset.generatedAt !== source.generatedAt || dataset.sourceSnapshotVersion !== source.sourceSnapshotVersion || dataset.sourceDatabaseSha256 !== source.sourceDatabaseSha256 || dataset.nativeRuntimeSha256 !== source.nativeRuntimeSha256 || dataset.projectionPolicy !== "status_exactly_supported" || JSON.stringify(dataset.auditSidecar) !== JSON.stringify({ fileName: "team-analysis-database-first-sidecar-c1.json.gz", sha256: sourceSha256, contractVersion: "1.0.0" }))
        failures.push("identity");
    if ((0, integration_c2_builder_1.countForbiddenConsumerFields)(dataset) !== 0)
        failures.push("forbidden uncertainty or presentation field");
    const expected = new Map(source.rules.map(value => [key(value), (0, integration_c2_builder_1.projectIntegrationC2Rule)(value)]).filter((entry) => entry[1] !== undefined)), seen = new Set();
    let exactProjectionCount = 0;
    for (const rule of dataset.rules) {
        const ruleKey = key(rule), expectedRule = expected.get(ruleKey);
        if (seen.has(ruleKey))
            failures.push(`duplicate ${ruleKey}`);
        seen.add(ruleKey);
        if (!expectedRule) {
            failures.push(`unexpected ${ruleKey}`);
            continue;
        }
        if (JSON.stringify(rule) === JSON.stringify(expectedRule))
            exactProjectionCount++;
        else
            failures.push(`projection ${ruleKey}`);
    }
    if (dataset.rules.length !== expected.size || seen.size !== expected.size || [...expected.keys()].some(value => !seen.has(value)))
        failures.push(`cardinality ${dataset.rules.length}/${expected.size}`);
    return { schemaVersion: 1, valid: failures.length === 0, sourceRuleCount: source.rules.length, projectedRuleCount: dataset.rules.length, exactProjectionCount, failures };
}
exports.validateIntegrationC2Dataset = validateIntegrationC2Dataset;
//# sourceMappingURL=integration-c2-validator.js.map