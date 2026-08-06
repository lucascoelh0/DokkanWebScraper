"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDatabaseTeamAnalysisDb31Goldens = void 0;
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const team_analysis_db31_builder_1 = require("./team-analysis-db31-builder");
async function validateDatabaseTeamAnalysisDb31Goldens(d, c) { const path = (0, fs_1.existsSync)((0, path_1.resolve)(__dirname, "team-analysis-db31-golden-fixtures.json")) ? (0, path_1.resolve)(__dirname, "team-analysis-db31-golden-fixtures.json") : (0, path_1.resolve)(__dirname, "..", "..", "database-experiment", "team-analysis-db31-golden-fixtures.json"); const fs = JSON.parse(await (0, promises_1.readFile)(path, "utf8")), failures = [], map = new Map(d.enumValues.map(v => [v.raw, v.operation])); for (const f of fs) {
    const op = map.get(f.raw);
    try {
        if (f.unknown) {
            if (op)
                failures.push({ fixture: f.name, issue: "operation unexpectedly known" });
            continue;
        }
        if (!op)
            throw new Error("missing operation");
        const actual = (0, team_analysis_db31_builder_1.evaluateDb31Operation)(op, f.lhs, f.rhs);
        if (f.invalid || actual !== f.expected)
            failures.push({ fixture: f.name, issue: f.invalid ? "invalid payload accepted" : `result ${actual}` });
    }
    catch (e) {
        if (!f.invalid)
            failures.push({ fixture: f.name, issue: String(e) });
    }
} if (d.enumValues.length !== 5 || new Set(d.enumValues.map(v => v.raw)).size !== 5)
    failures.push({ fixture: "enum", issue: "0..4 coverage differs" }); if (d.ruleProjections.some(v => v.operation.status === "supported" && Object.values(v.independentDimensions).some(x => x !== "unknown")))
    failures.push({ fixture: "boundary", issue: "independent dimension promoted" }); if (c.ruleCount !== c.supportedRuleCount + c.unknownRuleCount || c.supportedEffectCount > c.effectCount)
    failures.push({ fixture: "coverage", issue: "accounting differs" }); return { schemaVersion: 1, fixtureCount: fs.length + 3, passed: fs.length + 3 - failures.length, failures }; }
exports.validateDatabaseTeamAnalysisDb31Goldens = validateDatabaseTeamAnalysisDb31Goldens;
//# sourceMappingURL=team-analysis-db31-golden.js.map