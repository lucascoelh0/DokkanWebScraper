import { createHash } from "crypto";
import { constants as fileConstants, existsSync } from "fs";
import { lstat, open, readdir, realpath } from "fs/promises";
import { isAbsolute, join, relative, resolve } from "path";
import { gunzipSync } from "zlib";
import type { CharacterLeaderSupportedProjectionArtifactSet } from "./leader-supported-projection-contract";
import {
    CHARACTER_LEADER_SUPPORTED_PROJECTION_FILES,
    CHARACTER_LEADER_SUPPORTED_PROJECTION_GZIP_LIMIT_BYTES,
    CHARACTER_LEADER_SUPPORTED_PROJECTION_PIN,
    CHARACTER_LEADER_SUPPORTED_PROJECTION_RAW_LIMIT_BYTES,
} from "./leader-supported-projection-contract";
import { materializeCharacterLeaderSupportedProjection } from "./leader-supported-projection";
import type { CharacterLeaderSupportedProjectionSourceOptions } from "./leader-supported-projection-source";
import { validateCharacterLeaderSupportedPublisherDryRunArtifact } from "./leader-supported-publisher-dry-run";
import { assertExactCharacterLeaderSupportedShadowK56Identity } from "./leader-supported-shadow";
import {
    CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_FILES,
    CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_GZIP_LIMIT_BYTES,
    CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_METADATA_LIMIT_BYTES,
    CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_PIN,
    CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_RAW_LIMIT_BYTES,
    CharacterLeaderSupportedCompatibilityArtifactSet,
} from "./leader-supported-compatibility-contract";
import { CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_SOURCE_PINS } from "./leader-supported-compatibility-golden";
import { CHARACTER_LEADER_ASSOCIATION_PROJECTION_FILES } from "./leader-association-projection-contract";
import { CHARACTER_LEADER_PROJECTION_FILES } from "./leader-projection-contract";
import { CHARACTER_REFRESH_PROFILE } from "./refresh-contract";
import { CHARACTER_STATE_PRODUCT_PROJECTION_FILES } from "./state-product-projection-contract";
import {
    CharacterLeaderCompatibilityAndroidSourceIdentity,
    verifyCharacterLeaderSupportedCompatibilityAndroidSource,
} from "./leader-supported-compatibility-git-source";
import {
    CharacterLeaderCompatibilityPinnedReport,
    CharacterLeaderCompatibilityProductiveBaseline,
    CharacterLeaderSupportedCompatibilityInputs,
    materializeCharacterLeaderSupportedCompatibility,
} from "./leader-supported-compatibility";

const hash = (bytes: Buffer | string): string => createHash("sha256").update(bytes).digest("hex");
const json = (value: unknown): string => JSON.stringify(value);
const O_NOFOLLOW = fileConstants.O_NOFOLLOW ?? 0;

export interface CharacterLeaderSupportedCompatibilitySourceOptions extends CharacterLeaderSupportedProjectionSourceOptions {
    k56Root: string;
    k58Root: string;
    k57Report: string;
    k59Report: string;
    k60Report: string;
    k60Receipt: string;
    k61Report: string;
    productiveCharacters: string;
    scraperRoot: string;
    androidRepository: string;
}

export interface CharacterLeaderSupportedCompatibilityRunOptions extends CharacterLeaderSupportedCompatibilitySourceOptions {
    outputRoot: string;
}

interface RootIdentity { path: string; realPath: string; dev: number; ino: number }

export interface CharacterLeaderSupportedCompatibilitySourceReceiptEntry {
    readonly relativePath: string;
    readonly kind: "directory" | "file";
    readonly realPath: string;
    readonly dev: number;
    readonly ino: number;
    readonly sizeBytes?: number;
    readonly sha256?: string;
}

export interface CharacterLeaderSupportedCompatibilitySourceReceiptRoot {
    readonly role: string;
    readonly path: string;
    readonly realPath: string;
    readonly dev: number;
    readonly ino: number;
    readonly entries: readonly CharacterLeaderSupportedCompatibilitySourceReceiptEntry[];
}

export interface CharacterLeaderSupportedCompatibilitySourceReceiptFile {
    readonly role: string;
    readonly path: string;
    readonly realPath: string;
    readonly dev: number;
    readonly ino: number;
    readonly sizeBytes: number;
    readonly sha256: string;
}

export interface CharacterLeaderSupportedCompatibilitySourceReceipt {
    readonly schemaVersion: 1;
    readonly contract: "dokkan-database-character-leader-supported-compatibility-source-receipt";
    readonly roots: readonly CharacterLeaderSupportedCompatibilitySourceReceiptRoot[];
    readonly files: readonly CharacterLeaderSupportedCompatibilitySourceReceiptFile[];
    readonly android: Readonly<CharacterLeaderCompatibilityAndroidSourceIdentity>;
    readonly fingerprintSha256: string;
}

async function inspectRoot(value: string, label: string): Promise<RootIdentity> {
    if (!value || !isAbsolute(value)) throw new Error(`K62 ${label} must be an absolute path`);
    const path = resolve(value), metadata = await lstat(path), canonical = await realpath(path);
    if (!metadata.isDirectory() || metadata.isSymbolicLink() || resolve(canonical) !== path) throw new Error(`K62 ${label} must be a canonical non-link directory`);
    return { path, realPath: canonical, dev: metadata.dev, ino: metadata.ino };
}

async function checkpoint(root: RootIdentity): Promise<void> {
    const metadata = await lstat(root.path), canonical = await realpath(root.path);
    if (!metadata.isDirectory() || metadata.isSymbolicLink() || metadata.dev !== root.dev || metadata.ino !== root.ino || canonical !== root.realPath) {
        throw new Error("K62 root identity changed");
    }
}

function containsPath(parent: string, child: string): boolean {
    const suffix = relative(parent, child);
    return suffix === "" || (!suffix.startsWith("..") && !isAbsolute(suffix));
}

const SOURCE_RECEIPT_MAX_ENTRIES = 10_000;
const SOURCE_RECEIPT_MAX_SELECTED_PATHS = 64;
const SOURCE_RECEIPT_CHUNK_BYTES = 64 * 1024;

function receiptPath(value: string): string {
    return value.replace(/\\/g, "/");
}

async function snapshotReceiptFile(pathValue: string, role: string): Promise<CharacterLeaderSupportedCompatibilitySourceReceiptFile> {
    const path = resolve(pathValue), before = await lstat(path), canonical = await realpath(path);
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || !Number.isSafeInteger(before.size) || before.size < 0) {
        throw new Error(`K62 source receipt file rejected: ${role}`);
    }
    const handle = await open(path, fileConstants.O_RDONLY | O_NOFOLLOW);
    try {
        const descriptor = await handle.stat();
        if (!descriptor.isFile() || descriptor.dev !== before.dev || descriptor.ino !== before.ino
            || descriptor.nlink !== 1 || descriptor.size !== before.size) {
            throw new Error(`K62 source receipt descriptor changed: ${role}`);
        }
        const digest = createHash("sha256"), chunk = Buffer.allocUnsafe(SOURCE_RECEIPT_CHUNK_BYTES);
        let position = 0;
        while (position < descriptor.size) {
            const length = Math.min(chunk.length, descriptor.size - position);
            const { bytesRead } = await handle.read(chunk, 0, length, position);
            if (bytesRead <= 0) throw new Error(`K62 source receipt short read: ${role}`);
            digest.update(chunk.subarray(0, bytesRead));
            position += bytesRead;
        }
        const after = await handle.stat(), visible = await lstat(path), canonicalAfter = await realpath(path);
        if (after.dev !== descriptor.dev || after.ino !== descriptor.ino || after.size !== descriptor.size
            || visible.dev !== descriptor.dev || visible.ino !== descriptor.ino || visible.size !== descriptor.size
            || visible.isSymbolicLink() || visible.nlink !== 1 || canonicalAfter !== canonical) {
            throw new Error(`K62 source receipt file changed during read: ${role}`);
        }
        return {
            role, path, realPath: canonical, dev: descriptor.dev, ino: descriptor.ino,
            sizeBytes: descriptor.size, sha256: digest.digest("hex"),
        };
    } finally { await handle.close(); }
}

async function snapshotReceiptRoot(rootValue: string, role: string): Promise<CharacterLeaderSupportedCompatibilitySourceReceiptRoot> {
    const root = await inspectRoot(rootValue, `${role} receipt root`);
    const entries: CharacterLeaderSupportedCompatibilitySourceReceiptEntry[] = [];
    const walk = async (directory: string, prefix: string): Promise<void> => {
        const before = await lstat(directory), canonical = await realpath(directory);
        if (!before.isDirectory() || before.isSymbolicLink()) throw new Error(`K62 source receipt directory rejected: ${role}`);
        const names = (await readdir(directory, { withFileTypes: true })).map(entry => entry.name).sort();
        for (const name of names) {
            if (++entryCount > SOURCE_RECEIPT_MAX_ENTRIES) throw new Error(`K62 source receipt inventory limit reached: ${role}`);
            const path = join(directory, name), relativePath = receiptPath(prefix ? `${prefix}/${name}` : name);
            const metadata = await lstat(path);
            if (metadata.isSymbolicLink()) throw new Error(`K62 source receipt link rejected: ${role}/${relativePath}`);
            if (metadata.isDirectory()) {
                const directoryCanonical = await realpath(path);
                entries.push({ relativePath, kind: "directory", realPath: directoryCanonical, dev: metadata.dev, ino: metadata.ino });
                await walk(path, relativePath);
            } else if (metadata.isFile()) {
                const file = await snapshotReceiptFile(path, `${role}/${relativePath}`);
                entries.push({
                    relativePath, kind: "file", realPath: file.realPath, dev: file.dev, ino: file.ino,
                    sizeBytes: file.sizeBytes, sha256: file.sha256,
                });
            } else throw new Error(`K62 source receipt member rejected: ${role}/${relativePath}`);
        }
        const after = await lstat(directory), canonicalAfter = await realpath(directory);
        const namesAfter = (await readdir(directory, { withFileTypes: true })).map(entry => entry.name).sort();
        if (after.dev !== before.dev || after.ino !== before.ino || canonicalAfter !== canonical || json(namesAfter) !== json(names)) {
            throw new Error(`K62 source receipt directory changed during scan: ${role}`);
        }
    };
    let entryCount = 0;
    await walk(root.path, "");
    await checkpoint(root);
    return { role, ...root, entries };
}

async function snapshotSelectedReceiptRoot(
    rootValue: string,
    role: string,
    relativePaths: readonly string[],
): Promise<CharacterLeaderSupportedCompatibilitySourceReceiptRoot> {
    if (!relativePaths.length || relativePaths.length > SOURCE_RECEIPT_MAX_SELECTED_PATHS
        || new Set(relativePaths).size !== relativePaths.length) {
        throw new Error(`K62 selected source receipt path set rejected: ${role}`);
    }
    const root = await inspectRoot(rootValue, `${role} receipt root`);
    const entries: CharacterLeaderSupportedCompatibilitySourceReceiptEntry[] = [];
    const capturedDirectories = new Set<string>();
    for (const relativePath of [...relativePaths].sort()) {
        const parts = relativePath.split("/");
        if (!parts.length || parts.some(part => !part || part === "." || part === ".." || part.includes("\\"))) {
            throw new Error(`K62 selected source pin path rejected: ${relativePath}`);
        }
        let ancestor = root.path;
        const ancestorParts: string[] = [];
        for (const part of parts.slice(0, -1)) {
            ancestorParts.push(part);
            ancestor = join(ancestor, part);
            const metadata = await lstat(ancestor), canonical = await realpath(ancestor);
            if (!metadata.isDirectory() || metadata.isSymbolicLink() || !containsPath(root.realPath, canonical)) {
                throw new Error(`K62 selected source pin linked ancestor rejected: ${relativePath}`);
            }
            const ancestorRelativePath = receiptPath(ancestorParts.join("/"));
            if (!capturedDirectories.has(ancestorRelativePath)) {
                entries.push({
                    relativePath: ancestorRelativePath, kind: "directory", realPath: canonical,
                    dev: metadata.dev, ino: metadata.ino,
                });
                capturedDirectories.add(ancestorRelativePath);
            }
        }
        const file = await snapshotReceiptFile(join(root.path, ...parts), `${role}/${relativePath}`);
        assertCharacterLeaderSupportedCompatibilitySelectedPinWithinRootForTest(root.realPath, relativePath, file.realPath);
        entries.push({
            relativePath, kind: "file", realPath: file.realPath, dev: file.dev, ino: file.ino,
            sizeBytes: file.sizeBytes, sha256: file.sha256,
        });
    }
    await checkpoint(root);
    return { role, ...root, entries };
}

export async function captureCharacterLeaderSupportedCompatibilitySelectedRootForTest(
    rootValue: string,
    role: string,
    relativePaths: readonly string[],
): Promise<CharacterLeaderSupportedCompatibilitySourceReceiptRoot> {
    return snapshotSelectedReceiptRoot(rootValue, role, relativePaths);
}

async function snapshotManifestReceiptRoot(
    rootValue: string,
    role: string,
    files: { readonly manifest: string; readonly coverage: string; readonly validation: string },
): Promise<CharacterLeaderSupportedCompatibilitySourceReceiptRoot> {
    const root = await inspectRoot(rootValue, `${role} manifest receipt root`);
    const manifestBytes = await readBoundedFile(join(root.path, files.manifest), 128 * 1024, `${role} manifest receipt`);
    let manifest: any;
    try { manifest = JSON.parse(manifestBytes.toString("utf8")); }
    catch { throw new Error(`K62 ${role} manifest receipt JSON rejected`); }
    if (typeof manifest?.fileName !== "string" || manifest.fileName.includes("/") || manifest.fileName.includes("\\")
        || manifest.coverageFile !== files.coverage || manifest.validationFile !== files.validation) {
        throw new Error(`K62 ${role} manifest receipt members rejected`);
    }
    const receipt = await snapshotSelectedReceiptRoot(root.path, role, [files.manifest, manifest.fileName, files.coverage, files.validation]);
    await checkpoint(root);
    if (receipt.dev !== root.dev || receipt.ino !== root.ino || receipt.realPath !== root.realPath) {
        throw new Error(`K62 ${role} manifest receipt root changed`);
    }
    return receipt;
}

export function assertCharacterLeaderSupportedCompatibilitySelectedPinWithinRootForTest(
    canonicalRoot: string,
    relativePath: string,
    canonicalFile: string,
): void {
    const parts = relativePath.split("/");
    if (!parts.length || parts.some(part => !part || part === "." || part === ".." || part.includes("\\"))
        || !containsPath(resolve(canonicalRoot), resolve(canonicalFile))) {
        throw new Error(`K62 selected source pin escaped canonical root: ${relativePath}`);
    }
}

const K55_NATIVE_EVIDENCE_FILES = [
    ["K50 native evidence", "native-leader-skill-semantics.json"],
    ["K51 target evidence", "native-passive-target-dispatch-semantics.json"],
    ["K51 sub-target evidence", "native-sub-target-type-semantics.json"],
    ["K52 native evidence", "native-leader-causality-semantics.json"],
    ["K53 native evidence", "native-leader-causality-collection.json"],
    ["K54 native evidence", "native-leader-causality-deck-index.json"],
    ["K55 native evidence", "native-leader-lifecycle-semantics.json"],
] as const;

function nativeEvidencePath(name: string): string {
    const adjacent = resolve(__dirname, "..", "database-experiment", name);
    return existsSync(adjacent) ? adjacent : resolve(__dirname, "..", "..", "database-experiment", name);
}

function freezeReceipt(
    rootsValue: CharacterLeaderSupportedCompatibilitySourceReceiptRoot[],
    filesValue: CharacterLeaderSupportedCompatibilitySourceReceiptFile[],
    androidValue: CharacterLeaderCompatibilityAndroidSourceIdentity,
): CharacterLeaderSupportedCompatibilitySourceReceipt {
    const roots = Object.freeze(rootsValue.map(root => Object.freeze({
        ...root,
        entries: Object.freeze(root.entries.map(entry => Object.freeze({ ...entry }))),
    })));
    const files = Object.freeze(filesValue.map(file => Object.freeze({ ...file })));
    const android = Object.freeze({
        ...androidValue,
        files: Object.freeze(androidValue.files.map(file => Object.freeze({ ...file }))),
    }) as Readonly<CharacterLeaderCompatibilityAndroidSourceIdentity>;
    const body = {
        schemaVersion: 1 as const,
        contract: "dokkan-database-character-leader-supported-compatibility-source-receipt" as const,
        roots,
        files,
        android,
    };
    return Object.freeze({ ...body, fingerprintSha256: hash(json(body)) });
}

export async function captureCharacterLeaderSupportedCompatibilitySourceReceipt(
    options: CharacterLeaderSupportedCompatibilitySourceOptions,
    androidIdentity?: CharacterLeaderCompatibilityAndroidSourceIdentity,
): Promise<CharacterLeaderSupportedCompatibilitySourceReceipt> {
    const sidecarPaths = ["k0", "k1", "k2", "k3", "k7"].flatMap(gate => {
        const profile = CHARACTER_REFRESH_PROFILE.sidecars.find(value => value.gate === gate);
        if (!profile) throw new Error(`K62 K55 sidecar receipt profile missing: ${gate}`);
        return [profile.manifest.fileName, profile.artifact.fileName, profile.coverage.fileName, profile.validation.fileName]
            .map(file => `${gate}/${file}`);
    });
    const roots = await Promise.all([
        snapshotReceiptRoot(options.k58Root, "K58 artifacts"),
        snapshotReceiptRoot(options.k56Root, "K56 artifacts"),
        snapshotSelectedReceiptRoot(options.sidecarRoot, "K55 sidecar inputs", sidecarPaths),
        snapshotSelectedReceiptRoot(options.productionRoot, "K55 production inputs", [CHARACTER_LEADER_SUPPORTED_PROJECTION_PIN.productiveFileName]),
        snapshotSelectedReceiptRoot(options.fyiRoot, "K55 FYI inputs", ["characters-manifest.json", "characters.json.gz"]),
        snapshotManifestReceiptRoot(options.k43Root, "K55 K43 inputs", CHARACTER_STATE_PRODUCT_PROJECTION_FILES),
        snapshotManifestReceiptRoot(options.k46Root, "K55 K46 inputs", CHARACTER_LEADER_PROJECTION_FILES),
        snapshotManifestReceiptRoot(options.k48Root, "K55 K48 inputs", CHARACTER_LEADER_ASSOCIATION_PROJECTION_FILES),
        snapshotSelectedReceiptRoot(options.scraperRoot, "scraper pins", CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_SOURCE_PINS.scraper.map(pin => pin[0])),
    ]);
    const files = await Promise.all([
        snapshotReceiptFile(options.k57Report, "K57 pinned report"),
        snapshotReceiptFile(options.k59Report, "K59 pinned report"),
        snapshotReceiptFile(options.k60Report, "K60 pinned report"),
        snapshotReceiptFile(options.k60Receipt, "K60 pinned receipt"),
        snapshotReceiptFile(options.k61Report, "K61 pinned report"),
        snapshotReceiptFile(options.productiveCharacters, "productive Character[]"),
        snapshotReceiptFile(options.nativeRuntime, "K55 native runtime"),
        ...K55_NATIVE_EVIDENCE_FILES.map(([role, name]) => snapshotReceiptFile(nativeEvidencePath(name), role)),
        snapshotReceiptFile(options.database, "K55 database"),
    ]);
    const android = androidIdentity ?? await verifyCharacterLeaderSupportedCompatibilityAndroidSource(options.androidRepository);
    return freezeReceipt(roots, files, android);
}

function assertReceiptFingerprint(receipt: CharacterLeaderSupportedCompatibilitySourceReceipt): void {
    const { fingerprintSha256, ...body } = receipt;
    const { fingerprintSha256: androidFingerprintSha256, ...androidBody } = receipt.android;
    if (receipt.schemaVersion !== 1
        || receipt.contract !== "dokkan-database-character-leader-supported-compatibility-source-receipt"
        || receipt.android.access !== "git_object_database_only" || receipt.android.checkoutBytesRead !== false
        || androidFingerprintSha256 !== hash(json(androidBody))
        || fingerprintSha256 !== hash(json(body))) throw new Error("K62 source receipt integrity rejected");
}

export function assertCharacterLeaderSupportedCompatibilitySourceReceiptStable(
    before: CharacterLeaderSupportedCompatibilitySourceReceipt,
    after: CharacterLeaderSupportedCompatibilitySourceReceipt,
): void {
    assertReceiptFingerprint(before);
    assertReceiptFingerprint(after);
    if (json(before) !== json(after)) throw new Error("K62 persistent source identity drifted after write");
}

export interface CharacterLeaderSupportedCompatibilityPreHeavyDependencies {
    captureReceipt: typeof captureCharacterLeaderSupportedCompatibilitySourceReceipt;
    collectGarbage(): void;
    validateK58: typeof validateCharacterLeaderSupportedPublisherDryRunArtifact;
}

const preHeavyDependencies: CharacterLeaderSupportedCompatibilityPreHeavyDependencies = {
    captureReceipt: captureCharacterLeaderSupportedCompatibilitySourceReceipt,
    collectGarbage(): void {
        if (typeof global.gc !== "function") throw new Error("K62 requires GC before K58/K55 validation");
        global.gc();
    },
    validateK58: validateCharacterLeaderSupportedPublisherDryRunArtifact,
};

export async function captureCharacterLeaderSupportedCompatibilityReceiptBeforeHeavyValidation(
    options: CharacterLeaderSupportedCompatibilitySourceOptions,
    androidSource: CharacterLeaderCompatibilityAndroidSourceIdentity,
    dependencies: CharacterLeaderSupportedCompatibilityPreHeavyDependencies = preHeavyDependencies,
): Promise<{
    sourceReceipt: CharacterLeaderSupportedCompatibilitySourceReceipt;
    validatedK58: Awaited<ReturnType<typeof validateCharacterLeaderSupportedPublisherDryRunArtifact>>;
}> {
    const sourceReceipt = await dependencies.captureReceipt(options, androidSource);
    dependencies.collectGarbage();
    const validatedK58 = await dependencies.validateK58({
        sidecarRoot: options.sidecarRoot, productionRoot: options.productionRoot, fyiRoot: options.fyiRoot,
        k43Root: options.k43Root, k46Root: options.k46Root, k48Root: options.k48Root,
        nativeRuntime: options.nativeRuntime, database: options.database,
        k56Root: options.k56Root, artifactRoot: options.k58Root,
    });
    return { sourceReceipt, validatedK58 };
}

async function readBoundedFile(path: string, maximumBytesExclusive: number, label: string): Promise<Buffer> {
    const before = await lstat(path);
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || before.size <= 0 || before.size >= maximumBytesExclusive) {
        throw new Error(`K62 ${label} source rejected`);
    }
    const handle = await open(path, fileConstants.O_RDONLY | O_NOFOLLOW);
    try {
        const descriptor = await handle.stat();
        if (!descriptor.isFile() || descriptor.dev !== before.dev || descriptor.ino !== before.ino || descriptor.size !== before.size) {
            throw new Error(`K62 ${label} descriptor changed`);
        }
        const bytes = await handle.readFile();
        const after = await handle.stat();
        if (bytes.length !== descriptor.size || after.dev !== descriptor.dev || after.ino !== descriptor.ino || after.size !== descriptor.size) {
            throw new Error(`K62 ${label} changed during read`);
        }
        return bytes;
    } finally { await handle.close(); }
}

function parseCanonical<T>(bytes: Buffer, label: string): T {
    let value: T;
    try { value = JSON.parse(bytes.toString("utf8")); } catch { throw new Error(`K62 ${label} JSON rejected`); }
    if (!bytes.equals(Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8"))) throw new Error(`K62 ${label} must be canonical pretty JSON`);
    return value;
}

async function readPinnedReport(
    path: string,
    label: keyof typeof CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_PIN.reports,
): Promise<CharacterLeaderCompatibilityPinnedReport> {
    const pin = CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_PIN.reports[label];
    const bytes = await readBoundedFile(resolve(path), 128 * 1024, `${label} report`);
    if (bytes.length !== pin.sizeBytes || hash(bytes) !== pin.sha256) throw new Error(`K62 ${label} report pin changed`);
    return { bytes, value: parseCanonical<any>(bytes, `${label} report`) };
}

export async function readCharacterLeaderSupportedCompatibilityK56(
    value: string,
): Promise<CharacterLeaderSupportedProjectionArtifactSet> {
    const root = await inspectRoot(value, "K56 root");
    const names = (await readdir(root.path, { withFileTypes: true }));
    if (names.some(entry => !entry.isFile() || entry.isSymbolicLink()) || names.length !== 4) throw new Error("K62 K56 root inventory rejected");
    const manifestPath = join(root.path, CHARACTER_LEADER_SUPPORTED_PROJECTION_FILES.manifest);
    const manifestBytes = await readBoundedFile(manifestPath, 128 * 1024, "K56 manifest");
    const manifest: any = parseCanonical(manifestBytes, "K56 manifest");
    const expectedNames = [manifest.fileName, CHARACTER_LEADER_SUPPORTED_PROJECTION_FILES.coverage,
        CHARACTER_LEADER_SUPPORTED_PROJECTION_FILES.validation, CHARACTER_LEADER_SUPPORTED_PROJECTION_FILES.manifest].sort();
    if (json(names.map(entry => entry.name).sort()) !== json(expectedNames)) throw new Error("K62 K56 member inventory changed");
    const [gzip, coverageBytes, validationBytes] = await Promise.all([
        readBoundedFile(join(root.path, manifest.fileName), CHARACTER_LEADER_SUPPORTED_PROJECTION_GZIP_LIMIT_BYTES, "K56 payload"),
        readBoundedFile(join(root.path, CHARACTER_LEADER_SUPPORTED_PROJECTION_FILES.coverage), 128 * 1024, "K56 coverage"),
        readBoundedFile(join(root.path, CHARACTER_LEADER_SUPPORTED_PROJECTION_FILES.validation), 128 * 1024, "K56 validation"),
    ]);
    await checkpoint(root);
    if (hash(gzip) !== manifest.sha256 || gzip.length !== manifest.sizeBytes || hash(coverageBytes) !== manifest.coverageSha256
        || coverageBytes.length !== manifest.coverageSizeBytes || hash(validationBytes) !== manifest.validationSha256
        || validationBytes.length !== manifest.validationSizeBytes) throw new Error("K62 K56 member identity rejected");
    const raw = gunzipSync(gzip, { maxOutputLength: CHARACTER_LEADER_SUPPORTED_PROJECTION_RAW_LIMIT_BYTES - 1 });
    if (raw.length !== manifest.uncompressedSizeBytes || hash(raw) !== manifest.uncompressedSha256) throw new Error("K62 K56 raw identity rejected");
    const dataset = parseCanonical<any>(raw, "K56 raw payload");
    const coverage = parseCanonical<any>(coverageBytes, "K56 coverage");
    const validation = parseCanonical<any>(validationBytes, "K56 validation");
    const rebuilt = materializeCharacterLeaderSupportedProjection(dataset, coverage);
    if (!rebuilt.raw.equals(raw) || !rebuilt.gzip.equals(gzip) || !rebuilt.coverageBytes.equals(coverageBytes)
        || !rebuilt.validationBytes.equals(validationBytes) || !rebuilt.manifestBytes.equals(manifestBytes)
        || json(rebuilt.validation) !== json(validation)) throw new Error("K62 K56 lossless reconstruction rejected");
    assertExactCharacterLeaderSupportedShadowK56Identity(rebuilt);
    return rebuilt;
}

async function loadProductiveBaseline(path: string): Promise<CharacterLeaderCompatibilityProductiveBaseline> {
    const pin = CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_PIN.productive;
    const bytes = await readBoundedFile(resolve(path), pin.sizeBytes + 1, "productive Character[]");
    if (bytes.length !== pin.sizeBytes || hash(bytes) !== pin.sha256) throw new Error("K62 productive Character[] pin changed");
    let values: any[];
    try { values = JSON.parse(bytes.toString("utf8")); } catch { throw new Error("K62 productive Character[] JSON rejected"); }
    if (!Array.isArray(values) || values.length !== pin.topLevelCount) throw new Error("K62 productive Character[] cardinality changed");
    const ids = new Set<string>(), textIds = new Set<string>(), structuredLeaderDetailIds = new Set<string>();
    for (const value of values) {
        const id = value?.id;
        if (typeof id !== "string" || !id || ids.has(id)) throw new Error("K62 productive structural card ID rejected");
        ids.add(id);
        if (typeof value.leaderSkill === "string" && value.leaderSkill.length > 0) textIds.add(id);
        if (value.leaderSkillDetails !== undefined || value.ezaLeaderSkillDetails !== undefined) structuredLeaderDetailIds.add(id);
    }
    return { ids, textIds, structuredLeaderDetailIds };
}

async function verifySourcePins(
    rootValue: string,
    label: string,
    pins: readonly (readonly [string, number, string])[],
): Promise<string> {
    const root = await inspectRoot(rootValue, `${label} source root`);
    const identities: Array<{ file: string; sizeBytes: number; sha256: string }> = [];
    for (const [file, sizeBytes, sha256] of pins) {
        const path = join(root.path, ...file.split("/"));
        const bytes = await readBoundedFile(path, Math.max(sizeBytes + 1, 512 * 1024), `${label} source ${file}`);
        if (bytes.length !== sizeBytes || hash(bytes) !== sha256) throw new Error(`K62 ${label} source pin changed: ${file}`);
        identities.push({ file, sizeBytes, sha256 });
    }
    await checkpoint(root);
    return hash(JSON.stringify(identities));
}

export async function loadCharacterLeaderSupportedCompatibilityInputs(
    options: CharacterLeaderSupportedCompatibilitySourceOptions,
): Promise<{
    inputs: CharacterLeaderSupportedCompatibilityInputs;
    k55ValidationProcessPeakRssBytes: number;
    sourceReceipt: CharacterLeaderSupportedCompatibilitySourceReceipt;
}> {
    await verifySourcePins(options.scraperRoot, "scraper", CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_SOURCE_PINS.scraper);
    const androidSource = await verifyCharacterLeaderSupportedCompatibilityAndroidSource(options.androidRepository);
    const { sourceReceipt, validatedK58 } = await captureCharacterLeaderSupportedCompatibilityReceiptBeforeHeavyValidation(options, androidSource);
    const [k56, k57, k59, k60, k60Receipt, k61, productive] = await Promise.all([
        readCharacterLeaderSupportedCompatibilityK56(options.k56Root),
        readPinnedReport(options.k57Report, "k57"), readPinnedReport(options.k59Report, "k59"),
        readPinnedReport(options.k60Report, "k60"), readPinnedReport(options.k60Receipt, "k60Receipt"),
        readPinnedReport(options.k61Report, "k61"), loadProductiveBaseline(options.productiveCharacters),
    ]);
    const afterLoadReceipt = await captureCharacterLeaderSupportedCompatibilitySourceReceipt(options);
    assertCharacterLeaderSupportedCompatibilitySourceReceiptStable(sourceReceipt, afterLoadReceipt);
    return {
        inputs: { k56, k58: validatedK58.artifacts, k57, k59, k60, k60Receipt, k61, productive, androidSource },
        k55ValidationProcessPeakRssBytes: validatedK58.k55ValidationProcessPeakRssBytes,
        sourceReceipt,
    };
}

async function writeCreateOnly(root: RootIdentity, name: string, bytes: Buffer): Promise<void> {
    await checkpoint(root);
    const path = join(root.path, name);
    const handle = await open(path, fileConstants.O_WRONLY | fileConstants.O_CREAT | fileConstants.O_EXCL | O_NOFOLLOW, 0o444);
    try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
    const metadata = await lstat(path);
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.nlink !== 1 || metadata.size !== bytes.length) throw new Error(`K62 written member rejected: ${name}`);
    const reread = await readBoundedFile(path, Math.max(bytes.length + 1, CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_RAW_LIMIT_BYTES), `written ${name}`);
    if (!reread.equals(bytes)) throw new Error(`K62 written member drifted: ${name}`);
    await checkpoint(root);
}

export async function writeCharacterLeaderSupportedCompatibilityArtifacts(
    outputRoot: string,
    artifacts: CharacterLeaderSupportedCompatibilityArtifactSet,
): Promise<void> {
    const root = await inspectRoot(outputRoot, "output root");
    if ((await readdir(root.path)).length !== 0) throw new Error("K62 output root must be empty");
    await writeCreateOnly(root, artifacts.manifest.fileName, artifacts.gzip);
    await writeCreateOnly(root, CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_FILES.coverage, artifacts.coverageBytes);
    await writeCreateOnly(root, CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_FILES.validation, artifacts.validationBytes);
    await writeCreateOnly(root, CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_FILES.manifest, artifacts.manifestBytes);
}

export async function readCharacterLeaderSupportedCompatibilityArtifacts(
    outputRoot: string,
): Promise<CharacterLeaderSupportedCompatibilityArtifactSet> {
    const root = await inspectRoot(outputRoot, "artifact root");
    const entries = await readdir(root.path, { withFileTypes: true });
    if (entries.length !== 4 || entries.some(entry => !entry.isFile() || entry.isSymbolicLink())) throw new Error("K62 artifact root inventory rejected");
    const manifestBytes = await readBoundedFile(join(root.path, CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_FILES.manifest), CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_METADATA_LIMIT_BYTES, "K62 manifest");
    const manifest: any = parseCanonical(manifestBytes, "K62 manifest");
    const expected = [manifest.fileName, CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_FILES.coverage,
        CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_FILES.validation, CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_FILES.manifest].sort();
    if (json(entries.map(entry => entry.name).sort()) !== json(expected)) throw new Error("K62 artifact member names rejected");
    const [gzip, coverageBytes, validationBytes] = await Promise.all([
        readBoundedFile(join(root.path, manifest.fileName), CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_GZIP_LIMIT_BYTES, "K62 payload"),
        readBoundedFile(join(root.path, CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_FILES.coverage), CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_METADATA_LIMIT_BYTES, "K62 coverage"),
        readBoundedFile(join(root.path, CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_FILES.validation), CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_METADATA_LIMIT_BYTES, "K62 validation"),
    ]);
    await checkpoint(root);
    if (gzip.length !== manifest.sizeBytes || hash(gzip) !== manifest.sha256 || coverageBytes.length !== manifest.coverageSizeBytes
        || hash(coverageBytes) !== manifest.coverageSha256 || validationBytes.length !== manifest.validationSizeBytes
        || hash(validationBytes) !== manifest.validationSha256) throw new Error("K62 artifact member identity rejected");
    const raw = gunzipSync(gzip, { maxOutputLength: CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_RAW_LIMIT_BYTES - 1 });
    if (raw.length !== manifest.uncompressedSizeBytes || hash(raw) !== manifest.uncompressedSha256) throw new Error("K62 raw identity rejected");
    const report = parseCanonical<any>(raw, "K62 report");
    const coverage = parseCanonical<any>(coverageBytes, "K62 coverage");
    const validation = parseCanonical<any>(validationBytes, "K62 validation");
    const rebuilt = materializeCharacterLeaderSupportedCompatibility(report);
    if (!rebuilt.raw.equals(raw) || !rebuilt.gzip.equals(gzip) || !rebuilt.coverageBytes.equals(coverageBytes)
        || !rebuilt.validationBytes.equals(validationBytes) || !rebuilt.manifestBytes.equals(manifestBytes)
        || json(rebuilt.coverage) !== json(coverage) || json(rebuilt.validation) !== json(validation)) {
        throw new Error("K62 lossless artifact reconstruction rejected");
    }
    return rebuilt;
}

export interface CharacterLeaderSupportedCompatibilityExpectedArtifactBytes {
    readonly gzip: Buffer;
    readonly coverageBytes: Buffer;
    readonly validationBytes: Buffer;
    readonly manifestBytes: Buffer;
}

export function assertCharacterLeaderSupportedCompatibilityPersistedBytes(
    actual: CharacterLeaderSupportedCompatibilityExpectedArtifactBytes,
    expected: CharacterLeaderSupportedCompatibilityExpectedArtifactBytes,
): void {
    for (const [label, left, right] of [
        ["payload", actual.gzip, expected.gzip], ["coverage", actual.coverageBytes, expected.coverageBytes],
        ["validation", actual.validationBytes, expected.validationBytes], ["manifest", actual.manifestBytes, expected.manifestBytes],
    ] as Array<[string, Buffer, Buffer]>) if (!left.equals(right)) throw new Error(`K62 persisted artifact mismatch: ${label}`);
}

export async function validateCharacterLeaderSupportedCompatibilityArtifact(
    options: CharacterLeaderSupportedCompatibilityRunOptions,
    expected: CharacterLeaderSupportedCompatibilityExpectedArtifactBytes,
    sourceReceipt: CharacterLeaderSupportedCompatibilitySourceReceipt,
): Promise<{
    artifacts: CharacterLeaderSupportedCompatibilityArtifactSet;
    sourceBoundReconstruction: "GO";
    sourceStability: "CHECKPOINTED_PERSISTENT_DRIFT_ONLY";
}> {
    const actual = await readCharacterLeaderSupportedCompatibilityArtifacts(options.outputRoot);
    assertCharacterLeaderSupportedCompatibilityPersistedBytes(actual, expected);
    const afterWriteReceipt = await captureCharacterLeaderSupportedCompatibilitySourceReceipt(options);
    assertCharacterLeaderSupportedCompatibilitySourceReceiptStable(sourceReceipt, afterWriteReceipt);
    return {
        artifacts: actual,
        sourceBoundReconstruction: "GO",
        sourceStability: "CHECKPOINTED_PERSISTENT_DRIFT_ONLY",
    };
}

export async function validateCharacterLeaderSupportedCompatibilityRootSeparation(
    options: CharacterLeaderSupportedCompatibilityRunOptions,
): Promise<void> {
    const output = await inspectRoot(options.outputRoot, "output root");
    for (const [label, value] of [
        ["K56", options.k56Root], ["K58", options.k58Root],
        ["K55 sidecar", options.sidecarRoot], ["K55 production", options.productionRoot],
        ["K55 FYI", options.fyiRoot], ["K55 K43", options.k43Root],
        ["K55 K46", options.k46Root], ["K55 K48", options.k48Root],
        ["scraper", options.scraperRoot], ["Android repository", options.androidRepository],
    ] as const) {
        const source = await inspectRoot(value, `${label} root`);
        if (containsPath(source.realPath, output.realPath) || containsPath(output.realPath, source.realPath)) throw new Error(`K62 output root overlaps ${label} root`);
    }
    for (const [label, value] of [
        ["K57 report", options.k57Report], ["K59 report", options.k59Report],
        ["K60 report", options.k60Report], ["K60 receipt", options.k60Receipt],
        ["K61 report", options.k61Report], ["productive Character[]", options.productiveCharacters],
        ["K55 native runtime", options.nativeRuntime],
        ...K55_NATIVE_EVIDENCE_FILES.map(([label, name]) => [label, nativeEvidencePath(name)] as const),
        ["K55 database", options.database],
    ] as const) {
        const path = resolve(value), metadata = await lstat(path), canonical = await realpath(path);
        if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.nlink !== 1) throw new Error(`K62 ${label} source file rejected`);
        if (containsPath(output.realPath, canonical) || containsPath(canonical, output.realPath)) {
            throw new Error(`K62 output root overlaps ${label} source file`);
        }
    }
}
