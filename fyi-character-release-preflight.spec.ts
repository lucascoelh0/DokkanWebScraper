import { createHash } from "crypto";
import { deepStrictEqual, equal, rejects, throws } from "assert";
import { link, mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { buildCharacterDatasetArtifact } from "./dataset-artifacts";
import {
    buildFyiCharacterReleaseK21,
    buildFyiCharacterReleaseK22,
    buildFyiCharacterReleaseK23,
    FYI_CHARACTER_RELEASE_K20,
    FYI_CHARACTER_RELEASE_PLAN,
    FYI_CHARACTER_RELEASE_READY,
    FYI_CHARACTER_RELEASE_RECEIPT,
    FYI_CHARACTER_RELEASE_REPORT,
    FYI_CHARACTER_RELEASE_ROOT,
    FYI_CHARACTER_RELEASE_SOURCE_MARKER,
    readValidatedFyiCharacterRelease,
} from "./fyi-character-release";
import {
    FyiCharacterBucketSizeReader,
    FyiCharacterRemoteReader,
    parseFyiCharacterBucketSize,
    parseFyiCharacterRemotePreflightCli,
    runFyiCharacterRemotePreflightK24,
} from "./fyi-character-release-preflight";

const hash = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
const jsonBytes = (value: unknown) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);

async function releaseFixture() {
    const root = await mkdtemp(join(tmpdir(), "fyi-k24-"));
    const generatedAt = "2026-08-11T00:56:35.327Z";
    const characters = [{
        id: "1000001", portraitURL: "images/v2/portrait_1000001.png", portraitFilename: "portrait_1000001",
        transformations: [{ id: "4000001", portraitURL: "images/v2/portrait_4000001.png", portraitFilename: "portrait_4000001", transformations: [] }],
    }] as any;
    const artifact = buildCharacterDatasetArtifact(characters, { generatedAt, datasetVersion: generatedAt });
    const sourceMarker = Buffer.from("ready-marker\n");
    const portraitBytes = new Map<string, Buffer>([
        ["images/v2/portrait_1000001.png", Buffer.from("portrait-a")],
        ["images/v2/portrait_4000001.png", Buffer.from("portrait-b")],
    ]);
    const portraits = [...portraitBytes].map(([objectKey, bytes]) => ({
        objectKey, fileName: objectKey.split("/").pop()!, sha256: hash(bytes), sizeBytes: bytes.length,
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
    } as any;
    const release = buildFyiCharacterReleaseK21({ candidateGzip: artifact.gzipBuffer, candidateManifest: artifact.manifest, candidateReadyMarker: sourceMarker, k20, portraits });
    const plan = buildFyiCharacterReleaseK22(release);
    const receipt = buildFyiCharacterReleaseK23(release, plan);
    const directory = join(root, FYI_CHARACTER_RELEASE_ROOT, release.releaseId);
    await mkdir(join(directory, "portraits"), { recursive: true });
    const localManifest: any = { ...release.dataset };
    delete localManifest.localFileName;
    const marker = {
        schemaVersion: 1, contract: "dokkan-fyi-character-release-ready-k21-k23", contractVersion: "1.0.0", releaseId: release.releaseId,
        files: {
            [FYI_CHARACTER_RELEASE_REPORT]: hash(jsonBytes(release)),
            [FYI_CHARACTER_RELEASE_PLAN]: hash(jsonBytes(plan)),
            [FYI_CHARACTER_RELEASE_RECEIPT]: hash(jsonBytes(receipt)),
            [FYI_CHARACTER_RELEASE_K20]: hash(jsonBytes(k20)),
            [FYI_CHARACTER_RELEASE_SOURCE_MARKER]: hash(sourceMarker),
            "characters.json.gz": release.dataset.sha256,
            "characters-manifest.json": hash(jsonBytes(localManifest)),
            "characters-manifest.remote.json": hash(jsonBytes(plan.remoteManifest)),
        },
        portraitInventorySha256: release.portraits.inventorySha256,
    };
    await Promise.all([
        writeFile(join(directory, FYI_CHARACTER_RELEASE_REPORT), jsonBytes(release)),
        writeFile(join(directory, FYI_CHARACTER_RELEASE_PLAN), jsonBytes(plan)),
        writeFile(join(directory, FYI_CHARACTER_RELEASE_RECEIPT), jsonBytes(receipt)),
        writeFile(join(directory, FYI_CHARACTER_RELEASE_K20), jsonBytes(k20)),
        writeFile(join(directory, FYI_CHARACTER_RELEASE_SOURCE_MARKER), sourceMarker),
        writeFile(join(directory, "characters.json.gz"), artifact.gzipBuffer),
        writeFile(join(directory, "characters-manifest.json"), jsonBytes(localManifest)),
        writeFile(join(directory, "characters-manifest.remote.json"), jsonBytes(plan.remoteManifest)),
        ...[...portraitBytes].map(([key, bytes]) => writeFile(join(directory, "portraits", key.split("/").pop()!), bytes)),
    ]);
    await writeFile(join(directory, FYI_CHARACTER_RELEASE_READY), jsonBytes(marker));
    return { root, release, plan, receipt, artifact, portraitBytes, directory };
}

function fakeReader(values: Map<string, { statusCode: number, bytes: Buffer } | Error>): FyiCharacterRemoteReader {
    return { read: async (key, _max, consume) => {
        const value = values.get(key);
        if (!value) throw new Error(`missing fake ${key}`);
        if (value instanceof Error) throw value;
        consume(value.bytes.length);
        return value;
    } };
}

const bucketReader = (reported = "341 MB"): FyiCharacterBucketSizeReader => ({
    read: async () => parseFyiCharacterBucketSize(reported),
});

describe("FYI character remote preflight K24", () => {
    it("requires the exact explicit remote CLI", () => {
        const id = `${"a".repeat(64)}-${"b".repeat(64)}`;
        deepStrictEqual(parseFyiCharacterRemotePreflightCli(["--opt-in-k24", "--release-id", id, "--remote"]), { releaseId: id });
        for (const args of [[], ["--opt-in-k24"], ["--opt-in-k24", "--release-id", id, "--local"], ["--release-id", id, "--remote", "--opt-in-k24"]]) {
            throws(() => parseFyiCharacterRemotePreflightCli(args), /requires exactly/);
        }
    });

    it("uses a conservative upper bound for rounded Wrangler sizes", () => {
        deepStrictEqual(parseFyiCharacterBucketSize("341 MB"), { reported: "341 MB", conservativeUpperBoundBytes: 342_000_000 });
        deepStrictEqual(parseFyiCharacterBucketSize("1.25 GB"), { reported: "1.25 GB", conservativeUpperBoundBytes: 1_260_000_000 });
        throws(() => parseFyiCharacterBucketSize("341 MiB"), /unsupported/);
    });

    it("revalidates the complete local release before remote inspection", async () => {
        const fixture = await releaseFixture();
        try {
            const validated = await readValidatedFyiCharacterRelease(fixture.root, fixture.release.releaseId);
            equal(validated.release.releaseId, fixture.release.releaseId);
            const k20Path = join(fixture.directory, FYI_CHARACTER_RELEASE_K20);
            const originalK20 = await readFile(k20Path);
            await writeFile(k20Path, Buffer.from(originalK20.toString("utf8").replace("NO-GO", "MAYBE")));
            await rejects(() => readValidatedFyiCharacterRelease(fixture.root, fixture.release.releaseId), /metadata rejected/);
            await writeFile(k20Path, originalK20);
            await writeFile(join(fixture.directory, "portraits", "portrait_1000001.png"), "changed");
            await rejects(() => readValidatedFyiCharacterRelease(fixture.root, fixture.release.releaseId), /portrait differs/);
        } finally { await rm(fixture.root, { recursive: true, force: true }); }
    });

    it("returns GO when immutable objects are matching or missing and the bucket remains safe", async () => {
        const fixture = await releaseFixture();
        try {
            const values = new Map<string, { statusCode: number, bytes: Buffer } | Error>();
            for (const object of fixture.plan.objects) {
                if (object.kind === "payload") values.set(object.objectKey, { statusCode: 404, bytes: Buffer.alloc(0) });
                if (object.kind === "portrait") values.set(object.objectKey, { statusCode: 200, bytes: fixture.portraitBytes.get(object.objectKey)! });
                if (object.kind === "manifest") values.set(object.objectKey, { statusCode: 200, bytes: Buffer.from("{}\n") });
            }
            const report = await runFyiCharacterRemotePreflightK24({
                fyiRoot: fixture.root, releaseId: fixture.release.releaseId,
                checkedAt: "2026-08-11T03:00:00.000Z", reader: fakeReader(values), bucketSizeReader: bucketReader(), writeReport: false,
            });
            equal(report.readiness.remoteReadOnlyPreflight, "GO");
            deepStrictEqual(report.objectSummary, { matching: 2, missing: 1, conflict: 0, failed: 0, total: 3 });
            equal(report.manifest.status, "different");
            equal(report.checks.noRemoteMutation, true);
            equal(report.readiness.publicationAuthorization, "REQUIRED");
            equal(report.readiness.r2Mutation, "NO-GO");
            equal(report.budget.bytesNewIfPublished, fixture.artifact.gzipBuffer.length + fixture.plan.objects.find(value => value.kind === "manifest")!.sizeBytes);
        } finally { await rm(fixture.root, { recursive: true, force: true }); }
    });

    it("fails closed on immutable conflicts, read errors, and unsafe bucket usage", async () => {
        const fixture = await releaseFixture();
        try {
            const values = new Map<string, { statusCode: number, bytes: Buffer } | Error>();
            for (const object of fixture.plan.objects) {
                if (object.kind === "payload") values.set(object.objectKey, { statusCode: 200, bytes: fixture.artifact.gzipBuffer });
                if (object.kind === "portrait") values.set(object.objectKey, object.objectKey.includes("1000001")
                    ? { statusCode: 200, bytes: Buffer.from("wrong") } : new Error("network unavailable"));
                if (object.kind === "manifest") values.set(object.objectKey, { statusCode: 404, bytes: Buffer.alloc(0) });
            }
            const report = await runFyiCharacterRemotePreflightK24({
                fyiRoot: fixture.root, releaseId: fixture.release.releaseId,
                reader: fakeReader(values), bucketSizeReader: bucketReader("9.99 GB"), writeReport: false,
            });
            equal(report.readiness.remoteReadOnlyPreflight, "NO-GO");
            equal(report.objectSummary.conflict, 1);
            equal(report.objectSummary.failed, 1);
            equal(report.budget.withinBucketLimit, false);
        } finally { await rm(fixture.root, { recursive: true, force: true }); }
    });

    it("writes only an ignored local report when requested", async () => {
        const fixture = await releaseFixture();
        try {
            const values = new Map<string, { statusCode: number, bytes: Buffer } | Error>();
            for (const object of fixture.plan.objects) values.set(object.objectKey, { statusCode: 404, bytes: Buffer.alloc(0) });
            const report = await runFyiCharacterRemotePreflightK24({
                fyiRoot: fixture.root, releaseId: fixture.release.releaseId,
                reader: fakeReader(values), bucketSizeReader: bucketReader(), writeReport: true,
            });
            const reportRoots = await readdir(join(fixture.root, "preflight-k24", fixture.release.releaseId));
            equal(reportRoots.length, 1);
            const stored = JSON.parse(await readFile(join(fixture.root, "preflight-k24", fixture.release.releaseId, reportRoots[0], "remote-preflight-k24.json"), "utf8"));
            equal(stored.releaseId, report.releaseId);
            equal(stored.checks.readOnlyTransport, true);
        } finally { await rm(fixture.root, { recursive: true, force: true }); }
    });

    it("rejects a bucket reader that understates the parsed upper bound", async () => {
        const fixture = await releaseFixture();
        try {
            const values = new Map<string, { statusCode: number, bytes: Buffer } | Error>();
            for (const object of fixture.plan.objects) values.set(object.objectKey, { statusCode: 404, bytes: Buffer.alloc(0) });
            await rejects(() => runFyiCharacterRemotePreflightK24({
                fyiRoot: fixture.root, releaseId: fixture.release.releaseId,
                reader: fakeReader(values), bucketSizeReader: { read: async () => ({ reported: "341 MB", conservativeUpperBoundBytes: 0 }) },
                writeReport: false,
            }), /bucket size reader result rejected/);
        } finally { await rm(fixture.root, { recursive: true, force: true }); }
    });

    it("rejects an external junction in the report path", async function () {
        const fixture = await releaseFixture();
        const outside = await mkdtemp(join(tmpdir(), "fyi-k24-outside-"));
        try {
            try { await symlink(outside, join(fixture.root, "preflight-k24"), "junction"); } catch (error: any) {
                if (error?.code === "EPERM") { this.skip(); return; }
                throw error;
            }
            const values = new Map<string, { statusCode: number, bytes: Buffer } | Error>();
            for (const object of fixture.plan.objects) values.set(object.objectKey, { statusCode: 404, bytes: Buffer.alloc(0) });
            await rejects(() => runFyiCharacterRemotePreflightK24({
                fyiRoot: fixture.root, releaseId: fixture.release.releaseId,
                reader: fakeReader(values), bucketSizeReader: bucketReader(), writeReport: true,
            }), /report directory rejected/);
        } finally {
            await rm(fixture.root, { recursive: true, force: true });
            await rm(outside, { recursive: true, force: true });
        }
    });

    it("rejects a pre-existing hardlinked report", async () => {
        const fixture = await releaseFixture();
        const outside = await mkdtemp(join(tmpdir(), "fyi-k24-hardlink-"));
        try {
            const values = new Map<string, { statusCode: number, bytes: Buffer } | Error>();
            for (const object of fixture.plan.objects) values.set(object.objectKey, { statusCode: 404, bytes: Buffer.alloc(0) });
            const options = {
                fyiRoot: fixture.root, releaseId: fixture.release.releaseId, checkedAt: "2026-08-11T03:00:00.000Z",
                reader: fakeReader(values), bucketSizeReader: bucketReader(), writeReport: false,
            };
            const report = await runFyiCharacterRemotePreflightK24(options);
            const reportHash = hash(jsonBytes(report));
            const reportRoot = join(fixture.root, "preflight-k24", fixture.release.releaseId, reportHash);
            await mkdir(reportRoot, { recursive: true });
            const external = join(outside, "report.json");
            await writeFile(external, jsonBytes(report));
            await link(external, join(reportRoot, "remote-preflight-k24.json"));
            await rejects(() => runFyiCharacterRemotePreflightK24({ ...options, writeReport: true }), /existing report identity rejected/);
        } finally {
            await rm(fixture.root, { recursive: true, force: true });
            await rm(outside, { recursive: true, force: true });
        }
    });
});
