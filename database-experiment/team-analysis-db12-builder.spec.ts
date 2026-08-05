import { deepEqual, equal, throws } from "assert";
import { describe, it } from "mocha";
import { buildDatabaseTeamAnalysisDb12Coverage, buildDatabaseTeamAnalysisDb12Dataset } from "./team-analysis-db12-builder";

const turn = (type: 51 | 55, value: number) => ({ op: "predicate", predicate: {
    kind: "turn_from_entry", scope: "self", comparator: type === 51 ? "lte" : "gte", value,
    nativeComparator: type === 51 ? "lte" : "gt", nativeThreshold: type === 51 ? value : value - 1, appearanceGate: "appearance_initialized",
    sourceCausalityId: `${type}-${value}`, sourceCausalityType: type, evidence: "first-party-native-runtime",
} });
const dodge = () => ({ op: "predicate", predicate: { kind: "attacks_evaded", scope: "self", eventMode: "current_event", sourceCausalityId: "43", sourceCausalityType: 43, evidence: "first-party-native-runtime" } });
const currentTurn = (comparator: "lte" | "gte" | "eq", value: number) => ({ op: "predicate", predicate: { kind: "turn_from_entry", scope: "self", comparator, value } });
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
    const db11 = { contractVersion: "0.10.0", generatedAt: "x", sourceSnapshotVersion: "snapshot", sourceSha256: "database", states } as any;
    const current = { parserVersion: "parser", states: currentStates } as any;
    const db11Parity = { schemaVersion: 1, matchedStateCount: 8, promotedStructuralSignatures: { database: 8, current: 6, matched: 1 } } as any;
    return { db11, current, db11Parity };
}
function single(db: unknown, currentCondition: unknown[], databaseCount: number, currentCount: number) {
    const db11 = { contractVersion: "0.10.0", generatedAt: "x", sourceSnapshotVersion: "snapshot", sourceSha256: "database", states: [{ stateKey: "1:1:initial", characterId: "1", formId: "1", releaseState: "initial", passive: { status: "partial", rules: [{ ruleKey: "db-rule", condition: db }] } }] } as any;
    const current = { parserVersion: "parser", states: [{ stateKey: "1:1:initial", passive: { rules: currentCondition.map((condition, index) => ({ id: `current-${index}`, condition })) } }] } as any;
    const db11Parity = { schemaVersion: 1, matchedStateCount: 1, promotedStructuralSignatures: { database: databaseCount, current: currentCount, matched: 0 } } as any;
    return buildDatabaseTeamAnalysisDb12Dataset({ db11, db11Sha256: "db11", db11Parity, db11ParitySha256: "parity", current, currentSha256: "current", siteAudit: { formProjectionAliases: [] } as any });
}

describe("database Team Analysis DB12 divergence attribution", function () {
    it("attributes structural, polarity, threshold, comparator and absence gaps conservatively", () => {
        const { db11, current, db11Parity } = fixture();
        const dataset = buildDatabaseTeamAnalysisDb12Dataset({ db11, db11Sha256: "db11", db11Parity, db11ParitySha256: "parity", current, currentSha256: "current", siteAudit: { formProjectionAliases: [] } as any });
        equal(dataset.databaseOnlyAttributions.length, 7); equal(dataset.currentOnlyAttributions.length, 5); equal(dataset.exactTurnEncodingCandidates.length, 1);
        const coverage = buildDatabaseTeamAnalysisDb12Coverage(dataset, db11Parity);
        equal(coverage.exactStructuralMatchCount, 1); equal(coverage.databaseOnlyCountsByReason.exact_turn_encoding_candidate, 2);
        equal(coverage.databaseOnlyCountsByReason.logical_context_mismatch, 1); equal(coverage.currentOnlyCountsByReason.logical_context_mismatch, 1);
        equal(coverage.databaseOnlyCountsByReason.polarity_mismatch, 1); equal(coverage.databaseOnlyCountsByReason.threshold_mismatch, 1);
        equal(coverage.databaseOnlyCountsByReason.comparator_mismatch, 1); equal(coverage.databaseOnlyCountsByReason.absent_in_current, 1); equal(coverage.currentOnlyCountsByReason.absent_in_database, 1);
        deepEqual(buildDatabaseTeamAnalysisDb12Dataset({ db11, db11Sha256: "db11", db11Parity, db11ParitySha256: "parity", current, currentSha256: "current", siteAudit: { formProjectionAliases: [] } as any }), dataset);
    });
    it("reports state presence gaps after projection aliases", () => {
        const { db11, current, db11Parity } = fixture(); db11.states.push({ stateKey: "9:90:initial", characterId: "9", formId: "90", releaseState: "initial" }); current.states.push({ stateKey: "10:10:initial" });
        const dataset = buildDatabaseTeamAnalysisDb12Dataset({ db11, db11Sha256: "db11", db11Parity, db11ParitySha256: "parity", current, currentSha256: "current", siteAudit: { formProjectionAliases: [{ databaseCardId: "90", projectedCardId: "9" }] } as any });
        deepEqual(dataset.databaseOnlyStateKeys, ["9:9:initial"]); deepEqual(dataset.currentOnlyStateKeys, ["10:10:initial"]);
    });
    it("rejects a source contract other than DB11", () => {
        const { db11, current, db11Parity } = fixture(); db11.contractVersion = "0.9.0";
        throws(() => buildDatabaseTeamAnalysisDb12Dataset({ db11, db11Sha256: "db11", db11Parity, db11ParitySha256: "parity", current, currentSha256: "current", siteAudit: { formProjectionAliases: [] } as any }), /source contract mismatch/);
    });
    it("keeps an isolated current eq atom diagnostic-only", () => {
        const dataset = single(turn(55, 3), [currentTurn("eq", 3)], 1, 0);
        equal(dataset.databaseOnlyAttributions[0].reason, "absent_in_current"); equal(dataset.diagnosticCurrentExactTurnAtoms.length, 1); equal(dataset.exactTurnEncodingCandidates.length, 0);
    });
    it("prefers a same-comparator threshold candidate over a comparator candidate", () => {
        const dataset = single(turn(55, 5), [currentTurn("gte", 6), currentTurn("lte", 5)], 1, 2);
        equal(dataset.databaseOnlyAttributions[0].reason, "threshold_mismatch");
    });
});
