"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = require("path");
const assert_1 = require("assert");
const promises_1 = require("fs/promises");
const os_1 = require("os");
const leader_association_projection_contract_1 = require("./leader-association-projection-contract");
const leader_association_projection_1 = require("./leader-association-projection");
const leader_association_projection_run_1 = require("./leader-association-projection-run");
const leader_association_scope_1 = require("./leader-association-scope");
const leader_association_scope_source_1 = require("./leader-association-scope-source");
const leader_scope_contract_1 = require("./leader-scope-contract");
function fixture() {
    const k3AssociationIdentity = {
        profileId: "character-refresh-pinned-v1", snapshotVersion: "snapshot-v1",
        manifest: { sha256: "1".repeat(64), sizeBytes: 1 },
        artifact: { sha256: "2".repeat(64), sizeBytes: 2, uncompressedSizeBytes: 3, uncompressedSha256: "3".repeat(64) },
        coverage: { sha256: "4".repeat(64), sizeBytes: 4 }, validation: { sha256: "5".repeat(64), sizeBytes: 5 },
        associationInputFingerprintSha256: "6".repeat(64),
    };
    const { associationInputFingerprintSha256: _association, ...k3PinnedBase } = k3AssociationIdentity;
    const k3Pinned = { ...k3PinnedBase, compactFingerprintSha256: "7".repeat(64) };
    const k43 = {
        manifestSha256: "8".repeat(64), payloadSha256: "9".repeat(64), rawSha256: "a".repeat(64),
        k42SourceFingerprintSha256: "b".repeat(64), stateFingerprintSha256: "c".repeat(64),
    };
    const k46States = [], k3States = [], effects = [], targets = [];
    let effectOrdinal = 0;
    for (let index = 0; index < leader_scope_contract_1.CHARACTER_LEADER_SCOPE_PIN.includedStates; index++) {
        const ordinal = String(index + 1).padStart(5, "0"), stateId = `card-state:${ordinal}:initial`;
        const uniqueCount = 2 + (index < 892 ? 1 : 0), repeatCount = 1 + (index < 2069 ? 1 : 0), nullCount = 1 + (index < 3870 ? 1 : 0);
        const effectRefs = [], flatTargetRefs = [];
        for (let unique = 0; unique < uniqueCount; unique++) {
            const targetSetId = `target-set:${index}:${unique}`, targetRowId = `target-row:${index}:${unique}`, effectRowId = `effect:${effectOrdinal++}`;
            effects.push({ rowId: effectRowId, targetSetId });
            targets.push({ rowId: targetRowId, targetSetId });
            effectRefs.push({ table: "leader_skills", rowId: effectRowId });
            flatTargetRefs.push({ table: "sub_target_types", rowId: targetRowId });
        }
        for (let repeat = 0; repeat < repeatCount; repeat++) {
            const effectRowId = `effect:${effectOrdinal++}`;
            effects.push({ rowId: effectRowId, targetSetId: `target-set:${index}:0` });
            effectRefs.push({ table: "leader_skills", rowId: effectRowId });
            flatTargetRefs.push({ table: "sub_target_types", rowId: `target-row:${index}:0` });
        }
        for (let empty = 0; empty < nullCount; empty++) {
            const effectRowId = `effect:${effectOrdinal++}`;
            effects.push({ rowId: effectRowId, targetSetId: null });
            effectRefs.push({ table: "leader_skills", rowId: effectRowId });
        }
        const sourceStateKey = `source:${ordinal}`, cardId = ordinal;
        k46States.push({
            stateId, sourceStateKey, cardId, releaseState: "initial",
            leader: {
                set: { table: "leader_skill_sets", rowId: String(index % leader_scope_contract_1.CHARACTER_LEADER_SCOPE_PIN.uniqueLeaderSetRows) },
                effects: effectRefs, targets: flatTargetRefs,
            },
        });
        k3States.push({ stateId, sourceStateKey, cardId, releaseState: "initial", effectRowIds: effectRefs.map(ref => ref.rowId), flattenedTargetRowIds: flatTargetRefs.map(ref => ref.rowId) });
    }
    (0, assert_1.equal)(effectOrdinal, 49435);
    (0, assert_1.equal)(targets.length, 22194);
    k3States.push(...leader_scope_contract_1.CHARACTER_LEADER_SCOPE_EXCLUDED_STATE_IDS.map((stateId, index) => ({
        stateId, sourceStateKey: `unknown:${index}`, cardId: "1010900", releaseState: "unknown", effectRowIds: [], flattenedTargetRowIds: [],
    })));
    const k3 = { identity: k3AssociationIdentity, states: k3States, effects, targets };
    const k46Artifacts = {
        dataset: {
            source: { k43, k3: k3Pinned },
            policy: { sourceReferenceOrderAndMultiplicityPreserved: true, referencesDeduplicated: false, effectTargetAssociationsSelected: false },
            states: k46States,
        },
        coverage: { leaderReferences: {
                uniqueSetRows: 3506, effectReferences: 49435, targetReferences: 34914,
                multiEffectStates: 10600, multiTargetStates: 5359, maximumEffectsPerState: 18, maximumTargetsPerState: 54,
                emptyEffectStates: 2, emptyTargetStates: 5290, repeatedEffectReferences: 0, repeatedTargetReferences: 12720,
            } },
        manifestBytes: Buffer.from("k46-manifest"), manifest: { sha256: "d".repeat(64), uncompressedSha256: "e".repeat(64) },
    };
    const k46 = (0, leader_association_scope_source_1.compactK46LeaderAssociationSource)(k46Artifacts);
    const proof = (0, leader_association_scope_1.evaluateCharacterLeaderAssociationScope)(k46, k3);
    const rawReport = (0, leader_association_scope_1.buildCharacterLeaderAssociationScopeReport)(k46.identity, k3.identity, proof);
    const k47 = {
        ...rawReport,
        inputIntegrity: {
            ...rawReport.inputIntegrity, k46SourceBoundBefore: "GO", k46SourceBoundAfter: "GO",
            k46IdentityAndFingerprintStable: true, k3ExactPinnedBeforeAndAfter: true,
            k3AssociationFingerprintStable: true, k3DecodeBoundedToPinnedRawSize: true,
        },
        readiness: {
            ...rawReport.readiness, structuralAssociationScope: "GO", nextStructuralIdAssociationProjection: "GO",
        },
    };
    const built = (0, leader_association_projection_1.buildCharacterLeaderAssociationProjection)(k46Artifacts, k3, k47);
    return { built, artifacts: (0, leader_association_projection_1.materializeCharacterLeaderAssociationProjection)(built.dataset, built.coverage), source: { k46Artifacts, k3, rawReport } };
}
describe("database character K48 leader association structural projection", function () {
    this.timeout(30000);
    let prepared;
    before(() => { prepared = fixture(); });
    it("accepts only the exact opt-in and six explicit roots", async () => {
        await (0, assert_1.rejects)((0, leader_association_projection_run_1.runCharacterLeaderAssociationProjection)({}), /explicit opt-in/);
        (0, assert_1.throws)(() => (0, leader_association_projection_run_1.parseCharacterLeaderAssociationProjectionCli)([]), /exactly one --opt-in-k48/);
        (0, assert_1.throws)(() => (0, leader_association_projection_run_1.parseCharacterLeaderAssociationProjectionCli)(["--opt-in-k48"]), /--sidecar-root/);
        (0, assert_1.throws)(() => (0, leader_association_projection_run_1.parseCharacterLeaderAssociationProjectionCli)([
            "--opt-in-k48", "--sidecar-root", "s", "--production-root", "p", "--fyi-root", "f", "--k43-root", "k43", "--k46-root", "k46", "--output-root", "o", "--extra", "x",
        ]), /unsupported argument/);
        (0, assert_1.deepStrictEqual)((0, leader_association_projection_run_1.parseCharacterLeaderAssociationProjectionCli)([
            "--opt-in-k48", "--sidecar-root", "s", "--production-root", "p", "--fyi-root", "f", "--k43-root", "k43", "--k46-root", "k46", "--output-root", "o",
        ]), { optIn: true, sidecarRoot: "s", productionRoot: "p", fyiRoot: "f", k43Root: "k43", k46Root: "k46", outputRoot: "o" });
        const savedGc = global.gc;
        try {
            global.gc = undefined;
            await (0, assert_1.rejects)((0, leader_association_projection_run_1.runCharacterLeaderAssociationProjection)({ optIn: true, sidecarRoot: "s", productionRoot: "p", fyiRoot: "f", k43Root: "k43", k46Root: "k46", outputRoot: "o" }), /--expose-gc/);
        }
        finally {
            global.gc = savedGc;
        }
    });
    it("projects source-ordered effects with target-set associations and no redundant flat target array", () => {
        const first = prepared.built.dataset.states[0];
        (0, assert_1.deepStrictEqual)(first.leader.effects.slice(0, 5).map(item => item.targetSetId), [
            "target-set:0:0", "target-set:0:1", "target-set:0:2", "target-set:0:0", "target-set:0:0",
        ]);
        (0, assert_1.deepStrictEqual)(first.leader.effects.slice(0, 5).map(item => item.targets[0].rowId), [
            "target-row:0:0", "target-row:0:1", "target-row:0:2", "target-row:0:0", "target-row:0:0",
        ]);
        (0, assert_1.equal)(first.leader.targets, undefined);
        const encoded = JSON.stringify(first);
        (0, assert_1.ok)(!encoded.includes("structuredPercentValues"));
        (0, assert_1.ok)(!encoded.includes("rawRows"));
        (0, assert_1.ok)(!encoded.includes("Character"));
    });
    it("refuses a direct non-authorized K47 report", () => {
        (0, assert_1.throws)(() => (0, leader_association_projection_1.buildCharacterLeaderAssociationProjection)(prepared.source.k46Artifacts, prepared.source.k3, prepared.source.rawReport), /requires K47 real GO/);
    });
    it("pins the exact flatten proof and materializes deterministic content-addressed bytes within budgets", () => {
        const second = (0, leader_association_projection_1.materializeCharacterLeaderAssociationProjection)(prepared.built.dataset, prepared.built.coverage);
        (0, assert_1.ok)(prepared.artifacts.raw.equals(second.raw));
        (0, assert_1.ok)(prepared.artifacts.gzip.equals(second.gzip));
        (0, assert_1.ok)(prepared.artifacts.coverageBytes.equals(second.coverageBytes));
        (0, assert_1.ok)(prepared.artifacts.validationBytes.equals(second.validationBytes));
        (0, assert_1.ok)(prepared.artifacts.manifestBytes.equals(second.manifestBytes));
        (0, assert_1.ok)(prepared.artifacts.manifest.fileName.includes(prepared.artifacts.manifest.sha256));
        (0, assert_1.equal)(prepared.artifacts.coverage.effectAssociations, 49435);
        (0, assert_1.equal)(prepared.artifacts.coverage.targetReferences, 34914);
        (0, assert_1.equal)(prepared.artifacts.coverage.repeatedTargetReferences, 12720);
        (0, assert_1.equal)(prepared.artifacts.coverage.flattenedTargetMismatchStates, 0);
        (0, assert_1.ok)(prepared.artifacts.raw.length < leader_association_projection_contract_1.CHARACTER_LEADER_ASSOCIATION_PROJECTION_RAW_LIMIT_BYTES);
        (0, assert_1.ok)(prepared.artifacts.gzip.length < leader_association_projection_contract_1.CHARACTER_LEADER_ASSOCIATION_PROJECTION_GZIP_LIMIT_BYTES);
        (0, assert_1.ok)(prepared.artifacts.coverageBytes.length + prepared.artifacts.validationBytes.length + prepared.artifacts.manifestBytes.length < leader_association_projection_contract_1.CHARACTER_LEADER_ASSOCIATION_PROJECTION_METADATA_LIMIT_BYTES);
        (0, assert_1.equal)(prepared.artifacts.validation.readiness.offlineGeneration, "GO");
        (0, assert_1.equal)(prepared.artifacts.validation.readiness.sourceBoundValidation, "NOT_EXECUTED");
        (0, assert_1.equal)(prepared.artifacts.validation.readiness.semanticAssociation, "NO-GO");
        (0, assert_1.equal)(prepared.artifacts.validation.readiness.leaderClauseSemantics, "NO-GO");
        (0, assert_1.equal)(prepared.artifacts.validation.readiness.presentation, "NO-GO");
        (0, assert_1.equal)(prepared.artifacts.validation.readiness.consumer, "NO-GO");
    });
    it("rejects repeated effects, redundant flat targets and presentation or value fields", () => {
        const states = [...prepared.built.dataset.states];
        states[0] = { ...states[0], leader: { ...states[0].leader, targets: [], effects: [...states[0].leader.effects] } };
        states[0].leader.effects[0] = { ...states[0].leader.effects[0], name: "presentation", value: 170 };
        states[0].leader.effects[1] = { ...states[0].leader.effects[1], effect: { ...states[0].leader.effects[0].effect } };
        const invalid = { ...prepared.built.dataset, states };
        const validation = (0, leader_association_projection_1.validateCharacterLeaderAssociationProjection)(invalid, prepared.artifacts.coverage, prepared.artifacts.validation.sizes);
        (0, assert_1.equal)(validation.valid, false);
        (0, assert_1.ok)(validation.failures.includes("repeated effect reference"));
        (0, assert_1.ok)(validation.failures.includes("redundant flat target field included"));
        (0, assert_1.ok)(validation.failures.includes("extra or presentation field included"));
        (0, assert_1.ok)(validation.failures.includes("percent text raw or value field included"));
    });
    it("accepts null target sets only when their target array is empty", () => {
        const states = [...prepared.built.dataset.states];
        states[0] = { ...states[0], leader: { ...states[0].leader, effects: [...states[0].leader.effects] } };
        states[0].leader.effects[0] = { ...states[0].leader.effects[0], targetSetId: null };
        const invalid = { ...prepared.built.dataset, states };
        const validation = (0, leader_association_projection_1.validateCharacterLeaderAssociationProjection)(invalid, prepared.artifacts.coverage, prepared.artifacts.validation.sizes);
        (0, assert_1.equal)(validation.valid, false);
        (0, assert_1.equal)(validation.safety.nullTargetSetWithTargetsCount, 1);
        (0, assert_1.ok)(validation.failures.includes("null target set with targets"));
    });
    it("writes create-only single-link members with the fixed manifest last and no cleanup path", async () => {
        const root = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "k48-writer-"));
        try {
            const written = await (0, leader_association_projection_run_1.writeCharacterLeaderAssociationProjectionArtifacts)(root, prepared.artifacts);
            (0, assert_1.equal)((0, path_1.basename)(written.members[written.members.length - 1].path), leader_association_projection_contract_1.CHARACTER_LEADER_ASSOCIATION_PROJECTION_FILES.manifest);
            for (const member of written.members)
                (0, assert_1.equal)((await (0, promises_1.lstat)(member.path)).nlink, 1);
            await (0, assert_1.rejects)((0, leader_association_projection_run_1.writeCharacterLeaderAssociationProjectionArtifacts)(root, prepared.artifacts), /output already exists/);
        }
        finally {
            await (0, promises_1.rm)(root, { recursive: true, force: true });
        }
    });
    it("rejects oversized reads, linked roots, and overlap with K46 or other source roots", async function () {
        const root = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "k48-roots-"));
        const sidecar = (0, path_1.join)(root, "sidecar"), production = (0, path_1.join)(root, "production"), fyi = (0, path_1.join)(root, "fyi"), k43 = (0, path_1.join)(root, "k43"), k46 = (0, path_1.join)(root, "k46"), output = (0, path_1.join)(root, "output"), nested = (0, path_1.join)(k46, "nested"), linked = (0, path_1.join)(root, "linked");
        await Promise.all([(0, promises_1.mkdir)(sidecar), (0, promises_1.mkdir)(production), (0, promises_1.mkdir)(fyi), (0, promises_1.mkdir)(k43), (0, promises_1.mkdir)(k46), (0, promises_1.mkdir)(output)]);
        await (0, promises_1.mkdir)(nested);
        try {
            await (0, promises_1.writeFile)((0, path_1.join)(output, "oversized.bin"), Buffer.alloc(64));
            await (0, assert_1.rejects)((0, leader_association_projection_1.readBoundedCharacterLeaderAssociationProjectionMember)(output, "oversized.bin", 64), /byte budget/);
            await (0, assert_1.rejects)((0, leader_association_projection_run_1.validateCharacterLeaderAssociationProjectionRootSeparation)({ sidecarRoot: sidecar, productionRoot: production, fyiRoot: fyi, k43Root: k43, k46Root: k46, outputRoot: nested }), /must not alias, contain, or descend/);
            await (0, leader_association_projection_run_1.validateCharacterLeaderAssociationProjectionRootSeparation)({ sidecarRoot: sidecar, productionRoot: production, fyiRoot: fyi, k43Root: k43, k46Root: k46, outputRoot: output });
            try {
                await (0, promises_1.symlink)(output, linked, process.platform === "win32" ? "junction" : "dir");
            }
            catch (error) {
                if (error?.code === "EPERM")
                    return;
                throw error;
            }
            await (0, assert_1.rejects)((0, leader_association_projection_run_1.validateCharacterLeaderAssociationProjectionOutputRoot)(linked), /regular non-link directory|symlink or junction rejected/);
        }
        finally {
            await (0, promises_1.rm)(root, { recursive: true, force: true });
        }
    });
});
//# sourceMappingURL=leader-association-projection.spec.js.map