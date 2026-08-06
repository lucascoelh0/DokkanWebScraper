"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDatabaseTeamAnalysisDb41Goldens = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
const team_analysis_db41_builder_1 = require("./team-analysis-db41-builder");
async function validateDatabaseTeamAnalysisDb41Goldens(d, c) { const f = JSON.parse(await (0, promises_1.readFile)((0, path_1.resolve)(__dirname, "team-analysis-db41-golden-fixtures.json"), "utf8")), failures = []; for (const x of f) {
    const r = d.resolutions.find(v => v.stateKey === x.stateKey && v.ruleKey === x.ruleKey && v.causalityId === x.causalityId);
    if (!r || r.predicate.selector.categoryId !== x.categoryId || r.predicate.threshold !== x.threshold || r.predicate.group.rawMode !== 1)
        failures.push(x.id);
} if (c.resolutionCount !== 434 || c.affectedStateCount !== 157 || c.affectedRuleCount !== 323 || c.affectedPassiveSkillCount !== 321 || c.uniqueCausalityCount !== 119 || c.rawModeCounts["1"] !== 434 || c.thresholdCounts["1"] !== 434 || c.partialResolutionCount !== 434 || c.legacyUnknownResolutionCount !== 434 || c.confirmedLegacyConflictCount !== 0)
    failures.push("snapshot population"); const mechanics = [["zero-count", (0, team_analysis_db41_builder_1.evaluateDb41EnemyCategoryThreshold)(1, 0, 1), false], ["equal", (0, team_analysis_db41_builder_1.evaluateDb41EnemyCategoryThreshold)(1, 1, 1), true], ["above", (0, team_analysis_db41_builder_1.evaluateDb41EnemyCategoryThreshold)(1, 2, 1), true], ["zero-threshold", (0, team_analysis_db41_builder_1.evaluateDb41EnemyCategoryThreshold)(1, 0, 0), true], ["negative-threshold-unsigned", (0, team_analysis_db41_builder_1.evaluateDb41EnemyCategoryThreshold)(1, 10, -1), false], ["unknown-mode", (0, team_analysis_db41_builder_1.evaluateDb41EnemyCategoryThreshold)(0, 1, 1), null], ["invalid-count", (0, team_analysis_db41_builder_1.evaluateDb41EnemyCategoryThreshold)(1, -1, 1), null], ["invalid-threshold", (0, team_analysis_db41_builder_1.evaluateDb41EnemyCategoryThreshold)(1, 1, "bad"), null]]; for (const [x, a, e] of mechanics)
    if (a !== e)
        failures.push(x); if (d.resolutions.some(r => r.predicate.group.eligibility.semanticName !== "unknown" || r.activation.timing !== "unknown" || r.activation.calculationBucket !== "unknown"))
    failures.push("conservative boundary"); return { schemaVersion: 1, fixtureCount: f.length + mechanics.length + 2, passed: f.length + mechanics.length + 2 - failures.length, failures }; }
exports.validateDatabaseTeamAnalysisDb41Goldens = validateDatabaseTeamAnalysisDb41Goldens;
//# sourceMappingURL=team-analysis-db41-golden.js.map