"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = require("path");
const assert_1 = require("assert");
const promises_1 = require("fs/promises");
const os_1 = require("os");
const leader_projection_contract_1 = require("./leader-projection-contract");
const leader_projection_1 = require("./leader-projection");
const leader_projection_run_1 = require("./leader-projection-run");
const leader_scope_contract_1 = require("./leader-scope-contract");
const leader_scope_1 = require("./leader-scope");
const ref = (table, rowId) => ({ table, rowId });
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
function smallSources() {
    const stateId = "card-state:1:initial";
    return {
        k43: { identity: k43Identity(), states: [{ stateId, sourceStateKey: "source:1", cardId: "1", releaseState: "initial" }] },
        k3: { identity: k3Identity(), states: [{
                    stateId, sourceStateKey: "source:1", cardId: "1", releaseState: "initial",
                    leader: {
                        set: ref("leader_sets", "2"),
                        effects: [ref("leader_effects", "10"), ref("leader_effects", "2"), ref("leader_effects", "2")],
                        targets: [ref("leader_targets", "10"), ref("leader_targets", "1")], structuredPercentValues: [170, 30],
                    },
                }, ...leader_scope_contract_1.CHARACTER_LEADER_SCOPE_EXCLUDED_STATE_IDS.map((excluded, index) => ({
                    stateId: excluded, sourceStateKey: `unknown:${index}`, cardId: "1010900", releaseState: "unknown",
                    leader: { set: ref("leader_sets", `${index}`), effects: [], targets: [], structuredPercentValues: [] },
                }))] },
    };
}
function pinnedEvaluation() {
    return {
        includedStates: leader_scope_contract_1.CHARACTER_LEADER_SCOPE_PIN.includedStates, excludedStates: leader_scope_contract_1.CHARACTER_LEADER_SCOPE_PIN.excludedStates,
        excludedStateIds: [...leader_scope_contract_1.CHARACTER_LEADER_SCOPE_EXCLUDED_STATE_IDS], uniqueLeaderSetRows: leader_scope_contract_1.CHARACTER_LEADER_SCOPE_PIN.uniqueLeaderSetRows,
        effectReferences: leader_scope_contract_1.CHARACTER_LEADER_SCOPE_PIN.effectReferences, targetReferences: leader_scope_contract_1.CHARACTER_LEADER_SCOPE_PIN.targetReferences,
        structuredPercentValues: leader_scope_contract_1.CHARACTER_LEADER_SCOPE_PIN.structuredPercentValues, multiEffectStates: leader_scope_contract_1.CHARACTER_LEADER_SCOPE_PIN.multiEffectStates,
        multiTargetStates: leader_scope_contract_1.CHARACTER_LEADER_SCOPE_PIN.multiTargetStates, multiPercentStates: leader_scope_contract_1.CHARACTER_LEADER_SCOPE_PIN.multiPercentStates,
        maximumEffectsPerState: leader_scope_contract_1.CHARACTER_LEADER_SCOPE_PIN.maximumEffectsPerState, maximumTargetsPerState: leader_scope_contract_1.CHARACTER_LEADER_SCOPE_PIN.maximumTargetsPerState,
        maximumPercentValuesPerState: leader_scope_contract_1.CHARACTER_LEADER_SCOPE_PIN.maximumPercentValuesPerState, emptyEffectStates: leader_scope_contract_1.CHARACTER_LEADER_SCOPE_PIN.emptyEffectStates,
        emptyTargetStates: leader_scope_contract_1.CHARACTER_LEADER_SCOPE_PIN.emptyTargetStates, emptyPercentStates: leader_scope_contract_1.CHARACTER_LEADER_SCOPE_PIN.emptyPercentStates,
        samples: {
            multiEffectStateIds: [], multiTargetStateIds: [], multiPercentStateIds: [], maximumEffectStateIds: [],
            maximumTargetStateIds: [], maximumPercentStateIds: [], limitPerKind: 5,
        },
    };
}
function distributedCounts(count, minimum, maximum, total) {
    const values = Array(count).fill(minimum);
    let remaining = total - count * minimum;
    for (let index = 0; index < values.length && remaining > 0; index++) {
        const addition = Math.min(maximum - minimum, remaining);
        values[index] += addition;
        remaining -= addition;
    }
    (0, assert_1.equal)(remaining, 0);
    return values;
}
function productionDataset() {
    const effectCounts = [
        ...distributedCounts(leader_scope_contract_1.CHARACTER_LEADER_SCOPE_PIN.multiEffectStates, 2, leader_scope_contract_1.CHARACTER_LEADER_SCOPE_PIN.maximumEffectsPerState, leader_scope_contract_1.CHARACTER_LEADER_SCOPE_PIN.effectReferences - (leader_scope_contract_1.CHARACTER_LEADER_SCOPE_PIN.includedStates - leader_scope_contract_1.CHARACTER_LEADER_SCOPE_PIN.multiEffectStates - leader_scope_contract_1.CHARACTER_LEADER_SCOPE_PIN.emptyEffectStates)),
        ...Array(leader_scope_contract_1.CHARACTER_LEADER_SCOPE_PIN.includedStates - leader_scope_contract_1.CHARACTER_LEADER_SCOPE_PIN.multiEffectStates - leader_scope_contract_1.CHARACTER_LEADER_SCOPE_PIN.emptyEffectStates).fill(1),
        ...Array(leader_scope_contract_1.CHARACTER_LEADER_SCOPE_PIN.emptyEffectStates).fill(0),
    ];
    const targetCounts = [
        ...distributedCounts(leader_scope_contract_1.CHARACTER_LEADER_SCOPE_PIN.multiTargetStates, 2, leader_scope_contract_1.CHARACTER_LEADER_SCOPE_PIN.maximumTargetsPerState, leader_scope_contract_1.CHARACTER_LEADER_SCOPE_PIN.targetReferences - (leader_scope_contract_1.CHARACTER_LEADER_SCOPE_PIN.includedStates - leader_scope_contract_1.CHARACTER_LEADER_SCOPE_PIN.multiTargetStates - leader_scope_contract_1.CHARACTER_LEADER_SCOPE_PIN.emptyTargetStates)),
        ...Array(leader_scope_contract_1.CHARACTER_LEADER_SCOPE_PIN.includedStates - leader_scope_contract_1.CHARACTER_LEADER_SCOPE_PIN.multiTargetStates - leader_scope_contract_1.CHARACTER_LEADER_SCOPE_PIN.emptyTargetStates).fill(1),
        ...Array(leader_scope_contract_1.CHARACTER_LEADER_SCOPE_PIN.emptyTargetStates).fill(0),
    ];
    let remainingTargetRepeats = leader_projection_contract_1.CHARACTER_LEADER_PROJECTION_REPEAT_PIN.targetReferences;
    const states = Array.from({ length: leader_scope_contract_1.CHARACTER_LEADER_SCOPE_PIN.includedStates }, (_, index) => {
        const ordinal = String(index + 1).padStart(5, "0");
        const targetRepeatCount = Math.min(Math.max(0, targetCounts[index] - 1), remainingTargetRepeats);
        remainingTargetRepeats -= targetRepeatCount;
        const uniqueTargetCount = targetCounts[index] - targetRepeatCount;
        return {
            stateId: `card-state:${ordinal}:initial`, sourceStateKey: `source:${ordinal}`, cardId: ordinal, releaseState: "initial",
            leader: {
                set: ref("leader_sets", String(index % leader_scope_contract_1.CHARACTER_LEADER_SCOPE_PIN.uniqueLeaderSetRows).padStart(4, "0")),
                effects: Array.from({ length: effectCounts[index] }, (_, refIndex) => ref("leader_effects", String(refIndex).padStart(2, "0"))),
                targets: Array.from({ length: targetCounts[index] }, (_, refIndex) => ref("leader_targets", String(uniqueTargetCount ? refIndex % uniqueTargetCount : 0).padStart(2, "0"))),
            },
        };
    });
    (0, assert_1.equal)(remainingTargetRepeats, 0);
    return {
        schemaVersion: 1, contract: "dokkan-database-character-leader-structural-projection", contractVersion: "1.0.0",
        mode: "explicit_opt_in_offline_local_structural_ids_only",
        source: {
            k45: { contractVersion: "1.0.0", structuralScope: "GO", nextStructuralIdOnlyProjection: "GO", k43SourceBoundBeforeAndAfter: "GO" },
            k43: k43Identity(), k3: k3Identity(),
        },
        policy: {
            structuralIdsOnly: true, sourceReferenceOrderAndMultiplicityPreserved: true, referencesDeduplicated: false,
            effectTargetAssociationsSelected: false, percentValuesIncluded: false, presentationIncluded: false, semanticsSelected: false,
            rawRowsIncluded: false, characterArrayIncluded: false, consumerImplemented: false, applyOrOverlayImplemented: false,
            authoritySelected: false, productionModified: false, publisherImplemented: false, networkEnabled: false,
            r2Enabled: false, androidImplemented: false,
        },
        states,
    };
}
describe("database character K46 leader structural projection", function () {
    this.timeout(30000);
    let dataset;
    let artifacts;
    before(() => {
        dataset = productionDataset();
        artifacts = (0, leader_projection_1.materializeCharacterLeaderProjection)(dataset, (0, leader_projection_1.buildCharacterLeaderProjectionCoverage)(dataset.states));
    });
    it("accepts only the exact opt-in and five explicit roots", async () => {
        await (0, assert_1.rejects)((0, leader_projection_run_1.runCharacterLeaderProjection)({}), /explicit opt-in/);
        (0, assert_1.throws)(() => (0, leader_projection_run_1.parseCharacterLeaderProjectionCli)([]), /exactly one --opt-in-k46/);
        (0, assert_1.throws)(() => (0, leader_projection_run_1.parseCharacterLeaderProjectionCli)(["--opt-in-k46"]), /--sidecar-root/);
        (0, assert_1.throws)(() => (0, leader_projection_run_1.parseCharacterLeaderProjectionCli)([
            "--opt-in-k46", "--sidecar-root", "s", "--production-root", "p", "--fyi-root", "f", "--k43-root", "k", "--output-root", "o", "--extra", "x",
        ]), /unsupported argument/);
        (0, assert_1.deepStrictEqual)((0, leader_projection_run_1.parseCharacterLeaderProjectionCli)([
            "--opt-in-k46", "--sidecar-root", "s", "--production-root", "p", "--fyi-root", "f", "--k43-root", "k", "--output-root", "o",
        ]), { optIn: true, sidecarRoot: "s", productionRoot: "p", fyiRoot: "f", k43Root: "k", outputRoot: "o" });
        const savedGc = global.gc;
        try {
            global.gc = undefined;
            await (0, assert_1.rejects)((0, leader_projection_run_1.runCharacterLeaderProjection)({ optIn: true, sidecarRoot: "s", productionRoot: "p", fyiRoot: "f", k43Root: "k", outputRoot: "o" }), /--expose-gc/);
        }
        finally {
            global.gc = savedGc;
        }
    });
    it("projects cloned structural refs while preserving source order and multiplicity", () => {
        const source = smallSources(), projected = (0, leader_projection_1.projectCharacterLeaderStructuralRecords)(source.k43, source.k3);
        (0, assert_1.equal)(projected.states.length, 1);
        (0, assert_1.deepStrictEqual)(projected.states[0].leader.effects.map(item => item.rowId), ["10", "2", "2"]);
        (0, assert_1.deepStrictEqual)(projected.states[0].leader.targets.map(item => item.rowId), ["10", "1"]);
        const encoded = JSON.stringify(projected.states);
        (0, assert_1.ok)(!encoded.includes("structuredPercentValues"));
        (0, assert_1.ok)(!encoded.includes("rawRows"));
        (0, assert_1.ok)(!encoded.includes("Character"));
        source.k3.states[0].leader.effects[0].rowId = "mutated";
        (0, assert_1.equal)(projected.states[0].leader.effects[0].rowId, "10");
    });
    it("requires a real K45 GO identity and production pins before build", () => {
        const source = smallSources();
        const raw = (0, leader_scope_1.buildCharacterLeaderScopeReport)(source.k43.identity, source.k3.identity, pinnedEvaluation());
        (0, assert_1.throws)(() => (0, leader_projection_1.buildCharacterLeaderProjection)(source.k43, source.k3, raw), /requires K45 real GO/);
        const go = {
            ...raw,
            inputIntegrity: {
                ...raw.inputIntegrity, k43SourceBoundBefore: "GO", k43SourceBoundAfter: "GO",
                k43IdentityAndFingerprintStable: true, k3ExactPinnedFilesBeforeAndAfter: true,
                k3IdentityAndFingerprintStable: true, k3DecodeBoundedToPinnedRawSize: true,
            },
            readiness: { ...raw.readiness, structuralScope: "GO", nextStructuralIdOnlyProjection: "GO" },
        };
        (0, assert_1.throws)(() => (0, leader_projection_1.buildCharacterLeaderProjection)(source.k43, source.k3, go), /pin changed/);
    });
    it("materializes canonical deterministic content-addressed bytes within fixed budgets", () => {
        const second = (0, leader_projection_1.materializeCharacterLeaderProjection)(dataset, (0, leader_projection_1.buildCharacterLeaderProjectionCoverage)(dataset.states));
        (0, assert_1.ok)(artifacts.raw.equals(second.raw));
        (0, assert_1.ok)(artifacts.gzip.equals(second.gzip));
        (0, assert_1.ok)(artifacts.coverageBytes.equals(second.coverageBytes));
        (0, assert_1.ok)(artifacts.validationBytes.equals(second.validationBytes));
        (0, assert_1.ok)(artifacts.manifestBytes.equals(second.manifestBytes));
        (0, assert_1.ok)(artifacts.manifest.fileName.includes(artifacts.manifest.sha256));
        (0, assert_1.ok)(artifacts.raw.length < leader_projection_contract_1.CHARACTER_LEADER_PROJECTION_RAW_LIMIT_BYTES);
        (0, assert_1.ok)(artifacts.gzip.length < leader_projection_contract_1.CHARACTER_LEADER_PROJECTION_GZIP_LIMIT_BYTES);
        (0, assert_1.ok)(artifacts.coverageBytes.length + artifacts.validationBytes.length + artifacts.manifestBytes.length < leader_projection_contract_1.CHARACTER_LEADER_PROJECTION_METADATA_LIMIT_BYTES);
        (0, assert_1.equal)(artifacts.coverage.states.included, 10651);
        (0, assert_1.equal)(artifacts.coverage.states.excluded, 3);
        (0, assert_1.equal)(artifacts.coverage.leaderReferences.effectReferences, 49435);
        (0, assert_1.equal)(artifacts.coverage.leaderReferences.targetReferences, 34914);
        (0, assert_1.equal)(artifacts.coverage.leaderReferences.repeatedEffectReferences, 0);
        (0, assert_1.equal)(artifacts.coverage.leaderReferences.repeatedTargetReferences, 12720);
        (0, assert_1.equal)(artifacts.validation.readiness.offlineGeneration, "GO");
        (0, assert_1.equal)(artifacts.validation.readiness.sourceBoundValidation, "NOT_EXECUTED");
        (0, assert_1.equal)(artifacts.validation.readiness.leaderClauseSemantics, "NO-GO");
        (0, assert_1.equal)(artifacts.validation.safety.automaticCleanupAttempted, false);
    });
    it("rejects duplicate, unstable, percentage and presentation-bearing records", () => {
        const states = [...dataset.states].reverse();
        states[0] = { ...states[0], name: "presentation", leader: { ...states[0].leader, structuredPercentValues: [170] } };
        states[1] = { ...states[1], stateId: states[0].stateId };
        states[2] = { ...states[2], leader: { ...states[2].leader, effects: [...states[2].leader.effects].reverse() } };
        const invalid = { ...dataset, states };
        const validation = (0, leader_projection_1.validateCharacterLeaderProjection)(invalid, artifacts.coverage, artifacts.validation.sizes);
        (0, assert_1.equal)(validation.valid, false);
        (0, assert_1.ok)(validation.failures.includes("duplicate state identity"));
        (0, assert_1.ok)(validation.failures.includes("unstable structural order"));
        (0, assert_1.ok)(validation.failures.includes("extra or presentation field included"));
        (0, assert_1.ok)(validation.failures.includes("percent value field included"));
    });
    it("writes create-only single-link members with the fixed manifest last", async () => {
        const root = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "k46-writer-"));
        try {
            const written = await (0, leader_projection_run_1.writeCharacterLeaderProjectionArtifacts)(root, artifacts);
            (0, assert_1.equal)((0, path_1.basename)(written.members[written.members.length - 1].path), leader_projection_contract_1.CHARACTER_LEADER_PROJECTION_FILES.manifest);
            (0, assert_1.equal)(written.members.length, 4);
            for (const member of written.members)
                (0, assert_1.equal)((await (0, promises_1.lstat)(member.path)).nlink, 1);
            await (0, assert_1.rejects)((0, leader_projection_run_1.writeCharacterLeaderProjectionArtifacts)(root, artifacts), /output already exists/);
        }
        finally {
            await (0, promises_1.rm)(root, { recursive: true, force: true });
        }
    });
    it("rejects oversized artifact members before allocating their bytes", async () => {
        const root = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "k46-bounded-reader-"));
        try {
            await (0, promises_1.writeFile)((0, path_1.join)(root, leader_projection_contract_1.CHARACTER_LEADER_PROJECTION_FILES.manifest), Buffer.alloc(64));
            await (0, assert_1.rejects)((0, leader_projection_1.readBoundedCharacterLeaderProjectionMember)(root, leader_projection_contract_1.CHARACTER_LEADER_PROJECTION_FILES.manifest, 64), /byte budget or exact size rejected/);
            await (0, promises_1.writeFile)((0, path_1.join)(root, "database-characters-k46-leader-projection." + "a".repeat(64) + ".json.gz"), Buffer.from("exact"));
            const exact = await (0, leader_projection_1.readBoundedCharacterLeaderProjectionMember)(root, "database-characters-k46-leader-projection." + "a".repeat(64) + ".json.gz", 6, 5);
            (0, assert_1.equal)(exact.toString("utf8"), "exact");
        }
        finally {
            await (0, promises_1.rm)(root, { recursive: true, force: true });
        }
    });
    it("rejects linked output roots and overlap with every source root", async function () {
        const root = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "k46-roots-"));
        const sidecar = (0, path_1.join)(root, "sidecar"), production = (0, path_1.join)(root, "production"), fyi = (0, path_1.join)(root, "fyi"), k43 = (0, path_1.join)(root, "k43");
        const output = (0, path_1.join)(root, "output"), nested = (0, path_1.join)(k43, "nested"), linked = (0, path_1.join)(root, "linked");
        await Promise.all([(0, promises_1.mkdir)(sidecar), (0, promises_1.mkdir)(production), (0, promises_1.mkdir)(fyi), (0, promises_1.mkdir)(k43), (0, promises_1.mkdir)(output)]);
        await (0, promises_1.mkdir)(nested);
        try {
            await (0, assert_1.rejects)((0, leader_projection_run_1.validateCharacterLeaderProjectionRootSeparation)({ sidecarRoot: sidecar, productionRoot: production, fyiRoot: fyi, k43Root: k43, outputRoot: nested }), /must not alias, contain, or descend/);
            await (0, leader_projection_run_1.validateCharacterLeaderProjectionRootSeparation)({ sidecarRoot: sidecar, productionRoot: production, fyiRoot: fyi, k43Root: k43, outputRoot: output });
            try {
                await (0, promises_1.symlink)(output, linked, process.platform === "win32" ? "junction" : "dir");
            }
            catch (error) {
                if (error?.code === "EPERM")
                    return;
                throw error;
            }
            await (0, assert_1.rejects)((0, leader_projection_run_1.validateCharacterLeaderProjectionOutputRoot)(linked), /regular non-link directory|symlink or junction rejected/);
        }
        finally {
            await (0, promises_1.rm)(root, { recursive: true, force: true });
        }
    });
});
//# sourceMappingURL=leader-projection.spec.js.map