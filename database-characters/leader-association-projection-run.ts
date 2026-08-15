import { constants, Stats } from "fs";
import { createHash } from "crypto";
import { lstat, open, realpath } from "fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "path";
import {
    CHARACTER_LEADER_ASSOCIATION_PROJECTION_FILES,
    CHARACTER_LEADER_ASSOCIATION_PROJECTION_METADATA_LIMIT_BYTES,
    CHARACTER_LEADER_ASSOCIATION_PROJECTION_RSS_LIMIT_BYTES,
    CharacterLeaderAssociationProjectionArtifactSet,
    CharacterLeaderAssociationProjectionCoverage,
    CharacterLeaderAssociationProjectionManifest,
    CharacterLeaderAssociationProjectionValidation,
} from "./leader-association-projection-contract";
import {
    buildCharacterLeaderAssociationProjection,
    materializeCharacterLeaderAssociationProjection,
    validateCharacterLeaderAssociationProjectionArtifact,
} from "./leader-association-projection";
import { runCharacterLeaderAssociationScopeAudit } from "./leader-association-scope-run";
import {
    assertLeaderAssociationK3Stable,
    assertLeaderAssociationK46Stable,
    compactK46LeaderAssociationSource,
    loadPinnedK3LeaderAssociationSource,
} from "./leader-association-scope-source";
import { validateCharacterLeaderProjectionArtifact } from "./leader-projection";

export interface CharacterLeaderAssociationProjectionRunOptions {
    optIn: true;
    sidecarRoot: string;
    productionRoot: string;
    fyiRoot: string;
    k43Root: string;
    k46Root: string;
    outputRoot: string;
}
export interface CharacterLeaderAssociationProjectionRunResult {
    outputRoot: string;
    manifest: CharacterLeaderAssociationProjectionManifest;
    coverage: CharacterLeaderAssociationProjectionCoverage;
    validation: CharacterLeaderAssociationProjectionValidation;
    manifestSha256: string;
    manifestSizeBytes: number;
    twoMaterializationsByteIdentical: true;
    sourcesReloadedAfterBuild: true;
    k47StructuralAssociationScope: "GO";
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
        this.exceeded ||= this.peak >= CHARACTER_LEADER_ASSOCIATION_PROJECTION_RSS_LIMIT_BYTES;
    }
    sample(): void { this.observe(); if (this.exceeded) throw new Error(`K48 RSS limit reached: ${this.peak}`); }
    stop(): number { clearInterval(this.timer); this.sample(); return this.peak; }
    dispose(): void { clearInterval(this.timer); }
}
async function inspectRoot(value: string, label: string): Promise<RootIdentity> {
    const path = resolve(value), metadata = await lstat(path);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) throw new Error(`K48 ${label} must be an existing regular non-link directory`);
    const canonical = await realpath(path);
    if (!samePath(path, canonical)) throw new Error(`K48 ${label} symlink or junction rejected`);
    return { path, realPath: canonical, dev: metadata.dev, ino: metadata.ino };
}
function containsPath(parent: string, child: string): boolean {
    const value = relative(parent, child);
    return value === "" || (value !== ".." && !value.startsWith(`..${sep}`) && !isAbsolute(value));
}
async function inspectSeparatedRoots(options: Omit<CharacterLeaderAssociationProjectionRunOptions, "optIn">): Promise<RootIdentity> {
    const output = await inspectRoot(options.outputRoot, "output root");
    const sources = await Promise.all([
        inspectRoot(options.sidecarRoot, "sidecar source root"), inspectRoot(options.productionRoot, "production source root"),
        inspectRoot(options.fyiRoot, "FYI source root"), inspectRoot(options.k43Root, "K43 source root"),
        inspectRoot(options.k46Root, "K46 source root"),
    ]);
    for (const source of sources) if (containsPath(source.realPath, output.realPath) || containsPath(output.realPath, source.realPath)) {
        throw new Error("K48 output root must not alias, contain, or descend from a source root");
    }
    return output;
}
async function checkpoint(root: RootIdentity): Promise<void> {
    const actual = await inspectRoot(root.path, "output root");
    if (!samePath(root.realPath, actual.realPath) || root.dev !== actual.dev || root.ino !== actual.ino) throw new Error("K48 output root identity changed");
}
export async function validateCharacterLeaderAssociationProjectionOutputRoot(value: string): Promise<void> {
    const root = await inspectRoot(value, "output root"); await checkpoint(root);
}
export async function validateCharacterLeaderAssociationProjectionRootSeparation(options: Omit<CharacterLeaderAssociationProjectionRunOptions, "optIn">): Promise<void> {
    const root = await inspectSeparatedRoots(options); await checkpoint(root);
}
function validName(name: string): boolean {
    return name === CHARACTER_LEADER_ASSOCIATION_PROJECTION_FILES.coverage || name === CHARACTER_LEADER_ASSOCIATION_PROJECTION_FILES.validation
        || name === CHARACTER_LEADER_ASSOCIATION_PROJECTION_FILES.manifest
        || /^database-characters-k48-leader-association-projection\.[a-f0-9]{64}\.json\.gz$/.test(name);
}
async function writeCreateOnly(root: RootIdentity, name: string, bytes: Buffer): Promise<string> {
    if (!validName(name)) throw new Error("K48 output member name rejected");
    await checkpoint(root);
    const path = join(root.path, name);
    if (!samePath(path, resolve(root.path, name))) throw new Error("K48 output member escaped root");
    const handle = await open(path, constants.O_CREAT | constants.O_EXCL | constants.O_RDWR | (constants.O_NOFOLLOW ?? 0), 0o600);
    try {
        await handle.writeFile(bytes); await handle.sync();
        const opened = await handle.stat(), visible = await lstat(path);
        if (!opened.isFile() || opened.nlink !== 1 || opened.size !== bytes.length || !sameFile(opened, visible)) throw new Error("K48 create-only member identity rejected");
    } finally { await handle.close(); }
    await checkpoint(root);
    return path;
}
export async function writeCharacterLeaderAssociationProjectionArtifacts(
    outputRoot: string, artifacts: CharacterLeaderAssociationProjectionArtifactSet,
): Promise<WrittenArtifactSet> {
    const authorized = materializeCharacterLeaderAssociationProjection(artifacts.dataset, artifacts.coverage);
    if (!authorized.gzip.equals(artifacts.gzip) || !authorized.coverageBytes.equals(artifacts.coverageBytes)
        || !authorized.validationBytes.equals(artifacts.validationBytes) || !authorized.manifestBytes.equals(artifacts.manifestBytes)) throw new Error("K48 output artifact set is not canonical");
    const root = await inspectRoot(outputRoot, "output root");
    const files = [
        { name: artifacts.manifest.fileName, bytes: artifacts.gzip },
        { name: CHARACTER_LEADER_ASSOCIATION_PROJECTION_FILES.coverage, bytes: artifacts.coverageBytes },
        { name: CHARACTER_LEADER_ASSOCIATION_PROJECTION_FILES.validation, bytes: artifacts.validationBytes },
        { name: CHARACTER_LEADER_ASSOCIATION_PROJECTION_FILES.manifest, bytes: artifacts.manifestBytes },
    ];
    for (const file of files) {
        try { await lstat(join(root.path, file.name)); throw new Error(`K48 output already exists: ${file.name}`); }
        catch (error: any) { if (error?.code !== "ENOENT") throw error; }
    }
    const created: Array<{ path: string; bytes: Buffer }> = [];
    for (const file of files) created.push({ path: await writeCreateOnly(root, file.name, file.bytes), bytes: file.bytes });
    return { outputRoot: root.path, root, members: created.map(item => ({ path: item.path, sizeBytes: item.bytes.length, sha256: hash(item.bytes) })) };
}

export async function runCharacterLeaderAssociationProjection(
    options: CharacterLeaderAssociationProjectionRunOptions,
): Promise<CharacterLeaderAssociationProjectionRunResult> {
    if (options?.optIn !== true) throw new Error("K48 requires explicit opt-in");
    if (!options.sidecarRoot || !options.productionRoot || !options.fyiRoot || !options.k43Root || !options.k46Root || !options.outputRoot) {
        throw new Error("K48 requires all explicit roots");
    }
    if (typeof (global as any).gc !== "function") throw new Error("K48 requires Node --expose-gc");
    const rss = new RssGuard();
    try {
        await validateCharacterLeaderAssociationProjectionRootSeparation(options); rss.sample();
        const scopeOptions = { optIn: true as const, sidecarRoot: options.sidecarRoot, productionRoot: options.productionRoot, fyiRoot: options.fyiRoot, k43Root: options.k43Root, k46Root: options.k46Root };
        const k47 = await runCharacterLeaderAssociationScopeAudit(scopeOptions); rss.sample();
        let validatedK46 = await validateCharacterLeaderProjectionArtifact({ artifactRoot: options.k46Root, sidecarRoot: options.sidecarRoot, productionRoot: options.productionRoot, fyiRoot: options.fyiRoot, k43Root: options.k43Root });
        const k46Identity = compactK46LeaderAssociationSource(validatedK46.artifacts).identity;
        let k3 = await loadPinnedK3LeaderAssociationSource(options.sidecarRoot);
        const k3Identity = k3.identity;
        let built: ReturnType<typeof buildCharacterLeaderAssociationProjection> | undefined = buildCharacterLeaderAssociationProjection(validatedK46.artifacts, k3, k47);
        validatedK46 = undefined as any; k3 = undefined as any; (global as any).gc(); rss.sample();
        let reloadedK3 = await loadPinnedK3LeaderAssociationSource(options.sidecarRoot);
        assertLeaderAssociationK3Stable(k3Identity, reloadedK3.identity); reloadedK3 = undefined as any;
        let revalidatedK46 = await validateCharacterLeaderProjectionArtifact({ artifactRoot: options.k46Root, sidecarRoot: options.sidecarRoot, productionRoot: options.productionRoot, fyiRoot: options.fyiRoot, k43Root: options.k43Root });
        assertLeaderAssociationK46Stable(k46Identity, compactK46LeaderAssociationSource(revalidatedK46.artifacts).identity);
        revalidatedK46 = undefined as any; (global as any).gc(); rss.sample();
        let first: CharacterLeaderAssociationProjectionArtifactSet | undefined = materializeCharacterLeaderAssociationProjection(built.dataset, built.coverage);
        let second: CharacterLeaderAssociationProjectionArtifactSet | undefined = materializeCharacterLeaderAssociationProjection(built.dataset, built.coverage);
        if (!first.raw.equals(second.raw) || !first.gzip.equals(second.gzip) || !first.coverageBytes.equals(second.coverageBytes)
            || !first.validationBytes.equals(second.validationBytes) || !first.manifestBytes.equals(second.manifestBytes)) throw new Error("K48 two materializations are not byte-identical");
        first = undefined; (global as any).gc(); rss.sample();
        const written = await writeCharacterLeaderAssociationProjectionArtifacts(options.outputRoot, second);
        built = undefined; second = undefined; (global as any).gc();
        const validated = await validateCharacterLeaderAssociationProjectionArtifact({ artifactRoot: written.outputRoot, ...scopeOptions });
        rss.sample();
        const peakRssBytes = rss.stop();
        return {
            outputRoot: written.outputRoot, manifest: validated.artifacts.manifest, coverage: validated.artifacts.coverage,
            validation: validated.artifacts.validation, manifestSha256: hash(validated.artifacts.manifestBytes),
            manifestSizeBytes: validated.artifacts.manifestBytes.length, twoMaterializationsByteIdentical: true,
            sourcesReloadedAfterBuild: true, k47StructuralAssociationScope: "GO", sourceBoundValidation: "GO", peakRssBytes,
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
function required(args: string[], name: string): string { const result = value(args, name); if (!result) throw new Error(`K48 requires ${name}`); return result; }
export function parseCharacterLeaderAssociationProjectionCli(args: string[]): CharacterLeaderAssociationProjectionRunOptions {
    const roots = ["--sidecar-root", "--production-root", "--fyi-root", "--k43-root", "--k46-root", "--output-root"];
    const allowed = new Set(["--opt-in-k48", ...roots]);
    for (let index = 0; index < args.length; index++) {
        const argument = args[index];
        if (!allowed.has(argument)) throw new Error(`K48 unsupported argument ${argument}`);
        if (argument !== "--opt-in-k48") { const next = args[index + 1]; if (!next || next.startsWith("--")) throw new Error(`missing value for ${argument}`); index++; }
    }
    if (args.filter(item => item === "--opt-in-k48").length !== 1) throw new Error("K48 requires exactly one --opt-in-k48");
    return {
        optIn: true, sidecarRoot: required(args, "--sidecar-root"), productionRoot: required(args, "--production-root"),
        fyiRoot: required(args, "--fyi-root"), k43Root: required(args, "--k43-root"), k46Root: required(args, "--k46-root"),
        outputRoot: required(args, "--output-root"),
    };
}
async function run(): Promise<void> {
    const result = await runCharacterLeaderAssociationProjection(parseCharacterLeaderAssociationProjectionCli(process.argv.slice(2)));
    const stdout = `${JSON.stringify(result, null, 2)}\n`;
    if (Buffer.byteLength(stdout) >= CHARACTER_LEADER_ASSOCIATION_PROJECTION_METADATA_LIMIT_BYTES) throw new Error("K48 stdout metadata limit reached");
    process.stdout.write(stdout);
}
if (require.main === module) run().catch(error => { console.error(error); process.exitCode = 1; });
