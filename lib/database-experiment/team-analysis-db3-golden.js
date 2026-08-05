"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDatabaseTeamAnalysisDb3Goldens = void 0;
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const team_analysis_builder_1 = require("./team-analysis-builder");
const team_analysis_db3_builder_1 = require("./team-analysis-db3-builder");
function sourced(table, row) {
    return { values: row, provenance: { table, rowId: String(row.id), columns: Object.keys(row) } };
}
function collectCausalityIds(raw) {
    const ids = new Set();
    const visit = (value) => {
        if (typeof value === "number")
            ids.add(value);
        else if (Array.isArray(value))
            value.forEach(visit);
        else if (value && typeof value === "object")
            Object.values(value).forEach(visit);
    };
    if (typeof raw === "string" && raw.trim()) {
        try {
            visit(JSON.parse(raw));
        }
        catch { /* the DB2 projector records invalid JSON */ }
    }
    return ids;
}
function findPredicate(expression) {
    if (expression.op === "predicate")
        return expression.predicate;
    if (expression.op === "all" || expression.op === "any")
        return expression.children.map(findPredicate).find(Boolean);
    if (expression.op === "not")
        return findPredicate(expression.child);
    return undefined;
}
function comparable(values) {
    return values.map(value => value === undefined ? null : value);
}
async function validateDatabaseTeamAnalysisDb3Goldens(tables) {
    const fixturePath = (0, fs_1.existsSync)((0, path_1.resolve)(__dirname, "team-analysis-db3-golden-fixtures.json"))
        ? (0, path_1.resolve)(__dirname, "team-analysis-db3-golden-fixtures.json")
        : (0, path_1.resolve)(__dirname, "..", "..", "database-experiment", "team-analysis-db3-golden-fixtures.json");
    const parsed = JSON.parse(await (0, promises_1.readFile)(fixturePath, "utf8"));
    if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.fixtures))
        throw new Error("Unsupported DB3 golden fixture contract");
    const failures = [];
    for (const fixture of parsed.fixtures) {
        const relationRow = tables.passive_skill_set_relations.find(row => String(row.passive_skill_set_id) === fixture.setId && String(row.passive_skill_id) === fixture.skillId);
        const skillRow = tables.passive_skills.find(row => String(row.id) === fixture.skillId);
        if (!relationRow || !skillRow) {
            failures.push({ fixture: fixture.name, issue: "missing exact set/relation/skill join" });
            continue;
        }
        const effectRow = tables.passive_skill_effects.find(row => String(row.id) === String(skillRow.passive_skill_effect_id));
        const causalityIds = collectCausalityIds(skillRow.causality_conditions);
        const causalities = tables.skill_causalities.filter(row => causalityIds.has(Number(row.id))).map(row => sourced("skill_causalities", row));
        const targetRows = tables.sub_target_types
            .filter(row => String(row.sub_target_type_set_id) === String(skillRow.sub_target_type_set_id) && Number(skillRow.sub_target_type_set_id) !== 0)
            .map(row => sourced("sub_target_types", row));
        const db2 = (0, team_analysis_builder_1.mapDatabasePassiveRule)(fixture.setId, {
            relation: sourced("passive_skill_set_relations", relationRow),
            skill: sourced("passive_skills", skillRow),
            effect: effectRow ? sourced("passive_skill_effects", effectRow) : undefined,
            causalities,
        }, targetRows);
        if (!db2) {
            failures.push({ fixture: fixture.name, issue: "DB2 mapper returned no rule" });
            continue;
        }
        const rule = (0, team_analysis_db3_builder_1.mapDatabaseTeamAnalysisDb3Rule)(db2, tables);
        const sphereSelectors = rule.effects.flatMap(effect => effect.scaling?.kind === "per_ki_sphere" ? [effect.scaling.selector.semantic] : []);
        const scalingEvents = rule.effects.flatMap(effect => effect.scaling?.kind === "per_combat_event" ? [effect.scaling.event] : []);
        const predicate = findPredicate(rule.condition);
        const checks = [];
        if (fixture.effectKinds)
            checks.push(["effectKinds", rule.effects.map(effect => effect.kind), fixture.effectKinds]);
        if (fixture.values)
            checks.push(["values", comparable(rule.effects.map(effect => effect.value)), fixture.values]);
        if (fixture.units)
            checks.push(["units", comparable(rule.effects.map(effect => effect.unit)), fixture.units]);
        if (fixture.stackCaps)
            checks.push(["stackCaps", comparable(rule.effects.map(effect => effect.stackCap)), fixture.stackCaps]);
        if (fixture.sphereSelectors)
            checks.push(["sphereSelectors", sphereSelectors, fixture.sphereSelectors]);
        if (fixture.scalingEvents)
            checks.push(["scalingEvents", scalingEvents, fixture.scalingEvents]);
        if (fixture.sphereChange)
            checks.push(["sphereChange", rule.effects[0]?.kiSphereChange, fixture.sphereChange]);
        if (fixture.conditionOp)
            checks.push(["conditionOp", rule.condition.op, fixture.conditionOp]);
        if (fixture.conditionStatus)
            checks.push(["conditionStatus", rule.conditionStatus, fixture.conditionStatus]);
        if (fixture.effectStatus)
            checks.push(["effectStatus", rule.effectStatus, fixture.effectStatus]);
        if (fixture.predicate) {
            for (const [key, expected] of Object.entries(fixture.predicate))
                checks.push([`predicate.${key}`, predicate?.[key], expected]);
        }
        for (const [field, actual, expected] of checks) {
            if (JSON.stringify(actual) !== JSON.stringify(expected))
                failures.push({ fixture: fixture.name, issue: `${field}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}` });
        }
    }
    return { fixtureCount: parsed.fixtures.length, passed: parsed.fixtures.length - failures.length, failures };
}
exports.validateDatabaseTeamAnalysisDb3Goldens = validateDatabaseTeamAnalysisDb3Goldens;
//# sourceMappingURL=team-analysis-db3-golden.js.map