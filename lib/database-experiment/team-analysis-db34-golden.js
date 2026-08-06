"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDatabaseTeamAnalysisDb34Goldens = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
const team_analysis_db34_builder_1 = require("./team-analysis-db34-builder");
const GOLDEN_OPERATIONS = { 0: "add", 1: "subtract_floor_zero", 2: "add_percent_of_lhs", 3: "subtract_percent_of_lhs_floor_zero", 4: "assign_rhs" };
async function validateDatabaseTeamAnalysisDb34Goldens(dataset, coverage) {
    const fixtures = JSON.parse(await (0, promises_1.readFile)((0, path_1.resolve)(__dirname, "team-analysis-db34-golden-fixtures.json"), "utf8"));
    const failures = [];
    for (const fixture of fixtures) {
        const operation = typeof fixture.raw === "number" ? GOLDEN_OPERATIONS[fixture.raw] : undefined;
        const actual = fixture.kind === "bucket"
            ? (0, team_analysis_db34_builder_1.projectDb34CalculationBucket)(fixture.raw).value
            : fixture.kind === "shape"
                ? (0, team_analysis_db34_builder_1.projectDb34BasicStatShape)(fixture.raw).map(value => `${value.stat}:${value.sourceColumn}`).join("+") || "unknown"
                : (0, team_analysis_db34_builder_1.db34OperandUnit)(operation ? { status: "supported", value: operation, formula: "golden", parametersRead: [], parametersIgnored: [], clamp: "golden" } : { status: "unknown", value: "unknown" }).value;
        if (actual !== fixture.expected)
            failures.push(`${fixture.id}: ${actual}`);
    }
    if (coverage.basicStatRuleCount !== 5612 || coverage.statApplicationCount !== 9239 || coverage.affectedPassiveSkillCount !== 5466 || coverage.affectedStateCount !== 1384)
        failures.push("snapshot basic-stat coverage");
    if (coverage.unknownBucketRuleCount !== 0 || coverage.unknownBucketApplicationCount !== 0 || JSON.stringify(coverage.ruleCountsByBucket) !== JSON.stringify({ former_passive_stat: 3986, latter_passive_stat: 1626 }) || JSON.stringify(coverage.applicationCountsByBucket) !== JSON.stringify({ former_passive_stat: 6847, latter_passive_stat: 2392 }))
        failures.push("snapshot bucket distribution");
    if (JSON.stringify(coverage.applicationCountsByOperation) !== JSON.stringify({ add: 83, add_percent_of_lhs: 8907, subtract_percent_of_lhs_floor_zero: 249 }) || JSON.stringify(coverage.applicationCountsByOperandUnit) !== JSON.stringify({ percent_points_of_current_stat: 9156, stat_points: 83 }))
        failures.push("snapshot operation and unit distribution");
    if (coverage.alignedBasicStatRuleCount !== 1901 || coverage.confirmedLegacyConflictCount !== 0 || coverage.candidateLegacyConflictCount !== 4)
        failures.push("legacy diagnostic boundary");
    if (dataset.statApplications.some(value => value.runtimeModifierFloat32 !== Math.fround(Number(value.rawModifier)) || Object.values(value.independentDimensions).some(field => field !== "unknown")))
        failures.push("precision or independent dimension boundary");
    return { schemaVersion: 1, fixtureCount: fixtures.length + 4, passed: fixtures.length + 4 - failures.length, failures };
}
exports.validateDatabaseTeamAnalysisDb34Goldens = validateDatabaseTeamAnalysisDb34Goldens;
//# sourceMappingURL=team-analysis-db34-golden.js.map