"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateIntegrationC3Dataset = void 0;
const integration_c3_builder_1 = require("./integration-c3-builder");
const key = (value) => `${value.identity.stateKey}|${value.identity.effectKey}`;
function validateIntegrationC3Dataset(dataset, source, sourceSha256, production, characters, metadata) {
    const failures = [], states = new Map(production.states.map(value => [value.stateKey, value])), expected = new Map(source.rules.map(rule => [key(rule), (0, integration_c3_builder_1.compareIntegrationC3Rule)(rule, states.get(rule.identity.stateKey))])), seen = new Set();
    let exactReconstructionCount = 0, exactComparisonCount = 0;
    if (dataset.schemaVersion !== 1 || dataset.contract !== "dokkan-team-analysis-database-first-shadow-parity" || dataset.contractVersion !== "1.0.0" || dataset.generatedAt !== source.generatedAt || dataset.comparisonPolicy !== "structural_ids_only_parser_is_non_authoritative" || JSON.stringify(dataset.sourceSupportedSidecar) !== JSON.stringify({ fileName: "team-analysis-database-first-supported-c2.json.gz", sha256: sourceSha256, contractVersion: "1.0.0" }) || JSON.stringify(dataset.sourceProductionTeamAnalysis) !== JSON.stringify(metadata.production) || JSON.stringify(dataset.sourceProductionCharacters) !== JSON.stringify(metadata.characters))
        failures.push("identity");
    for (const record of dataset.records) {
        const recordKey = key(record);
        if (seen.has(recordKey))
            failures.push(`duplicate ${recordKey}`);
        seen.add(recordKey);
        const expectedRecord = expected.get(recordKey);
        if (JSON.stringify(record.databaseFirstRule) === JSON.stringify(source.rules.find(rule => key(rule) === recordKey)))
            exactReconstructionCount++;
        else
            failures.push(`source reconstruction ${recordKey}`);
        if (expectedRecord && JSON.stringify(record) === JSON.stringify(expectedRecord))
            exactComparisonCount++;
        else
            failures.push(`comparison ${recordKey}`);
        if (record.classification === "confirmed_conflict")
            failures.push(`unsupported confirmed conflict ${recordKey}`);
    }
    if (dataset.records.length !== source.rules.length || seen.size !== expected.size)
        failures.push("cardinality");
    if (JSON.stringify(dataset.goldenFixtures) !== JSON.stringify(integration_c3_builder_1.INTEGRATION_C3_FIXTURES))
        failures.push("golden fixture catalog");
    failures.push(...(0, integration_c3_builder_1.validateIntegrationC3Fixtures)(dataset.goldenFixtures, source.rules, characters));
    return { schemaVersion: 1, valid: failures.length === 0, ruleCount: dataset.records.length, exactReconstructionCount, exactComparisonCount, fixtureCount: dataset.goldenFixtures.length, mutationRejectionCount: 0, failures };
}
exports.validateIntegrationC3Dataset = validateIntegrationC3Dataset;
//# sourceMappingURL=integration-c3-validator.js.map