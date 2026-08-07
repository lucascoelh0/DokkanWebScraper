"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDatabaseTeamAnalysisDb47Goldens = void 0;
const team_analysis_db47_builder_1 = require("./team-analysis-db47-builder");
function validateDatabaseTeamAnalysisDb47Goldens(d, c) { const f = []; if ((0, team_analysis_db47_builder_1.projectDb47Timing)(15)?.event !== "puzzle_attack_move_end_after_controller_callback")
    f.push("positive"); for (const x of [1, 4, 5, 6, 7, 14, 16, -1, "bad"])
    if ((0, team_analysis_db47_builder_1.projectDb47Timing)(x) !== null)
        f.push(`negative ${x}`); const expected = { ruleCount: 14301, effectCount: 18078, supportedBefore: 12854, supportedAfter: 13677, newlySupportedRuleCount: 823, newlySupportedEffectCount: 992, newlySupportedPassiveSkillCount: 799, newlySupportedStateCount: 201, remainingUnknownRuleCount: 624 }; for (const [k, v] of Object.entries(expected))
    if (c[k] !== v)
        f.push(`coverage ${k}`); if (d.ruleTimings.some(x => Number(x.rawExecutionTimingType) === 15 && (x.executionTiming.status !== "supported" || x.provenance.runtime?.evidenceFile !== "native-puzzle-move-end-timing-semantics.json")))
    f.push("corpus"); return { schemaVersion: 1, fixtureCount: 12, passed: 12 - f.length, failures: f }; }
exports.validateDatabaseTeamAnalysisDb47Goldens = validateDatabaseTeamAnalysisDb47Goldens;
//# sourceMappingURL=team-analysis-db47-golden.js.map