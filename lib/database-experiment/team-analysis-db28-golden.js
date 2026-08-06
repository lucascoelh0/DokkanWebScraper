"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDatabaseTeamAnalysisDb28Goldens = void 0;
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
async function validateDatabaseTeamAnalysisDb28Goldens(dataset, coverage) {
    const path = (0, fs_1.existsSync)((0, path_1.resolve)(__dirname, "team-analysis-db28-golden-fixtures.json")) ? (0, path_1.resolve)(__dirname, "team-analysis-db28-golden-fixtures.json") : (0, path_1.resolve)(__dirname, "..", "..", "database-experiment", "team-analysis-db28-golden-fixtures.json");
    const fixtures = JSON.parse(await (0, promises_1.readFile)(path, "utf8")), failures = [];
    for (const fixture of fixtures) {
        const value = dataset.resolutions.find(row => row.stateKey === fixture.stateKey && row.ruleKey === fixture.ruleKey && row.causalityId === fixture.causalityId), issues = [];
        if (!value)
            issues.push("resolution missing");
        else {
            const expected = value.predicate.scope === "party_pure_and_back_current_records" ? value.predicate.expected : true;
            if (value.causalityType !== fixture.causalityType || value.predicate.scope !== fixture.scope || expected !== fixture.expected)
                issues.push("predicate differs");
            if (value.predicate.status !== "supported" || value.semanticStatus !== "partial" || value.history.window !== "unknown" || value.activation.timing !== "unknown")
                issues.push("boundary differs");
        }
        if (issues.length)
            failures.push({ fixture: fixture.name, issue: issues.join(", ") });
    }
    if (coverage.sourceGapOccurrenceCount !== 70 || coverage.resolutionCount !== 70 || coverage.affectedStateCount !== 20 || coverage.occurrenceCountsByType["47"] !== 28 || coverage.occurrenceCountsByType["54"] !== 42 || coverage.affectedStateCountsByType["47"] !== 15 || coverage.affectedStateCountsByType["54"] !== 15 || coverage.uniqueCausalityCountsByType["47"] !== 6 || coverage.uniqueCausalityCountsByType["54"] !== 3 || coverage.supportedPredicateCount !== 70 || coverage.nonzeroPolarityCount !== 0)
        failures.push({ fixture: "coverage", issue: "snapshot accounting differs" });
    return { schemaVersion: 1, fixtureCount: fixtures.length + 1, passed: fixtures.length + 1 - failures.length, failures };
}
exports.validateDatabaseTeamAnalysisDb28Goldens = validateDatabaseTeamAnalysisDb28Goldens;
//# sourceMappingURL=team-analysis-db28-golden.js.map