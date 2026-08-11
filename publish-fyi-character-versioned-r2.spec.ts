import { createHash } from "crypto";
import { deepStrictEqual, equal, rejects, throws } from "assert";
import { mkdtemp, mkdir, rm, writeFile } from "fs/promises";
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
import { FyiCharacterRemoteReader, parseFyiCharacterBucketSize } from "./fyi-character-release-preflight";
import { buildFyiCharacterVersionedDelivery } from "./fyi-character-versioned-portraits";
import {
    FyiCharacterConditionalR2Writer,
    FyiCharacterR2Object,
    FyiCharacterR2WriteInput,
    parseFyiCharacterVersionedPublisherArgs,
    publishFyiCharacterVersionedR2,
} from "./publish-fyi-character-versioned-r2";

const hash = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
const jsonBytes = (value: unknown) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);

async function releaseFixture() {
    const root = await mkdtemp(join(tmpdir(), "fyi-k28-"));
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
        sources: { candidate: { datasetVersion: generatedAt, generatedAt, payloadFile: "characters.json.gz", payloadSha256: artifact.manifest.sha256,
            payloadSizeBytes: artifact.manifest.sizeBytes, uncompressedSizeBytes: artifact.manifest.uncompressedSizeBytes, characterCount: 1 } },
        checks: { complete: true }, failures: { total: 0, examples: [], exampleLimit: 5 },
        readiness: { candidateGenerationValidation: "GO", promotion: "NO-GO", production: "NO-GO", publisher: "NO-GO", android: "NO-GO", r2: "NO-GO" },
    } as any;
    const release = buildFyiCharacterReleaseK21({ candidateGzip: artifact.gzipBuffer, candidateManifest: artifact.manifest,
        candidateReadyMarker: sourceMarker, k20, portraits });
    const plan = buildFyiCharacterReleaseK22(release);
    const receipt = buildFyiCharacterReleaseK23(release, plan);
    const directory = join(root, FYI_CHARACTER_RELEASE_ROOT, release.releaseId);
    await mkdir(join(directory, "portraits"), { recursive: true });
    const localManifest: any = { ...release.dataset }; delete localManifest.localFileName;
    const marker = {
        schemaVersion: 1, contract: "dokkan-fyi-character-release-ready-k21-k23", contractVersion: "1.0.0", releaseId: release.releaseId,
        files: {
            [FYI_CHARACTER_RELEASE_REPORT]: hash(jsonBytes(release)), [FYI_CHARACTER_RELEASE_PLAN]: hash(jsonBytes(plan)),
            [FYI_CHARACTER_RELEASE_RECEIPT]: hash(jsonBytes(receipt)), [FYI_CHARACTER_RELEASE_K20]: hash(jsonBytes(k20)),
            [FYI_CHARACTER_RELEASE_SOURCE_MARKER]: hash(sourceMarker), "characters.json.gz": release.dataset.sha256,
            "characters-manifest.json": hash(jsonBytes(localManifest)), "characters-manifest.remote.json": hash(jsonBytes(plan.remoteManifest)),
        }, portraitInventorySha256: release.portraits.inventorySha256,
    };
    await Promise.all([
        writeFile(join(directory, FYI_CHARACTER_RELEASE_REPORT), jsonBytes(release)), writeFile(join(directory, FYI_CHARACTER_RELEASE_PLAN), jsonBytes(plan)),
        writeFile(join(directory, FYI_CHARACTER_RELEASE_RECEIPT), jsonBytes(receipt)), writeFile(join(directory, FYI_CHARACTER_RELEASE_K20), jsonBytes(k20)),
        writeFile(join(directory, FYI_CHARACTER_RELEASE_SOURCE_MARKER), sourceMarker), writeFile(join(directory, "characters.json.gz"), artifact.gzipBuffer),
        writeFile(join(directory, "characters-manifest.json"), jsonBytes(localManifest)),
        writeFile(join(directory, "characters-manifest.remote.json"), jsonBytes(plan.remoteManifest)),
        ...[...portraitBytes].map(([key, bytes]) => writeFile(join(directory, "portraits", key.split("/").pop()!), bytes)),
    ]);
    await writeFile(join(directory, FYI_CHARACTER_RELEASE_READY), jsonBytes(marker));
    const validated = await readValidatedFyiCharacterRelease(root, release.releaseId);
    return { root, release, delivery: buildFyiCharacterVersionedDelivery(validated) };
}

function missingReader(): FyiCharacterRemoteReader {
    return { read: async (_key, _limit, consume) => { consume(0); return { statusCode: 404, bytes: Buffer.alloc(0) }; } };
}

function memoryWriter(failCreateAt = -1): {
    writer: FyiCharacterConditionalR2Writer;
    actions: string[];
    objects: Map<string, FyiCharacterR2Object>;
} {
    const objects = new Map<string, FyiCharacterR2Object>();
    const actions: string[] = [];
    let creates = 0;
    const stored = (input: FyiCharacterR2WriteInput): FyiCharacterR2Object => ({
        bytes: Buffer.from(input.bytes), etag: `\"${hash(input.bytes)}\"`, contentType: input.contentType, cacheControl: input.cacheControl,
    });
    return { actions, objects, writer: {
        read: async objectKey => { actions.push(`read ${objectKey}`); return objects.get(objectKey); },
        createIfAbsent: async input => {
            actions.push(`create ${input.objectKey}`);
            if (creates++ === failCreateAt) throw new Error("controlled create failure");
            if (objects.has(input.objectKey)) return "precondition_failed";
            objects.set(input.objectKey, stored(input));
            return "written";
        },
        replaceIfMatch: async (input, etag) => {
            actions.push(`replace ${input.objectKey}`);
            const current = objects.get(input.objectKey);
            if (!current || current.etag !== etag) return "precondition_failed";
            objects.set(input.objectKey, stored(input));
            return "written";
        },
    } };
}

describe("FYI character versioned R2 publisher K28", () => {
    it("requires an exact dry-run or delivery-confirmed publish command", () => {
        const release = `${"a".repeat(64)}-${"b".repeat(64)}`;
        const delivery = `${"c".repeat(64)}-${"d".repeat(64)}`;
        deepStrictEqual(parseFyiCharacterVersionedPublisherArgs(["--opt-in-k28", "--release-id", release, "--remote", "--dry-run"]),
            { releaseId: release, mode: "dry-run" });
        deepStrictEqual(parseFyiCharacterVersionedPublisherArgs(["--opt-in-k28", "--release-id", release, "--remote", "--publish", "--confirm-delivery", delivery]),
            { releaseId: release, mode: "publish", confirmedDeliveryId: delivery });
        throws(() => parseFyiCharacterVersionedPublisherArgs(["--opt-in-k28", "--release-id", release, "--remote", "--publish"]), /requires/);
    });

    it("performs a remote dry-run without invoking write commands", async () => {
        const fixture = await releaseFixture();
        try {
            const commands = memoryWriter();
            const result = await publishFyiCharacterVersionedR2({ fyiRoot: fixture.root,
                publisher: { releaseId: fixture.release.releaseId, mode: "dry-run" }, remoteReader: missingReader(),
                bucketSizeReader: { read: async () => parseFyiCharacterBucketSize("343 MB") }, conditionalWriter: commands.writer });
            equal(result.mode, "dry-run"); equal(result.plannedUploads, 3); equal(result.uploaded, 0);
            equal(result.manifestPromoted, false); deepStrictEqual(commands.actions, []);
        } finally { await rm(fixture.root, { recursive: true, force: true }); }
    });

    it("uploads and verifies immutable objects before promoting the manifest", async () => {
        const fixture = await releaseFixture();
        try {
            const commands = memoryWriter();
            const result = await publishFyiCharacterVersionedR2({ fyiRoot: fixture.root,
                publisher: { releaseId: fixture.release.releaseId, mode: "publish", confirmedDeliveryId: fixture.delivery.report.deliveryId },
                remoteReader: missingReader(), bucketSizeReader: { read: async () => parseFyiCharacterBucketSize("343 MB") }, conditionalWriter: commands.writer });
            equal(result.uploaded, 3); equal(result.verified, 4); equal(result.manifestPromoted, true);
            equal(result.checks.everyUploadVerified, true);
            equal(commands.actions.some(action => action.includes("delete")), false);
            deepStrictEqual(commands.actions.slice(-2), [
                "create characters-manifest.json",
                "read characters-manifest.json",
            ]);
        } finally { await rm(fixture.root, { recursive: true, force: true }); }
    });

    it("never promotes the manifest after an immutable upload failure", async () => {
        const fixture = await releaseFixture();
        try {
            const commands = memoryWriter(1);
            await rejects(() => publishFyiCharacterVersionedR2({ fyiRoot: fixture.root,
                publisher: { releaseId: fixture.release.releaseId, mode: "publish", confirmedDeliveryId: fixture.delivery.report.deliveryId },
                remoteReader: missingReader(), bucketSizeReader: { read: async () => parseFyiCharacterBucketSize("343 MB") }, conditionalWriter: commands.writer }), /controlled create failure/);
            equal(commands.actions.some(action => /^(?:create|replace) characters-manifest\.json$/.test(action)), false);
        } finally { await rm(fixture.root, { recursive: true, force: true }); }
    });

    it("never overwrites a direct R2 conflict hidden by a cached public 404", async () => {
        const fixture = await releaseFixture();
        try {
            const commands = memoryWriter();
            const firstImmutable = fixture.delivery.plan.objects.find(object => object.kind !== "manifest")!;
            commands.objects.set(firstImmutable.objectKey, { bytes: Buffer.from("conflict"), etag: "\"conflict\"",
                contentType: "application/gzip", cacheControl: "public, max-age=31536000, immutable" });
            await rejects(() => publishFyiCharacterVersionedR2({ fyiRoot: fixture.root,
                publisher: { releaseId: fixture.release.releaseId, mode: "publish", confirmedDeliveryId: fixture.delivery.report.deliveryId },
                remoteReader: missingReader(), bucketSizeReader: { read: async () => parseFyiCharacterBucketSize("343 MB") }, conditionalWriter: commands.writer }),
            /remote object bytes or metadata conflict/);
            equal(commands.actions.some(action => action.startsWith("create ")), false);
        } finally { await rm(fixture.root, { recursive: true, force: true }); }
    });

    it("does not overwrite a manifest that changed after the public preflight", async () => {
        const fixture = await releaseFixture();
        try {
            const commands = memoryWriter();
            commands.objects.set("characters-manifest.json", { bytes: Buffer.from("changed concurrently"), etag: "\"changed\"",
                contentType: "application/json", cacheControl: "no-store" });
            await rejects(() => publishFyiCharacterVersionedR2({ fyiRoot: fixture.root,
                publisher: { releaseId: fixture.release.releaseId, mode: "publish", confirmedDeliveryId: fixture.delivery.report.deliveryId },
                remoteReader: missingReader(), bucketSizeReader: { read: async () => parseFyiCharacterBucketSize("343 MB") }, conditionalWriter: commands.writer }),
            /direct R2 manifest/);
            equal(commands.actions.some(action => action === "replace characters-manifest.json"), false);
        } finally { await rm(fixture.root, { recursive: true, force: true }); }
    });

    it("rejects immutable objects whose cache metadata is not exact", async () => {
        const fixture = await releaseFixture();
        try {
            const commands = memoryWriter();
            const object = fixture.delivery.plan.objects.find(candidate => candidate.kind === "payload")!;
            commands.objects.set(object.objectKey, { bytes: fixture.delivery.payload, etag: "\"existing\"",
                contentType: "application/gzip", cacheControl: "no-cache" });
            await rejects(() => publishFyiCharacterVersionedR2({ fyiRoot: fixture.root,
                publisher: { releaseId: fixture.release.releaseId, mode: "publish", confirmedDeliveryId: fixture.delivery.report.deliveryId },
                remoteReader: missingReader(), bucketSizeReader: { read: async () => parseFyiCharacterBucketSize("343 MB") }, conditionalWriter: commands.writer }),
            /bytes or metadata conflict/);
        } finally { await rm(fixture.root, { recursive: true, force: true }); }
    });

    it("fails closed when a concurrent immutable create stores conflicting bytes", async () => {
        const fixture = await releaseFixture();
        try {
            const commands = memoryWriter();
            const originalCreate = commands.writer.createIfAbsent;
            let raced = false;
            commands.writer.createIfAbsent = async input => {
                if (!raced) {
                    raced = true;
                    commands.objects.set(input.objectKey, { bytes: Buffer.from("race-conflict"), etag: "\"race\"",
                        contentType: input.contentType, cacheControl: input.cacheControl });
                    return "precondition_failed";
                }
                return originalCreate(input);
            };
            await rejects(() => publishFyiCharacterVersionedR2({ fyiRoot: fixture.root,
                publisher: { releaseId: fixture.release.releaseId, mode: "publish", confirmedDeliveryId: fixture.delivery.report.deliveryId },
                remoteReader: missingReader(), bucketSizeReader: { read: async () => parseFyiCharacterBucketSize("343 MB") }, conditionalWriter: commands.writer }),
            /bytes or metadata conflict/);
        } finally { await rm(fixture.root, { recursive: true, force: true }); }
    });

    it("fails closed when the manifest CAS loses to a different publication", async () => {
        const fixture = await releaseFixture();
        try {
            const commands = memoryWriter();
            const oldManifest = Buffer.from("old manifest");
            commands.objects.set("characters-manifest.json", { bytes: oldManifest, etag: "\"old\"",
                contentType: "application/json", cacheControl: "no-store" });
            const reader: FyiCharacterRemoteReader = { read: async (key, _limit, consume) => {
                if (key === "characters-manifest.json") { consume(oldManifest.length); return { statusCode: 200, bytes: oldManifest }; }
                consume(0); return { statusCode: 404, bytes: Buffer.alloc(0) };
            } };
            commands.writer.replaceIfMatch = async input => {
                commands.objects.set(input.objectKey, { bytes: Buffer.from("other publication"), etag: "\"other\"",
                    contentType: input.contentType, cacheControl: input.cacheControl });
                return "precondition_failed";
            };
            await rejects(() => publishFyiCharacterVersionedR2({ fyiRoot: fixture.root,
                publisher: { releaseId: fixture.release.releaseId, mode: "publish", confirmedDeliveryId: fixture.delivery.report.deliveryId },
                remoteReader: reader, bucketSizeReader: { read: async () => parseFyiCharacterBucketSize("343 MB") }, conditionalWriter: commands.writer }),
            /bytes or metadata conflict/);
        } finally { await rm(fixture.root, { recursive: true, force: true }); }
    });

    it("rejects a wrong delivery confirmation before any remote read", async () => {
        const fixture = await releaseFixture();
        try {
            let reads = 0;
            await rejects(() => publishFyiCharacterVersionedR2({ fyiRoot: fixture.root,
                publisher: { releaseId: fixture.release.releaseId, mode: "publish", confirmedDeliveryId: `${"a".repeat(64)}-${"b".repeat(64)}` },
                remoteReader: { read: async () => { reads += 1; throw new Error("must not read"); } },
                bucketSizeReader: { read: async () => parseFyiCharacterBucketSize("343 MB") } }), /does not match/);
            equal(reads, 0);
        } finally { await rm(fixture.root, { recursive: true, force: true }); }
    });
});
