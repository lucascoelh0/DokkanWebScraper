"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateIntegrationC5Readiness = void 0;
const integration_c5_builder_1 = require("./integration-c5-builder");
function validateIntegrationC5Readiness(actual, generatedAt, evidence) {
    const failures = [], expected = (0, integration_c5_builder_1.buildIntegrationC5Readiness)(generatedAt, evidence), exactReadiness = JSON.stringify(actual) === JSON.stringify(expected);
    if (!exactReadiness)
        failures.push("readiness payload");
    if (actual.decisions.length !== 6 || new Set(actual.decisions.map(value => value.stage)).size !== 6)
        failures.push("decision cardinality");
    if (actual.decisions.find(value => value.stage === "r2_publication")?.decision !== "NO_GO" || actual.decisions.find(value => value.stage === "android_shadow_consumption")?.decision !== "NO_GO" || actual.decisions.find(value => value.stage === "full_simulation")?.decision !== "NO_GO")
        failures.push("unsafe adoption decision");
    if (actual.evidence.coverage.confirmedConflictCount !== 0 || actual.evidence.coverage.commonFirstPartyRuleIdentityCount !== 0)
        failures.push("shadow identity boundary");
    return { schemaVersion: 1, valid: failures.length === 0, exactReadiness, decisionCount: actual.decisions.length, mutationRejectionCount: 0, failures };
}
exports.validateIntegrationC5Readiness = validateIntegrationC5Readiness;
//# sourceMappingURL=integration-c5-validator.js.map