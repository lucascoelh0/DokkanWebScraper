"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCharacterLeaderSupportedPublisher = void 0;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const client_s3_1 = require("@aws-sdk/client-s3");
const path_1 = require("path");
const leader_supported_projection_source_1 = require("./leader-supported-projection-source");
const leader_supported_publisher_dry_run_1 = require("./leader-supported-publisher-dry-run");
const leader_supported_remote_preflight_1 = require("./leader-supported-remote-preflight");
const leader_supported_publisher_contract_1 = require("./leader-supported-publisher-contract");
const HASH = /^[a-f0-9]{64}$/;
const ACCOUNT = /^[a-f0-9]{32}$/;
const CHECKED_AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const hash = (value) => (0, crypto_1.createHash)("sha256").update(value).digest("hex");
const jsonBytes = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
const json = (value) => JSON.stringify(value);
const samePath = (left, right) => process.platform === "win32"
    ? (0, path_1.resolve)(left).toLowerCase() === (0, path_1.resolve)(right).toLowerCase() : (0, path_1.resolve)(left) === (0, path_1.resolve)(right);
const sameFile = (left, right) => left.dev === right.dev && left.ino === right.ino;
const contained = (parent, child) => {
    const value = (0, path_1.relative)(parent, child);
    return value === "" || (value !== ".." && !value.startsWith(`..${path_1.sep}`) && !(0, path_1.isAbsolute)(value));
};
function framedHash(parts) {
    const digest = (0, crypto_1.createHash)("sha256");
    for (const [name, bytes] of parts) {
        digest.update(`${name}:${bytes.length}:`);
        digest.update(bytes);
        digest.update("\0");
    }
    return digest.digest("hex");
}
function makePlan(k58, k56) {
    const sourceBytes = [k56.gzip, k56.coverageBytes, k56.validationBytes, k56.manifestBytes];
    const objects = k58.plan.immutableObjects.map((object, index) => {
        const bytes = sourceBytes[index];
        if (hash(bytes) !== object.sha256 || bytes.length !== object.sizeBytes)
            throw new Error("K60 K56/K58 immutable identity mismatch");
        return {
            plan: {
                order: object.order, kind: object.kind, objectKey: object.objectKey, sha256: object.sha256,
                sizeBytes: object.sizeBytes, contentType: object.contentType, cacheControl: object.cacheControl,
                missingProtocol: "PUT_IF_NONE_MATCH_STAR", raceProtocol: "ACCEPT_409_OR_412_ONLY_AFTER_EXACT_REREAD",
                overwrite: "FORBIDDEN",
            },
            bytes,
        };
    });
    const candidateBytes = k58.candidateManifestBytes;
    if (hash(candidateBytes) !== k58.plan.mutableManifest.candidateSha256
        || candidateBytes.length !== k58.plan.mutableManifest.candidateSizeBytes)
        throw new Error("K60 candidate identity mismatch");
    const k58ArtifactSetSha256 = framedHash([
        ["candidate", k58.candidateManifestBytes], ["plan", k58.planBytes], ["receipt", k58.receiptBytes], ["marker", k58.markerBytes],
    ]);
    const k56ArtifactSetSha256 = framedHash([
        ["payload", k56.gzip], ["coverage", k56.coverageBytes], ["validation", k56.validationBytes], ["manifest", k56.manifestBytes],
    ]);
    const body = {
        schemaVersion: 1, contract: "dokkan-database-character-leader-supported-publication-plan",
        contractVersion: leader_supported_publisher_contract_1.CHARACTER_LEADER_SUPPORTED_PUBLISHER_CONTRACT_VERSION,
        remote: {
            bucket: leader_supported_publisher_contract_1.CHARACTER_LEADER_SUPPORTED_PUBLISHER_BUCKET, region: leader_supported_publisher_contract_1.CHARACTER_LEADER_SUPPORTED_PUBLISHER_REGION,
            endpointPattern: leader_supported_publisher_contract_1.CHARACTER_LEADER_SUPPORTED_PUBLISHER_ENDPOINT_PATTERN, namespace: leader_supported_publisher_contract_1.CHARACTER_LEADER_SUPPORTED_PUBLISHER_NAMESPACE,
        },
        source: {
            k58FullArtifactFingerprintSha256: k58.plan.source.fullArtifactFingerprintSha256,
            k58LineageFingerprintSha256: k58.plan.source.lineageFingerprintSha256,
            k58ArtifactSetSha256, k56ArtifactSetSha256,
        },
        immutableObjects: objects.map(object => object.plan),
        mutableManifest: {
            order: "LAST", objectKey: k58.plan.mutableManifest.objectKey, sha256: hash(candidateBytes), sizeBytes: candidateBytes.length,
            contentType: "application/json", cacheControl: "no-store", missingProtocol: "PUT_IF_NONE_MATCH_STAR",
            differentProtocol: "PUT_IF_MATCH_FRESH_STRONG_ETAG", matchingProtocol: "NO_WRITE_EXACT_REREAD",
            raceProtocol: "ACCEPT_409_OR_412_ONLY_AFTER_EXACT_REREAD", unconditionalWrite: "FORBIDDEN",
        },
        ordering: {
            immutableInK58Order: true, sourceRevalidationBeforeMutableManifest: true,
            allImmutablesRereadImmediatelyBeforeMutableManifest: true, mutableManifestRereadImmediatelyBeforeCas: true,
            manifestLast: true,
        },
        forbidden: { unconditionalWrite: true, delete: true, copy: true, multipart: true },
    };
    return { objects, candidateBytes, plan: { ...body, publicationId: hash(jsonBytes(body)) } };
}
async function loadSnapshot(options) {
    const common = {
        sidecarRoot: options.sidecarRoot, productionRoot: options.productionRoot, fyiRoot: options.fyiRoot,
        k43Root: options.k43Root, k46Root: options.k46Root, k48Root: options.k48Root,
        nativeRuntime: options.nativeRuntime, database: options.database,
    };
    const k58Result = await (0, leader_supported_publisher_dry_run_1.validateCharacterLeaderSupportedPublisherDryRunArtifact)({ ...common, artifactRoot: options.k58Root, k56Root: options.k56Root });
    if (k58Result.sourceBoundValidation !== "GO")
        throw new Error("K60 requires K58 source-bound GO");
    const k56Result = await (0, leader_supported_projection_source_1.validateCharacterLeaderSupportedProjectionArtifact)({ ...common, artifactRoot: options.k56Root });
    if (k56Result.sourceBoundValidation !== "GO")
        throw new Error("K60 requires K56 source-bound GO");
    const built = makePlan(k58Result.artifacts, k56Result.artifacts);
    return {
        k58: k58Result.artifacts, k56: k56Result.artifacts, ...built,
        fingerprint: hash(jsonBytes(built.plan)), k55Peak: Math.max(k58Result.k55ValidationProcessPeakRssBytes, k56Result.k55ValidationProcessPeakRssBytes),
    };
}
function assertK59(k59, snapshot, checkedAt) {
    if (k59.report.readiness.remotePreflight !== "GO" || k59.report.checkedAt !== checkedAt
        || k59.report.objects.length !== 4 || k59.report.checks.exactFiveOrderedGets !== true
        || json(k59.report.objects.map(object => object.objectKey)) !== json(snapshot.plan.immutableObjects.map(object => object.objectKey))
        || k59.report.manifest.objectKey !== snapshot.plan.mutableManifest.objectKey
        || k59.report.source.candidateManifestSha256 !== hash(snapshot.k58.candidateManifestBytes)
        || k59.report.source.candidateManifestSizeBytes !== snapshot.k58.candidateManifestBytes.length
        || k59.report.source.planSha256 !== hash(snapshot.k58.planBytes) || k59.report.source.planSizeBytes !== snapshot.k58.planBytes.length
        || k59.report.source.receiptSha256 !== hash(snapshot.k58.receiptBytes) || k59.report.source.receiptSizeBytes !== snapshot.k58.receiptBytes.length
        || k59.report.source.markerSha256 !== hash(snapshot.k58.markerBytes) || k59.report.source.markerSizeBytes !== snapshot.k58.markerBytes.length
        || k59.report.source.fullArtifactFingerprintSha256 !== snapshot.plan.source.k58FullArtifactFingerprintSha256
        || k59.report.source.lineageFingerprintSha256 !== snapshot.plan.source.k58LineageFingerprintSha256) {
        throw new Error("K60 requires fresh exact K59/K58 source-bound identity");
    }
}
function reportFor(options, snapshot, k59) {
    const actions = [
        ...k59.report.objects.map(object => ({ order: object.order, objectKey: object.objectKey,
            observedStatus: object.status, action: object.futureAction, precondition: object.futurePrecondition })),
        { order: "LAST", objectKey: k59.report.manifest.objectKey, observedStatus: k59.report.manifest.status,
            action: k59.report.manifest.futureAction, precondition: k59.report.manifest.futurePrecondition },
    ];
    return {
        schemaVersion: 1, contract: "dokkan-database-character-leader-supported-publisher",
        contractVersion: leader_supported_publisher_contract_1.CHARACTER_LEADER_SUPPORTED_PUBLISHER_CONTRACT_VERSION, checkedAt: options.checkedAt,
        mode: "operational-prepublication-dry-run", publicationId: snapshot.plan.publicationId, plan: snapshot.plan,
        k59: { reportSha256: k59.reportSha256, checkedAt: k59.report.checkedAt, remotePreflight: "GO", actions },
        checks: {
            k59FreshRealReadOnlyGo: true, k58SourceBoundAfterK59: true,
            publicationIdExcludesCheckedAtAndK59Observations: true, clientConstruction: "NOT_EXECUTED",
            credentialRead: false, remoteWriteCount: 0, localReportCreateOnly: true,
            outputNamespaceThreatModel: "caller_controlled_stable_during_operation",
            concurrentSameUserAncestorReplacementProtected: false,
        },
        readiness: {
            dryRun: "GO", publication: "NOT_EXECUTED", r2Mutation: "NO-GO", authority: "NO-GO", production: "NO-GO",
            android: "NO-GO", perProcessRssUnder1GiB: "NOT_EXECUTED", processTreeRssUnder1GiB: "NO-GO",
            concurrentOutputAncestorReplacement: "NO-GO",
        },
    };
}
async function inspectRoot(value) {
    const path = (0, path_1.resolve)(value), before = await (0, promises_1.lstat)(path), realPath = await (0, promises_1.realpath)(path), after = await (0, promises_1.lstat)(path);
    if (!before.isDirectory() || before.isSymbolicLink() || !sameFile(before, after) || !samePath(path, realPath))
        throw new Error("K60 output root link or drift rejected");
    return { path, realPath, dev: after.dev, ino: after.ino };
}
async function checkpoint(root) {
    const current = await inspectRoot(root.path);
    if (current.dev !== root.dev || current.ino !== root.ino)
        throw new Error("K60 output root changed");
}
async function child(parent, name) {
    if (!name || name.includes("/") || name.includes("\\"))
        throw new Error("K60 report path rejected");
    await checkpoint(parent);
    const path = (0, path_1.join)(parent.path, name);
    try {
        await (0, promises_1.mkdir)(path, { mode: 0o700 });
    }
    catch (error) {
        if (error?.code !== "EEXIST")
            throw error;
    }
    if (!contained(parent.realPath, path))
        throw new Error("K60 report containment rejected");
    return inspectRoot(path);
}
async function persistArtifact(outputRoot, publicationId, fileName, bytes) {
    if (bytes.length >= leader_supported_publisher_contract_1.CHARACTER_LEADER_SUPPORTED_PUBLISHER_REPORT_LIMIT_BYTES)
        throw new Error("K60 artifact limit reached");
    const root = await inspectRoot(outputRoot), namespace = await child(root, leader_supported_publisher_contract_1.CHARACTER_LEADER_SUPPORTED_PUBLISHER_REPORT_NAMESPACE);
    const publication = await child(namespace, publicationId), artifactSha256 = hash(bytes), directory = await child(publication, artifactSha256);
    const path = (0, path_1.join)(directory.path, fileName);
    let handle;
    try {
        handle = await (0, promises_1.open)(path, fs_1.constants.O_CREAT | fs_1.constants.O_EXCL | fs_1.constants.O_WRONLY | (fs_1.constants.O_NOFOLLOW ?? 0), 0o600);
    }
    catch (error) {
        throw new Error(error?.code === "EEXIST" ? "K60 create-only report already exists" : "K60 report create failed");
    }
    try {
        await handle.writeFile(bytes);
        await handle.sync();
        const stat = await handle.stat();
        if (!stat.isFile() || stat.nlink !== 1 || stat.size !== bytes.length)
            throw new Error("K60 report identity rejected");
    }
    finally {
        await handle.close();
    }
    const visible = await (0, promises_1.lstat)(path);
    if (!visible.isFile() || visible.isSymbolicLink() || visible.nlink !== 1 || !samePath(path, await (0, promises_1.realpath)(path)))
        throw new Error("K60 report link rejected");
    const reader = await (0, promises_1.open)(path, fs_1.constants.O_RDONLY | (fs_1.constants.O_NOFOLLOW ?? 0));
    try {
        if (!(await reader.readFile()).equals(bytes))
            throw new Error("K60 report reread mismatch");
    }
    finally {
        await reader.close();
    }
    await checkpoint(root);
    return { artifactPath: path, artifactSha256 };
}
async function persist(outputRoot, report) {
    const persisted = await persistArtifact(outputRoot, report.publicationId, leader_supported_publisher_contract_1.CHARACTER_LEADER_SUPPORTED_PUBLISHER_REPORT_FILE, jsonBytes(report));
    return { reportPath: persisted.artifactPath, reportSha256: persisted.artifactSha256 };
}
function aggregate() {
    return { bytes: 0, consume(count) { if (!Number.isSafeInteger(count) || count < 0 || this.bytes + count >= leader_supported_publisher_contract_1.CHARACTER_LEADER_SUPPORTED_PUBLISHER_AGGREGATE_LIMIT_BYTES)
            throw new Error("K60 aggregate read limit reached"); this.bytes += count; } };
}
function strongEtag(value) { return /^"[\x21\x23-\x7e\x80-\xff]+"$/.test(value); }
function code(error) { return error?.$metadata?.httpStatusCode; }
function missing(error) { return code(error) === 404 || /^(?:NoSuchKey|NotFound)$/.test(error?.name ?? ""); }
function precondition(error) { return code(error) === 409 || code(error) === 412 || /^(?:ConditionalRequestConflict|PreconditionFailed)$/.test(error?.name ?? ""); }
async function body(bodyValue, counter) {
    if (!bodyValue || !(Symbol.asyncIterator in Object(bodyValue)))
        throw new Error("K60 R2 body rejected");
    const chunks = [];
    let total = 0;
    for await (const value of bodyValue) {
        const bytes = Buffer.from(value);
        total += bytes.length;
        if (total >= leader_supported_publisher_contract_1.CHARACTER_LEADER_SUPPORTED_PUBLISHER_OBJECT_LIMIT_BYTES)
            throw new Error("K60 object limit reached");
        counter.consume(bytes.length);
        chunks.push(bytes);
    }
    return Buffer.concat(chunks, total);
}
function createS3Adapter() {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? "", accessKeyId = process.env.R2_ACCESS_KEY_ID ?? "", secretAccessKey = process.env.R2_SECRET_ACCESS_KEY ?? "";
    if (!ACCOUNT.test(accountId) || !accessKeyId || !secretAccessKey || /[\r\n]/.test(accessKeyId + secretAccessKey))
        throw new Error("K60 publish environment rejected");
    const client = new client_s3_1.S3Client({ region: leader_supported_publisher_contract_1.CHARACTER_LEADER_SUPPORTED_PUBLISHER_REGION,
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`, credentials: { accessKeyId, secretAccessKey } });
    return {
        read: async (key, counter) => {
            try {
                const output = await client.send(new client_s3_1.GetObjectCommand({ Bucket: leader_supported_publisher_contract_1.CHARACTER_LEADER_SUPPORTED_PUBLISHER_BUCKET, Key: key }));
                if (!output.ETag || !strongEtag(output.ETag))
                    throw new Error("K60 R2 ETag rejected");
                return { status: "present", bytes: await body(output.Body, counter), etag: output.ETag, contentType: output.ContentType, cacheControl: output.CacheControl };
            }
            catch (error) {
                if (missing(error))
                    return { status: "missing" };
                throw error;
            }
        },
        put: async (key, bytes, contentType, cacheControl, condition) => {
            try {
                await client.send(new client_s3_1.PutObjectCommand({ Bucket: leader_supported_publisher_contract_1.CHARACTER_LEADER_SUPPORTED_PUBLISHER_BUCKET, Key: key, Body: bytes, ContentType: contentType, CacheControl: cacheControl, ...condition }));
                return "written";
            }
            catch (error) {
                if (precondition(error))
                    return "precondition_failed";
                throw error;
            }
        },
    };
}
function exact(value, bytes, contentType, cacheControl) {
    return value.status === "present" && value.bytes.length === bytes.length && hash(value.bytes) === hash(bytes)
        && value.contentType === contentType && value.cacheControl === cacheControl;
}
function same(left, right) {
    return left.status === right.status && (left.status === "missing" || (right.status === "present" && left.etag === right.etag
        && left.contentType === right.contentType && left.cacheControl === right.cacheControl && left.bytes.equals(right.bytes)));
}
async function publish(adapter, source, options) {
    const counter = aggregate(), initial = [];
    for (const object of source.objects)
        initial.push(await adapter.read(object.plan.objectKey, counter));
    const initialManifest = await adapter.read(source.plan.mutableManifest.objectKey, counter);
    let immutableUploaded = 0, immutableReused = 0;
    for (let index = 0; index < 4; index++) {
        const object = source.objects[index], current = initial[index];
        if (current.status === "present") {
            if (!exact(current, object.bytes, object.plan.contentType, object.plan.cacheControl))
                throw new Error("K60 immutable conflict");
            immutableReused++;
            continue;
        }
        const result = await adapter.put(object.plan.objectKey, object.bytes, object.plan.contentType, object.plan.cacheControl, { IfNoneMatch: "*" });
        const verified = await adapter.read(object.plan.objectKey, counter);
        if (!exact(verified, object.bytes, object.plan.contentType, object.plan.cacheControl))
            throw new Error("K60 immutable write/race verification failed");
        if (result === "written")
            immutableUploaded++;
        else
            immutableReused++;
    }
    const fresh = await loadSnapshot(options);
    if (fresh.fingerprint !== source.fingerprint || fresh.plan.publicationId !== source.plan.publicationId)
        throw new Error("K60 source drifted before mutable manifest");
    for (const object of source.objects)
        if (!exact(await adapter.read(object.plan.objectKey, counter), object.bytes, object.plan.contentType, object.plan.cacheControl))
            throw new Error("K60 immutable changed before manifest");
    const freshManifest = await adapter.read(source.plan.mutableManifest.objectKey, counter);
    let manifestResult;
    if (exact(freshManifest, source.candidateBytes, "application/json", "no-store"))
        manifestResult = same(initialManifest, freshManifest) ? "REUSED" : "CONCURRENT_IDEMPOTENT_COMPLETION";
    else {
        if (!same(initialManifest, freshManifest))
            throw new Error("K60 manifest freshness changed before CAS");
        if (freshManifest.status === "present" && !strongEtag(freshManifest.etag))
            throw new Error("K60 manifest requires fresh strong ETag");
        const condition = freshManifest.status === "missing" ? { IfNoneMatch: "*" } : { IfMatch: freshManifest.etag };
        const result = await adapter.put(source.plan.mutableManifest.objectKey, source.candidateBytes, "application/json", "no-store", condition);
        manifestResult = result === "precondition_failed" ? "CONCURRENT_IDEMPOTENT_COMPLETION" : freshManifest.status === "missing" ? "CREATED" : "REPLACED";
    }
    if (!exact(await adapter.read(source.plan.mutableManifest.objectKey, counter), source.candidateBytes, "application/json", "no-store"))
        throw new Error("K60 final manifest verification failed");
    return {
        publicationId: source.plan.publicationId, immutableUploaded, immutableReused, immutableVerified: 4,
        manifestResult, manifestLast: true, finalManifestVerified: true, deleteCount: 0, unconditionalWriteCount: 0, copyCount: 0, multipartCount: 0,
        readiness: { publicationExecution: "COMPLETED_CONDITIONALLY", authority: "NO-GO", production: "NO-GO", android: "NO-GO" },
    };
}
class Rss {
    peak = Math.max(process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024);
    timer = setInterval(() => this.observe(), 10);
    constructor() { this.timer.unref(); }
    observe() { this.peak = Math.max(this.peak, process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024); }
    stop() { clearInterval(this.timer); this.observe(); if (this.peak >= leader_supported_publisher_contract_1.CHARACTER_LEADER_SUPPORTED_PUBLISHER_RSS_LIMIT_BYTES)
        throw new Error("K60 parent RSS limit reached"); return this.peak; }
    dispose() { clearInterval(this.timer); }
}
async function runCharacterLeaderSupportedPublisher(options) {
    const rss = new Rss();
    try {
        if (options?.optIn !== true || (options.mode !== "dry-run" && options.mode !== "publish"))
            throw new Error("K60 requires explicit opt-in and one mode");
        if (options.mode === "dry-run" && options.confirmPublicationId !== undefined)
            throw new Error("K60 dry-run forbids confirmation");
        if (options.mode === "publish" && !HASH.test(options.confirmPublicationId ?? ""))
            throw new Error("K60 publish requires canonical confirmation");
        if (!CHECKED_AT.test(options.checkedAt) || new Date(options.checkedAt).toISOString() !== options.checkedAt)
            throw new Error("K60 checkedAt rejected");
        if (typeof global.gc !== "function")
            throw new Error("K60 requires Node --expose-gc");
        const output = await inspectRoot(options.outputRoot), k59Root = await inspectRoot(options.k59OutputRoot);
        if (contained(output.realPath, k59Root.realPath) || contained(k59Root.realPath, output.realPath))
            throw new Error("K60 output/K59 root separation rejected");
        if ((await (0, promises_1.readdir)(k59Root.path)).length !== 0)
            throw new Error("K60 requires a fresh empty K59 output root");
        for (const [label, path] of [
            ["sidecar", options.sidecarRoot], ["production", options.productionRoot], ["FYI", options.fyiRoot],
            ["K43", options.k43Root], ["K46", options.k46Root], ["K48", options.k48Root],
            ["K56", options.k56Root], ["K58", options.k58Root],
        ]) {
            const source = await inspectRoot(path);
            if (contained(output.realPath, source.realPath) || contained(source.realPath, output.realPath)
                || contained(k59Root.realPath, source.realPath) || contained(source.realPath, k59Root.realPath)) {
                throw new Error(`K60 K59/K60 output separation from ${label} rejected`);
            }
        }
        for (const [label, path] of [["native runtime", options.nativeRuntime], ["database", options.database]]) {
            const metadata = await (0, promises_1.lstat)((0, path_1.resolve)(path)), canonical = await (0, promises_1.realpath)((0, path_1.resolve)(path));
            if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.nlink !== 1
                || contained(output.realPath, canonical) || contained(k59Root.realPath, canonical))
                throw new Error(`K60 output separation from ${label} rejected`);
        }
        const k59 = await (0, leader_supported_remote_preflight_1.runCharacterLeaderSupportedRemotePreflight)({
            ...options, optIn: true, remoteReadOnly: true, outputRoot: options.k59OutputRoot,
        });
        if (k59.report.readiness.remotePreflight !== "GO")
            throw new Error("K60 requires fresh K59 GO");
        const snapshot = await loadSnapshot(options);
        assertK59(k59, snapshot, options.checkedAt);
        if (options.mode === "publish" && options.confirmPublicationId !== snapshot.plan.publicationId) {
            throw new Error("K60 publication confirmation mismatch");
        }
        const report = reportFor(options, snapshot, k59), persisted = await persist(options.outputRoot, report);
        let publication;
        let publicationReceipt;
        let publicationReceiptPath, publicationReceiptSha256;
        if (options.mode === "publish") {
            publication = await publish(createS3Adapter(), snapshot, options);
            publicationReceipt = {
                schemaVersion: 1, contract: "dokkan-database-character-leader-supported-publication-receipt",
                contractVersion: leader_supported_publisher_contract_1.CHARACTER_LEADER_SUPPORTED_PUBLISHER_CONTRACT_VERSION,
                publicationId: snapshot.plan.publicationId, planSha256: hash(jsonBytes(snapshot.plan)),
                k59ReportSha256: k59.reportSha256, source: snapshot.plan.source, summary: publication,
                finalManifestVerified: true,
                forbiddenOperations: { deleteCount: 0, unconditionalWriteCount: 0, copyCount: 0, multipartCount: 0 },
                rssValidation: "NOT_INCLUDED_ARTIFACT_IS_NOT_RSS_AUTHORITY",
            };
            const receipt = await persistArtifact(options.outputRoot, snapshot.plan.publicationId, leader_supported_publisher_contract_1.CHARACTER_LEADER_SUPPORTED_PUBLISHER_RECEIPT_FILE, jsonBytes(publicationReceipt));
            publicationReceiptPath = receipt.artifactPath;
            publicationReceiptSha256 = receipt.artifactSha256;
        }
        const parentPeak = rss.stop(), max = Math.max(k59.maximumIndividualProcessPeakRssBytes, snapshot.k55Peak, parentPeak);
        if (max >= leader_supported_publisher_contract_1.CHARACTER_LEADER_SUPPORTED_PUBLISHER_RSS_LIMIT_BYTES)
            throw new Error("K60 per-process RSS limit reached");
        return {
            ...persisted, publicationId: snapshot.plan.publicationId, report, publication,
            publicationReceiptPath, publicationReceiptSha256, publicationReceipt,
            rssAccountingScope: "per_process_not_process_tree", k59MaximumIndividualProcessPeakRssBytes: k59.maximumIndividualProcessPeakRssBytes,
            k58K55ValidationProcessPeakRssBytes: snapshot.k55Peak, k60ParentProcessPeakRssBytes: parentPeak, maximumIndividualProcessPeakRssBytes: max,
        };
    }
    finally {
        rss.dispose();
    }
}
exports.runCharacterLeaderSupportedPublisher = runCharacterLeaderSupportedPublisher;
//# sourceMappingURL=leader-supported-publisher.js.map