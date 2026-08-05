"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDatabaseTeamAnalysisDb8Goldens = void 0;
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
function containsUnknown(expression, causalityId) {
    if (expression.op === "unknown")
        return expression.causalityId === causalityId;
    if (expression.op === "all" || expression.op === "any")
        return expression.children.some(child => containsUnknown(child, causalityId));
    if (expression.op === "not")
        return containsUnknown(expression.child, causalityId);
    return false;
}
async function validateDatabaseTeamAnalysisDb8Goldens(dataset, db7) {
    const fixturePath = (0, fs_1.existsSync)((0, path_1.resolve)(__dirname, "team-analysis-db8-golden-fixtures.json")) ? (0, path_1.resolve)(__dirname, "team-analysis-db8-golden-fixtures.json") : (0, path_1.resolve)(__dirname, "..", "..", "database-experiment", "team-analysis-db8-golden-fixtures.json");
    const parsed = JSON.parse(await (0, promises_1.readFile)(fixturePath, "utf8"));
    if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.fixtures))
        throw new Error("Unsupported DB8 golden fixture contract");
    const failures = [];
    for (const fixture of parsed.fixtures) {
        const rule = db7.states.find(value => value.stateKey === fixture.stateKey)?.passive?.rules.find(value => value.ruleKey === fixture.ruleKey);
        if (fixture.mode === "combat_history") {
            const gap = dataset.combatHistoryGaps.find(value => value.stateKey === fixture.stateKey && value.ruleKey === fixture.ruleKey && value.causalityId === fixture.causalityId);
            if (!gap) {
                failures.push({ fixture: fixture.name, issue: "missing exact combat-history gap" });
                continue;
            }
            if (JSON.stringify(gap.rawCausality) !== JSON.stringify({ cauVal1: fixture.cauVal1, cauVal2: fixture.cauVal2, cauVal3: fixture.cauVal3 }))
                failures.push({ fixture: fixture.name, issue: "combat-history raw tuple mismatch" });
            if (gap.provenance.table !== "skill_causalities" || gap.provenance.rowId !== fixture.causalityId)
                failures.push({ fixture: fixture.name, issue: "combat-history provenance mismatch" });
            if (gap.requiredEvidence.length !== 2)
                failures.push({ fixture: fixture.name, issue: "combat-history required evidence missing" });
            continue;
        }
        const gap = dataset.causalityGaps.find(value => Number(value.causalityType) === fixture.causalityType);
        if (!gap) {
            failures.push({ fixture: fixture.name, issue: "missing causality gap" });
            continue;
        }
        if (!gap.causalityIds.includes(fixture.causalityId))
            failures.push({ fixture: fixture.name, issue: "missing source causality ID" });
        if (!gap.rawValueDomains.cauVal1.some(value => Number(value) === fixture.cauVal1))
            failures.push({ fixture: fixture.name, issue: "missing raw cau_val1" });
        if (fixture.cauVal2 !== undefined && !gap.rawValueDomains.cauVal2.some(value => Number(value) === fixture.cauVal2))
            failures.push({ fixture: fixture.name, issue: "missing raw cau_val2" });
        if (fixture.cauVal3 !== undefined && !gap.rawValueDomains.cauVal3.some(value => Number(value) === fixture.cauVal3))
            failures.push({ fixture: fixture.name, issue: "missing raw cau_val3" });
        const conditionPreserved = fixture.mode === "partial_selector" ? rule?.selectorConditions.some(value => value.causalityId === fixture.causalityId && value.status === "partial") : rule ? containsUnknown(rule.condition, fixture.causalityId) : false;
        if (!rule || !conditionPreserved)
            failures.push({ fixture: fixture.name, issue: "DB7 state/rule no longer preserves exact unresolved causality" });
        if (dataset.semanticPromotionCount !== 0)
            failures.push({ fixture: fixture.name, issue: "diagnostic gate performed a semantic promotion" });
    }
    return { fixtureCount: parsed.fixtures.length, passed: parsed.fixtures.length - failures.length, failures };
}
exports.validateDatabaseTeamAnalysisDb8Goldens = validateDatabaseTeamAnalysisDb8Goldens;
//# sourceMappingURL=team-analysis-db8-golden.js.map