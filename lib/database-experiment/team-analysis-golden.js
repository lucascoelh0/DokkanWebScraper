"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDatabaseTeamAnalysisGoldens = void 0;
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const team_analysis_builder_1 = require("./team-analysis-builder");
function sourced(table, row) {
    return { values: row, provenance: { table, rowId: String(row.id), columns: Object.keys(row) } };
}
function comparable(values) {
    return values.map(value => value === undefined ? null : value);
}
async function validateDatabaseTeamAnalysisGoldens(tables) {
    const fixturePath = (0, fs_1.existsSync)((0, path_1.resolve)(__dirname, "team-analysis-golden-fixtures.json"))
        ? (0, path_1.resolve)(__dirname, "team-analysis-golden-fixtures.json")
        : (0, path_1.resolve)(__dirname, "..", "..", "database-experiment", "team-analysis-golden-fixtures.json");
    const parsed = JSON.parse(await (0, promises_1.readFile)(fixturePath, "utf8"));
    if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.fixtures))
        throw new Error("Unsupported DB2 golden fixture contract");
    const failures = [];
    for (const fixture of parsed.fixtures) {
        const relationRow = tables.passive_skill_set_relations.find(row => String(row.passive_skill_set_id) === fixture.setId && String(row.passive_skill_id) === fixture.skillId);
        const skillRow = tables.passive_skills.find(row => String(row.id) === fixture.skillId);
        if (!relationRow || !skillRow) {
            failures.push({ fixture: fixture.name, issue: "missing exact set/relation/skill join" });
            continue;
        }
        const effectRow = tables.passive_skill_effects.find(row => String(row.id) === String(skillRow.passive_skill_effect_id));
        const causalityIds = new Set();
        if (typeof skillRow.causality_conditions === "string") {
            try {
                const visit = (value) => {
                    if (typeof value === "number")
                        causalityIds.add(value);
                    else if (Array.isArray(value))
                        value.forEach(visit);
                    else if (value && typeof value === "object")
                        Object.values(value).forEach(visit);
                };
                visit(JSON.parse(skillRow.causality_conditions));
            }
            catch { /* invalid JSON is validated by the projector */ }
        }
        const causalities = tables.skill_causalities.filter(row => causalityIds.has(Number(row.id))).map(row => sourced("skill_causalities", row));
        const targetRows = tables.sub_target_types
            .filter(row => String(row.sub_target_type_set_id) === String(skillRow.sub_target_type_set_id) && Number(skillRow.sub_target_type_set_id) !== 0)
            .map(row => sourced("sub_target_types", row));
        const rule = (0, team_analysis_builder_1.mapDatabasePassiveRule)(fixture.setId, {
            relation: sourced("passive_skill_set_relations", relationRow),
            skill: sourced("passive_skills", skillRow),
            effect: effectRow ? sourced("passive_skill_effects", effectRow) : undefined,
            causalities,
        }, targetRows);
        const checks = [
            ["effectKinds", rule.effects.map(effect => effect.kind.value), fixture.effectKinds],
            ["targetScope", rule.target.targetType.value, fixture.targetScope],
            ["mappingStatus", rule.effectMappingStatus, fixture.mappingStatus],
        ];
        if (fixture.values)
            checks.push(["values", comparable(rule.effects.map(effect => effect.value)), fixture.values]);
        if (fixture.units)
            checks.push(["units", comparable(rule.effects.map(effect => effect.unit)), fixture.units]);
        if (fixture.activationChances)
            checks.push(["activationChances", comparable(rule.effects.map(effect => effect.activationChancePercent)), fixture.activationChances]);
        if (fixture.additionalToSuperChances)
            checks.push(["additionalToSuperChances", comparable(rule.effects.map(effect => effect.additionalToSuperChancePercent)), fixture.additionalToSuperChances]);
        if (fixture.sphereChange)
            checks.push(["sphereChange", [rule.effects[0]?.kiSphereChange?.source.value, rule.effects[0]?.kiSphereChange?.destination.value], fixture.sphereChange]);
        for (const [field, actual, expected] of checks) {
            if (JSON.stringify(actual) !== JSON.stringify(expected))
                failures.push({ fixture: fixture.name, issue: `${field}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}` });
        }
    }
    return { fixtureCount: parsed.fixtures.length, passed: parsed.fixtures.length - failures.length, failures };
}
exports.validateDatabaseTeamAnalysisGoldens = validateDatabaseTeamAnalysisGoldens;
//# sourceMappingURL=team-analysis-golden.js.map