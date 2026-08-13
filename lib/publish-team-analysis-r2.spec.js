"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const child_process_1 = require("child_process");
const promises_1 = require("fs/promises");
const os_1 = require("os");
const path_1 = require("path");
const zlib_1 = require("zlib");
const mocha_1 = require("mocha");
const dataset_artifacts_1 = require("./dataset-artifacts");
const publish_team_analysis_r2_1 = require("./publish-team-analysis-r2");
const team_analysis_1 = require("./team-analysis");
const team_analysis_artifacts_1 = require("./team-analysis-artifacts");
class FakeRunner {
    objects = new Map();
    commands = [];
    failPutKey;
    ignorePutKey;
    failDeleteKey;
    failAllDeletes = false;
    failBucketInfo = false;
    bucketSize = "100 MB";
    async run(args) {
        this.commands.push([...args]);
        if (args[0] === "r2" && args[1] === "bucket" && args[2] === "info") {
            if (this.failBucketInfo)
                return failure("bucket info unavailable");
            return success(JSON.stringify({ name: args[3], bucket_size: this.bucketSize }));
        }
        const operation = args[2];
        const objectPath = args[3];
        const objectKey = objectPath.slice(objectPath.indexOf("/") + 1);
        if (operation === "get") {
            const value = this.objects.get(objectKey);
            if (!value)
                return failure("404 object not found");
            await (0, promises_1.writeFile)(args[args.indexOf("--file") + 1], value);
            return success();
        }
        if (operation === "put") {
            if (this.failPutKey === objectKey)
                return failure(`put failed for ${objectKey}`);
            if (this.ignorePutKey === objectKey)
                return success();
            this.objects.set(objectKey, await (0, promises_1.readFile)(args[args.indexOf("--file") + 1]));
            return success();
        }
        if (operation === "delete") {
            if (this.failAllDeletes || this.failDeleteKey === objectKey)
                return failure(`delete failed for ${objectKey}`);
            this.objects.delete(objectKey);
            return success();
        }
        return failure(`unsupported fake command: ${args.join(" ")}`);
    }
}
(0, mocha_1.describe)("Team Analysis R2 delivery gate", function () {
    let fixture;
    (0, mocha_1.beforeEach)(async () => {
        fixture = await createFixture();
    });
    (0, mocha_1.afterEach)(async () => {
        await (0, promises_1.rm)(fixture.root, { recursive: true, force: true });
    });
    (0, mocha_1.it)("accepts a valid artifact and matching character manifest", async () => {
        const plan = await (0, publish_team_analysis_r2_1.readTeamAnalysisR2PublishPlan)(fixture.options, fixture.runner);
        (0, assert_1.equal)(plan.remoteManifest.stateCount, 1);
        (0, assert_1.equal)(plan.remoteManifest.sourceCharacterPayloadSha256, fixture.characterArtifact.manifest.sha256);
        (0, assert_1.equal)(plan.payloadUploadNeeded, true);
    });
    (0, mocha_1.it)("accepts the exact content-addressed fileName used by the public Characters manifest", async () => {
        await mutateCharacterManifest(fixture, manifest => {
            const versionSlug = manifest.datasetVersion.replace(/:/g, "-");
            manifest.fileName = `releases/${versionSlug}/${manifest.sha256}/characters.json.gz`;
        });
        const plan = await (0, publish_team_analysis_r2_1.readTeamAnalysisR2PublishPlan)(fixture.options, fixture.runner);
        (0, assert_1.equal)(plan.remoteManifest.sourceCharacterPayloadSha256, fixture.characterArtifact.manifest.sha256);
    });
    (0, mocha_1.it)("rejects unsafe or non-content-addressed Characters manifest keys", async () => {
        await mutateCharacterManifest(fixture, manifest => {
            manifest.fileName = "releases/../characters.json.gz";
        });
        await (0, assert_1.rejects)(() => (0, publish_team_analysis_r2_1.readTeamAnalysisR2PublishPlan)(fixture.options, fixture.runner), /traversal-free/);
        await mutateCharacterManifest(fixture, manifest => {
            manifest.fileName = `releases/characters-v1/${"0".repeat(64)}/characters.json.gz`;
        });
        await (0, assert_1.rejects)(() => (0, publish_team_analysis_r2_1.readTeamAnalysisR2PublishPlan)(fixture.options, fixture.runner), /Unexpected character manifest fileName/);
    });
    (0, mocha_1.it)("accepts a character whose optional catalog identity is absent", async () => {
        const state = { ...fixture.dataset.states[0] };
        delete state.baseCharacterId;
        delete state.awakeningFamilyId;
        await rewriteDataset(fixture, { ...fixture.dataset, states: [state] });
        const plan = await (0, publish_team_analysis_r2_1.readTeamAnalysisR2PublishPlan)(fixture.options, fixture.runner);
        (0, assert_1.equal)(plan.remoteManifest.stateCount, 1);
    });
    (0, mocha_1.it)("rejects corrupt gzip", async () => {
        await (0, promises_1.writeFile)(fixture.options.datasetPath, Buffer.from("not-gzip"));
        await (0, assert_1.rejects)(() => (0, publish_team_analysis_r2_1.readTeamAnalysisR2PublishPlan)(fixture.options, fixture.runner), /not valid gzip/);
    });
    (0, mocha_1.it)("rejects a divergent payload SHA-256", async () => {
        await mutateManifest(fixture, manifest => { manifest.sha256 = "0".repeat(64); });
        await (0, assert_1.rejects)(() => (0, publish_team_analysis_r2_1.readTeamAnalysisR2PublishPlan)(fixture.options, fixture.runner), /SHA-256 does not match/);
    });
    (0, mocha_1.it)("rejects a divergent payload size", async () => {
        await mutateManifest(fixture, manifest => { manifest.sizeBytes += 1; });
        await (0, assert_1.rejects)(() => (0, publish_team_analysis_r2_1.readTeamAnalysisR2PublishPlan)(fixture.options, fixture.runner), /payload size/);
    });
    (0, mocha_1.it)("rejects invalid JSON after valid gzip and integrity metadata", async () => {
        const invalidJson = Buffer.from("{broken", "utf8");
        const gzip = (0, zlib_1.gzipSync)(invalidJson);
        await (0, promises_1.writeFile)(fixture.options.datasetPath, gzip);
        await mutateManifest(fixture, manifest => {
            manifest.sha256 = (0, team_analysis_artifacts_1.sha256)(gzip);
            manifest.sizeBytes = gzip.byteLength;
            manifest.uncompressedSizeBytes = invalidJson.byteLength;
        });
        await (0, assert_1.rejects)(() => (0, publish_team_analysis_r2_1.readTeamAnalysisR2PublishPlan)(fixture.options, fixture.runner), /not valid JSON/);
    });
    (0, mocha_1.it)("rejects a divergent stateCount", async () => {
        await mutateManifest(fixture, manifest => { manifest.stateCount += 1; });
        await (0, assert_1.rejects)(() => (0, publish_team_analysis_r2_1.readTeamAnalysisR2PublishPlan)(fixture.options, fixture.runner), /stateCount mismatch/);
    });
    (0, mocha_1.it)("rejects a source character version mismatch", async () => {
        await rewriteDataset(fixture, { ...fixture.dataset, sourceCharacterDatasetVersion: "wrong-version" });
        await (0, assert_1.rejects)(() => (0, publish_team_analysis_r2_1.readTeamAnalysisR2PublishPlan)(fixture.options, fixture.runner), /source character version/);
    });
    (0, mocha_1.it)("rejects a source character SHA-256 mismatch", async () => {
        await rewriteDataset(fixture, { ...fixture.dataset, sourceCharacterPayloadSha256: "1".repeat(64) });
        await (0, assert_1.rejects)(() => (0, publish_team_analysis_r2_1.readTeamAnalysisR2PublishPlan)(fixture.options, fixture.runner), /source character SHA-256/);
    });
    (0, mocha_1.it)("rejects a duplicate stateKey", async () => {
        const duplicate = { ...fixture.dataset.states[0] };
        await rewriteDataset(fixture, {
            ...fixture.dataset,
            stateCount: 2,
            states: [...fixture.dataset.states, duplicate],
        });
        await (0, assert_1.rejects)(() => (0, publish_team_analysis_r2_1.readTeamAnalysisR2PublishPlan)(fixture.options, fixture.runner), /Duplicate Team Analysis stateKey/);
    });
    (0, mocha_1.it)("rejects traversal in a local manifest fileName and remote object key", async () => {
        await mutateManifest(fixture, manifest => { manifest.fileName = "../team-analysis.json.gz"; });
        await (0, assert_1.rejects)(() => (0, publish_team_analysis_r2_1.readTeamAnalysisR2PublishPlan)(fixture.options, fixture.runner), /traversal/);
        await writeLocalArtifact(fixture);
        const remoteManifest = makeRemoteManifest(fixture.artifact.manifest);
        remoteManifest.fileName = "/team-analysis/releases/bad/team-analysis.json.gz";
        fixture.runner.objects.set(publish_team_analysis_r2_1.TEAM_ANALYSIS_MANIFEST_OBJECT_KEY, serialize(remoteManifest));
        await (0, assert_1.rejects)(() => (0, publish_team_analysis_r2_1.readTeamAnalysisR2PublishPlan)(fixture.options, fixture.runner), /relative traversal-free/);
    });
    (0, mocha_1.it)("skips an identical remote manifest and verified immutable payload", async () => {
        installCurrentRemote(fixture);
        const plan = await (0, publish_team_analysis_r2_1.readTeamAnalysisR2PublishPlan)(fixture.options, fixture.runner);
        (0, assert_1.equal)(plan.remoteManifestStatus, "matching");
        (0, assert_1.equal)(plan.payloadUploadNeeded, false);
        (0, assert_1.equal)(plan.manifestUpdateNeeded, false);
    });
    (0, mocha_1.it)("plans an explicit update for a different remote manifest", async () => {
        const remoteManifest = makeRemoteManifest(fixture.artifact.manifest);
        remoteManifest.parserVersion = "1.7.0";
        fixture.runner.objects.set(publish_team_analysis_r2_1.TEAM_ANALYSIS_MANIFEST_OBJECT_KEY, serialize(remoteManifest));
        fixture.runner.objects.set(remoteManifest.fileName, fixture.artifact.gzipBuffer);
        const plan = await (0, publish_team_analysis_r2_1.readTeamAnalysisR2PublishPlan)(fixture.options, fixture.runner);
        (0, assert_1.equal)(plan.remoteManifestStatus, "different");
        (0, assert_1.equal)(plan.manifestUpdateNeeded, true);
    });
    (0, mocha_1.it)("plans initial publication when the remote manifest is absent", async () => {
        const plan = await (0, publish_team_analysis_r2_1.readTeamAnalysisR2PublishPlan)(fixture.options, fixture.runner);
        (0, assert_1.equal)(plan.remoteManifestStatus, "missing");
        (0, assert_1.equal)(plan.payloadUploadNeeded, true);
        (0, assert_1.equal)(plan.manifestUpdateNeeded, true);
    });
    (0, mocha_1.it)("handles absent local state without trusting it for completion", async () => {
        installCurrentRemote(fixture);
        const plan = await (0, publish_team_analysis_r2_1.readTeamAnalysisR2PublishPlan)(fixture.options, fixture.runner);
        (0, assert_1.ok)(plan.warnings.some(warning => warning.includes("state is absent")));
        (0, assert_1.equal)(plan.payloadUploadNeeded, false);
    });
    (0, mocha_1.it)("ignores an old local state schema", async () => {
        await (0, promises_1.writeFile)(fixture.options.statePath, JSON.stringify({ schemaVersion: 0, retainedReleases: [] }));
        const plan = await (0, publish_team_analysis_r2_1.readTeamAnalysisR2PublishPlan)(fixture.options, fixture.runner);
        (0, assert_1.ok)(plan.warnings.some(warning => warning.includes("old or invalid")));
    });
    (0, mocha_1.it)("uploads payload before promoting the manifest", async () => {
        await (0, publish_team_analysis_r2_1.publishTeamAnalysisR2)(fixture.options, fixture.runner, fixedClock);
        const puts = putKeys(fixture.runner);
        (0, assert_1.deepEqual)(puts, [(0, publish_team_analysis_r2_1.buildTeamAnalysisDatasetObjectKey)(fixture.artifact.manifest), publish_team_analysis_r2_1.TEAM_ANALYSIS_MANIFEST_OBJECT_KEY]);
    });
    (0, mocha_1.it)("does not promote the manifest or write state after payload failure", async () => {
        fixture.runner.failPutKey = (0, publish_team_analysis_r2_1.buildTeamAnalysisDatasetObjectKey)(fixture.artifact.manifest);
        await (0, assert_1.rejects)(() => (0, publish_team_analysis_r2_1.publishTeamAnalysisR2)(fixture.options, fixture.runner, fixedClock), /put failed/);
        (0, assert_1.equal)(fixture.runner.objects.has(publish_team_analysis_r2_1.TEAM_ANALYSIS_MANIFEST_OBJECT_KEY), false);
        (0, assert_1.equal)(await fileExists(fixture.options.statePath), false);
    });
    (0, mocha_1.it)("does not update state or clean releases after manifest failure", async () => {
        const old = installPreviousRemote(fixture, "characters-v0:parser-1.7.1", "old-one");
        fixture.runner.failPutKey = publish_team_analysis_r2_1.TEAM_ANALYSIS_MANIFEST_OBJECT_KEY;
        await (0, assert_1.rejects)(() => (0, publish_team_analysis_r2_1.publishTeamAnalysisR2)(fixture.options, fixture.runner, fixedClock), /put failed/);
        (0, assert_1.equal)(await fileExists(fixture.options.statePath), false);
        (0, assert_1.equal)(fixture.runner.objects.has(old.datasetObjectKey), true);
        (0, assert_1.equal)(fixture.runner.commands.some(args => args[2] === "delete"), false);
    });
    (0, mocha_1.it)("does not update state when the manifest put reports success without persisting bytes", async () => {
        const old = installPreviousRemote(fixture, "characters-v0:parser-1.7.1", "old-one");
        fixture.runner.ignorePutKey = publish_team_analysis_r2_1.TEAM_ANALYSIS_MANIFEST_OBJECT_KEY;
        await (0, assert_1.rejects)(() => (0, publish_team_analysis_r2_1.publishTeamAnalysisR2)(fixture.options, fixture.runner, fixedClock), /manifest failed content\/size\/SHA-256 verification/);
        (0, assert_1.equal)(await fileExists(fixture.options.statePath), false);
        (0, assert_1.equal)(fixture.runner.objects.has(old.datasetObjectKey), true);
        (0, assert_1.equal)(fixture.runner.commands.some(args => args[2] === "delete"), false);
    });
    (0, mocha_1.it)("keeps the new publication valid when old-release cleanup fails", async () => {
        const previous = installPreviousRemote(fixture, "characters-v0:parser-1.7.1", "previous");
        const stale = makeRelease(fixture, "characters-v-1:parser-1.7.1", "stale");
        fixture.runner.objects.set(stale.datasetObjectKey, stale.buffer);
        await writeState(fixture, [previous, stale.release]);
        fixture.runner.failDeleteKey = stale.datasetObjectKey;
        const summary = await (0, publish_team_analysis_r2_1.publishTeamAnalysisR2)(fixture.options, fixture.runner, fixedClock);
        const published = JSON.parse(fixture.runner.objects.get(publish_team_analysis_r2_1.TEAM_ANALYSIS_MANIFEST_OBJECT_KEY).toString("utf8"));
        const state = JSON.parse(await (0, promises_1.readFile)(fixture.options.statePath, "utf8"));
        (0, assert_1.equal)(published.fileName, (0, publish_team_analysis_r2_1.buildTeamAnalysisDatasetObjectKey)(fixture.artifact.manifest));
        (0, assert_1.equal)(summary.cleanupFailures.length, 1);
        (0, assert_1.deepEqual)(state.cleanupPendingReleases?.map(release => release.datasetObjectKey), [stale.datasetObjectKey]);
    });
    (0, mocha_1.it)("retains the immediately previous verified release", async () => {
        const previous = installPreviousRemote(fixture, "characters-v0:parser-1.7.1", "previous");
        const plan = await (0, publish_team_analysis_r2_1.readTeamAnalysisR2PublishPlan)(fixture.options, fixture.runner);
        (0, assert_1.deepEqual)(plan.retainedReleases.map(release => release.datasetObjectKey), [
            (0, publish_team_analysis_r2_1.buildTeamAnalysisDatasetObjectKey)(fixture.artifact.manifest),
            previous.datasetObjectKey,
        ]);
        (0, assert_1.equal)(plan.cleanupCandidates.length, 0);
    });
    (0, mocha_1.it)("limits retention to two releases and cleans only verified older tracked versions", async () => {
        const previous = installPreviousRemote(fixture, "characters-v0:parser-1.7.1", "previous");
        const staleOne = makeRelease(fixture, "characters-v-1:parser-1.7.1", "stale-one");
        const staleTwo = makeRelease(fixture, "characters-v-2:parser-1.7.1", "stale-two");
        [staleOne, staleTwo].forEach(entry => fixture.runner.objects.set(entry.datasetObjectKey, entry.buffer));
        await writeState(fixture, [previous, staleOne.release, staleTwo.release]);
        const plan = await (0, publish_team_analysis_r2_1.readTeamAnalysisR2PublishPlan)(fixture.options, fixture.runner);
        (0, assert_1.equal)(plan.retainedReleases.length, 2);
        (0, assert_1.deepEqual)(plan.cleanupCandidates.map(release => release.datasetObjectKey).sort(), [
            staleOne.datasetObjectKey,
            staleTwo.datasetObjectKey,
        ].sort());
        (0, assert_1.ok)(!plan.cleanupCandidates.some(release => release.datasetObjectKey === previous.datasetObjectKey));
        await (0, publish_team_analysis_r2_1.publishTeamAnalysisR2)(fixture.options, fixture.runner, fixedClock);
        (0, assert_1.equal)(fixture.runner.objects.has(previous.datasetObjectKey), true);
        (0, assert_1.equal)(fixture.runner.objects.has(staleOne.datasetObjectKey), false);
        (0, assert_1.equal)(fixture.runner.objects.has(staleTwo.datasetObjectKey), false);
        const state = JSON.parse(await (0, promises_1.readFile)(fixture.options.statePath, "utf8"));
        (0, assert_1.equal)(state.cleanupPendingReleases, undefined);
    });
    (0, mocha_1.it)("fails before writes when the namespace budget is exceeded", async () => {
        fixture.options.maxNamespaceBytes = 1;
        await (0, assert_1.rejects)(() => (0, publish_team_analysis_r2_1.publishTeamAnalysisR2)(fixture.options, fixture.runner, fixedClock), /exceeds namespace limit/);
        (0, assert_1.equal)(fixture.runner.commands.some(args => args[2] === "put" || args[2] === "delete"), false);
    });
    (0, mocha_1.it)("fails closed before remote writes when global bucket size is unavailable", async () => {
        fixture.runner.failBucketInfo = true;
        await (0, assert_1.rejects)(() => (0, publish_team_analysis_r2_1.publishTeamAnalysisR2)(fixture.options, fixture.runner, fixedClock), /Refusing remote writes/);
        (0, assert_1.equal)(fixture.runner.commands.some(args => args[2] === "put" || args[2] === "delete"), false);
        fixture.options.dryRun = true;
        const dryRunPlan = await (0, publish_team_analysis_r2_1.readTeamAnalysisR2PublishPlan)(fixture.options, fixture.runner);
        (0, assert_1.equal)(dryRunPlan.bucketTotalVisibility, "unavailable");
    });
    (0, mocha_1.it)("performs no writes in dry-run", async () => {
        fixture.options.dryRun = true;
        await (0, publish_team_analysis_r2_1.publishTeamAnalysisR2)(fixture.options, fixture.runner, fixedClock);
        (0, assert_1.equal)(fixture.runner.commands.some(args => args[2] === "put" || args[2] === "delete"), false);
        (0, assert_1.equal)(await fileExists(fixture.options.statePath), false);
        (0, assert_1.deepEqual)(await (0, promises_1.readFile)(fixture.options.datasetPath), fixture.artifact.gzipBuffer);
    });
    (0, mocha_1.it)("passes explicit --remote and --local flags to every object operation", async () => {
        fixture.options.dryRun = true;
        await (0, publish_team_analysis_r2_1.publishTeamAnalysisR2)(fixture.options, fixture.runner, fixedClock);
        (0, assert_1.ok)(fixture.runner.commands.filter(args => args[1] === "object").every(args => args.includes("--remote")));
        const localFixture = await createFixture(["--local"]);
        try {
            localFixture.options.dryRun = true;
            await (0, publish_team_analysis_r2_1.publishTeamAnalysisR2)(localFixture.options, localFixture.runner, fixedClock);
            (0, assert_1.ok)(localFixture.runner.commands.filter(args => args[1] === "object").every(args => args.includes("--local")));
        }
        finally {
            await (0, promises_1.rm)(localFixture.root, { recursive: true, force: true });
        }
    });
    (0, mocha_1.it)("uses immutable gzip metadata for payload and no-store JSON metadata for manifest", async () => {
        await (0, publish_team_analysis_r2_1.publishTeamAnalysisR2)(fixture.options, fixture.runner, fixedClock);
        const puts = fixture.runner.commands.filter(args => args[2] === "put");
        const payloadPut = puts.find(args => args[3].endsWith("/team-analysis.json.gz"));
        const manifestPut = puts.find(args => args[3].endsWith(`/${publish_team_analysis_r2_1.TEAM_ANALYSIS_MANIFEST_OBJECT_KEY}`));
        (0, assert_1.equal)(payloadPut[payloadPut.indexOf("--content-type") + 1], "application/gzip");
        (0, assert_1.equal)(payloadPut[payloadPut.indexOf("--cache-control") + 1], publish_team_analysis_r2_1.TEAM_ANALYSIS_PAYLOAD_CACHE_CONTROL);
        (0, assert_1.equal)(manifestPut[manifestPut.indexOf("--content-type") + 1], "application/json");
        (0, assert_1.equal)(manifestPut[manifestPut.indexOf("--cache-control") + 1], publish_team_analysis_r2_1.TEAM_ANALYSIS_MANIFEST_CACHE_CONTROL);
    });
    (0, mocha_1.it)("is idempotent after a successful publish", async () => {
        await (0, publish_team_analysis_r2_1.publishTeamAnalysisR2)(fixture.options, fixture.runner, fixedClock);
        fixture.runner.commands.length = 0;
        const summary = await (0, publish_team_analysis_r2_1.publishTeamAnalysisR2)(fixture.options, fixture.runner, fixedClock);
        (0, assert_1.equal)(summary.plan.payloadUploadNeeded, false);
        (0, assert_1.equal)(summary.plan.manifestUpdateNeeded, false);
        (0, assert_1.equal)(summary.plan.stateUpdateNeeded, false);
        (0, assert_1.equal)(fixture.runner.commands.some(args => args[2] === "put" || args[2] === "delete"), false);
    });
    (0, mocha_1.it)("records the SHA-256 of unchanged remote manifest bytes", async () => {
        const manifest = makeRemoteManifest(fixture.artifact.manifest);
        const minifiedManifest = Buffer.from(JSON.stringify(manifest), "utf8");
        fixture.runner.objects.set(manifest.fileName, fixture.artifact.gzipBuffer);
        fixture.runner.objects.set(publish_team_analysis_r2_1.TEAM_ANALYSIS_MANIFEST_OBJECT_KEY, minifiedManifest);
        const summary = await (0, publish_team_analysis_r2_1.publishTeamAnalysisR2)(fixture.options, fixture.runner, fixedClock);
        const state = JSON.parse(await (0, promises_1.readFile)(fixture.options.statePath, "utf8"));
        (0, assert_1.equal)(summary.plan.manifestUpdateNeeded, false);
        (0, assert_1.equal)(state.manifestSha256, (0, team_analysis_artifacts_1.sha256)(minifiedManifest));
    });
    (0, mocha_1.it)("does not orphan a bounded 20-release state when the remote manifest is different", async () => {
        const tracked = [];
        for (let index = 0; index < 20; index += 1) {
            const entry = makeRelease(fixture, `tracked-${String(index).padStart(2, "0")}`, `tracked-${index}`);
            tracked.push(entry.release);
            fixture.runner.objects.set(entry.datasetObjectKey, entry.buffer);
        }
        await writeState(fixture, tracked);
        const remote = installPreviousRemote(fixture, "remote-active", "remote-active");
        const plan = await (0, publish_team_analysis_r2_1.readTeamAnalysisR2PublishPlan)(fixture.options, fixture.runner);
        (0, assert_1.equal)(plan.retainedReleases.length, 2);
        (0, assert_1.equal)(plan.retainedReleases[1].datasetObjectKey, remote.datasetObjectKey);
        (0, assert_1.equal)(plan.cleanupCandidates.length, 20);
        (0, assert_1.ok)(tracked.every(release => plan.cleanupCandidates.some(candidate => candidate.datasetObjectKey === release.datasetObjectKey)));
        fixture.runner.failAllDeletes = true;
        const summary = await (0, publish_team_analysis_r2_1.publishTeamAnalysisR2)(fixture.options, fixture.runner, fixedClock);
        (0, assert_1.equal)(summary.cleanupFailures.length, 20);
        const persisted = JSON.parse(await (0, promises_1.readFile)(fixture.options.statePath, "utf8"));
        (0, assert_1.equal)(persisted.retainedReleases.length + (persisted.cleanupPendingReleases?.length ?? 0), 22);
        const retryPlan = await (0, publish_team_analysis_r2_1.readTeamAnalysisR2PublishPlan)(fixture.options, fixture.runner);
        (0, assert_1.equal)(retryPlan.cleanupCandidates.length, 20);
        (0, assert_1.ok)(!retryPlan.warnings.some(warning => warning.includes("old or invalid")));
    });
    (0, mocha_1.it)("produces a deterministic plan from the same local and remote facts", async () => {
        installCurrentRemote(fixture);
        const first = await (0, publish_team_analysis_r2_1.readTeamAnalysisR2PublishPlan)(fixture.options, fixture.runner);
        const second = await (0, publish_team_analysis_r2_1.readTeamAnalysisR2PublishPlan)(fixture.options, fixture.runner);
        (0, assert_1.deepEqual)(planSnapshot(first), planSnapshot(second));
    });
    (0, mocha_1.it)("keeps generated data outside version control", () => {
        const trackedData = (0, child_process_1.execFileSync)("git", ["ls-files", "data"], { encoding: "utf8" }).trim();
        (0, assert_1.equal)(trackedData, "");
    });
    (0, mocha_1.it)("uses conservative defaults and rejects conflicting targets or unsafe flags", () => {
        const defaults = (0, publish_team_analysis_r2_1.parseTeamAnalysisR2PublishArgs)([]);
        (0, assert_1.equal)(defaults.bucket, "dokkanpanion-data");
        (0, assert_1.equal)(defaults.target, "remote");
        (0, assert_1.equal)(defaults.maxTotalBytes, 10000000000);
        (0, assert_1.equal)(defaults.maxNamespaceBytes, 50000000);
        (0, assert_1.equal)(defaults.skipRemoteManifestCheck, false);
        (0, assert_1.equal)(defaults.skipUploadVerification, false);
        (0, assert_1.equal)(defaults.allowUnknownBucketSize, false);
        const recovery = (0, publish_team_analysis_r2_1.parseTeamAnalysisR2PublishArgs)([
            "--skip-remote-manifest-check",
            "--skip-upload-verification",
            "--allow-unknown-bucket-size",
        ]);
        (0, assert_1.equal)(recovery.skipRemoteManifestCheck, true);
        (0, assert_1.equal)(recovery.skipUploadVerification, true);
        (0, assert_1.equal)(recovery.allowUnknownBucketSize, true);
        (0, assert_1.rejects)(async () => (0, publish_team_analysis_r2_1.parseTeamAnalysisR2PublishArgs)(["--remote", "--local"]), /Choose only one/);
        (0, assert_1.rejects)(async () => (0, publish_team_analysis_r2_1.parseTeamAnalysisR2PublishArgs)(["--unknown"]), /Unknown option/);
        (0, assert_1.rejects)(async () => (0, publish_team_analysis_r2_1.parseTeamAnalysisR2PublishArgs)([
            "--dataset", "same.json.gz", "--state", "same.json.gz",
        ]), /must be distinct/);
    });
});
async function createFixture(extraArgs = []) {
    const root = await (0, promises_1.mkdtemp)((0, path_1.resolve)((0, os_1.tmpdir)(), "dokkan-team-analysis-test-"));
    const characterDatasetPath = (0, path_1.resolve)(root, "characters.json.gz");
    const characterManifestPath = (0, path_1.resolve)(root, "characters-manifest.json");
    const datasetPath = (0, path_1.resolve)(root, "team-analysis.json.gz");
    const manifestPath = (0, path_1.resolve)(root, "team-analysis-manifest.json");
    const statePath = (0, path_1.resolve)(root, "publish-state.json");
    const characters = [{ id: "100", name: "Test Character", passive: "" }];
    const generatedAt = "2026-08-04T00:00:00.000Z";
    const characterArtifact = (0, dataset_artifacts_1.buildCharacterDatasetArtifact)(characters, {
        datasetVersion: "characters-v1",
        generatedAt,
    });
    const dataset = (0, team_analysis_1.buildTeamAnalysisDataset)(characters, [{
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
    const artifact = (0, team_analysis_artifacts_1.buildTeamAnalysisArtifact)(dataset);
    const args = [
        "--dataset", datasetPath,
        "--manifest", manifestPath,
        "--characters", characterDatasetPath,
        "--character-manifest", characterManifestPath,
        "--state", statePath,
        ...extraArgs,
    ];
    const fixture = {
        root,
        options: (0, publish_team_analysis_r2_1.parseTeamAnalysisR2PublishArgs)(args),
        runner: new FakeRunner(),
        characterArtifact,
        dataset,
        artifact,
    };
    await (0, promises_1.writeFile)(characterDatasetPath, characterArtifact.gzipBuffer);
    await (0, promises_1.writeFile)(characterManifestPath, serialize(characterArtifact.manifest));
    await writeLocalArtifact(fixture);
    return fixture;
}
async function writeLocalArtifact(fixture) {
    await (0, promises_1.writeFile)(fixture.options.datasetPath, fixture.artifact.gzipBuffer);
    await (0, promises_1.writeFile)(fixture.options.manifestPath, serialize(fixture.artifact.manifest));
}
async function rewriteDataset(fixture, dataset) {
    fixture.dataset = dataset;
    fixture.artifact = (0, team_analysis_artifacts_1.buildTeamAnalysisArtifact)(dataset, { datasetVersion: fixture.artifact.manifest.datasetVersion });
    await writeLocalArtifact(fixture);
}
async function mutateManifest(fixture, mutate) {
    const manifest = { ...fixture.artifact.manifest };
    mutate(manifest);
    await (0, promises_1.writeFile)(fixture.options.manifestPath, serialize(manifest));
}
async function mutateCharacterManifest(fixture, mutate) {
    const manifest = { ...fixture.characterArtifact.manifest };
    mutate(manifest);
    await (0, promises_1.writeFile)(fixture.options.characterManifestPath, serialize(manifest));
}
function makeRemoteManifest(local) {
    const manifest = { ...local };
    manifest.fileName = (0, publish_team_analysis_r2_1.buildTeamAnalysisDatasetObjectKey)(manifest);
    return manifest;
}
function installCurrentRemote(fixture) {
    const manifest = makeRemoteManifest(fixture.artifact.manifest);
    fixture.runner.objects.set(manifest.fileName, fixture.artifact.gzipBuffer);
    fixture.runner.objects.set(publish_team_analysis_r2_1.TEAM_ANALYSIS_MANIFEST_OBJECT_KEY, serialize(manifest));
}
function installPreviousRemote(fixture, version, content) {
    const previous = makeRelease(fixture, version, content);
    const manifest = {
        ...fixture.artifact.manifest,
        datasetVersion: version,
        generatedAt: "2026-08-03T00:00:00.000Z",
        sha256: previous.release.payloadSha256,
        sizeBytes: previous.release.sizeBytes,
        fileName: previous.release.datasetObjectKey,
    };
    fixture.runner.objects.set(previous.datasetObjectKey, previous.buffer);
    fixture.runner.objects.set(publish_team_analysis_r2_1.TEAM_ANALYSIS_MANIFEST_OBJECT_KEY, serialize(manifest));
    return previous.release;
}
function makeRelease(fixture, version, content) {
    const buffer = Buffer.from(content, "utf8");
    const manifest = {
        ...fixture.artifact.manifest,
        datasetVersion: version,
        sha256: (0, team_analysis_artifacts_1.sha256)(buffer),
        sizeBytes: buffer.byteLength,
    };
    const datasetObjectKey = (0, publish_team_analysis_r2_1.buildTeamAnalysisDatasetObjectKey)(manifest);
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
async function writeState(fixture, releases) {
    const current = releases[0];
    const state = {
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
    await (0, promises_1.writeFile)(fixture.options.statePath, serialize(state));
}
function serialize(value) {
    return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}
function success(stdout = "") {
    return { exitCode: 0, stdout, stderr: "" };
}
function failure(stderr) {
    return { exitCode: 1, stdout: "", stderr };
}
function fixedClock() {
    return new Date("2026-08-04T12:00:00.000Z");
}
function putKeys(runner) {
    return runner.commands
        .filter(args => args[2] === "put")
        .map(args => args[3].slice(args[3].indexOf("/") + 1));
}
async function fileExists(filePath) {
    try {
        await (0, promises_1.readFile)(filePath);
        return true;
    }
    catch {
        return false;
    }
}
function planSnapshot(plan) {
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
//# sourceMappingURL=publish-team-analysis-r2.spec.js.map