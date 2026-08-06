"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDatabaseTeamAnalysisDb20Goldens = void 0;
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
async function validateDatabaseTeamAnalysisDb20Goldens(dataset, coverage) {
    const path = (0, fs_1.existsSync)((0, path_1.resolve)(__dirname, "team-analysis-db20-golden-fixtures.json")) ? (0, path_1.resolve)(__dirname, "team-analysis-db20-golden-fixtures.json") : (0, path_1.resolve)(__dirname, "..", "..", "database-experiment", "team-analysis-db20-golden-fixtures.json");
    const fixture = JSON.parse(await (0, promises_1.readFile)(path, "utf8"));
    const failures = [];
    const check = (name, valid) => { if (!valid)
        failures.push({ fixture: name, issue: "value differs" }); };
    const exact = dataset.correlations.find(value => value.stateKey === fixture.exactExample.stateKey && value.databaseRuleKey === fixture.exactExample.databaseRuleKey);
    const mismatch = dataset.correlations.find(value => value.stateKey === fixture.mismatchExample.stateKey && value.databaseRuleKey === fixture.mismatchExample.databaseRuleKey);
    check("candidate count", coverage.candidateCount === fixture.expectedCandidates && coverage.candidateRulePairCount === fixture.expectedRulePairs);
    check("unique skills", coverage.uniquePassiveSkillCount === fixture.expectedUniquePassiveSkills);
    check("correlation reconciliation", Object.values(coverage.correlationCounts).reduce((total, value) => total + value, 0) === coverage.candidateCount);
    check("exact count", coverage.exactNumericMatchCount === fixture.expectedExactNumericMatches && coverage.correlationCounts.exact_numeric_match === fixture.expectedExactNumericMatches);
    check("mismatch count", coverage.correlationCounts.numeric_mismatch === fixture.expectedNumericMismatches);
    check("exact example", exact?.passiveSkillId === fixture.exactExample.passiveSkillId && exact.currentTurnFromEntryUpperBound === fixture.exactExample.currentUpperBound && exact.raw.turn === fixture.exactExample.rawTurn && exact.correlationStatus === "exact_numeric_match");
    check("mismatch example", mismatch?.passiveSkillId === fixture.mismatchExample.passiveSkillId && mismatch.currentTurnFromEntryUpperBound === fixture.mismatchExample.currentUpperBound && mismatch.raw.turn === fixture.mismatchExample.rawTurn && mismatch.correlationStatus === "numeric_mismatch");
    check("unknown conservative", dataset.passiveTurnSemanticStatus === "unknown" && dataset.correlations.every(value => value.semanticStatus === "unknown") && dataset.semanticPromotionCount === 0);
    check("provenance", dataset.correlations.every(value => value.provenance.table === "passive_skills" && value.provenance.rowId === value.passiveSkillId && JSON.stringify(value.provenance.columns) === JSON.stringify(["turn", "is_once", "exec_timing_type", "efficacy_type"])));
    return { fixtureCount: 9, passed: 9 - failures.length, failures };
}
exports.validateDatabaseTeamAnalysisDb20Goldens = validateDatabaseTeamAnalysisDb20Goldens;
//# sourceMappingURL=team-analysis-db20-golden.js.map