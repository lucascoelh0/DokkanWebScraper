import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { resolve } from "path";
import { DatabaseExperimentTables } from "./builder";
import { SourcedRow } from "./contract";
import { mapDatabasePassiveRule } from "./team-analysis-builder";

interface GoldenFixture {
    name: string,
    setId: string,
    skillId: string,
    effectKinds: string[],
    values?: number[],
    units?: string[],
    activationChances?: number[],
    additionalToSuperChances?: number[],
    sphereChange?: string[],
    targetScope: string,
    mappingStatus: string,
}

function sourced(table: string, row: Record<string, any>): SourcedRow {
    return { values: row, provenance: { table, rowId: String(row.id), columns: Object.keys(row) } };
}

function comparable(values: Array<number | string | undefined>): Array<number | string | null> {
    return values.map(value => value === undefined ? null : value);
}

export async function validateDatabaseTeamAnalysisGoldens(tables: DatabaseExperimentTables): Promise<{
    fixtureCount: number,
    passed: number,
    failures: Array<{ fixture: string, issue: string }>,
}> {
    const fixturePath = existsSync(resolve(__dirname, "team-analysis-golden-fixtures.json"))
        ? resolve(__dirname, "team-analysis-golden-fixtures.json")
        : resolve(__dirname, "..", "..", "database-experiment", "team-analysis-golden-fixtures.json");
    const parsed = JSON.parse(await readFile(fixturePath, "utf8")) as { schemaVersion: number, fixtures: GoldenFixture[] };
    if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.fixtures)) throw new Error("Unsupported DB2 golden fixture contract");
    const failures: Array<{ fixture: string, issue: string }> = [];
    for (const fixture of parsed.fixtures) {
        const relationRow = tables.passive_skill_set_relations.find(row => String(row.passive_skill_set_id) === fixture.setId && String(row.passive_skill_id) === fixture.skillId);
        const skillRow = tables.passive_skills.find(row => String(row.id) === fixture.skillId);
        if (!relationRow || !skillRow) {
            failures.push({ fixture: fixture.name, issue: "missing exact set/relation/skill join" });
            continue;
        }
        const effectRow = tables.passive_skill_effects.find(row => String(row.id) === String(skillRow.passive_skill_effect_id));
        const causalityIds = new Set<number>();
        if (typeof skillRow.causality_conditions === "string") {
            try {
                const visit = (value: unknown) => {
                    if (typeof value === "number") causalityIds.add(value);
                    else if (Array.isArray(value)) value.forEach(visit);
                    else if (value && typeof value === "object") Object.values(value as Record<string, unknown>).forEach(visit);
                };
                visit(JSON.parse(skillRow.causality_conditions));
            } catch { /* invalid JSON is validated by the projector */ }
        }
        const causalities = tables.skill_causalities.filter(row => causalityIds.has(Number(row.id))).map(row => sourced("skill_causalities", row));
        const targetRows = tables.sub_target_types
            .filter(row => String(row.sub_target_type_set_id) === String(skillRow.sub_target_type_set_id) && Number(skillRow.sub_target_type_set_id) !== 0)
            .map(row => sourced("sub_target_types", row));
        const rule = mapDatabasePassiveRule(fixture.setId, {
            relation: sourced("passive_skill_set_relations", relationRow),
            skill: sourced("passive_skills", skillRow),
            effect: effectRow ? sourced("passive_skill_effects", effectRow) : undefined,
            causalities,
        }, targetRows)!;
        const checks: Array<[string, unknown, unknown]> = [
            ["effectKinds", rule.effects.map(effect => effect.kind.value), fixture.effectKinds],
            ["targetScope", rule.target.targetType.value, fixture.targetScope],
            ["mappingStatus", rule.effectMappingStatus, fixture.mappingStatus],
        ];
        if (fixture.values) checks.push(["values", comparable(rule.effects.map(effect => effect.value)), fixture.values]);
        if (fixture.units) checks.push(["units", comparable(rule.effects.map(effect => effect.unit)), fixture.units]);
        if (fixture.activationChances) checks.push(["activationChances", comparable(rule.effects.map(effect => effect.activationChancePercent)), fixture.activationChances]);
        if (fixture.additionalToSuperChances) checks.push(["additionalToSuperChances", comparable(rule.effects.map(effect => effect.additionalToSuperChancePercent)), fixture.additionalToSuperChances]);
        if (fixture.sphereChange) checks.push(["sphereChange", [rule.effects[0]?.kiSphereChange?.source.value, rule.effects[0]?.kiSphereChange?.destination.value], fixture.sphereChange]);
        for (const [field, actual, expected] of checks) {
            if (JSON.stringify(actual) !== JSON.stringify(expected)) failures.push({ fixture: fixture.name, issue: `${field}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}` });
        }
    }
    return { fixtureCount: parsed.fixtures.length, passed: parsed.fixtures.length - failures.length, failures };
}
