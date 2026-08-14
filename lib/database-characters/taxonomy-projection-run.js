"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseTaxonomyProjectionCli = exports.runTaxonomyProjection = exports.writeTaxonomyProjectionArtifacts = exports.validateTaxonomyProjectionOutputRoot = void 0;
const fs_1 = require("fs");
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const card_scope_run_1 = require("./card-scope-run");
const structural_sidecar_validator_1 = require("./structural-sidecar-validator");
const taxonomy_projection_builder_1 = require("./taxonomy-projection-builder");
const taxonomy_projection_contract_1 = require("./taxonomy-projection-contract");
const taxonomy_projection_validator_1 = require("./taxonomy-projection-validator");
const hash = (bytes) => (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
const samePath = (left, right) => process.platform === "win32"
    ? (0, path_1.resolve)(left).toLowerCase() === (0, path_1.resolve)(right).toLowerCase()
    : (0, path_1.resolve)(left) === (0, path_1.resolve)(right);
class RssGuard {
    peak = process.memoryUsage().rss;
    exceeded = false;
    timer = setInterval(() => this.observe(), 10);
    constructor() { this.timer.unref(); }
    observe() {
        this.peak = Math.max(this.peak, process.memoryUsage().rss);
        this.exceeded ||= this.peak >= taxonomy_projection_contract_1.TAXONOMY_PROJECTION_RSS_LIMIT_BYTES;
    }
    sample(nestedPeak = 0) {
        this.observe();
        this.peak = Math.max(this.peak, nestedPeak);
        this.exceeded ||= this.peak >= taxonomy_projection_contract_1.TAXONOMY_PROJECTION_RSS_LIMIT_BYTES;
        if (this.exceeded)
            throw new Error(`K35 RSS limit reached: ${this.peak}`);
    }
    stop() { clearInterval(this.timer); this.sample(); return this.peak; }
    dispose() { clearInterval(this.timer); }
}
async function inspectOutputRoot(value) {
    const path = (0, path_1.resolve)(value);
    const metadata = await (0, promises_1.lstat)(path);
    if (!metadata.isDirectory() || metadata.isSymbolicLink())
        throw new Error("K35 output root must be an existing regular non-link directory");
    const canonical = await (0, promises_1.realpath)(path);
    if (!samePath(path, canonical))
        throw new Error("K35 output root symlink or junction rejected");
    return { path, realPath: canonical, dev: metadata.dev, ino: metadata.ino };
}
async function checkpoint(expected) {
    const actual = await inspectOutputRoot(expected.path);
    if (!samePath(actual.realPath, expected.realPath) || actual.dev !== expected.dev || actual.ino !== expected.ino) {
        throw new Error("K35 output root identity changed");
    }
}
async function validateTaxonomyProjectionOutputRoot(value) {
    const root = await inspectOutputRoot(value);
    await checkpoint(root);
}
exports.validateTaxonomyProjectionOutputRoot = validateTaxonomyProjectionOutputRoot;
function validOutputName(fileName) {
    return fileName === taxonomy_projection_contract_1.TAXONOMY_PROJECTION_FILES.manifest || fileName === taxonomy_projection_contract_1.TAXONOMY_PROJECTION_FILES.coverage
        || fileName === taxonomy_projection_contract_1.TAXONOMY_PROJECTION_FILES.validation
        || /^database-characters-k35-taxonomy-projection\.[a-f0-9]{64}\.json\.gz$/.test(fileName);
}
async function targetMissing(root, fileName) {
    if (!validOutputName(fileName))
        throw new Error(`K35 output name rejected: ${fileName}`);
    const path = (0, path_1.join)(root.path, fileName);
    if (!samePath(path, (0, path_1.resolve)(root.path, fileName)))
        throw new Error(`K35 output path escaped root: ${fileName}`);
    try {
        await (0, promises_1.lstat)(path);
        throw new Error(`K35 output already exists: ${fileName}`);
    }
    catch (error) {
        if (error?.code !== "ENOENT")
            throw error;
    }
    return path;
}
async function createStagedFile(path, bytes) {
    const handle = await (0, promises_1.open)(path, fs_1.constants.O_CREAT | fs_1.constants.O_EXCL | fs_1.constants.O_RDWR | (fs_1.constants.O_NOFOLLOW ?? 0), 0o600);
    try {
        await handle.writeFile(bytes);
        await handle.sync();
        const metadata = await handle.stat();
        if (!metadata.isFile() || metadata.nlink !== 1 || metadata.size !== bytes.length)
            throw new Error("K35 staged output identity rejected");
    }
    finally {
        await handle.close();
    }
}
async function readKnownFile(path, allowedLinkCounts) {
    const before = await (0, promises_1.lstat)(path);
    if (!before.isFile() || before.isSymbolicLink() || !allowedLinkCounts.includes(before.nlink))
        throw new Error("K35 cleanup target rejected");
    const handle = await (0, promises_1.open)(path, fs_1.constants.O_RDONLY | (fs_1.constants.O_NOFOLLOW ?? 0));
    try {
        const opened = await handle.stat();
        if (opened.dev !== before.dev || opened.ino !== before.ino || !allowedLinkCounts.includes(opened.nlink)) {
            throw new Error("K35 cleanup target identity changed");
        }
        return await handle.readFile();
    }
    finally {
        await handle.close();
    }
}
async function safelyCleanStaging(staged, names, root) {
    try {
        await checkpoint(root);
        const actual = await inspectOutputRoot(staged.path);
        if (actual.dev !== staged.dev || actual.ino !== staged.ino || !samePath(actual.realPath, staged.realPath))
            return false;
        for (const name of names) {
            try {
                const path = (0, path_1.join)(staged.path, name);
                const metadata = await (0, promises_1.lstat)(path);
                if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.nlink !== 1)
                    return false;
                await (0, promises_1.unlink)(path);
            }
            catch (error) {
                if (error?.code !== "ENOENT")
                    return false;
            }
        }
        await (0, promises_1.rmdir)(staged.path);
        await checkpoint(root);
        return true;
    }
    catch {
        return false;
    }
}
async function safelyRemovePromoted(path, bytes, root) {
    try {
        await checkpoint(root);
        if (!samePath(path, (0, path_1.join)(root.path, path.split(/[\\/]/).pop())))
            return false;
        if (!(await readKnownFile(path, [1, 2])).equals(bytes))
            return false;
        await (0, promises_1.unlink)(path);
        await checkpoint(root);
        return true;
    }
    catch {
        return false;
    }
}
async function writeTaxonomyProjectionArtifacts(outputRootValue, artifacts) {
    const authorized = (0, taxonomy_projection_validator_1.materializeTaxonomyProjection)(artifacts.projection, artifacts.coverage);
    if (!sameArtifacts(artifacts, authorized))
        throw new Error("K35 output requires the exact pinned artifact set");
    const root = await inspectOutputRoot(outputRootValue);
    const files = [
        { name: artifacts.manifest.fileName, bytes: artifacts.gzip },
        { name: taxonomy_projection_contract_1.TAXONOMY_PROJECTION_FILES.coverage, bytes: artifacts.coverageBytes },
        { name: taxonomy_projection_contract_1.TAXONOMY_PROJECTION_FILES.validation, bytes: artifacts.validationBytes },
        { name: taxonomy_projection_contract_1.TAXONOMY_PROJECTION_FILES.manifest, bytes: artifacts.manifestBytes },
    ];
    const targets = new Map();
    for (const file of files)
        targets.set(file.name, await targetMissing(root, file.name));
    const stagingPath = (0, path_1.join)(root.path, `.k35-staging-${process.pid}-${(0, crypto_1.randomBytes)(16).toString("hex")}`);
    await checkpoint(root);
    await (0, promises_1.mkdir)(stagingPath, { mode: 0o700 });
    const staged = await inspectOutputRoot(stagingPath);
    const promoted = [];
    try {
        for (const file of files) {
            await checkpoint(root);
            await createStagedFile((0, path_1.join)(staged.path, file.name), file.bytes);
        }
        for (const file of files) {
            await checkpoint(root);
            await targetMissing(root, file.name);
            const stagedPath = (0, path_1.join)(staged.path, file.name);
            const target = targets.get(file.name);
            await (0, promises_1.link)(stagedPath, target);
            promoted.push({ path: target, bytes: file.bytes });
            const linked = await (0, promises_1.lstat)(target);
            if (!linked.isFile() || linked.isSymbolicLink() || linked.nlink !== 2 || linked.size !== file.bytes.length) {
                throw new Error(`K35 linked output rejected: ${file.name}`);
            }
            await (0, promises_1.unlink)(stagedPath);
            const final = await (0, promises_1.lstat)(target);
            if (!final.isFile() || final.isSymbolicLink() || final.nlink !== 1 || final.size !== file.bytes.length) {
                throw new Error(`K35 promoted output rejected: ${file.name}`);
            }
        }
        if (!await safelyCleanStaging(staged, files.map(file => file.name), root))
            throw new Error("K35 staging cleanup could not be proved safe");
        await checkpoint(root);
        return root.path;
    }
    catch (error) {
        for (const item of promoted.reverse())
            await safelyRemovePromoted(item.path, item.bytes, root);
        await safelyCleanStaging(staged, files.map(file => file.name), root);
        throw error;
    }
}
exports.writeTaxonomyProjectionArtifacts = writeTaxonomyProjectionArtifacts;
function sameArtifacts(left, right) {
    return left.raw.equals(right.raw) && left.gzip.equals(right.gzip) && left.coverageBytes.equals(right.coverageBytes)
        && left.validationBytes.equals(right.validationBytes) && left.manifestBytes.equals(right.manifestBytes);
}
async function runTaxonomyProjection(options) {
    if (options?.optIn !== true)
        throw new Error("K35 requires explicit opt-in");
    if (!options.outputRoot || !options.k32Root || !options.k2Root || !options.productiveRoot || !options.sqliteRoot
        || !options.db1Root || !options.elfRoot || !options.nativeEvidenceRoot) {
        throw new Error("K35 requires explicit output, K32, K2, productive, SQLite, DB1, ELF and native-evidence roots");
    }
    const rss = new RssGuard();
    try {
        await validateTaxonomyProjectionOutputRoot(options.outputRoot);
        const k32Before = await (0, structural_sidecar_validator_1.validateCharacterStructuralSidecarArtifact)({
            artifactRoot: options.k32Root,
            k2Root: options.k2Root,
            productiveRoot: options.productiveRoot,
        });
        rss.sample();
        const k34Before = await (0, card_scope_run_1.runCardScopeAudit)({
            optIn: true,
            sqliteRoot: options.sqliteRoot,
            db1Root: options.db1Root,
            k2Root: options.k2Root,
            elfRoot: options.elfRoot,
            nativeEvidenceRoot: options.nativeEvidenceRoot,
        });
        rss.sample(k34Before.peakRssBytes);
        const sources = {
            k32: k32Before,
            k34Report: JSON.parse(k34Before.stdout),
            k34Stdout: k34Before.stdout,
        };
        const generate = () => {
            const built = (0, taxonomy_projection_builder_1.buildTaxonomyProjection)(sources);
            const artifacts = (0, taxonomy_projection_validator_1.materializeTaxonomyProjection)(built.projection, built.coverage);
            rss.sample();
            return artifacts;
        };
        let first = generate();
        if (global.gc)
            global.gc();
        const second = generate();
        if (!sameArtifacts(first, second))
            throw new Error("K35 two-generation byte identity failed");
        first = undefined;
        if (global.gc)
            global.gc();
        const outputRoot = await writeTaxonomyProjectionArtifacts(options.outputRoot, second);
        rss.sample();
        const validated = await (0, taxonomy_projection_validator_1.validateTaxonomyProjectionArtifact)({
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
    }
    finally {
        rss.dispose();
    }
}
exports.runTaxonomyProjection = runTaxonomyProjection;
function argumentValue(args, name) {
    const indexes = args.flatMap((value, index) => value === name ? [index] : []);
    if (indexes.length > 1)
        throw new Error(`duplicate ${name}`);
    if (!indexes.length)
        return undefined;
    const value = args[indexes[0] + 1];
    if (!value || value.startsWith("--"))
        throw new Error(`missing value for ${name}`);
    return value;
}
function required(args, name) {
    const value = argumentValue(args, name);
    if (!value)
        throw new Error(`K35 requires ${name}`);
    return value;
}
function parseTaxonomyProjectionCli(args) {
    const roots = ["--k32-root", "--k2-root", "--productive-root", "--sqlite-root", "--db1-root", "--elf-root", "--native-evidence-root", "--output-root"];
    const allowed = new Set(["--opt-in-k35", ...roots]);
    for (let index = 0; index < args.length; index++) {
        const argument = args[index];
        if (!allowed.has(argument))
            throw new Error(`K35 unsupported argument ${argument}`);
        if (argument !== "--opt-in-k35") {
            const value = args[index + 1];
            if (!value || value.startsWith("--"))
                throw new Error(`missing value for ${argument}`);
            index++;
        }
    }
    if (args.filter(value => value === "--opt-in-k35").length !== 1)
        throw new Error("K35 requires exactly one --opt-in-k35");
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
exports.parseTaxonomyProjectionCli = parseTaxonomyProjectionCli;
async function run() {
    const result = await runTaxonomyProjection(parseTaxonomyProjectionCli(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.stderr.write(`K35 peak RSS bytes: ${result.peakRssBytes}\n`);
}
if (require.main === module)
    run().catch(error => { console.error(error); process.exitCode = 1; });
//# sourceMappingURL=taxonomy-projection-run.js.map