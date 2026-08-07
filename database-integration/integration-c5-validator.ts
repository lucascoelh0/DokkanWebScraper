import { buildIntegrationC5Readiness } from "./integration-c5-builder";
import { IntegrationC5Evidence, IntegrationC5Readiness, IntegrationC5Validation } from "./integration-c5-contract";

export function validateIntegrationC5Readiness(actual: IntegrationC5Readiness, generatedAt: string, evidence: IntegrationC5Evidence): IntegrationC5Validation {
    const failures: string[] = [], expected = buildIntegrationC5Readiness(generatedAt, evidence), exactReadiness = JSON.stringify(actual) === JSON.stringify(expected);
    if (!exactReadiness) failures.push("readiness payload"); if (actual.decisions.length !== 6 || new Set(actual.decisions.map(value => value.stage)).size !== 6) failures.push("decision cardinality");
    if (actual.decisions.find(value => value.stage === "r2_publication")?.decision !== "NO_GO" || actual.decisions.find(value => value.stage === "android_shadow_consumption")?.decision !== "NO_GO" || actual.decisions.find(value => value.stage === "full_simulation")?.decision !== "NO_GO") failures.push("unsafe adoption decision");
    if (actual.evidence.coverage.confirmedConflictCount !== 0 || actual.evidence.coverage.commonFirstPartyRuleIdentityCount !== 0) failures.push("shadow identity boundary");
    return { schemaVersion: 1, valid: failures.length === 0, exactReadiness, decisionCount: actual.decisions.length, mutationRejectionCount: 0, failures };
}
