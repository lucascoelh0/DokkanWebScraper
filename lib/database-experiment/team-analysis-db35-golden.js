"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDatabaseTeamAnalysisDb35Goldens = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
const team_analysis_db35_builder_1 = require("./team-analysis-db35-builder");
async function validateDatabaseTeamAnalysisDb35Goldens(d, c) { const fixtures = JSON.parse(await (0, promises_1.readFile)((0, path_1.resolve)(__dirname, "team-analysis-db35-golden-fixtures.json"), "utf8")), failures = []; for (const f of fixtures) {
    const projection = (0, team_analysis_db35_builder_1.projectDb35Target)(f.raw), actual = projection.status === "supported" ? projection.value.scope : "unknown";
    if (actual !== f.expected)
        failures.push(`${f.id}: ${actual}`);
} const rules = { self: 12083, team_allies: 1503, enemy: 209, all_enemies: 119, super_class_allies: 133, extreme_class_allies: 131, super_class_enemies: 15, extreme_class_enemies: 7, team_allies_excluding_self: 101 }, effects = { self: 15107, team_allies: 2035, enemy: 239, all_enemies: 164, super_class_allies: 190, extreme_class_allies: 185, super_class_enemies: 21, extreme_class_enemies: 11, team_allies_excluding_self: 126 }; if (c.ruleCount !== 14301 || c.effectCount !== 18078 || c.passiveSkillCount !== 13991 || c.affectedStateCount !== 1571 || c.supportedRuleCount !== 14301 || c.unknownRuleCount !== 0 || c.supportedEffectCount !== 18078)
    failures.push("snapshot population"); if (JSON.stringify(c.ruleCountsByTarget) !== JSON.stringify(Object.fromEntries(Object.entries(rules).sort(([a], [b]) => a.localeCompare(b)))) || JSON.stringify(c.effectCountsByTarget) !== JSON.stringify(Object.fromEntries(Object.entries(effects).sort(([a], [b]) => a.localeCompare(b)))))
    failures.push("snapshot target distribution"); if (c.rulesWithNonzeroRawSubTargetSetIdCount !== 847)
    failures.push("snapshot raw sub-target population"); if (d.ruleTargets.some(x => x.semanticStatus !== "partial" || x.subTarget.status !== "unknown" || x.subTarget.runtimeAssociation !== "unknown" || x.subTarget.valueTypeSemantics !== "unknown" || x.subTarget.booleanComposition !== "unknown"))
    failures.push("conservative boundary"); return { schemaVersion: 1, fixtureCount: fixtures.length + 4, passed: fixtures.length + 4 - failures.length, failures }; }
exports.validateDatabaseTeamAnalysisDb35Goldens = validateDatabaseTeamAnalysisDb35Goldens;
//# sourceMappingURL=team-analysis-db35-golden.js.map