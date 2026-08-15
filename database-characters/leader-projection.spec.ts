import { basename, join } from "path";
import { deepStrictEqual, equal, ok, rejects, throws } from "assert";
import { lstat, mkdtemp, mkdir, rm, symlink, writeFile } from "fs/promises";
import { tmpdir } from "os";
import {
    CHARACTER_LEADER_PROJECTION_FILES,
    CHARACTER_LEADER_PROJECTION_GZIP_LIMIT_BYTES,
    CHARACTER_LEADER_PROJECTION_METADATA_LIMIT_BYTES,
    CHARACTER_LEADER_PROJECTION_RAW_LIMIT_BYTES,
    CHARACTER_LEADER_PROJECTION_REPEAT_PIN,
    CharacterLeaderProjectionArtifactSet,
    CharacterLeaderProjectionDataset,
} from "./leader-projection-contract";
import {
    buildCharacterLeaderProjection,
    buildCharacterLeaderProjectionCoverage,
    materializeCharacterLeaderProjection,
    projectCharacterLeaderStructuralRecords,
    readBoundedCharacterLeaderProjectionMember,
    validateCharacterLeaderProjection,
} from "./leader-projection";
import {
    parseCharacterLeaderProjectionCli,
    runCharacterLeaderProjection,
    validateCharacterLeaderProjectionOutputRoot,
    validateCharacterLeaderProjectionRootSeparation,
    writeCharacterLeaderProjectionArtifacts,
} from "./leader-projection-run";
import {
    CHARACTER_LEADER_SCOPE_EXCLUDED_STATE_IDS,
    CHARACTER_LEADER_SCOPE_PIN,
    CharacterLeaderScopeEvaluation,
    CharacterLeaderScopeK3Identity,
    CharacterLeaderScopeK3Source,
    CharacterLeaderScopeK43Identity,
    CharacterLeaderScopeK43Source,
} from "./leader-scope-contract";
import { buildCharacterLeaderScopeReport } from "./leader-scope";

const ref = (table: string, rowId: string) => ({ table, rowId });
function k43Identity(): CharacterLeaderScopeK43Identity {
    return {
        manifestSha256: "1".repeat(64), payloadSha256: "2".repeat(64), rawSha256: "3".repeat(64),
        k42SourceFingerprintSha256: "4".repeat(64), stateFingerprintSha256: "5".repeat(64),
    };
}
function k3Identity(): CharacterLeaderScopeK3Identity {
    return {
        profileId: "character-refresh-pinned-v1", snapshotVersion: "snapshot-v1",
        manifest: { sha256: "6".repeat(64), sizeBytes: 1 },
        artifact: { sha256: "7".repeat(64), sizeBytes: 2, uncompressedSizeBytes: 3, uncompressedSha256: "8".repeat(64) },
        coverage: { sha256: "9".repeat(64), sizeBytes: 4 }, validation: { sha256: "a".repeat(64), sizeBytes: 5 },
        compactFingerprintSha256: "b".repeat(64),
    };
}
function smallSources(): { k43: CharacterLeaderScopeK43Source; k3: CharacterLeaderScopeK3Source } {
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
        }, ...CHARACTER_LEADER_SCOPE_EXCLUDED_STATE_IDS.map((excluded, index) => ({
            stateId: excluded, sourceStateKey: `unknown:${index}`, cardId: "1010900", releaseState: "unknown" as const,
            leader: { set: ref("leader_sets", `${index}`), effects: [], targets: [], structuredPercentValues: [] },
        }))] },
    };
}

function pinnedEvaluation(): CharacterLeaderScopeEvaluation {
    return {
        includedStates: CHARACTER_LEADER_SCOPE_PIN.includedStates, excludedStates: CHARACTER_LEADER_SCOPE_PIN.excludedStates,
        excludedStateIds: [...CHARACTER_LEADER_SCOPE_EXCLUDED_STATE_IDS], uniqueLeaderSetRows: CHARACTER_LEADER_SCOPE_PIN.uniqueLeaderSetRows,
        effectReferences: CHARACTER_LEADER_SCOPE_PIN.effectReferences, targetReferences: CHARACTER_LEADER_SCOPE_PIN.targetReferences,
        structuredPercentValues: CHARACTER_LEADER_SCOPE_PIN.structuredPercentValues, multiEffectStates: CHARACTER_LEADER_SCOPE_PIN.multiEffectStates,
        multiTargetStates: CHARACTER_LEADER_SCOPE_PIN.multiTargetStates, multiPercentStates: CHARACTER_LEADER_SCOPE_PIN.multiPercentStates,
        maximumEffectsPerState: CHARACTER_LEADER_SCOPE_PIN.maximumEffectsPerState, maximumTargetsPerState: CHARACTER_LEADER_SCOPE_PIN.maximumTargetsPerState,
        maximumPercentValuesPerState: CHARACTER_LEADER_SCOPE_PIN.maximumPercentValuesPerState, emptyEffectStates: CHARACTER_LEADER_SCOPE_PIN.emptyEffectStates,
        emptyTargetStates: CHARACTER_LEADER_SCOPE_PIN.emptyTargetStates, emptyPercentStates: CHARACTER_LEADER_SCOPE_PIN.emptyPercentStates,
        samples: {
            multiEffectStateIds: [], multiTargetStateIds: [], multiPercentStateIds: [], maximumEffectStateIds: [],
            maximumTargetStateIds: [], maximumPercentStateIds: [], limitPerKind: 5,
        },
    };
}

function distributedCounts(count: number, minimum: number, maximum: number, total: number): number[] {
    const values = Array<number>(count).fill(minimum);
    let remaining = total - count * minimum;
    for (let index = 0; index < values.length && remaining > 0; index++) {
        const addition = Math.min(maximum - minimum, remaining);
        values[index] += addition; remaining -= addition;
    }
    equal(remaining, 0);
    return values;
}

function productionDataset(): CharacterLeaderProjectionDataset {
    const effectCounts = [
        ...distributedCounts(CHARACTER_LEADER_SCOPE_PIN.multiEffectStates, 2, CHARACTER_LEADER_SCOPE_PIN.maximumEffectsPerState,
            CHARACTER_LEADER_SCOPE_PIN.effectReferences - (CHARACTER_LEADER_SCOPE_PIN.includedStates - CHARACTER_LEADER_SCOPE_PIN.multiEffectStates - CHARACTER_LEADER_SCOPE_PIN.emptyEffectStates)),
        ...Array(CHARACTER_LEADER_SCOPE_PIN.includedStates - CHARACTER_LEADER_SCOPE_PIN.multiEffectStates - CHARACTER_LEADER_SCOPE_PIN.emptyEffectStates).fill(1),
        ...Array(CHARACTER_LEADER_SCOPE_PIN.emptyEffectStates).fill(0),
    ];
    const targetCounts = [
        ...distributedCounts(CHARACTER_LEADER_SCOPE_PIN.multiTargetStates, 2, CHARACTER_LEADER_SCOPE_PIN.maximumTargetsPerState,
            CHARACTER_LEADER_SCOPE_PIN.targetReferences - (CHARACTER_LEADER_SCOPE_PIN.includedStates - CHARACTER_LEADER_SCOPE_PIN.multiTargetStates - CHARACTER_LEADER_SCOPE_PIN.emptyTargetStates)),
        ...Array(CHARACTER_LEADER_SCOPE_PIN.includedStates - CHARACTER_LEADER_SCOPE_PIN.multiTargetStates - CHARACTER_LEADER_SCOPE_PIN.emptyTargetStates).fill(1),
        ...Array(CHARACTER_LEADER_SCOPE_PIN.emptyTargetStates).fill(0),
    ];
    let remainingTargetRepeats = CHARACTER_LEADER_PROJECTION_REPEAT_PIN.targetReferences;
    const states = Array.from({ length: CHARACTER_LEADER_SCOPE_PIN.includedStates }, (_, index) => {
        const ordinal = String(index + 1).padStart(5, "0");
        const targetRepeatCount = Math.min(Math.max(0, targetCounts[index] - 1), remainingTargetRepeats);
        remainingTargetRepeats -= targetRepeatCount;
        const uniqueTargetCount = targetCounts[index] - targetRepeatCount;
        return {
            stateId: `card-state:${ordinal}:initial`, sourceStateKey: `source:${ordinal}`, cardId: ordinal, releaseState: "initial" as const,
            leader: {
                set: ref("leader_sets", String(index % CHARACTER_LEADER_SCOPE_PIN.uniqueLeaderSetRows).padStart(4, "0")),
                effects: Array.from({ length: effectCounts[index] }, (_, refIndex) => ref("leader_effects", String(refIndex).padStart(2, "0"))),
                targets: Array.from({ length: targetCounts[index] }, (_, refIndex) => ref("leader_targets", String(uniqueTargetCount ? refIndex % uniqueTargetCount : 0).padStart(2, "0"))),
            },
        };
    });
    equal(remainingTargetRepeats, 0);
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
    this.timeout(30_000);
    let dataset: CharacterLeaderProjectionDataset;
    let artifacts: CharacterLeaderProjectionArtifactSet;

    before(() => {
        dataset = productionDataset();
        artifacts = materializeCharacterLeaderProjection(dataset, buildCharacterLeaderProjectionCoverage(dataset.states));
    });

    it("accepts only the exact opt-in and five explicit roots", async () => {
        await rejects(runCharacterLeaderProjection({} as any), /explicit opt-in/);
        throws(() => parseCharacterLeaderProjectionCli([]), /exactly one --opt-in-k46/);
        throws(() => parseCharacterLeaderProjectionCli(["--opt-in-k46"]), /--sidecar-root/);
        throws(() => parseCharacterLeaderProjectionCli([
            "--opt-in-k46", "--sidecar-root", "s", "--production-root", "p", "--fyi-root", "f", "--k43-root", "k", "--output-root", "o", "--extra", "x",
        ]), /unsupported argument/);
        deepStrictEqual(parseCharacterLeaderProjectionCli([
            "--opt-in-k46", "--sidecar-root", "s", "--production-root", "p", "--fyi-root", "f", "--k43-root", "k", "--output-root", "o",
        ]), { optIn: true, sidecarRoot: "s", productionRoot: "p", fyiRoot: "f", k43Root: "k", outputRoot: "o" });
        const savedGc = (global as any).gc;
        try {
            (global as any).gc = undefined;
            await rejects(runCharacterLeaderProjection({ optIn: true, sidecarRoot: "s", productionRoot: "p", fyiRoot: "f", k43Root: "k", outputRoot: "o" }), /--expose-gc/);
        } finally { (global as any).gc = savedGc; }
    });

    it("projects cloned structural refs while preserving source order and multiplicity", () => {
        const source = smallSources(), projected = projectCharacterLeaderStructuralRecords(source.k43, source.k3);
        equal(projected.states.length, 1);
        deepStrictEqual(projected.states[0].leader.effects.map(item => item.rowId), ["10", "2", "2"]);
        deepStrictEqual(projected.states[0].leader.targets.map(item => item.rowId), ["10", "1"]);
        const encoded = JSON.stringify(projected.states);
        ok(!encoded.includes("structuredPercentValues")); ok(!encoded.includes("rawRows")); ok(!encoded.includes("Character"));
        source.k3.states[0].leader.effects[0].rowId = "mutated";
        equal(projected.states[0].leader.effects[0].rowId, "10");
    });

    it("requires a real K45 GO identity and production pins before build", () => {
        const source = smallSources();
        const raw = buildCharacterLeaderScopeReport(source.k43.identity, source.k3.identity, pinnedEvaluation());
        throws(() => buildCharacterLeaderProjection(source.k43, source.k3, raw), /requires K45 real GO/);
        const go = {
            ...raw,
            inputIntegrity: {
                ...raw.inputIntegrity, k43SourceBoundBefore: "GO" as const, k43SourceBoundAfter: "GO" as const,
                k43IdentityAndFingerprintStable: true, k3ExactPinnedFilesBeforeAndAfter: true,
                k3IdentityAndFingerprintStable: true, k3DecodeBoundedToPinnedRawSize: true,
            },
            readiness: { ...raw.readiness, structuralScope: "GO" as const, nextStructuralIdOnlyProjection: "GO" as const },
        };
        throws(() => buildCharacterLeaderProjection(source.k43, source.k3, go), /pin changed/);
    });

    it("materializes canonical deterministic content-addressed bytes within fixed budgets", () => {
        const second = materializeCharacterLeaderProjection(dataset, buildCharacterLeaderProjectionCoverage(dataset.states));
        ok(artifacts.raw.equals(second.raw)); ok(artifacts.gzip.equals(second.gzip));
        ok(artifacts.coverageBytes.equals(second.coverageBytes)); ok(artifacts.validationBytes.equals(second.validationBytes));
        ok(artifacts.manifestBytes.equals(second.manifestBytes)); ok(artifacts.manifest.fileName.includes(artifacts.manifest.sha256));
        ok(artifacts.raw.length < CHARACTER_LEADER_PROJECTION_RAW_LIMIT_BYTES);
        ok(artifacts.gzip.length < CHARACTER_LEADER_PROJECTION_GZIP_LIMIT_BYTES);
        ok(artifacts.coverageBytes.length + artifacts.validationBytes.length + artifacts.manifestBytes.length < CHARACTER_LEADER_PROJECTION_METADATA_LIMIT_BYTES);
        equal(artifacts.coverage.states.included, 10_651); equal(artifacts.coverage.states.excluded, 3);
        equal(artifacts.coverage.leaderReferences.effectReferences, 49_435);
        equal(artifacts.coverage.leaderReferences.targetReferences, 34_914);
        equal(artifacts.coverage.leaderReferences.repeatedEffectReferences, 0);
        equal(artifacts.coverage.leaderReferences.repeatedTargetReferences, 12_720);
        equal(artifacts.validation.readiness.offlineGeneration, "GO");
        equal(artifacts.validation.readiness.sourceBoundValidation, "NOT_EXECUTED");
        equal(artifacts.validation.readiness.leaderClauseSemantics, "NO-GO");
        equal(artifacts.validation.safety.automaticCleanupAttempted, false);
    });

    it("rejects duplicate, unstable, percentage and presentation-bearing records", () => {
        const states: any[] = [...dataset.states].reverse();
        states[0] = { ...states[0], name: "presentation", leader: { ...states[0].leader, structuredPercentValues: [170] } };
        states[1] = { ...states[1], stateId: states[0].stateId };
        states[2] = { ...states[2], leader: { ...states[2].leader, effects: [...states[2].leader.effects].reverse() } };
        const invalid: any = { ...dataset, states };
        const validation = validateCharacterLeaderProjection(invalid, artifacts.coverage, artifacts.validation.sizes);
        equal(validation.valid, false);
        ok(validation.failures.includes("duplicate state identity")); ok(validation.failures.includes("unstable structural order"));
        ok(validation.failures.includes("extra or presentation field included")); ok(validation.failures.includes("percent value field included"));
    });

    it("writes create-only single-link members with the fixed manifest last", async () => {
        const root = await mkdtemp(join(tmpdir(), "k46-writer-"));
        try {
            const written = await writeCharacterLeaderProjectionArtifacts(root, artifacts);
            equal(basename(written.members[written.members.length - 1].path), CHARACTER_LEADER_PROJECTION_FILES.manifest);
            equal(written.members.length, 4);
            for (const member of written.members) equal((await lstat(member.path)).nlink, 1);
            await rejects(writeCharacterLeaderProjectionArtifacts(root, artifacts), /output already exists/);
        } finally { await rm(root, { recursive: true, force: true }); }
    });

    it("rejects oversized artifact members before allocating their bytes", async () => {
        const root = await mkdtemp(join(tmpdir(), "k46-bounded-reader-"));
        try {
            await writeFile(join(root, CHARACTER_LEADER_PROJECTION_FILES.manifest), Buffer.alloc(64));
            await rejects(
                readBoundedCharacterLeaderProjectionMember(root, CHARACTER_LEADER_PROJECTION_FILES.manifest, 64),
                /byte budget or exact size rejected/,
            );
            await writeFile(join(root, "database-characters-k46-leader-projection." + "a".repeat(64) + ".json.gz"), Buffer.from("exact"));
            const exact = await readBoundedCharacterLeaderProjectionMember(
                root, "database-characters-k46-leader-projection." + "a".repeat(64) + ".json.gz", 6, 5,
            );
            equal(exact.toString("utf8"), "exact");
        } finally { await rm(root, { recursive: true, force: true }); }
    });

    it("rejects linked output roots and overlap with every source root", async function () {
        const root = await mkdtemp(join(tmpdir(), "k46-roots-"));
        const sidecar = join(root, "sidecar"), production = join(root, "production"), fyi = join(root, "fyi"), k43 = join(root, "k43");
        const output = join(root, "output"), nested = join(k43, "nested"), linked = join(root, "linked");
        await Promise.all([mkdir(sidecar), mkdir(production), mkdir(fyi), mkdir(k43), mkdir(output)]); await mkdir(nested);
        try {
            await rejects(validateCharacterLeaderProjectionRootSeparation({ sidecarRoot: sidecar, productionRoot: production, fyiRoot: fyi, k43Root: k43, outputRoot: nested }), /must not alias, contain, or descend/);
            await validateCharacterLeaderProjectionRootSeparation({ sidecarRoot: sidecar, productionRoot: production, fyiRoot: fyi, k43Root: k43, outputRoot: output });
            try { await symlink(output, linked, process.platform === "win32" ? "junction" : "dir"); }
            catch (error: any) { if (error?.code === "EPERM") return; throw error; }
            await rejects(validateCharacterLeaderProjectionOutputRoot(linked), /regular non-link directory|symlink or junction rejected/);
        } finally { await rm(root, { recursive: true, force: true }); }
    });
});
