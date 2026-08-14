"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCharacterStateProductProjectionCli = exports.runCharacterStateProductProjection = exports.validateCharacterStateProductProjectionRootSeparation = exports.validateCharacterStateProductProjectionOutputRoot = void 0;
const fs_1 = require("fs");
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const shadow_source_1 = require("./shadow-source");
const state_product_scope_1 = require("./state-product-scope");
const state_product_scope_run_1 = require("./state-product-scope-run");
const state_product_projection_contract_1 = require("./state-product-projection-contract");
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
        this.exceeded ||= this.peak >= state_product_projection_contract_1.CHARACTER_STATE_PRODUCT_PROJECTION_RSS_LIMIT_BYTES;
    }
    sample() {
        this.observe();
        if (this.exceeded)
            throw new Error(`K43 RSS limit reached: ${this.peak}`);
    }
    stop() { clearInterval(this.timer); this.sample(); return this.peak; }
    dispose() { clearInterval(this.timer); }
}
async function inspectRoot(value, label = "output root") {
    const path = (0, path_1.resolve)(value);
    const metadata = await (0, promises_1.lstat)(path);
    if (!metadata.isDirectory() || metadata.isSymbolicLink())
        throw new Error(`K43 ${label} must be an existing regular non-link directory`);
    const canonical = await (0, promises_1.realpath)(path);
    if (!samePath(path, canonical))
        throw new Error(`K43 ${label} symlink or junction rejected`);
    return { path, realPath: canonical, dev: metadata.dev, ino: metadata.ino };
}
function containsPath(parent, child) {
    const value = (0, path_1.relative)(parent, child);
    return value === "" || (value !== ".." && !value.startsWith(`..${path_1.sep}`) && !(0, path_1.isAbsolute)(value));
}
async function inspectSeparatedRoots(options) {
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
async function validateCharacterStateProductProjectionOutputRoot(value) {
    const root = await inspectRoot(value);
    await checkpoint(root);
}
exports.validateCharacterStateProductProjectionOutputRoot = validateCharacterStateProductProjectionOutputRoot;
async function validateCharacterStateProductProjectionRootSeparation(options) {
    const root = await inspectSeparatedRoots(options);
    await checkpoint(root);
}
exports.validateCharacterStateProductProjectionRootSeparation = validateCharacterStateProductProjectionRootSeparation;
async function checkpoint(root) {
    const actual = await inspectRoot(root.path);
    if (!samePath(root.realPath, actual.realPath) || root.dev !== actual.dev || root.ino !== actual.ino)
        throw new Error("K43 output root identity changed");
}
function validName(name) {
    return name === state_product_projection_contract_1.CHARACTER_STATE_PRODUCT_PROJECTION_FILES.coverage || name === state_product_projection_contract_1.CHARACTER_STATE_PRODUCT_PROJECTION_FILES.validation
        || name === state_product_projection_contract_1.CHARACTER_STATE_PRODUCT_PROJECTION_FILES.manifest
        || /^database-characters-k43-state-product-projection\.[a-f0-9]{64}\.json\.gz$/.test(name);
}
async function writeCreateOnly(root, name, bytes) {
    if (!validName(name))
        throw new Error("K43 output member name rejected");
    await checkpoint(root);
    const path = (0, path_1.join)(root.path, name);
    if (!samePath(path, (0, path_1.resolve)(root.path, name)))
        throw new Error("K43 output member escaped root");
    const handle = await (0, promises_1.open)(path, fs_1.constants.O_CREAT | fs_1.constants.O_EXCL | fs_1.constants.O_RDWR | (fs_1.constants.O_NOFOLLOW ?? 0), 0o600);
    let completed = false;
    let opened;
    try {
        await handle.writeFile(bytes);
        await handle.sync();
        opened = await handle.stat();
        const visible = await (0, promises_1.lstat)(path);
        if (!opened.isFile() || opened.nlink !== 1 || opened.size !== bytes.length || !sameFile(opened, visible))
            throw new Error("K43 create-only member identity rejected");
        completed = true;
    }
    finally {
        if (!opened) {
            try {
                opened = await handle.stat();
            }
            catch { /* The handle has no provable identity. */ }
        }
        await handle.close();
        if (!completed && opened) {
            try {
                await checkpoint(root);
                const visible = await (0, promises_1.lstat)(path);
                if (sameFile(opened, visible))
                    await (0, promises_1.unlink)(path);
            }
            catch { /* Preserve a target whose identity cannot be proved. */ }
        }
    }
    await checkpoint(root);
    return path;
}
async function removeOwned(root, path, bytes) {
    try {
        await checkpoint(root);
        const before = await (0, promises_1.lstat)(path);
        if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || before.size !== bytes.length)
            return;
        const handle = await (0, promises_1.open)(path, fs_1.constants.O_RDONLY | (fs_1.constants.O_NOFOLLOW ?? 0));
        try {
            const opened = await handle.stat();
            if (!sameFile(before, opened) || !(await handle.readFile()).equals(bytes))
                return;
        }
        finally {
            await handle.close();
        }
        await (0, promises_1.unlink)(path);
    }
    catch { /* Preserve any target whose ownership cannot be proved. */ }
}
async function removeOwnedIdentity(root, member) {
    try {
        await checkpoint(root);
        const before = await (0, promises_1.lstat)(member.path);
        if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || before.size !== member.sizeBytes)
            return;
        const handle = await (0, promises_1.open)(member.path, fs_1.constants.O_RDONLY | (fs_1.constants.O_NOFOLLOW ?? 0));
        try {
            const opened = await handle.stat();
            if (!sameFile(before, opened) || hash(await handle.readFile()) !== member.sha256)
                return;
        }
        finally {
            await handle.close();
        }
        await (0, promises_1.unlink)(member.path);
    }
    catch { /* Preserve any target whose ownership cannot be proved. */ }
}
async function writeCharacterStateProductProjectionArtifacts(outputRoot, artifacts) {
    const authorized = (0, state_product_projection_1.materializeCharacterStateProductProjection)(artifacts.dataset, artifacts.coverage);
    if (!authorized.gzip.equals(artifacts.gzip) || !authorized.coverageBytes.equals(artifacts.coverageBytes)
        || !authorized.validationBytes.equals(artifacts.validationBytes) || !authorized.manifestBytes.equals(artifacts.manifestBytes)) {
        throw new Error("K43 output artifact set is not canonical");
    }
    const root = await inspectRoot(outputRoot);
    const files = [
        { name: artifacts.manifest.fileName, bytes: artifacts.gzip },
        { name: state_product_projection_contract_1.CHARACTER_STATE_PRODUCT_PROJECTION_FILES.coverage, bytes: artifacts.coverageBytes },
        { name: state_product_projection_contract_1.CHARACTER_STATE_PRODUCT_PROJECTION_FILES.validation, bytes: artifacts.validationBytes },
        { name: state_product_projection_contract_1.CHARACTER_STATE_PRODUCT_PROJECTION_FILES.manifest, bytes: artifacts.manifestBytes },
    ];
    for (const file of files) {
        try {
            await (0, promises_1.lstat)((0, path_1.join)(root.path, file.name));
            throw new Error(`K43 output already exists: ${file.name}`);
        }
        catch (error) {
            if (error?.code !== "ENOENT")
                throw error;
        }
    }
    const created = [];
    try {
        for (const file of files)
            created.push({ path: await writeCreateOnly(root, file.name, file.bytes), bytes: file.bytes });
        return {
            outputRoot: root.path,
            root,
            members: created.map(item => ({ path: item.path, sizeBytes: item.bytes.length, sha256: hash(item.bytes) })),
        };
    }
    catch (error) {
        for (const item of created.reverse())
            await removeOwned(root, item.path, item.bytes);
        throw error;
    }
}
async function runCharacterStateProductProjection(options) {
    if (options?.optIn !== true)
        throw new Error("K43 requires explicit opt-in");
    if (!options.sidecarRoot || !options.productionRoot || !options.fyiRoot || !options.outputRoot)
        throw new Error("K43 requires all explicit roots");
    const rss = new RssGuard();
    try {
        await validateCharacterStateProductProjectionRootSeparation(options);
        const sourceOptions = { sidecarRoot: options.sidecarRoot, productionRoot: options.productionRoot, fyiRoot: options.fyiRoot };
        const k42 = await (0, state_product_scope_run_1.runCharacterStateProductScopeAudit)({ optIn: true, ...sourceOptions });
        rss.sample();
        if (global.gc)
            global.gc();
        let before = await (0, shadow_source_1.loadCharacterShadowInputs)(sourceOptions);
        if ((0, state_product_scope_1.fingerprintCharacterStateProductScopeInputs)(before) !== k42.sources.fingerprintSha256)
            throw new Error("K43 K42/source drift before build");
        let built = (0, state_product_projection_1.buildCharacterStateProductProjection)(before, k42);
        before = undefined;
        if (global.gc)
            global.gc();
        let after = await (0, shadow_source_1.loadCharacterShadowInputs)(sourceOptions);
        if ((0, state_product_scope_1.fingerprintCharacterStateProductScopeInputs)(after) !== k42.sources.fingerprintSha256)
            throw new Error("K43 structural source fingerprint changed after build");
        after = undefined;
        if (global.gc)
            global.gc();
        rss.sample();
        let first = (0, state_product_projection_1.materializeCharacterStateProductProjection)(built.dataset, built.coverage);
        let second = (0, state_product_projection_1.materializeCharacterStateProductProjection)(built.dataset, built.coverage);
        rss.sample();
        if (!first.raw.equals(second.raw) || !first.gzip.equals(second.gzip) || !first.coverageBytes.equals(second.coverageBytes)
            || !first.validationBytes.equals(second.validationBytes) || !first.manifestBytes.equals(second.manifestBytes)) {
            throw new Error("K43 two materializations are not byte-identical");
        }
        first = undefined;
        if (global.gc)
            global.gc();
        const written = await writeCharacterStateProductProjectionArtifacts(options.outputRoot, second);
        built = undefined;
        second = undefined;
        if (global.gc)
            global.gc();
        try {
            const validated = await (0, state_product_projection_1.validateCharacterStateProductProjectionArtifact)({ artifactRoot: written.outputRoot, ...sourceOptions });
            rss.sample();
            const peakRssBytes = rss.stop();
            return {
                outputRoot: written.outputRoot, manifest: validated.artifacts.manifest, coverage: validated.artifacts.coverage,
                validation: validated.artifacts.validation, manifestSha256: hash(validated.artifacts.manifestBytes),
                manifestSizeBytes: validated.artifacts.manifestBytes.length, twoMaterializationsByteIdentical: true,
                sourcesReloadedAfterBuild: true, sourceBoundValidation: "GO", peakRssBytes,
            };
        }
        catch (error) {
            for (const member of [...written.members].reverse())
                await removeOwnedIdentity(written.root, member);
            throw error;
        }
    }
    finally {
        rss.dispose();
    }
}
exports.runCharacterStateProductProjection = runCharacterStateProductProjection;
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
function required(args, name) {
    const result = value(args, name);
    if (!result)
        throw new Error(`K43 requires ${name}`);
    return result;
}
function parseCharacterStateProductProjectionCli(args) {
    const roots = ["--sidecar-root", "--production-root", "--fyi-root", "--output-root"];
    const allowed = new Set(["--opt-in-k43", ...roots]);
    for (let index = 0; index < args.length; index++) {
        const argument = args[index];
        if (!allowed.has(argument))
            throw new Error(`K43 unsupported argument ${argument}`);
        if (argument !== "--opt-in-k43") {
            const next = args[index + 1];
            if (!next || next.startsWith("--"))
                throw new Error(`missing value for ${argument}`);
            index++;
        }
    }
    if (args.filter(item => item === "--opt-in-k43").length !== 1)
        throw new Error("K43 requires exactly one --opt-in-k43");
    return { optIn: true, sidecarRoot: required(args, "--sidecar-root"), productionRoot: required(args, "--production-root"), fyiRoot: required(args, "--fyi-root"), outputRoot: required(args, "--output-root") };
}
exports.parseCharacterStateProductProjectionCli = parseCharacterStateProductProjectionCli;
async function run() {
    process.stdout.write(`${JSON.stringify(await runCharacterStateProductProjection(parseCharacterStateProductProjectionCli(process.argv.slice(2))), null, 2)}\n`);
}
if (require.main === module)
    run().catch(error => { console.error(error); process.exitCode = 1; });
//# sourceMappingURL=state-product-projection-run.js.map