import { readFile } from "fs/promises";
import { resolve } from "path";
import { db34OperandUnit, projectDb34BasicStatShape, projectDb34CalculationBucket } from "./team-analysis-db34-builder";
import { DatabaseTeamAnalysisDb34Coverage, DatabaseTeamAnalysisDb34Dataset } from "./team-analysis-db34-contract";
import { Db31Operation } from "./team-analysis-db31-contract";

interface Fixture { id: string, kind: "bucket" | "shape" | "unit", raw: unknown, expected: string }
const GOLDEN_OPERATIONS: Record<number, Db31Operation> = { 0: "add", 1: "subtract_floor_zero", 2: "add_percent_of_lhs", 3: "subtract_percent_of_lhs_floor_zero", 4: "assign_rhs" };
export async function validateDatabaseTeamAnalysisDb34Goldens(dataset: DatabaseTeamAnalysisDb34Dataset, coverage: DatabaseTeamAnalysisDb34Coverage) {
    const fixtures = JSON.parse(await readFile(resolve(__dirname, "team-analysis-db34-golden-fixtures.json"), "utf8")) as Fixture[];
    const failures: string[] = [];
    for (const fixture of fixtures) {
        const operation = typeof fixture.raw === "number" ? GOLDEN_OPERATIONS[fixture.raw] : undefined;
        const actual = fixture.kind === "bucket"
            ? projectDb34CalculationBucket(fixture.raw).value
            : fixture.kind === "shape"
                ? projectDb34BasicStatShape(fixture.raw).map(value => `${value.stat}:${value.sourceColumn}`).join("+") || "unknown"
                : db34OperandUnit(operation ? { status: "supported", value: operation, formula: "golden", parametersRead: [], parametersIgnored: [], clamp: "golden" } : { status: "unknown", value: "unknown" }).value;
        if (actual !== fixture.expected) failures.push(`${fixture.id}: ${actual}`);
    }
    if (coverage.basicStatRuleCount !== 5612 || coverage.statApplicationCount !== 9239 || coverage.affectedPassiveSkillCount !== 5466 || coverage.affectedStateCount !== 1384) failures.push("snapshot basic-stat coverage");
    if (coverage.unknownBucketRuleCount !== 0 || coverage.unknownBucketApplicationCount !== 0 || JSON.stringify(coverage.ruleCountsByBucket) !== JSON.stringify({ former_passive_stat: 3986, latter_passive_stat: 1626 }) || JSON.stringify(coverage.applicationCountsByBucket) !== JSON.stringify({ former_passive_stat: 6847, latter_passive_stat: 2392 })) failures.push("snapshot bucket distribution");
    if (JSON.stringify(coverage.applicationCountsByOperation) !== JSON.stringify({ add: 83, add_percent_of_lhs: 8907, subtract_percent_of_lhs_floor_zero: 249 }) || JSON.stringify(coverage.applicationCountsByOperandUnit) !== JSON.stringify({ percent_points_of_current_stat: 9156, stat_points: 83 })) failures.push("snapshot operation and unit distribution");
    if (coverage.alignedBasicStatRuleCount !== 1901 || coverage.confirmedLegacyConflictCount !== 0 || coverage.candidateLegacyConflictCount !== 4) failures.push("legacy diagnostic boundary");
    if (dataset.statApplications.some(value => value.runtimeModifierFloat32 !== Math.fround(Number(value.rawModifier)) || Object.values(value.independentDimensions).some(field => field !== "unknown"))) failures.push("precision or independent dimension boundary");
    return { schemaVersion: 1 as const, fixtureCount: fixtures.length + 4, passed: fixtures.length + 4 - failures.length, failures };
}
