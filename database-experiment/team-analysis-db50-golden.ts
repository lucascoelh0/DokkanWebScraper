import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { resolve } from "path";
import { applyDb50CounterResistance, doesDb50RateSetFlag, selectDb50Counter } from "./team-analysis-db50-builder";
import { DatabaseTeamAnalysisDb50Coverage, DatabaseTeamAnalysisDb50Dataset } from "./team-analysis-db50-contract";

export interface Db50GoldenValidation { schemaVersion: 1; fixtureCount: number; passed: number; failures: Array<{ fixture: string; issue: string }> }

export async function validateDatabaseTeamAnalysisDb50Goldens(dataset: DatabaseTeamAnalysisDb50Dataset, coverage: DatabaseTeamAnalysisDb50Coverage): Promise<Db50GoldenValidation> {
    const fixturePath = existsSync(resolve(__dirname, "team-analysis-db50-golden-fixtures.json")) ? resolve(__dirname, "team-analysis-db50-golden-fixtures.json") : resolve(__dirname, "..", "..", "database-experiment", "team-analysis-db50-golden-fixtures.json");
    const fixtures = JSON.parse(await readFile(fixturePath, "utf8")) as any[];
    const failures: Array<{ fixture: string; issue: string }> = [];
    const candidates = [{ id: "first", resistDamageRate: 30 }, { id: "max-first", resistDamageRate: 80 }, { id: "max-tie", resistDamageRate: 80 }];
    const synthetic: Array<[string, boolean]> = [
        ["highest rate selection", selectDb50Counter(candidates)?.id === "max-first"],
        ["first wins ties", selectDb50Counter(candidates.slice().reverse())?.id === "max-tie"],
        ["empty selection", selectDb50Counter([]) === null],
        ["positive truncation", applyDb50CounterResistance(101, 59) === 42],
        ["negative truncation", applyDb50CounterResistance(-101, 59) === -42],
        ["zero operand", applyDb50CounterResistance(0, 59) === 0],
        ["zero rate", applyDb50CounterResistance(101, 0) === 101],
        ["full resistance", applyDb50CounterResistance(101, 100) === 0],
        ["native out-of-range arithmetic", applyDb50CounterResistance(100, 101) === -1],
        ["zero rate does not set flag", doesDb50RateSetFlag(0) === false],
        ["59 rate does not set flag", doesDb50RateSetFlag(59) === false],
        ["100 rate sets flag", doesDb50RateSetFlag(100) === true],
        ["selected dynamic rate controls flag", doesDb50RateSetFlag(selectDb50Counter(candidates)!.resistDamageRate) === false],
    ];
    for (const [name, passed] of synthetic) if (!passed) failures.push({ fixture: name, issue: "native selection or formula differs" });
    for (const fixture of fixtures) {
        const projection = dataset.projections.find(value => value.stateKey === fixture.stateKey && value.ruleKey === fixture.ruleKey);
        if (!projection) { failures.push({ fixture: fixture.name, issue: "rule missing" }); continue; }
        const actual = [projection.passiveSkillId, projection.payload.resistDamageRate.runtimeInteger, projection.payload.increaseDamagePercent.runtimeInteger, projection.payload.battleScriptNo.runtimeInteger, projection.rawActivation.probability, projection.rawActivation.calculationOption, projection.target.value.scope, projection.executionTiming.status === "supported" ? projection.executionTiming.event : "unknown", projection.selection.externalActivation, projection.damage.finalHpApplication];
        const expected = [fixture.passiveSkillId, fixture.resistDamageRate, fixture.increaseDamagePercent, fixture.battleScriptNo, fixture.probability, fixture.calcOption, fixture.target, fixture.timing, "unknown", "unknown"];
        if (JSON.stringify(actual) !== JSON.stringify(expected)) failures.push({ fixture: fixture.name, issue: "projection tuple differs" });
    }
    const expectedCoverage: Partial<DatabaseTeamAnalysisDb50Coverage> = { ruleCount: 50, affectedStateCount: 38, supportedPayloadFieldCount: 150, supportedTargetCount: 50, supportedTimingCount: 50, supportedSelectionCount: 50, supportedDamageCount: 50, partialSimulationCount: 50 };
    for (const [name, value] of Object.entries(expectedCoverage)) if (coverage[name as keyof DatabaseTeamAnalysisDb50Coverage] !== value) failures.push({ fixture: "coverage", issue: `${name} differs` });
    if (JSON.stringify(coverage.resistRateCounts) !== JSON.stringify({ "0": 44, "30": 1, "40": 1, "59": 1, "80": 1, "100": 2 }) || JSON.stringify(coverage.probabilityCounts) !== JSON.stringify({ "30": 4, "50": 8, "70": 15, "100": 23 })) failures.push({ fixture: "coverage distributions", issue: "raw distribution differs" });
    if (dataset.projections.some(value => value.registrationGate.fieldSemantic !== "unknown" || value.selection.callerBoolean !== "unknown" || value.selection.externalActivation !== "unknown" || value.damage.finalHpApplication !== "unknown" || value.simulationStatus !== "partial")) failures.push({ fixture: "conservative boundaries", issue: "independent unknown promoted" });
    const fixtureCount = synthetic.length + fixtures.length + 2;
    return { schemaVersion: 1, fixtureCount, passed: fixtureCount - failures.length, failures };
}
