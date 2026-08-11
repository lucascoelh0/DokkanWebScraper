"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const assert_1 = require("assert");
const promises_1 = require("fs/promises");
const os_1 = require("os");
const path_1 = require("path");
const dataset_artifacts_1 = require("./dataset-artifacts");
const fyi_character_release_1 = require("./fyi-character-release");
const fyi_character_release_preflight_1 = require("./fyi-character-release-preflight");
const hash = (bytes) => (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
const jsonBytes = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
async function releaseFixture() {
    const root = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "fyi-k24-"));
    const generatedAt = "2026-08-11T00:56:35.327Z";
    const characters = [{
            id: "1000001", portraitURL: "images/v2/portrait_1000001.png", portraitFilename: "portrait_1000001",
            transformations: [{ id: "4000001", portraitURL: "images/v2/portrait_4000001.png", portraitFilename: "portrait_4000001", transformations: [] }],
        }];
    const artifact = (0, dataset_artifacts_1.buildCharacterDatasetArtifact)(characters, { generatedAt, datasetVersion: generatedAt });
    const sourceMarker = Buffer.from("ready-marker\n");
    const portraitBytes = new Map([
        ["images/v2/portrait_1000001.png", Buffer.from("portrait-a")],
        ["images/v2/portrait_4000001.png", Buffer.from("portrait-b")],
    ]);
    const portraits = [...portraitBytes].map(([objectKey, bytes]) => ({
        objectKey, fileName: objectKey.split("/").pop(), sha256: hash(bytes), sizeBytes: bytes.length,
    }));
    const k20 = {
        schemaVersion: 1, contract: "dokkan-fyi-character-database-candidate-readiness-k20", contractVersion: "1.0.0", generatedAt,
        sources: { candidate: {
                datasetVersion: artifact.manifest.datasetVersion, generatedAt, payloadFile: "characters.json.gz",
                payloadSha256: artifact.manifest.sha256, payloadSizeBytes: artifact.manifest.sizeBytes,
                uncompressedSizeBytes: artifact.manifest.uncompressedSizeBytes, characterCount: artifact.manifest.characterCount,
            } },
        checks: { complete: true }, failures: { total: 0, examples: [], exampleLimit: 5 },
        readiness: { candidateGenerationValidation: "GO", promotion: "NO-GO", production: "NO-GO", publisher: "NO-GO", android: "NO-GO", r2: "NO-GO" },
    };
    const release = (0, fyi_character_release_1.buildFyiCharacterReleaseK21)({ candidateGzip: artifact.gzipBuffer, candidateManifest: artifact.manifest, candidateReadyMarker: sourceMarker, k20, portraits });
    const plan = (0, fyi_character_release_1.buildFyiCharacterReleaseK22)(release);
    const receipt = (0, fyi_character_release_1.buildFyiCharacterReleaseK23)(release, plan);
    const directory = (0, path_1.join)(root, fyi_character_release_1.FYI_CHARACTER_RELEASE_ROOT, release.releaseId);
    await (0, promises_1.mkdir)((0, path_1.join)(directory, "portraits"), { recursive: true });
    const localManifest = { ...release.dataset };
    delete localManifest.localFileName;
    const marker = {
        schemaVersion: 1, contract: "dokkan-fyi-character-release-ready-k21-k23", contractVersion: "1.0.0", releaseId: release.releaseId,
        files: {
            [fyi_character_release_1.FYI_CHARACTER_RELEASE_REPORT]: hash(jsonBytes(release)),
            [fyi_character_release_1.FYI_CHARACTER_RELEASE_PLAN]: hash(jsonBytes(plan)),
            [fyi_character_release_1.FYI_CHARACTER_RELEASE_RECEIPT]: hash(jsonBytes(receipt)),
            [fyi_character_release_1.FYI_CHARACTER_RELEASE_K20]: hash(jsonBytes(k20)),
            [fyi_character_release_1.FYI_CHARACTER_RELEASE_SOURCE_MARKER]: hash(sourceMarker),
            "characters.json.gz": release.dataset.sha256,
            "characters-manifest.json": hash(jsonBytes(localManifest)),
            "characters-manifest.remote.json": hash(jsonBytes(plan.remoteManifest)),
        },
        portraitInventorySha256: release.portraits.inventorySha256,
    };
    await Promise.all([
        (0, promises_1.writeFile)((0, path_1.join)(directory, fyi_character_release_1.FYI_CHARACTER_RELEASE_REPORT), jsonBytes(release)),
        (0, promises_1.writeFile)((0, path_1.join)(directory, fyi_character_release_1.FYI_CHARACTER_RELEASE_PLAN), jsonBytes(plan)),
        (0, promises_1.writeFile)((0, path_1.join)(directory, fyi_character_release_1.FYI_CHARACTER_RELEASE_RECEIPT), jsonBytes(receipt)),
        (0, promises_1.writeFile)((0, path_1.join)(directory, fyi_character_release_1.FYI_CHARACTER_RELEASE_K20), jsonBytes(k20)),
        (0, promises_1.writeFile)((0, path_1.join)(directory, fyi_character_release_1.FYI_CHARACTER_RELEASE_SOURCE_MARKER), sourceMarker),
        (0, promises_1.writeFile)((0, path_1.join)(directory, "characters.json.gz"), artifact.gzipBuffer),
        (0, promises_1.writeFile)((0, path_1.join)(directory, "characters-manifest.json"), jsonBytes(localManifest)),
        (0, promises_1.writeFile)((0, path_1.join)(directory, "characters-manifest.remote.json"), jsonBytes(plan.remoteManifest)),
        ...[...portraitBytes].map(([key, bytes]) => (0, promises_1.writeFile)((0, path_1.join)(directory, "portraits", key.split("/").pop()), bytes)),
    ]);
    await (0, promises_1.writeFile)((0, path_1.join)(directory, fyi_character_release_1.FYI_CHARACTER_RELEASE_READY), jsonBytes(marker));
    return { root, release, plan, receipt, artifact, portraitBytes, directory };
}
function fakeReader(values) {
    return { read: async (key, _max, consume) => {
            const value = values.get(key);
            if (!value)
                throw new Error(`missing fake ${key}`);
            if (value instanceof Error)
                throw value;
            consume(value.bytes.length);
            return value;
        } };
}
const bucketReader = (reported = "341 MB") => ({
    read: async () => (0, fyi_character_release_preflight_1.parseFyiCharacterBucketSize)(reported),
});
describe("FYI character remote preflight K24", () => {
    it("requires the exact explicit remote CLI", () => {
        const id = `${"a".repeat(64)}-${"b".repeat(64)}`;
        (0, assert_1.deepStrictEqual)((0, fyi_character_release_preflight_1.parseFyiCharacterRemotePreflightCli)(["--opt-in-k24", "--release-id", id, "--remote"]), { releaseId: id });
        for (const args of [[], ["--opt-in-k24"], ["--opt-in-k24", "--release-id", id, "--local"], ["--release-id", id, "--remote", "--opt-in-k24"]]) {
            (0, assert_1.throws)(() => (0, fyi_character_release_preflight_1.parseFyiCharacterRemotePreflightCli)(args), /requires exactly/);
        }
    });
    it("uses a conservative upper bound for rounded Wrangler sizes", () => {
        (0, assert_1.deepStrictEqual)((0, fyi_character_release_preflight_1.parseFyiCharacterBucketSize)("341 MB"), { reported: "341 MB", conservativeUpperBoundBytes: 342000000 });
        (0, assert_1.deepStrictEqual)((0, fyi_character_release_preflight_1.parseFyiCharacterBucketSize)("1.25 GB"), { reported: "1.25 GB", conservativeUpperBoundBytes: 1260000000 });
        (0, assert_1.throws)(() => (0, fyi_character_release_preflight_1.parseFyiCharacterBucketSize)("341 MiB"), /unsupported/);
    });
    it("revalidates the complete local release before remote inspection", async () => {
        const fixture = await releaseFixture();
        try {
            const validated = await (0, fyi_character_release_1.readValidatedFyiCharacterRelease)(fixture.root, fixture.release.releaseId);
            (0, assert_1.equal)(validated.release.releaseId, fixture.release.releaseId);
            const k20Path = (0, path_1.join)(fixture.directory, fyi_character_release_1.FYI_CHARACTER_RELEASE_K20);
            const originalK20 = await (0, promises_1.readFile)(k20Path);
            await (0, promises_1.writeFile)(k20Path, Buffer.from(originalK20.toString("utf8").replace("NO-GO", "MAYBE")));
            await (0, assert_1.rejects)(() => (0, fyi_character_release_1.readValidatedFyiCharacterRelease)(fixture.root, fixture.release.releaseId), /metadata rejected/);
            await (0, promises_1.writeFile)(k20Path, originalK20);
            await (0, promises_1.writeFile)((0, path_1.join)(fixture.directory, "portraits", "portrait_1000001.png"), "changed");
            await (0, assert_1.rejects)(() => (0, fyi_character_release_1.readValidatedFyiCharacterRelease)(fixture.root, fixture.release.releaseId), /portrait differs/);
        }
        finally {
            await (0, promises_1.rm)(fixture.root, { recursive: true, force: true });
        }
    });
    it("returns GO when immutable objects are matching or missing and the bucket remains safe", async () => {
        const fixture = await releaseFixture();
        try {
            const values = new Map();
            for (const object of fixture.plan.objects) {
                if (object.kind === "payload")
                    values.set(object.objectKey, { statusCode: 404, bytes: Buffer.alloc(0) });
                if (object.kind === "portrait")
                    values.set(object.objectKey, { statusCode: 200, bytes: fixture.portraitBytes.get(object.objectKey) });
                if (object.kind === "manifest")
                    values.set(object.objectKey, { statusCode: 200, bytes: Buffer.from("{}\n") });
            }
            const report = await (0, fyi_character_release_preflight_1.runFyiCharacterRemotePreflightK24)({
                fyiRoot: fixture.root, releaseId: fixture.release.releaseId,
                checkedAt: "2026-08-11T03:00:00.000Z", reader: fakeReader(values), bucketSizeReader: bucketReader(), writeReport: false,
            });
            (0, assert_1.equal)(report.readiness.remoteReadOnlyPreflight, "GO");
            (0, assert_1.deepStrictEqual)(report.objectSummary, { matching: 2, missing: 1, conflict: 0, failed: 0, total: 3 });
            (0, assert_1.equal)(report.manifest.status, "different");
            (0, assert_1.equal)(report.checks.noRemoteMutation, true);
            (0, assert_1.equal)(report.readiness.publicationAuthorization, "REQUIRED");
            (0, assert_1.equal)(report.readiness.r2Mutation, "NO-GO");
            (0, assert_1.equal)(report.budget.bytesNewIfPublished, fixture.artifact.gzipBuffer.length + fixture.plan.objects.find(value => value.kind === "manifest").sizeBytes);
        }
        finally {
            await (0, promises_1.rm)(fixture.root, { recursive: true, force: true });
        }
    });
    it("fails closed on immutable conflicts, read errors, and unsafe bucket usage", async () => {
        const fixture = await releaseFixture();
        try {
            const values = new Map();
            for (const object of fixture.plan.objects) {
                if (object.kind === "payload")
                    values.set(object.objectKey, { statusCode: 200, bytes: fixture.artifact.gzipBuffer });
                if (object.kind === "portrait")
                    values.set(object.objectKey, object.objectKey.includes("1000001")
                        ? { statusCode: 200, bytes: Buffer.from("wrong") } : new Error("network unavailable"));
                if (object.kind === "manifest")
                    values.set(object.objectKey, { statusCode: 404, bytes: Buffer.alloc(0) });
            }
            const report = await (0, fyi_character_release_preflight_1.runFyiCharacterRemotePreflightK24)({
                fyiRoot: fixture.root, releaseId: fixture.release.releaseId,
                reader: fakeReader(values), bucketSizeReader: bucketReader("9.99 GB"), writeReport: false,
            });
            (0, assert_1.equal)(report.readiness.remoteReadOnlyPreflight, "NO-GO");
            (0, assert_1.equal)(report.objectSummary.conflict, 1);
            (0, assert_1.equal)(report.objectSummary.failed, 1);
            (0, assert_1.equal)(report.budget.withinBucketLimit, false);
        }
        finally {
            await (0, promises_1.rm)(fixture.root, { recursive: true, force: true });
        }
    });
    it("writes only an ignored local report when requested", async () => {
        const fixture = await releaseFixture();
        try {
            const values = new Map();
            for (const object of fixture.plan.objects)
                values.set(object.objectKey, { statusCode: 404, bytes: Buffer.alloc(0) });
            const report = await (0, fyi_character_release_preflight_1.runFyiCharacterRemotePreflightK24)({
                fyiRoot: fixture.root, releaseId: fixture.release.releaseId,
                reader: fakeReader(values), bucketSizeReader: bucketReader(), writeReport: true,
            });
            const reportRoots = await (0, promises_1.readdir)((0, path_1.join)(fixture.root, "preflight-k24", fixture.release.releaseId));
            (0, assert_1.equal)(reportRoots.length, 1);
            const stored = JSON.parse(await (0, promises_1.readFile)((0, path_1.join)(fixture.root, "preflight-k24", fixture.release.releaseId, reportRoots[0], "remote-preflight-k24.json"), "utf8"));
            (0, assert_1.equal)(stored.releaseId, report.releaseId);
            (0, assert_1.equal)(stored.checks.readOnlyTransport, true);
        }
        finally {
            await (0, promises_1.rm)(fixture.root, { recursive: true, force: true });
        }
    });
    it("rejects a bucket reader that understates the parsed upper bound", async () => {
        const fixture = await releaseFixture();
        try {
            const values = new Map();
            for (const object of fixture.plan.objects)
                values.set(object.objectKey, { statusCode: 404, bytes: Buffer.alloc(0) });
            await (0, assert_1.rejects)(() => (0, fyi_character_release_preflight_1.runFyiCharacterRemotePreflightK24)({
                fyiRoot: fixture.root, releaseId: fixture.release.releaseId,
                reader: fakeReader(values), bucketSizeReader: { read: async () => ({ reported: "341 MB", conservativeUpperBoundBytes: 0 }) },
                writeReport: false,
            }), /bucket size reader result rejected/);
        }
        finally {
            await (0, promises_1.rm)(fixture.root, { recursive: true, force: true });
        }
    });
    it("rejects an external junction in the report path", async function () {
        const fixture = await releaseFixture();
        const outside = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "fyi-k24-outside-"));
        try {
            try {
                await (0, promises_1.symlink)(outside, (0, path_1.join)(fixture.root, "preflight-k24"), "junction");
            }
            catch (error) {
                if (error?.code === "EPERM") {
                    this.skip();
                    return;
                }
                throw error;
            }
            const values = new Map();
            for (const object of fixture.plan.objects)
                values.set(object.objectKey, { statusCode: 404, bytes: Buffer.alloc(0) });
            await (0, assert_1.rejects)(() => (0, fyi_character_release_preflight_1.runFyiCharacterRemotePreflightK24)({
                fyiRoot: fixture.root, releaseId: fixture.release.releaseId,
                reader: fakeReader(values), bucketSizeReader: bucketReader(), writeReport: true,
            }), /report directory rejected/);
        }
        finally {
            await (0, promises_1.rm)(fixture.root, { recursive: true, force: true });
            await (0, promises_1.rm)(outside, { recursive: true, force: true });
        }
    });
    it("rejects a pre-existing hardlinked report", async () => {
        const fixture = await releaseFixture();
        const outside = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "fyi-k24-hardlink-"));
        try {
            const values = new Map();
            for (const object of fixture.plan.objects)
                values.set(object.objectKey, { statusCode: 404, bytes: Buffer.alloc(0) });
            const options = {
                fyiRoot: fixture.root, releaseId: fixture.release.releaseId, checkedAt: "2026-08-11T03:00:00.000Z",
                reader: fakeReader(values), bucketSizeReader: bucketReader(), writeReport: false,
            };
            const report = await (0, fyi_character_release_preflight_1.runFyiCharacterRemotePreflightK24)(options);
            const reportHash = hash(jsonBytes(report));
            const reportRoot = (0, path_1.join)(fixture.root, "preflight-k24", fixture.release.releaseId, reportHash);
            await (0, promises_1.mkdir)(reportRoot, { recursive: true });
            const external = (0, path_1.join)(outside, "report.json");
            await (0, promises_1.writeFile)(external, jsonBytes(report));
            await (0, promises_1.link)(external, (0, path_1.join)(reportRoot, "remote-preflight-k24.json"));
            await (0, assert_1.rejects)(() => (0, fyi_character_release_preflight_1.runFyiCharacterRemotePreflightK24)({ ...options, writeReport: true }), /existing report identity rejected/);
        }
        finally {
            await (0, promises_1.rm)(fixture.root, { recursive: true, force: true });
            await (0, promises_1.rm)(outside, { recursive: true, force: true });
        }
    });
});
//# sourceMappingURL=fyi-character-release-preflight.spec.js.map