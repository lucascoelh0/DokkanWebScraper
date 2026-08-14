"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCharacterStructuralSidecarCli = exports.runCharacterStructuralSidecar = exports.writeCharacterStructuralSidecarArtifacts = exports.validateCharacterStructuralOutputRoot = void 0;
const fs_1 = require("fs");
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const artifact_path_1 = require("./artifact-path");
const structural_sidecar_builder_1 = require("./structural-sidecar-builder");
const structural_sidecar_contract_1 = require("./structural-sidecar-contract");
const structural_sidecar_source_1 = require("./structural-sidecar-source");
const structural_sidecar_validator_1 = require("./structural-sidecar-validator");
const RSS_LIMIT_BYTES = 1073741824;
const hash = (bytes) => (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
const samePath = (left, right) => process.platform === "win32"
    ? (0, path_1.resolve)(left).toLowerCase() === (0, path_1.resolve)(right).toLowerCase()
    : (0, path_1.resolve)(left) === (0, path_1.resolve)(right);
async function inspectOutputRoot(value) {
    const path = (0, path_1.resolve)(value);
    const metadata = await (0, promises_1.lstat)(path);
    if (!metadata.isDirectory() || metadata.isSymbolicLink())
        throw new Error("K32 output root must be an existing regular non-link directory");
    const canonical = await (0, promises_1.realpath)(path);
    if (!samePath(path, canonical))
        throw new Error("K32 output root symlink or junction rejected");
    return { path, realPath: canonical, dev: metadata.dev, ino: metadata.ino };
}
async function checkpoint(expected) {
    const actual = await inspectOutputRoot(expected.path);
    if (!samePath(actual.realPath, expected.realPath) || actual.dev !== expected.dev || actual.ino !== expected.ino)
        throw new Error("K32 output root identity changed");
}
async function validateCharacterStructuralOutputRoot(value) {
    const identity = await inspectOutputRoot(value);
    await checkpoint(identity);
}
exports.validateCharacterStructuralOutputRoot = validateCharacterStructuralOutputRoot;
async function createStagedFile(path, bytes) {
    const handle = await (0, promises_1.open)(path, fs_1.constants.O_CREAT | fs_1.constants.O_EXCL | fs_1.constants.O_RDWR | (fs_1.constants.O_NOFOLLOW ?? 0), 0o600);
    try {
        await handle.writeFile(bytes);
        await handle.sync();
        const metadata = await handle.stat();
        if (!metadata.isFile() || metadata.nlink !== 1 || metadata.size !== bytes.length)
            throw new Error("K32 staged output identity rejected");
    }
    finally {
        await handle.close();
    }
}
async function readKnownOutputFile(path, allowedLinkCounts) {
    const before = await (0, promises_1.lstat)(path);
    if (!before.isFile() || before.isSymbolicLink() || !allowedLinkCounts.includes(before.nlink))
        throw new Error("K32 cleanup target is not a known regular file");
    const handle = await (0, promises_1.open)(path, fs_1.constants.O_RDONLY | (fs_1.constants.O_NOFOLLOW ?? 0));
    try {
        const opened = await handle.stat();
        if (opened.dev !== before.dev || opened.ino !== before.ino || !allowedLinkCounts.includes(opened.nlink))
            throw new Error("K32 cleanup target identity changed");
        return await handle.readFile();
    }
    finally {
        await handle.close();
    }
}
async function safelyCleanStaging(staged, fileNames, outputRoot) {
    try {
        await checkpoint(outputRoot);
        const actual = await inspectOutputRoot(staged.path);
        if (actual.dev !== staged.dev || actual.ino !== staged.ino || !samePath(actual.realPath, staged.realPath))
            return false;
        for (const fileName of fileNames) {
            const path = (0, path_1.join)(staged.path, fileName);
            try {
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
        await checkpoint(outputRoot);
        return true;
    }
    catch {
        return false;
    }
}
async function safelyRemovePromoted(path, bytes, outputRoot) {
    try {
        await checkpoint(outputRoot);
        if (!samePath(path, (0, path_1.join)(outputRoot.path, path.split(/[\\/]/).pop())))
            return false;
        if (!(await readKnownOutputFile(path, [1, 2])).equals(bytes))
            return false;
        await (0, promises_1.unlink)(path);
        await checkpoint(outputRoot);
        return true;
    }
    catch {
        return false;
    }
}
async function assertTargetMissing(root, fileName) {
    const path = await (0, artifact_path_1.resolveDatabaseCharacterArtifactPath)({
        trustedRoot: root.path, untrustedPath: fileName, expectedType: "file", exactName: fileName, allowMissing: true,
    });
    if (!samePath(path, (0, path_1.join)(root.path, fileName)))
        throw new Error(`K32 output path escaped root: ${fileName}`);
    try {
        await (0, promises_1.lstat)(path);
        throw new Error(`K32 output already exists: ${fileName}`);
    }
    catch (error) {
        if (error?.code !== "ENOENT")
            throw error;
    }
    return path;
}
async function writeCharacterStructuralSidecarArtifacts(outputRootValue, artifacts) {
    const outputRoot = await inspectOutputRoot(outputRootValue);
    const files = [
        { name: structural_sidecar_contract_1.CHARACTER_STRUCTURAL_SIDECAR_FILES.payload, bytes: artifacts.gzip },
        { name: structural_sidecar_contract_1.CHARACTER_STRUCTURAL_SIDECAR_FILES.coverage, bytes: artifacts.coverageBytes },
        { name: structural_sidecar_contract_1.CHARACTER_STRUCTURAL_SIDECAR_FILES.validation, bytes: artifacts.validationBytes },
        { name: structural_sidecar_contract_1.CHARACTER_STRUCTURAL_SIDECAR_FILES.manifest, bytes: artifacts.manifestBytes },
    ];
    const targets = new Map();
    for (const file of files)
        targets.set(file.name, await assertTargetMissing(outputRoot, file.name));
    const stagingPath = (0, path_1.join)(outputRoot.path, `.k32-staging-${process.pid}-${(0, crypto_1.randomBytes)(16).toString("hex")}`);
    await checkpoint(outputRoot);
    await (0, promises_1.mkdir)(stagingPath, { mode: 0o700 });
    const staged = await inspectOutputRoot(stagingPath);
    const promoted = [];
    try {
        for (const file of files) {
            await checkpoint(outputRoot);
            await createStagedFile((0, path_1.join)(staged.path, file.name), file.bytes);
        }
        for (const file of files) {
            await checkpoint(outputRoot);
            await assertTargetMissing(outputRoot, file.name);
            const target = targets.get(file.name);
            const stagedPath = (0, path_1.join)(staged.path, file.name);
            await (0, promises_1.link)(stagedPath, target);
            promoted.push({ path: target, bytes: file.bytes });
            const linked = await (0, promises_1.lstat)(target);
            if (!linked.isFile() || linked.isSymbolicLink() || linked.nlink !== 2 || linked.size !== file.bytes.length)
                throw new Error(`K32 linked output rejected: ${file.name}`);
            await (0, promises_1.unlink)(stagedPath);
            const promotedMetadata = await (0, promises_1.lstat)(target);
            if (!promotedMetadata.isFile() || promotedMetadata.isSymbolicLink() || promotedMetadata.nlink !== 1 || promotedMetadata.size !== file.bytes.length)
                throw new Error(`K32 promoted output rejected: ${file.name}`);
        }
        if (!await safelyCleanStaging(staged, files.map(file => file.name), outputRoot))
            throw new Error("K32 staging cleanup could not be proved safe");
        await checkpoint(outputRoot);
        return outputRoot.path;
    }
    catch (error) {
        for (const item of promoted.reverse())
            await safelyRemovePromoted(item.path, item.bytes, outputRoot);
        await safelyCleanStaging(staged, files.map(file => file.name), outputRoot);
        throw error;
    }
}
exports.writeCharacterStructuralSidecarArtifacts = writeCharacterStructuralSidecarArtifacts;
function sameArtifacts(left, right) {
    return left.raw.equals(right.raw) && left.gzip.equals(right.gzip) && left.coverageBytes.equals(right.coverageBytes)
        && left.validationBytes.equals(right.validationBytes) && left.manifestBytes.equals(right.manifestBytes);
}
async function runCharacterStructuralSidecar(options) {
    if (options?.optIn !== true)
        throw new Error("K32 requires explicit opt-in");
    let peakRssBytes = process.memoryUsage().rss;
    const monitor = setInterval(() => { peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss); }, 25);
    const sample = () => {
        peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss);
        if (peakRssBytes >= RSS_LIMIT_BYTES)
            throw new Error(`K32 RSS budget exceeded: ${peakRssBytes}`);
    };
    try {
        await validateCharacterStructuralOutputRoot(options.outputRoot);
        let source = await (0, structural_sidecar_source_1.loadCharacterStructuralSidecarSource)(options);
        sample();
        const build = () => {
            if (!source)
                throw new Error("K32 generation source was released");
            const { sidecar, coverage } = (0, structural_sidecar_builder_1.buildCharacterStructuralSidecar)(source.taxonomy, source.productive, source.lineage);
            const result = (0, structural_sidecar_validator_1.materializeCharacterStructuralSidecar)(sidecar, coverage);
            sample();
            return result;
        };
        let first = build();
        await source.revalidate();
        sample();
        const firstIdentity = { manifest: Buffer.from(first.manifestBytes), payload: Buffer.from(first.gzip) };
        if (global.gc)
            global.gc();
        let second = build();
        await source.revalidate();
        sample();
        if (!firstIdentity.manifest.equals(second.manifestBytes) || !firstIdentity.payload.equals(second.gzip) || !sameArtifacts(first, second)) {
            throw new Error("K32 two-generation byte identity failed");
        }
        first = undefined;
        const outputRoot = await writeCharacterStructuralSidecarArtifacts(options.outputRoot, second);
        await source.revalidate();
        sample();
        second = undefined;
        source = undefined;
        if (global.gc)
            global.gc();
        const validated = await (0, structural_sidecar_validator_1.validateCharacterStructuralSidecarArtifact)({
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
    }
    finally {
        clearInterval(monitor);
    }
}
exports.runCharacterStructuralSidecar = runCharacterStructuralSidecar;
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
        throw new Error(`K32 requires ${name}`);
    return value;
}
function parseCharacterStructuralSidecarCli(args) {
    const allowed = new Set(["--opt-in-k32", "--k2-root", "--productive-root", "--output-root"]);
    for (let index = 0; index < args.length; index++) {
        const argument = args[index];
        if (!allowed.has(argument))
            throw new Error(`K32 unsupported argument ${argument}`);
        if (argument !== "--opt-in-k32") {
            const value = args[index + 1];
            if (!value || value.startsWith("--"))
                throw new Error(`missing value for ${argument}`);
            index++;
        }
    }
    if (args.filter(value => value === "--opt-in-k32").length !== 1)
        throw new Error("K32 requires one explicit --opt-in-k32");
    return {
        optIn: true,
        k2Root: required(args, "--k2-root"),
        productiveRoot: required(args, "--productive-root"),
        outputRoot: required(args, "--output-root"),
    };
}
exports.parseCharacterStructuralSidecarCli = parseCharacterStructuralSidecarCli;
async function run() {
    const result = await runCharacterStructuralSidecar(parseCharacterStructuralSidecarCli(process.argv.slice(2)));
    console.log(JSON.stringify(result, null, 2));
}
if (require.main === module)
    run().catch(error => { console.error(error); process.exitCode = 1; });
//# sourceMappingURL=structural-sidecar-run.js.map