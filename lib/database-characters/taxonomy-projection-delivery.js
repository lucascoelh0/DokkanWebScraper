"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTaxonomyProjectionDelivery = exports.readValidatedTaxonomyProjectionDelivery = exports.validateTaxonomyProjectionDeliveryOutputRoot = void 0;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const taxonomy_projection_contract_1 = require("./taxonomy-projection-contract");
const taxonomy_projection_validator_1 = require("./taxonomy-projection-validator");
const taxonomy_projection_delivery_contract_1 = require("./taxonomy-projection-delivery-contract");
const RELEASE_ID = /^[a-f0-9]{64}$/;
const PAYLOAD_NAME = /^database-characters-k35-taxonomy-projection\.[a-f0-9]{64}\.json\.gz$/;
const hash = (bytes) => (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
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
        // maxRSS is the OS-recorded high-water mark in KiB and still captures
        // peaks while synchronous validation blocks the JavaScript event loop.
        this.peak = Math.max(this.peak, process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024);
        this.exceeded ||= this.peak >= taxonomy_projection_delivery_contract_1.TAXONOMY_PROJECTION_DELIVERY_RSS_LIMIT_BYTES;
    }
    sample(nestedPeak = 0) {
        this.observe();
        this.peak = Math.max(this.peak, nestedPeak);
        this.exceeded ||= this.peak >= taxonomy_projection_delivery_contract_1.TAXONOMY_PROJECTION_DELIVERY_RSS_LIMIT_BYTES;
        if (this.exceeded)
            throw new Error(`K36 RSS limit reached: ${this.peak}`);
    }
    stop() { clearInterval(this.timer); this.sample(); return this.peak; }
    dispose() { clearInterval(this.timer); }
}
function boundedMessage(error) {
    const value = error instanceof Error ? error.message : String(error);
    return value.slice(0, taxonomy_projection_delivery_contract_1.TAXONOMY_PROJECTION_DELIVERY_MAX_ERROR_LENGTH);
}
function assertContained(root, path) {
    const remainder = (0, path_1.relative)(root, path);
    if (remainder === "" || remainder === ".." || remainder.startsWith(`..${path_1.sep}`) || (0, path_1.isAbsolute)(remainder)) {
        if (remainder !== "")
            throw new Error("K36 path escaped the controlled root");
    }
}
async function inspectDirectory(value, label) {
    const path = (0, path_1.resolve)(value);
    const metadata = await (0, promises_1.lstat)(path);
    if (!metadata.isDirectory() || metadata.isSymbolicLink())
        throw new Error(`K36 ${label} must be an existing regular non-link directory`);
    const canonical = await (0, promises_1.realpath)(path);
    if (!samePath(path, canonical))
        throw new Error(`K36 ${label} symlink or junction rejected`);
    return { path, realPath: canonical, dev: metadata.dev, ino: metadata.ino };
}
async function checkpoint(expected, label) {
    const actual = await inspectDirectory(expected.path, label);
    if (!samePath(actual.realPath, expected.realPath) || actual.dev !== expected.dev || actual.ino !== expected.ino) {
        throw new Error(`K36 ${label} identity changed`);
    }
}
async function validateTaxonomyProjectionDeliveryOutputRoot(value) {
    if (!value)
        throw new Error("K36 output root is required");
    const root = await inspectDirectory(value, "output root");
    await checkpoint(root, "output root");
}
exports.validateTaxonomyProjectionDeliveryOutputRoot = validateTaxonomyProjectionDeliveryOutputRoot;
function artifactFiles(artifacts) {
    const manifest = artifacts.manifest;
    if (!PAYLOAD_NAME.test(manifest.fileName) || manifest.fileName !== `database-characters-k35-taxonomy-projection.${manifest.sha256}.json.gz`) {
        throw new Error("K36 K35 payload name rejected");
    }
    const files = [
        { entry: { kind: "payload", fileName: manifest.fileName, sha256: hash(artifacts.gzip), sizeBytes: artifacts.gzip.length }, bytes: artifacts.gzip },
        { entry: { kind: "coverage", fileName: taxonomy_projection_contract_1.TAXONOMY_PROJECTION_FILES.coverage, sha256: hash(artifacts.coverageBytes), sizeBytes: artifacts.coverageBytes.length }, bytes: artifacts.coverageBytes },
        { entry: { kind: "validation", fileName: taxonomy_projection_contract_1.TAXONOMY_PROJECTION_FILES.validation, sha256: hash(artifacts.validationBytes), sizeBytes: artifacts.validationBytes.length }, bytes: artifacts.validationBytes },
        { entry: { kind: "manifest", fileName: taxonomy_projection_contract_1.TAXONOMY_PROJECTION_FILES.manifest, sha256: hash(artifacts.manifestBytes), sizeBytes: artifacts.manifestBytes.length }, bytes: artifacts.manifestBytes },
    ];
    if (new Set(files.map(file => file.entry.fileName)).size !== 4)
        throw new Error("K36 K35 inventory names collided");
    if (manifest.sha256 !== files[0].entry.sha256 || manifest.sizeBytes !== files[0].entry.sizeBytes
        || manifest.coverageSha256 !== files[1].entry.sha256 || manifest.coverageSizeBytes !== files[1].entry.sizeBytes
        || manifest.validationSha256 !== files[2].entry.sha256 || manifest.validationSizeBytes !== files[2].entry.sizeBytes) {
        throw new Error("K36 K35 manifest inventory rejected");
    }
    return files;
}
function releaseIdentity(manifest, entries) {
    return hash(jsonBytes({
        schemaVersion: taxonomy_projection_delivery_contract_1.TAXONOMY_PROJECTION_DELIVERY_SCHEMA_VERSION,
        contract: "dokkan-database-character-taxonomy-projection-delivery-identity-k36",
        contractVersion: taxonomy_projection_delivery_contract_1.TAXONOMY_PROJECTION_DELIVERY_CONTRACT_VERSION,
        datasetVersion: manifest.datasetVersion,
        generatedAt: manifest.generatedAt,
        lineage: manifest.source,
        inventory: entries,
    }));
}
function buildReceipt(validated, files) {
    const artifacts = validated.artifacts;
    const manifest = artifacts.manifest;
    const entries = files.map(file => file.entry);
    const artifactBytes = entries.reduce((total, entry) => total + entry.sizeBytes, 0);
    if (artifactBytes >= taxonomy_projection_delivery_contract_1.TAXONOMY_PROJECTION_DELIVERY_MAX_BYTES)
        throw new Error("K36 local artifact budget exceeded");
    return {
        schemaVersion: taxonomy_projection_delivery_contract_1.TAXONOMY_PROJECTION_DELIVERY_SCHEMA_VERSION,
        contract: "dokkan-database-character-taxonomy-projection-delivery-k36",
        contractVersion: taxonomy_projection_delivery_contract_1.TAXONOMY_PROJECTION_DELIVERY_CONTRACT_VERSION,
        releaseId: releaseIdentity(manifest, entries),
        generatedAt: manifest.generatedAt,
        datasetVersion: manifest.datasetVersion,
        mode: "explicit_opt_in_offline_local_only",
        source: {
            k35: {
                contract: manifest.contract,
                contractVersion: manifest.contractVersion,
                manifestSha256: hash(artifacts.manifestBytes),
                manifestSizeBytes: artifacts.manifestBytes.length,
                payloadSha256: manifest.sha256,
                payloadSizeBytes: manifest.sizeBytes,
                rawSha256: manifest.uncompressedSha256,
                rawSizeBytes: manifest.uncompressedSizeBytes,
                coverageSha256: manifest.coverageSha256,
                coverageSizeBytes: manifest.coverageSizeBytes,
                validationSha256: manifest.validationSha256,
                validationSizeBytes: manifest.validationSizeBytes,
                lineage: manifest.source,
                sourceBoundValidation: validated.sourceBoundValidation.status,
                k32Revalidated: validated.sourceBoundValidation.k32Revalidated,
                k34RevalidatedInProcess: validated.sourceBoundValidation.k34RevalidatedInProcess,
                exactArtifactBytesMatched: validated.sourceBoundValidation.exactArtifactBytesMatched,
            },
        },
        inventory: { closed: true, artifactCount: 4, entries },
        budget: {
            maximumReleaseBytes: taxonomy_projection_delivery_contract_1.TAXONOMY_PROJECTION_DELIVERY_MAX_BYTES,
            maximumMetadataFileBytes: taxonomy_projection_delivery_contract_1.TAXONOMY_PROJECTION_DELIVERY_MAX_METADATA_BYTES,
            artifactBytes,
            withinLocalLimit: true,
            rssLimitBytesExclusive: taxonomy_projection_delivery_contract_1.TAXONOMY_PROJECTION_DELIVERY_RSS_LIMIT_BYTES,
        },
        checks: {
            contentAddressedDirectory: true,
            sourceBoundK35Required: true,
            sourceRootsExplicit: true,
            exactK35BytesOnly: true,
            twoConstructionByteIdentical: true,
            markerWrittenLast: true,
            noNetworkCodeInvoked: true,
        },
        readiness: {
            offlineLocalMaterialization: "GO",
            offlineSourceBoundValidation: "GO",
            network: "NO-GO",
            fetch: "NO-GO",
            wranglerOrS3: "NO-GO",
            publisher: "NO-GO",
            r2: "NO-GO",
            android: "NO-GO",
            consumer: "NO-GO",
            characterArray: "NO-GO",
            applyOrOverlay: "NO-GO",
            authority: "NO-GO",
            production: "NO-GO",
        },
        deliveryState: "STOPPED_LOCAL_ONLY",
    };
}
function buildMarker(receipt, receiptBytes) {
    const files = {};
    for (const entry of receipt.inventory.entries)
        files[entry.fileName] = { sha256: entry.sha256, sizeBytes: entry.sizeBytes };
    files[taxonomy_projection_delivery_contract_1.TAXONOMY_PROJECTION_DELIVERY_RECEIPT] = { sha256: hash(receiptBytes), sizeBytes: receiptBytes.length };
    const expectedNames = [...Object.keys(files), taxonomy_projection_delivery_contract_1.TAXONOMY_PROJECTION_DELIVERY_MARKER].sort();
    return {
        schemaVersion: taxonomy_projection_delivery_contract_1.TAXONOMY_PROJECTION_DELIVERY_SCHEMA_VERSION,
        contract: "dokkan-database-character-taxonomy-projection-delivery-ready-k36",
        contractVersion: taxonomy_projection_delivery_contract_1.TAXONOMY_PROJECTION_DELIVERY_CONTRACT_VERSION,
        releaseId: receipt.releaseId,
        receiptFile: taxonomy_projection_delivery_contract_1.TAXONOMY_PROJECTION_DELIVERY_RECEIPT,
        files,
        inventory: { closed: true, expectedNames, markerWrittenLast: true },
        budget: {
            maximumReleaseBytes: taxonomy_projection_delivery_contract_1.TAXONOMY_PROJECTION_DELIVERY_MAX_BYTES,
            accountedBytesBeforeMarker: receipt.budget.artifactBytes + receiptBytes.length,
            markerMaximumBytes: taxonomy_projection_delivery_contract_1.TAXONOMY_PROJECTION_DELIVERY_MAX_METADATA_BYTES,
        },
        readiness: receipt.readiness,
        deliveryState: "STOPPED_LOCAL_ONLY",
    };
}
function buildBundle(validated) {
    const files = artifactFiles(validated.artifacts);
    const receipt = buildReceipt(validated, files);
    const receiptBytes = jsonBytes(receipt);
    if (receiptBytes.length > taxonomy_projection_delivery_contract_1.TAXONOMY_PROJECTION_DELIVERY_MAX_METADATA_BYTES)
        throw new Error("K36 receipt byte budget exceeded");
    const marker = buildMarker(receipt, receiptBytes);
    const markerBytes = jsonBytes(marker);
    if (markerBytes.length > taxonomy_projection_delivery_contract_1.TAXONOMY_PROJECTION_DELIVERY_MAX_METADATA_BYTES)
        throw new Error("K36 marker byte budget exceeded");
    const total = receipt.budget.artifactBytes + receiptBytes.length + markerBytes.length;
    if (total >= taxonomy_projection_delivery_contract_1.TAXONOMY_PROJECTION_DELIVERY_MAX_BYTES)
        throw new Error("K36 release byte budget exceeded");
    return { releaseId: receipt.releaseId, receipt, receiptBytes, marker, markerBytes, artifactFiles: files };
}
function sameBundle(left, right) {
    return left.releaseId === right.releaseId && left.receiptBytes.equals(right.receiptBytes) && left.markerBytes.equals(right.markerBytes)
        && left.artifactFiles.length === right.artifactFiles.length
        && left.artifactFiles.every((file, index) => file.entry.fileName === right.artifactFiles[index].entry.fileName
            && file.bytes.equals(right.artifactFiles[index].bytes));
}
function safeMemberName(fileName) {
    return fileName === taxonomy_projection_contract_1.TAXONOMY_PROJECTION_FILES.coverage || fileName === taxonomy_projection_contract_1.TAXONOMY_PROJECTION_FILES.validation
        || fileName === taxonomy_projection_contract_1.TAXONOMY_PROJECTION_FILES.manifest || fileName === taxonomy_projection_delivery_contract_1.TAXONOMY_PROJECTION_DELIVERY_RECEIPT
        || fileName === taxonomy_projection_delivery_contract_1.TAXONOMY_PROJECTION_DELIVERY_MARKER || PAYLOAD_NAME.test(fileName);
}
async function writeExclusive(directory, fileName, bytes) {
    if (!safeMemberName(fileName))
        throw new Error("K36 release member name rejected");
    await checkpoint(directory, "release directory");
    const path = (0, path_1.join)(directory.path, fileName);
    assertContained(directory.path, path);
    const handle = await (0, promises_1.open)(path, fs_1.constants.O_CREAT | fs_1.constants.O_EXCL | fs_1.constants.O_WRONLY | (fs_1.constants.O_NOFOLLOW ?? 0), 0o600);
    try {
        await handle.writeFile(bytes);
        await handle.sync();
        const opened = await handle.stat();
        if (!opened.isFile() || opened.nlink !== 1 || opened.size !== bytes.length)
            throw new Error("K36 created member identity rejected");
        return { path, bytes, dev: opened.dev, ino: opened.ino };
    }
    finally {
        await handle.close();
    }
}
async function verifyOwnedFile(file) {
    const before = await (0, promises_1.lstat)(file.path);
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || before.dev !== file.dev || before.ino !== file.ino
        || before.size !== file.bytes.length || !samePath(await (0, promises_1.realpath)(file.path), file.path))
        throw new Error("K36 created member changed");
    const handle = await (0, promises_1.open)(file.path, fs_1.constants.O_RDONLY | (fs_1.constants.O_NOFOLLOW ?? 0));
    try {
        const opened = await handle.stat();
        const bytes = await handle.readFile();
        if (!sameFile(before, opened) || !bytes.equals(file.bytes))
            throw new Error("K36 created member bytes changed");
    }
    finally {
        await handle.close();
    }
}
async function safelyRemoveOwnedFile(file) {
    try {
        await verifyOwnedFile(file);
        const current = await (0, promises_1.lstat)(file.path);
        if (current.dev === file.dev && current.ino === file.ino && current.nlink === 1)
            await (0, promises_1.unlink)(file.path);
    }
    catch { /* Preserve anything whose ownership can no longer be proved. */ }
}
async function materializeBundle(outputRootValue, bundle) {
    const outputRoot = await inspectDirectory(outputRootValue, "output root");
    const namespacePath = (0, path_1.join)(outputRoot.path, taxonomy_projection_delivery_contract_1.TAXONOMY_PROJECTION_DELIVERY_NAMESPACE);
    assertContained(outputRoot.path, namespacePath);
    try {
        await (0, promises_1.mkdir)(namespacePath, { mode: 0o700 });
    }
    catch (error) {
        if (error?.code !== "EEXIST")
            throw error;
    }
    await checkpoint(outputRoot, "output root");
    const namespace = await inspectDirectory(namespacePath, "delivery namespace");
    const releasePath = (0, path_1.join)(namespace.path, bundle.releaseId);
    assertContained(namespace.path, releasePath);
    try {
        await (0, promises_1.mkdir)(releasePath, { mode: 0o700 });
    }
    catch (error) {
        if (error?.code === "EEXIST")
            throw new Error("K36 content-addressed release already exists");
        throw error;
    }
    const release = await inspectDirectory(releasePath, "release directory");
    const written = [];
    try {
        for (const file of bundle.artifactFiles) {
            written.push(await writeExclusive(release, file.entry.fileName, file.bytes));
            await verifyOwnedFile(written[written.length - 1]);
        }
        written.push(await writeExclusive(release, taxonomy_projection_delivery_contract_1.TAXONOMY_PROJECTION_DELIVERY_RECEIPT, bundle.receiptBytes));
        await verifyOwnedFile(written[written.length - 1]);
        await checkpoint(outputRoot, "output root");
        await checkpoint(namespace, "delivery namespace");
        await checkpoint(release, "release directory");
        written.push(await writeExclusive(release, taxonomy_projection_delivery_contract_1.TAXONOMY_PROJECTION_DELIVERY_MARKER, bundle.markerBytes));
        await verifyOwnedFile(written[written.length - 1]);
        await checkpoint(release, "release directory");
        return release.path;
    }
    catch (error) {
        for (const file of written.reverse())
            await safelyRemoveOwnedFile(file);
        await (0, promises_1.rmdir)(release.path).catch(() => undefined);
        throw error;
    }
}
async function readSnapshot(directory, fileName, maximumBytes) {
    if (!safeMemberName(fileName))
        throw new Error("K36 release member name rejected");
    const path = (0, path_1.join)(directory.path, fileName);
    assertContained(directory.path, path);
    const before = await (0, promises_1.lstat)(path);
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || before.size > maximumBytes) {
        throw new Error("K36 release member must be a bounded single-link regular file");
    }
    if (!samePath(await (0, promises_1.realpath)(path), path))
        throw new Error("K36 release member realpath rejected");
    const handle = await (0, promises_1.open)(path, fs_1.constants.O_RDONLY | (fs_1.constants.O_NOFOLLOW ?? 0));
    try {
        const opened = await handle.stat();
        if (!sameFile(before, opened) || opened.nlink !== 1)
            throw new Error("K36 release member identity changed while opening");
        const bytes = await handle.readFile();
        const after = await handle.stat();
        const pathAfter = await (0, promises_1.lstat)(path);
        if (!sameFile(opened, after) || !sameFile(opened, pathAfter) || after.nlink !== 1 || after.size !== bytes.length
            || after.mtimeMs !== opened.mtimeMs || after.ctimeMs !== opened.ctimeMs)
            throw new Error("K36 release member changed while reading");
        return { path, bytes, metadata: after };
    }
    finally {
        await handle.close();
    }
}
function parseJson(bytes, label) {
    try {
        return JSON.parse(bytes.toString("utf8"));
    }
    catch {
        throw new Error(`K36 ${label} JSON rejected`);
    }
}
function validateReceiptEnvelope(receipt, releaseId) {
    if (!receipt || receipt.schemaVersion !== taxonomy_projection_delivery_contract_1.TAXONOMY_PROJECTION_DELIVERY_SCHEMA_VERSION
        || receipt.contract !== "dokkan-database-character-taxonomy-projection-delivery-k36"
        || receipt.contractVersion !== taxonomy_projection_delivery_contract_1.TAXONOMY_PROJECTION_DELIVERY_CONTRACT_VERSION || receipt.releaseId !== releaseId
        || receipt.mode !== "explicit_opt_in_offline_local_only" || receipt.deliveryState !== "STOPPED_LOCAL_ONLY"
        || receipt.inventory?.closed !== true || receipt.inventory.artifactCount !== 4 || receipt.inventory.entries?.length !== 4
        || receipt.readiness?.network !== "NO-GO" || receipt.readiness.fetch !== "NO-GO"
        || receipt.readiness.wranglerOrS3 !== "NO-GO" || receipt.readiness.publisher !== "NO-GO"
        || receipt.readiness.r2 !== "NO-GO" || receipt.readiness.android !== "NO-GO"
        || receipt.readiness.consumer !== "NO-GO" || receipt.readiness.characterArray !== "NO-GO"
        || receipt.readiness.applyOrOverlay !== "NO-GO" || receipt.readiness.authority !== "NO-GO"
        || receipt.readiness.production !== "NO-GO")
        throw new Error("K36 stopped receipt envelope rejected");
    const expectedKinds = ["payload", "coverage", "validation", "manifest"];
    if (JSON.stringify(receipt.inventory.entries.map(entry => entry.kind)) !== JSON.stringify(expectedKinds)
        || !PAYLOAD_NAME.test(receipt.inventory.entries[0].fileName)
        || receipt.inventory.entries[1].fileName !== taxonomy_projection_contract_1.TAXONOMY_PROJECTION_FILES.coverage
        || receipt.inventory.entries[2].fileName !== taxonomy_projection_contract_1.TAXONOMY_PROJECTION_FILES.validation
        || receipt.inventory.entries[3].fileName !== taxonomy_projection_contract_1.TAXONOMY_PROJECTION_FILES.manifest
        || receipt.inventory.entries.some(entry => !/^[a-f0-9]{64}$/.test(entry.sha256)
            || !Number.isSafeInteger(entry.sizeBytes) || entry.sizeBytes <= 0))
        throw new Error("K36 stopped receipt inventory rejected");
}
async function assertClosedInventory(directory, expectedNames) {
    const actual = await (0, promises_1.readdir)(directory.path, { withFileTypes: true });
    if (actual.some(entry => !entry.isFile() || entry.isSymbolicLink())
        || JSON.stringify(actual.map(entry => entry.name).sort()) !== JSON.stringify([...expectedNames].sort())) {
        throw new Error("K36 closed release inventory rejected");
    }
}
function unchanged(before, after) {
    if (!samePath(before.path, after.path) || !sameFile(before.metadata, after.metadata) || !before.bytes.equals(after.bytes)) {
        throw new Error("K36 release member mutated during validation");
    }
}
function validateMarkerEnvelope(marker, receipt, receiptBytes, snapshots) {
    const expectedNames = [...receipt.inventory.entries.map(entry => entry.fileName), taxonomy_projection_delivery_contract_1.TAXONOMY_PROJECTION_DELIVERY_RECEIPT,
        taxonomy_projection_delivery_contract_1.TAXONOMY_PROJECTION_DELIVERY_MARKER].sort();
    if (!marker || marker.schemaVersion !== taxonomy_projection_delivery_contract_1.TAXONOMY_PROJECTION_DELIVERY_SCHEMA_VERSION
        || marker.contract !== "dokkan-database-character-taxonomy-projection-delivery-ready-k36"
        || marker.contractVersion !== taxonomy_projection_delivery_contract_1.TAXONOMY_PROJECTION_DELIVERY_CONTRACT_VERSION || marker.releaseId !== receipt.releaseId
        || marker.receiptFile !== taxonomy_projection_delivery_contract_1.TAXONOMY_PROJECTION_DELIVERY_RECEIPT || marker.inventory?.closed !== true
        || marker.inventory.markerWrittenLast !== true || JSON.stringify(marker.inventory.expectedNames) !== JSON.stringify(expectedNames)
        || marker.deliveryState !== "STOPPED_LOCAL_ONLY" || JSON.stringify(marker.readiness) !== JSON.stringify(receipt.readiness)) {
        throw new Error("K36 release marker envelope rejected");
    }
    const expectedFiles = [...receipt.inventory.entries, {
            kind: "receipt", fileName: taxonomy_projection_delivery_contract_1.TAXONOMY_PROJECTION_DELIVERY_RECEIPT, sha256: hash(receiptBytes), sizeBytes: receiptBytes.length,
        }];
    if (JSON.stringify(Object.keys(marker.files)) !== JSON.stringify(expectedFiles.map(entry => entry.fileName))) {
        throw new Error("K36 release marker file inventory rejected");
    }
    for (const entry of expectedFiles) {
        const snapshot = snapshots.get(entry.fileName);
        const marked = marker.files[entry.fileName];
        if (!snapshot || !marked || marked.sha256 !== entry.sha256 || marked.sizeBytes !== entry.sizeBytes
            || hash(snapshot.bytes) !== entry.sha256 || snapshot.bytes.length !== entry.sizeBytes) {
            throw new Error("K36 release marker byte identity rejected");
        }
    }
    const markerBytes = snapshots.get(taxonomy_projection_delivery_contract_1.TAXONOMY_PROJECTION_DELIVERY_MARKER).bytes;
    const total = expectedFiles.reduce((sum, entry) => sum + entry.sizeBytes, 0) + markerBytes.length;
    if (marker.budget?.maximumReleaseBytes !== taxonomy_projection_delivery_contract_1.TAXONOMY_PROJECTION_DELIVERY_MAX_BYTES
        || marker.budget.accountedBytesBeforeMarker !== total - markerBytes.length
        || marker.budget.markerMaximumBytes !== taxonomy_projection_delivery_contract_1.TAXONOMY_PROJECTION_DELIVERY_MAX_METADATA_BYTES
        || markerBytes.length > marker.budget.markerMaximumBytes || total >= marker.budget.maximumReleaseBytes) {
        throw new Error("K36 release marker budget rejected");
    }
}
function sourceOptions(options, artifactRoot) {
    if (!options?.k32Root || !options.k2Root || !options.productiveRoot || !options.sqliteRoot || !options.db1Root
        || !options.elfRoot || !options.nativeEvidenceRoot)
        throw new Error("K36 requires explicit K32, K2, productive, SQLite, DB1, ELF and native-evidence roots");
    return { artifactRoot, ...options };
}
async function readValidatedTaxonomyProjectionDelivery(options) {
    const rss = new RssGuard();
    try {
        if (!options?.outputRoot || !options.releaseId || !RELEASE_ID.test(options.releaseId) || (0, path_1.isAbsolute)(options.releaseId)) {
            throw new Error("K36 requires a canonical content-addressed release ID and explicit output root");
        }
        const roots = sourceOptions(options, "unused");
        const outputRoot = await inspectDirectory(options.outputRoot, "output root");
        const namespacePath = (0, path_1.join)(outputRoot.path, taxonomy_projection_delivery_contract_1.TAXONOMY_PROJECTION_DELIVERY_NAMESPACE);
        assertContained(outputRoot.path, namespacePath);
        const namespace = await inspectDirectory(namespacePath, "delivery namespace");
        const releasePath = (0, path_1.join)(namespace.path, options.releaseId);
        assertContained(namespace.path, releasePath);
        const release = await inspectDirectory(releasePath, "release directory");
        await checkpoint(outputRoot, "output root");
        await checkpoint(namespace, "delivery namespace");
        const markerSnapshot = await readSnapshot(release, taxonomy_projection_delivery_contract_1.TAXONOMY_PROJECTION_DELIVERY_MARKER, taxonomy_projection_delivery_contract_1.TAXONOMY_PROJECTION_DELIVERY_MAX_METADATA_BYTES);
        const receiptSnapshot = await readSnapshot(release, taxonomy_projection_delivery_contract_1.TAXONOMY_PROJECTION_DELIVERY_RECEIPT, taxonomy_projection_delivery_contract_1.TAXONOMY_PROJECTION_DELIVERY_MAX_METADATA_BYTES);
        const receipt = parseJson(receiptSnapshot.bytes, "receipt");
        validateReceiptEnvelope(receipt, options.releaseId);
        const expectedNames = [...receipt.inventory.entries.map(entry => entry.fileName), taxonomy_projection_delivery_contract_1.TAXONOMY_PROJECTION_DELIVERY_RECEIPT,
            taxonomy_projection_delivery_contract_1.TAXONOMY_PROJECTION_DELIVERY_MARKER];
        await assertClosedInventory(release, expectedNames);
        const artifactSnapshots = await Promise.all(receipt.inventory.entries.map(entry => readSnapshot(release, entry.fileName, taxonomy_projection_delivery_contract_1.TAXONOMY_PROJECTION_DELIVERY_MAX_BYTES)));
        const snapshots = new Map([
            [taxonomy_projection_delivery_contract_1.TAXONOMY_PROJECTION_DELIVERY_MARKER, markerSnapshot],
            [taxonomy_projection_delivery_contract_1.TAXONOMY_PROJECTION_DELIVERY_RECEIPT, receiptSnapshot],
            ...artifactSnapshots.map(snapshot => [snapshot.path.substring(snapshot.path.lastIndexOf(path_1.sep) + 1), snapshot]),
        ]);
        const marker = parseJson(markerSnapshot.bytes, "marker");
        validateMarkerEnvelope(marker, receipt, receiptSnapshot.bytes, snapshots);
        rss.sample();
        const validated = await (0, taxonomy_projection_validator_1.validateTaxonomyProjectionArtifact)({ ...roots, artifactRoot: release.path });
        rss.sample(validated.peakNestedRssBytes);
        const expected = buildBundle(validated);
        if (expected.releaseId !== options.releaseId || !expected.receiptBytes.equals(receiptSnapshot.bytes)
            || !expected.markerBytes.equals(markerSnapshot.bytes))
            throw new Error("K36 source-bound lineage or delivery metadata mismatch");
        for (const file of expected.artifactFiles) {
            const snapshot = snapshots.get(file.entry.fileName);
            if (!snapshot?.bytes.equals(file.bytes))
                throw new Error("K36 source-bound K35 bytes mismatch");
        }
        await assertClosedInventory(release, expectedNames);
        const after = await Promise.all(expectedNames.map(fileName => readSnapshot(release, fileName, fileName === taxonomy_projection_delivery_contract_1.TAXONOMY_PROJECTION_DELIVERY_MARKER || fileName === taxonomy_projection_delivery_contract_1.TAXONOMY_PROJECTION_DELIVERY_RECEIPT
            ? taxonomy_projection_delivery_contract_1.TAXONOMY_PROJECTION_DELIVERY_MAX_METADATA_BYTES : taxonomy_projection_delivery_contract_1.TAXONOMY_PROJECTION_DELIVERY_MAX_BYTES)));
        expectedNames.forEach((fileName, index) => unchanged(snapshots.get(fileName), after[index]));
        await checkpoint(outputRoot, "output root");
        await checkpoint(namespace, "delivery namespace");
        await checkpoint(release, "release directory");
        const peakRssBytes = rss.stop();
        return {
            releaseDirectory: release.path,
            releaseId: options.releaseId,
            receipt,
            marker,
            sourceBoundK35Validation: validated.sourceBoundValidation.status,
            peakRssBytes,
        };
    }
    catch (error) {
        throw new Error(`K36 delivery validation failed: ${boundedMessage(error)}`);
    }
    finally {
        rss.dispose();
    }
}
exports.readValidatedTaxonomyProjectionDelivery = readValidatedTaxonomyProjectionDelivery;
async function runTaxonomyProjectionDelivery(options) {
    const rss = new RssGuard();
    try {
        if (options?.optIn !== true)
            throw new Error("K36 requires explicit opt-in");
        if (!options.outputRoot || !options.k35Root)
            throw new Error("K36 requires explicit K35 and output roots");
        const roots = sourceOptions(options, options.k35Root);
        await validateTaxonomyProjectionDeliveryOutputRoot(options.outputRoot);
        const validated = await (0, taxonomy_projection_validator_1.validateTaxonomyProjectionArtifact)(roots);
        rss.sample(validated.peakNestedRssBytes);
        const first = buildBundle(validated);
        const second = buildBundle(validated);
        if (!sameBundle(first, second))
            throw new Error("K36 two-construction byte identity failed");
        await materializeBundle(options.outputRoot, second);
        rss.sample();
        const reopened = await readValidatedTaxonomyProjectionDelivery({
            outputRoot: options.outputRoot,
            releaseId: second.releaseId,
            k32Root: options.k32Root,
            k2Root: options.k2Root,
            productiveRoot: options.productiveRoot,
            sqliteRoot: options.sqliteRoot,
            db1Root: options.db1Root,
            elfRoot: options.elfRoot,
            nativeEvidenceRoot: options.nativeEvidenceRoot,
        });
        rss.sample(reopened.peakRssBytes);
        const peakRssBytes = rss.stop();
        return { ...reopened, peakRssBytes, twoConstructionByteIdentical: true };
    }
    catch (error) {
        throw new Error(`K36 delivery failed: ${boundedMessage(error)}`);
    }
    finally {
        rss.dispose();
    }
}
exports.runTaxonomyProjectionDelivery = runTaxonomyProjectionDelivery;
//# sourceMappingURL=taxonomy-projection-delivery.js.map