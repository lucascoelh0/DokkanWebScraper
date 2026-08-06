"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDatabaseTeamAnalysisDb38Goldens = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
const team_analysis_db38_builder_1 = require("./team-analysis-db38-builder");
async function validateDatabaseTeamAnalysisDb38Goldens(d, c) { const fixtures = JSON.parse(await (0, promises_1.readFile)((0, path_1.resolve)(__dirname, "team-analysis-db38-golden-fixtures.json"), "utf8")), failures = []; for (const f of fixtures) {
    if (Array.isArray(f.history)) {
        if ((0, team_analysis_db38_builder_1.foldDb38IncrementalHistory)(f.history, f.cap) !== f.aggregate)
            failures.push(f.id);
        continue;
    }
    const p = (0, team_analysis_db38_builder_1.projectDb38Incremental)(f.increment, f.cap, f.selector);
    if (p.status !== f.status || p.outputField !== f.field)
        failures.push(f.id);
} if (c.ruleCount !== 720 || c.effectCount !== 720 || c.affectedStateCount !== 329 || c.passiveSkillCount !== 719 || c.supportedFieldRuleCount !== 720 || c.simulationPartialRuleCount !== 720 || c.simulationUnknownRuleCount !== 0 || c.confirmedLegacyConflictCount !== 88 || c.conflictStateCount !== 79)
    failures.push("snapshot population"); if (JSON.stringify(c.ruleCountsByOutputSelector) !== JSON.stringify({ "0": 250, "1": 232, "2": 70, "3": 41, "4": 39, "5": 88 }) || JSON.stringify(c.stateCountsByOutputSelector) !== JSON.stringify({ "0": 231, "1": 217, "2": 69, "3": 39, "4": 39, "5": 79 }) || JSON.stringify(c.ruleCountsByTiming) !== JSON.stringify({ "1": 77, "4": 6, "5": 359, "6": 13, "7": 263, "9": 1, "14": 1 }) || JSON.stringify(c.ruleCountsByCalculationOption) !== JSON.stringify({ "0": 93, "2": 627 }))
    failures.push("snapshot distributions"); if (d.ruleIncrements.some(r => r.independentDimensions.timing !== "independent" || r.independentDimensions.calculationOperation !== "independent" || r.incremental.accumulation.historyIterationOrder !== "vector_begin_to_end_stored_order" || r.incremental.accumulation.arithmetic !== "signed_int32_add_wrap_modulo_2_32" || r.incremental.recurrence.appendTriggerSemantics !== "unknown" || r.incremental.recurrence.reset !== "unknown"))
    failures.push("boundary"); return { schemaVersion: 1, fixtureCount: fixtures.length + 3, passed: fixtures.length + 3 - failures.length, failures }; }
exports.validateDatabaseTeamAnalysisDb38Goldens = validateDatabaseTeamAnalysisDb38Goldens;
//# sourceMappingURL=team-analysis-db38-golden.js.map