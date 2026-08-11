"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const assert_1 = require("assert");
const zlib_1 = require("zlib");
const dataset_artifacts_1 = require("./dataset-artifacts");
const fyi_character_release_1 = require("./fyi-character-release");
const fyi_character_release_preflight_1 = require("./fyi-character-release-preflight");
const fyi_character_versioned_portraits_1 = require("./fyi-character-versioned-portraits");
const hash = (value) => (0, crypto_1.createHash)("sha256").update(value).digest("hex");
const generatedAt = "2026-08-11T03:30:00.000Z";
function fixture() {
    const generatedAt = "2026-08-11T00:56:35.327Z";
    const characters = [{
            id: "1000001", name: "One", portraitURL: "images/v2/portrait_1000001.png", portraitFilename: "portrait_1000001",
            transformations: [{ id: "4000001", name: "Form", portraitURL: "images/v2/portrait_4000001.png", portraitFilename: "portrait_4000001", transformations: [] }],
        }];
    const artifact = (0, dataset_artifacts_1.buildCharacterDatasetArtifact)(characters, { generatedAt, datasetVersion: generatedAt });
    const marker = Buffer.from("ready\n");
    const portraits = [
        { objectKey: "images/v2/portrait_1000001.png", fileName: "portrait_1000001.png", bytes: Buffer.from("one") },
        { objectKey: "images/v2/portrait_4000001.png", fileName: "portrait_4000001.png", bytes: Buffer.from("form") },
    ].map(value => ({ ...value, sha256: hash(value.bytes), sizeBytes: value.bytes.length }));
    const k20 = {
        schemaVersion: 1, contract: "dokkan-fyi-character-database-candidate-readiness-k20", contractVersion: "1.0.0", generatedAt,
        sources: { candidate: { datasetVersion: generatedAt, generatedAt, payloadFile: "characters.json.gz", payloadSha256: artifact.manifest.sha256,
                payloadSizeBytes: artifact.manifest.sizeBytes, uncompressedSizeBytes: artifact.manifest.uncompressedSizeBytes, characterCount: 1 } },
        checks: { complete: true }, failures: { total: 0 }, readiness: { candidateGenerationValidation: "GO", promotion: "NO-GO", production: "NO-GO", publisher: "NO-GO", android: "NO-GO", r2: "NO-GO" },
    };
    const release = (0, fyi_character_release_1.buildFyiCharacterReleaseK21)({ candidateGzip: artifact.gzipBuffer, candidateManifest: artifact.manifest, candidateReadyMarker: marker, k20,
        portraits: portraits.map(({ bytes, ...entry }) => entry) });
    const plan = (0, fyi_character_release_1.buildFyiCharacterReleaseK22)(release);
    const receipt = (0, fyi_character_release_1.buildFyiCharacterReleaseK23)(release, plan);
    const validated = {
        releaseDirectory: "fixture",
        release,
        plan,
        receipt,
        payload: artifact.gzipBuffer,
    };
    return { artifact, validated, portraits };
}
function readerFor(values) {
    return { read: async (key, _limit, consume) => {
            const value = values.get(key);
            if (!value)
                throw new Error(`missing ${key}`);
            if (value instanceof Error)
                throw value;
            consume(value.bytes.length);
            return value;
        } };
}
describe("FYI character versioned portraits K25-K27", () => {
    it("rewrites only portraitURL values to content-addressed v3 keys", () => {
        const input = fixture();
        const first = (0, fyi_character_versioned_portraits_1.buildFyiCharacterVersionedDelivery)(input.validated);
        const second = (0, fyi_character_versioned_portraits_1.buildFyiCharacterVersionedDelivery)(input.validated);
        (0, assert_1.deepStrictEqual)(first.report, second.report);
        (0, assert_1.equal)(first.payload.equals(second.payload), true);
        (0, assert_1.equal)(first.report.portraits.count, 2);
        (0, assert_1.equal)(first.report.checks.nonPortraitJsonIdentical, true);
        (0, assert_1.equal)(first.report.dataset.sha256 === input.artifact.manifest.sha256, false);
        const output = JSON.parse((0, zlib_1.gunzipSync)(first.payload).toString("utf8"));
        (0, assert_1.equal)(fyi_character_versioned_portraits_1.FYI_CHARACTER_VERSIONED_PORTRAIT_KEY.test(output[0].portraitURL), true);
        (0, assert_1.equal)(fyi_character_versioned_portraits_1.FYI_CHARACTER_VERSIONED_PORTRAIT_KEY.test(output[0].transformations[0].portraitURL), true);
        (0, assert_1.equal)(output[0].name, "One");
        (0, assert_1.equal)(output[0].transformations[0].name, "Form");
    });
    it("binds every planned v3 portrait key to its source hash", () => {
        const input = fixture();
        const delivery = (0, fyi_character_versioned_portraits_1.buildFyiCharacterVersionedDelivery)(input.validated);
        const portraits = delivery.plan.objects.filter(object => object.kind === "portrait");
        (0, assert_1.equal)(portraits.length, 2);
        for (const object of portraits) {
            (0, assert_1.equal)(fyi_character_versioned_portraits_1.FYI_CHARACTER_VERSIONED_PORTRAIT_KEY.test(object.objectKey), true);
            const digest = fyi_character_versioned_portraits_1.FYI_CHARACTER_VERSIONED_PORTRAIT_KEY.exec(object.objectKey)[2];
            (0, assert_1.equal)(digest, object.sha256);
            (0, assert_1.equal)(object.remoteHashProofRequired, true);
        }
        (0, assert_1.equal)(delivery.plan.budget.withinNamespaceLimit, true);
        (0, assert_1.equal)(delivery.plan.readiness.r2Mutation, "NO-GO");
    });
    it("rejects payload bytes that no longer match the validated release", () => {
        const input = fixture();
        input.validated.payload = Buffer.from("changed after validation");
        (0, assert_1.throws)(() => (0, fyi_character_versioned_portraits_1.buildFyiCharacterVersionedDelivery)(input.validated), /source payload rejected/);
    });
    it("rejects non-canonical JSON before deriving a release", () => {
        const input = fixture();
        const raw = Buffer.from('[{"id":"1000001","id":"changed","portraitURL":"images/v2/portrait_1000001.png"}]', "utf8");
        const payload = (0, zlib_1.gzipSync)(raw, { level: 9 });
        input.validated.payload = payload;
        input.validated.release.dataset = {
            ...input.validated.release.dataset,
            sha256: hash(payload),
            sizeBytes: payload.length,
            uncompressedSizeBytes: raw.length,
        };
        (0, assert_1.throws)(() => (0, fyi_character_versioned_portraits_1.buildFyiCharacterVersionedDelivery)(input.validated), /JSON is not canonical/);
    });
    it("rejects an uncompressed size above the K25 memory ceiling", () => {
        const input = fixture();
        input.validated.release.dataset = {
            ...input.validated.release.dataset,
            uncompressedSizeBytes: fyi_character_versioned_portraits_1.FYI_CHARACTER_K25_MAX_UNCOMPRESSED_BYTES + 1,
        };
        (0, assert_1.throws)(() => (0, fyi_character_versioned_portraits_1.buildFyiCharacterVersionedDelivery)(input.validated), /uncompressed size rejected/);
    });
    it("returns K27 GO for missing or matching content-addressed objects", async () => {
        const input = fixture();
        const delivery = (0, fyi_character_versioned_portraits_1.buildFyiCharacterVersionedDelivery)(input.validated);
        const values = new Map();
        for (const object of delivery.plan.objects)
            values.set(object.objectKey, { statusCode: 404, bytes: Buffer.alloc(0) });
        const report = await (0, fyi_character_versioned_portraits_1.buildFyiCharacterVersionedPreflightK27)({
            validated: input.validated, delivery, reader: readerFor(values),
            bucketSizeReader: { read: async () => (0, fyi_character_release_preflight_1.parseFyiCharacterBucketSize)("343 MB") }, checkedAt: generatedAt,
        });
        (0, assert_1.equal)(report.readiness.versionedRemotePreflight, "GO");
        (0, assert_1.deepStrictEqual)(report.summary, { matching: 0, missing: 3, conflict: 0, failed: 0, total: 3 });
        (0, assert_1.equal)(report.manifest.status, "missing");
        (0, assert_1.equal)(report.readiness.publicationAuthorization, "REQUIRED");
        (0, assert_1.equal)(report.readiness.r2Mutation, "NO-GO");
    });
    it("fails closed when a content-addressed key has different bytes", async () => {
        const input = fixture();
        const delivery = (0, fyi_character_versioned_portraits_1.buildFyiCharacterVersionedDelivery)(input.validated);
        const values = new Map();
        for (const object of delivery.plan.objects)
            values.set(object.objectKey, object.kind === "portrait"
                ? { statusCode: 200, bytes: Buffer.from("wrong") } : { statusCode: 404, bytes: Buffer.alloc(0) });
        const report = await (0, fyi_character_versioned_portraits_1.buildFyiCharacterVersionedPreflightK27)({
            validated: input.validated, delivery, reader: readerFor(values),
            bucketSizeReader: { read: async () => (0, fyi_character_release_preflight_1.parseFyiCharacterBucketSize)("343 MB") },
        });
        (0, assert_1.equal)(report.readiness.versionedRemotePreflight, "NO-GO");
        (0, assert_1.equal)(report.summary.conflict, 2);
    });
    it("rejects a bucket reader that understates its own rounded report", async () => {
        const input = fixture();
        const delivery = (0, fyi_character_versioned_portraits_1.buildFyiCharacterVersionedDelivery)(input.validated);
        const values = new Map();
        for (const object of delivery.plan.objects) {
            values.set(object.objectKey, { statusCode: 404, bytes: Buffer.alloc(0) });
        }
        await (0, assert_1.rejects)(() => (0, fyi_character_versioned_portraits_1.buildFyiCharacterVersionedPreflightK27)({
            validated: input.validated,
            delivery,
            reader: readerFor(values),
            bucketSizeReader: {
                read: async () => ({ reported: "343 MB", conservativeUpperBoundBytes: 343000000 }),
            },
        }), /bucket size reader rejected/);
    });
    it("rejects any delivery mutation before remote inspection", async () => {
        const input = fixture();
        const delivery = (0, fyi_character_versioned_portraits_1.buildFyiCharacterVersionedDelivery)(input.validated);
        delivery.plan.objects = delivery.plan.objects.slice(1);
        await (0, assert_1.rejects)(() => (0, fyi_character_versioned_portraits_1.buildFyiCharacterVersionedPreflightK27)({
            validated: input.validated,
            delivery,
            reader: readerFor(new Map()),
            bucketSizeReader: { read: async () => (0, fyi_character_release_preflight_1.parseFyiCharacterBucketSize)("343 MB") },
        }), /delivery derivation rejected/);
    });
    it("requires the exact explicit K25-K27 remote CLI", () => {
        const id = `${"a".repeat(64)}-${"b".repeat(64)}`;
        (0, assert_1.deepStrictEqual)((0, fyi_character_versioned_portraits_1.parseFyiCharacterVersionedPortraitCli)(["--opt-in-k25-k27", "--release-id", id, "--remote"]), { releaseId: id });
        (0, assert_1.throws)(() => (0, fyi_character_versioned_portraits_1.parseFyiCharacterVersionedPortraitCli)(["--opt-in-k25-k27", "--release-id", id, "--local"]), /require exactly/);
    });
});
//# sourceMappingURL=fyi-character-versioned-portraits.spec.js.map