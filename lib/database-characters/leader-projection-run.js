"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCharacterLeaderProjectionCli = exports.runCharacterLeaderProjection = exports.writeCharacterLeaderProjectionArtifacts = exports.validateCharacterLeaderProjectionRootSeparation = exports.validateCharacterLeaderProjectionOutputRoot = void 0;
const fs_1 = require("fs");
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const leader_projection_contract_1 = require("./leader-projection-contract");
const leader_projection_1 = require("./leader-projection");
const leader_scope_run_1 = require("./leader-scope-run");
const leader_scope_source_1 = require("./leader-scope-source");
const state_product_projection_1 = require("./state-product-projection");
const hash = (bytes) => (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
const samePath = (left, right) => process.platform === "win32"
    ? (0, path_1.resolve)(left).toLowerCase() === (0, path_1.resolve)(right).toLowerCase() : (0, path_1.resolve)(left) === (0, path_1.resolve)(right);
const sameFile = (left, right) => left.dev === right.dev && left.ino === right.ino;
class RssGuard {
    peak = Math.max(process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024);
    exceeded = false;
    timer = setInterval(() => this.observe(), 10);
    constructor() { this.timer.unref(); }
    observe() {
        this.peak = Math.max(this.peak, process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024);
        this.exceeded ||= this.peak >= leader_projection_contract_1.CHARACTER_LEADER_PROJECTION_RSS_LIMIT_BYTES;
    }
    sample() { this.observe(); if (this.exceeded)
        throw new Error(`K46 RSS limit reached: ${this.peak}`); }
    stop() { clearInterval(this.timer); this.sample(); return this.peak; }
    dispose() { clearInterval(this.timer); }
}
async function inspectRoot(value, label) {
    const path = (0, path_1.resolve)(value), metadata = await (0, promises_1.lstat)(path);
    if (!metadata.isDirectory() || metadata.isSymbolicLink())
        throw new Error(`K46 ${label} must be an existing regular non-link directory`);
    const canonical = await (0, promises_1.realpath)(path);
    if (!samePath(path, canonical))
        throw new Error(`K46 ${label} symlink or junction rejected`);
    return { path, realPath: canonical, dev: metadata.dev, ino: metadata.ino };
}
function containsPath(parent, child) {
    const value = (0, path_1.relative)(parent, child);
    return value === "" || (value !== ".." && !value.startsWith(`..${path_1.sep}`) && !(0, path_1.isAbsolute)(value));
}
async function inspectSeparatedRoots(options) {
    const output = await inspectRoot(options.outputRoot, "output root");
    const sources = await Promise.all([
        inspectRoot(options.sidecarRoot, "sidecar source root"), inspectRoot(options.productionRoot, "production source root"),
        inspectRoot(options.fyiRoot, "FYI source root"), inspectRoot(options.k43Root, "K43 source root"),
    ]);
    for (const source of sources)
        if (containsPath(source.realPath, output.realPath) || containsPath(output.realPath, source.realPath)) {
            throw new Error("K46 output root must not alias, contain, or descend from a source root");
        }
    return output;
}
async function checkpoint(root) {
    const actual = await inspectRoot(root.path, "output root");
    if (!samePath(root.realPath, actual.realPath) || root.dev !== actual.dev || root.ino !== actual.ino)
        throw new Error("K46 output root identity changed");
}
async function validateCharacterLeaderProjectionOutputRoot(value) {
    const root = await inspectRoot(value, "output root");
    await checkpoint(root);
}
exports.validateCharacterLeaderProjectionOutputRoot = validateCharacterLeaderProjectionOutputRoot;
async function validateCharacterLeaderProjectionRootSeparation(options) {
    const root = await inspectSeparatedRoots(options);
    await checkpoint(root);
}
exports.validateCharacterLeaderProjectionRootSeparation = validateCharacterLeaderProjectionRootSeparation;
function validName(name) {
    return name === leader_projection_contract_1.CHARACTER_LEADER_PROJECTION_FILES.coverage || name === leader_projection_contract_1.CHARACTER_LEADER_PROJECTION_FILES.validation
        || name === leader_projection_contract_1.CHARACTER_LEADER_PROJECTION_FILES.manifest
        || /^database-characters-k46-leader-projection\.[a-f0-9]{64}\.json\.gz$/.test(name);
}
async function writeCreateOnly(root, name, bytes) {
    if (!validName(name))
        throw new Error("K46 output member name rejected");
    await checkpoint(root);
    const path = (0, path_1.join)(root.path, name);
    if (!samePath(path, (0, path_1.resolve)(root.path, name)))
        throw new Error("K46 output member escaped root");
    const handle = await (0, promises_1.open)(path, fs_1.constants.O_CREAT | fs_1.constants.O_EXCL | fs_1.constants.O_RDWR | (fs_1.constants.O_NOFOLLOW ?? 0), 0o600);
    let opened;
    try {
        await handle.writeFile(bytes);
        await handle.sync();
        opened = await handle.stat();
        const visible = await (0, promises_1.lstat)(path);
        if (!opened.isFile() || opened.nlink !== 1 || opened.size !== bytes.length || !sameFile(opened, visible))
            throw new Error("K46 create-only member identity rejected");
    }
    finally {
        await handle.close();
    }
    await checkpoint(root);
    return path;
}
async function writeCharacterLeaderProjectionArtifacts(outputRoot, artifacts) {
    const authorized = (0, leader_projection_1.materializeCharacterLeaderProjection)(artifacts.dataset, artifacts.coverage);
    if (!authorized.gzip.equals(artifacts.gzip) || !authorized.coverageBytes.equals(artifacts.coverageBytes)
        || !authorized.validationBytes.equals(artifacts.validationBytes) || !authorized.manifestBytes.equals(artifacts.manifestBytes))
        throw new Error("K46 output artifact set is not canonical");
    const root = await inspectRoot(outputRoot, "output root");
    const files = [
        { name: artifacts.manifest.fileName, bytes: artifacts.gzip },
        { name: leader_projection_contract_1.CHARACTER_LEADER_PROJECTION_FILES.coverage, bytes: artifacts.coverageBytes },
        { name: leader_projection_contract_1.CHARACTER_LEADER_PROJECTION_FILES.validation, bytes: artifacts.validationBytes },
        { name: leader_projection_contract_1.CHARACTER_LEADER_PROJECTION_FILES.manifest, bytes: artifacts.manifestBytes },
    ];
    for (const file of files) {
        try {
            await (0, promises_1.lstat)((0, path_1.join)(root.path, file.name));
            throw new Error(`K46 output already exists: ${file.name}`);
        }
        catch (error) {
            if (error?.code !== "ENOENT")
                throw error;
        }
    }
    const created = [];
    for (const file of files)
        created.push({ path: await writeCreateOnly(root, file.name, file.bytes), bytes: file.bytes });
    return { outputRoot: root.path, root, members: created.map(item => ({ path: item.path, sizeBytes: item.bytes.length, sha256: hash(item.bytes) })) };
}
exports.writeCharacterLeaderProjectionArtifacts = writeCharacterLeaderProjectionArtifacts;
async function runCharacterLeaderProjection(options) {
    if (options?.optIn !== true)
        throw new Error("K46 requires explicit opt-in");
    if (!options.sidecarRoot || !options.productionRoot || !options.fyiRoot || !options.k43Root || !options.outputRoot)
        throw new Error("K46 requires all explicit roots");
    if (typeof global.gc !== "function")
        throw new Error("K46 requires Node --expose-gc");
    const rss = new RssGuard();
    try {
        await validateCharacterLeaderProjectionRootSeparation(options);
        rss.sample();
        const sourceOptions = { sidecarRoot: options.sidecarRoot, productionRoot: options.productionRoot, fyiRoot: options.fyiRoot, k43Root: options.k43Root };
        const k45 = await (0, leader_scope_run_1.runCharacterLeaderScopeAudit)({ optIn: true, ...sourceOptions });
        rss.sample();
        let validatedK43 = await (0, state_product_projection_1.validateCharacterStateProductProjectionArtifact)({
            artifactRoot: options.k43Root, sidecarRoot: options.sidecarRoot, productionRoot: options.productionRoot, fyiRoot: options.fyiRoot,
        });
        let k43 = (0, leader_scope_source_1.compactK43LeaderScopeSource)(validatedK43.artifacts);
        validatedK43 = undefined;
        global.gc();
        let k3 = await (0, leader_scope_source_1.loadPinnedK3LeaderScopeSource)(options.sidecarRoot);
        let built = (0, leader_projection_1.buildCharacterLeaderProjection)(k43, k3, k45);
        const k43Identity = k43.identity, k3Identity = k3.identity;
        k43 = undefined;
        k3 = undefined;
        global.gc();
        rss.sample();
        let reloadedK3 = await (0, leader_scope_source_1.loadPinnedK3LeaderScopeSource)(options.sidecarRoot);
        (0, leader_scope_source_1.assertK3LeaderScopeSourceStable)(k3Identity, reloadedK3.identity);
        reloadedK3 = undefined;
        let revalidatedK43 = await (0, state_product_projection_1.validateCharacterStateProductProjectionArtifact)({
            artifactRoot: options.k43Root, sidecarRoot: options.sidecarRoot, productionRoot: options.productionRoot, fyiRoot: options.fyiRoot,
        });
        const finalK43 = (0, leader_scope_source_1.compactK43LeaderScopeSource)(revalidatedK43.artifacts);
        (0, leader_scope_source_1.assertK43LeaderScopeSourceStable)(k43Identity, finalK43.identity);
        revalidatedK43 = undefined;
        global.gc();
        rss.sample();
        let first = (0, leader_projection_1.materializeCharacterLeaderProjection)(built.dataset, built.coverage);
        let second = (0, leader_projection_1.materializeCharacterLeaderProjection)(built.dataset, built.coverage);
        if (!first.raw.equals(second.raw) || !first.gzip.equals(second.gzip) || !first.coverageBytes.equals(second.coverageBytes)
            || !first.validationBytes.equals(second.validationBytes) || !first.manifestBytes.equals(second.manifestBytes))
            throw new Error("K46 two materializations are not byte-identical");
        first = undefined;
        global.gc();
        rss.sample();
        const written = await writeCharacterLeaderProjectionArtifacts(options.outputRoot, second);
        built = undefined;
        second = undefined;
        global.gc();
        const validated = await (0, leader_projection_1.validateCharacterLeaderProjectionArtifact)({ artifactRoot: written.outputRoot, ...sourceOptions });
        rss.sample();
        const peakRssBytes = rss.stop();
        return {
            outputRoot: written.outputRoot, manifest: validated.artifacts.manifest, coverage: validated.artifacts.coverage,
            validation: validated.artifacts.validation, manifestSha256: hash(validated.artifacts.manifestBytes),
            manifestSizeBytes: validated.artifacts.manifestBytes.length, twoMaterializationsByteIdentical: true,
            sourcesReloadedAfterBuild: true, k45StructuralScope: "GO", sourceBoundValidation: "GO", peakRssBytes,
        };
    }
    finally {
        rss.dispose();
    }
}
exports.runCharacterLeaderProjection = runCharacterLeaderProjection;
function value(args, name) {
    const indexes = args.flatMap((item, index) => item === name ? [index] : []);
    if (indexes.length > 1)
        throw new Error(`duplicate ${name}`);
    if (!indexes.length)
        return undefined;
    const result = args[indexes[0] + 1];
    if (!result || result.startsWith("--"))
        throw new Error(`missing value for ${name}`);
    return result;
}
function required(args, name) { const result = value(args, name); if (!result)
    throw new Error(`K46 requires ${name}`); return result; }
function parseCharacterLeaderProjectionCli(args) {
    const roots = ["--sidecar-root", "--production-root", "--fyi-root", "--k43-root", "--output-root"];
    const allowed = new Set(["--opt-in-k46", ...roots]);
    for (let index = 0; index < args.length; index++) {
        const argument = args[index];
        if (!allowed.has(argument))
            throw new Error(`K46 unsupported argument ${argument}`);
        if (argument !== "--opt-in-k46") {
            const next = args[index + 1];
            if (!next || next.startsWith("--"))
                throw new Error(`missing value for ${argument}`);
            index++;
        }
    }
    if (args.filter(item => item === "--opt-in-k46").length !== 1)
        throw new Error("K46 requires exactly one --opt-in-k46");
    return {
        optIn: true, sidecarRoot: required(args, "--sidecar-root"), productionRoot: required(args, "--production-root"),
        fyiRoot: required(args, "--fyi-root"), k43Root: required(args, "--k43-root"), outputRoot: required(args, "--output-root"),
    };
}
exports.parseCharacterLeaderProjectionCli = parseCharacterLeaderProjectionCli;
async function run() {
    const result = await runCharacterLeaderProjection(parseCharacterLeaderProjectionCli(process.argv.slice(2)));
    const stdout = `${JSON.stringify(result, null, 2)}\n`;
    if (Buffer.byteLength(stdout) >= leader_projection_contract_1.CHARACTER_LEADER_PROJECTION_METADATA_LIMIT_BYTES)
        throw new Error("K46 stdout metadata limit reached");
    process.stdout.write(stdout);
}
if (require.main === module)
    run().catch(error => { console.error(error); process.exitCode = 1; });
//# sourceMappingURL=leader-projection-run.js.map