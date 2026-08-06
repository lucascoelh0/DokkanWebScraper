"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDatabaseTeamAnalysisDb27Goldens = void 0;
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
async function validateDatabaseTeamAnalysisDb27Goldens(dataset, coverage) { const path = (0, fs_1.existsSync)((0, path_1.resolve)(__dirname, "team-analysis-db27-golden-fixtures.json")) ? (0, path_1.resolve)(__dirname, "team-analysis-db27-golden-fixtures.json") : (0, path_1.resolve)(__dirname, "..", "..", "database-experiment", "team-analysis-db27-golden-fixtures.json"), fixtures = JSON.parse(await (0, promises_1.readFile)(path, "utf8")), failures = []; for (const f of fixtures) {
    const v = dataset.resolutions.find(row => row.stateKey === f.stateKey && row.ruleKey === f.ruleKey && row.causalityId === f.causalityId), issues = [];
    if (!v)
        issues.push("resolution missing");
    else {
        const p = v.predicate;
        const first = p.metric === "runtime_selected_hp_percent_integer" ? p.lower : p.threshold, second = p.metric === "runtime_selected_hp_percent_integer" ? p.upper : undefined;
        if (v.causalityType !== f.causalityType || p.comparator !== f.comparator || first !== f.first || second !== f.second)
            issues.push("predicate differs");
        if (v.semanticStatus !== "partial" || v.activation.timing !== "unknown")
            issues.push("boundary differs");
    }
    if (issues.length)
        failures.push({ fixture: f.name, issue: issues.join(", ") });
} if (coverage.sourceGapOccurrenceCount !== 59 || coverage.resolutionCount !== 59 || coverage.occurrenceCountsByType["17"] !== 14 || coverage.occurrenceCountsByType["18"] !== 33 || coverage.occurrenceCountsByType["33"] !== 12 || coverage.invalidThresholdCount !== 0)
    failures.push({ fixture: "coverage", issue: "snapshot accounting differs" }); return { schemaVersion: 1, fixtureCount: fixtures.length + 1, passed: fixtures.length + 1 - failures.length, failures }; }
exports.validateDatabaseTeamAnalysisDb27Goldens = validateDatabaseTeamAnalysisDb27Goldens;
//# sourceMappingURL=team-analysis-db27-golden.js.map