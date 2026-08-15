"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const os_1 = require("os");
const path_1 = require("path");
const leader_scope_contract_1 = require("./leader-scope-contract");
const leader_scope_source_1 = require("./leader-scope-source");
const leader_scope_1 = require("./leader-scope");
const leader_scope_run_1 = require("./leader-scope-run");
const ref = (rowId) => ({ table: "leader_skills", rowId });
function k43State(stateId = "card-state:1:initial") {
    return { stateId, sourceStateKey: `source:${stateId}`, cardId: "1", releaseState: "initial" };
}
function k3State(stateId = "card-state:1:initial", releaseState = "initial") {
    return {
        stateId,
        sourceStateKey: `source:${stateId}`,
        cardId: stateId.startsWith("card-state:1010900:") ? "1010900" : "1",
        releaseState,
        leader: { set: ref(`set:${stateId}`), effects: [], targets: [], structuredPercentValues: [] },
    };
}
function joinedSources() {
    return {
        k43: [k43State()],
        k3: [
            k3State(),
            ...leader_scope_contract_1.CHARACTER_LEADER_SCOPE_EXCLUDED_STATE_IDS.map(stateId => k3State(stateId, "unknown")),
        ],
    };
}
function pinnedEvaluation() {
    return {
        includedStates: leader_scope_contract_1.CHARACTER_LEADER_SCOPE_PIN.includedStates,
        excludedStates: leader_scope_contract_1.CHARACTER_LEADER_SCOPE_PIN.excludedStates,
        excludedStateIds: [...leader_scope_contract_1.CHARACTER_LEADER_SCOPE_EXCLUDED_STATE_IDS],
        uniqueLeaderSetRows: leader_scope_contract_1.CHARACTER_LEADER_SCOPE_PIN.uniqueLeaderSetRows,
        effectReferences: leader_scope_contract_1.CHARACTER_LEADER_SCOPE_PIN.effectReferences,
        targetReferences: leader_scope_contract_1.CHARACTER_LEADER_SCOPE_PIN.targetReferences,
        structuredPercentValues: leader_scope_contract_1.CHARACTER_LEADER_SCOPE_PIN.structuredPercentValues,
        multiEffectStates: leader_scope_contract_1.CHARACTER_LEADER_SCOPE_PIN.multiEffectStates,
        multiTargetStates: leader_scope_contract_1.CHARACTER_LEADER_SCOPE_PIN.multiTargetStates,
        multiPercentStates: leader_scope_contract_1.CHARACTER_LEADER_SCOPE_PIN.multiPercentStates,
        maximumEffectsPerState: leader_scope_contract_1.CHARACTER_LEADER_SCOPE_PIN.maximumEffectsPerState,
        maximumTargetsPerState: leader_scope_contract_1.CHARACTER_LEADER_SCOPE_PIN.maximumTargetsPerState,
        maximumPercentValuesPerState: leader_scope_contract_1.CHARACTER_LEADER_SCOPE_PIN.maximumPercentValuesPerState,
        emptyEffectStates: leader_scope_contract_1.CHARACTER_LEADER_SCOPE_PIN.emptyEffectStates,
        emptyTargetStates: leader_scope_contract_1.CHARACTER_LEADER_SCOPE_PIN.emptyTargetStates,
        emptyPercentStates: leader_scope_contract_1.CHARACTER_LEADER_SCOPE_PIN.emptyPercentStates,
        samples: {
            multiEffectStateIds: ["card-state:1:initial"], multiTargetStateIds: [], multiPercentStateIds: [],
            maximumEffectStateIds: [], maximumTargetStateIds: [], maximumPercentStateIds: [], limitPerKind: 5,
        },
    };
}
function k43Identity() {
    return {
        manifestSha256: "1".repeat(64), payloadSha256: "2".repeat(64), rawSha256: "3".repeat(64),
        k42SourceFingerprintSha256: "4".repeat(64), stateFingerprintSha256: "5".repeat(64),
    };
}
function k3Identity() {
    return {
        profileId: "character-refresh-pinned-v1", snapshotVersion: "snapshot-v1",
        manifest: { sha256: "6".repeat(64), sizeBytes: 1 },
        artifact: { sha256: "7".repeat(64), sizeBytes: 2, uncompressedSizeBytes: 3, uncompressedSha256: "8".repeat(64) },
        coverage: { sha256: "9".repeat(64), sizeBytes: 4 }, validation: { sha256: "a".repeat(64), sizeBytes: 5 },
        compactFingerprintSha256: "b".repeat(64),
    };
}
describe("database character K45 leader structural scope", () => {
    it("fails closed unless the exact opt-in and all explicit roots are supplied", async () => {
        await (0, assert_1.rejects)((0, leader_scope_run_1.runCharacterLeaderScopeAudit)({}), /explicit opt-in/);
        (0, assert_1.throws)(() => (0, leader_scope_run_1.parseCharacterLeaderScopeCli)([]), /exactly one --opt-in-k45/);
        (0, assert_1.throws)(() => (0, leader_scope_run_1.parseCharacterLeaderScopeCli)(["--opt-in-k45"]), /--sidecar-root/);
        (0, assert_1.throws)(() => (0, leader_scope_run_1.parseCharacterLeaderScopeCli)([
            "--opt-in-k45", "--sidecar-root", "s", "--production-root", "p", "--fyi-root", "f", "--k43-root", "k", "--output-root", "o",
        ]), /unsupported argument/);
        (0, assert_1.throws)(() => (0, leader_scope_run_1.parseCharacterLeaderScopeCli)([
            "--opt-in-k45", "--sidecar-root", "s", "--sidecar-root", "s", "--production-root", "p", "--fyi-root", "f", "--k43-root", "k",
        ]), /duplicate --sidecar-root/);
        (0, assert_1.deepStrictEqual)((0, leader_scope_run_1.parseCharacterLeaderScopeCli)([
            "--opt-in-k45", "--sidecar-root", "s", "--production-root", "p", "--fyi-root", "f", "--k43-root", "k",
        ]), { optIn: true, sidecarRoot: "s", productionRoot: "p", fyiRoot: "f", k43Root: "k" });
        const savedGc = global.gc;
        try {
            global.gc = undefined;
            await (0, assert_1.rejects)((0, leader_scope_run_1.runCharacterLeaderScopeAudit)({ optIn: true, sidecarRoot: "s", productionRoot: "p", fyiRoot: "f", k43Root: "k" }), /--expose-gc/);
        }
        finally {
            global.gc = savedGc;
        }
    });
    it("joins structural identities exactly and excludes only the three pinned unknown K3 states", () => {
        const source = joinedSources();
        source.k3[0].leader.effects = [ref("effect:1"), ref("effect:2")];
        source.k3[0].leader.targets = [ref("target:1"), ref("target:2")];
        source.k3[0].leader.structuredPercentValues = [100, 170];
        const scope = (0, leader_scope_1.evaluateCharacterLeaderStructuralScope)(source.k43, source.k3);
        (0, assert_1.deepStrictEqual)(scope.excludedStateIds, [...leader_scope_contract_1.CHARACTER_LEADER_SCOPE_EXCLUDED_STATE_IDS]);
        (0, assert_1.equal)(scope.includedStates, 1);
        (0, assert_1.equal)(scope.excludedStates, 3);
        (0, assert_1.equal)(scope.uniqueLeaderSetRows, 1);
        (0, assert_1.equal)(scope.effectReferences, 2);
        (0, assert_1.equal)(scope.targetReferences, 2);
        (0, assert_1.equal)(scope.structuredPercentValues, 2);
        (0, assert_1.equal)(scope.multiEffectStates, 1);
        (0, assert_1.equal)(scope.multiTargetStates, 1);
        (0, assert_1.equal)(scope.multiPercentStates, 1);
        (0, assert_1.equal)(scope.maximumEffectsPerState, 2);
        (0, assert_1.equal)(scope.maximumTargetsPerState, 2);
        (0, assert_1.equal)(scope.maximumPercentValuesPerState, 2);
    });
    it("refuses join drift, unexpected extras, and presentation-bearing compact inputs", () => {
        let source = joinedSources();
        source.k3[0].sourceStateKey = "changed";
        (0, assert_1.throws)(() => (0, leader_scope_1.evaluateCharacterLeaderStructuralScope)(source.k43, source.k3), /exact state join mismatch/);
        source = joinedSources();
        source.k3.push(k3State("card-state:2:initial"));
        (0, assert_1.throws)(() => (0, leader_scope_1.evaluateCharacterLeaderStructuralScope)(source.k43, source.k3), /exclusion frontier changed/);
        source = joinedSources();
        source.k3[0].name = "presentation";
        (0, assert_1.throws)(() => (0, leader_scope_1.evaluateCharacterLeaderStructuralScope)(source.k43, source.k3), /presentation-bearing/);
    });
    it("pins every production aggregate and the exact exclusions", () => {
        const evaluation = pinnedEvaluation();
        (0, leader_scope_1.assertPinnedCharacterLeaderScope)(evaluation);
        (0, assert_1.throws)(() => (0, leader_scope_1.assertPinnedCharacterLeaderScope)({ ...evaluation, effectReferences: evaluation.effectReferences + 1 }), /effect references pin changed/);
        (0, assert_1.throws)(() => (0, leader_scope_1.assertPinnedCharacterLeaderScope)({ ...evaluation, excludedStateIds: ["unexpected"] }), /excluded state IDs changed/);
        const tooManySamples = { ...evaluation, samples: { ...evaluation.samples, multiEffectStateIds: ["1", "2", "3", "4", "5", "6"] } };
        (0, assert_1.throws)(() => (0, leader_scope_1.assertPinnedCharacterLeaderScope)(tooManySamples), /sample bound exceeded/);
    });
    it("builds a deterministic timestamp-free bounded report with passive K9 boundary only", () => {
        const first = (0, leader_scope_1.buildCharacterLeaderScopeReport)(k43Identity(), k3Identity(), pinnedEvaluation());
        const second = (0, leader_scope_1.buildCharacterLeaderScopeReport)(k43Identity(), k3Identity(), pinnedEvaluation());
        const encoded = `${JSON.stringify(first, null, 2)}\n`;
        (0, assert_1.deepStrictEqual)(first, second);
        (0, assert_1.ok)(Buffer.byteLength(encoded) < leader_scope_contract_1.CHARACTER_LEADER_SCOPE_REPORT_LIMIT_BYTES);
        (0, assert_1.ok)(!encoded.includes("generatedAt"));
        (0, assert_1.ok)(!encoded.includes('"rawRows":'));
        (0, assert_1.ok)(!encoded.includes('"presentation":'));
        (0, assert_1.equal)(first.passiveComparisonBoundary.c3UnknownRuleCount, 59);
        (0, assert_1.equal)(first.passiveComparisonBoundary.usedToFilterLeaderScope, false);
        (0, assert_1.equal)(first.passiveComparisonBoundary.k9ReadinessChanged, false);
        (0, assert_1.equal)(first.inputIntegrity.k43SourceBoundBefore, "NOT_EXECUTED");
        (0, assert_1.equal)(first.inputIntegrity.k3ExactPinnedFilesBeforeAndAfter, false);
        (0, assert_1.equal)(first.readiness.structuralScope, "NOT_EXECUTED");
        (0, assert_1.equal)(first.readiness.nextStructuralIdOnlyProjection, "NOT_EXECUTED");
        (0, assert_1.equal)(first.readiness.leaderClauseOrVsSumSemantics, "NO-GO");
        (0, assert_1.equal)(first.readiness.consumer, "NO-GO");
    });
    it("compacts raw K3 state records to cloned structural leader references without a GO bypass", () => {
        const raw = {
            stateId: "card-state:1:initial", sourceStateKey: "source:card-state:1:initial", cardId: "1", releaseState: "initial",
            leaderSkill: { set: ref("set:1"), effects: [ref("effect:1")], targetRows: [ref("target:1")], structuredPercentValues: [170] },
            passiveSkill: { localizedText: "must not survive" }, presentation: "must not survive",
        };
        const compact = (0, leader_scope_source_1.compactK3LeaderStatesForAudit)([raw]);
        (0, assert_1.deepStrictEqual)(compact, [{
                stateId: raw.stateId, sourceStateKey: raw.sourceStateKey, cardId: "1", releaseState: "initial",
                leader: { set: ref("set:1"), effects: [ref("effect:1")], targets: [ref("target:1")], structuredPercentValues: [170] },
            }]);
        raw.leaderSkill.effects[0].rowId = "mutated";
        raw.leaderSkill.structuredPercentValues[0] = 0;
        (0, assert_1.equal)(compact[0].leader.effects[0].rowId, "effect:1");
        (0, assert_1.equal)(compact[0].leader.structuredPercentValues[0], 170);
        const encoded = JSON.stringify(compact);
        (0, assert_1.ok)(!encoded.includes("localizedText"));
        (0, assert_1.ok)(!encoded.includes("presentation"));
        (0, assert_1.ok)(!encoded.includes("rawRows"));
        (0, assert_1.ok)(!encoded.includes("GO"));
        (0, assert_1.throws)(() => (0, leader_scope_source_1.compactK3LeaderStatesForAudit)([{ ...raw, leaderSkill: undefined }]), /malformed K3 leader state/);
        (0, assert_1.throws)(() => (0, leader_scope_source_1.compactK3LeaderStatesForAudit)([raw, raw]), /duplicate K3 stateId/);
    });
    it("detects K3 and K43 identity or compact-fingerprint drift", () => {
        (0, leader_scope_source_1.assertK3LeaderScopeSourceStable)(k3Identity(), k3Identity());
        (0, leader_scope_source_1.assertK43LeaderScopeSourceStable)(k43Identity(), k43Identity());
        (0, assert_1.throws)(() => (0, leader_scope_source_1.assertK3LeaderScopeSourceStable)(k3Identity(), { ...k3Identity(), compactFingerprintSha256: "c".repeat(64) }), /changed after audit/);
        (0, assert_1.throws)(() => (0, leader_scope_source_1.assertK43LeaderScopeSourceStable)(k43Identity(), { ...k43Identity(), stateFingerprintSha256: "d".repeat(64) }), /changed after audit/);
    });
    it("bounds pinned member reads and rejects hard links or identity replacement", async () => {
        const root = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "k45-pinned-member-"));
        const member = (0, path_1.join)(root, "member.json");
        const hardlink = (0, path_1.join)(root, "hardlink.json");
        const bytes = Buffer.from("pinned-member");
        const expected = { sizeBytes: bytes.length, sha256: (0, crypto_1.createHash)("sha256").update(bytes).digest("hex") };
        try {
            await (0, promises_1.writeFile)(member, Buffer.concat([bytes, Buffer.from("oversized")]));
            await (0, assert_1.rejects)((0, leader_scope_source_1.readPinnedLeaderScopeMember)(member, expected, "fixture"), /member identity rejected/);
            await (0, promises_1.writeFile)(member, bytes);
            (0, assert_1.deepStrictEqual)(await (0, leader_scope_source_1.readPinnedLeaderScopeMember)(member, expected, "fixture"), bytes);
            await (0, promises_1.link)(member, hardlink);
            await (0, assert_1.rejects)((0, leader_scope_source_1.readPinnedLeaderScopeMember)(member, expected, "fixture"), /member identity rejected/);
            const stat = (dev, ino) => ({ dev, ino, size: bytes.length, nlink: 1, isFile: () => true, isSymbolicLink: () => false });
            (0, assert_1.throws)(() => (0, leader_scope_source_1.assertPinnedLeaderScopeMemberIdentity)(stat(1, 1), stat(1, 1), stat(1, 2), bytes.length, "fixture"), /member identity rejected/);
        }
        finally {
            await (0, promises_1.rm)(root, { recursive: true, force: true });
        }
    });
});
//# sourceMappingURL=leader-scope.spec.js.map