"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const team_analysis_db12_builder_1 = require("./team-analysis-db12-builder");
const turn = (type, value) => ({ op: "predicate", predicate: {
        kind: "turn_from_entry", scope: "self", comparator: type === 51 ? "lte" : "gte", value,
        nativeComparator: type === 51 ? "lte" : "gt", nativeThreshold: type === 51 ? value : value - 1, appearanceGate: "appearance_initialized",
        sourceCausalityId: `${type}-${value}`, sourceCausalityType: type, evidence: "first-party-native-runtime",
    } });
const dodge = () => ({ op: "predicate", predicate: { kind: "attacks_evaded", scope: "self", eventMode: "current_event", sourceCausalityId: "43", sourceCausalityType: 43, evidence: "first-party-native-runtime" } });
const currentTurn = (comparator, value) => ({ op: "predicate", predicate: { kind: "turn_from_entry", scope: "self", comparator, value } });
const currentDodge = () => ({ op: "predicate", predicate: { kind: "attacks_evaded", scope: "self", combatEvent: { mode: "current_event" } } });
function fixture() {
    const pairs = [
        { key: "1:1:initial", db: { op: "all", children: [turn(55, 3), turn(51, 3)] }, current: currentTurn("eq", 3) },
        { key: "2:2:initial", db: turn(55, 5), current: { op: "all", children: [currentTurn("gte", 5)] } },
        { key: "3:3:initial", db: { op: "not", child: dodge() }, current: currentDodge() },
        { key: "4:4:initial", db: turn(51, 7), current: currentTurn("lte", 8) },
        { key: "5:5:initial", db: turn(55, 9), current: currentTurn("lte", 9) },
        { key: "6:6:initial", db: dodge(), current: undefined },
        { key: "7:7:initial", db: undefined, current: currentTurn("gte", 11) },
        { key: "8:8:initial", db: turn(51, 4), current: currentTurn("lte", 4) },
    ];
    const states = pairs.map(({ key, db }) => { const id = key.split(":")[0]; return { stateKey: key, characterId: id, formId: id, releaseState: "initial", passive: db ? { status: "partial", rules: [{ ruleKey: `db-${id}`, condition: db }] } : undefined }; });
    const currentStates = pairs.map(({ key, current }) => ({ stateKey: key, passive: current ? { rules: [{ id: `current-${key}`, condition: current }] } : undefined }));
    const db11 = { contractVersion: "0.10.0", generatedAt: "x", sourceSnapshotVersion: "snapshot", sourceSha256: "database", states };
    const current = { parserVersion: "parser", states: currentStates };
    const db11Parity = { schemaVersion: 1, matchedStateCount: 8, promotedStructuralSignatures: { database: 8, current: 6, matched: 1 } };
    return { db11, current, db11Parity };
}
function single(db, currentCondition, databaseCount, currentCount) {
    const db11 = { contractVersion: "0.10.0", generatedAt: "x", sourceSnapshotVersion: "snapshot", sourceSha256: "database", states: [{ stateKey: "1:1:initial", characterId: "1", formId: "1", releaseState: "initial", passive: { status: "partial", rules: [{ ruleKey: "db-rule", condition: db }] } }] };
    const current = { parserVersion: "parser", states: [{ stateKey: "1:1:initial", passive: { rules: currentCondition.map((condition, index) => ({ id: `current-${index}`, condition })) } }] };
    const db11Parity = { schemaVersion: 1, matchedStateCount: 1, promotedStructuralSignatures: { database: databaseCount, current: currentCount, matched: 0 } };
    return (0, team_analysis_db12_builder_1.buildDatabaseTeamAnalysisDb12Dataset)({ db11, db11Sha256: "db11", db11Parity, db11ParitySha256: "parity", current, currentSha256: "current", siteAudit: { formProjectionAliases: [] } });
}
(0, mocha_1.describe)("database Team Analysis DB12 divergence attribution", function () {
    (0, mocha_1.it)("attributes structural, polarity, threshold, comparator and absence gaps conservatively", () => {
        const { db11, current, db11Parity } = fixture();
        const dataset = (0, team_analysis_db12_builder_1.buildDatabaseTeamAnalysisDb12Dataset)({ db11, db11Sha256: "db11", db11Parity, db11ParitySha256: "parity", current, currentSha256: "current", siteAudit: { formProjectionAliases: [] } });
        (0, assert_1.equal)(dataset.databaseOnlyAttributions.length, 7);
        (0, assert_1.equal)(dataset.currentOnlyAttributions.length, 5);
        (0, assert_1.equal)(dataset.exactTurnEncodingCandidates.length, 1);
        const coverage = (0, team_analysis_db12_builder_1.buildDatabaseTeamAnalysisDb12Coverage)(dataset, db11Parity);
        (0, assert_1.equal)(coverage.exactStructuralMatchCount, 1);
        (0, assert_1.equal)(coverage.databaseOnlyCountsByReason.exact_turn_encoding_candidate, 2);
        (0, assert_1.equal)(coverage.databaseOnlyCountsByReason.logical_context_mismatch, 1);
        (0, assert_1.equal)(coverage.currentOnlyCountsByReason.logical_context_mismatch, 1);
        (0, assert_1.equal)(coverage.databaseOnlyCountsByReason.polarity_mismatch, 1);
        (0, assert_1.equal)(coverage.databaseOnlyCountsByReason.threshold_mismatch, 1);
        (0, assert_1.equal)(coverage.databaseOnlyCountsByReason.comparator_mismatch, 1);
        (0, assert_1.equal)(coverage.databaseOnlyCountsByReason.absent_in_current, 1);
        (0, assert_1.equal)(coverage.currentOnlyCountsByReason.absent_in_database, 1);
        (0, assert_1.deepEqual)((0, team_analysis_db12_builder_1.buildDatabaseTeamAnalysisDb12Dataset)({ db11, db11Sha256: "db11", db11Parity, db11ParitySha256: "parity", current, currentSha256: "current", siteAudit: { formProjectionAliases: [] } }), dataset);
    });
    (0, mocha_1.it)("reports state presence gaps after projection aliases", () => {
        const { db11, current, db11Parity } = fixture();
        db11.states.push({ stateKey: "9:90:initial", characterId: "9", formId: "90", releaseState: "initial" });
        current.states.push({ stateKey: "10:10:initial" });
        const dataset = (0, team_analysis_db12_builder_1.buildDatabaseTeamAnalysisDb12Dataset)({ db11, db11Sha256: "db11", db11Parity, db11ParitySha256: "parity", current, currentSha256: "current", siteAudit: { formProjectionAliases: [{ databaseCardId: "90", projectedCardId: "9" }] } });
        (0, assert_1.deepEqual)(dataset.databaseOnlyStateKeys, ["9:9:initial"]);
        (0, assert_1.deepEqual)(dataset.currentOnlyStateKeys, ["10:10:initial"]);
    });
    (0, mocha_1.it)("rejects a source contract other than DB11", () => {
        const { db11, current, db11Parity } = fixture();
        db11.contractVersion = "0.9.0";
        (0, assert_1.throws)(() => (0, team_analysis_db12_builder_1.buildDatabaseTeamAnalysisDb12Dataset)({ db11, db11Sha256: "db11", db11Parity, db11ParitySha256: "parity", current, currentSha256: "current", siteAudit: { formProjectionAliases: [] } }), /source contract mismatch/);
    });
    (0, mocha_1.it)("keeps an isolated current eq atom diagnostic-only", () => {
        const dataset = single(turn(55, 3), [currentTurn("eq", 3)], 1, 0);
        (0, assert_1.equal)(dataset.databaseOnlyAttributions[0].reason, "absent_in_current");
        (0, assert_1.equal)(dataset.diagnosticCurrentExactTurnAtoms.length, 1);
        (0, assert_1.equal)(dataset.exactTurnEncodingCandidates.length, 0);
    });
    (0, mocha_1.it)("prefers a same-comparator threshold candidate over a comparator candidate", () => {
        const dataset = single(turn(55, 5), [currentTurn("gte", 6), currentTurn("lte", 5)], 1, 2);
        (0, assert_1.equal)(dataset.databaseOnlyAttributions[0].reason, "threshold_mismatch");
    });
});
//# sourceMappingURL=team-analysis-db12-builder.spec.js.map