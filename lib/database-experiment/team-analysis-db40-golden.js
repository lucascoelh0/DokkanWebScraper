"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDatabaseTeamAnalysisDb40Goldens = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
const team_analysis_db40_builder_1 = require("./team-analysis-db40-builder");
async function validateDatabaseTeamAnalysisDb40Goldens(d, c) { const f = JSON.parse(await (0, promises_1.readFile)((0, path_1.resolve)(__dirname, "team-analysis-db40-golden-fixtures.json"), "utf8")), failures = []; for (const x of f) {
    const r = d.resolutions.find(v => v.stateKey === x.stateKey && v.ruleKey === x.ruleKey && v.causalityId === x.causalityId);
    if (!r || r.causalityType !== x.type || r.predicate.comparator !== x.comparator || r.predicate.threshold !== x.threshold)
        failures.push(x.id);
} if (c.resolutionCount !== 1267 || c.sourceGapOccurrenceCount !== 1267 || c.affectedStateCount !== 607 || c.uniqueCausalityCount !== 343 || c.occurrenceCountsByType["3"] !== 1262 || c.occurrenceCountsByType["4"] !== 5 || c.affectedStateCountsByType["3"] !== 607 || c.affectedStateCountsByType["4"] !== 2 || c.partialResolutionCount !== 1267 || c.legacyUnknownResolutionCount !== 1267 || c.confirmedLegacyConflictCount !== 0)
    failures.push("snapshot population"); const mechanics = [["75", (0, team_analysis_db40_builder_1.calculateDb40Metric)(0, 3, 4), 75], ["33", (0, team_analysis_db40_builder_1.calculateDb40Metric)(0, 1, 3), 33], ["nonzero-category", (0, team_analysis_db40_builder_1.calculateDb40Metric)(1, 999, 0), 0], ["zero-denominator", (0, team_analysis_db40_builder_1.calculateDb40Metric)(0, 1, 0), null], ["invalid", (0, team_analysis_db40_builder_1.calculateDb40Metric)("bad", 1, 1), null], ["over-equal", (0, team_analysis_db40_builder_1.evaluateDb40Threshold)(3, 100, 100), true], ["under-equal", (0, team_analysis_db40_builder_1.evaluateDb40Threshold)(4, 100, 100), false], ["under-less", (0, team_analysis_db40_builder_1.evaluateDb40Threshold)(4, 99, 100), true], ["unknown-type", (0, team_analysis_db40_builder_1.evaluateDb40Threshold)(5, 1, 1), null]]; for (const [x, a, e] of mechanics)
    if (a !== e)
        failures.push(x); if (d.resolutions.some(r => r.predicate.categoryGate.semanticName !== "unknown" || r.predicate.calculation.zeroDenominatorBehavior !== "unknown" || r.activation.timing !== "unknown"))
    failures.push("conservative boundary"); return { schemaVersion: 1, fixtureCount: f.length + mechanics.length + 2, passed: f.length + mechanics.length + 2 - failures.length, failures }; }
exports.validateDatabaseTeamAnalysisDb40Goldens = validateDatabaseTeamAnalysisDb40Goldens;
//# sourceMappingURL=team-analysis-db40-golden.js.map