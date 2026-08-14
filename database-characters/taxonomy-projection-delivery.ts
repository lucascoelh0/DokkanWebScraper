import { createHash } from "crypto";
import { constants, Stats } from "fs";
import { lstat, mkdir, open, readdir, realpath, rmdir, unlink } from "fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "path";
import {
    TAXONOMY_PROJECTION_FILES,
    TaxonomyProjectionManifest,
} from "./taxonomy-projection-contract";
import {
    TaxonomyProjectionArtifactSet,
    TaxonomyProjectionSourceBoundValidationOptions,
    validateTaxonomyProjectionArtifact,
} from "./taxonomy-projection-validator";
import {
    TAXONOMY_PROJECTION_DELIVERY_CONTRACT_VERSION,
    TAXONOMY_PROJECTION_DELIVERY_MARKER,
    TAXONOMY_PROJECTION_DELIVERY_MAX_BYTES,
    TAXONOMY_PROJECTION_DELIVERY_MAX_ERROR_LENGTH,
    TAXONOMY_PROJECTION_DELIVERY_MAX_METADATA_BYTES,
    TAXONOMY_PROJECTION_DELIVERY_NAMESPACE,
    TAXONOMY_PROJECTION_DELIVERY_RECEIPT,
    TAXONOMY_PROJECTION_DELIVERY_RSS_LIMIT_BYTES,
    TAXONOMY_PROJECTION_DELIVERY_SCHEMA_VERSION,
    TaxonomyProjectionDeliveryInventoryEntry,
    TaxonomyProjectionDeliveryMarker,
    TaxonomyProjectionDeliveryReceipt,
} from "./taxonomy-projection-delivery-contract";

export interface TaxonomyProjectionDeliverySourceRoots extends Omit<TaxonomyProjectionSourceBoundValidationOptions, "artifactRoot"> {}

export interface TaxonomyProjectionDeliveryRunOptions extends TaxonomyProjectionDeliverySourceRoots {
    optIn: true;
    k35Root: string;
    outputRoot: string;
}

export interface TaxonomyProjectionDeliveryReadOptions extends TaxonomyProjectionDeliverySourceRoots {
    outputRoot: string;
    releaseId: string;
}

export interface ValidatedTaxonomyProjectionDelivery {
    releaseDirectory: string;
    releaseId: string;
    receipt: TaxonomyProjectionDeliveryReceipt;
    marker: TaxonomyProjectionDeliveryMarker;
    sourceBoundK35Validation: "GO";
    peakRssBytes: number;
}

export interface TaxonomyProjectionDeliveryRunResult extends ValidatedTaxonomyProjectionDelivery {
    twoConstructionByteIdentical: true;
}

interface DirectoryIdentity { path: string; realPath: string; dev: number; ino: number }
interface FileSnapshot { path: string; bytes: Buffer; metadata: Stats }
interface OwnedFile { path: string; bytes: Buffer; dev: number; ino: number }
interface ValidatedK35 {
    artifacts: TaxonomyProjectionArtifactSet;
    sourceBoundValidation: {
        status: "GO";
        k32Revalidated: true;
        k34RevalidatedInProcess: true;
        exactArtifactBytesMatched: true;
    };
    peakNestedRssBytes: number;
}
interface DeliveryBundle {
    releaseId: string;
    receipt: TaxonomyProjectionDeliveryReceipt;
    receiptBytes: Buffer;
    marker: TaxonomyProjectionDeliveryMarker;
    markerBytes: Buffer;
    artifactFiles: Array<{ entry: TaxonomyProjectionDeliveryInventoryEntry; bytes: Buffer }>;
}

const RELEASE_ID = /^[a-f0-9]{64}$/;
const PAYLOAD_NAME = /^database-characters-k35-taxonomy-projection\.[a-f0-9]{64}\.json\.gz$/;
const hash = (bytes: Buffer | string): string => createHash("sha256").update(bytes).digest("hex");
const jsonBytes = (value: unknown): Buffer => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
const samePath = (left: string, right: string): boolean => process.platform === "win32"
    ? resolve(left).toLowerCase() === resolve(right).toLowerCase()
    : resolve(left) === resolve(right);
const sameFile = (left: Stats, right: Stats): boolean => left.dev === right.dev && left.ino === right.ino;

class RssGuard {
    private peak = Math.max(process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024);
    private exceeded = false;
    private readonly timer = setInterval(() => this.observe(), 10);
    constructor() { this.timer.unref(); }
    private observe(): void {
        // maxRSS is the OS-recorded high-water mark in KiB and still captures
        // peaks while synchronous validation blocks the JavaScript event loop.
        this.peak = Math.max(this.peak, process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024);
        this.exceeded ||= this.peak >= TAXONOMY_PROJECTION_DELIVERY_RSS_LIMIT_BYTES;
    }
    sample(nestedPeak = 0): void {
        this.observe();
        this.peak = Math.max(this.peak, nestedPeak);
        this.exceeded ||= this.peak >= TAXONOMY_PROJECTION_DELIVERY_RSS_LIMIT_BYTES;
        if (this.exceeded) throw new Error(`K36 RSS limit reached: ${this.peak}`);
    }
    stop(): number { clearInterval(this.timer); this.sample(); return this.peak; }
    dispose(): void { clearInterval(this.timer); }
}

function boundedMessage(error: unknown): string {
    const value = error instanceof Error ? error.message : String(error);
    return value.slice(0, TAXONOMY_PROJECTION_DELIVERY_MAX_ERROR_LENGTH);
}

function assertContained(root: string, path: string): void {
    const remainder = relative(root, path);
    if (remainder === "" || remainder === ".." || remainder.startsWith(`..${sep}`) || isAbsolute(remainder)) {
        if (remainder !== "") throw new Error("K36 path escaped the controlled root");
    }
}

async function inspectDirectory(value: string, label: string): Promise<DirectoryIdentity> {
    const path = resolve(value);
    const metadata = await lstat(path);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) throw new Error(`K36 ${label} must be an existing regular non-link directory`);
    const canonical = await realpath(path);
    if (!samePath(path, canonical)) throw new Error(`K36 ${label} symlink or junction rejected`);
    return { path, realPath: canonical, dev: metadata.dev, ino: metadata.ino };
}

async function checkpoint(expected: DirectoryIdentity, label: string): Promise<void> {
    const actual = await inspectDirectory(expected.path, label);
    if (!samePath(actual.realPath, expected.realPath) || actual.dev !== expected.dev || actual.ino !== expected.ino) {
        throw new Error(`K36 ${label} identity changed`);
    }
}

export async function validateTaxonomyProjectionDeliveryOutputRoot(value: string): Promise<void> {
    if (!value) throw new Error("K36 output root is required");
    const root = await inspectDirectory(value, "output root");
    await checkpoint(root, "output root");
}

function artifactFiles(artifacts: TaxonomyProjectionArtifactSet): Array<{ entry: TaxonomyProjectionDeliveryInventoryEntry; bytes: Buffer }> {
    const manifest = artifacts.manifest;
    if (!PAYLOAD_NAME.test(manifest.fileName) || manifest.fileName !== `database-characters-k35-taxonomy-projection.${manifest.sha256}.json.gz`) {
        throw new Error("K36 K35 payload name rejected");
    }
    const files: Array<{ entry: TaxonomyProjectionDeliveryInventoryEntry; bytes: Buffer }> = [
        { entry: { kind: "payload", fileName: manifest.fileName, sha256: hash(artifacts.gzip), sizeBytes: artifacts.gzip.length }, bytes: artifacts.gzip },
        { entry: { kind: "coverage", fileName: TAXONOMY_PROJECTION_FILES.coverage, sha256: hash(artifacts.coverageBytes), sizeBytes: artifacts.coverageBytes.length }, bytes: artifacts.coverageBytes },
        { entry: { kind: "validation", fileName: TAXONOMY_PROJECTION_FILES.validation, sha256: hash(artifacts.validationBytes), sizeBytes: artifacts.validationBytes.length }, bytes: artifacts.validationBytes },
        { entry: { kind: "manifest", fileName: TAXONOMY_PROJECTION_FILES.manifest, sha256: hash(artifacts.manifestBytes), sizeBytes: artifacts.manifestBytes.length }, bytes: artifacts.manifestBytes },
    ];
    if (new Set(files.map(file => file.entry.fileName)).size !== 4) throw new Error("K36 K35 inventory names collided");
    if (manifest.sha256 !== files[0].entry.sha256 || manifest.sizeBytes !== files[0].entry.sizeBytes
        || manifest.coverageSha256 !== files[1].entry.sha256 || manifest.coverageSizeBytes !== files[1].entry.sizeBytes
        || manifest.validationSha256 !== files[2].entry.sha256 || manifest.validationSizeBytes !== files[2].entry.sizeBytes) {
        throw new Error("K36 K35 manifest inventory rejected");
    }
    return files;
}

function releaseIdentity(manifest: TaxonomyProjectionManifest, entries: TaxonomyProjectionDeliveryInventoryEntry[]): string {
    return hash(jsonBytes({
        schemaVersion: TAXONOMY_PROJECTION_DELIVERY_SCHEMA_VERSION,
        contract: "dokkan-database-character-taxonomy-projection-delivery-identity-k36",
        contractVersion: TAXONOMY_PROJECTION_DELIVERY_CONTRACT_VERSION,
        datasetVersion: manifest.datasetVersion,
        generatedAt: manifest.generatedAt,
        lineage: manifest.source,
        inventory: entries,
    }));
}

function buildReceipt(validated: ValidatedK35, files: Array<{ entry: TaxonomyProjectionDeliveryInventoryEntry; bytes: Buffer }>): TaxonomyProjectionDeliveryReceipt {
    const artifacts = validated.artifacts;
    const manifest = artifacts.manifest;
    const entries = files.map(file => file.entry);
    const artifactBytes = entries.reduce((total, entry) => total + entry.sizeBytes, 0);
    if (artifactBytes >= TAXONOMY_PROJECTION_DELIVERY_MAX_BYTES) throw new Error("K36 local artifact budget exceeded");
    return {
        schemaVersion: TAXONOMY_PROJECTION_DELIVERY_SCHEMA_VERSION,
        contract: "dokkan-database-character-taxonomy-projection-delivery-k36",
        contractVersion: TAXONOMY_PROJECTION_DELIVERY_CONTRACT_VERSION,
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
            maximumReleaseBytes: TAXONOMY_PROJECTION_DELIVERY_MAX_BYTES,
            maximumMetadataFileBytes: TAXONOMY_PROJECTION_DELIVERY_MAX_METADATA_BYTES,
            artifactBytes,
            withinLocalLimit: true,
            rssLimitBytesExclusive: TAXONOMY_PROJECTION_DELIVERY_RSS_LIMIT_BYTES,
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

function buildMarker(receipt: TaxonomyProjectionDeliveryReceipt, receiptBytes: Buffer): TaxonomyProjectionDeliveryMarker {
    const files: Record<string, { sha256: string; sizeBytes: number }> = {};
    for (const entry of receipt.inventory.entries) files[entry.fileName] = { sha256: entry.sha256, sizeBytes: entry.sizeBytes };
    files[TAXONOMY_PROJECTION_DELIVERY_RECEIPT] = { sha256: hash(receiptBytes), sizeBytes: receiptBytes.length };
    const expectedNames = [...Object.keys(files), TAXONOMY_PROJECTION_DELIVERY_MARKER].sort();
    return {
        schemaVersion: TAXONOMY_PROJECTION_DELIVERY_SCHEMA_VERSION,
        contract: "dokkan-database-character-taxonomy-projection-delivery-ready-k36",
        contractVersion: TAXONOMY_PROJECTION_DELIVERY_CONTRACT_VERSION,
        releaseId: receipt.releaseId,
        receiptFile: TAXONOMY_PROJECTION_DELIVERY_RECEIPT,
        files,
        inventory: { closed: true, expectedNames, markerWrittenLast: true },
        budget: {
            maximumReleaseBytes: TAXONOMY_PROJECTION_DELIVERY_MAX_BYTES,
            accountedBytesBeforeMarker: receipt.budget.artifactBytes + receiptBytes.length,
            markerMaximumBytes: TAXONOMY_PROJECTION_DELIVERY_MAX_METADATA_BYTES,
        },
        readiness: receipt.readiness,
        deliveryState: "STOPPED_LOCAL_ONLY",
    };
}

function buildBundle(validated: ValidatedK35): DeliveryBundle {
    const files = artifactFiles(validated.artifacts);
    const receipt = buildReceipt(validated, files);
    const receiptBytes = jsonBytes(receipt);
    if (receiptBytes.length > TAXONOMY_PROJECTION_DELIVERY_MAX_METADATA_BYTES) throw new Error("K36 receipt byte budget exceeded");
    const marker = buildMarker(receipt, receiptBytes);
    const markerBytes = jsonBytes(marker);
    if (markerBytes.length > TAXONOMY_PROJECTION_DELIVERY_MAX_METADATA_BYTES) throw new Error("K36 marker byte budget exceeded");
    const total = receipt.budget.artifactBytes + receiptBytes.length + markerBytes.length;
    if (total >= TAXONOMY_PROJECTION_DELIVERY_MAX_BYTES) throw new Error("K36 release byte budget exceeded");
    return { releaseId: receipt.releaseId, receipt, receiptBytes, marker, markerBytes, artifactFiles: files };
}

function sameBundle(left: DeliveryBundle, right: DeliveryBundle): boolean {
    return left.releaseId === right.releaseId && left.receiptBytes.equals(right.receiptBytes) && left.markerBytes.equals(right.markerBytes)
        && left.artifactFiles.length === right.artifactFiles.length
        && left.artifactFiles.every((file, index) => file.entry.fileName === right.artifactFiles[index].entry.fileName
            && file.bytes.equals(right.artifactFiles[index].bytes));
}

function safeMemberName(fileName: string): boolean {
    return fileName === TAXONOMY_PROJECTION_FILES.coverage || fileName === TAXONOMY_PROJECTION_FILES.validation
        || fileName === TAXONOMY_PROJECTION_FILES.manifest || fileName === TAXONOMY_PROJECTION_DELIVERY_RECEIPT
        || fileName === TAXONOMY_PROJECTION_DELIVERY_MARKER || PAYLOAD_NAME.test(fileName);
}

async function writeExclusive(directory: DirectoryIdentity, fileName: string, bytes: Buffer): Promise<OwnedFile> {
    if (!safeMemberName(fileName)) throw new Error("K36 release member name rejected");
    await checkpoint(directory, "release directory");
    const path = join(directory.path, fileName);
    assertContained(directory.path, path);
    const handle = await open(path, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | (constants.O_NOFOLLOW ?? 0), 0o600);
    try {
        await handle.writeFile(bytes);
        await handle.sync();
        const opened = await handle.stat();
        if (!opened.isFile() || opened.nlink !== 1 || opened.size !== bytes.length) throw new Error("K36 created member identity rejected");
        return { path, bytes, dev: opened.dev, ino: opened.ino };
    } finally { await handle.close(); }
}

async function verifyOwnedFile(file: OwnedFile): Promise<void> {
    const before = await lstat(file.path);
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || before.dev !== file.dev || before.ino !== file.ino
        || before.size !== file.bytes.length || !samePath(await realpath(file.path), file.path)) throw new Error("K36 created member changed");
    const handle = await open(file.path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try {
        const opened = await handle.stat();
        const bytes = await handle.readFile();
        if (!sameFile(before, opened) || !bytes.equals(file.bytes)) throw new Error("K36 created member bytes changed");
    } finally { await handle.close(); }
}

async function safelyRemoveOwnedFile(file: OwnedFile): Promise<void> {
    try {
        await verifyOwnedFile(file);
        const current = await lstat(file.path);
        if (current.dev === file.dev && current.ino === file.ino && current.nlink === 1) await unlink(file.path);
    } catch { /* Preserve anything whose ownership can no longer be proved. */ }
}

async function materializeBundle(outputRootValue: string, bundle: DeliveryBundle): Promise<string> {
    const outputRoot = await inspectDirectory(outputRootValue, "output root");
    const namespacePath = join(outputRoot.path, TAXONOMY_PROJECTION_DELIVERY_NAMESPACE);
    assertContained(outputRoot.path, namespacePath);
    try { await mkdir(namespacePath, { mode: 0o700 }); }
    catch (error: any) { if (error?.code !== "EEXIST") throw error; }
    await checkpoint(outputRoot, "output root");
    const namespace = await inspectDirectory(namespacePath, "delivery namespace");
    const releasePath = join(namespace.path, bundle.releaseId);
    assertContained(namespace.path, releasePath);
    try { await mkdir(releasePath, { mode: 0o700 }); }
    catch (error: any) {
        if (error?.code === "EEXIST") throw new Error("K36 content-addressed release already exists");
        throw error;
    }
    const release = await inspectDirectory(releasePath, "release directory");
    const written: OwnedFile[] = [];
    try {
        for (const file of bundle.artifactFiles) {
            written.push(await writeExclusive(release, file.entry.fileName, file.bytes));
            await verifyOwnedFile(written[written.length - 1]);
        }
        written.push(await writeExclusive(release, TAXONOMY_PROJECTION_DELIVERY_RECEIPT, bundle.receiptBytes));
        await verifyOwnedFile(written[written.length - 1]);
        await checkpoint(outputRoot, "output root");
        await checkpoint(namespace, "delivery namespace");
        await checkpoint(release, "release directory");
        written.push(await writeExclusive(release, TAXONOMY_PROJECTION_DELIVERY_MARKER, bundle.markerBytes));
        await verifyOwnedFile(written[written.length - 1]);
        await checkpoint(release, "release directory");
        return release.path;
    } catch (error) {
        for (const file of written.reverse()) await safelyRemoveOwnedFile(file);
        await rmdir(release.path).catch(() => undefined);
        throw error;
    }
}

async function readSnapshot(directory: DirectoryIdentity, fileName: string, maximumBytes: number): Promise<FileSnapshot> {
    if (!safeMemberName(fileName)) throw new Error("K36 release member name rejected");
    const path = join(directory.path, fileName);
    assertContained(directory.path, path);
    const before = await lstat(path);
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || before.size > maximumBytes) {
        throw new Error("K36 release member must be a bounded single-link regular file");
    }
    if (!samePath(await realpath(path), path)) throw new Error("K36 release member realpath rejected");
    const handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try {
        const opened = await handle.stat();
        if (!sameFile(before, opened) || opened.nlink !== 1) throw new Error("K36 release member identity changed while opening");
        const bytes = await handle.readFile();
        const after = await handle.stat();
        const pathAfter = await lstat(path);
        if (!sameFile(opened, after) || !sameFile(opened, pathAfter) || after.nlink !== 1 || after.size !== bytes.length
            || after.mtimeMs !== opened.mtimeMs || after.ctimeMs !== opened.ctimeMs) throw new Error("K36 release member changed while reading");
        return { path, bytes, metadata: after };
    } finally { await handle.close(); }
}

function parseJson<T>(bytes: Buffer, label: string): T {
    try { return JSON.parse(bytes.toString("utf8")) as T; }
    catch { throw new Error(`K36 ${label} JSON rejected`); }
}

function validateReceiptEnvelope(receipt: TaxonomyProjectionDeliveryReceipt, releaseId: string): void {
    if (!receipt || receipt.schemaVersion !== TAXONOMY_PROJECTION_DELIVERY_SCHEMA_VERSION
        || receipt.contract !== "dokkan-database-character-taxonomy-projection-delivery-k36"
        || receipt.contractVersion !== TAXONOMY_PROJECTION_DELIVERY_CONTRACT_VERSION || receipt.releaseId !== releaseId
        || receipt.mode !== "explicit_opt_in_offline_local_only" || receipt.deliveryState !== "STOPPED_LOCAL_ONLY"
        || receipt.inventory?.closed !== true || receipt.inventory.artifactCount !== 4 || receipt.inventory.entries?.length !== 4
        || receipt.readiness?.network !== "NO-GO" || receipt.readiness.fetch !== "NO-GO"
        || receipt.readiness.wranglerOrS3 !== "NO-GO" || receipt.readiness.publisher !== "NO-GO"
        || receipt.readiness.r2 !== "NO-GO" || receipt.readiness.android !== "NO-GO"
        || receipt.readiness.consumer !== "NO-GO" || receipt.readiness.characterArray !== "NO-GO"
        || receipt.readiness.applyOrOverlay !== "NO-GO" || receipt.readiness.authority !== "NO-GO"
        || receipt.readiness.production !== "NO-GO") throw new Error("K36 stopped receipt envelope rejected");
    const expectedKinds = ["payload", "coverage", "validation", "manifest"];
    if (JSON.stringify(receipt.inventory.entries.map(entry => entry.kind)) !== JSON.stringify(expectedKinds)
        || !PAYLOAD_NAME.test(receipt.inventory.entries[0].fileName)
        || receipt.inventory.entries[1].fileName !== TAXONOMY_PROJECTION_FILES.coverage
        || receipt.inventory.entries[2].fileName !== TAXONOMY_PROJECTION_FILES.validation
        || receipt.inventory.entries[3].fileName !== TAXONOMY_PROJECTION_FILES.manifest
        || receipt.inventory.entries.some(entry => !/^[a-f0-9]{64}$/.test(entry.sha256)
            || !Number.isSafeInteger(entry.sizeBytes) || entry.sizeBytes <= 0)) throw new Error("K36 stopped receipt inventory rejected");
}

async function assertClosedInventory(directory: DirectoryIdentity, expectedNames: string[]): Promise<void> {
    const actual = await readdir(directory.path, { withFileTypes: true });
    if (actual.some(entry => !entry.isFile() || entry.isSymbolicLink())
        || JSON.stringify(actual.map(entry => entry.name).sort()) !== JSON.stringify([...expectedNames].sort())) {
        throw new Error("K36 closed release inventory rejected");
    }
}

function unchanged(before: FileSnapshot, after: FileSnapshot): void {
    if (!samePath(before.path, after.path) || !sameFile(before.metadata, after.metadata) || !before.bytes.equals(after.bytes)) {
        throw new Error("K36 release member mutated during validation");
    }
}

function validateMarkerEnvelope(marker: TaxonomyProjectionDeliveryMarker, receipt: TaxonomyProjectionDeliveryReceipt,
    receiptBytes: Buffer, snapshots: Map<string, FileSnapshot>): void {
    const expectedNames = [...receipt.inventory.entries.map(entry => entry.fileName), TAXONOMY_PROJECTION_DELIVERY_RECEIPT,
        TAXONOMY_PROJECTION_DELIVERY_MARKER].sort();
    if (!marker || marker.schemaVersion !== TAXONOMY_PROJECTION_DELIVERY_SCHEMA_VERSION
        || marker.contract !== "dokkan-database-character-taxonomy-projection-delivery-ready-k36"
        || marker.contractVersion !== TAXONOMY_PROJECTION_DELIVERY_CONTRACT_VERSION || marker.releaseId !== receipt.releaseId
        || marker.receiptFile !== TAXONOMY_PROJECTION_DELIVERY_RECEIPT || marker.inventory?.closed !== true
        || marker.inventory.markerWrittenLast !== true || JSON.stringify(marker.inventory.expectedNames) !== JSON.stringify(expectedNames)
        || marker.deliveryState !== "STOPPED_LOCAL_ONLY" || JSON.stringify(marker.readiness) !== JSON.stringify(receipt.readiness)) {
        throw new Error("K36 release marker envelope rejected");
    }
    const expectedFiles = [...receipt.inventory.entries, {
        kind: "receipt" as any, fileName: TAXONOMY_PROJECTION_DELIVERY_RECEIPT, sha256: hash(receiptBytes), sizeBytes: receiptBytes.length,
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
    const markerBytes = snapshots.get(TAXONOMY_PROJECTION_DELIVERY_MARKER)!.bytes;
    const total = expectedFiles.reduce((sum, entry) => sum + entry.sizeBytes, 0) + markerBytes.length;
    if (marker.budget?.maximumReleaseBytes !== TAXONOMY_PROJECTION_DELIVERY_MAX_BYTES
        || marker.budget.accountedBytesBeforeMarker !== total - markerBytes.length
        || marker.budget.markerMaximumBytes !== TAXONOMY_PROJECTION_DELIVERY_MAX_METADATA_BYTES
        || markerBytes.length > marker.budget.markerMaximumBytes || total >= marker.budget.maximumReleaseBytes) {
        throw new Error("K36 release marker budget rejected");
    }
}

function sourceOptions(options: TaxonomyProjectionDeliverySourceRoots, artifactRoot: string): TaxonomyProjectionSourceBoundValidationOptions {
    if (!options?.k32Root || !options.k2Root || !options.productiveRoot || !options.sqliteRoot || !options.db1Root
        || !options.elfRoot || !options.nativeEvidenceRoot) throw new Error("K36 requires explicit K32, K2, productive, SQLite, DB1, ELF and native-evidence roots");
    return { artifactRoot, ...options };
}

export async function readValidatedTaxonomyProjectionDelivery(
    options: TaxonomyProjectionDeliveryReadOptions,
): Promise<ValidatedTaxonomyProjectionDelivery> {
    const rss = new RssGuard();
    try {
        if (!options?.outputRoot || !options.releaseId || !RELEASE_ID.test(options.releaseId) || isAbsolute(options.releaseId)) {
            throw new Error("K36 requires a canonical content-addressed release ID and explicit output root");
        }
        const roots = sourceOptions(options, "unused");
        const outputRoot = await inspectDirectory(options.outputRoot, "output root");
        const namespacePath = join(outputRoot.path, TAXONOMY_PROJECTION_DELIVERY_NAMESPACE);
        assertContained(outputRoot.path, namespacePath);
        const namespace = await inspectDirectory(namespacePath, "delivery namespace");
        const releasePath = join(namespace.path, options.releaseId);
        assertContained(namespace.path, releasePath);
        const release = await inspectDirectory(releasePath, "release directory");
        await checkpoint(outputRoot, "output root");
        await checkpoint(namespace, "delivery namespace");

        const markerSnapshot = await readSnapshot(release, TAXONOMY_PROJECTION_DELIVERY_MARKER, TAXONOMY_PROJECTION_DELIVERY_MAX_METADATA_BYTES);
        const receiptSnapshot = await readSnapshot(release, TAXONOMY_PROJECTION_DELIVERY_RECEIPT, TAXONOMY_PROJECTION_DELIVERY_MAX_METADATA_BYTES);
        const receipt = parseJson<TaxonomyProjectionDeliveryReceipt>(receiptSnapshot.bytes, "receipt");
        validateReceiptEnvelope(receipt, options.releaseId);
        const expectedNames = [...receipt.inventory.entries.map(entry => entry.fileName), TAXONOMY_PROJECTION_DELIVERY_RECEIPT,
            TAXONOMY_PROJECTION_DELIVERY_MARKER];
        await assertClosedInventory(release, expectedNames);
        const artifactSnapshots = await Promise.all(receipt.inventory.entries.map(entry =>
            readSnapshot(release, entry.fileName, TAXONOMY_PROJECTION_DELIVERY_MAX_BYTES)));
        const snapshots = new Map<string, FileSnapshot>([
            [TAXONOMY_PROJECTION_DELIVERY_MARKER, markerSnapshot],
            [TAXONOMY_PROJECTION_DELIVERY_RECEIPT, receiptSnapshot],
            ...artifactSnapshots.map(snapshot => [snapshot.path.substring(snapshot.path.lastIndexOf(sep) + 1), snapshot] as [string, FileSnapshot]),
        ]);
        const marker = parseJson<TaxonomyProjectionDeliveryMarker>(markerSnapshot.bytes, "marker");
        validateMarkerEnvelope(marker, receipt, receiptSnapshot.bytes, snapshots);
        rss.sample();

        const validated = await validateTaxonomyProjectionArtifact({ ...roots, artifactRoot: release.path }) as ValidatedK35;
        rss.sample(validated.peakNestedRssBytes);
        const expected = buildBundle(validated);
        if (expected.releaseId !== options.releaseId || !expected.receiptBytes.equals(receiptSnapshot.bytes)
            || !expected.markerBytes.equals(markerSnapshot.bytes)) throw new Error("K36 source-bound lineage or delivery metadata mismatch");
        for (const file of expected.artifactFiles) {
            const snapshot = snapshots.get(file.entry.fileName);
            if (!snapshot?.bytes.equals(file.bytes)) throw new Error("K36 source-bound K35 bytes mismatch");
        }

        await assertClosedInventory(release, expectedNames);
        const after = await Promise.all(expectedNames.map(fileName => readSnapshot(
            release,
            fileName,
            fileName === TAXONOMY_PROJECTION_DELIVERY_MARKER || fileName === TAXONOMY_PROJECTION_DELIVERY_RECEIPT
                ? TAXONOMY_PROJECTION_DELIVERY_MAX_METADATA_BYTES : TAXONOMY_PROJECTION_DELIVERY_MAX_BYTES,
        )));
        expectedNames.forEach((fileName, index) => unchanged(snapshots.get(fileName)!, after[index]));
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
    } catch (error) {
        throw new Error(`K36 delivery validation failed: ${boundedMessage(error)}`);
    } finally { rss.dispose(); }
}

export async function runTaxonomyProjectionDelivery(
    options: TaxonomyProjectionDeliveryRunOptions,
): Promise<TaxonomyProjectionDeliveryRunResult> {
    const rss = new RssGuard();
    try {
        if (options?.optIn !== true) throw new Error("K36 requires explicit opt-in");
        if (!options.outputRoot || !options.k35Root) throw new Error("K36 requires explicit K35 and output roots");
        const roots = sourceOptions(options, options.k35Root);
        await validateTaxonomyProjectionDeliveryOutputRoot(options.outputRoot);
        const validated = await validateTaxonomyProjectionArtifact(roots) as ValidatedK35;
        rss.sample(validated.peakNestedRssBytes);
        const first = buildBundle(validated);
        const second = buildBundle(validated);
        if (!sameBundle(first, second)) throw new Error("K36 two-construction byte identity failed");
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
    } catch (error) {
        throw new Error(`K36 delivery failed: ${boundedMessage(error)}`);
    } finally { rss.dispose(); }
}
