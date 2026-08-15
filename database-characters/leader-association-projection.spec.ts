import { basename, join } from "path";
import { deepStrictEqual, equal, ok, rejects, throws } from "assert";
import { lstat, mkdtemp, mkdir, rm, symlink, writeFile } from "fs/promises";
import { tmpdir } from "os";
import {
    CHARACTER_LEADER_ASSOCIATION_PROJECTION_FILES,
    CHARACTER_LEADER_ASSOCIATION_PROJECTION_GZIP_LIMIT_BYTES,
    CHARACTER_LEADER_ASSOCIATION_PROJECTION_METADATA_LIMIT_BYTES,
    CHARACTER_LEADER_ASSOCIATION_PROJECTION_RAW_LIMIT_BYTES,
    CharacterLeaderAssociationProjectionArtifactSet,
} from "./leader-association-projection-contract";
import {
    buildCharacterLeaderAssociationProjection,
    materializeCharacterLeaderAssociationProjection,
    readBoundedCharacterLeaderAssociationProjectionMember,
    validateCharacterLeaderAssociationProjection,
} from "./leader-association-projection";
import {
    parseCharacterLeaderAssociationProjectionCli,
    runCharacterLeaderAssociationProjection,
    validateCharacterLeaderAssociationProjectionOutputRoot,
    validateCharacterLeaderAssociationProjectionRootSeparation,
    writeCharacterLeaderAssociationProjectionArtifacts,
} from "./leader-association-projection-run";
import type { CharacterLeaderAssociationK3Source } from "./leader-association-scope-contract";
import { buildCharacterLeaderAssociationScopeReport, evaluateCharacterLeaderAssociationScope } from "./leader-association-scope";
import { compactK46LeaderAssociationSource } from "./leader-association-scope-source";
import { CHARACTER_LEADER_SCOPE_EXCLUDED_STATE_IDS, CHARACTER_LEADER_SCOPE_PIN } from "./leader-scope-contract";

function fixture(): {
    artifacts: CharacterLeaderAssociationProjectionArtifactSet;
    built: ReturnType<typeof buildCharacterLeaderAssociationProjection>;
    source: { k46Artifacts: any; k3: CharacterLeaderAssociationK3Source; rawReport: ReturnType<typeof buildCharacterLeaderAssociationScopeReport> };
} {
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
    const k46States: any[] = [], k3States: any[] = [], effects: any[] = [], targets: any[] = [];
    let effectOrdinal = 0;
    for (let index = 0; index < CHARACTER_LEADER_SCOPE_PIN.includedStates; index++) {
        const ordinal = String(index + 1).padStart(5, "0"), stateId = `card-state:${ordinal}:initial`;
        const uniqueCount = 2 + (index < 892 ? 1 : 0), repeatCount = 1 + (index < 2_069 ? 1 : 0), nullCount = 1 + (index < 3_870 ? 1 : 0);
        const effectRefs: any[] = [], flatTargetRefs: any[] = [];
        for (let unique = 0; unique < uniqueCount; unique++) {
            const targetSetId = `target-set:${index}:${unique}`, targetRowId = `target-row:${index}:${unique}`, effectRowId = `effect:${effectOrdinal++}`;
            effects.push({ rowId: effectRowId, targetSetId }); targets.push({ rowId: targetRowId, targetSetId });
            effectRefs.push({ table: "leader_skills", rowId: effectRowId }); flatTargetRefs.push({ table: "sub_target_types", rowId: targetRowId });
        }
        for (let repeat = 0; repeat < repeatCount; repeat++) {
            const effectRowId = `effect:${effectOrdinal++}`;
            effects.push({ rowId: effectRowId, targetSetId: `target-set:${index}:0` });
            effectRefs.push({ table: "leader_skills", rowId: effectRowId }); flatTargetRefs.push({ table: "sub_target_types", rowId: `target-row:${index}:0` });
        }
        for (let empty = 0; empty < nullCount; empty++) {
            const effectRowId = `effect:${effectOrdinal++}`;
            effects.push({ rowId: effectRowId, targetSetId: null }); effectRefs.push({ table: "leader_skills", rowId: effectRowId });
        }
        const sourceStateKey = `source:${ordinal}`, cardId = ordinal;
        k46States.push({
            stateId, sourceStateKey, cardId, releaseState: "initial",
            leader: {
                set: { table: "leader_skill_sets", rowId: String(index % CHARACTER_LEADER_SCOPE_PIN.uniqueLeaderSetRows) },
                effects: effectRefs, targets: flatTargetRefs,
            },
        });
        k3States.push({ stateId, sourceStateKey, cardId, releaseState: "initial", effectRowIds: effectRefs.map(ref => ref.rowId), flattenedTargetRowIds: flatTargetRefs.map(ref => ref.rowId) });
    }
    equal(effectOrdinal, 49_435); equal(targets.length, 22_194);
    k3States.push(...CHARACTER_LEADER_SCOPE_EXCLUDED_STATE_IDS.map((stateId, index) => ({
        stateId, sourceStateKey: `unknown:${index}`, cardId: "1010900", releaseState: "unknown", effectRowIds: [], flattenedTargetRowIds: [],
    })));
    const k3: CharacterLeaderAssociationK3Source = { identity: k3AssociationIdentity, states: k3States, effects, targets };
    const k46Artifacts: any = {
        dataset: {
            source: { k43, k3: k3Pinned },
            policy: { sourceReferenceOrderAndMultiplicityPreserved: true, referencesDeduplicated: false, effectTargetAssociationsSelected: false },
            states: k46States,
        },
        coverage: { leaderReferences: {
            uniqueSetRows: 3_506, effectReferences: 49_435, targetReferences: 34_914,
            multiEffectStates: 10_600, multiTargetStates: 5_359, maximumEffectsPerState: 18, maximumTargetsPerState: 54,
            emptyEffectStates: 2, emptyTargetStates: 5_290, repeatedEffectReferences: 0, repeatedTargetReferences: 12_720,
        } },
        manifestBytes: Buffer.from("k46-manifest"), manifest: { sha256: "d".repeat(64), uncompressedSha256: "e".repeat(64) },
    };
    const k46 = compactK46LeaderAssociationSource(k46Artifacts);
    const proof = evaluateCharacterLeaderAssociationScope(k46, k3);
    const rawReport = buildCharacterLeaderAssociationScopeReport(k46.identity, k3.identity, proof);
    const k47 = {
        ...rawReport,
        inputIntegrity: {
            ...rawReport.inputIntegrity, k46SourceBoundBefore: "GO" as const, k46SourceBoundAfter: "GO" as const,
            k46IdentityAndFingerprintStable: true, k3ExactPinnedBeforeAndAfter: true,
            k3AssociationFingerprintStable: true, k3DecodeBoundedToPinnedRawSize: true,
        },
        readiness: {
            ...rawReport.readiness, structuralAssociationScope: "GO" as const, nextStructuralIdAssociationProjection: "GO" as const,
        },
    };
    const built = buildCharacterLeaderAssociationProjection(k46Artifacts, k3, k47);
    return { built, artifacts: materializeCharacterLeaderAssociationProjection(built.dataset, built.coverage), source: { k46Artifacts, k3, rawReport } };
}

describe("database character K48 leader association structural projection", function () {
    this.timeout(30_000);
    let prepared: ReturnType<typeof fixture>;
    before(() => { prepared = fixture(); });

    it("accepts only the exact opt-in and six explicit roots", async () => {
        await rejects(runCharacterLeaderAssociationProjection({} as any), /explicit opt-in/);
        throws(() => parseCharacterLeaderAssociationProjectionCli([]), /exactly one --opt-in-k48/);
        throws(() => parseCharacterLeaderAssociationProjectionCli(["--opt-in-k48"]), /--sidecar-root/);
        throws(() => parseCharacterLeaderAssociationProjectionCli([
            "--opt-in-k48", "--sidecar-root", "s", "--production-root", "p", "--fyi-root", "f", "--k43-root", "k43", "--k46-root", "k46", "--output-root", "o", "--extra", "x",
        ]), /unsupported argument/);
        deepStrictEqual(parseCharacterLeaderAssociationProjectionCli([
            "--opt-in-k48", "--sidecar-root", "s", "--production-root", "p", "--fyi-root", "f", "--k43-root", "k43", "--k46-root", "k46", "--output-root", "o",
        ]), { optIn: true, sidecarRoot: "s", productionRoot: "p", fyiRoot: "f", k43Root: "k43", k46Root: "k46", outputRoot: "o" });
        const savedGc = (global as any).gc;
        try {
            (global as any).gc = undefined;
            await rejects(runCharacterLeaderAssociationProjection({ optIn: true, sidecarRoot: "s", productionRoot: "p", fyiRoot: "f", k43Root: "k43", k46Root: "k46", outputRoot: "o" }), /--expose-gc/);
        } finally { (global as any).gc = savedGc; }
    });

    it("projects source-ordered effects with target-set associations and no redundant flat target array", () => {
        const first = prepared.built.dataset.states[0];
        deepStrictEqual(first.leader.effects.slice(0, 5).map(item => item.targetSetId), [
            "target-set:0:0", "target-set:0:1", "target-set:0:2", "target-set:0:0", "target-set:0:0",
        ]);
        deepStrictEqual(first.leader.effects.slice(0, 5).map(item => item.targets[0].rowId), [
            "target-row:0:0", "target-row:0:1", "target-row:0:2", "target-row:0:0", "target-row:0:0",
        ]);
        equal((first.leader as any).targets, undefined);
        const encoded = JSON.stringify(first);
        ok(!encoded.includes("structuredPercentValues")); ok(!encoded.includes("rawRows")); ok(!encoded.includes("Character"));
    });

    it("refuses a direct non-authorized K47 report", () => {
        throws(() => buildCharacterLeaderAssociationProjection(
            prepared.source.k46Artifacts, prepared.source.k3, prepared.source.rawReport,
        ), /requires K47 real GO/);
    });

    it("pins the exact flatten proof and materializes deterministic content-addressed bytes within budgets", () => {
        const second = materializeCharacterLeaderAssociationProjection(prepared.built.dataset, prepared.built.coverage);
        ok(prepared.artifacts.raw.equals(second.raw)); ok(prepared.artifacts.gzip.equals(second.gzip));
        ok(prepared.artifacts.coverageBytes.equals(second.coverageBytes)); ok(prepared.artifacts.validationBytes.equals(second.validationBytes));
        ok(prepared.artifacts.manifestBytes.equals(second.manifestBytes)); ok(prepared.artifacts.manifest.fileName.includes(prepared.artifacts.manifest.sha256));
        equal(prepared.artifacts.coverage.effectAssociations, 49_435); equal(prepared.artifacts.coverage.targetReferences, 34_914);
        equal(prepared.artifacts.coverage.repeatedTargetReferences, 12_720); equal(prepared.artifacts.coverage.flattenedTargetMismatchStates, 0);
        ok(prepared.artifacts.raw.length < CHARACTER_LEADER_ASSOCIATION_PROJECTION_RAW_LIMIT_BYTES);
        ok(prepared.artifacts.gzip.length < CHARACTER_LEADER_ASSOCIATION_PROJECTION_GZIP_LIMIT_BYTES);
        ok(prepared.artifacts.coverageBytes.length + prepared.artifacts.validationBytes.length + prepared.artifacts.manifestBytes.length < CHARACTER_LEADER_ASSOCIATION_PROJECTION_METADATA_LIMIT_BYTES);
        equal(prepared.artifacts.validation.readiness.offlineGeneration, "GO"); equal(prepared.artifacts.validation.readiness.sourceBoundValidation, "NOT_EXECUTED");
        equal(prepared.artifacts.validation.readiness.semanticAssociation, "NO-GO"); equal(prepared.artifacts.validation.readiness.leaderClauseSemantics, "NO-GO");
        equal(prepared.artifacts.validation.readiness.presentation, "NO-GO"); equal(prepared.artifacts.validation.readiness.consumer, "NO-GO");
    });

    it("rejects repeated effects, redundant flat targets and presentation or value fields", () => {
        const states: any[] = [...prepared.built.dataset.states];
        states[0] = { ...states[0], leader: { ...states[0].leader, targets: [], effects: [...states[0].leader.effects] } };
        states[0].leader.effects[0] = { ...states[0].leader.effects[0], name: "presentation", value: 170 };
        states[0].leader.effects[1] = { ...states[0].leader.effects[1], effect: { ...states[0].leader.effects[0].effect } };
        const invalid: any = { ...prepared.built.dataset, states };
        const validation = validateCharacterLeaderAssociationProjection(invalid, prepared.artifacts.coverage, prepared.artifacts.validation.sizes);
        equal(validation.valid, false); ok(validation.failures.includes("repeated effect reference"));
        ok(validation.failures.includes("redundant flat target field included")); ok(validation.failures.includes("extra or presentation field included"));
        ok(validation.failures.includes("percent text raw or value field included"));
    });

    it("accepts null target sets only when their target array is empty", () => {
        const states: any[] = [...prepared.built.dataset.states];
        states[0] = { ...states[0], leader: { ...states[0].leader, effects: [...states[0].leader.effects] } };
        states[0].leader.effects[0] = { ...states[0].leader.effects[0], targetSetId: null };
        const invalid: any = { ...prepared.built.dataset, states };
        const validation = validateCharacterLeaderAssociationProjection(invalid, prepared.artifacts.coverage, prepared.artifacts.validation.sizes);
        equal(validation.valid, false);
        equal(validation.safety.nullTargetSetWithTargetsCount, 1);
        ok(validation.failures.includes("null target set with targets"));
    });

    it("writes create-only single-link members with the fixed manifest last and no cleanup path", async () => {
        const root = await mkdtemp(join(tmpdir(), "k48-writer-"));
        try {
            const written = await writeCharacterLeaderAssociationProjectionArtifacts(root, prepared.artifacts);
            equal(basename(written.members[written.members.length - 1].path), CHARACTER_LEADER_ASSOCIATION_PROJECTION_FILES.manifest);
            for (const member of written.members) equal((await lstat(member.path)).nlink, 1);
            await rejects(writeCharacterLeaderAssociationProjectionArtifacts(root, prepared.artifacts), /output already exists/);
        } finally { await rm(root, { recursive: true, force: true }); }
    });

    it("rejects oversized reads, linked roots, and overlap with K46 or other source roots", async function () {
        const root = await mkdtemp(join(tmpdir(), "k48-roots-"));
        const sidecar = join(root, "sidecar"), production = join(root, "production"), fyi = join(root, "fyi"), k43 = join(root, "k43"), k46 = join(root, "k46"), output = join(root, "output"), nested = join(k46, "nested"), linked = join(root, "linked");
        await Promise.all([mkdir(sidecar), mkdir(production), mkdir(fyi), mkdir(k43), mkdir(k46), mkdir(output)]); await mkdir(nested);
        try {
            await writeFile(join(output, "oversized.bin"), Buffer.alloc(64));
            await rejects(readBoundedCharacterLeaderAssociationProjectionMember(output, "oversized.bin", 64), /byte budget/);
            await rejects(validateCharacterLeaderAssociationProjectionRootSeparation({ sidecarRoot: sidecar, productionRoot: production, fyiRoot: fyi, k43Root: k43, k46Root: k46, outputRoot: nested }), /must not alias, contain, or descend/);
            await validateCharacterLeaderAssociationProjectionRootSeparation({ sidecarRoot: sidecar, productionRoot: production, fyiRoot: fyi, k43Root: k43, k46Root: k46, outputRoot: output });
            try { await symlink(output, linked, process.platform === "win32" ? "junction" : "dir"); }
            catch (error: any) { if (error?.code === "EPERM") return; throw error; }
            await rejects(validateCharacterLeaderAssociationProjectionOutputRoot(linked), /regular non-link directory|symlink or junction rejected/);
        } finally { await rm(root, { recursive: true, force: true }); }
    });
});
