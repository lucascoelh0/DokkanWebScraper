"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDatabaseTeamAnalysisDb25Goldens = void 0;
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
async function validateDatabaseTeamAnalysisDb25Goldens(dataset, coverage) {
    const path = (0, fs_1.existsSync)((0, path_1.resolve)(__dirname, "team-analysis-db25-golden-fixtures.json")) ? (0, path_1.resolve)(__dirname, "team-analysis-db25-golden-fixtures.json") : (0, path_1.resolve)(__dirname, "..", "..", "database-experiment", "team-analysis-db25-golden-fixtures.json");
    const fixtures = JSON.parse(await (0, promises_1.readFile)(path, "utf8")), failures = [];
    for (const fixture of fixtures) {
        const value = dataset.resolutions.find(row => row.stateKey === fixture.stateKey && row.ruleKey === fixture.ruleKey && row.causalityId === fixture.causalityId);
        const issues = [];
        if (!value)
            issues.push("resolution missing");
        else {
            if (value.causalityType !== fixture.causalityType || value.canonicalProjection.test !== fixture.test)
                issues.push("native predicate differs");
            if (value.semanticStatus !== "partial" || value.semanticPromotion !== false || value.canonicalProjection.attackKind !== "unknown" || value.canonicalProjection.eventDirection !== "unknown")
                issues.push("conservative boundary differs");
            if ([value.raw.cauVal1, value.raw.cauVal2, value.raw.cauVal3].some(raw => Number(raw) !== 0))
                issues.push("raw payload differs");
        }
        if (issues.length > 0)
            failures.push({ fixture: fixture.name, issue: issues.join(", ") });
    }
    if (coverage.occurrenceCountsByType["40"] !== 132 || coverage.occurrenceCountsByType["56"] !== 20 || coverage.rawZeroPayloadCount !== coverage.resolutionCount || !coverage.dynamicExperimentRequired)
        failures.push({ fixture: "coverage", issue: "snapshot accounting or dynamic boundary differs" });
    return { schemaVersion: 1, fixtureCount: fixtures.length + 1, passed: fixtures.length + 1 - failures.length, failures };
}
exports.validateDatabaseTeamAnalysisDb25Goldens = validateDatabaseTeamAnalysisDb25Goldens;
//# sourceMappingURL=team-analysis-db25-golden.js.map