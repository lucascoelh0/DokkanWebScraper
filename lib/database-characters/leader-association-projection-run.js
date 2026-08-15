"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCharacterLeaderAssociationProjectionCli = exports.runCharacterLeaderAssociationProjection = exports.writeCharacterLeaderAssociationProjectionArtifacts = exports.validateCharacterLeaderAssociationProjectionRootSeparation = exports.validateCharacterLeaderAssociationProjectionOutputRoot = void 0;
const fs_1 = require("fs");
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const leader_association_projection_contract_1 = require("./leader-association-projection-contract");
const leader_association_projection_1 = require("./leader-association-projection");
const leader_association_scope_run_1 = require("./leader-association-scope-run");
const leader_association_scope_source_1 = require("./leader-association-scope-source");
const leader_projection_1 = require("./leader-projection");
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
        this.exceeded ||= this.peak >= leader_association_projection_contract_1.CHARACTER_LEADER_ASSOCIATION_PROJECTION_RSS_LIMIT_BYTES;
    }
    sample() { this.observe(); if (this.exceeded)
        throw new Error(`K48 RSS limit reached: ${this.peak}`); }
    stop() { clearInterval(this.timer); this.sample(); return this.peak; }
    dispose() { clearInterval(this.timer); }
}
async function inspectRoot(value, label) {
    const path = (0, path_1.resolve)(value), metadata = await (0, promises_1.lstat)(path);
    if (!metadata.isDirectory() || metadata.isSymbolicLink())
        throw new Error(`K48 ${label} must be an existing regular non-link directory`);
    const canonical = await (0, promises_1.realpath)(path);
    if (!samePath(path, canonical))
        throw new Error(`K48 ${label} symlink or junction rejected`);
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
        inspectRoot(options.k46Root, "K46 source root"),
    ]);
    for (const source of sources)
        if (containsPath(source.realPath, output.realPath) || containsPath(output.realPath, source.realPath)) {
            throw new Error("K48 output root must not alias, contain, or descend from a source root");
        }
    return output;
}
async function checkpoint(root) {
    const actual = await inspectRoot(root.path, "output root");
    if (!samePath(root.realPath, actual.realPath) || root.dev !== actual.dev || root.ino !== actual.ino)
        throw new Error("K48 output root identity changed");
}
async function validateCharacterLeaderAssociationProjectionOutputRoot(value) {
    const root = await inspectRoot(value, "output root");
    await checkpoint(root);
}
exports.validateCharacterLeaderAssociationProjectionOutputRoot = validateCharacterLeaderAssociationProjectionOutputRoot;
async function validateCharacterLeaderAssociationProjectionRootSeparation(options) {
    const root = await inspectSeparatedRoots(options);
    await checkpoint(root);
}
exports.validateCharacterLeaderAssociationProjectionRootSeparation = validateCharacterLeaderAssociationProjectionRootSeparation;
function validName(name) {
    return name === leader_association_projection_contract_1.CHARACTER_LEADER_ASSOCIATION_PROJECTION_FILES.coverage || name === leader_association_projection_contract_1.CHARACTER_LEADER_ASSOCIATION_PROJECTION_FILES.validation
        || name === leader_association_projection_contract_1.CHARACTER_LEADER_ASSOCIATION_PROJECTION_FILES.manifest
        || /^database-characters-k48-leader-association-projection\.[a-f0-9]{64}\.json\.gz$/.test(name);
}
async function writeCreateOnly(root, name, bytes) {
    if (!validName(name))
        throw new Error("K48 output member name rejected");
    await checkpoint(root);
    const path = (0, path_1.join)(root.path, name);
    if (!samePath(path, (0, path_1.resolve)(root.path, name)))
        throw new Error("K48 output member escaped root");
    const handle = await (0, promises_1.open)(path, fs_1.constants.O_CREAT | fs_1.constants.O_EXCL | fs_1.constants.O_RDWR | (fs_1.constants.O_NOFOLLOW ?? 0), 0o600);
    try {
        await handle.writeFile(bytes);
        await handle.sync();
        const opened = await handle.stat(), visible = await (0, promises_1.lstat)(path);
        if (!opened.isFile() || opened.nlink !== 1 || opened.size !== bytes.length || !sameFile(opened, visible))
            throw new Error("K48 create-only member identity rejected");
    }
    finally {
        await handle.close();
    }
    await checkpoint(root);
    return path;
}
async function writeCharacterLeaderAssociationProjectionArtifacts(outputRoot, artifacts) {
    const authorized = (0, leader_association_projection_1.materializeCharacterLeaderAssociationProjection)(artifacts.dataset, artifacts.coverage);
    if (!authorized.gzip.equals(artifacts.gzip) || !authorized.coverageBytes.equals(artifacts.coverageBytes)
        || !authorized.validationBytes.equals(artifacts.validationBytes) || !authorized.manifestBytes.equals(artifacts.manifestBytes))
        throw new Error("K48 output artifact set is not canonical");
    const root = await inspectRoot(outputRoot, "output root");
    const files = [
        { name: artifacts.manifest.fileName, bytes: artifacts.gzip },
        { name: leader_association_projection_contract_1.CHARACTER_LEADER_ASSOCIATION_PROJECTION_FILES.coverage, bytes: artifacts.coverageBytes },
        { name: leader_association_projection_contract_1.CHARACTER_LEADER_ASSOCIATION_PROJECTION_FILES.validation, bytes: artifacts.validationBytes },
        { name: leader_association_projection_contract_1.CHARACTER_LEADER_ASSOCIATION_PROJECTION_FILES.manifest, bytes: artifacts.manifestBytes },
    ];
    for (const file of files) {
        try {
            await (0, promises_1.lstat)((0, path_1.join)(root.path, file.name));
            throw new Error(`K48 output already exists: ${file.name}`);
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
exports.writeCharacterLeaderAssociationProjectionArtifacts = writeCharacterLeaderAssociationProjectionArtifacts;
async function runCharacterLeaderAssociationProjection(options) {
    if (options?.optIn !== true)
        throw new Error("K48 requires explicit opt-in");
    if (!options.sidecarRoot || !options.productionRoot || !options.fyiRoot || !options.k43Root || !options.k46Root || !options.outputRoot) {
        throw new Error("K48 requires all explicit roots");
    }
    if (typeof global.gc !== "function")
        throw new Error("K48 requires Node --expose-gc");
    const rss = new RssGuard();
    try {
        await validateCharacterLeaderAssociationProjectionRootSeparation(options);
        rss.sample();
        const scopeOptions = { optIn: true, sidecarRoot: options.sidecarRoot, productionRoot: options.productionRoot, fyiRoot: options.fyiRoot, k43Root: options.k43Root, k46Root: options.k46Root };
        const k47 = await (0, leader_association_scope_run_1.runCharacterLeaderAssociationScopeAudit)(scopeOptions);
        rss.sample();
        let validatedK46 = await (0, leader_projection_1.validateCharacterLeaderProjectionArtifact)({ artifactRoot: options.k46Root, sidecarRoot: options.sidecarRoot, productionRoot: options.productionRoot, fyiRoot: options.fyiRoot, k43Root: options.k43Root });
        const k46Identity = (0, leader_association_scope_source_1.compactK46LeaderAssociationSource)(validatedK46.artifacts).identity;
        let k3 = await (0, leader_association_scope_source_1.loadPinnedK3LeaderAssociationSource)(options.sidecarRoot);
        const k3Identity = k3.identity;
        let built = (0, leader_association_projection_1.buildCharacterLeaderAssociationProjection)(validatedK46.artifacts, k3, k47);
        validatedK46 = undefined;
        k3 = undefined;
        global.gc();
        rss.sample();
        let reloadedK3 = await (0, leader_association_scope_source_1.loadPinnedK3LeaderAssociationSource)(options.sidecarRoot);
        (0, leader_association_scope_source_1.assertLeaderAssociationK3Stable)(k3Identity, reloadedK3.identity);
        reloadedK3 = undefined;
        let revalidatedK46 = await (0, leader_projection_1.validateCharacterLeaderProjectionArtifact)({ artifactRoot: options.k46Root, sidecarRoot: options.sidecarRoot, productionRoot: options.productionRoot, fyiRoot: options.fyiRoot, k43Root: options.k43Root });
        (0, leader_association_scope_source_1.assertLeaderAssociationK46Stable)(k46Identity, (0, leader_association_scope_source_1.compactK46LeaderAssociationSource)(revalidatedK46.artifacts).identity);
        revalidatedK46 = undefined;
        global.gc();
        rss.sample();
        let first = (0, leader_association_projection_1.materializeCharacterLeaderAssociationProjection)(built.dataset, built.coverage);
        let second = (0, leader_association_projection_1.materializeCharacterLeaderAssociationProjection)(built.dataset, built.coverage);
        if (!first.raw.equals(second.raw) || !first.gzip.equals(second.gzip) || !first.coverageBytes.equals(second.coverageBytes)
            || !first.validationBytes.equals(second.validationBytes) || !first.manifestBytes.equals(second.manifestBytes))
            throw new Error("K48 two materializations are not byte-identical");
        first = undefined;
        global.gc();
        rss.sample();
        const written = await writeCharacterLeaderAssociationProjectionArtifacts(options.outputRoot, second);
        built = undefined;
        second = undefined;
        global.gc();
        const validated = await (0, leader_association_projection_1.validateCharacterLeaderAssociationProjectionArtifact)({ artifactRoot: written.outputRoot, ...scopeOptions });
        rss.sample();
        const peakRssBytes = rss.stop();
        return {
            outputRoot: written.outputRoot, manifest: validated.artifacts.manifest, coverage: validated.artifacts.coverage,
            validation: validated.artifacts.validation, manifestSha256: hash(validated.artifacts.manifestBytes),
            manifestSizeBytes: validated.artifacts.manifestBytes.length, twoMaterializationsByteIdentical: true,
            sourcesReloadedAfterBuild: true, k47StructuralAssociationScope: "GO", sourceBoundValidation: "GO", peakRssBytes,
        };
    }
    finally {
        rss.dispose();
    }
}
exports.runCharacterLeaderAssociationProjection = runCharacterLeaderAssociationProjection;
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
    throw new Error(`K48 requires ${name}`); return result; }
function parseCharacterLeaderAssociationProjectionCli(args) {
    const roots = ["--sidecar-root", "--production-root", "--fyi-root", "--k43-root", "--k46-root", "--output-root"];
    const allowed = new Set(["--opt-in-k48", ...roots]);
    for (let index = 0; index < args.length; index++) {
        const argument = args[index];
        if (!allowed.has(argument))
            throw new Error(`K48 unsupported argument ${argument}`);
        if (argument !== "--opt-in-k48") {
            const next = args[index + 1];
            if (!next || next.startsWith("--"))
                throw new Error(`missing value for ${argument}`);
            index++;
        }
    }
    if (args.filter(item => item === "--opt-in-k48").length !== 1)
        throw new Error("K48 requires exactly one --opt-in-k48");
    return {
        optIn: true, sidecarRoot: required(args, "--sidecar-root"), productionRoot: required(args, "--production-root"),
        fyiRoot: required(args, "--fyi-root"), k43Root: required(args, "--k43-root"), k46Root: required(args, "--k46-root"),
        outputRoot: required(args, "--output-root"),
    };
}
exports.parseCharacterLeaderAssociationProjectionCli = parseCharacterLeaderAssociationProjectionCli;
async function run() {
    const result = await runCharacterLeaderAssociationProjection(parseCharacterLeaderAssociationProjectionCli(process.argv.slice(2)));
    const stdout = `${JSON.stringify(result, null, 2)}\n`;
    if (Buffer.byteLength(stdout) >= leader_association_projection_contract_1.CHARACTER_LEADER_ASSOCIATION_PROJECTION_METADATA_LIMIT_BYTES)
        throw new Error("K48 stdout metadata limit reached");
    process.stdout.write(stdout);
}
if (require.main === module)
    run().catch(error => { console.error(error); process.exitCode = 1; });
//# sourceMappingURL=leader-association-projection-run.js.map