"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFyiCharacterS3ConditionalWriterFromEnvironment = exports.createFyiCharacterS3ConditionalWriter = exports.publishFyiCharacterVersionedR2 = exports.parseFyiCharacterVersionedPublisherArgs = exports.FYI_CHARACTER_K28_CONTRACT = void 0;
const crypto_1 = require("crypto");
const client_s3_1 = require("@aws-sdk/client-s3");
const fyi_character_release_1 = require("./fyi-character-release");
const fyi_character_release_preflight_1 = require("./fyi-character-release-preflight");
const fyi_character_versioned_portraits_1 = require("./fyi-character-versioned-portraits");
exports.FYI_CHARACTER_K28_CONTRACT = "dokkan-fyi-character-versioned-r2-publisher-k28";
const RELEASE_ID = /^[a-f0-9]{64}-[a-f0-9]{64}$/;
const DELIVERY_ID = /^[a-f0-9]{64}-[a-f0-9]{64}$/;
const IMMUTABLE_CACHE = "public, max-age=31536000, immutable";
const MANIFEST_CACHE = "no-store";
const sha256 = (value) => (0, crypto_1.createHash)("sha256").update(value).digest("hex");
function parseFyiCharacterVersionedPublisherArgs(args) {
    const common = args.length >= 5
        && args[0] === "--opt-in-k28"
        && args[1] === "--release-id"
        && RELEASE_ID.test(args[2])
        && args[3] === "--remote";
    if (!common)
        throw new Error("K28 requires an exact explicit remote command");
    if (args.length === 5 && args[4] === "--dry-run") {
        return { releaseId: args[2], mode: "dry-run" };
    }
    if (args.length === 7 && args[4] === "--publish" && args[5] === "--confirm-delivery" && DELIVERY_ID.test(args[6])) {
        return { releaseId: args[2], mode: "publish", confirmedDeliveryId: args[6] };
    }
    throw new Error("K28 requires --dry-run or --publish --confirm-delivery <delivery-id>");
}
exports.parseFyiCharacterVersionedPublisherArgs = parseFyiCharacterVersionedPublisherArgs;
async function publishFyiCharacterVersionedR2(options) {
    const validated = await (0, fyi_character_release_1.readValidatedFyiCharacterRelease)(options.fyiRoot, options.publisher.releaseId);
    const delivery = (0, fyi_character_versioned_portraits_1.buildFyiCharacterVersionedDelivery)(validated);
    if (options.publisher.mode === "publish" && options.publisher.confirmedDeliveryId !== delivery.report.deliveryId) {
        throw new Error("K28 confirmed delivery ID does not match the rebuilt delivery");
    }
    const preflight = await (0, fyi_character_versioned_portraits_1.buildFyiCharacterVersionedPreflightK27)({
        validated,
        delivery,
        reader: options.remoteReader ?? (0, fyi_character_release_preflight_1.createFyiCharacterPublicHttpsReader)(),
        bucketSizeReader: options.bucketSizeReader ?? (0, fyi_character_release_preflight_1.createFyiCharacterWranglerBucketSizeReader)(),
        checkedAt: options.checkedAt,
    });
    if (preflight.readiness.versionedRemotePreflight !== "GO")
        throw new Error("K28 remote preflight is not GO");
    const missingKeys = new Set(preflight.objects.filter(object => object.status === "missing").map(object => object.objectKey));
    const immutable = delivery.plan.objects.filter(object => object.kind !== "manifest");
    const plannedUploads = immutable.filter(object => missingKeys.has(object.objectKey)).length;
    if (options.publisher.mode === "dry-run")
        return summary("dry-run", delivery, preflight, plannedUploads, 0, 0, false);
    const writer = options.conditionalWriter ?? createFyiCharacterS3ConditionalWriterFromEnvironment();
    const manifestObject = delivery.plan.objects.find(object => object.kind === "manifest");
    if (!manifestObject)
        throw new Error("K28 manifest object missing");
    assertBytesMatch(manifestObject.objectKey, delivery.manifestBytes, manifestObject.sha256, manifestObject.sizeBytes);
    const initialManifest = await writer.read(manifestObject.objectKey, manifestObject.sizeBytes + 1);
    assertManifestMatchesPreflight(initialManifest, preflight, manifestObject.sha256, manifestObject.sizeBytes);
    let uploaded = 0;
    let verified = 0;
    for (const object of immutable) {
        const bytes = await bytesForObject(validated, delivery, object.objectKey);
        assertBytesMatch(object.objectKey, bytes, object.sha256, object.sizeBytes);
        const metadata = metadataFor(object.kind);
        let remote = await writer.read(object.objectKey, object.sizeBytes + 1);
        if (!remote) {
            const outcome = await writer.createIfAbsent({ objectKey: object.objectKey, bytes, ...metadata });
            if (outcome === "written")
                uploaded += 1;
            remote = await writer.read(object.objectKey, object.sizeBytes + 1);
            if (!remote)
                throw new Error(`K28 immutable object missing after conditional create: ${object.objectKey}`);
        }
        assertRemoteObject(object.objectKey, remote, object.sha256, object.sizeBytes, metadata);
        verified += 1;
    }
    const manifestMetadata = metadataFor("manifest");
    let manifestPromoted = false;
    if (!initialManifest || !remoteMatches(initialManifest, manifestObject.sha256, manifestObject.sizeBytes, manifestMetadata)) {
        const write = { objectKey: manifestObject.objectKey, bytes: delivery.manifestBytes, ...manifestMetadata };
        const outcome = initialManifest
            ? await writer.replaceIfMatch(write, initialManifest.etag)
            : await writer.createIfAbsent(write);
        if (outcome === "written")
            manifestPromoted = true;
    }
    const finalManifest = await writer.read(manifestObject.objectKey, manifestObject.sizeBytes + 1);
    if (!finalManifest)
        throw new Error("K28 manifest missing after conditional promotion");
    assertRemoteObject(manifestObject.objectKey, finalManifest, manifestObject.sha256, manifestObject.sizeBytes, manifestMetadata);
    verified += 1;
    return summary("publish", delivery, preflight, plannedUploads, uploaded, verified, manifestPromoted);
}
exports.publishFyiCharacterVersionedR2 = publishFyiCharacterVersionedR2;
function summary(mode, delivery, preflight, plannedUploads, uploaded, verified, manifestPromoted) {
    const immutableCount = delivery.plan.objects.filter(object => object.kind !== "manifest").length;
    return {
        schemaVersion: 1,
        contract: exports.FYI_CHARACTER_K28_CONTRACT,
        contractVersion: "1.1.0",
        mode,
        deliveryId: delivery.report.deliveryId,
        preflight,
        plannedUploads,
        uploaded,
        verified,
        manifestPromoted,
        checks: {
            remotePreflightRepeatedImmediatelyBeforeWrites: true,
            conditionalImmutableCreates: true,
            conditionalManifestPromotion: true,
            everyImmutableDirectlyVerified: mode === "dry-run" || verified >= immutableCount + 1,
            cacheMetadataVerified: mode === "dry-run" || verified >= immutableCount + 1,
            contentAddressedObjectsBeforeManifest: true,
            everyUploadVerified: mode === "dry-run" || verified >= immutableCount + 1,
            noDeletes: true,
            noProductionSwitch: true,
            androidUntouched: true,
        },
        readiness: {
            dryRun: "GO",
            publication: mode === "publish" ? "COMPLETED" : "NOT_EXECUTED",
            production: "NO-GO",
            android: "NO-GO",
        },
    };
}
async function bytesForObject(validated, delivery, objectKey) {
    const object = delivery.plan.objects.find(candidate => candidate.objectKey === objectKey);
    if (!object || object.kind === "manifest")
        throw new Error(`K28 immutable object rejected: ${objectKey}`);
    if (object.kind === "payload")
        return delivery.payload;
    if (!object.sourceFileName)
        throw new Error(`K28 portrait source missing: ${objectKey}`);
    return (0, fyi_character_release_1.readValidatedFyiCharacterReleasePortrait)(validated, object.sourceFileName);
}
function metadataFor(kind) {
    return {
        contentType: kind === "payload" ? "application/gzip" : kind === "portrait" ? "image/png" : "application/json",
        cacheControl: kind === "manifest" ? MANIFEST_CACHE : IMMUTABLE_CACHE,
    };
}
function assertBytesMatch(label, bytes, expectedSha256, expectedSizeBytes) {
    if (bytes.length !== expectedSizeBytes || sha256(bytes) !== expectedSha256) {
        throw new Error(`K28 bytes changed: ${label}`);
    }
}
function remoteMatches(remote, expectedSha256, expectedSizeBytes, metadata) {
    return remote.bytes.length === expectedSizeBytes
        && sha256(remote.bytes) === expectedSha256
        && remote.contentType === metadata.contentType
        && remote.cacheControl === metadata.cacheControl;
}
function assertRemoteObject(label, remote, expectedSha256, expectedSizeBytes, metadata) {
    if (!remoteMatches(remote, expectedSha256, expectedSizeBytes, metadata)) {
        throw new Error(`K28 remote object bytes or metadata conflict: ${label}`);
    }
}
function assertManifestMatchesPreflight(direct, preflight, expectedSha256, expectedSizeBytes) {
    if (!direct) {
        if (preflight.manifest.status !== "missing")
            throw new Error("K28 remote manifest disappeared after preflight");
        return;
    }
    const directHash = sha256(direct.bytes);
    if (directHash === expectedSha256 && direct.bytes.length === expectedSizeBytes)
        return;
    if (preflight.manifest.status !== "different"
        || directHash !== preflight.manifest.actualSha256
        || direct.bytes.length !== preflight.manifest.actualSizeBytes) {
        throw new Error("K28 direct R2 manifest does not match the public preflight");
    }
}
function assertObjectKey(key) {
    if (!key || key.startsWith("/") || key.startsWith("\\") || key.includes("\\")
        || key.split("/").some(segment => !segment || segment === "." || segment === "..")
        || /[\u0000-\u001f\u007f]/.test(key)) {
        throw new Error(`K28 object key rejected: ${key}`);
    }
}
function isStatus(error, status) {
    const candidate = error;
    return candidate?.$metadata?.httpStatusCode === status
        || (status === 404 && /^(?:NoSuchKey|NotFound)$/.test(candidate?.name ?? ""))
        || (status === 412 && candidate?.name === "PreconditionFailed");
}
async function bodyToBuffer(body, maxBytes) {
    if (!body || !(Symbol.asyncIterator in Object(body)))
        throw new Error("K28 R2 response body is not streamable");
    const chunks = [];
    let total = 0;
    for await (const chunk of body) {
        const bytes = Buffer.from(chunk);
        total += bytes.length;
        if (total > maxBytes)
            throw new Error("K28 R2 object exceeds its validated size bound");
        chunks.push(bytes);
    }
    return Buffer.concat(chunks, total);
}
function createFyiCharacterS3ConditionalWriter(options) {
    if (!/^[a-f0-9]{32}$/.test(options.accountId))
        throw new Error("K28 CLOUDFLARE_ACCOUNT_ID is invalid");
    if (!options.accessKeyId || !options.secretAccessKey)
        throw new Error("K28 R2 S3 credentials are missing");
    const client = new client_s3_1.S3Client({
        region: "auto",
        endpoint: `https://${options.accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey },
    });
    return {
        read: async (objectKey, maxBytes) => {
            assertObjectKey(objectKey);
            try {
                const output = await client.send(new client_s3_1.GetObjectCommand({ Bucket: fyi_character_release_preflight_1.FYI_CHARACTER_K24_BUCKET, Key: objectKey }));
                if (output.ContentLength !== undefined && output.ContentLength > maxBytes) {
                    throw new Error(`K28 R2 object exceeds its validated size bound: ${objectKey}`);
                }
                if (!output.ETag)
                    throw new Error(`K28 R2 object has no ETag: ${objectKey}`);
                return {
                    bytes: await bodyToBuffer(output.Body, maxBytes),
                    etag: output.ETag,
                    contentType: output.ContentType,
                    cacheControl: output.CacheControl,
                };
            }
            catch (error) {
                if (isStatus(error, 404))
                    return undefined;
                throw error;
            }
        },
        createIfAbsent: input => conditionalPut(client, input, { IfNoneMatch: "*" }),
        replaceIfMatch: (input, etag) => conditionalPut(client, input, { IfMatch: etag }),
    };
}
exports.createFyiCharacterS3ConditionalWriter = createFyiCharacterS3ConditionalWriter;
async function conditionalPut(client, input, condition) {
    assertObjectKey(input.objectKey);
    try {
        await client.send(new client_s3_1.PutObjectCommand({
            Bucket: fyi_character_release_preflight_1.FYI_CHARACTER_K24_BUCKET,
            Key: input.objectKey,
            Body: input.bytes,
            ContentType: input.contentType,
            CacheControl: input.cacheControl,
            ...condition,
        }));
        return "written";
    }
    catch (error) {
        if (isStatus(error, 412))
            return "precondition_failed";
        throw error;
    }
}
function createFyiCharacterS3ConditionalWriterFromEnvironment() {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? "";
    const accessKeyId = process.env.R2_ACCESS_KEY_ID ?? "";
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY ?? "";
    if (!accountId || !accessKeyId || !secretAccessKey) {
        throw new Error("K28 publish requires CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY");
    }
    return createFyiCharacterS3ConditionalWriter({ accountId, accessKeyId, secretAccessKey });
}
exports.createFyiCharacterS3ConditionalWriterFromEnvironment = createFyiCharacterS3ConditionalWriterFromEnvironment;
async function main() {
    const publisher = parseFyiCharacterVersionedPublisherArgs(process.argv.slice(2));
    const result = await publishFyiCharacterVersionedR2({
        fyiRoot: require("path").resolve(__dirname, "data/fyi-characters"),
        publisher,
    });
    console.log(JSON.stringify({
        mode: result.mode,
        deliveryId: result.deliveryId,
        objectSummary: result.preflight.summary,
        manifest: result.preflight.manifest,
        budget: result.preflight.budget,
        plannedUploads: result.plannedUploads,
        uploaded: result.uploaded,
        verified: result.verified,
        manifestPromoted: result.manifestPromoted,
        readiness: result.readiness,
    }, null, 2));
}
if (require.main === module) {
    main().catch(error => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    });
}
//# sourceMappingURL=publish-fyi-character-versioned-r2.js.map