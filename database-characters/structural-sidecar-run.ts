import { constants, Stats } from "fs";
import { createHash, randomBytes } from "crypto";
import { link as createLink, lstat, mkdir, open, realpath, rmdir, unlink } from "fs/promises";
import { join, resolve } from "path";
import { resolveDatabaseCharacterArtifactPath } from "./artifact-path";
import { buildCharacterStructuralSidecar } from "./structural-sidecar-builder";
import {
    CHARACTER_STRUCTURAL_SIDECAR_FILES,
    CharacterStructuralSidecarCoverage,
    CharacterStructuralSidecarManifest,
    CharacterStructuralSidecarValidation,
} from "./structural-sidecar-contract";
import {
    loadCharacterStructuralSidecarSource,
    CharacterStructuralSidecarGenerationSource,
    CharacterStructuralSidecarSourceOptions,
} from "./structural-sidecar-source";
import {
    CharacterStructuralSidecarArtifactSet,
    materializeCharacterStructuralSidecar,
    validateCharacterStructuralSidecarArtifact,
} from "./structural-sidecar-validator";

const RSS_LIMIT_BYTES = 1_073_741_824;

interface OutputIdentity { path: string; realPath: string; dev: number; ino: number }
export interface CharacterStructuralSidecarRunOptions extends CharacterStructuralSidecarSourceOptions {
    outputRoot: string;
    optIn: true;
}

export interface CharacterStructuralSidecarRunResult {
    outputRoot: string;
    manifest: CharacterStructuralSidecarManifest;
    manifestSha256: string;
    manifestSizeBytes: number;
    coverage: CharacterStructuralSidecarCoverage;
    validation: CharacterStructuralSidecarValidation;
    sourceBoundArtifactValidation: "GO";
    twoGenerationByteIdentical: true;
    peakRssBytes: number;
}

const hash = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");
const samePath = (left: string, right: string): boolean => process.platform === "win32"
    ? resolve(left).toLowerCase() === resolve(right).toLowerCase()
    : resolve(left) === resolve(right);

async function inspectOutputRoot(value: string): Promise<OutputIdentity> {
    const path = resolve(value);
    const metadata = await lstat(path);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) throw new Error("K32 output root must be an existing regular non-link directory");
    const canonical = await realpath(path);
    if (!samePath(path, canonical)) throw new Error("K32 output root symlink or junction rejected");
    return { path, realPath: canonical, dev: metadata.dev, ino: metadata.ino };
}

async function checkpoint(expected: OutputIdentity): Promise<void> {
    const actual = await inspectOutputRoot(expected.path);
    if (!samePath(actual.realPath, expected.realPath) || actual.dev !== expected.dev || actual.ino !== expected.ino) throw new Error("K32 output root identity changed");
}

export async function validateCharacterStructuralOutputRoot(value: string): Promise<void> {
    const identity = await inspectOutputRoot(value);
    await checkpoint(identity);
}

async function createStagedFile(path: string, bytes: Buffer): Promise<void> {
    const handle = await open(path, constants.O_CREAT | constants.O_EXCL | constants.O_RDWR | (constants.O_NOFOLLOW ?? 0), 0o600);
    try {
        await handle.writeFile(bytes);
        await handle.sync();
        const metadata = await handle.stat();
        if (!metadata.isFile() || metadata.nlink !== 1 || metadata.size !== bytes.length) throw new Error("K32 staged output identity rejected");
    } finally { await handle.close(); }
}

async function readKnownOutputFile(path: string, allowedLinkCounts: number[]): Promise<Buffer> {
    const before = await lstat(path);
    if (!before.isFile() || before.isSymbolicLink() || !allowedLinkCounts.includes(before.nlink)) throw new Error("K32 cleanup target is not a known regular file");
    const handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try {
        const opened = await handle.stat();
        if (opened.dev !== before.dev || opened.ino !== before.ino || !allowedLinkCounts.includes(opened.nlink)) throw new Error("K32 cleanup target identity changed");
        return await handle.readFile();
    } finally { await handle.close(); }
}

async function safelyCleanStaging(staged: OutputIdentity, fileNames: string[], outputRoot: OutputIdentity): Promise<boolean> {
    try {
        await checkpoint(outputRoot);
        const actual = await inspectOutputRoot(staged.path);
        if (actual.dev !== staged.dev || actual.ino !== staged.ino || !samePath(actual.realPath, staged.realPath)) return false;
        for (const fileName of fileNames) {
            const path = join(staged.path, fileName);
            try {
                const metadata = await lstat(path);
                if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.nlink !== 1) return false;
                await unlink(path);
            } catch (error: any) {
                if (error?.code !== "ENOENT") return false;
            }
        }
        await rmdir(staged.path);
        await checkpoint(outputRoot);
        return true;
    } catch { return false; }
}

async function safelyRemovePromoted(path: string, bytes: Buffer, outputRoot: OutputIdentity): Promise<boolean> {
    try {
        await checkpoint(outputRoot);
        if (!samePath(path, join(outputRoot.path, path.split(/[\\/]/).pop()!))) return false;
        if (!(await readKnownOutputFile(path, [1, 2])).equals(bytes)) return false;
        await unlink(path);
        await checkpoint(outputRoot);
        return true;
    } catch { return false; }
}

async function assertTargetMissing(root: OutputIdentity, fileName: string): Promise<string> {
    const path = await resolveDatabaseCharacterArtifactPath({
        trustedRoot: root.path, untrustedPath: fileName, expectedType: "file", exactName: fileName, allowMissing: true,
    });
    if (!samePath(path, join(root.path, fileName))) throw new Error(`K32 output path escaped root: ${fileName}`);
    try { await lstat(path); throw new Error(`K32 output already exists: ${fileName}`); }
    catch (error: any) { if (error?.code !== "ENOENT") throw error; }
    return path;
}

export async function writeCharacterStructuralSidecarArtifacts(outputRootValue: string, artifacts: CharacterStructuralSidecarArtifactSet): Promise<string> {
    const outputRoot = await inspectOutputRoot(outputRootValue);
    const files = [
        { name: CHARACTER_STRUCTURAL_SIDECAR_FILES.payload, bytes: artifacts.gzip },
        { name: CHARACTER_STRUCTURAL_SIDECAR_FILES.coverage, bytes: artifacts.coverageBytes },
        { name: CHARACTER_STRUCTURAL_SIDECAR_FILES.validation, bytes: artifacts.validationBytes },
        { name: CHARACTER_STRUCTURAL_SIDECAR_FILES.manifest, bytes: artifacts.manifestBytes },
    ];
    const targets = new Map<string, string>();
    for (const file of files) targets.set(file.name, await assertTargetMissing(outputRoot, file.name));
    const stagingPath = join(outputRoot.path, `.k32-staging-${process.pid}-${randomBytes(16).toString("hex")}`);
    await checkpoint(outputRoot);
    await mkdir(stagingPath, { mode: 0o700 });
    const staged = await inspectOutputRoot(stagingPath);
    const promoted: Array<{ path: string; bytes: Buffer }> = [];
    try {
        for (const file of files) {
            await checkpoint(outputRoot);
            await createStagedFile(join(staged.path, file.name), file.bytes);
        }
        for (const file of files) {
            await checkpoint(outputRoot);
            await assertTargetMissing(outputRoot, file.name);
            const target = targets.get(file.name)!;
            const stagedPath = join(staged.path, file.name);
            await createLink(stagedPath, target);
            promoted.push({ path: target, bytes: file.bytes });
            const linked = await lstat(target);
            if (!linked.isFile() || linked.isSymbolicLink() || linked.nlink !== 2 || linked.size !== file.bytes.length) throw new Error(`K32 linked output rejected: ${file.name}`);
            await unlink(stagedPath);
            const promotedMetadata = await lstat(target);
            if (!promotedMetadata.isFile() || promotedMetadata.isSymbolicLink() || promotedMetadata.nlink !== 1 || promotedMetadata.size !== file.bytes.length) throw new Error(`K32 promoted output rejected: ${file.name}`);
        }
        if (!await safelyCleanStaging(staged, files.map(file => file.name), outputRoot)) throw new Error("K32 staging cleanup could not be proved safe");
        await checkpoint(outputRoot);
        return outputRoot.path;
    } catch (error) {
        for (const item of promoted.reverse()) await safelyRemovePromoted(item.path, item.bytes, outputRoot);
        await safelyCleanStaging(staged, files.map(file => file.name), outputRoot);
        throw error;
    }
}

function sameArtifacts(left: CharacterStructuralSidecarArtifactSet, right: CharacterStructuralSidecarArtifactSet): boolean {
    return left.raw.equals(right.raw) && left.gzip.equals(right.gzip) && left.coverageBytes.equals(right.coverageBytes)
        && left.validationBytes.equals(right.validationBytes) && left.manifestBytes.equals(right.manifestBytes);
}

export async function runCharacterStructuralSidecar(options: CharacterStructuralSidecarRunOptions): Promise<CharacterStructuralSidecarRunResult> {
    if (options?.optIn !== true) throw new Error("K32 requires explicit opt-in");
    let peakRssBytes = process.memoryUsage().rss;
    const monitor = setInterval(() => { peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss); }, 25);
    const sample = (): void => {
        peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss);
        if (peakRssBytes >= RSS_LIMIT_BYTES) throw new Error(`K32 RSS budget exceeded: ${peakRssBytes}`);
    };
    try {
        await validateCharacterStructuralOutputRoot(options.outputRoot);
        let source: CharacterStructuralSidecarGenerationSource | undefined = await loadCharacterStructuralSidecarSource(options);
        sample();
        const build = (): CharacterStructuralSidecarArtifactSet => {
            if (!source) throw new Error("K32 generation source was released");
            const { sidecar, coverage } = buildCharacterStructuralSidecar(source.taxonomy, source.productive, source.lineage);
            const result = materializeCharacterStructuralSidecar(sidecar, coverage);
            sample();
            return result;
        };
        let first: CharacterStructuralSidecarArtifactSet | undefined = build();
        await source.revalidate(); sample();
        const firstIdentity = { manifest: Buffer.from(first.manifestBytes), payload: Buffer.from(first.gzip) };
        if (global.gc) global.gc();
        let second: CharacterStructuralSidecarArtifactSet | undefined = build();
        await source.revalidate(); sample();
        if (!firstIdentity.manifest.equals(second.manifestBytes) || !firstIdentity.payload.equals(second.gzip) || !sameArtifacts(first, second)) {
            throw new Error("K32 two-generation byte identity failed");
        }
        first = undefined;
        const outputRoot = await writeCharacterStructuralSidecarArtifacts(options.outputRoot, second);
        await source.revalidate(); sample();
        second = undefined;
        source = undefined;
        if (global.gc) global.gc();
        const validated = await validateCharacterStructuralSidecarArtifact({
            artifactRoot: outputRoot,
            k2Root: options.k2Root,
            productiveRoot: options.productiveRoot,
        });
        sample();
        return {
            outputRoot,
            manifest: validated.manifest,
            manifestSha256: hash(Buffer.from(`${JSON.stringify(validated.manifest, null, 2)}\n`, "utf8")),
            manifestSizeBytes: Buffer.byteLength(`${JSON.stringify(validated.manifest, null, 2)}\n`, "utf8"),
            coverage: validated.coverage,
            validation: validated.validation,
            sourceBoundArtifactValidation: validated.sourceBoundValidation.status,
            twoGenerationByteIdentical: true,
            peakRssBytes,
        };
    } finally {
        clearInterval(monitor);
    }
}

function argumentValue(args: string[], name: string): string | undefined {
    const indexes = args.flatMap((value, index) => value === name ? [index] : []);
    if (indexes.length > 1) throw new Error(`duplicate ${name}`);
    if (!indexes.length) return undefined;
    const value = args[indexes[0] + 1];
    if (!value || value.startsWith("--")) throw new Error(`missing value for ${name}`);
    return value;
}

function required(args: string[], name: string): string {
    const value = argumentValue(args, name);
    if (!value) throw new Error(`K32 requires ${name}`);
    return value;
}

export function parseCharacterStructuralSidecarCli(args: string[]): CharacterStructuralSidecarRunOptions {
    const allowed = new Set(["--opt-in-k32", "--k2-root", "--productive-root", "--output-root"]);
    for (let index = 0; index < args.length; index++) {
        const argument = args[index];
        if (!allowed.has(argument)) throw new Error(`K32 unsupported argument ${argument}`);
        if (argument !== "--opt-in-k32") {
            const value = args[index + 1];
            if (!value || value.startsWith("--")) throw new Error(`missing value for ${argument}`);
            index++;
        }
    }
    if (args.filter(value => value === "--opt-in-k32").length !== 1) throw new Error("K32 requires one explicit --opt-in-k32");
    return {
        optIn: true,
        k2Root: required(args, "--k2-root"),
        productiveRoot: required(args, "--productive-root"),
        outputRoot: required(args, "--output-root"),
    };
}

async function run(): Promise<void> {
    const result = await runCharacterStructuralSidecar(parseCharacterStructuralSidecarCli(process.argv.slice(2)));
    console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) run().catch(error => { console.error(error); process.exitCode = 1; });
