import { deepStrictEqual, equal, ok, rejects, throws } from "assert";
import { createHash } from "crypto";
import { link, mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import {
    CHARACTER_LEADER_SCOPE_EXCLUDED_STATE_IDS,
    CHARACTER_LEADER_SCOPE_PIN,
    CHARACTER_LEADER_SCOPE_REPORT_LIMIT_BYTES,
    CharacterLeaderScopeEvaluation,
    CharacterLeaderScopeK3Identity,
    CharacterLeaderScopeK3State,
    CharacterLeaderScopeK43Identity,
    CharacterLeaderScopeK43State,
} from "./leader-scope-contract";
import {
    assertK3LeaderScopeSourceStable,
    assertK43LeaderScopeSourceStable,
    assertPinnedLeaderScopeMemberIdentity,
    compactK3LeaderStatesForAudit,
    readPinnedLeaderScopeMember,
} from "./leader-scope-source";
import {
    assertPinnedCharacterLeaderScope,
    buildCharacterLeaderScopeReport,
    evaluateCharacterLeaderStructuralScope,
} from "./leader-scope";
import { parseCharacterLeaderScopeCli, runCharacterLeaderScopeAudit } from "./leader-scope-run";

const ref = (rowId: string) => ({ table: "leader_skills", rowId });

function k43State(stateId = "card-state:1:initial"): CharacterLeaderScopeK43State {
    return { stateId, sourceStateKey: `source:${stateId}`, cardId: "1", releaseState: "initial" };
}

function k3State(
    stateId = "card-state:1:initial",
    releaseState: CharacterLeaderScopeK3State["releaseState"] = "initial",
): CharacterLeaderScopeK3State {
    return {
        stateId,
        sourceStateKey: `source:${stateId}`,
        cardId: stateId.startsWith("card-state:1010900:") ? "1010900" : "1",
        releaseState,
        leader: { set: ref(`set:${stateId}`), effects: [], targets: [], structuredPercentValues: [] },
    };
}

function joinedSources(): { k43: CharacterLeaderScopeK43State[]; k3: CharacterLeaderScopeK3State[] } {
    return {
        k43: [k43State()],
        k3: [
            k3State(),
            ...CHARACTER_LEADER_SCOPE_EXCLUDED_STATE_IDS.map(stateId => k3State(stateId, "unknown")),
        ],
    };
}

function pinnedEvaluation(): CharacterLeaderScopeEvaluation {
    return {
        includedStates: CHARACTER_LEADER_SCOPE_PIN.includedStates,
        excludedStates: CHARACTER_LEADER_SCOPE_PIN.excludedStates,
        excludedStateIds: [...CHARACTER_LEADER_SCOPE_EXCLUDED_STATE_IDS],
        uniqueLeaderSetRows: CHARACTER_LEADER_SCOPE_PIN.uniqueLeaderSetRows,
        effectReferences: CHARACTER_LEADER_SCOPE_PIN.effectReferences,
        targetReferences: CHARACTER_LEADER_SCOPE_PIN.targetReferences,
        structuredPercentValues: CHARACTER_LEADER_SCOPE_PIN.structuredPercentValues,
        multiEffectStates: CHARACTER_LEADER_SCOPE_PIN.multiEffectStates,
        multiTargetStates: CHARACTER_LEADER_SCOPE_PIN.multiTargetStates,
        multiPercentStates: CHARACTER_LEADER_SCOPE_PIN.multiPercentStates,
        maximumEffectsPerState: CHARACTER_LEADER_SCOPE_PIN.maximumEffectsPerState,
        maximumTargetsPerState: CHARACTER_LEADER_SCOPE_PIN.maximumTargetsPerState,
        maximumPercentValuesPerState: CHARACTER_LEADER_SCOPE_PIN.maximumPercentValuesPerState,
        emptyEffectStates: CHARACTER_LEADER_SCOPE_PIN.emptyEffectStates,
        emptyTargetStates: CHARACTER_LEADER_SCOPE_PIN.emptyTargetStates,
        emptyPercentStates: CHARACTER_LEADER_SCOPE_PIN.emptyPercentStates,
        samples: {
            multiEffectStateIds: ["card-state:1:initial"], multiTargetStateIds: [], multiPercentStateIds: [],
            maximumEffectStateIds: [], maximumTargetStateIds: [], maximumPercentStateIds: [], limitPerKind: 5,
        },
    };
}

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

describe("database character K45 leader structural scope", () => {
    it("fails closed unless the exact opt-in and all explicit roots are supplied", async () => {
        await rejects(runCharacterLeaderScopeAudit({} as any), /explicit opt-in/);
        throws(() => parseCharacterLeaderScopeCli([]), /exactly one --opt-in-k45/);
        throws(() => parseCharacterLeaderScopeCli(["--opt-in-k45"]), /--sidecar-root/);
        throws(() => parseCharacterLeaderScopeCli([
            "--opt-in-k45", "--sidecar-root", "s", "--production-root", "p", "--fyi-root", "f", "--k43-root", "k", "--output-root", "o",
        ]), /unsupported argument/);
        throws(() => parseCharacterLeaderScopeCli([
            "--opt-in-k45", "--sidecar-root", "s", "--sidecar-root", "s", "--production-root", "p", "--fyi-root", "f", "--k43-root", "k",
        ]), /duplicate --sidecar-root/);
        deepStrictEqual(parseCharacterLeaderScopeCli([
            "--opt-in-k45", "--sidecar-root", "s", "--production-root", "p", "--fyi-root", "f", "--k43-root", "k",
        ]), { optIn: true, sidecarRoot: "s", productionRoot: "p", fyiRoot: "f", k43Root: "k" });
        const savedGc = (global as any).gc;
        try {
            (global as any).gc = undefined;
            await rejects(runCharacterLeaderScopeAudit({ optIn: true, sidecarRoot: "s", productionRoot: "p", fyiRoot: "f", k43Root: "k" }), /--expose-gc/);
        } finally { (global as any).gc = savedGc; }
    });

    it("joins structural identities exactly and excludes only the three pinned unknown K3 states", () => {
        const source = joinedSources();
        source.k3[0].leader.effects = [ref("effect:1"), ref("effect:2")];
        source.k3[0].leader.targets = [ref("target:1"), ref("target:2")];
        source.k3[0].leader.structuredPercentValues = [100, 170];
        const scope = evaluateCharacterLeaderStructuralScope(source.k43, source.k3);
        deepStrictEqual(scope.excludedStateIds, [...CHARACTER_LEADER_SCOPE_EXCLUDED_STATE_IDS]);
        equal(scope.includedStates, 1); equal(scope.excludedStates, 3); equal(scope.uniqueLeaderSetRows, 1);
        equal(scope.effectReferences, 2); equal(scope.targetReferences, 2); equal(scope.structuredPercentValues, 2);
        equal(scope.multiEffectStates, 1); equal(scope.multiTargetStates, 1); equal(scope.multiPercentStates, 1);
        equal(scope.maximumEffectsPerState, 2); equal(scope.maximumTargetsPerState, 2); equal(scope.maximumPercentValuesPerState, 2);
    });

    it("refuses join drift, unexpected extras, and presentation-bearing compact inputs", () => {
        let source = joinedSources();
        source.k3[0].sourceStateKey = "changed";
        throws(() => evaluateCharacterLeaderStructuralScope(source.k43, source.k3), /exact state join mismatch/);
        source = joinedSources();
        source.k3.push(k3State("card-state:2:initial"));
        throws(() => evaluateCharacterLeaderStructuralScope(source.k43, source.k3), /exclusion frontier changed/);
        source = joinedSources();
        (source.k3[0] as any).name = "presentation";
        throws(() => evaluateCharacterLeaderStructuralScope(source.k43, source.k3), /presentation-bearing/);
    });

    it("pins every production aggregate and the exact exclusions", () => {
        const evaluation = pinnedEvaluation();
        assertPinnedCharacterLeaderScope(evaluation);
        throws(() => assertPinnedCharacterLeaderScope({ ...evaluation, effectReferences: evaluation.effectReferences + 1 }), /effect references pin changed/);
        throws(() => assertPinnedCharacterLeaderScope({ ...evaluation, excludedStateIds: ["unexpected"] }), /excluded state IDs changed/);
        const tooManySamples = { ...evaluation, samples: { ...evaluation.samples, multiEffectStateIds: ["1", "2", "3", "4", "5", "6"] } };
        throws(() => assertPinnedCharacterLeaderScope(tooManySamples), /sample bound exceeded/);
    });

    it("builds a deterministic timestamp-free bounded report with passive K9 boundary only", () => {
        const first = buildCharacterLeaderScopeReport(k43Identity(), k3Identity(), pinnedEvaluation());
        const second = buildCharacterLeaderScopeReport(k43Identity(), k3Identity(), pinnedEvaluation());
        const encoded = `${JSON.stringify(first, null, 2)}\n`;
        deepStrictEqual(first, second);
        ok(Buffer.byteLength(encoded) < CHARACTER_LEADER_SCOPE_REPORT_LIMIT_BYTES);
        ok(!encoded.includes("generatedAt")); ok(!encoded.includes('"rawRows":')); ok(!encoded.includes('"presentation":'));
        equal(first.passiveComparisonBoundary.c3UnknownRuleCount, 59);
        equal(first.passiveComparisonBoundary.usedToFilterLeaderScope, false);
        equal(first.passiveComparisonBoundary.k9ReadinessChanged, false);
        equal(first.inputIntegrity.k43SourceBoundBefore, "NOT_EXECUTED");
        equal(first.inputIntegrity.k3ExactPinnedFilesBeforeAndAfter, false);
        equal(first.readiness.structuralScope, "NOT_EXECUTED"); equal(first.readiness.nextStructuralIdOnlyProjection, "NOT_EXECUTED");
        equal(first.readiness.leaderClauseOrVsSumSemantics, "NO-GO"); equal(first.readiness.consumer, "NO-GO");
    });

    it("compacts raw K3 state records to cloned structural leader references without a GO bypass", () => {
        const raw: any = {
            stateId: "card-state:1:initial", sourceStateKey: "source:card-state:1:initial", cardId: "1", releaseState: "initial",
            leaderSkill: { set: ref("set:1"), effects: [ref("effect:1")], targetRows: [ref("target:1")], structuredPercentValues: [170] },
            passiveSkill: { localizedText: "must not survive" }, presentation: "must not survive",
        };
        const compact = compactK3LeaderStatesForAudit([raw]);
        deepStrictEqual(compact, [{
            stateId: raw.stateId, sourceStateKey: raw.sourceStateKey, cardId: "1", releaseState: "initial",
            leader: { set: ref("set:1"), effects: [ref("effect:1")], targets: [ref("target:1")], structuredPercentValues: [170] },
        }]);
        raw.leaderSkill.effects[0].rowId = "mutated";
        raw.leaderSkill.structuredPercentValues[0] = 0;
        equal(compact[0].leader.effects[0].rowId, "effect:1"); equal(compact[0].leader.structuredPercentValues[0], 170);
        const encoded = JSON.stringify(compact);
        ok(!encoded.includes("localizedText")); ok(!encoded.includes("presentation")); ok(!encoded.includes("rawRows")); ok(!encoded.includes("GO"));
        throws(() => compactK3LeaderStatesForAudit([{ ...raw, leaderSkill: undefined }]), /malformed K3 leader state/);
        throws(() => compactK3LeaderStatesForAudit([raw, raw]), /duplicate K3 stateId/);
    });

    it("detects K3 and K43 identity or compact-fingerprint drift", () => {
        assertK3LeaderScopeSourceStable(k3Identity(), k3Identity());
        assertK43LeaderScopeSourceStable(k43Identity(), k43Identity());
        throws(() => assertK3LeaderScopeSourceStable(k3Identity(), { ...k3Identity(), compactFingerprintSha256: "c".repeat(64) }), /changed after audit/);
        throws(() => assertK43LeaderScopeSourceStable(k43Identity(), { ...k43Identity(), stateFingerprintSha256: "d".repeat(64) }), /changed after audit/);
    });

    it("bounds pinned member reads and rejects hard links or identity replacement", async () => {
        const root = await mkdtemp(join(tmpdir(), "k45-pinned-member-"));
        const member = join(root, "member.json");
        const hardlink = join(root, "hardlink.json");
        const bytes = Buffer.from("pinned-member");
        const expected = { sizeBytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
        try {
            await writeFile(member, Buffer.concat([bytes, Buffer.from("oversized")]));
            await rejects(readPinnedLeaderScopeMember(member, expected, "fixture"), /member identity rejected/);
            await writeFile(member, bytes);
            deepStrictEqual(await readPinnedLeaderScopeMember(member, expected, "fixture"), bytes);
            await link(member, hardlink);
            await rejects(readPinnedLeaderScopeMember(member, expected, "fixture"), /member identity rejected/);
            const stat = (dev: number, ino: number) => ({ dev, ino, size: bytes.length, nlink: 1, isFile: () => true, isSymbolicLink: () => false });
            throws(() => assertPinnedLeaderScopeMemberIdentity(stat(1, 1), stat(1, 1), stat(1, 2), bytes.length, "fixture"), /member identity rejected/);
        } finally { await rm(root, { recursive: true, force: true }); }
    });
});
