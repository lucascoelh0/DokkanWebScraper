"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDatabaseTeamAnalysisDb36Goldens = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
const team_analysis_db36_builder_1 = require("./team-analysis-db36-builder");
async function validateDatabaseTeamAnalysisDb36Goldens(d, c) { const f = JSON.parse(await (0, promises_1.readFile)((0, path_1.resolve)(__dirname, "team-analysis-db36-golden-fixtures.json"), "utf8")), failures = []; for (const x of f) {
    const a = (0, team_analysis_db36_builder_1.projectDb36Filter)({ id: 1, target_value_type: x.rawType, target_value: x.rawValue });
    if (a.status !== x.expectedStatus || a.selector !== x.expectedSelector || a.inclusion !== x.expectedInclusion)
        failures.push(x.id);
} if (c.ruleCount !== 14301 || c.effectCount !== 18078 || c.supportedRuleCount !== 14301 || c.partialRuleCount !== 0 || c.unknownRuleCount !== 0 || c.emptyIdentityRuleCount !== 13454 || c.nonemptyRuleCount !== 847 || c.affectedStateCount !== 286 || c.passiveSkillCount !== 844 || c.distinctNonzeroSetCount !== 194)
    failures.push("snapshot population"); if (JSON.stringify(c.ruleCountsByValueType) !== JSON.stringify({ "1": 769, "2": 154, "4": 72, "5": 18 }) || JSON.stringify(c.effectCountsByValueType) !== JSON.stringify({ "1": 1095, "2": 218, "4": 105, "5": 24 }) || JSON.stringify(c.joinedRowOccurrencesByValueType) !== JSON.stringify({ "1": 802, "2": 166, "4": 72, "5": 24 }))
    failures.push("snapshot types"); if (d.ruleSubTargets.some(r => { const x = r.independentDimensions; return r.composition !== "and" || r.emptySetBehavior !== "identity" || x.targetCandidateScope !== "inherited_db35" || x.timing !== "independent" || x.operation !== "independent" || x.unit !== "independent" || x.calculationBucket !== "unknown" || x.duration !== "unknown" || x.recurrence !== "unknown" || x.expiry !== "unknown" || x.reset !== "unknown"; }))
    failures.push("boundary"); return { schemaVersion: 1, fixtureCount: f.length + 3, passed: f.length + 3 - failures.length, failures }; }
exports.validateDatabaseTeamAnalysisDb36Goldens = validateDatabaseTeamAnalysisDb36Goldens;
//# sourceMappingURL=team-analysis-db36-golden.js.map