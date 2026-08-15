import { constants, Stats } from "fs";
import { createHash } from "crypto";
import { lstat, open, realpath } from "fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "path";
import {
    CHARACTER_LEADER_PROJECTION_FILES,
    CHARACTER_LEADER_PROJECTION_METADATA_LIMIT_BYTES,
    CHARACTER_LEADER_PROJECTION_RSS_LIMIT_BYTES,
    CharacterLeaderProjectionArtifactSet,
    CharacterLeaderProjectionCoverage,
    CharacterLeaderProjectionManifest,
    CharacterLeaderProjectionValidation,
} from "./leader-projection-contract";
import {
    buildCharacterLeaderProjection,
    materializeCharacterLeaderProjection,
    validateCharacterLeaderProjectionArtifact,
} from "./leader-projection";
import { runCharacterLeaderScopeAudit } from "./leader-scope-run";
import {
    assertK3LeaderScopeSourceStable,
    assertK43LeaderScopeSourceStable,
    compactK43LeaderScopeSource,
    loadPinnedK3LeaderScopeSource,
} from "./leader-scope-source";
import { validateCharacterStateProductProjectionArtifact } from "./state-product-projection";

export interface CharacterLeaderProjectionRunOptions {
    optIn: true;
    sidecarRoot: string;
    productionRoot: string;
    fyiRoot: string;
    k43Root: string;
    outputRoot: string;
}

export interface CharacterLeaderProjectionRunResult {
    outputRoot: string;
    manifest: CharacterLeaderProjectionManifest;
    coverage: CharacterLeaderProjectionCoverage;
    validation: CharacterLeaderProjectionValidation;
    manifestSha256: string;
    manifestSizeBytes: number;
    twoMaterializationsByteIdentical: true;
    sourcesReloadedAfterBuild: true;
    k45StructuralScope: "GO";
    sourceBoundValidation: "GO";
    peakRssBytes: number;
}

interface RootIdentity { path: string; realPath: string; dev: number; ino: number }
interface WrittenArtifactSet { outputRoot: string; root: RootIdentity; members: Array<{ path: string; sizeBytes: number; sha256: string }> }
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
        this.exceeded ||= this.peak >= CHARACTER_LEADER_PROJECTION_RSS_LIMIT_BYTES;
    }
    sample(): void { this.observe(); if (this.exceeded) throw new Error(`K46 RSS limit reached: ${this.peak}`); }
    stop(): number { clearInterval(this.timer); this.sample(); return this.peak; }
    dispose(): void { clearInterval(this.timer); }
}

async function inspectRoot(value: string, label: string): Promise<RootIdentity> {
    const path = resolve(value), metadata = await lstat(path);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) throw new Error(`K46 ${label} must be an existing regular non-link directory`);
    const canonical = await realpath(path);
    if (!samePath(path, canonical)) throw new Error(`K46 ${label} symlink or junction rejected`);
    return { path, realPath: canonical, dev: metadata.dev, ino: metadata.ino };
}
function containsPath(parent: string, child: string): boolean {
    const value = relative(parent, child);
    return value === "" || (value !== ".." && !value.startsWith(`..${sep}`) && !isAbsolute(value));
}
async function inspectSeparatedRoots(options: Omit<CharacterLeaderProjectionRunOptions, "optIn">): Promise<RootIdentity> {
    const output = await inspectRoot(options.outputRoot, "output root");
    const sources = await Promise.all([
        inspectRoot(options.sidecarRoot, "sidecar source root"), inspectRoot(options.productionRoot, "production source root"),
        inspectRoot(options.fyiRoot, "FYI source root"), inspectRoot(options.k43Root, "K43 source root"),
    ]);
    for (const source of sources) if (containsPath(source.realPath, output.realPath) || containsPath(output.realPath, source.realPath)) {
        throw new Error("K46 output root must not alias, contain, or descend from a source root");
    }
    return output;
}
async function checkpoint(root: RootIdentity): Promise<void> {
    const actual = await inspectRoot(root.path, "output root");
    if (!samePath(root.realPath, actual.realPath) || root.dev !== actual.dev || root.ino !== actual.ino) throw new Error("K46 output root identity changed");
}

export async function validateCharacterLeaderProjectionOutputRoot(value: string): Promise<void> {
    const root = await inspectRoot(value, "output root"); await checkpoint(root);
}
export async function validateCharacterLeaderProjectionRootSeparation(options: Omit<CharacterLeaderProjectionRunOptions, "optIn">): Promise<void> {
    const root = await inspectSeparatedRoots(options); await checkpoint(root);
}

function validName(name: string): boolean {
    return name === CHARACTER_LEADER_PROJECTION_FILES.coverage || name === CHARACTER_LEADER_PROJECTION_FILES.validation
        || name === CHARACTER_LEADER_PROJECTION_FILES.manifest
        || /^database-characters-k46-leader-projection\.[a-f0-9]{64}\.json\.gz$/.test(name);
}
async function writeCreateOnly(root: RootIdentity, name: string, bytes: Buffer): Promise<string> {
    if (!validName(name)) throw new Error("K46 output member name rejected");
    await checkpoint(root);
    const path = join(root.path, name);
    if (!samePath(path, resolve(root.path, name))) throw new Error("K46 output member escaped root");
    const handle = await open(path, constants.O_CREAT | constants.O_EXCL | constants.O_RDWR | (constants.O_NOFOLLOW ?? 0), 0o600);
    let opened: Stats | undefined;
    try {
        await handle.writeFile(bytes); await handle.sync(); opened = await handle.stat();
        const visible = await lstat(path);
        if (!opened.isFile() || opened.nlink !== 1 || opened.size !== bytes.length || !sameFile(opened, visible)) throw new Error("K46 create-only member identity rejected");
    } finally {
        await handle.close();
    }
    await checkpoint(root);
    return path;
}
export async function writeCharacterLeaderProjectionArtifacts(
    outputRoot: string,
    artifacts: CharacterLeaderProjectionArtifactSet,
): Promise<WrittenArtifactSet> {
    const authorized = materializeCharacterLeaderProjection(artifacts.dataset, artifacts.coverage);
    if (!authorized.gzip.equals(artifacts.gzip) || !authorized.coverageBytes.equals(artifacts.coverageBytes)
        || !authorized.validationBytes.equals(artifacts.validationBytes) || !authorized.manifestBytes.equals(artifacts.manifestBytes)) throw new Error("K46 output artifact set is not canonical");
    const root = await inspectRoot(outputRoot, "output root");
    const files = [
        { name: artifacts.manifest.fileName, bytes: artifacts.gzip },
        { name: CHARACTER_LEADER_PROJECTION_FILES.coverage, bytes: artifacts.coverageBytes },
        { name: CHARACTER_LEADER_PROJECTION_FILES.validation, bytes: artifacts.validationBytes },
        { name: CHARACTER_LEADER_PROJECTION_FILES.manifest, bytes: artifacts.manifestBytes },
    ];
    for (const file of files) {
        try { await lstat(join(root.path, file.name)); throw new Error(`K46 output already exists: ${file.name}`); }
        catch (error: any) { if (error?.code !== "ENOENT") throw error; }
    }
    const created: Array<{ path: string; bytes: Buffer }> = [];
    for (const file of files) created.push({ path: await writeCreateOnly(root, file.name, file.bytes), bytes: file.bytes });
    return { outputRoot: root.path, root, members: created.map(item => ({ path: item.path, sizeBytes: item.bytes.length, sha256: hash(item.bytes) })) };
}

export async function runCharacterLeaderProjection(options: CharacterLeaderProjectionRunOptions): Promise<CharacterLeaderProjectionRunResult> {
    if (options?.optIn !== true) throw new Error("K46 requires explicit opt-in");
    if (!options.sidecarRoot || !options.productionRoot || !options.fyiRoot || !options.k43Root || !options.outputRoot) throw new Error("K46 requires all explicit roots");
    if (typeof (global as any).gc !== "function") throw new Error("K46 requires Node --expose-gc");
    const rss = new RssGuard();
    try {
        await validateCharacterLeaderProjectionRootSeparation(options); rss.sample();
        const sourceOptions = { sidecarRoot: options.sidecarRoot, productionRoot: options.productionRoot, fyiRoot: options.fyiRoot, k43Root: options.k43Root };
        const k45 = await runCharacterLeaderScopeAudit({ optIn: true, ...sourceOptions }); rss.sample();
        let validatedK43 = await validateCharacterStateProductProjectionArtifact({
            artifactRoot: options.k43Root, sidecarRoot: options.sidecarRoot, productionRoot: options.productionRoot, fyiRoot: options.fyiRoot,
        });
        let k43 = compactK43LeaderScopeSource(validatedK43.artifacts); validatedK43 = undefined as any; (global as any).gc();
        let k3 = await loadPinnedK3LeaderScopeSource(options.sidecarRoot);
        let built: ReturnType<typeof buildCharacterLeaderProjection> | undefined = buildCharacterLeaderProjection(k43, k3, k45);
        const k43Identity = k43.identity, k3Identity = k3.identity;
        k43 = undefined as any; k3 = undefined as any; (global as any).gc(); rss.sample();
        let reloadedK3 = await loadPinnedK3LeaderScopeSource(options.sidecarRoot);
        assertK3LeaderScopeSourceStable(k3Identity, reloadedK3.identity); reloadedK3 = undefined as any;
        let revalidatedK43 = await validateCharacterStateProductProjectionArtifact({
            artifactRoot: options.k43Root, sidecarRoot: options.sidecarRoot, productionRoot: options.productionRoot, fyiRoot: options.fyiRoot,
        });
        const finalK43 = compactK43LeaderScopeSource(revalidatedK43.artifacts);
        assertK43LeaderScopeSourceStable(k43Identity, finalK43.identity); revalidatedK43 = undefined as any; (global as any).gc(); rss.sample();
        let first: CharacterLeaderProjectionArtifactSet | undefined = materializeCharacterLeaderProjection(built.dataset, built.coverage);
        let second: CharacterLeaderProjectionArtifactSet | undefined = materializeCharacterLeaderProjection(built.dataset, built.coverage);
        if (!first.raw.equals(second.raw) || !first.gzip.equals(second.gzip) || !first.coverageBytes.equals(second.coverageBytes)
            || !first.validationBytes.equals(second.validationBytes) || !first.manifestBytes.equals(second.manifestBytes)) throw new Error("K46 two materializations are not byte-identical");
        first = undefined; (global as any).gc(); rss.sample();
        const written = await writeCharacterLeaderProjectionArtifacts(options.outputRoot, second);
        built = undefined; second = undefined; (global as any).gc();
        const validated = await validateCharacterLeaderProjectionArtifact({ artifactRoot: written.outputRoot, ...sourceOptions });
        rss.sample();
        const peakRssBytes = rss.stop();
        return {
            outputRoot: written.outputRoot, manifest: validated.artifacts.manifest, coverage: validated.artifacts.coverage,
            validation: validated.artifacts.validation, manifestSha256: hash(validated.artifacts.manifestBytes),
            manifestSizeBytes: validated.artifacts.manifestBytes.length, twoMaterializationsByteIdentical: true,
            sourcesReloadedAfterBuild: true, k45StructuralScope: "GO", sourceBoundValidation: "GO", peakRssBytes,
        };
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
function required(args: string[], name: string): string { const result = value(args, name); if (!result) throw new Error(`K46 requires ${name}`); return result; }
export function parseCharacterLeaderProjectionCli(args: string[]): CharacterLeaderProjectionRunOptions {
    const roots = ["--sidecar-root", "--production-root", "--fyi-root", "--k43-root", "--output-root"];
    const allowed = new Set(["--opt-in-k46", ...roots]);
    for (let index = 0; index < args.length; index++) {
        const argument = args[index];
        if (!allowed.has(argument)) throw new Error(`K46 unsupported argument ${argument}`);
        if (argument !== "--opt-in-k46") { const next = args[index + 1]; if (!next || next.startsWith("--")) throw new Error(`missing value for ${argument}`); index++; }
    }
    if (args.filter(item => item === "--opt-in-k46").length !== 1) throw new Error("K46 requires exactly one --opt-in-k46");
    return {
        optIn: true, sidecarRoot: required(args, "--sidecar-root"), productionRoot: required(args, "--production-root"),
        fyiRoot: required(args, "--fyi-root"), k43Root: required(args, "--k43-root"), outputRoot: required(args, "--output-root"),
    };
}
async function run(): Promise<void> {
    const result = await runCharacterLeaderProjection(parseCharacterLeaderProjectionCli(process.argv.slice(2)));
    const stdout = `${JSON.stringify(result, null, 2)}\n`;
    if (Buffer.byteLength(stdout) >= CHARACTER_LEADER_PROJECTION_METADATA_LIMIT_BYTES) throw new Error("K46 stdout metadata limit reached");
    process.stdout.write(stdout);
}
if (require.main === module) run().catch(error => { console.error(error); process.exitCode = 1; });
