"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const team_analysis_db14_builder_1 = require("./team-analysis-db14-builder");
const team_analysis_db14_report_1 = require("./team-analysis-db14-report");
function fixture() {
    const runtime = (type, value) => ({ causalityId: `${type}`, causalityType: type, predicate: { kind: "turn_from_entry", scope: "self", comparator: type === 51 ? "lte" : "gte", value, nativeComparator: type === 51 ? "lte" : "gt", nativeThreshold: type === 51 ? value : value - 1, appearanceGate: "appearance_initialized", sourceCausalityId: `${type}`, sourceCausalityType: type, evidence: "first-party-native-runtime" }, raw: { cauVal1: value, cauVal2: 0, cauVal3: 0 }, provenance: { database: { table: "skill_causalities", rowId: `${type}`, columns: ["causality_type", "cau_val1", "cau_val2", "cau_val3"] }, runtime: { fileName: "libcocos2dcpp.so", symbol: `${type}`, vma: type, sizeBytes: 4, codeSha256: "a".repeat(64) } } });
    const signature = JSON.stringify({ comparator: "eq", kind: "turn_from_entry", logicalContext: "any", negated: false, scope: "self", value: 3 });
    const candidate = (rule) => ({ stateKey: "1:1:initial", value: 3, negated: false, databaseRuleKey: rule, databaseConjunctionGroup: `${rule}:group`, databaseLowerSignature: JSON.stringify({ logicalContext: "any>all", negated: false }), currentExactSignatures: [signature] });
    const db11 = { contractVersion: "0.10.0", sourceSnapshotVersion: "snapshot", sourceSha256: "database", states: [{ stateKey: "1:1:initial", characterId: "1", formId: "1", releaseState: "initial", passive: { rules: [{ ruleKey: "db-aligned", runtimeConditions: [runtime(55, 3), runtime(51, 3)] }] } }] };
    const db12 = { contractVersion: "0.11.0", generatedAt: "x", sourceDb11: { sha256: "db11" }, sourceCurrentTeamAnalysis: { sha256: "current" }, sourceDatabaseSha256: "database", semanticPromotionCount: 0, exactTurnEncodingCandidates: [candidate("db-aligned"), candidate("db-unaligned")], diagnosticCurrentExactTurnAtoms: [{ stateKey: "1:1:initial", atom: { value: 3, negated: false, structuralSignature: signature }, sourceRuleKeys: ["current-aligned"] }] };
    const assessment = (rule, status, aligned) => ({ stateKey: "1:1:initial", value: 3, databaseRuleKey: rule, databaseLogicalContext: "any>all", databaseNegated: false, alignedCurrentRuleKeys: aligned, status });
    const db13 = { contractVersion: "0.12.1", generatedAt: "x", sourceDb11: { sha256: "db11" }, sourceDb12: { sha256: "db12" }, sourceCurrentTeamAnalysis: { sha256: "current", parserVersion: "parser" }, sourceDatabaseSha256: "database", semanticPromotionCount: 0,
        exactTurnRuleAssessments: [assessment("db-aligned", "rule_aligned_unique_effect_shape", ["current-aligned"]), assessment("db-unaligned", "rule_unaligned", [])],
        ruleAlignments: [{ stateKey: "1:1:initial", databaseRuleKey: "db-aligned", currentRuleKey: "current-aligned", kind: "exact_effect_set_unique", sharedEffectSignatures: ["effect"] }] };
    return { db11, db12, db13 };
}
(0, mocha_1.describe)("database Team Analysis DB14 exact-turn compatibility", function () {
    (0, mocha_1.it)("projects only rule-aligned bounds and retains native provenance", () => {
        const { db11, db12, db13 } = fixture();
        const dataset = (0, team_analysis_db14_builder_1.buildDatabaseTeamAnalysisDb14Dataset)({ db11, db11Sha256: "db11", db12, db12Sha256: "db12", db13, db13Sha256: "db13", currentSha256: "current", siteAudit: { formProjectionAliases: [] } });
        (0, assert_1.equal)(dataset.exactTurnCompatibilityAliases.length, 1);
        const alias = dataset.exactTurnCompatibilityAliases[0];
        (0, assert_1.equal)(alias.compatibilityPredicate.comparator, "eq");
        (0, assert_1.equal)(alias.nativeBounds.lower.causalityType, 55);
        (0, assert_1.equal)(alias.nativeBounds.upper.causalityType, 51);
        (0, assert_1.equal)(alias.ruleAlignment.kind, "exact_effect_set_unique");
        const coverage = (0, team_analysis_db14_builder_1.buildDatabaseTeamAnalysisDb14Coverage)(dataset, db13);
        (0, assert_1.equal)(coverage.compatibilityAliasCount, 1);
        (0, assert_1.equal)(coverage.skippedUnalignedCount, 1);
    });
    (0, mocha_1.it)("rejects a DB13 artifact from another DB12 hash", () => {
        const { db11, db12, db13 } = fixture();
        db13.sourceDb12.sha256 = "other";
        (0, assert_1.throws)(() => (0, team_analysis_db14_builder_1.buildDatabaseTeamAnalysisDb14Dataset)({ db11, db11Sha256: "db11", db12, db12Sha256: "db12", db13, db13Sha256: "db13", currentSha256: "current", siteAudit: { formProjectionAliases: [] } }), /source lineage mismatch/);
    });
    (0, mocha_1.it)("keeps positive and negated aliases distinct and reports their polarity", () => {
        const { db11, db12, db13 } = fixture();
        const negativeSignature = JSON.stringify({ comparator: "eq", kind: "turn_from_entry", logicalContext: "any", negated: true, scope: "self", value: 3 });
        db12.exactTurnEncodingCandidates.push({ ...db12.exactTurnEncodingCandidates[0], negated: true, databaseConjunctionGroup: "db-aligned:negative", databaseLowerSignature: JSON.stringify({ logicalContext: "any>all", negated: true }), currentExactSignatures: [negativeSignature] });
        db12.diagnosticCurrentExactTurnAtoms.push({ stateKey: "1:1:initial", atom: { value: 3, negated: true, structuralSignature: negativeSignature }, sourceRuleKeys: ["current-aligned"] });
        db13.exactTurnRuleAssessments.push({ ...db13.exactTurnRuleAssessments[0], databaseNegated: true });
        const dataset = (0, team_analysis_db14_builder_1.buildDatabaseTeamAnalysisDb14Dataset)({ db11, db11Sha256: "db11", db12, db12Sha256: "db12", db13, db13Sha256: "db13", currentSha256: "current", siteAudit: { formProjectionAliases: [] } });
        (0, assert_1.equal)(dataset.exactTurnCompatibilityAliases.length, 2);
        (0, assert_1.equal)(dataset.exactTurnCompatibilityAliases[1].compatibilityNegated, true);
        (0, assert_1.equal)(dataset.exactTurnCompatibilityAliases[1].nativeBounds.negated, true);
        const coverage = (0, team_analysis_db14_builder_1.buildDatabaseTeamAnalysisDb14Coverage)(dataset, db13);
        (0, assert_1.equal)((0, team_analysis_db14_report_1.renderDatabaseTeamAnalysisDb14Report)(dataset, coverage).includes("native NOT (gte 3 AND lte 3)"), true);
    });
});
//# sourceMappingURL=team-analysis-db14-builder.spec.js.map