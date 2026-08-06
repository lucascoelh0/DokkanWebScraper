"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDatabaseTeamAnalysisDb26Goldens = void 0;
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
async function validateDatabaseTeamAnalysisDb26Goldens(dataset, coverage) { const path = (0, fs_1.existsSync)((0, path_1.resolve)(__dirname, "team-analysis-db26-golden-fixtures.json")) ? (0, path_1.resolve)(__dirname, "team-analysis-db26-golden-fixtures.json") : (0, path_1.resolve)(__dirname, "..", "..", "database-experiment", "team-analysis-db26-golden-fixtures.json"); const fixtures = JSON.parse(await (0, promises_1.readFile)(path, "utf8")), failures = []; for (const fixture of fixtures) {
    const value = dataset.resolutions.find(row => row.stateKey === fixture.stateKey && row.ruleKey === fixture.ruleKey && row.causalityId === fixture.causalityId);
    const issues = [];
    if (!value)
        issues.push("resolution missing");
    else {
        const category = value.selector.categories.find(row => row.firstPartyId === fixture.categoryId);
        if (value.selector.runtimeMask !== fixture.rawMask || value.selector.status !== "supported" || !category || category.localizedName !== fixture.categoryName)
            issues.push("selector differs");
        if (value.semanticStatus !== "partial" || value.activation.eventDirection !== "unknown" || value.activation.timing !== "unknown")
            issues.push("activation boundary differs");
    }
    if (issues.length > 0)
        failures.push({ fixture: fixture.name, issue: issues.join(", ") });
} if (coverage.resolutionCount !== coverage.sourceGapOccurrenceCount || coverage.resolutionCount !== 83 || coverage.affectedStateCount !== 34 || coverage.uniqueCausalityCount !== 7 || coverage.unknownSelectorCount !== 0 || coverage.categoryDictionaryCount !== 3)
    failures.push({ fixture: "coverage", issue: "snapshot accounting differs" }); return { schemaVersion: 1, fixtureCount: fixtures.length + 1, passed: fixtures.length + 1 - failures.length, failures }; }
exports.validateDatabaseTeamAnalysisDb26Goldens = validateDatabaseTeamAnalysisDb26Goldens;
//# sourceMappingURL=team-analysis-db26-golden.js.map