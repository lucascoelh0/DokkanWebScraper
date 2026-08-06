"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDatabaseTeamAnalysisDb32Goldens = void 0;
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const team_analysis_db32_builder_1 = require("./team-analysis-db32-builder");
async function validateDatabaseTeamAnalysisDb32Goldens(d, c) { const p = (0, fs_1.existsSync)((0, path_1.resolve)(__dirname, "team-analysis-db32-golden-fixtures.json")) ? (0, path_1.resolve)(__dirname, "team-analysis-db32-golden-fixtures.json") : (0, path_1.resolve)(__dirname, "..", "..", "database-experiment", "team-analysis-db32-golden-fixtures.json"), fixtures = JSON.parse(await (0, promises_1.readFile)(p, "utf8")), failures = []; for (const f of fixtures) {
    const v = (0, team_analysis_db32_builder_1.projectDb32ExecutionTiming)(f.raw);
    if (v.status !== f.status || v.event !== f.event)
        failures.push({ fixture: f.name, issue: JSON.stringify(v) });
} if (!d.ruleTimings.some(v => v.executionTiming.status === "supported" && v.calculationOperation.status === "supported" && Object.values(v.independentDimensions).every(x => x === "unknown")))
    failures.push({ fixture: "independent dimensions", issue: "known operation plus known timing boundary absent" }); if (c.ruleCount !== c.supportedRuleCount + c.unknownRuleCount || c.supportedRuleCount !== 9061 || c.supportedEffectCount !== 11809 || c.supportedStateCount !== 1449)
    failures.push({ fixture: "snapshot coverage", issue: "DB32 coverage drift" }); return { schemaVersion: 1, fixtureCount: fixtures.length + 2, passed: fixtures.length + 2 - failures.length, failures }; }
exports.validateDatabaseTeamAnalysisDb32Goldens = validateDatabaseTeamAnalysisDb32Goldens;
//# sourceMappingURL=team-analysis-db32-golden.js.map