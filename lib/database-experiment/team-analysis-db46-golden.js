"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDatabaseTeamAnalysisDb46Goldens = void 0;
const team_analysis_db46_builder_1 = require("./team-analysis-db46-builder");
function validateDatabaseTeamAnalysisDb46Goldens(d, c) { const f = []; if ((0, team_analysis_db46_builder_1.projectDb46Timing)(6)?.event !== "enemy_attack_pre_damage_calculation_setup")
    f.push("timing6"); if ((0, team_analysis_db46_builder_1.projectDb46Timing)(7)?.event !== "enemy_attack_post_damage_calculation_setup")
    f.push("timing7"); for (const x of [1, 4, 5, 8, -1, "bad"])
    if ((0, team_analysis_db46_builder_1.projectDb46Timing)(x) !== null)
        f.push(`unknown ${x}`); const expected = { ruleCount: 14301, effectCount: 18078, supportedBefore: 11522, supportedAfter: 12854, newlySupportedRuleCount: 1332, newlySupportedEffectCount: 1411, timing6RuleCount: 559, timing6EffectCount: 578, timing7RuleCount: 773, timing7EffectCount: 833, remainingUnknownRuleCount: 1447 }; for (const [k, v] of Object.entries(expected))
    if (c[k] !== v)
        f.push(`coverage ${k}`); if (d.ruleTimings.some(x => [6, 7].includes(Number(x.rawExecutionTimingType)) && (x.executionTiming.status !== "supported" || x.provenance.runtime?.evidenceFile !== "native-enemy-attack-timing-semantics.json")))
    f.push("corpus"); return { schemaVersion: 1, fixtureCount: 11, passed: 11 - f.length, failures: f }; }
exports.validateDatabaseTeamAnalysisDb46Goldens = validateDatabaseTeamAnalysisDb46Goldens;
//# sourceMappingURL=team-analysis-db46-golden.js.map