import { deepEqual, equal, match, ok, rejects } from "assert";
import { execFileSync } from "child_process";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { resolve } from "path";
import { gzipSync } from "zlib";
import { afterEach, beforeEach, describe, it } from "mocha";
import { buildCharacterDatasetArtifact } from "./dataset-artifacts";
import {
    buildTeamAnalysisDatasetObjectKey,
    CommandResult,
    parseTeamAnalysisR2PublishArgs,
    publishTeamAnalysisR2,
    readTeamAnalysisR2PublishPlan,
    TeamAnalysisCommandRunner,
    TeamAnalysisR2PublishOptions,
    TeamAnalysisR2PublishState,
    TeamAnalysisRetainedRelease,
    TEAM_ANALYSIS_MANIFEST_CACHE_CONTROL,
    TEAM_ANALYSIS_MANIFEST_OBJECT_KEY,
    TEAM_ANALYSIS_PAYLOAD_CACHE_CONTROL,
} from "./publish-team-analysis-r2";
import { buildTeamAnalysisDataset, TeamAnalysisDataset } from "./team-analysis";
import { buildTeamAnalysisArtifact, sha256, TeamAnalysisManifest } from "./team-analysis-artifacts";

class FakeRunner implements TeamAnalysisCommandRunner {
    readonly objects = new Map<string, Buffer>();
    readonly commands: string[][] = [];
    failPutKey?: string;
    failDeleteKey?: string;
    failAllDeletes = false;
    failBucketInfo = false;
    bucketSize = "100 MB";

    async run(args: string[]): Promise<CommandResult> {
        this.commands.push([...args]);
        if (args[0] === "r2" && args[1] === "bucket" && args[2] === "info") {
            if (this.failBucketInfo) return failure("bucket info unavailable");
            return success(JSON.stringify({ name: args[3], bucket_size: this.bucketSize }));
        }
        const operation = args[2];
        const objectPath = args[3];
        const objectKey = objectPath.slice(objectPath.indexOf("/") + 1);
        if (operation === "get") {
            const value = this.objects.get(objectKey);
            if (!value) return failure("404 object not found");
            await writeFile(args[args.indexOf("--file") + 1], value);
            return success();
        }
        if (operation === "put") {
            if (this.failPutKey === objectKey) return failure(`put failed for ${objectKey}`);
            this.objects.set(objectKey, await readFile(args[args.indexOf("--file") + 1]));
            return success();
        }
        if (operation === "delete") {
            if (this.failAllDeletes || this.failDeleteKey === objectKey) return failure(`delete failed for ${objectKey}`);
            this.objects.delete(objectKey);
            return success();
        }
        return failure(`unsupported fake command: ${args.join(" ")}`);
    }
}

interface Fixture {
    root: string,
    options: TeamAnalysisR2PublishOptions,
    runner: FakeRunner,
    characterArtifact: ReturnType<typeof buildCharacterDatasetArtifact>,
    dataset: TeamAnalysisDataset,
    artifact: ReturnType<typeof buildTeamAnalysisArtifact>,
}

describe("Team Analysis R2 delivery gate", function () {
    let fixture: Fixture;

    beforeEach(async () => {
        fixture = await createFixture();
    });

    afterEach(async () => {
        await rm(fixture.root, { recursive: true, force: true });
    });

    it("accepts a valid artifact and matching character manifest", async () => {
        const plan = await readTeamAnalysisR2PublishPlan(fixture.options, fixture.runner);

        equal(plan.remoteManifest.stateCount, 1);
        equal(plan.remoteManifest.sourceCharacterPayloadSha256, fixture.characterArtifact.manifest.sha256);
        equal(plan.payloadUploadNeeded, true);
    });

    it("accepts a character whose optional catalog identity is absent", async () => {
        const state = { ...fixture.dataset.states[0] };
        delete state.baseCharacterId;
        delete state.awakeningFamilyId;
        await rewriteDataset(fixture, { ...fixture.dataset, states: [state] });

        const plan = await readTeamAnalysisR2PublishPlan(fixture.options, fixture.runner);
        equal(plan.remoteManifest.stateCount, 1);
    });

    it("rejects corrupt gzip", async () => {
        await writeFile(fixture.options.datasetPath, Buffer.from("not-gzip"));

        await rejects(() => readTeamAnalysisR2PublishPlan(fixture.options, fixture.runner), /not valid gzip/);
    });

    it("rejects a divergent payload SHA-256", async () => {
        await mutateManifest(fixture, manifest => { manifest.sha256 = "0".repeat(64); });

        await rejects(() => readTeamAnalysisR2PublishPlan(fixture.options, fixture.runner), /SHA-256 does not match/);
    });

    it("rejects a divergent payload size", async () => {
        await mutateManifest(fixture, manifest => { manifest.sizeBytes += 1; });

        await rejects(() => readTeamAnalysisR2PublishPlan(fixture.options, fixture.runner), /payload size/);
    });

    it("rejects invalid JSON after valid gzip and integrity metadata", async () => {
        const invalidJson = Buffer.from("{broken", "utf8");
        const gzip = gzipSync(invalidJson);
        await writeFile(fixture.options.datasetPath, gzip);
        await mutateManifest(fixture, manifest => {
            manifest.sha256 = sha256(gzip);
            manifest.sizeBytes = gzip.byteLength;
            manifest.uncompressedSizeBytes = invalidJson.byteLength;
        });

        await rejects(() => readTeamAnalysisR2PublishPlan(fixture.options, fixture.runner), /not valid JSON/);
    });

    it("rejects a divergent stateCount", async () => {
        await mutateManifest(fixture, manifest => { manifest.stateCount += 1; });

        await rejects(() => readTeamAnalysisR2PublishPlan(fixture.options, fixture.runner), /stateCount mismatch/);
    });

    it("rejects a source character version mismatch", async () => {
        await rewriteDataset(fixture, { ...fixture.dataset, sourceCharacterDatasetVersion: "wrong-version" });

        await rejects(() => readTeamAnalysisR2PublishPlan(fixture.options, fixture.runner), /source character version/);
    });

    it("rejects a source character SHA-256 mismatch", async () => {
        await rewriteDataset(fixture, { ...fixture.dataset, sourceCharacterPayloadSha256: "1".repeat(64) });

        await rejects(() => readTeamAnalysisR2PublishPlan(fixture.options, fixture.runner), /source character SHA-256/);
    });

    it("rejects a duplicate stateKey", async () => {
        const duplicate = { ...fixture.dataset.states[0] };
        await rewriteDataset(fixture, {
            ...fixture.dataset,
            stateCount: 2,
            states: [...fixture.dataset.states, duplicate],
        });

        await rejects(() => readTeamAnalysisR2PublishPlan(fixture.options, fixture.runner), /Duplicate Team Analysis stateKey/);
    });

    it("rejects traversal in a local manifest fileName and remote object key", async () => {
        await mutateManifest(fixture, manifest => { manifest.fileName = "../team-analysis.json.gz"; });
        await rejects(() => readTeamAnalysisR2PublishPlan(fixture.options, fixture.runner), /traversal/);

        await writeLocalArtifact(fixture);
        const remoteManifest = makeRemoteManifest(fixture.artifact.manifest);
        remoteManifest.fileName = "/team-analysis/releases/bad/team-analysis.json.gz";
        fixture.runner.objects.set(TEAM_ANALYSIS_MANIFEST_OBJECT_KEY, serialize(remoteManifest));
        await rejects(() => readTeamAnalysisR2PublishPlan(fixture.options, fixture.runner), /relative traversal-free/);
    });

    it("skips an identical remote manifest and verified immutable payload", async () => {
        installCurrentRemote(fixture);

        const plan = await readTeamAnalysisR2PublishPlan(fixture.options, fixture.runner);

        equal(plan.remoteManifestStatus, "matching");
        equal(plan.payloadUploadNeeded, false);
        equal(plan.manifestUpdateNeeded, false);
    });

    it("plans an explicit update for a different remote manifest", async () => {
        const remoteManifest = makeRemoteManifest(fixture.artifact.manifest);
        remoteManifest.parserVersion = "1.7.0";
        fixture.runner.objects.set(TEAM_ANALYSIS_MANIFEST_OBJECT_KEY, serialize(remoteManifest));
        fixture.runner.objects.set(remoteManifest.fileName, fixture.artifact.gzipBuffer);

        const plan = await readTeamAnalysisR2PublishPlan(fixture.options, fixture.runner);

        equal(plan.remoteManifestStatus, "different");
        equal(plan.manifestUpdateNeeded, true);
    });

    it("plans initial publication when the remote manifest is absent", async () => {
        const plan = await readTeamAnalysisR2PublishPlan(fixture.options, fixture.runner);

        equal(plan.remoteManifestStatus, "missing");
        equal(plan.payloadUploadNeeded, true);
        equal(plan.manifestUpdateNeeded, true);
    });

    it("handles absent local state without trusting it for completion", async () => {
        installCurrentRemote(fixture);

        const plan = await readTeamAnalysisR2PublishPlan(fixture.options, fixture.runner);

        ok(plan.warnings.some(warning => warning.includes("state is absent")));
        equal(plan.payloadUploadNeeded, false);
    });

    it("ignores an old local state schema", async () => {
        await writeFile(fixture.options.statePath, JSON.stringify({ schemaVersion: 0, retainedReleases: [] }));

        const plan = await readTeamAnalysisR2PublishPlan(fixture.options, fixture.runner);

        ok(plan.warnings.some(warning => warning.includes("old or invalid")));
    });

    it("uploads payload before promoting the manifest", async () => {
        await publishTeamAnalysisR2(fixture.options, fixture.runner, fixedClock);

        const puts = putKeys(fixture.runner);
        deepEqual(puts, [buildTeamAnalysisDatasetObjectKey(fixture.artifact.manifest), TEAM_ANALYSIS_MANIFEST_OBJECT_KEY]);
    });

    it("does not promote the manifest or write state after payload failure", async () => {
        fixture.runner.failPutKey = buildTeamAnalysisDatasetObjectKey(fixture.artifact.manifest);

        await rejects(() => publishTeamAnalysisR2(fixture.options, fixture.runner, fixedClock), /put failed/);
        equal(fixture.runner.objects.has(TEAM_ANALYSIS_MANIFEST_OBJECT_KEY), false);
        equal(await fileExists(fixture.options.statePath), false);
    });

    it("does not update state or clean releases after manifest failure", async () => {
        const old = installPreviousRemote(fixture, "characters-v0:parser-1.7.1", "old-one");
        fixture.runner.failPutKey = TEAM_ANALYSIS_MANIFEST_OBJECT_KEY;

        await rejects(() => publishTeamAnalysisR2(fixture.options, fixture.runner, fixedClock), /put failed/);
        equal(await fileExists(fixture.options.statePath), false);
        equal(fixture.runner.objects.has(old.datasetObjectKey), true);
        equal(fixture.runner.commands.some(args => args[2] === "delete"), false);
    });

    it("keeps the new publication valid when old-release cleanup fails", async () => {
        const previous = installPreviousRemote(fixture, "characters-v0:parser-1.7.1", "previous");
        const stale = makeRelease(fixture, "characters-v-1:parser-1.7.1", "stale");
        fixture.runner.objects.set(stale.datasetObjectKey, stale.buffer);
        await writeState(fixture, [previous, stale.release]);
        fixture.runner.failDeleteKey = stale.datasetObjectKey;

        const summary = await publishTeamAnalysisR2(fixture.options, fixture.runner, fixedClock);
        const published = JSON.parse(fixture.runner.objects.get(TEAM_ANALYSIS_MANIFEST_OBJECT_KEY)!.toString("utf8"));
        const state = JSON.parse(await readFile(fixture.options.statePath, "utf8")) as TeamAnalysisR2PublishState;

        equal(published.fileName, buildTeamAnalysisDatasetObjectKey(fixture.artifact.manifest));
        equal(summary.cleanupFailures.length, 1);
        deepEqual(state.cleanupPendingReleases?.map(release => release.datasetObjectKey), [stale.datasetObjectKey]);
    });

    it("retains the immediately previous verified release", async () => {
        const previous = installPreviousRemote(fixture, "characters-v0:parser-1.7.1", "previous");

        const plan = await readTeamAnalysisR2PublishPlan(fixture.options, fixture.runner);

        deepEqual(plan.retainedReleases.map(release => release.datasetObjectKey), [
            buildTeamAnalysisDatasetObjectKey(fixture.artifact.manifest),
            previous.datasetObjectKey,
        ]);
        equal(plan.cleanupCandidates.length, 0);
    });

    it("limits retention to two releases and cleans only verified older tracked versions", async () => {
        const previous = installPreviousRemote(fixture, "characters-v0:parser-1.7.1", "previous");
        const staleOne = makeRelease(fixture, "characters-v-1:parser-1.7.1", "stale-one");
        const staleTwo = makeRelease(fixture, "characters-v-2:parser-1.7.1", "stale-two");
        [staleOne, staleTwo].forEach(entry => fixture.runner.objects.set(entry.datasetObjectKey, entry.buffer));
        await writeState(fixture, [previous, staleOne.release, staleTwo.release]);

        const plan = await readTeamAnalysisR2PublishPlan(fixture.options, fixture.runner);

        equal(plan.retainedReleases.length, 2);
        deepEqual(plan.cleanupCandidates.map(release => release.datasetObjectKey).sort(), [
            staleOne.datasetObjectKey,
            staleTwo.datasetObjectKey,
        ].sort());
        ok(!plan.cleanupCandidates.some(release => release.datasetObjectKey === previous.datasetObjectKey));

        await publishTeamAnalysisR2(fixture.options, fixture.runner, fixedClock);
        equal(fixture.runner.objects.has(previous.datasetObjectKey), true);
        equal(fixture.runner.objects.has(staleOne.datasetObjectKey), false);
        equal(fixture.runner.objects.has(staleTwo.datasetObjectKey), false);
        const state = JSON.parse(await readFile(fixture.options.statePath, "utf8")) as TeamAnalysisR2PublishState;
        equal(state.cleanupPendingReleases, undefined);
    });

    it("fails before writes when the namespace budget is exceeded", async () => {
        fixture.options.maxNamespaceBytes = 1;

        await rejects(() => publishTeamAnalysisR2(fixture.options, fixture.runner, fixedClock), /exceeds namespace limit/);
        equal(fixture.runner.commands.some(args => args[2] === "put" || args[2] === "delete"), false);
    });

    it("fails closed before remote writes when global bucket size is unavailable", async () => {
        fixture.runner.failBucketInfo = true;

        await rejects(() => publishTeamAnalysisR2(fixture.options, fixture.runner, fixedClock), /Refusing remote writes/);
        equal(fixture.runner.commands.some(args => args[2] === "put" || args[2] === "delete"), false);

        fixture.options.dryRun = true;
        const dryRunPlan = await readTeamAnalysisR2PublishPlan(fixture.options, fixture.runner);
        equal(dryRunPlan.bucketTotalVisibility, "unavailable");
    });

    it("performs no writes in dry-run", async () => {
        fixture.options.dryRun = true;

        await publishTeamAnalysisR2(fixture.options, fixture.runner, fixedClock);

        equal(fixture.runner.commands.some(args => args[2] === "put" || args[2] === "delete"), false);
        equal(await fileExists(fixture.options.statePath), false);
        deepEqual(await readFile(fixture.options.datasetPath), fixture.artifact.gzipBuffer);
    });

    it("passes explicit --remote and --local flags to every object operation", async () => {
        fixture.options.dryRun = true;
        await publishTeamAnalysisR2(fixture.options, fixture.runner, fixedClock);
        ok(fixture.runner.commands.filter(args => args[1] === "object").every(args => args.includes("--remote")));

        const localFixture = await createFixture(["--local"]);
        try {
            localFixture.options.dryRun = true;
            await publishTeamAnalysisR2(localFixture.options, localFixture.runner, fixedClock);
            ok(localFixture.runner.commands.filter(args => args[1] === "object").every(args => args.includes("--local")));
        } finally {
            await rm(localFixture.root, { recursive: true, force: true });
        }
    });

    it("uses immutable gzip metadata for payload and no-store JSON metadata for manifest", async () => {
        await publishTeamAnalysisR2(fixture.options, fixture.runner, fixedClock);
        const puts = fixture.runner.commands.filter(args => args[2] === "put");
        const payloadPut = puts.find(args => args[3].endsWith("/team-analysis.json.gz"))!;
        const manifestPut = puts.find(args => args[3].endsWith(`/${TEAM_ANALYSIS_MANIFEST_OBJECT_KEY}`))!;

        equal(payloadPut[payloadPut.indexOf("--content-type") + 1], "application/gzip");
        equal(payloadPut[payloadPut.indexOf("--cache-control") + 1], TEAM_ANALYSIS_PAYLOAD_CACHE_CONTROL);
        equal(manifestPut[manifestPut.indexOf("--content-type") + 1], "application/json");
        equal(manifestPut[manifestPut.indexOf("--cache-control") + 1], TEAM_ANALYSIS_MANIFEST_CACHE_CONTROL);
    });

    it("is idempotent after a successful publish", async () => {
        await publishTeamAnalysisR2(fixture.options, fixture.runner, fixedClock);
        fixture.runner.commands.length = 0;

        const summary = await publishTeamAnalysisR2(fixture.options, fixture.runner, fixedClock);

        equal(summary.plan.payloadUploadNeeded, false);
        equal(summary.plan.manifestUpdateNeeded, false);
        equal(summary.plan.stateUpdateNeeded, false);
        equal(fixture.runner.commands.some(args => args[2] === "put" || args[2] === "delete"), false);
    });

    it("records the SHA-256 of unchanged remote manifest bytes", async () => {
        const manifest = makeRemoteManifest(fixture.artifact.manifest);
        const minifiedManifest = Buffer.from(JSON.stringify(manifest), "utf8");
        fixture.runner.objects.set(manifest.fileName, fixture.artifact.gzipBuffer);
        fixture.runner.objects.set(TEAM_ANALYSIS_MANIFEST_OBJECT_KEY, minifiedManifest);

        const summary = await publishTeamAnalysisR2(fixture.options, fixture.runner, fixedClock);
        const state = JSON.parse(await readFile(fixture.options.statePath, "utf8")) as TeamAnalysisR2PublishState;

        equal(summary.plan.manifestUpdateNeeded, false);
        equal(state.manifestSha256, sha256(minifiedManifest));
    });

    it("does not orphan a bounded 20-release state when the remote manifest is different", async () => {
        const tracked: TeamAnalysisRetainedRelease[] = [];
        for (let index = 0; index < 20; index += 1) {
            const entry = makeRelease(fixture, `tracked-${String(index).padStart(2, "0")}`, `tracked-${index}`);
            tracked.push(entry.release);
            fixture.runner.objects.set(entry.datasetObjectKey, entry.buffer);
        }
        await writeState(fixture, tracked);
        const remote = installPreviousRemote(fixture, "remote-active", "remote-active");

        const plan = await readTeamAnalysisR2PublishPlan(fixture.options, fixture.runner);

        equal(plan.retainedReleases.length, 2);
        equal(plan.retainedReleases[1].datasetObjectKey, remote.datasetObjectKey);
        equal(plan.cleanupCandidates.length, 20);
        ok(tracked.every(release => plan.cleanupCandidates.some(candidate => candidate.datasetObjectKey === release.datasetObjectKey)));

        fixture.runner.failAllDeletes = true;
        const summary = await publishTeamAnalysisR2(fixture.options, fixture.runner, fixedClock);
        equal(summary.cleanupFailures.length, 20);
        const persisted = JSON.parse(await readFile(fixture.options.statePath, "utf8")) as TeamAnalysisR2PublishState;
        equal(persisted.retainedReleases.length + (persisted.cleanupPendingReleases?.length ?? 0), 22);

        const retryPlan = await readTeamAnalysisR2PublishPlan(fixture.options, fixture.runner);
        equal(retryPlan.cleanupCandidates.length, 20);
        ok(!retryPlan.warnings.some(warning => warning.includes("old or invalid")));
    });

    it("produces a deterministic plan from the same local and remote facts", async () => {
        installCurrentRemote(fixture);
        const first = await readTeamAnalysisR2PublishPlan(fixture.options, fixture.runner);
        const second = await readTeamAnalysisR2PublishPlan(fixture.options, fixture.runner);

        deepEqual(planSnapshot(first), planSnapshot(second));
    });

    it("keeps generated data outside version control", () => {
        const trackedData = execFileSync("git", ["ls-files", "data"], { encoding: "utf8" }).trim();
        equal(trackedData, "");
    });

    it("uses conservative defaults and rejects conflicting targets or unsafe flags", () => {
        const defaults = parseTeamAnalysisR2PublishArgs([]);
        equal(defaults.bucket, "dokkanpanion-data");
        equal(defaults.target, "remote");
        equal(defaults.maxTotalBytes, 10_000_000_000);
        equal(defaults.maxNamespaceBytes, 50_000_000);
        equal(defaults.skipRemoteManifestCheck, false);
        equal(defaults.skipUploadVerification, false);
        equal(defaults.allowUnknownBucketSize, false);
        const recovery = parseTeamAnalysisR2PublishArgs([
            "--skip-remote-manifest-check",
            "--skip-upload-verification",
            "--allow-unknown-bucket-size",
        ]);
        equal(recovery.skipRemoteManifestCheck, true);
        equal(recovery.skipUploadVerification, true);
        equal(recovery.allowUnknownBucketSize, true);
        rejects(async () => parseTeamAnalysisR2PublishArgs(["--remote", "--local"]), /Choose only one/);
        rejects(async () => parseTeamAnalysisR2PublishArgs(["--unknown"]), /Unknown option/);
        rejects(async () => parseTeamAnalysisR2PublishArgs([
            "--dataset", "same.json.gz", "--state", "same.json.gz",
        ]), /must be distinct/);
    });
});

async function createFixture(extraArgs: string[] = []): Promise<Fixture> {
    const root = await mkdtemp(resolve(tmpdir(), "dokkan-team-analysis-test-"));
    const characterDatasetPath = resolve(root, "characters.json.gz");
    const characterManifestPath = resolve(root, "characters-manifest.json");
    const datasetPath = resolve(root, "team-analysis.json.gz");
    const manifestPath = resolve(root, "team-analysis-manifest.json");
    const statePath = resolve(root, "publish-state.json");
    const characters = [{ id: "100", name: "Test Character", passive: "" }] as any;
    const generatedAt = "2026-08-04T00:00:00.000Z";
    const characterArtifact = buildCharacterDatasetArtifact(characters, {
        datasetVersion: "characters-v1",
        generatedAt,
    });
    const dataset = buildTeamAnalysisDataset(characters, [{
        id: "100",
        baseCharacterId: "10",
        name: "Test Character",
        hasEza: false,
        hasSeza: false,
        isReversiblyExchanged: false,
        isFreelyObtainable: false,
        isStageDropReward: false,
        isWorldTournamentReward: false,
        hasBattleMotion: false,
        sourceUrl: "https://example.test/100",
    }], {
        generatedAt,
        sourceCharacterDatasetVersion: characterArtifact.manifest.datasetVersion,
        sourceCharacterPayloadSha256: characterArtifact.manifest.sha256,
    });
    const artifact = buildTeamAnalysisArtifact(dataset);
    const args = [
        "--dataset", datasetPath,
        "--manifest", manifestPath,
        "--characters", characterDatasetPath,
        "--character-manifest", characterManifestPath,
        "--state", statePath,
        ...extraArgs,
    ];
    const fixture: Fixture = {
        root,
        options: parseTeamAnalysisR2PublishArgs(args),
        runner: new FakeRunner(),
        characterArtifact,
        dataset,
        artifact,
    };
    await writeFile(characterDatasetPath, characterArtifact.gzipBuffer);
    await writeFile(characterManifestPath, serialize(characterArtifact.manifest));
    await writeLocalArtifact(fixture);
    return fixture;
}

async function writeLocalArtifact(fixture: Fixture): Promise<void> {
    await writeFile(fixture.options.datasetPath, fixture.artifact.gzipBuffer);
    await writeFile(fixture.options.manifestPath, serialize(fixture.artifact.manifest));
}

async function rewriteDataset(fixture: Fixture, dataset: TeamAnalysisDataset): Promise<void> {
    fixture.dataset = dataset;
    fixture.artifact = buildTeamAnalysisArtifact(dataset, { datasetVersion: fixture.artifact.manifest.datasetVersion });
    await writeLocalArtifact(fixture);
}

async function mutateManifest(fixture: Fixture, mutate: (manifest: TeamAnalysisManifest) => void): Promise<void> {
    const manifest = { ...fixture.artifact.manifest };
    mutate(manifest);
    await writeFile(fixture.options.manifestPath, serialize(manifest));
}

function makeRemoteManifest(local: TeamAnalysisManifest): TeamAnalysisManifest {
    const manifest = { ...local };
    manifest.fileName = buildTeamAnalysisDatasetObjectKey(manifest);
    return manifest;
}

function installCurrentRemote(fixture: Fixture): void {
    const manifest = makeRemoteManifest(fixture.artifact.manifest);
    fixture.runner.objects.set(manifest.fileName, fixture.artifact.gzipBuffer);
    fixture.runner.objects.set(TEAM_ANALYSIS_MANIFEST_OBJECT_KEY, serialize(manifest));
}

function installPreviousRemote(fixture: Fixture, version: string, content: string): TeamAnalysisRetainedRelease {
    const previous = makeRelease(fixture, version, content);
    const manifest: TeamAnalysisManifest = {
        ...fixture.artifact.manifest,
        datasetVersion: version,
        generatedAt: "2026-08-03T00:00:00.000Z",
        sha256: previous.release.payloadSha256,
        sizeBytes: previous.release.sizeBytes,
        fileName: previous.release.datasetObjectKey,
    };
    fixture.runner.objects.set(previous.datasetObjectKey, previous.buffer);
    fixture.runner.objects.set(TEAM_ANALYSIS_MANIFEST_OBJECT_KEY, serialize(manifest));
    return previous.release;
}

function makeRelease(fixture: Fixture, version: string, content: string): {
    release: TeamAnalysisRetainedRelease,
    datasetObjectKey: string,
    buffer: Buffer,
} {
    const buffer = Buffer.from(content, "utf8");
    const manifest = {
        ...fixture.artifact.manifest,
        datasetVersion: version,
        sha256: sha256(buffer),
        sizeBytes: buffer.byteLength,
    };
    const datasetObjectKey = buildTeamAnalysisDatasetObjectKey(manifest);
    return {
        buffer,
        datasetObjectKey,
        release: {
            datasetVersion: version,
            datasetObjectKey,
            payloadSha256: manifest.sha256,
            sizeBytes: buffer.byteLength,
            publishedAt: version.includes("v-2")
                ? "2026-08-01T00:00:00.000Z"
                : version.includes("v-1")
                    ? "2026-08-02T00:00:00.000Z"
                    : "2026-08-03T00:00:00.000Z",
        },
    };
}

async function writeState(fixture: Fixture, releases: TeamAnalysisRetainedRelease[]): Promise<void> {
    const current = releases[0];
    const state: TeamAnalysisR2PublishState = {
        schemaVersion: 1,
        bucket: fixture.options.bucket,
        target: fixture.options.target,
        datasetVersion: current.datasetVersion,
        datasetObjectKey: current.datasetObjectKey,
        payloadSha256: current.payloadSha256,
        manifestSha256: "0".repeat(64),
        publishedAt: current.publishedAt ?? "2026-08-03T00:00:00.000Z",
        retainedReleases: releases,
    };
    await writeFile(fixture.options.statePath, serialize(state));
}

function serialize(value: unknown): Buffer {
    return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function success(stdout = ""): CommandResult {
    return { exitCode: 0, stdout, stderr: "" };
}

function failure(stderr: string): CommandResult {
    return { exitCode: 1, stdout: "", stderr };
}

function fixedClock(): Date {
    return new Date("2026-08-04T12:00:00.000Z");
}

function putKeys(runner: FakeRunner): string[] {
    return runner.commands
        .filter(args => args[2] === "put")
        .map(args => args[3].slice(args[3].indexOf("/") + 1));
}

async function fileExists(filePath: string): Promise<boolean> {
    try {
        await readFile(filePath);
        return true;
    } catch {
        return false;
    }
}

function planSnapshot(plan: Awaited<ReturnType<typeof readTeamAnalysisR2PublishPlan>>): unknown {
    return {
        remoteManifest: plan.remoteManifest,
        datasetObjectKey: plan.datasetObjectKey,
        payloadUploadNeeded: plan.payloadUploadNeeded,
        manifestUpdateNeeded: plan.manifestUpdateNeeded,
        retainedReleases: plan.retainedReleases,
        cleanupCandidates: plan.cleanupCandidates,
        bytesNew: plan.bytesNew,
        bytesRetained: plan.bytesRetained,
        bytesRemovable: plan.bytesRemovable,
        knownManagedBytesBeforeCleanup: plan.knownManagedBytesBeforeCleanup,
        projectedManagedBytes: plan.projectedManagedBytes,
        plannedActions: plan.plannedActions,
    };
}
