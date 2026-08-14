import { constants, Stats } from "fs";
import { createHash, randomBytes } from "crypto";
import { link as createLink, lstat, mkdir, open, realpath, rmdir, unlink } from "fs/promises";
import { join, resolve } from "path";
import { runCardScopeAudit } from "./card-scope-run";
import { validateCharacterStructuralSidecarArtifact } from "./structural-sidecar-validator";
import { buildTaxonomyProjection, TaxonomyProjectionValidatedSources } from "./taxonomy-projection-builder";
import {
    TAXONOMY_PROJECTION_FILES,
    TAXONOMY_PROJECTION_RSS_LIMIT_BYTES,
    TaxonomyProjectionCoverage,
    TaxonomyProjectionManifest,
    TaxonomyProjectionValidation,
} from "./taxonomy-projection-contract";
import {
    TaxonomyProjectionArtifactSet,
    TaxonomyProjectionSourceBoundValidationOptions,
    materializeTaxonomyProjection,
    validateTaxonomyProjectionArtifact,
} from "./taxonomy-projection-validator";

export interface TaxonomyProjectionRunOptions extends Omit<TaxonomyProjectionSourceBoundValidationOptions, "artifactRoot"> {
    outputRoot: string;
    optIn: true;
}

export interface TaxonomyProjectionRunResult {
    outputRoot: string;
    manifest: TaxonomyProjectionManifest;
    manifestSha256: string;
    manifestSizeBytes: number;
    payloadSha256: string;
    payloadSizeBytes: number;
    rawSha256: string;
    rawSizeBytes: number;
    coverageSha256: string;
    coverageSizeBytes: number;
    validationSha256: string;
    validationSizeBytes: number;
    coverage: TaxonomyProjectionCoverage;
    validation: TaxonomyProjectionValidation;
    sourceBoundArtifactValidation: "GO";
    k32ValidatedBeforeAndAfter: true;
    k34RevalidatedInProcessBeforeAndAfter: true;
    twoGenerationByteIdentical: true;
    peakRssBytes: number;
}

interface OutputIdentity { path: string; realPath: string; dev: number; ino: number }

const hash = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");
const samePath = (left: string, right: string): boolean => process.platform === "win32"
    ? resolve(left).toLowerCase() === resolve(right).toLowerCase()
    : resolve(left) === resolve(right);

class RssGuard {
    private peak = process.memoryUsage().rss;
    private exceeded = false;
    private readonly timer = setInterval(() => this.observe(), 10);
    constructor() { this.timer.unref(); }
    private observe(): void {
        this.peak = Math.max(this.peak, process.memoryUsage().rss);
        this.exceeded ||= this.peak >= TAXONOMY_PROJECTION_RSS_LIMIT_BYTES;
    }
    sample(nestedPeak = 0): void {
        this.observe();
        this.peak = Math.max(this.peak, nestedPeak);
        this.exceeded ||= this.peak >= TAXONOMY_PROJECTION_RSS_LIMIT_BYTES;
        if (this.exceeded) throw new Error(`K35 RSS limit reached: ${this.peak}`);
    }
    stop(): number { clearInterval(this.timer); this.sample(); return this.peak; }
    dispose(): void { clearInterval(this.timer); }
}

async function inspectOutputRoot(value: string): Promise<OutputIdentity> {
    const path = resolve(value);
    const metadata = await lstat(path);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) throw new Error("K35 output root must be an existing regular non-link directory");
    const canonical = await realpath(path);
    if (!samePath(path, canonical)) throw new Error("K35 output root symlink or junction rejected");
    return { path, realPath: canonical, dev: metadata.dev, ino: metadata.ino };
}

async function checkpoint(expected: OutputIdentity): Promise<void> {
    const actual = await inspectOutputRoot(expected.path);
    if (!samePath(actual.realPath, expected.realPath) || actual.dev !== expected.dev || actual.ino !== expected.ino) {
        throw new Error("K35 output root identity changed");
    }
}

export async function validateTaxonomyProjectionOutputRoot(value: string): Promise<void> {
    const root = await inspectOutputRoot(value);
    await checkpoint(root);
}

function validOutputName(fileName: string): boolean {
    return fileName === TAXONOMY_PROJECTION_FILES.manifest || fileName === TAXONOMY_PROJECTION_FILES.coverage
        || fileName === TAXONOMY_PROJECTION_FILES.validation
        || /^database-characters-k35-taxonomy-projection\.[a-f0-9]{64}\.json\.gz$/.test(fileName);
}

async function targetMissing(root: OutputIdentity, fileName: string): Promise<string> {
    if (!validOutputName(fileName)) throw new Error(`K35 output name rejected: ${fileName}`);
    const path = join(root.path, fileName);
    if (!samePath(path, resolve(root.path, fileName))) throw new Error(`K35 output path escaped root: ${fileName}`);
    try {
        await lstat(path);
        throw new Error(`K35 output already exists: ${fileName}`);
    } catch (error: any) {
        if (error?.code !== "ENOENT") throw error;
    }
    return path;
}

async function createStagedFile(path: string, bytes: Buffer): Promise<void> {
    const handle = await open(path, constants.O_CREAT | constants.O_EXCL | constants.O_RDWR | (constants.O_NOFOLLOW ?? 0), 0o600);
    try {
        await handle.writeFile(bytes);
        await handle.sync();
        const metadata = await handle.stat();
        if (!metadata.isFile() || metadata.nlink !== 1 || metadata.size !== bytes.length) throw new Error("K35 staged output identity rejected");
    } finally { await handle.close(); }
}

async function readKnownFile(path: string, allowedLinkCounts: number[]): Promise<Buffer> {
    const before = await lstat(path);
    if (!before.isFile() || before.isSymbolicLink() || !allowedLinkCounts.includes(before.nlink)) throw new Error("K35 cleanup target rejected");
    const handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try {
        const opened = await handle.stat();
        if (opened.dev !== before.dev || opened.ino !== before.ino || !allowedLinkCounts.includes(opened.nlink)) {
            throw new Error("K35 cleanup target identity changed");
        }
        return await handle.readFile();
    } finally { await handle.close(); }
}

async function safelyCleanStaging(staged: OutputIdentity, names: string[], root: OutputIdentity): Promise<boolean> {
    try {
        await checkpoint(root);
        const actual = await inspectOutputRoot(staged.path);
        if (actual.dev !== staged.dev || actual.ino !== staged.ino || !samePath(actual.realPath, staged.realPath)) return false;
        for (const name of names) {
            try {
                const path = join(staged.path, name);
                const metadata = await lstat(path);
                if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.nlink !== 1) return false;
                await unlink(path);
            } catch (error: any) {
                if (error?.code !== "ENOENT") return false;
            }
        }
        await rmdir(staged.path);
        await checkpoint(root);
        return true;
    } catch { return false; }
}

async function safelyRemovePromoted(path: string, bytes: Buffer, root: OutputIdentity): Promise<boolean> {
    try {
        await checkpoint(root);
        if (!samePath(path, join(root.path, path.split(/[\\/]/).pop()!))) return false;
        if (!(await readKnownFile(path, [1, 2])).equals(bytes)) return false;
        await unlink(path);
        await checkpoint(root);
        return true;
    } catch { return false; }
}

export async function writeTaxonomyProjectionArtifacts(outputRootValue: string, artifacts: TaxonomyProjectionArtifactSet): Promise<string> {
    const authorized = materializeTaxonomyProjection(artifacts.projection, artifacts.coverage);
    if (!sameArtifacts(artifacts, authorized)) throw new Error("K35 output requires the exact pinned artifact set");
    const root = await inspectOutputRoot(outputRootValue);
    const files = [
        { name: artifacts.manifest.fileName, bytes: artifacts.gzip },
        { name: TAXONOMY_PROJECTION_FILES.coverage, bytes: artifacts.coverageBytes },
        { name: TAXONOMY_PROJECTION_FILES.validation, bytes: artifacts.validationBytes },
        { name: TAXONOMY_PROJECTION_FILES.manifest, bytes: artifacts.manifestBytes },
    ];
    const targets = new Map<string, string>();
    for (const file of files) targets.set(file.name, await targetMissing(root, file.name));
    const stagingPath = join(root.path, `.k35-staging-${process.pid}-${randomBytes(16).toString("hex")}`);
    await checkpoint(root);
    await mkdir(stagingPath, { mode: 0o700 });
    const staged = await inspectOutputRoot(stagingPath);
    const promoted: Array<{ path: string; bytes: Buffer }> = [];
    try {
        for (const file of files) {
            await checkpoint(root);
            await createStagedFile(join(staged.path, file.name), file.bytes);
        }
        for (const file of files) {
            await checkpoint(root);
            await targetMissing(root, file.name);
            const stagedPath = join(staged.path, file.name);
            const target = targets.get(file.name)!;
            await createLink(stagedPath, target);
            promoted.push({ path: target, bytes: file.bytes });
            const linked = await lstat(target);
            if (!linked.isFile() || linked.isSymbolicLink() || linked.nlink !== 2 || linked.size !== file.bytes.length) {
                throw new Error(`K35 linked output rejected: ${file.name}`);
            }
            await unlink(stagedPath);
            const final = await lstat(target);
            if (!final.isFile() || final.isSymbolicLink() || final.nlink !== 1 || final.size !== file.bytes.length) {
                throw new Error(`K35 promoted output rejected: ${file.name}`);
            }
        }
        if (!await safelyCleanStaging(staged, files.map(file => file.name), root)) throw new Error("K35 staging cleanup could not be proved safe");
        await checkpoint(root);
        return root.path;
    } catch (error) {
        for (const item of promoted.reverse()) await safelyRemovePromoted(item.path, item.bytes, root);
        await safelyCleanStaging(staged, files.map(file => file.name), root);
        throw error;
    }
}

function sameArtifacts(left: TaxonomyProjectionArtifactSet, right: TaxonomyProjectionArtifactSet): boolean {
    return left.raw.equals(right.raw) && left.gzip.equals(right.gzip) && left.coverageBytes.equals(right.coverageBytes)
        && left.validationBytes.equals(right.validationBytes) && left.manifestBytes.equals(right.manifestBytes);
}

export async function runTaxonomyProjection(options: TaxonomyProjectionRunOptions): Promise<TaxonomyProjectionRunResult> {
    if (options?.optIn !== true) throw new Error("K35 requires explicit opt-in");
    if (!options.outputRoot || !options.k32Root || !options.k2Root || !options.productiveRoot || !options.sqliteRoot
        || !options.db1Root || !options.elfRoot || !options.nativeEvidenceRoot) {
        throw new Error("K35 requires explicit output, K32, K2, productive, SQLite, DB1, ELF and native-evidence roots");
    }
    const rss = new RssGuard();
    try {
        await validateTaxonomyProjectionOutputRoot(options.outputRoot);
        const k32Before = await validateCharacterStructuralSidecarArtifact({
            artifactRoot: options.k32Root,
            k2Root: options.k2Root,
            productiveRoot: options.productiveRoot,
        });
        rss.sample();
        const k34Before = await runCardScopeAudit({
            optIn: true,
            sqliteRoot: options.sqliteRoot,
            db1Root: options.db1Root,
            k2Root: options.k2Root,
            elfRoot: options.elfRoot,
            nativeEvidenceRoot: options.nativeEvidenceRoot,
        });
        rss.sample(k34Before.peakRssBytes);
        const sources: TaxonomyProjectionValidatedSources = {
            k32: k32Before,
            k34Report: JSON.parse(k34Before.stdout),
            k34Stdout: k34Before.stdout,
        };
        const generate = (): TaxonomyProjectionArtifactSet => {
            const built = buildTaxonomyProjection(sources);
            const artifacts = materializeTaxonomyProjection(built.projection, built.coverage);
            rss.sample();
            return artifacts;
        };
        let first: TaxonomyProjectionArtifactSet | undefined = generate();
        if (global.gc) global.gc();
        const second = generate();
        if (!sameArtifacts(first, second)) throw new Error("K35 two-generation byte identity failed");
        first = undefined;
        if (global.gc) global.gc();
        const outputRoot = await writeTaxonomyProjectionArtifacts(options.outputRoot, second);
        rss.sample();
        const validated = await validateTaxonomyProjectionArtifact({
            artifactRoot: outputRoot,
            k32Root: options.k32Root,
            k2Root: options.k2Root,
            productiveRoot: options.productiveRoot,
            sqliteRoot: options.sqliteRoot,
            db1Root: options.db1Root,
            elfRoot: options.elfRoot,
            nativeEvidenceRoot: options.nativeEvidenceRoot,
        });
        rss.sample(validated.peakNestedRssBytes);
        const artifacts = validated.artifacts;
        const peakRssBytes = rss.stop();
        return {
            outputRoot,
            manifest: artifacts.manifest,
            manifestSha256: hash(artifacts.manifestBytes),
            manifestSizeBytes: artifacts.manifestBytes.length,
            payloadSha256: artifacts.manifest.sha256,
            payloadSizeBytes: artifacts.manifest.sizeBytes,
            rawSha256: artifacts.manifest.uncompressedSha256,
            rawSizeBytes: artifacts.manifest.uncompressedSizeBytes,
            coverageSha256: artifacts.manifest.coverageSha256,
            coverageSizeBytes: artifacts.manifest.coverageSizeBytes,
            validationSha256: artifacts.manifest.validationSha256,
            validationSizeBytes: artifacts.manifest.validationSizeBytes,
            coverage: artifacts.coverage,
            validation: artifacts.validation,
            sourceBoundArtifactValidation: validated.sourceBoundValidation.status,
            k32ValidatedBeforeAndAfter: true,
            k34RevalidatedInProcessBeforeAndAfter: true,
            twoGenerationByteIdentical: true,
            peakRssBytes,
        };
    } finally { rss.dispose(); }
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
    if (!value) throw new Error(`K35 requires ${name}`);
    return value;
}

export function parseTaxonomyProjectionCli(args: string[]): TaxonomyProjectionRunOptions {
    const roots = ["--k32-root", "--k2-root", "--productive-root", "--sqlite-root", "--db1-root", "--elf-root", "--native-evidence-root", "--output-root"];
    const allowed = new Set(["--opt-in-k35", ...roots]);
    for (let index = 0; index < args.length; index++) {
        const argument = args[index];
        if (!allowed.has(argument)) throw new Error(`K35 unsupported argument ${argument}`);
        if (argument !== "--opt-in-k35") {
            const value = args[index + 1];
            if (!value || value.startsWith("--")) throw new Error(`missing value for ${argument}`);
            index++;
        }
    }
    if (args.filter(value => value === "--opt-in-k35").length !== 1) throw new Error("K35 requires exactly one --opt-in-k35");
    return {
        optIn: true,
        k32Root: required(args, "--k32-root"),
        k2Root: required(args, "--k2-root"),
        productiveRoot: required(args, "--productive-root"),
        sqliteRoot: required(args, "--sqlite-root"),
        db1Root: required(args, "--db1-root"),
        elfRoot: required(args, "--elf-root"),
        nativeEvidenceRoot: required(args, "--native-evidence-root"),
        outputRoot: required(args, "--output-root"),
    };
}

async function run(): Promise<void> {
    const result = await runTaxonomyProjection(parseTaxonomyProjectionCli(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.stderr.write(`K35 peak RSS bytes: ${result.peakRssBytes}\n`);
}

if (require.main === module) run().catch(error => { console.error(error); process.exitCode = 1; });
