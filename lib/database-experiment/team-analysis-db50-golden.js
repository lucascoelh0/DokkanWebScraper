"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDatabaseTeamAnalysisDb50Goldens = void 0;
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const team_analysis_db50_builder_1 = require("./team-analysis-db50-builder");
async function validateDatabaseTeamAnalysisDb50Goldens(dataset, coverage) {
    const fixturePath = (0, fs_1.existsSync)((0, path_1.resolve)(__dirname, "team-analysis-db50-golden-fixtures.json")) ? (0, path_1.resolve)(__dirname, "team-analysis-db50-golden-fixtures.json") : (0, path_1.resolve)(__dirname, "..", "..", "database-experiment", "team-analysis-db50-golden-fixtures.json");
    const fixtures = JSON.parse(await (0, promises_1.readFile)(fixturePath, "utf8"));
    const failures = [];
    const candidates = [{ id: "first", resistDamageRate: 30 }, { id: "max-first", resistDamageRate: 80 }, { id: "max-tie", resistDamageRate: 80 }];
    const synthetic = [
        ["highest rate selection", (0, team_analysis_db50_builder_1.selectDb50Counter)(candidates)?.id === "max-first"],
        ["first wins ties", (0, team_analysis_db50_builder_1.selectDb50Counter)(candidates.slice().reverse())?.id === "max-tie"],
        ["empty selection", (0, team_analysis_db50_builder_1.selectDb50Counter)([]) === null],
        ["positive truncation", (0, team_analysis_db50_builder_1.applyDb50CounterResistance)(101, 59) === 42],
        ["negative truncation", (0, team_analysis_db50_builder_1.applyDb50CounterResistance)(-101, 59) === -42],
        ["zero operand", (0, team_analysis_db50_builder_1.applyDb50CounterResistance)(0, 59) === 0],
        ["zero rate", (0, team_analysis_db50_builder_1.applyDb50CounterResistance)(101, 0) === 101],
        ["full resistance", (0, team_analysis_db50_builder_1.applyDb50CounterResistance)(101, 100) === 0],
        ["native out-of-range arithmetic", (0, team_analysis_db50_builder_1.applyDb50CounterResistance)(100, 101) === -1],
        ["zero rate does not set flag", (0, team_analysis_db50_builder_1.doesDb50RateSetFlag)(0) === false],
        ["59 rate does not set flag", (0, team_analysis_db50_builder_1.doesDb50RateSetFlag)(59) === false],
        ["100 rate sets flag", (0, team_analysis_db50_builder_1.doesDb50RateSetFlag)(100) === true],
        ["selected dynamic rate controls flag", (0, team_analysis_db50_builder_1.doesDb50RateSetFlag)((0, team_analysis_db50_builder_1.selectDb50Counter)(candidates).resistDamageRate) === false],
    ];
    for (const [name, passed] of synthetic)
        if (!passed)
            failures.push({ fixture: name, issue: "native selection or formula differs" });
    for (const fixture of fixtures) {
        const projection = dataset.projections.find(value => value.stateKey === fixture.stateKey && value.ruleKey === fixture.ruleKey);
        if (!projection) {
            failures.push({ fixture: fixture.name, issue: "rule missing" });
            continue;
        }
        const actual = [projection.passiveSkillId, projection.payload.resistDamageRate.runtimeInteger, projection.payload.increaseDamagePercent.runtimeInteger, projection.payload.battleScriptNo.runtimeInteger, projection.rawActivation.probability, projection.rawActivation.calculationOption, projection.target.value.scope, projection.executionTiming.status === "supported" ? projection.executionTiming.event : "unknown", projection.selection.externalActivation, projection.damage.finalHpApplication];
        const expected = [fixture.passiveSkillId, fixture.resistDamageRate, fixture.increaseDamagePercent, fixture.battleScriptNo, fixture.probability, fixture.calcOption, fixture.target, fixture.timing, "unknown", "unknown"];
        if (JSON.stringify(actual) !== JSON.stringify(expected))
            failures.push({ fixture: fixture.name, issue: "projection tuple differs" });
    }
    const expectedCoverage = { ruleCount: 50, affectedStateCount: 38, supportedPayloadFieldCount: 150, supportedTargetCount: 50, supportedTimingCount: 50, supportedSelectionCount: 50, supportedDamageCount: 50, partialSimulationCount: 50 };
    for (const [name, value] of Object.entries(expectedCoverage))
        if (coverage[name] !== value)
            failures.push({ fixture: "coverage", issue: `${name} differs` });
    if (JSON.stringify(coverage.resistRateCounts) !== JSON.stringify({ "0": 44, "30": 1, "40": 1, "59": 1, "80": 1, "100": 2 }) || JSON.stringify(coverage.probabilityCounts) !== JSON.stringify({ "30": 4, "50": 8, "70": 15, "100": 23 }))
        failures.push({ fixture: "coverage distributions", issue: "raw distribution differs" });
    if (dataset.projections.some(value => value.registrationGate.fieldSemantic !== "unknown" || value.selection.callerBoolean !== "unknown" || value.selection.externalActivation !== "unknown" || value.damage.finalHpApplication !== "unknown" || value.simulationStatus !== "partial"))
        failures.push({ fixture: "conservative boundaries", issue: "independent unknown promoted" });
    const fixtureCount = synthetic.length + fixtures.length + 2;
    return { schemaVersion: 1, fixtureCount, passed: fixtureCount - failures.length, failures };
}
exports.validateDatabaseTeamAnalysisDb50Goldens = validateDatabaseTeamAnalysisDb50Goldens;
//# sourceMappingURL=team-analysis-db50-golden.js.map