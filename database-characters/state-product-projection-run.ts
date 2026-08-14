import { constants, Stats } from "fs";
import { createHash } from "crypto";
import { lstat, open, realpath, unlink } from "fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "path";
import { loadCharacterShadowInputs } from "./shadow-source";
import { fingerprintCharacterStateProductScopeInputs } from "./state-product-scope";
import { runCharacterStateProductScopeAudit } from "./state-product-scope-run";
import {
    CHARACTER_STATE_PRODUCT_PROJECTION_FILES,
    CHARACTER_STATE_PRODUCT_PROJECTION_RSS_LIMIT_BYTES,
    CharacterStateProductProjectionArtifactSet,
    CharacterStateProductProjectionCoverage,
    CharacterStateProductProjectionManifest,
    CharacterStateProductProjectionValidation,
} from "./state-product-projection-contract";
import {
    buildCharacterStateProductProjection,
    materializeCharacterStateProductProjection,
    validateCharacterStateProductProjectionArtifact,
} from "./state-product-projection";

export interface CharacterStateProductProjectionRunOptions {
    optIn: true;
    sidecarRoot: string;
    productionRoot: string;
    fyiRoot: string;
    outputRoot: string;
}

export interface CharacterStateProductProjectionRunResult {
    outputRoot: string;
    manifest: CharacterStateProductProjectionManifest;
    coverage: CharacterStateProductProjectionCoverage;
    validation: CharacterStateProductProjectionValidation;
    manifestSha256: string;
    manifestSizeBytes: number;
    twoMaterializationsByteIdentical: true;
    sourcesReloadedAfterBuild: true;
    sourceBoundValidation: "GO";
    peakRssBytes: number;
}

interface RootIdentity { path: string; realPath: string; dev: number; ino: number }
interface WrittenArtifactSet {
    outputRoot: string;
    root: RootIdentity;
    members: Array<{ path: string; sizeBytes: number; sha256: string }>;
}
const hash = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");
const samePath = (left: string, right: string): boolean => process.platform === "win32"
    ? resolve(left).toLowerCase() === resolve(right).toLowerCase() : resolve(left) === resolve(right);
const sameFile = (left: Stats, right: Stats): boolean => left.dev === right.dev && left.ino === right.ino;

class RssGuard {
    private peak = Math.max(process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024);
    private exceeded = false;
    private readonly timer = setInterval(() => this.observe(), 10);
    constructor() { this.timer.unref(); }
    private observe(): void {
        this.peak = Math.max(this.peak, process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024);
        this.exceeded ||= this.peak >= CHARACTER_STATE_PRODUCT_PROJECTION_RSS_LIMIT_BYTES;
    }
    sample(): void {
        this.observe();
        if (this.exceeded) throw new Error(`K43 RSS limit reached: ${this.peak}`);
    }
    stop(): number { clearInterval(this.timer); this.sample(); return this.peak; }
    dispose(): void { clearInterval(this.timer); }
}

async function inspectRoot(value: string, label = "output root"): Promise<RootIdentity> {
    const path = resolve(value);
    const metadata = await lstat(path);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) throw new Error(`K43 ${label} must be an existing regular non-link directory`);
    const canonical = await realpath(path);
    if (!samePath(path, canonical)) throw new Error(`K43 ${label} symlink or junction rejected`);
    return { path, realPath: canonical, dev: metadata.dev, ino: metadata.ino };
}

function containsPath(parent: string, child: string): boolean {
    const value = relative(parent, child);
    return value === "" || (value !== ".." && !value.startsWith(`..${sep}`) && !isAbsolute(value));
}

async function inspectSeparatedRoots(options: Pick<CharacterStateProductProjectionRunOptions, "sidecarRoot" | "productionRoot" | "fyiRoot" | "outputRoot">): Promise<RootIdentity> {
    const output = await inspectRoot(options.outputRoot);
    const sources = await Promise.all([
        inspectRoot(options.sidecarRoot, "sidecar source root"),
        inspectRoot(options.productionRoot, "production source root"),
        inspectRoot(options.fyiRoot, "FYI source root"),
    ]);
    for (const source of sources) {
        if (containsPath(source.realPath, output.realPath) || containsPath(output.realPath, source.realPath)) {
            throw new Error("K43 output root must not alias, contain, or descend from a source root");
        }
    }
    return output;
}

export async function validateCharacterStateProductProjectionOutputRoot(value: string): Promise<void> {
    const root = await inspectRoot(value);
    await checkpoint(root);
}

export async function validateCharacterStateProductProjectionRootSeparation(
    options: Pick<CharacterStateProductProjectionRunOptions, "sidecarRoot" | "productionRoot" | "fyiRoot" | "outputRoot">,
): Promise<void> {
    const root = await inspectSeparatedRoots(options);
    await checkpoint(root);
}

async function checkpoint(root: RootIdentity): Promise<void> {
    const actual = await inspectRoot(root.path);
    if (!samePath(root.realPath, actual.realPath) || root.dev !== actual.dev || root.ino !== actual.ino) throw new Error("K43 output root identity changed");
}

function validName(name: string): boolean {
    return name === CHARACTER_STATE_PRODUCT_PROJECTION_FILES.coverage || name === CHARACTER_STATE_PRODUCT_PROJECTION_FILES.validation
        || name === CHARACTER_STATE_PRODUCT_PROJECTION_FILES.manifest
        || /^database-characters-k43-state-product-projection\.[a-f0-9]{64}\.json\.gz$/.test(name);
}

async function writeCreateOnly(root: RootIdentity, name: string, bytes: Buffer): Promise<string> {
    if (!validName(name)) throw new Error("K43 output member name rejected");
    await checkpoint(root);
    const path = join(root.path, name);
    if (!samePath(path, resolve(root.path, name))) throw new Error("K43 output member escaped root");
    const handle = await open(path, constants.O_CREAT | constants.O_EXCL | constants.O_RDWR | (constants.O_NOFOLLOW ?? 0), 0o600);
    let completed = false;
    let opened: Stats | undefined;
    try {
        await handle.writeFile(bytes);
        await handle.sync();
        opened = await handle.stat();
        const visible = await lstat(path);
        if (!opened.isFile() || opened.nlink !== 1 || opened.size !== bytes.length || !sameFile(opened, visible)) throw new Error("K43 create-only member identity rejected");
        completed = true;
    } finally {
        if (!opened) { try { opened = await handle.stat(); } catch { /* The handle has no provable identity. */ } }
        await handle.close();
        if (!completed && opened) {
            try {
                await checkpoint(root);
                const visible = await lstat(path);
                if (sameFile(opened, visible)) await unlink(path);
            } catch { /* Preserve a target whose identity cannot be proved. */ }
        }
    }
    await checkpoint(root);
    return path;
}

async function removeOwned(root: RootIdentity, path: string, bytes: Buffer): Promise<void> {
    try {
        await checkpoint(root);
        const before = await lstat(path);
        if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || before.size !== bytes.length) return;
        const handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
        try {
            const opened = await handle.stat();
            if (!sameFile(before, opened) || !(await handle.readFile()).equals(bytes)) return;
        } finally { await handle.close(); }
        await unlink(path);
    } catch { /* Preserve any target whose ownership cannot be proved. */ }
}

async function removeOwnedIdentity(root: RootIdentity, member: { path: string; sizeBytes: number; sha256: string }): Promise<void> {
    try {
        await checkpoint(root);
        const before = await lstat(member.path);
        if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || before.size !== member.sizeBytes) return;
        const handle = await open(member.path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
        try {
            const opened = await handle.stat();
            if (!sameFile(before, opened) || hash(await handle.readFile()) !== member.sha256) return;
        } finally { await handle.close(); }
        await unlink(member.path);
    } catch { /* Preserve any target whose ownership cannot be proved. */ }
}

async function writeCharacterStateProductProjectionArtifacts(
    outputRoot: string,
    artifacts: CharacterStateProductProjectionArtifactSet,
): Promise<WrittenArtifactSet> {
    const authorized = materializeCharacterStateProductProjection(artifacts.dataset, artifacts.coverage);
    if (!authorized.gzip.equals(artifacts.gzip) || !authorized.coverageBytes.equals(artifacts.coverageBytes)
        || !authorized.validationBytes.equals(artifacts.validationBytes) || !authorized.manifestBytes.equals(artifacts.manifestBytes)) {
        throw new Error("K43 output artifact set is not canonical");
    }
    const root = await inspectRoot(outputRoot);
    const files = [
        { name: artifacts.manifest.fileName, bytes: artifacts.gzip },
        { name: CHARACTER_STATE_PRODUCT_PROJECTION_FILES.coverage, bytes: artifacts.coverageBytes },
        { name: CHARACTER_STATE_PRODUCT_PROJECTION_FILES.validation, bytes: artifacts.validationBytes },
        { name: CHARACTER_STATE_PRODUCT_PROJECTION_FILES.manifest, bytes: artifacts.manifestBytes },
    ];
    for (const file of files) {
        try { await lstat(join(root.path, file.name)); throw new Error(`K43 output already exists: ${file.name}`); }
        catch (error: any) { if (error?.code !== "ENOENT") throw error; }
    }
    const created: Array<{ path: string; bytes: Buffer }> = [];
    try {
        for (const file of files) created.push({ path: await writeCreateOnly(root, file.name, file.bytes), bytes: file.bytes });
        return {
            outputRoot: root.path,
            root,
            members: created.map(item => ({ path: item.path, sizeBytes: item.bytes.length, sha256: hash(item.bytes) })),
        };
    } catch (error) {
        for (const item of created.reverse()) await removeOwned(root, item.path, item.bytes);
        throw error;
    }
}

export async function runCharacterStateProductProjection(
    options: CharacterStateProductProjectionRunOptions,
): Promise<CharacterStateProductProjectionRunResult> {
    if (options?.optIn !== true) throw new Error("K43 requires explicit opt-in");
    if (!options.sidecarRoot || !options.productionRoot || !options.fyiRoot || !options.outputRoot) throw new Error("K43 requires all explicit roots");
    const rss = new RssGuard();
    try {
        await validateCharacterStateProductProjectionRootSeparation(options);
        const sourceOptions = { sidecarRoot: options.sidecarRoot, productionRoot: options.productionRoot, fyiRoot: options.fyiRoot };
        const k42 = await runCharacterStateProductScopeAudit({ optIn: true, ...sourceOptions });
        rss.sample();
        if (global.gc) global.gc();
        let before: Awaited<ReturnType<typeof loadCharacterShadowInputs>> | undefined = await loadCharacterShadowInputs(sourceOptions);
        if (fingerprintCharacterStateProductScopeInputs(before) !== k42.sources.fingerprintSha256) throw new Error("K43 K42/source drift before build");
        let built: ReturnType<typeof buildCharacterStateProductProjection> | undefined = buildCharacterStateProductProjection(before, k42);
        before = undefined;
        if (global.gc) global.gc();
        let after: Awaited<ReturnType<typeof loadCharacterShadowInputs>> | undefined = await loadCharacterShadowInputs(sourceOptions);
        if (fingerprintCharacterStateProductScopeInputs(after) !== k42.sources.fingerprintSha256) throw new Error("K43 structural source fingerprint changed after build");
        after = undefined;
        if (global.gc) global.gc();
        rss.sample();
        let first: CharacterStateProductProjectionArtifactSet | undefined = materializeCharacterStateProductProjection(built.dataset, built.coverage);
        let second: CharacterStateProductProjectionArtifactSet | undefined = materializeCharacterStateProductProjection(built.dataset, built.coverage);
        rss.sample();
        if (!first.raw.equals(second.raw) || !first.gzip.equals(second.gzip) || !first.coverageBytes.equals(second.coverageBytes)
            || !first.validationBytes.equals(second.validationBytes) || !first.manifestBytes.equals(second.manifestBytes)) {
            throw new Error("K43 two materializations are not byte-identical");
        }
        first = undefined;
        if (global.gc) global.gc();
        const written = await writeCharacterStateProductProjectionArtifacts(options.outputRoot, second);
        built = undefined;
        second = undefined;
        if (global.gc) global.gc();
        try {
            const validated = await validateCharacterStateProductProjectionArtifact({ artifactRoot: written.outputRoot, ...sourceOptions });
            rss.sample();
            const peakRssBytes = rss.stop();
            return {
                outputRoot: written.outputRoot, manifest: validated.artifacts.manifest, coverage: validated.artifacts.coverage,
                validation: validated.artifacts.validation, manifestSha256: hash(validated.artifacts.manifestBytes),
                manifestSizeBytes: validated.artifacts.manifestBytes.length, twoMaterializationsByteIdentical: true,
                sourcesReloadedAfterBuild: true, sourceBoundValidation: "GO", peakRssBytes,
            };
        } catch (error) {
            for (const member of [...written.members].reverse()) await removeOwnedIdentity(written.root, member);
            throw error;
        }
    } finally { rss.dispose(); }
}

function value(args: string[], name: string): string | undefined {
    const indexes = args.flatMap((item, index) => item === name ? [index] : []);
    if (indexes.length > 1) throw new Error(`duplicate ${name}`);
    if (!indexes.length) return undefined;
    const result = args[indexes[0] + 1];
    if (!result || result.startsWith("--")) throw new Error(`missing value for ${name}`);
    return result;
}
function required(args: string[], name: string): string {
    const result = value(args, name);
    if (!result) throw new Error(`K43 requires ${name}`);
    return result;
}

export function parseCharacterStateProductProjectionCli(args: string[]): CharacterStateProductProjectionRunOptions {
    const roots = ["--sidecar-root", "--production-root", "--fyi-root", "--output-root"];
    const allowed = new Set(["--opt-in-k43", ...roots]);
    for (let index = 0; index < args.length; index++) {
        const argument = args[index];
        if (!allowed.has(argument)) throw new Error(`K43 unsupported argument ${argument}`);
        if (argument !== "--opt-in-k43") {
            const next = args[index + 1];
            if (!next || next.startsWith("--")) throw new Error(`missing value for ${argument}`);
            index++;
        }
    }
    if (args.filter(item => item === "--opt-in-k43").length !== 1) throw new Error("K43 requires exactly one --opt-in-k43");
    return { optIn: true, sidecarRoot: required(args, "--sidecar-root"), productionRoot: required(args, "--production-root"), fyiRoot: required(args, "--fyi-root"), outputRoot: required(args, "--output-root") };
}

async function run(): Promise<void> {
    process.stdout.write(`${JSON.stringify(await runCharacterStateProductProjection(parseCharacterStateProductProjectionCli(process.argv.slice(2))), null, 2)}\n`);
}
if (require.main === module) run().catch(error => { console.error(error); process.exitCode = 1; });
