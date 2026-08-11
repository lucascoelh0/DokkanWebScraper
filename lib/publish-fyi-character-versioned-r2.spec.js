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
const fyi_character_versioned_portraits_1 = require("./fyi-character-versioned-portraits");
const publish_fyi_character_versioned_r2_1 = require("./publish-fyi-character-versioned-r2");
const hash = (bytes) => (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
const jsonBytes = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
async function releaseFixture() {
    const root = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "fyi-k28-"));
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
        sources: { candidate: { datasetVersion: generatedAt, generatedAt, payloadFile: "characters.json.gz", payloadSha256: artifact.manifest.sha256,
                payloadSizeBytes: artifact.manifest.sizeBytes, uncompressedSizeBytes: artifact.manifest.uncompressedSizeBytes, characterCount: 1 } },
        checks: { complete: true }, failures: { total: 0, examples: [], exampleLimit: 5 },
        readiness: { candidateGenerationValidation: "GO", promotion: "NO-GO", production: "NO-GO", publisher: "NO-GO", android: "NO-GO", r2: "NO-GO" },
    };
    const release = (0, fyi_character_release_1.buildFyiCharacterReleaseK21)({ candidateGzip: artifact.gzipBuffer, candidateManifest: artifact.manifest,
        candidateReadyMarker: sourceMarker, k20, portraits });
    const plan = (0, fyi_character_release_1.buildFyiCharacterReleaseK22)(release);
    const receipt = (0, fyi_character_release_1.buildFyiCharacterReleaseK23)(release, plan);
    const directory = (0, path_1.join)(root, fyi_character_release_1.FYI_CHARACTER_RELEASE_ROOT, release.releaseId);
    await (0, promises_1.mkdir)((0, path_1.join)(directory, "portraits"), { recursive: true });
    const localManifest = { ...release.dataset };
    delete localManifest.localFileName;
    const marker = {
        schemaVersion: 1, contract: "dokkan-fyi-character-release-ready-k21-k23", contractVersion: "1.0.0", releaseId: release.releaseId,
        files: {
            [fyi_character_release_1.FYI_CHARACTER_RELEASE_REPORT]: hash(jsonBytes(release)), [fyi_character_release_1.FYI_CHARACTER_RELEASE_PLAN]: hash(jsonBytes(plan)),
            [fyi_character_release_1.FYI_CHARACTER_RELEASE_RECEIPT]: hash(jsonBytes(receipt)), [fyi_character_release_1.FYI_CHARACTER_RELEASE_K20]: hash(jsonBytes(k20)),
            [fyi_character_release_1.FYI_CHARACTER_RELEASE_SOURCE_MARKER]: hash(sourceMarker), "characters.json.gz": release.dataset.sha256,
            "characters-manifest.json": hash(jsonBytes(localManifest)), "characters-manifest.remote.json": hash(jsonBytes(plan.remoteManifest)),
        }, portraitInventorySha256: release.portraits.inventorySha256,
    };
    await Promise.all([
        (0, promises_1.writeFile)((0, path_1.join)(directory, fyi_character_release_1.FYI_CHARACTER_RELEASE_REPORT), jsonBytes(release)), (0, promises_1.writeFile)((0, path_1.join)(directory, fyi_character_release_1.FYI_CHARACTER_RELEASE_PLAN), jsonBytes(plan)),
        (0, promises_1.writeFile)((0, path_1.join)(directory, fyi_character_release_1.FYI_CHARACTER_RELEASE_RECEIPT), jsonBytes(receipt)), (0, promises_1.writeFile)((0, path_1.join)(directory, fyi_character_release_1.FYI_CHARACTER_RELEASE_K20), jsonBytes(k20)),
        (0, promises_1.writeFile)((0, path_1.join)(directory, fyi_character_release_1.FYI_CHARACTER_RELEASE_SOURCE_MARKER), sourceMarker), (0, promises_1.writeFile)((0, path_1.join)(directory, "characters.json.gz"), artifact.gzipBuffer),
        (0, promises_1.writeFile)((0, path_1.join)(directory, "characters-manifest.json"), jsonBytes(localManifest)),
        (0, promises_1.writeFile)((0, path_1.join)(directory, "characters-manifest.remote.json"), jsonBytes(plan.remoteManifest)),
        ...[...portraitBytes].map(([key, bytes]) => (0, promises_1.writeFile)((0, path_1.join)(directory, "portraits", key.split("/").pop()), bytes)),
    ]);
    await (0, promises_1.writeFile)((0, path_1.join)(directory, fyi_character_release_1.FYI_CHARACTER_RELEASE_READY), jsonBytes(marker));
    const validated = await (0, fyi_character_release_1.readValidatedFyiCharacterRelease)(root, release.releaseId);
    return { root, release, delivery: (0, fyi_character_versioned_portraits_1.buildFyiCharacterVersionedDelivery)(validated) };
}
function missingReader() {
    return { read: async (_key, _limit, consume) => { consume(0); return { statusCode: 404, bytes: Buffer.alloc(0) }; } };
}
function memoryWriter(failCreateAt = -1) {
    const objects = new Map();
    const actions = [];
    let creates = 0;
    const stored = (input) => ({
        bytes: Buffer.from(input.bytes), etag: `\"${hash(input.bytes)}\"`, contentType: input.contentType, cacheControl: input.cacheControl,
    });
    return { actions, objects, writer: {
            read: async (objectKey) => { actions.push(`read ${objectKey}`); return objects.get(objectKey); },
            createIfAbsent: async (input) => {
                actions.push(`create ${input.objectKey}`);
                if (creates++ === failCreateAt)
                    throw new Error("controlled create failure");
                if (objects.has(input.objectKey))
                    return "precondition_failed";
                objects.set(input.objectKey, stored(input));
                return "written";
            },
            replaceIfMatch: async (input, etag) => {
                actions.push(`replace ${input.objectKey}`);
                const current = objects.get(input.objectKey);
                if (!current || current.etag !== etag)
                    return "precondition_failed";
                objects.set(input.objectKey, stored(input));
                return "written";
            },
        } };
}
describe("FYI character versioned R2 publisher K28", () => {
    it("requires an exact dry-run or delivery-confirmed publish command", () => {
        const release = `${"a".repeat(64)}-${"b".repeat(64)}`;
        const delivery = `${"c".repeat(64)}-${"d".repeat(64)}`;
        (0, assert_1.deepStrictEqual)((0, publish_fyi_character_versioned_r2_1.parseFyiCharacterVersionedPublisherArgs)(["--opt-in-k28", "--release-id", release, "--remote", "--dry-run"]), { releaseId: release, mode: "dry-run" });
        (0, assert_1.deepStrictEqual)((0, publish_fyi_character_versioned_r2_1.parseFyiCharacterVersionedPublisherArgs)(["--opt-in-k28", "--release-id", release, "--remote", "--publish", "--confirm-delivery", delivery]), { releaseId: release, mode: "publish", confirmedDeliveryId: delivery });
        (0, assert_1.throws)(() => (0, publish_fyi_character_versioned_r2_1.parseFyiCharacterVersionedPublisherArgs)(["--opt-in-k28", "--release-id", release, "--remote", "--publish"]), /requires/);
    });
    it("performs a remote dry-run without invoking write commands", async () => {
        const fixture = await releaseFixture();
        try {
            const commands = memoryWriter();
            const result = await (0, publish_fyi_character_versioned_r2_1.publishFyiCharacterVersionedR2)({ fyiRoot: fixture.root,
                publisher: { releaseId: fixture.release.releaseId, mode: "dry-run" }, remoteReader: missingReader(),
                bucketSizeReader: { read: async () => (0, fyi_character_release_preflight_1.parseFyiCharacterBucketSize)("343 MB") }, conditionalWriter: commands.writer });
            (0, assert_1.equal)(result.mode, "dry-run");
            (0, assert_1.equal)(result.plannedUploads, 3);
            (0, assert_1.equal)(result.uploaded, 0);
            (0, assert_1.equal)(result.manifestPromoted, false);
            (0, assert_1.deepStrictEqual)(commands.actions, []);
        }
        finally {
            await (0, promises_1.rm)(fixture.root, { recursive: true, force: true });
        }
    });
    it("uploads and verifies immutable objects before promoting the manifest", async () => {
        const fixture = await releaseFixture();
        try {
            const commands = memoryWriter();
            const result = await (0, publish_fyi_character_versioned_r2_1.publishFyiCharacterVersionedR2)({ fyiRoot: fixture.root,
                publisher: { releaseId: fixture.release.releaseId, mode: "publish", confirmedDeliveryId: fixture.delivery.report.deliveryId },
                remoteReader: missingReader(), bucketSizeReader: { read: async () => (0, fyi_character_release_preflight_1.parseFyiCharacterBucketSize)("343 MB") }, conditionalWriter: commands.writer });
            (0, assert_1.equal)(result.uploaded, 3);
            (0, assert_1.equal)(result.verified, 4);
            (0, assert_1.equal)(result.manifestPromoted, true);
            (0, assert_1.equal)(result.checks.everyUploadVerified, true);
            (0, assert_1.equal)(commands.actions.some(action => action.includes("delete")), false);
            (0, assert_1.deepStrictEqual)(commands.actions.slice(-2), [
                "create characters-manifest.json",
                "read characters-manifest.json",
            ]);
        }
        finally {
            await (0, promises_1.rm)(fixture.root, { recursive: true, force: true });
        }
    });
    it("never promotes the manifest after an immutable upload failure", async () => {
        const fixture = await releaseFixture();
        try {
            const commands = memoryWriter(1);
            await (0, assert_1.rejects)(() => (0, publish_fyi_character_versioned_r2_1.publishFyiCharacterVersionedR2)({ fyiRoot: fixture.root,
                publisher: { releaseId: fixture.release.releaseId, mode: "publish", confirmedDeliveryId: fixture.delivery.report.deliveryId },
                remoteReader: missingReader(), bucketSizeReader: { read: async () => (0, fyi_character_release_preflight_1.parseFyiCharacterBucketSize)("343 MB") }, conditionalWriter: commands.writer }), /controlled create failure/);
            (0, assert_1.equal)(commands.actions.some(action => /^(?:create|replace) characters-manifest\.json$/.test(action)), false);
        }
        finally {
            await (0, promises_1.rm)(fixture.root, { recursive: true, force: true });
        }
    });
    it("never overwrites a direct R2 conflict hidden by a cached public 404", async () => {
        const fixture = await releaseFixture();
        try {
            const commands = memoryWriter();
            const firstImmutable = fixture.delivery.plan.objects.find(object => object.kind !== "manifest");
            commands.objects.set(firstImmutable.objectKey, { bytes: Buffer.from("conflict"), etag: "\"conflict\"",
                contentType: "application/gzip", cacheControl: "public, max-age=31536000, immutable" });
            await (0, assert_1.rejects)(() => (0, publish_fyi_character_versioned_r2_1.publishFyiCharacterVersionedR2)({ fyiRoot: fixture.root,
                publisher: { releaseId: fixture.release.releaseId, mode: "publish", confirmedDeliveryId: fixture.delivery.report.deliveryId },
                remoteReader: missingReader(), bucketSizeReader: { read: async () => (0, fyi_character_release_preflight_1.parseFyiCharacterBucketSize)("343 MB") }, conditionalWriter: commands.writer }), /remote object bytes or metadata conflict/);
            (0, assert_1.equal)(commands.actions.some(action => action.startsWith("create ")), false);
        }
        finally {
            await (0, promises_1.rm)(fixture.root, { recursive: true, force: true });
        }
    });
    it("does not overwrite a manifest that changed after the public preflight", async () => {
        const fixture = await releaseFixture();
        try {
            const commands = memoryWriter();
            commands.objects.set("characters-manifest.json", { bytes: Buffer.from("changed concurrently"), etag: "\"changed\"",
                contentType: "application/json", cacheControl: "no-store" });
            await (0, assert_1.rejects)(() => (0, publish_fyi_character_versioned_r2_1.publishFyiCharacterVersionedR2)({ fyiRoot: fixture.root,
                publisher: { releaseId: fixture.release.releaseId, mode: "publish", confirmedDeliveryId: fixture.delivery.report.deliveryId },
                remoteReader: missingReader(), bucketSizeReader: { read: async () => (0, fyi_character_release_preflight_1.parseFyiCharacterBucketSize)("343 MB") }, conditionalWriter: commands.writer }), /direct R2 manifest/);
            (0, assert_1.equal)(commands.actions.some(action => action === "replace characters-manifest.json"), false);
        }
        finally {
            await (0, promises_1.rm)(fixture.root, { recursive: true, force: true });
        }
    });
    it("rejects immutable objects whose cache metadata is not exact", async () => {
        const fixture = await releaseFixture();
        try {
            const commands = memoryWriter();
            const object = fixture.delivery.plan.objects.find(candidate => candidate.kind === "payload");
            commands.objects.set(object.objectKey, { bytes: fixture.delivery.payload, etag: "\"existing\"",
                contentType: "application/gzip", cacheControl: "no-cache" });
            await (0, assert_1.rejects)(() => (0, publish_fyi_character_versioned_r2_1.publishFyiCharacterVersionedR2)({ fyiRoot: fixture.root,
                publisher: { releaseId: fixture.release.releaseId, mode: "publish", confirmedDeliveryId: fixture.delivery.report.deliveryId },
                remoteReader: missingReader(), bucketSizeReader: { read: async () => (0, fyi_character_release_preflight_1.parseFyiCharacterBucketSize)("343 MB") }, conditionalWriter: commands.writer }), /bytes or metadata conflict/);
        }
        finally {
            await (0, promises_1.rm)(fixture.root, { recursive: true, force: true });
        }
    });
    it("fails closed when a concurrent immutable create stores conflicting bytes", async () => {
        const fixture = await releaseFixture();
        try {
            const commands = memoryWriter();
            const originalCreate = commands.writer.createIfAbsent;
            let raced = false;
            commands.writer.createIfAbsent = async (input) => {
                if (!raced) {
                    raced = true;
                    commands.objects.set(input.objectKey, { bytes: Buffer.from("race-conflict"), etag: "\"race\"",
                        contentType: input.contentType, cacheControl: input.cacheControl });
                    return "precondition_failed";
                }
                return originalCreate(input);
            };
            await (0, assert_1.rejects)(() => (0, publish_fyi_character_versioned_r2_1.publishFyiCharacterVersionedR2)({ fyiRoot: fixture.root,
                publisher: { releaseId: fixture.release.releaseId, mode: "publish", confirmedDeliveryId: fixture.delivery.report.deliveryId },
                remoteReader: missingReader(), bucketSizeReader: { read: async () => (0, fyi_character_release_preflight_1.parseFyiCharacterBucketSize)("343 MB") }, conditionalWriter: commands.writer }), /bytes or metadata conflict/);
        }
        finally {
            await (0, promises_1.rm)(fixture.root, { recursive: true, force: true });
        }
    });
    it("fails closed when the manifest CAS loses to a different publication", async () => {
        const fixture = await releaseFixture();
        try {
            const commands = memoryWriter();
            const oldManifest = Buffer.from("old manifest");
            commands.objects.set("characters-manifest.json", { bytes: oldManifest, etag: "\"old\"",
                contentType: "application/json", cacheControl: "no-store" });
            const reader = { read: async (key, _limit, consume) => {
                    if (key === "characters-manifest.json") {
                        consume(oldManifest.length);
                        return { statusCode: 200, bytes: oldManifest };
                    }
                    consume(0);
                    return { statusCode: 404, bytes: Buffer.alloc(0) };
                } };
            commands.writer.replaceIfMatch = async (input) => {
                commands.objects.set(input.objectKey, { bytes: Buffer.from("other publication"), etag: "\"other\"",
                    contentType: input.contentType, cacheControl: input.cacheControl });
                return "precondition_failed";
            };
            await (0, assert_1.rejects)(() => (0, publish_fyi_character_versioned_r2_1.publishFyiCharacterVersionedR2)({ fyiRoot: fixture.root,
                publisher: { releaseId: fixture.release.releaseId, mode: "publish", confirmedDeliveryId: fixture.delivery.report.deliveryId },
                remoteReader: reader, bucketSizeReader: { read: async () => (0, fyi_character_release_preflight_1.parseFyiCharacterBucketSize)("343 MB") }, conditionalWriter: commands.writer }), /bytes or metadata conflict/);
        }
        finally {
            await (0, promises_1.rm)(fixture.root, { recursive: true, force: true });
        }
    });
    it("rejects a wrong delivery confirmation before any remote read", async () => {
        const fixture = await releaseFixture();
        try {
            let reads = 0;
            await (0, assert_1.rejects)(() => (0, publish_fyi_character_versioned_r2_1.publishFyiCharacterVersionedR2)({ fyiRoot: fixture.root,
                publisher: { releaseId: fixture.release.releaseId, mode: "publish", confirmedDeliveryId: `${"a".repeat(64)}-${"b".repeat(64)}` },
                remoteReader: { read: async () => { reads += 1; throw new Error("must not read"); } },
                bucketSizeReader: { read: async () => (0, fyi_character_release_preflight_1.parseFyiCharacterBucketSize)("343 MB") } }), /does not match/);
            (0, assert_1.equal)(reads, 0);
        }
        finally {
            await (0, promises_1.rm)(fixture.root, { recursive: true, force: true });
        }
    });
});
//# sourceMappingURL=publish-fyi-character-versioned-r2.spec.js.map