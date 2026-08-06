"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const team_analysis_db20_builder_1 = require("./team-analysis-db20-builder");
function fixture() {
    const signature = JSON.stringify({ comparator: "lte", kind: "turn_from_entry", logicalContext: "all", negated: false, scope: "self", value: 3 });
    const db11 = { contractVersion: "0.10.0", sourceSnapshotVersion: "snapshot", sourceSha256: "database", states: [{ stateKey: "1", passive: { rules: [{ ruleKey: "d", source: { passiveSkillId: "10" } }] } }] };
    const db19 = { contractVersion: "0.18.0", generatedAt: "x", sourceSnapshotVersion: "snapshot", sourceDatabaseSha256: "database", sourceCurrentTeamAnalysis: { sha256: "current", parserVersion: "parser" }, inheritedSemanticPromotionCount: 3, semanticPromotionCount: 0, residualAttributions: [{ stateKey: "1", databaseRuleKey: "d", currentRuleKey: "c", side: "current", structuralSignature: signature, reason: "absent_in_other", candidateSignatures: [] }] };
    const tables = { passive_skills: [{ id: 10, turn: 3, is_once: 1, exec_timing_type: 1, efficacy_type: 90 }] };
    return { db11, db19, tables };
}
(0, mocha_1.describe)("database Team Analysis DB20 passive turn correlation", function () {
    (0, mocha_1.it)("correlates the structured passive turn without promoting semantics", () => { const { db11, db19, tables } = fixture(); const dataset = (0, team_analysis_db20_builder_1.buildDatabaseTeamAnalysisDb20Dataset)({ db11, db11Sha256: "db11", db19, db19Sha256: "db19", tables }); const coverage = (0, team_analysis_db20_builder_1.buildDatabaseTeamAnalysisDb20Coverage)(dataset); (0, assert_1.equal)(dataset.correlations[0].correlationStatus, "exact_numeric_match"); (0, assert_1.equal)(dataset.correlations[0].semanticStatus, "unknown"); (0, assert_1.equal)(coverage.exactNumericMatchCount, 1); (0, assert_1.equal)(coverage.semanticPromotionCount, 0); });
    (0, mocha_1.it)("preserves a mismatch instead of reinterpreting it", () => { const { db11, db19, tables } = fixture(); tables.passive_skills[0].turn = 1; const dataset = (0, team_analysis_db20_builder_1.buildDatabaseTeamAnalysisDb20Dataset)({ db11, db11Sha256: "db11", db19, db19Sha256: "db19", tables }); (0, assert_1.equal)(dataset.correlations[0].correlationStatus, "numeric_mismatch"); (0, assert_1.equal)(dataset.correlations[0].raw.turn, 1); });
    (0, mocha_1.it)("rejects source lineage drift", () => { const { db11, db19, tables } = fixture(); db19.sourceDatabaseSha256 = "other"; (0, assert_1.throws)(() => (0, team_analysis_db20_builder_1.buildDatabaseTeamAnalysisDb20Dataset)({ db11, db11Sha256: "db11", db19, db19Sha256: "db19", tables }), /source lineage mismatch/); });
});
//# sourceMappingURL=team-analysis-db20-builder.spec.js.map