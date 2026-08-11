"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runFyiCharacterVersionedPortraitPipeline = exports.parseFyiCharacterVersionedPortraitCli = exports.buildFyiCharacterVersionedPreflightK27 = exports.buildFyiCharacterVersionedDelivery = exports.FYI_CHARACTER_VERSIONED_PORTRAIT_KEY = exports.FYI_CHARACTER_K25_MAX_UNCOMPRESSED_BYTES = exports.FYI_CHARACTER_K27_CONTRACT = exports.FYI_CHARACTER_K26_CONTRACT = exports.FYI_CHARACTER_K25_CONTRACT = void 0;
const crypto_1 = require("crypto");
const path_1 = require("path");
const zlib_1 = require("zlib");
const dataset_artifacts_1 = require("./dataset-artifacts");
const fyi_character_release_1 = require("./fyi-character-release");
const fyi_character_release_preflight_1 = require("./fyi-character-release-preflight");
exports.FYI_CHARACTER_K25_CONTRACT = "dokkan-fyi-character-versioned-portraits-k25";
exports.FYI_CHARACTER_K26_CONTRACT = "dokkan-fyi-character-versioned-delivery-plan-k26";
exports.FYI_CHARACTER_K27_CONTRACT = "dokkan-fyi-character-versioned-remote-preflight-k27";
exports.FYI_CHARACTER_K25_MAX_UNCOMPRESSED_BYTES = 32000000;
exports.FYI_CHARACTER_VERSIONED_PORTRAIT_KEY = /^images\/v3\/portrait_(\d+)\.([a-f0-9]{64})\.png$/;
const STABLE_PORTRAIT_KEY = /^images\/v2\/portrait_(\d+)\.png$/;
const JSON_BYTES = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
const sha256 = (value) => (0, crypto_1.createHash)("sha256").update(value).digest("hex");
function decodeCharacters(payload, manifest) {
    if (payload.length !== manifest.sizeBytes || sha256(payload) !== manifest.sha256)
        throw new Error("K25 source payload rejected");
    if (!Number.isSafeInteger(manifest.uncompressedSizeBytes)
        || manifest.uncompressedSizeBytes < 2
        || manifest.uncompressedSizeBytes > exports.FYI_CHARACTER_K25_MAX_UNCOMPRESSED_BYTES) {
        throw new Error("K25 source uncompressed size rejected");
    }
    const raw = (0, zlib_1.gunzipSync)(payload, { maxOutputLength: exports.FYI_CHARACTER_K25_MAX_UNCOMPRESSED_BYTES });
    if (raw.length !== manifest.uncompressedSizeBytes)
        throw new Error("K25 source raw size rejected");
    const parsed = JSON.parse(raw.toString("utf8"));
    if (!Array.isArray(parsed) || parsed.length !== manifest.characterCount)
        throw new Error("K25 source character count rejected");
    if (!raw.equals(JSON_BYTES(parsed)))
        throw new Error("K25 source JSON is not canonical");
    return parsed;
}
function rewritePortraitReferences(value, mapping, seen) {
    if (Array.isArray(value))
        return value.map(item => rewritePortraitReferences(item, mapping, seen));
    if (!value || typeof value !== "object")
        return value;
    const output = {};
    for (const [key, nested] of Object.entries(value)) {
        if (key === "portraitURL") {
            if (typeof nested !== "string")
                throw new Error("K25 portraitURL type rejected");
            const entry = mapping.get(nested);
            if (!entry)
                throw new Error(`K25 unmapped portraitURL: ${nested}`);
            seen.set(nested, (seen.get(nested) ?? 0) + 1);
            output[key] = entry.objectKey;
        }
        else {
            output[key] = rewritePortraitReferences(nested, mapping, seen);
        }
    }
    return output;
}
function stripPortraitReferences(value) {
    if (Array.isArray(value))
        return value.map(stripPortraitReferences);
    if (!value || typeof value !== "object")
        return value;
    const output = {};
    for (const [key, nested] of Object.entries(value)) {
        output[key] = key === "portraitURL" ? "<portrait>" : stripPortraitReferences(nested);
    }
    return output;
}
function datasetVersionSlug(value) {
    const slug = value.trim().replace(/:/g, "-").replace(/[^A-Za-z0-9._-]/g, "_");
    if (!slug || slug === "." || slug === ".." || slug.includes(".."))
        throw new Error("K26 dataset version rejected");
    return slug;
}
function buildFyiCharacterVersionedDelivery(validated) {
    if (validated.release.releaseId !== validated.plan.releaseId
        || validated.receipt.releaseId !== validated.release.releaseId
        || validated.receipt.readiness.localReleaseBundle !== "GO")
        throw new Error("K25 validated release rejected");
    const characters = decodeCharacters(validated.payload, validated.release.dataset);
    const mappings = validated.release.portraits.entries.map(entry => {
        const match = STABLE_PORTRAIT_KEY.exec(entry.objectKey);
        if (!match || entry.fileName !== `portrait_${match[1]}.png`)
            throw new Error("K25 source portrait key rejected");
        return {
            sourceObjectKey: entry.objectKey,
            objectKey: `images/v3/portrait_${match[1]}.${entry.sha256}.png`,
            portraitId: match[1], sha256: entry.sha256, sizeBytes: entry.sizeBytes, sourceFileName: entry.fileName,
        };
    }).sort((left, right) => left.sourceObjectKey.localeCompare(right.sourceObjectKey));
    if (new Set(mappings.map(entry => entry.sourceObjectKey)).size !== mappings.length
        || new Set(mappings.map(entry => entry.objectKey)).size !== mappings.length
        || mappings.some(entry => !exports.FYI_CHARACTER_VERSIONED_PORTRAIT_KEY.test(entry.objectKey))) {
        throw new Error("K25 portrait mapping rejected");
    }
    const mapping = new Map(mappings.map(entry => [entry.sourceObjectKey, entry]));
    const seen = new Map();
    const rewritten = rewritePortraitReferences(characters, mapping, seen);
    if (seen.size !== mappings.length || mappings.some(entry => !seen.has(entry.sourceObjectKey)))
        throw new Error("K25 portrait reference coverage rejected");
    if (JSON.stringify(stripPortraitReferences(characters)) !== JSON.stringify(stripPortraitReferences(rewritten))) {
        throw new Error("K25 non-portrait JSON changed");
    }
    if (JSON.stringify(characters.map(character => character.id)) !== JSON.stringify(rewritten.map(character => character.id))) {
        throw new Error("K25 character order changed");
    }
    const artifact = (0, dataset_artifacts_1.buildCharacterDatasetArtifact)(rewritten, {
        datasetVersion: validated.release.dataset.datasetVersion,
        generatedAt: validated.release.dataset.generatedAt,
        fileName: "characters.json.gz",
    });
    const mappingSha256 = sha256(JSON_BYTES(mappings));
    const source = {
        releaseId: validated.release.releaseId,
        releaseReportSha256: sha256(JSON_BYTES(validated.release)),
        payloadSha256: validated.release.dataset.sha256,
        portraitInventorySha256: validated.release.portraits.inventorySha256,
    };
    const deliveryId = `${artifact.manifest.sha256}-${sha256(JSON_BYTES({ source, mappingSha256 }))}`;
    const report = {
        schemaVersion: 1, contract: exports.FYI_CHARACTER_K25_CONTRACT, contractVersion: "1.0.0",
        generatedAt: validated.release.generatedAt, deliveryId, source,
        dataset: artifact.manifest,
        portraits: {
            count: mappings.length,
            totalBytes: mappings.reduce((total, entry) => total + entry.sizeBytes, 0),
            mappingSha256, entries: mappings,
        },
        checks: {
            everyPortraitReferenceRewritten: true, everySourcePortraitMappedOnce: true,
            nonPortraitJsonIdentical: true, characterIdsAndOrderIdentical: true, sourceReleaseRevalidated: true,
        },
        readiness: {
            inMemoryDeliveryProjection: "GO", remotePreflight: "NO-GO", publication: "NO-GO",
            production: "NO-GO", android: "NO-GO", r2Mutation: "NO-GO",
        },
    };
    const payloadKey = `releases/${datasetVersionSlug(report.dataset.datasetVersion)}/${report.dataset.sha256}/characters.json.gz`;
    const remoteManifest = { ...report.dataset, fileName: payloadKey };
    const manifestBytes = JSON_BYTES(remoteManifest);
    const objects = [
        { kind: "payload", localPath: "<in-memory>/characters.json.gz", objectKey: payloadKey, sha256: report.dataset.sha256,
            sizeBytes: report.dataset.sizeBytes, cacheControl: "public, max-age=31536000, immutable", remoteHashProofRequired: false },
        ...mappings.map(entry => ({
            kind: "portrait",
            localPath: `releases-k21/${validated.release.releaseId}/portraits/${entry.sourceFileName}`,
            objectKey: entry.objectKey, sha256: entry.sha256, sizeBytes: entry.sizeBytes,
            cacheControl: "public, max-age=31536000, immutable", remoteHashProofRequired: true,
            sourceReleaseId: validated.release.releaseId, sourceFileName: entry.sourceFileName,
        })),
        { kind: "manifest", localPath: "<in-memory>/characters-manifest.remote.json", objectKey: "characters-manifest.json",
            sha256: sha256(manifestBytes), sizeBytes: manifestBytes.length, cacheControl: "no-store", remoteHashProofRequired: false },
    ];
    const worstCaseNewBytes = objects.reduce((total, object) => total + object.sizeBytes, 0);
    if (new Set(objects.map(object => object.objectKey)).size !== objects.length
        || worstCaseNewBytes > fyi_character_release_1.FYI_CHARACTER_RELEASE_MAX_BYTES)
        throw new Error("K26 object plan rejected");
    const plan = {
        schemaVersion: 1, contract: exports.FYI_CHARACTER_K26_CONTRACT, contractVersion: "1.0.0",
        generatedAt: report.generatedAt, deliveryId, k25Sha256: sha256(JSON_BYTES(report)), remoteManifest, objects,
        budget: {
            namespaceLimitBytes: fyi_character_release_1.FYI_CHARACTER_RELEASE_MAX_BYTES, bucketLimitBytes: fyi_character_release_1.FYI_CHARACTER_BUCKET_MAX_BYTES,
            worstCaseNewBytes, withinNamespaceLimit: true, remoteBucketBytes: null, withinBucketLimit: null,
        },
        readiness: {
            localPlan: "GO", remoteInventory: "NO-GO", publication: "NO-GO", production: "NO-GO",
            android: "NO-GO", r2Mutation: "NO-GO",
        },
    };
    return { report, plan, payload: artifact.gzipBuffer, manifestBytes };
}
exports.buildFyiCharacterVersionedDelivery = buildFyiCharacterVersionedDelivery;
async function mapConcurrent(values, concurrency, mapper) {
    const output = new Array(values.length);
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, async () => {
        while (true) {
            const index = next++;
            if (index >= values.length)
                return;
            output[index] = await mapper(values[index]);
        }
    }));
    return output;
}
async function inspectObject(object, reader, consume) {
    try {
        const remote = await reader.read(object.objectKey, 5000000, consume);
        if (remote.statusCode === 404)
            return { kind: object.kind, objectKey: object.objectKey, status: "missing", expectedSha256: object.sha256, expectedSizeBytes: object.sizeBytes };
        if (remote.statusCode !== 200)
            throw new Error(`unexpected HTTP ${remote.statusCode}`);
        const actualSha256 = sha256(remote.bytes);
        return { kind: object.kind, objectKey: object.objectKey,
            status: actualSha256 === object.sha256 && remote.bytes.length === object.sizeBytes ? "matching" : "conflict",
            expectedSha256: object.sha256, expectedSizeBytes: object.sizeBytes, actualSha256, actualSizeBytes: remote.bytes.length };
    }
    catch (error) {
        return { kind: object.kind, objectKey: object.objectKey, status: "failed",
            expectedSha256: object.sha256, expectedSizeBytes: object.sizeBytes, failure: error instanceof Error ? error.message : String(error) };
    }
}
async function buildFyiCharacterVersionedPreflightK27(options) {
    const rebuiltDelivery = buildFyiCharacterVersionedDelivery(options.validated);
    if (JSON.stringify(options.delivery.report) !== JSON.stringify(rebuiltDelivery.report)
        || JSON.stringify(options.delivery.plan) !== JSON.stringify(rebuiltDelivery.plan)
        || !options.delivery.payload.equals(rebuiltDelivery.payload)
        || !options.delivery.manifestBytes.equals(rebuiltDelivery.manifestBytes)) {
        throw new Error("K27 delivery derivation rejected");
    }
    const immutable = rebuiltDelivery.plan.objects.filter(object => object.kind !== "manifest");
    const manifestObject = rebuiltDelivery.plan.objects.find(object => object.kind === "manifest");
    if (!manifestObject)
        throw new Error("K27 manifest object missing");
    let bytesRead = 0;
    const consume = (count) => { bytesRead += count; if (bytesRead > fyi_character_release_preflight_1.FYI_CHARACTER_K24_MAX_AGGREGATE_BYTES)
        throw new Error("K27 aggregate response limit exceeded"); };
    const objects = await mapConcurrent(immutable, 12, object => inspectObject(object, options.reader, consume));
    let manifest;
    try {
        const remote = await options.reader.read("characters-manifest.json", 1000000, consume);
        if (remote.statusCode === 404)
            manifest = { status: "missing", expectedSha256: manifestObject.sha256, expectedSizeBytes: manifestObject.sizeBytes };
        else if (remote.statusCode !== 200)
            throw new Error(`unexpected HTTP ${remote.statusCode}`);
        else {
            const actualSha256 = sha256(remote.bytes);
            manifest = { status: actualSha256 === manifestObject.sha256 && remote.bytes.length === manifestObject.sizeBytes ? "matching" : "different",
                expectedSha256: manifestObject.sha256, expectedSizeBytes: manifestObject.sizeBytes, actualSha256, actualSizeBytes: remote.bytes.length };
            try {
                const parsed = JSON.parse(remote.bytes.toString("utf8"));
                if (typeof parsed.datasetVersion === "string")
                    manifest.currentDatasetVersion = parsed.datasetVersion;
            }
            catch { /* observed only */ }
        }
    }
    catch (error) {
        manifest = { status: "failed", expectedSha256: manifestObject.sha256, expectedSizeBytes: manifestObject.sizeBytes,
            failure: error instanceof Error ? error.message : String(error) };
    }
    const bucketSize = await options.bucketSizeReader.read();
    const reparsedBucketSize = (0, fyi_character_release_preflight_1.parseFyiCharacterBucketSize)(bucketSize.reported);
    if (bucketSize.reported !== reparsedBucketSize.reported
        || bucketSize.conservativeUpperBoundBytes !== reparsedBucketSize.conservativeUpperBoundBytes) {
        throw new Error("K27 bucket size reader rejected");
    }
    const summary = objects.reduce((result, object) => { result[object.status] += 1; return result; }, { matching: 0, missing: 0, conflict: 0, failed: 0, total: objects.length });
    const bytesNewIfPublished = objects.filter(object => object.status === "missing").reduce((sum, object) => sum + object.expectedSizeBytes, 0)
        + (manifest.status === "matching" ? 0 : manifest.expectedSizeBytes);
    const projectedBucketUpperBoundBytes = bucketSize.conservativeUpperBoundBytes + bytesNewIfPublished;
    const withinNamespaceLimit = bytesNewIfPublished <= fyi_character_release_1.FYI_CHARACTER_RELEASE_MAX_BYTES;
    const withinBucketLimit = projectedBucketUpperBoundBytes < fyi_character_release_1.FYI_CHARACTER_BUCKET_MAX_BYTES;
    const everyVersionedObjectInspected = objects.length === immutable.length;
    const noContentAddressConflicts = summary.conflict === 0;
    const noRemoteReadFailures = summary.failed === 0 && manifest.status !== "failed";
    const go = everyVersionedObjectInspected && noContentAddressConflicts && noRemoteReadFailures && withinNamespaceLimit && withinBucketLimit;
    return {
        schemaVersion: 1, contract: exports.FYI_CHARACTER_K27_CONTRACT, contractVersion: "1.0.0",
        checkedAt: options.checkedAt ?? new Date().toISOString(), deliveryId: rebuiltDelivery.report.deliveryId,
        source: { k25Sha256: sha256(JSON_BYTES(rebuiltDelivery.report)), k26Sha256: sha256(JSON_BYTES(rebuiltDelivery.plan)), releaseId: options.validated.release.releaseId },
        remote: { publicBaseUrl: fyi_character_release_preflight_1.FYI_CHARACTER_K24_PUBLIC_BASE_URL, bucket: fyi_character_release_preflight_1.FYI_CHARACTER_K24_BUCKET, target: "remote", readOnly: true },
        objects, summary, manifest,
        budget: { bytesRead, bytesNewIfPublished, bucketSize, projectedBucketUpperBoundBytes, withinNamespaceLimit, withinBucketLimit },
        checks: { sourceReleaseRevalidated: true, everyVersionedObjectInspected, noContentAddressConflicts, noRemoteReadFailures,
            bucketUsageKnown: true, readOnlyTransport: true, noRemoteMutation: true, noPublisherImported: true },
        readiness: { versionedRemotePreflight: go ? "GO" : "NO-GO", publicationAuthorization: "REQUIRED",
            publication: "NO-GO", production: "NO-GO", android: "NO-GO", r2Mutation: "NO-GO" },
    };
}
exports.buildFyiCharacterVersionedPreflightK27 = buildFyiCharacterVersionedPreflightK27;
function parseFyiCharacterVersionedPortraitCli(args) {
    if (args.length !== 4 || args[0] !== "--opt-in-k25-k27" || args[1] !== "--release-id"
        || !/^[a-f0-9]{64}-[a-f0-9]{64}$/.test(args[2]) || args[3] !== "--remote") {
        throw new Error("K25-K27 require exactly --opt-in-k25-k27 --release-id <release-id> --remote");
    }
    return { releaseId: args[2] };
}
exports.parseFyiCharacterVersionedPortraitCli = parseFyiCharacterVersionedPortraitCli;
async function runFyiCharacterVersionedPortraitPipeline(options) {
    const validated = await (0, fyi_character_release_1.readValidatedFyiCharacterRelease)(options.fyiRoot, options.releaseId);
    const delivery = buildFyiCharacterVersionedDelivery(validated);
    return buildFyiCharacterVersionedPreflightK27({ validated, delivery,
        reader: options.reader ?? (0, fyi_character_release_preflight_1.createFyiCharacterPublicHttpsReader)(),
        bucketSizeReader: options.bucketSizeReader ?? (0, fyi_character_release_preflight_1.createFyiCharacterWranglerBucketSizeReader)() });
}
exports.runFyiCharacterVersionedPortraitPipeline = runFyiCharacterVersionedPortraitPipeline;
async function main() {
    const { releaseId } = parseFyiCharacterVersionedPortraitCli(process.argv.slice(2));
    const report = await runFyiCharacterVersionedPortraitPipeline({ fyiRoot: (0, path_1.resolve)(__dirname, "data/fyi-characters"), releaseId });
    console.log(JSON.stringify({ deliveryId: report.deliveryId, summary: report.summary, manifest: report.manifest,
        budget: report.budget, readiness: report.readiness }, null, 2));
    if (report.readiness.versionedRemotePreflight !== "GO")
        process.exitCode = 2;
}
if (require.main === module)
    main().catch(error => { console.error(error); process.exitCode = 1; });
//# sourceMappingURL=fyi-character-versioned-portraits.js.map