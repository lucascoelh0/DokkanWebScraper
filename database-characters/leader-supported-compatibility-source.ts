import { createHash } from "crypto";
import { constants as fileConstants } from "fs";
import { lstat, open, readdir, realpath, stat } from "fs/promises";
import { isAbsolute, join, relative, resolve } from "path";
import { gunzipSync } from "zlib";
import type { CharacterLeaderSupportedProjectionArtifactSet } from "./leader-supported-projection-contract";
import {
    CHARACTER_LEADER_SUPPORTED_PROJECTION_FILES,
    CHARACTER_LEADER_SUPPORTED_PROJECTION_GZIP_LIMIT_BYTES,
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
import {
    buildCharacterLeaderSupportedCompatibilityReport,
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
    androidRoot: string;
}

export interface CharacterLeaderSupportedCompatibilityRunOptions extends CharacterLeaderSupportedCompatibilitySourceOptions {
    outputRoot: string;
}

interface RootIdentity { path: string; realPath: string; dev: number; ino: number }

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
): Promise<{ inputs: CharacterLeaderSupportedCompatibilityInputs; k55ValidationProcessPeakRssBytes: number }> {
    await verifySourcePins(options.scraperRoot, "scraper", CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_SOURCE_PINS.scraper);
    const androidSourceFingerprintSha256 = await verifySourcePins(options.androidRoot, "Android", CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_SOURCE_PINS.android);
    const validatedK58 = await validateCharacterLeaderSupportedPublisherDryRunArtifact({
        sidecarRoot: options.sidecarRoot, productionRoot: options.productionRoot, fyiRoot: options.fyiRoot,
        k43Root: options.k43Root, k46Root: options.k46Root, k48Root: options.k48Root,
        nativeRuntime: options.nativeRuntime, database: options.database,
        k56Root: options.k56Root, artifactRoot: options.k58Root,
    });
    const [k56, k57, k59, k60, k60Receipt, k61, productive] = await Promise.all([
        readCharacterLeaderSupportedCompatibilityK56(options.k56Root),
        readPinnedReport(options.k57Report, "k57"), readPinnedReport(options.k59Report, "k59"),
        readPinnedReport(options.k60Report, "k60"), readPinnedReport(options.k60Receipt, "k60Receipt"),
        readPinnedReport(options.k61Report, "k61"), loadProductiveBaseline(options.productiveCharacters),
    ]);
    return {
        inputs: { k56, k58: validatedK58.artifacts, k57, k59, k60, k60Receipt, k61, productive, androidSourceFingerprintSha256 },
        k55ValidationProcessPeakRssBytes: validatedK58.k55ValidationProcessPeakRssBytes,
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

export async function validateCharacterLeaderSupportedCompatibilityArtifact(
    options: CharacterLeaderSupportedCompatibilityRunOptions,
): Promise<{ artifacts: CharacterLeaderSupportedCompatibilityArtifactSet; sourceBoundValidation: "GO"; k55ValidationProcessPeakRssBytes: number }> {
    const loaded = await loadCharacterLeaderSupportedCompatibilityInputs(options);
    const expected = materializeCharacterLeaderSupportedCompatibility(buildCharacterLeaderSupportedCompatibilityReport(loaded.inputs));
    const actual = await readCharacterLeaderSupportedCompatibilityArtifacts(options.outputRoot);
    for (const [label, left, right] of [
        ["payload", actual.gzip, expected.gzip], ["coverage", actual.coverageBytes, expected.coverageBytes],
        ["validation", actual.validationBytes, expected.validationBytes], ["manifest", actual.manifestBytes, expected.manifestBytes],
    ] as Array<[string, Buffer, Buffer]>) if (!left.equals(right)) throw new Error(`K62 source-bound artifact mismatch: ${label}`);
    return { artifacts: actual, sourceBoundValidation: "GO", k55ValidationProcessPeakRssBytes: loaded.k55ValidationProcessPeakRssBytes };
}

export async function validateCharacterLeaderSupportedCompatibilityRootSeparation(
    options: CharacterLeaderSupportedCompatibilityRunOptions,
): Promise<void> {
    const output = await inspectRoot(options.outputRoot, "output root");
    for (const [label, value] of [["K56", options.k56Root], ["K58", options.k58Root], ["Android", options.androidRoot]] as const) {
        const source = await inspectRoot(value, `${label} root`);
        if (containsPath(source.realPath, output.realPath) || containsPath(output.realPath, source.realPath)) throw new Error(`K62 output root overlaps ${label} root`);
    }
    for (const value of [options.k57Report, options.k59Report, options.k60Report, options.k60Receipt, options.k61Report, options.productiveCharacters]) {
        const canonical = await realpath(resolve(value));
        if (containsPath(output.realPath, canonical)) throw new Error("K62 output root contains a source file");
    }
}
