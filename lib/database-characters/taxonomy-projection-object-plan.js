"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTaxonomyProjectionObjectPlan = exports.readValidatedTaxonomyProjectionObjectPlan = void 0;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const taxonomy_projection_delivery_1 = require("./taxonomy-projection-delivery");
const taxonomy_projection_object_plan_contract_1 = require("./taxonomy-projection-object-plan-contract");
const taxonomy_projection_contract_1 = require("./taxonomy-projection-contract");
const ID = /^[a-f0-9]{64}$/;
const HASH = /^[a-f0-9]{64}$/;
const PAYLOAD_NAME = /^database-characters-k35-taxonomy-projection\.[a-f0-9]{64}\.json\.gz$/;
const IMMUTABLE_CACHE = "public, max-age=31536000, immutable";
const LOCAL_FILES = [
    taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_FILE,
    taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_REMOTE_MANIFEST_CANDIDATE_FILE,
    taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_RECEIPT,
    taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_MARKER,
];
const hash = (value) => (0, crypto_1.createHash)("sha256").update(value).digest("hex");
const jsonBytes = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
const samePath = (left, right) => process.platform === "win32"
    ? (0, path_1.resolve)(left).toLowerCase() === (0, path_1.resolve)(right).toLowerCase()
    : (0, path_1.resolve)(left) === (0, path_1.resolve)(right);
const sameFile = (left, right) => left.dev === right.dev && left.ino === right.ino;
class RssGuard {
    peak = Math.max(process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024);
    exceeded = false;
    timer = setInterval(() => this.observe(), 10);
    constructor() { this.timer.unref(); }
    observe() {
        this.peak = Math.max(this.peak, process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024);
        this.exceeded ||= this.peak >= taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_RSS_LIMIT_BYTES;
    }
    sample(nestedPeak = 0) {
        this.observe();
        this.peak = Math.max(this.peak, nestedPeak);
        this.exceeded ||= this.peak >= taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_RSS_LIMIT_BYTES;
        if (this.exceeded)
            throw new Error(`K37 RSS limit reached: ${this.peak}`);
    }
    stop() { clearInterval(this.timer); this.sample(); return this.peak; }
    dispose() { clearInterval(this.timer); }
}
function boundedMessage(error) {
    return (error instanceof Error ? error.message : String(error)).slice(0, taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_MAX_ERROR_LENGTH);
}
function boundedFailure(prefix, error) {
    return new Error(`${prefix}${boundedMessage(error)}`.slice(0, taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_MAX_ERROR_LENGTH));
}
function assertContained(root, path) {
    const remainder = (0, path_1.relative)(root, path);
    if (remainder === "" || remainder === ".." || remainder.startsWith(`..${path_1.sep}`) || (0, path_1.isAbsolute)(remainder)) {
        if (remainder !== "")
            throw new Error("K37 path escaped the controlled root");
    }
}
async function inspectDirectory(value, label) {
    const path = (0, path_1.resolve)(value);
    const metadata = await (0, promises_1.lstat)(path);
    if (!metadata.isDirectory() || metadata.isSymbolicLink())
        throw new Error(`K37 ${label} must be an existing regular non-link directory`);
    const canonical = await (0, promises_1.realpath)(path);
    if (!samePath(path, canonical))
        throw new Error(`K37 ${label} symlink or junction rejected`);
    return { path, realPath: canonical, dev: metadata.dev, ino: metadata.ino };
}
async function checkpoint(expected, label) {
    const actual = await inspectDirectory(expected.path, label);
    if (!samePath(actual.realPath, expected.realPath) || actual.dev !== expected.dev || actual.ino !== expected.ino) {
        throw new Error(`K37 ${label} identity changed`);
    }
}
function deliveryOptions(options) {
    if (!options?.k36OutputRoot || !options.k36ReleaseId || !ID.test(options.k36ReleaseId) || (0, path_1.isAbsolute)(options.k36ReleaseId)
        || !options.k32Root || !options.k2Root || !options.productiveRoot || !options.sqliteRoot || !options.db1Root
        || !options.elfRoot || !options.nativeEvidenceRoot) {
        throw new Error("K37 requires a canonical K36 release ID and explicit K36, K32, K2, productive, SQLite, DB1, ELF and native-evidence roots");
    }
    return {
        outputRoot: options.k36OutputRoot,
        releaseId: options.k36ReleaseId,
        k32Root: options.k32Root,
        k2Root: options.k2Root,
        productiveRoot: options.productiveRoot,
        sqliteRoot: options.sqliteRoot,
        db1Root: options.db1Root,
        elfRoot: options.elfRoot,
        nativeEvidenceRoot: options.nativeEvidenceRoot,
    };
}
function expectedK35Inventory(entries) {
    if (entries.length !== 4 || JSON.stringify(entries.map(entry => entry.kind)) !== JSON.stringify(["payload", "coverage", "validation", "manifest"])) {
        throw new Error("K37 requires exactly the four ordered K35 artifacts");
    }
    const expectedNames = [entries[0].fileName, taxonomy_projection_contract_1.TAXONOMY_PROJECTION_FILES.coverage,
        taxonomy_projection_contract_1.TAXONOMY_PROJECTION_FILES.validation, taxonomy_projection_contract_1.TAXONOMY_PROJECTION_FILES.manifest];
    if (!PAYLOAD_NAME.test(entries[0].fileName)
        || entries[0].fileName !== `database-characters-k35-taxonomy-projection.${entries[0].sha256}.json.gz`
        || JSON.stringify(entries.map(entry => entry.fileName)) !== JSON.stringify(expectedNames)
        || new Set(expectedNames).size !== 4
        || entries.some(entry => !HASH.test(entry.sha256) || !Number.isSafeInteger(entry.sizeBytes) || entry.sizeBytes <= 0
            || entry.fileName.includes("/") || entry.fileName.includes("\\") || (0, path_1.isAbsolute)(entry.fileName))) {
        throw new Error("K37 K35 inventory name, hash, or size rejected");
    }
}
function sourceFrom(delivery) {
    const receiptBytes = jsonBytes(delivery.receipt);
    const markerBytes = jsonBytes(delivery.marker);
    const k35 = delivery.receipt.source.k35;
    return {
        k36: {
            contract: delivery.receipt.contract,
            contractVersion: delivery.receipt.contractVersion,
            releaseId: delivery.releaseId,
            receiptSha256: hash(receiptBytes),
            receiptSizeBytes: receiptBytes.length,
            markerSha256: hash(markerBytes),
            markerSizeBytes: markerBytes.length,
            sourceBoundValidation: delivery.sourceBoundK35Validation,
        },
        k35: {
            contract: k35.contract,
            contractVersion: k35.contractVersion,
            manifestSha256: k35.manifestSha256,
            manifestSizeBytes: k35.manifestSizeBytes,
            payloadSha256: k35.payloadSha256,
            payloadSizeBytes: k35.payloadSizeBytes,
            rawSha256: k35.rawSha256,
            rawSizeBytes: k35.rawSizeBytes,
            coverageSha256: k35.coverageSha256,
            coverageSizeBytes: k35.coverageSizeBytes,
            validationSha256: k35.validationSha256,
            validationSizeBytes: k35.validationSizeBytes,
            lineage: k35.lineage,
        },
    };
}
function remoteObjects(entries) {
    expectedK35Inventory(entries);
    const objects = entries.map(entry => ({
        kind: entry.kind,
        sourceFileName: entry.fileName,
        objectKey: `${taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_REMOTE_NAMESPACE}/objects/sha256/${entry.sha256}/${entry.fileName}`,
        sha256: entry.sha256,
        sizeBytes: entry.sizeBytes,
        cacheControl: IMMUTABLE_CACHE,
        contentAddressed: true,
        remoteHashProofRequiredBeforeReuse: true,
    }));
    const keyPattern = /^database-characters\/taxonomy-projection\/v1\/objects\/sha256\/[a-f0-9]{64}\/database-characters-k35-taxonomy-projection(?:\.[a-f0-9]{64}\.json\.gz|-coverage\.json|-validation\.json|-manifest\.json)$/;
    if (new Set(objects.map(object => object.objectKey)).size !== 4
        || objects.some(object => !keyPattern.test(object.objectKey)))
        throw new Error("K37 duplicate or non-allowlisted object key rejected");
    return objects;
}
function buildBundle(delivery) {
    if (delivery.releaseId !== delivery.receipt.releaseId || delivery.sourceBoundK35Validation !== "GO") {
        throw new Error("K37 source-bound K36 result rejected");
    }
    const entries = delivery.receipt.inventory.entries;
    const k35 = delivery.receipt.source.k35;
    if (entries[0]?.sha256 !== k35.payloadSha256 || entries[0]?.sizeBytes !== k35.payloadSizeBytes
        || entries[1]?.sha256 !== k35.coverageSha256 || entries[1]?.sizeBytes !== k35.coverageSizeBytes
        || entries[2]?.sha256 !== k35.validationSha256 || entries[2]?.sizeBytes !== k35.validationSizeBytes
        || entries[3]?.sha256 !== k35.manifestSha256 || entries[3]?.sizeBytes !== k35.manifestSizeBytes) {
        throw new Error("K37 K36 and K35 artifact lineage mismatch");
    }
    const objects = remoteObjects(entries);
    const source = sourceFrom(delivery);
    const manifestCandidate = {
        schemaVersion: taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_SCHEMA_VERSION,
        contract: "dokkan-database-character-taxonomy-projection-remote-manifest-candidate-k37",
        contractVersion: taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_CONTRACT_VERSION,
        generatedAt: delivery.receipt.generatedAt,
        datasetVersion: delivery.receipt.datasetVersion,
        releaseId: delivery.releaseId,
        source,
        inventory: { closed: true, artifactCount: 4, objects },
        cacheControl: "no-store",
        state: "MUTABLE_REMOTE_MANIFEST_CANDIDATE_ONLY",
        readiness: { consumer: "NO-GO", authority: "NO-GO", publication: "NO-GO", production: "NO-GO" },
    };
    const manifestCandidateBytes = jsonBytes(manifestCandidate);
    if (manifestCandidateBytes.length > taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_MAX_METADATA_BYTES) {
        throw new Error("K37 remote manifest candidate byte limit exceeded");
    }
    const immutableObjectBytes = objects.reduce((total, object) => total + object.sizeBytes, 0);
    const worstCaseNewBytes = immutableObjectBytes + taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_MANIFEST_RESERVATION_BYTES;
    if (!Number.isSafeInteger(immutableObjectBytes) || worstCaseNewBytes > taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_NAMESPACE_MAX_BYTES) {
        throw new Error("K37 conservative namespace budget exceeded");
    }
    const identity = {
        schemaVersion: taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_SCHEMA_VERSION,
        contract: "dokkan-database-character-taxonomy-projection-object-plan-identity-k37",
        contractVersion: taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_CONTRACT_VERSION,
        source,
        objects,
        manifestCandidateSha256: hash(manifestCandidateBytes),
        budget: {
            namespaceLimitBytes: taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_NAMESPACE_MAX_BYTES,
            immutableObjectBytes,
            mutableManifestReservationBytes: taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_MANIFEST_RESERVATION_BYTES,
            worstCaseNewBytes,
            bucketCeilingBytes: taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_BUCKET_CEILING_BYTES,
        },
    };
    const planId = hash(jsonBytes(identity));
    const readiness = {
        localObjectPlan: "GO", remoteInventory: "NO-GO", remotePreflight: "NO-GO", publication: "NO-GO",
        r2: "NO-GO", android: "NO-GO", consumer: "NO-GO", characterArray: "NO-GO",
        applyOrOverlay: "NO-GO", authority: "NO-GO", production: "NO-GO",
    };
    const plan = {
        schemaVersion: taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_SCHEMA_VERSION,
        contract: "dokkan-database-character-taxonomy-projection-object-plan-k37",
        contractVersion: taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_CONTRACT_VERSION,
        generatedAt: delivery.receipt.generatedAt,
        datasetVersion: delivery.receipt.datasetVersion,
        planId,
        mode: "explicit_opt_in_offline_local_only",
        source,
        remoteNamespace: taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_REMOTE_NAMESPACE,
        objects,
        mutableManifest: {
            localFileName: taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_REMOTE_MANIFEST_CANDIDATE_FILE,
            objectKey: taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY,
            sha256: hash(manifestCandidateBytes),
            sizeBytes: manifestCandidateBytes.length,
            cacheControl: "no-store",
            state: "CANDIDATE_ONLY",
        },
        budget: {
            namespaceLimitBytes: taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_NAMESPACE_MAX_BYTES,
            immutableObjectBytes,
            mutableManifestReservationBytes: taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_MANIFEST_RESERVATION_BYTES,
            worstCaseNewBytes,
            withinNamespaceLimit: true,
            bucketCeilingBytes: taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_BUCKET_CEILING_BYTES,
            remoteBucketBytes: "UNKNOWN",
            projectedBucketBytes: "UNKNOWN",
            withinBucketCeiling: "UNKNOWN",
            remotePreflightRequired: true,
        },
        checks: {
            sourceBoundK36Required: true,
            sourceRootsExplicit: true,
            exactK35ArtifactCount: 4,
            immutableKeysContentAddressed: true,
            immutableCacheOnlyForContentAddressedObjects: true,
            mutableManifestNoStore: true,
            noNetworkCodeInvoked: true,
        },
        readiness,
    };
    const planBytes = jsonBytes(plan);
    const receipt = {
        schemaVersion: taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_SCHEMA_VERSION,
        contract: "dokkan-database-character-taxonomy-projection-object-plan-stopped-receipt-k37",
        contractVersion: taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_CONTRACT_VERSION,
        generatedAt: delivery.receipt.generatedAt,
        planId,
        k36ReleaseId: delivery.releaseId,
        planSha256: hash(planBytes),
        planSizeBytes: planBytes.length,
        manifestCandidateSha256: hash(manifestCandidateBytes),
        manifestCandidateSizeBytes: manifestCandidateBytes.length,
        checks: {
            k36SourceBoundBeforePlan: true,
            k36SourceBoundAfterPlan: true,
            sourceUnchanged: true,
            twoConstructionByteIdentical: true,
            closedLocalInventory: true,
            createOnly: true,
            markerWrittenLast: true,
            localNamespaceBudgetWithinLimit: true,
            remoteBucketBudgetAwaitingPreflight: true,
            noNetworkCodeInvoked: true,
            noRemoteRead: true,
            noRemoteMutation: true,
        },
        readiness,
        state: "STOPPED_BEFORE_REMOTE_PREFLIGHT",
    };
    const receiptBytes = jsonBytes(receipt);
    const files = {
        [taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_FILE]: { sha256: hash(planBytes), sizeBytes: planBytes.length },
        [taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_REMOTE_MANIFEST_CANDIDATE_FILE]: { sha256: hash(manifestCandidateBytes), sizeBytes: manifestCandidateBytes.length },
        [taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_RECEIPT]: { sha256: hash(receiptBytes), sizeBytes: receiptBytes.length },
    };
    const marker = {
        schemaVersion: taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_SCHEMA_VERSION,
        contract: "dokkan-database-character-taxonomy-projection-object-plan-ready-k37",
        contractVersion: taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_CONTRACT_VERSION,
        planId,
        files,
        inventory: { closed: true, expectedNames: [...LOCAL_FILES].sort(), markerWrittenLast: true },
        readiness,
        state: "STOPPED_BEFORE_REMOTE_PREFLIGHT",
    };
    const markerBytes = jsonBytes(marker);
    if ([planBytes, receiptBytes, markerBytes].some(bytes => bytes.length > taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_MAX_METADATA_BYTES)
        || planBytes.length + manifestCandidateBytes.length + receiptBytes.length + markerBytes.length >= taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_LOCAL_BUNDLE_MAX_BYTES) {
        throw new Error("K37 local metadata bundle byte limit exceeded");
    }
    return { planId, plan, planBytes, manifestCandidate, manifestCandidateBytes, receipt, receiptBytes, marker, markerBytes };
}
function sameBundle(left, right) {
    return left.planId === right.planId && left.planBytes.equals(right.planBytes)
        && left.manifestCandidateBytes.equals(right.manifestCandidateBytes)
        && left.receiptBytes.equals(right.receiptBytes) && left.markerBytes.equals(right.markerBytes);
}
function bundleFiles(bundle) {
    return [
        { name: taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_FILE, bytes: bundle.planBytes },
        { name: taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_REMOTE_MANIFEST_CANDIDATE_FILE, bytes: bundle.manifestCandidateBytes },
        { name: taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_RECEIPT, bytes: bundle.receiptBytes },
        { name: taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_MARKER, bytes: bundle.markerBytes },
    ];
}
async function writeExclusive(directory, name, bytes) {
    if (!LOCAL_FILES.includes(name))
        throw new Error("K37 local member name rejected");
    await checkpoint(directory, "plan directory");
    const path = (0, path_1.join)(directory.path, name);
    assertContained(directory.path, path);
    const handle = await (0, promises_1.open)(path, fs_1.constants.O_CREAT | fs_1.constants.O_EXCL | fs_1.constants.O_WRONLY | (fs_1.constants.O_NOFOLLOW ?? 0), 0o600);
    try {
        await handle.writeFile(bytes);
        await handle.sync();
        const metadata = await handle.stat();
        if (!metadata.isFile() || metadata.nlink !== 1 || metadata.size !== bytes.length)
            throw new Error("K37 created member identity rejected");
        return { path, bytes, metadata };
    }
    finally {
        await handle.close();
    }
}
async function readSnapshot(directory, name) {
    if (!LOCAL_FILES.includes(name))
        throw new Error("K37 local member name rejected");
    const path = (0, path_1.join)(directory.path, name);
    assertContained(directory.path, path);
    const before = await (0, promises_1.lstat)(path);
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || before.size > taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_MAX_METADATA_BYTES
        || !samePath(await (0, promises_1.realpath)(path), path))
        throw new Error("K37 local member must be a bounded single-link regular file");
    const handle = await (0, promises_1.open)(path, fs_1.constants.O_RDONLY | (fs_1.constants.O_NOFOLLOW ?? 0));
    try {
        const opened = await handle.stat();
        if (!sameFile(before, opened) || opened.nlink !== 1)
            throw new Error("K37 local member identity changed while opening");
        const bytes = await handle.readFile();
        const after = await handle.stat();
        const pathAfter = await (0, promises_1.lstat)(path);
        if (!sameFile(opened, after) || !sameFile(opened, pathAfter) || after.nlink !== 1 || after.size !== bytes.length
            || after.mtimeMs !== opened.mtimeMs || after.ctimeMs !== opened.ctimeMs)
            throw new Error("K37 local member changed while reading");
        return { path, bytes, metadata: after };
    }
    finally {
        await handle.close();
    }
}
async function verifyOwnedFile(file) {
    const current = await (0, promises_1.lstat)(file.path);
    if (!current.isFile() || current.isSymbolicLink() || current.nlink !== 1 || !sameFile(current, file.metadata)
        || !samePath(await (0, promises_1.realpath)(file.path), file.path))
        throw new Error("K37 created member changed");
    const handle = await (0, promises_1.open)(file.path, fs_1.constants.O_RDONLY | (fs_1.constants.O_NOFOLLOW ?? 0));
    try {
        const opened = await handle.stat();
        const bytes = await handle.readFile();
        if (!sameFile(current, opened) || !bytes.equals(file.bytes))
            throw new Error("K37 created member bytes changed");
    }
    finally {
        await handle.close();
    }
}
async function safelyRemoveOwnedFile(file) {
    try {
        await verifyOwnedFile(file);
        const current = await (0, promises_1.lstat)(file.path);
        if (sameFile(current, file.metadata) && current.nlink === 1)
            await (0, promises_1.unlink)(file.path);
    }
    catch { /* Preserve anything whose identity is no longer ours. */ }
}
async function materializeBundle(outputRootValue, bundle, beforeMarker) {
    const outputRoot = await inspectDirectory(outputRootValue, "output root");
    const namespacePath = (0, path_1.join)(outputRoot.path, taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_NAMESPACE);
    assertContained(outputRoot.path, namespacePath);
    try {
        await (0, promises_1.mkdir)(namespacePath, { mode: 0o700 });
    }
    catch (error) {
        if (error?.code !== "EEXIST")
            throw error;
    }
    await checkpoint(outputRoot, "output root");
    const namespace = await inspectDirectory(namespacePath, "object-plan namespace");
    const planPath = (0, path_1.join)(namespace.path, bundle.planId);
    assertContained(namespace.path, planPath);
    try {
        await (0, promises_1.mkdir)(planPath, { mode: 0o700 });
    }
    catch (error) {
        if (error?.code === "EEXIST")
            throw new Error("K37 content-addressed plan already exists");
        throw error;
    }
    const directory = await inspectDirectory(planPath, "plan directory");
    const written = [];
    try {
        for (const file of bundleFiles(bundle).slice(0, 3)) {
            written.push(await writeExclusive(directory, file.name, file.bytes));
            await verifyOwnedFile(written[written.length - 1]);
        }
        await beforeMarker();
        await checkpoint(outputRoot, "output root");
        await checkpoint(namespace, "object-plan namespace");
        await checkpoint(directory, "plan directory");
        const marker = bundleFiles(bundle)[3];
        written.push(await writeExclusive(directory, marker.name, marker.bytes));
        await verifyOwnedFile(written[written.length - 1]);
        return directory.path;
    }
    catch (error) {
        for (const file of written.reverse())
            await safelyRemoveOwnedFile(file);
        await (0, promises_1.rmdir)(directory.path).catch(() => undefined);
        throw error;
    }
}
async function capturePlanDirectory(outputRootValue, planId) {
    if (!outputRootValue || !ID.test(planId) || (0, path_1.isAbsolute)(planId))
        throw new Error("K37 requires an explicit output root and canonical plan ID");
    const outputRoot = await inspectDirectory(outputRootValue, "output root");
    const namespacePath = (0, path_1.join)(outputRoot.path, taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_NAMESPACE);
    assertContained(outputRoot.path, namespacePath);
    const namespace = await inspectDirectory(namespacePath, "object-plan namespace");
    const planPath = (0, path_1.join)(namespace.path, planId);
    assertContained(namespace.path, planPath);
    const directory = await inspectDirectory(planPath, "plan directory");
    return { outputRoot, namespace, directory };
}
async function readClosedBundle(directory) {
    const entries = await (0, promises_1.readdir)(directory.path, { withFileTypes: true });
    if (entries.some(entry => !entry.isFile() || entry.isSymbolicLink())
        || JSON.stringify(entries.map(entry => entry.name).sort()) !== JSON.stringify([...LOCAL_FILES].sort())) {
        throw new Error("K37 closed local inventory rejected");
    }
    return new Map(await Promise.all(LOCAL_FILES.map(async (name) => [name, await readSnapshot(directory, name)])));
}
function assertSnapshotBundle(snapshots, expected) {
    for (const file of bundleFiles(expected)) {
        const snapshot = snapshots.get(file.name);
        if (!snapshot || !snapshot.bytes.equals(file.bytes))
            throw new Error(`K37 local ${file.name.slice(0, 96)} bytes or source lineage mismatch`);
    }
}
async function validateLocalBundle(outputRootValue, expected) {
    const identities = await capturePlanDirectory(outputRootValue, expected.planId);
    const before = await readClosedBundle(identities.directory);
    assertSnapshotBundle(before, expected);
    const after = await readClosedBundle(identities.directory);
    for (const name of LOCAL_FILES) {
        const left = before.get(name);
        const right = after.get(name);
        if (!sameFile(left.metadata, right.metadata) || !left.bytes.equals(right.bytes))
            throw new Error("K37 local member mutated during validation");
    }
    await checkpoint(identities.outputRoot, "output root");
    await checkpoint(identities.namespace, "object-plan namespace");
    await checkpoint(identities.directory, "plan directory");
    return identities.directory.path;
}
async function readValidatedTaxonomyProjectionObjectPlan(options) {
    const rss = new RssGuard();
    try {
        if (!options?.outputRoot || !options.planId || !ID.test(options.planId) || (0, path_1.isAbsolute)(options.planId)) {
            throw new Error("K37 requires an explicit output root and canonical plan ID");
        }
        const identities = await capturePlanDirectory(options.outputRoot, options.planId);
        const before = await readClosedBundle(identities.directory);
        const delivery = await (0, taxonomy_projection_delivery_1.readValidatedTaxonomyProjectionDelivery)(deliveryOptions(options));
        rss.sample(delivery.peakRssBytes);
        const expected = buildBundle(delivery);
        if (expected.planId !== options.planId)
            throw new Error("K37 plan ID does not match source-bound K36 lineage");
        assertSnapshotBundle(before, expected);
        const after = await readClosedBundle(identities.directory);
        assertSnapshotBundle(after, expected);
        for (const name of LOCAL_FILES) {
            if (!sameFile(before.get(name).metadata, after.get(name).metadata))
                throw new Error("K37 local member identity changed during source validation");
        }
        await checkpoint(identities.outputRoot, "output root");
        await checkpoint(identities.namespace, "object-plan namespace");
        await checkpoint(identities.directory, "plan directory");
        const peakRssBytes = rss.stop();
        return {
            planDirectory: identities.directory.path,
            planId: expected.planId,
            plan: expected.plan,
            manifestCandidate: expected.manifestCandidate,
            receipt: expected.receipt,
            marker: expected.marker,
            sourceBoundK36Validation: "GO",
            peakRssBytes,
        };
    }
    catch (error) {
        throw boundedFailure("K37 object-plan validation failed: ", error);
    }
    finally {
        rss.dispose();
    }
}
exports.readValidatedTaxonomyProjectionObjectPlan = readValidatedTaxonomyProjectionObjectPlan;
async function runTaxonomyProjectionObjectPlan(options) {
    const rss = new RssGuard();
    try {
        if (options?.optIn !== true)
            throw new Error("K37 requires explicit opt-in");
        if (!options.outputRoot)
            throw new Error("K37 requires an explicit output root");
        await inspectDirectory(options.outputRoot, "output root");
        const sourceOptions = deliveryOptions(options);
        const before = await (0, taxonomy_projection_delivery_1.readValidatedTaxonomyProjectionDelivery)(sourceOptions);
        rss.sample(before.peakRssBytes);
        const first = buildBundle(before);
        const second = buildBundle(before);
        if (!sameBundle(first, second))
            throw new Error("K37 two-construction byte identity failed");
        const planDirectory = await materializeBundle(options.outputRoot, second, async () => {
            const after = await (0, taxonomy_projection_delivery_1.readValidatedTaxonomyProjectionDelivery)(sourceOptions);
            rss.sample(after.peakRssBytes);
            const rebuilt = buildBundle(after);
            if (!sameBundle(second, rebuilt))
                throw new Error("K37 K36 source bytes or lineage changed during planning");
        });
        await validateLocalBundle(options.outputRoot, second);
        const peakRssBytes = rss.stop();
        return {
            planDirectory,
            planId: second.planId,
            plan: second.plan,
            manifestCandidate: second.manifestCandidate,
            receipt: second.receipt,
            marker: second.marker,
            sourceBoundK36Validation: "GO",
            peakRssBytes,
            twoConstructionByteIdentical: true,
            sourceRevalidatedBeforeAndAfter: true,
        };
    }
    catch (error) {
        throw boundedFailure("K37 object plan failed: ", error);
    }
    finally {
        rss.dispose();
    }
}
exports.runTaxonomyProjectionObjectPlan = runTaxonomyProjectionObjectPlan;
//# sourceMappingURL=taxonomy-projection-object-plan.js.map