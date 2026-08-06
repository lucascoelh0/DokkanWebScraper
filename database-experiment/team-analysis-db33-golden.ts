import { readFile } from "fs/promises";
import { resolve } from "path";
import { projectDb33AttackSetupTiming } from "./team-analysis-db33-builder";
import { DatabaseTeamAnalysisDb33Coverage, DatabaseTeamAnalysisDb33Dataset } from "./team-analysis-db33-contract";

interface Fixture { id: string, raw: unknown, expected: "player_attack_setup" | "unknown" | "not_newly_promoted" }
export async function validateDatabaseTeamAnalysisDb33Goldens(dataset: DatabaseTeamAnalysisDb33Dataset, coverage: DatabaseTeamAnalysisDb33Coverage) {
    const fixtures = JSON.parse(await readFile(resolve(__dirname, "team-analysis-db33-golden-fixtures.json"), "utf8")) as Fixture[];
    const failures: string[] = [];
    for (const fixture of fixtures) {
        const projected = projectDb33AttackSetupTiming(fixture.raw);
        const actual = projected.status === "supported" ? projected.event : fixture.raw === 1 ? "not_newly_promoted" : "unknown";
        if (actual !== fixture.expected) failures.push(`${fixture.id}: ${actual}`);
    }
    if (coverage.newlySupportedRuleCount !== 1830 || coverage.newlySupportedEffectCount !== 2497 || coverage.newlySupportedPassiveSkillCount !== 1787 || coverage.newlySupportedStateCount !== 827) failures.push("snapshot attack-setup coverage");
    if (coverage.supportedRuleCount !== 10891 || coverage.unknownRuleCount !== 3410) failures.push("combined support coverage");
    if (dataset.ruleTimings.some(rule => rule.executionTiming.status === "supported" && rule.executionTiming.event === "player_attack_setup" && Object.values(rule.independentDimensions).some(value => value !== "unknown"))) failures.push("independent dimensions");
    return { schemaVersion: 1 as const, fixtureCount: fixtures.length + 3, passed: fixtures.length + 3 - failures.length, failures };
}
