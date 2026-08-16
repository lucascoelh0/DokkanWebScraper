import { createHash } from "crypto";
import { constants, Stats } from "fs";
import { lstat, open, realpath } from "fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "path";
import { gunzipSync, gzipSync } from "zlib";
import { resolveCharacterInputFile } from "./artifact-path";
import type { CharacterLeaderLifecycleSemanticsReport } from "./leader-lifecycle-semantics-contract";
import { runCharacterLeaderLifecycleSemanticsAudit } from "./leader-lifecycle-semantics-run";
import { validateCharacterLeaderAssociationProjectionArtifact } from "./leader-association-projection";
import {
    assertLeaderCausalityDatabaseStable,
    assertLeaderCausalityK3Stable,
    loadPinnedK3LeaderCausalitySource,
    loadPinnedLeaderCausalityDatabase,
} from "./leader-causality-semantics-source";
import {
    CHARACTER_LEADER_SUPPORTED_PROJECTION_FILES,
    CHARACTER_LEADER_SUPPORTED_PROJECTION_GZIP_LIMIT_BYTES,
    CHARACTER_LEADER_SUPPORTED_PROJECTION_METADATA_LIMIT_BYTES,
    CHARACTER_LEADER_SUPPORTED_PROJECTION_PIN,
    CHARACTER_LEADER_SUPPORTED_PROJECTION_RAW_LIMIT_BYTES,
    CharacterLeaderSupportedProjectionArtifactSet,
    CharacterLeaderSupportedProjectionManifest,
} from "./leader-supported-projection-contract";
import {
    CharacterLeaderSupportedProductiveSource,
    buildCharacterLeaderSupportedProjection,
    materializeCharacterLeaderSupportedProjection,
} from "./leader-supported-projection";
import { assertLeaderTargetK3Stable, loadPinnedK3LeaderTargetSource } from "./leader-target-semantics-source";
import { assertLeaderValueK3Stable, loadPinnedK3LeaderValueSource } from "./leader-value-scope-source";

const hash = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");
const samePath = (left: string, right: string): boolean => process.platform === "win32"
    ? resolve(left).toLowerCase() === resolve(right).toLowerCase() : resolve(left) === resolve(right);
const sameFile = (left: Stats, right: Stats): boolean => left.dev === right.dev && left.ino === right.ino;
interface RootIdentity { path: string; realPath: string; dev: number; ino: number }
interface Snapshot { path: string; bytes: Buffer; metadata: Stats }

export interface CharacterLeaderSupportedProjectionSourceOptions {
    sidecarRoot: string;
    productionRoot: string;
    fyiRoot: string;
    k43Root: string;
    k46Root: string;
    k48Root: string;
    nativeRuntime: string;
    database: string;
}

async function inspectRoot(value: string, label: string): Promise<RootIdentity> {
    const path = resolve(value), metadata = await lstat(path);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) throw new Error(`K56 ${label} must be an existing regular non-link directory`);
    const canonical = await realpath(path);
    if (!samePath(path, canonical)) throw new Error(`K56 ${label} symlink or junction rejected`);
    return { path, realPath: canonical, dev: metadata.dev, ino: metadata.ino };
}
function containsPath(parent: string, child: string): boolean {
    const value = relative(parent, child);
    return value === "" || (value !== ".." && !value.startsWith(`..${sep}`) && !isAbsolute(value));
}
async function inspectFile(value: string, label: string): Promise<string> {
    const path = resolve(value), before = await lstat(path);
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1) throw new Error(`K56 ${label} must be a regular single-link non-link file`);
    const canonical = await realpath(path);
    if (!samePath(path, canonical)) throw new Error(`K56 ${label} symlink rejected`);
    return canonical;
}
async function checkpoint(root: RootIdentity): Promise<void> {
    const actual = await inspectRoot(root.path, "output root");
    if (!samePath(root.realPath, actual.realPath) || root.dev !== actual.dev || root.ino !== actual.ino) throw new Error("K56 output root identity changed");
}

export async function validateCharacterLeaderSupportedProjectionOutputRoot(value: string): Promise<void> {
    const root = await inspectRoot(value, "output root");
    await checkpoint(root);
}

export async function validateCharacterLeaderSupportedProjectionRootSeparation(
    options: CharacterLeaderSupportedProjectionSourceOptions & { outputRoot: string },
): Promise<void> {
    const output = await inspectRoot(options.outputRoot, "output root");
    const roots = await Promise.all([
        inspectRoot(options.sidecarRoot, "sidecar source root"), inspectRoot(options.productionRoot, "production source root"),
        inspectRoot(options.fyiRoot, "FYI source root"), inspectRoot(options.k43Root, "K43 source root"),
        inspectRoot(options.k46Root, "K46 source root"), inspectRoot(options.k48Root, "K48 source root"),
    ]);
    for (const source of roots) if (containsPath(source.realPath, output.realPath) || containsPath(output.realPath, source.realPath)
        || source.dev === output.dev && source.ino === output.ino) throw new Error("K56 output root must not alias, contain, or descend from a source root");
    const [native, database] = await Promise.all([inspectFile(options.nativeRuntime, "native runtime"), inspectFile(options.database, "database")]);
    for (const source of [native, database]) if (containsPath(output.realPath, source) || samePath(output.realPath, source)) {
        throw new Error("K56 output root must not contain or alias a source file");
    }
    await checkpoint(output);
}

async function readSnapshot(root: string, fileName: string, maximumBytesExclusive: number, expectedSize?: number): Promise<Snapshot> {
    if (!/^[a-z0-9][a-z0-9.-]+$/.test(fileName) || fileName.includes("..") || fileName.includes("/") || fileName.includes("\\")) throw new Error("K56 member name rejected");
    const canonicalRoot = await inspectRoot(root, "artifact root");
    const path = join(canonicalRoot.path, fileName);
    if (!samePath(path, resolve(canonicalRoot.path, fileName))) throw new Error("K56 member is outside the caller-controlled stable root");
    const before = await lstat(path);
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || before.size >= maximumBytesExclusive
        || (expectedSize !== undefined && before.size !== expectedSize)) throw new Error("K56 member identity or byte budget rejected");
    const handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try {
        const opened = await handle.stat();
        if (!sameFile(before, opened) || !opened.isFile() || opened.nlink !== 1) throw new Error("K56 member changed while opening");
        const bytes = await handle.readFile();
        const after = await handle.stat(), visible = await lstat(path);
        if (!sameFile(opened, after) || !sameFile(opened, visible) || after.nlink !== 1 || visible.nlink !== 1
            || visible.isSymbolicLink() || bytes.length !== opened.size || after.size !== opened.size || visible.size !== opened.size) {
            throw new Error("K56 member changed while reading");
        }
        return { path, bytes, metadata: after };
    } finally { await handle.close(); }
}

export async function loadCharacterLeaderSupportedProductiveSource(productionRoot: string): Promise<CharacterLeaderSupportedProductiveSource & { revalidate(): Promise<void>; dispose(): void }> {
    const pin = CHARACTER_LEADER_SUPPORTED_PROJECTION_PIN;
    const path = await resolveCharacterInputFile(resolve(productionRoot), pin.productiveFileName, pin.productiveFileName);
    const root = resolve(productionRoot);
    if (!samePath(path, join(root, pin.productiveFileName))) throw new Error("K56 productive path is outside the caller-controlled stable root");
    const snapshot = await readSnapshot(root, pin.productiveFileName, pin.productiveSizeBytes + 1, pin.productiveSizeBytes);
    if (hash(snapshot.bytes) !== pin.productiveSha256) throw new Error("K56 productive Character[] identity changed");
    let parsed: any = JSON.parse(snapshot.bytes.toString("utf8"));
    if (!Array.isArray(parsed) || parsed.length !== pin.productiveTopLevelCount) throw new Error("K56 productive Character[] cardinality changed");
    const ids = parsed.map((record: any) => {
        const value = record?.id;
        if ((typeof value !== "string" && typeof value !== "number") || value === "" || typeof value === "number" && !Number.isFinite(value)) throw new Error("K56 productive card ID rejected");
        return String(value);
    });
    if (new Set(ids).size !== ids.length) throw new Error("K56 productive top-level card ID ambiguity");
    const cardIds = new Set(ids);
    parsed.length = 0;
    parsed = undefined;
    snapshot.bytes = Buffer.alloc(0);
    return {
        identity: { fileName: "characters.json", sha256: pin.productiveSha256, sizeBytes: pin.productiveSizeBytes, topLevelCount: pin.productiveTopLevelCount },
        cardIds,
        async revalidate(): Promise<void> {
            const after = await readSnapshot(root, pin.productiveFileName, pin.productiveSizeBytes + 1, pin.productiveSizeBytes);
            if (hash(after.bytes) !== pin.productiveSha256 || !sameFile(snapshot.metadata, after.metadata)) throw new Error("K56 productive Character[] changed during audit");
        },
        dispose(): void { cardIds.clear(); },
    };
}

export async function buildCharacterLeaderSupportedProjectionFromSources(
    options: CharacterLeaderSupportedProjectionSourceOptions,
    upstreamK55: CharacterLeaderLifecycleSemanticsReport,
): Promise<CharacterLeaderSupportedProjectionArtifactSet> {
    let k48 = await validateCharacterLeaderAssociationProjectionArtifact({
        artifactRoot: options.k48Root,
        sidecarRoot: options.sidecarRoot,
        productionRoot: options.productionRoot,
        fyiRoot: options.fyiRoot,
        k43Root: options.k43Root,
        k46Root: options.k46Root,
    });
    let k3Value = await loadPinnedK3LeaderValueSource(options.sidecarRoot);
    let k3Target = await loadPinnedK3LeaderTargetSource(options.sidecarRoot);
    let k3Causality = await loadPinnedK3LeaderCausalitySource(options.sidecarRoot);
    let database = await loadPinnedLeaderCausalityDatabase(options.database);
    let productive = await loadCharacterLeaderSupportedProductiveSource(options.productionRoot);
    const identities = {
        value: k3Value.identity,
        target: k3Target.identity,
        causality: k3Causality.identity,
        database: database.identity,
    };
    const built = buildCharacterLeaderSupportedProjection({
        k48: k48.artifacts,
        k3Value,
        k3Target,
        k3Causality,
        causalityDatabase: database,
        productive,
        upstreamK55,
    });
    await productive.revalidate();
    productive.dispose();
    k48 = undefined as any; k3Value = undefined as any; k3Target = undefined as any; k3Causality = undefined as any; database = undefined as any; productive = undefined as any;
    if (global.gc) global.gc();
    let valueAfter = await loadPinnedK3LeaderValueSource(options.sidecarRoot);
    assertLeaderValueK3Stable(identities.value, valueAfter.identity);
    valueAfter = undefined as any;
    let targetAfter = await loadPinnedK3LeaderTargetSource(options.sidecarRoot);
    assertLeaderTargetK3Stable(identities.target, targetAfter.identity);
    targetAfter = undefined as any;
    let causalityAfter = await loadPinnedK3LeaderCausalitySource(options.sidecarRoot);
    assertLeaderCausalityK3Stable(identities.causality, causalityAfter.identity);
    causalityAfter = undefined as any;
    let databaseAfter = await loadPinnedLeaderCausalityDatabase(options.database);
    assertLeaderCausalityDatabaseStable(identities.database, databaseAfter.identity);
    databaseAfter = undefined as any;
    if (global.gc) global.gc();
    return materializeCharacterLeaderSupportedProjection(built.dataset, built.coverage);
}

function validOutputName(name: string): boolean {
    return name === CHARACTER_LEADER_SUPPORTED_PROJECTION_FILES.coverage
        || name === CHARACTER_LEADER_SUPPORTED_PROJECTION_FILES.validation
        || name === CHARACTER_LEADER_SUPPORTED_PROJECTION_FILES.manifest
        || /^database-characters-k56-leader-supported-projection\.[a-f0-9]{64}\.json\.gz$/.test(name);
}
async function writeCreateOnly(root: RootIdentity, name: string, bytes: Buffer): Promise<void> {
    if (!validOutputName(name)) throw new Error("K56 output member name rejected");
    await checkpoint(root);
    const path = join(root.path, name);
    if (!samePath(path, resolve(root.path, name))) throw new Error("K56 output member is outside the caller-controlled stable root");
    const handle = await open(path, constants.O_CREAT | constants.O_EXCL | constants.O_RDWR | (constants.O_NOFOLLOW ?? 0), 0o600);
    try {
        await handle.writeFile(bytes);
        await handle.sync();
        const opened = await handle.stat(), visible = await lstat(path);
        if (!opened.isFile() || opened.nlink !== 1 || opened.size !== bytes.length || !sameFile(opened, visible)
            || visible.isSymbolicLink() || visible.nlink !== 1) throw new Error("K56 create-only member identity rejected");
    } finally { await handle.close(); }
    await checkpoint(root);
}

export async function writeCharacterLeaderSupportedProjectionArtifacts(
    outputRoot: string,
    artifacts: CharacterLeaderSupportedProjectionArtifactSet,
): Promise<void> {
    const canonical = materializeCharacterLeaderSupportedProjection(artifacts.dataset, artifacts.coverage);
    if (!canonical.raw.equals(artifacts.raw) || !canonical.gzip.equals(artifacts.gzip)
        || !canonical.coverageBytes.equals(artifacts.coverageBytes) || !canonical.validationBytes.equals(artifacts.validationBytes)
        || !canonical.manifestBytes.equals(artifacts.manifestBytes)) throw new Error("K56 output artifact set is not canonical");
    const root = await inspectRoot(outputRoot, "output root");
    const files = [
        { name: artifacts.manifest.fileName, bytes: artifacts.gzip },
        { name: CHARACTER_LEADER_SUPPORTED_PROJECTION_FILES.coverage, bytes: artifacts.coverageBytes },
        { name: CHARACTER_LEADER_SUPPORTED_PROJECTION_FILES.validation, bytes: artifacts.validationBytes },
        { name: CHARACTER_LEADER_SUPPORTED_PROJECTION_FILES.manifest, bytes: artifacts.manifestBytes },
    ];
    for (const file of files) {
        try { await lstat(join(root.path, file.name)); throw new Error(`K56 output already exists: ${file.name}`); }
        catch (error: any) { if (error?.code !== "ENOENT") throw error; }
    }
    for (const file of files) await writeCreateOnly(root, file.name, file.bytes);
}

async function readArtifactSet(root: string): Promise<CharacterLeaderSupportedProjectionArtifactSet> {
    const manifestSnapshot = await readSnapshot(root, CHARACTER_LEADER_SUPPORTED_PROJECTION_FILES.manifest, CHARACTER_LEADER_SUPPORTED_PROJECTION_METADATA_LIMIT_BYTES);
    const manifest = JSON.parse(manifestSnapshot.bytes.toString("utf8")) as CharacterLeaderSupportedProjectionManifest;
    if (!/^database-characters-k56-leader-supported-projection\.[a-f0-9]{64}\.json\.gz$/.test(manifest.fileName)
        || manifest.fileName.split(".")[1] !== manifest.sha256 || manifest.coverageFile !== CHARACTER_LEADER_SUPPORTED_PROJECTION_FILES.coverage
        || manifest.validationFile !== CHARACTER_LEADER_SUPPORTED_PROJECTION_FILES.validation
        || manifest.outputNamespaceThreatModel !== "caller_controlled_stable_during_operation"
        || manifest.concurrentSameUserAncestorReplacementProtected !== false
        || manifest.sizeBytes >= CHARACTER_LEADER_SUPPORTED_PROJECTION_GZIP_LIMIT_BYTES
        || manifest.uncompressedSizeBytes >= CHARACTER_LEADER_SUPPORTED_PROJECTION_RAW_LIMIT_BYTES
        || manifest.coverageSizeBytes + manifest.validationSizeBytes + manifestSnapshot.bytes.length >= CHARACTER_LEADER_SUPPORTED_PROJECTION_METADATA_LIMIT_BYTES) {
        throw new Error("K56 manifest identity or budget rejected");
    }
    const [payload, coverageSnapshot, validationSnapshot] = await Promise.all([
        readSnapshot(root, manifest.fileName, CHARACTER_LEADER_SUPPORTED_PROJECTION_GZIP_LIMIT_BYTES, manifest.sizeBytes),
        readSnapshot(root, manifest.coverageFile, CHARACTER_LEADER_SUPPORTED_PROJECTION_METADATA_LIMIT_BYTES, manifest.coverageSizeBytes),
        readSnapshot(root, manifest.validationFile, CHARACTER_LEADER_SUPPORTED_PROJECTION_METADATA_LIMIT_BYTES, manifest.validationSizeBytes),
    ]);
    if (hash(payload.bytes) !== manifest.sha256 || hash(coverageSnapshot.bytes) !== manifest.coverageSha256
        || hash(validationSnapshot.bytes) !== manifest.validationSha256) throw new Error("K56 artifact hash rejected");
    const raw = gunzipSync(payload.bytes, { maxOutputLength: CHARACTER_LEADER_SUPPORTED_PROJECTION_RAW_LIMIT_BYTES });
    if (raw.length !== manifest.uncompressedSizeBytes || hash(raw) !== manifest.uncompressedSha256
        || !payload.bytes.equals(gzipSync(raw, { level: 9 }))) throw new Error("K56 canonical payload rejected");
    const dataset = JSON.parse(raw.toString("utf8"));
    const coverage = JSON.parse(coverageSnapshot.bytes.toString("utf8"));
    const validation = JSON.parse(validationSnapshot.bytes.toString("utf8"));
    const rebuilt = materializeCharacterLeaderSupportedProjection(dataset, coverage);
    if (!rebuilt.raw.equals(raw) || !rebuilt.gzip.equals(payload.bytes) || !rebuilt.coverageBytes.equals(coverageSnapshot.bytes)
        || !rebuilt.validationBytes.equals(validationSnapshot.bytes) || !rebuilt.manifestBytes.equals(manifestSnapshot.bytes)
        || JSON.stringify(rebuilt.validation) !== JSON.stringify(validation)) throw new Error("K56 artifact reconstruction rejected");
    return rebuilt;
}

export async function validateCharacterLeaderSupportedProjectionArtifact(
    options: CharacterLeaderSupportedProjectionSourceOptions & { artifactRoot: string },
): Promise<{ artifacts: CharacterLeaderSupportedProjectionArtifactSet; sourceBoundValidation: "GO" }> {
    const upstreamK55 = await runCharacterLeaderLifecycleSemanticsAudit({
        optIn: true,
        sidecarRoot: options.sidecarRoot,
        productionRoot: options.productionRoot,
        fyiRoot: options.fyiRoot,
        k43Root: options.k43Root,
        k46Root: options.k46Root,
        k48Root: options.k48Root,
        nativeRuntime: options.nativeRuntime,
        database: options.database,
    });
    let expected = await buildCharacterLeaderSupportedProjectionFromSources(options, upstreamK55);
    let actual = await readArtifactSet(options.artifactRoot);
    assertCharacterLeaderSupportedProjectionArtifactBytes(actual, expected);
    const reread = await readArtifactSet(options.artifactRoot);
    if (!actual.gzip.equals(reread.gzip) || !actual.coverageBytes.equals(reread.coverageBytes)
        || !actual.validationBytes.equals(reread.validationBytes) || !actual.manifestBytes.equals(reread.manifestBytes)) {
        throw new Error("K56 artifacts changed during source-bound validation");
    }
    expected = undefined as any; actual = undefined as any;
    if (global.gc) global.gc();
    return { artifacts: reread, sourceBoundValidation: "GO" };
}

export function assertCharacterLeaderSupportedProjectionArtifactBytes(
    actual: CharacterLeaderSupportedProjectionArtifactSet,
    expected: CharacterLeaderSupportedProjectionArtifactSet,
): void {
    for (const [label, actualBytes, expectedBytes] of [
        ["payload", actual.gzip, expected.gzip], ["coverage", actual.coverageBytes, expected.coverageBytes],
        ["validation", actual.validationBytes, expected.validationBytes], ["manifest", actual.manifestBytes, expected.manifestBytes],
    ] as Array<[string, Buffer, Buffer]>) if (!actualBytes.equals(expectedBytes)) throw new Error(`K56 source-bound artifact mismatch: ${label}`);
}
