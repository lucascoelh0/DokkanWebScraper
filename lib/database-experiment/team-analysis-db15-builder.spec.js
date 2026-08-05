"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const team_analysis_db15_builder_1 = require("./team-analysis-db15-builder");
function fixture() {
    const runtime = (type, value, id) => ({ causalityId: id, causalityType: type, predicate: { kind: "turn_from_entry", scope: "self", comparator: type === 51 ? "lte" : "gte", value, sourceCausalityId: id, sourceCausalityType: type }, raw: {}, provenance: {} });
    const lower = runtime(55, 3, "lower");
    const upper = runtime(51, 3, "upper");
    const group = (values) => ({ op: "all", children: values.map(value => ({ op: "predicate", predicate: value.predicate })) });
    const condition = { op: "any", children: [group([lower, upper])] };
    const eqSignature = JSON.stringify({ comparator: "eq", kind: "turn_from_entry", logicalContext: "any", negated: false, scope: "self", value: 3 });
    const db11 = { contractVersion: "0.10.0", sourceSnapshotVersion: "snapshot", sourceSha256: "database", states: [{ characterId: "1", formId: "1", releaseState: "initial", passive: { rules: [{ ruleKey: "db", condition }] } }] };
    const db13 = { contractVersion: "0.12.1", generatedAt: "x", sourceDb11: { sha256: "db11" }, sourceCurrentTeamAnalysis: { sha256: "current", parserVersion: "parser" }, sourceDatabaseSha256: "database", semanticPromotionCount: 0, ruleAlignments: [{ stateKey: "1:1:initial", databaseRuleKey: "db", currentRuleKey: "current", kind: "exact_effect_set_unique" }] };
    const db14 = { contractVersion: "0.13.0", generatedAt: "x", sourceDb11: { sha256: "db11" }, sourceDb13: { sha256: "db13" }, sourceCurrentTeamAnalysis: { sha256: "current", parserVersion: "parser" }, sourceDatabaseSha256: "database", semanticPromotionCount: 0, exactTurnCompatibilityAliases: [{ stateKey: "1:1:initial", databaseRuleKey: "db", currentRuleKey: "current", value: 3, compatibilityNegated: false, compatibilitySignature: eqSignature, nativeBounds: { conjunctionGroup: "db:root.0", negated: false, lower, upper } }] };
    const current = { parserVersion: "parser", states: [{ stateKey: "1:1:initial", passive: { rules: [{ id: "current", condition: { op: "any", children: [{ op: "predicate", predicate: { kind: "turn_from_entry", scope: "self", comparator: "eq", value: 3 } }] } }] } }] };
    return { db11, db13, db14, current, runtime, group };
}
(0, mocha_1.describe)("database Team Analysis DB15 rule-condition parity", function () {
    (0, mocha_1.it)("measures baseline divergence and exact parity after a proven alias", () => {
        const { db11, db13, db14, current } = fixture();
        const dataset = (0, team_analysis_db15_builder_1.buildDatabaseTeamAnalysisDb15Dataset)({ db11, db11Sha256: "db11", db13, db13Sha256: "db13", db14, db14Sha256: "db14", current, currentSha256: "current", siteAudit: { formProjectionAliases: [] } });
        (0, assert_1.equal)(dataset.ruleConditionParity.length, 1);
        const record = dataset.ruleConditionParity[0];
        (0, assert_1.equal)(record.baseline.status, "divergent");
        (0, assert_1.equal)(record.baseline.databaseOnlySignatures.length, 2);
        (0, assert_1.equal)(record.baseline.currentOnlySignatures.length, 1);
        (0, assert_1.equal)(record.withCompatibilityAliases.status, "exact");
        (0, assert_1.deepEqual)(record.withCompatibilityAliases.databaseSignatures, record.withCompatibilityAliases.currentSignatures);
        const coverage = (0, team_analysis_db15_builder_1.buildDatabaseTeamAnalysisDb15Coverage)(dataset);
        (0, assert_1.equal)(coverage.exactPairDelta, 1);
        (0, assert_1.equal)(coverage.resolvedNativeSignatureOccurrenceCount, 2);
    });
    (0, mocha_1.it)("rejects a DB14 artifact from another DB13 hash", () => {
        const { db11, db13, db14, current } = fixture();
        db14.sourceDb13.sha256 = "other";
        (0, assert_1.throws)(() => (0, team_analysis_db15_builder_1.buildDatabaseTeamAnalysisDb15Dataset)({ db11, db11Sha256: "db11", db13, db13Sha256: "db13", db14, db14Sha256: "db14", current, currentSha256: "current", siteAudit: { formProjectionAliases: [] } }), /source lineage mismatch/);
    });
    (0, mocha_1.it)("removes only the identified native occurrences when signatures repeat", () => {
        const { db11, db13, db14, current, runtime, group } = fixture();
        const lower2 = runtime(55, 3, "lower-2");
        const upper2 = runtime(51, 3, "upper-2");
        db11.states[0].passive.rules[0].condition.children.push(group([lower2, upper2]));
        const dataset = (0, team_analysis_db15_builder_1.buildDatabaseTeamAnalysisDb15Dataset)({ db11, db11Sha256: "db11", db13, db13Sha256: "db13", db14, db14Sha256: "db14", current, currentSha256: "current", siteAudit: { formProjectionAliases: [] } });
        const record = dataset.ruleConditionParity[0];
        (0, assert_1.equal)(record.baseline.databaseOnlySignatures.length, 4);
        (0, assert_1.equal)(record.withCompatibilityAliases.status, "partial");
        (0, assert_1.equal)(record.withCompatibilityAliases.databaseOnlySignatures.length, 2);
        (0, assert_1.equal)(record.withCompatibilityAliases.matchedSignatures.length, 1);
    });
});
//# sourceMappingURL=team-analysis-db15-builder.spec.js.map