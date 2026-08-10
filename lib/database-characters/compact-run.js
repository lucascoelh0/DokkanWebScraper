"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateCharacterCompactOutputPath = exports.validateCharacterCompactCliArguments = void 0;
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const crypto_1 = require("crypto");
const path_1 = require("path");
const zlib_1 = require("zlib");
const artifact_1 = require("./artifact");
const compact_builder_1 = require("./compact-builder");
const compact_contract_1 = require("./compact-contract");
const compact_source_1 = require("./compact-source");
const compact_validator_1 = require("./compact-validator");
const CHARACTER_COMPACT_CLI_OUTPUT_DIRECTORY = "data/database-characters/compact";
const RUN_REPORT_FILE = "database-characters-k15-run-report.json";
const TEST_HOOK = Symbol.for("dokkan.k15.compact-run.test-hook");
const jsonBytes = (input) => Buffer.from(`${JSON.stringify(input, null, 2)}\n`, "utf8");
const samePath = (left, right) => process.platform === "win32"
    ? (0, path_1.resolve)(left).toLowerCase() === (0, path_1.resolve)(right).toLowerCase()
    : (0, path_1.resolve)(left) === (0, path_1.resolve)(right);
const sameIdentity = (metadata, expected) => metadata.dev === expected.dev && metadata.ino === expected.ino;
async function invokeTestHook(point) {
    if (process.env.NODE_ENV !== "test")
        return;
    const hook = global[TEST_HOOK];
    if (hook)
        await hook(point);
}
function argumentValue(args, name) {
    const matches = args.reduce((indexes, item, index) => item === name ? [...indexes, index] : indexes, []);
    if (matches.length > 1)
        throw new Error(`duplicate ${name}`);
    if (!matches.length)
        return undefined;
    const result = args[matches[0] + 1];
    if (!result || result.startsWith("--"))
        throw new Error(`missing value for ${name}`);
    return result;
}
function validateCharacterCompactCliArguments(args) {
    if (args.some(argument => argument === "--output-dir" || argument.startsWith("--output-dir="))) {
        throw new Error("K15 --output-dir is not supported; productive output is repository-controlled");
    }
}
exports.validateCharacterCompactCliArguments = validateCharacterCompactCliArguments;
async function inspectDirectory(path, label) {
    const resolvedPath = (0, path_1.resolve)(path);
    const metadata = await (0, promises_1.lstat)(resolvedPath);
    if (!metadata.isDirectory() || metadata.isSymbolicLink())
        throw new Error(`K15 ${label} must be a regular non-link directory`);
    const canonicalPath = await (0, promises_1.realpath)(resolvedPath);
    if (!samePath(canonicalPath, resolvedPath))
        throw new Error(`K15 ${label} symlink, junction or reparse point rejected`);
    return { path: resolvedPath, realPath: canonicalPath, dev: metadata.dev, ino: metadata.ino };
}
async function assertDirectoryIdentity(expected, label) {
    const actual = await inspectDirectory(expected.path, label);
    if (!samePath(actual.realPath, expected.realPath) || actual.dev !== expected.dev || actual.ino !== expected.ino) {
        throw new Error(`K15 ${label} identity changed`);
    }
}
async function checkpoint(chain, point) {
    for (const identity of chain)
        await assertDirectoryIdentity(identity, "output path");
    if (point)
        await invokeTestHook(point);
    for (const identity of chain)
        await assertDirectoryIdentity(identity, "output path");
}
/** Validation-only API. It never creates or writes the supplied path. */
async function validateCharacterCompactOutputPath(path) {
    const identity = await inspectDirectory(path, "output path");
    await checkpoint([identity], "after-output-snapshot");
}
exports.validateCharacterCompactOutputPath = validateCharacterCompactOutputPath;
function characterCompactRepositoryRoot() {
    const parent = (0, path_1.resolve)(__dirname, "..");
    return (0, path_1.basename)(parent).toLowerCase() === "lib" ? (0, path_1.resolve)(parent, "..") : parent;
}
function productiveOutputPath() {
    return (0, path_1.join)(characterCompactRepositoryRoot(), ...CHARACTER_COMPACT_CLI_OUTPUT_DIRECTORY.split("/"));
}
async function ensureProductiveDirectoryChain() {
    const root = characterCompactRepositoryRoot();
    const paths = [root];
    let current = root;
    for (const segment of CHARACTER_COMPACT_CLI_OUTPUT_DIRECTORY.split("/")) {
        current = (0, path_1.join)(current, segment);
        paths.push(current);
    }
    const chain = [];
    for (let index = 0; index < paths.length; index++) {
        const path = paths[index];
        try {
            chain.push(await inspectDirectory(path, index === 0 ? "repository root" : "output path"));
        }
        catch (error) {
            if (index === 0 || error?.code !== "ENOENT")
                throw error;
            await checkpoint(chain, "before-output-directory-create");
            await (0, promises_1.mkdir)(path);
            chain.push(await inspectDirectory(path, "output path"));
        }
        await checkpoint(chain, "after-output-directory-check");
    }
    return chain;
}
async function holdDirectories(chain) {
    const handles = [];
    try {
        for (const identity of chain) {
            handles.push(await (0, promises_1.opendir)(identity.path));
            await checkpoint(chain, "after-directory-handle-open");
        }
        return handles;
    }
    catch (error) {
        for (const handle of handles.reverse())
            await handle.close().catch(() => undefined);
        throw error;
    }
}
async function inspectRegularFile(path, expected) {
    const metadata = await (0, promises_1.lstat)(path);
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.nlink !== 1)
        throw new Error("K15 output file must be a single-link regular file");
    if (expected && !sameIdentity(metadata, { path, realPath: path, dev: expected.dev, ino: expected.ino })) {
        throw new Error("K15 output file identity changed");
    }
    return metadata;
}
async function readExistingFile(path) {
    let before;
    try {
        before = await inspectRegularFile(path);
    }
    catch (error) {
        if (error?.code === "ENOENT")
            return undefined;
        throw error;
    }
    const noFollow = fs_1.constants.O_NOFOLLOW ?? 0;
    const handle = await (0, promises_1.open)(path, fs_1.constants.O_RDONLY | noFollow);
    try {
        const opened = await handle.stat();
        if (!opened.isFile() || opened.nlink !== 1 || !sameIdentity(opened, { path, realPath: path, dev: before.dev, ino: before.ino })) {
            throw new Error("K15 output file changed while opening");
        }
        await inspectRegularFile(path, opened);
        return await handle.readFile();
    }
    finally {
        await handle.close();
    }
}
async function createStagedFile(path, bytes, chain) {
    await checkpoint(chain, "before-staged-file-open");
    const noFollow = fs_1.constants.O_NOFOLLOW ?? 0;
    const handle = await (0, promises_1.open)(path, fs_1.constants.O_CREAT | fs_1.constants.O_EXCL | fs_1.constants.O_RDWR | noFollow, 0o600);
    try {
        const opened = await handle.stat();
        await checkpoint(chain, "after-staged-file-open");
        await inspectRegularFile(path, opened);
        await handle.writeFile(bytes);
        await handle.sync();
        const written = await handle.stat();
        if (written.size !== bytes.length || written.nlink !== 1 || !sameIdentity(written, { path, realPath: path, dev: opened.dev, ino: opened.ino })) {
            throw new Error("K15 staged file identity or size changed");
        }
        await checkpoint(chain, "after-staged-file-write");
        await inspectRegularFile(path, written);
    }
    finally {
        await handle.close();
    }
    const verified = await readExistingFile(path);
    if (!verified?.equals(bytes))
        throw new Error("K15 staged file bytes changed");
    await checkpoint(chain, "after-staged-file-verify");
}
async function removeStagedFile(path, chain) {
    await checkpoint(chain, "before-staged-file-remove");
    await inspectRegularFile(path);
    await (0, promises_1.unlink)(path);
    await checkpoint(chain, "after-staged-file-remove");
}
async function safelyCleanStaging(staging, names, parentChain) {
    const chain = [...parentChain, staging];
    try {
        await checkpoint(chain);
        for (const name of names) {
            const path = (0, path_1.join)(staging.path, name);
            try {
                await inspectRegularFile(path);
                await (0, promises_1.unlink)(path);
                await checkpoint(chain);
            }
            catch (error) {
                if (error?.code !== "ENOENT")
                    return false;
            }
        }
        await assertDirectoryIdentity(staging, "staging directory");
        await (0, promises_1.rmdir)(staging.path);
        await checkpoint(parentChain);
        return true;
    }
    catch {
        return false;
    }
}
async function writeProductiveFiles(files) {
    const release = compact_contract_1.CHARACTER_COMPACT_PINNED_RELEASE;
    const promotionOrder = [
        release.payloadFile,
        release.coverageFile,
        release.validationFile,
        release.readinessFile,
        RUN_REPORT_FILE,
        release.manifestFile,
    ];
    const filesByName = new Map(files.map(file => [file.name, file]));
    if (files.length !== promotionOrder.length || filesByName.size !== files.length
        || promotionOrder.some(name => !filesByName.has(name))) {
        throw new Error("K15 productive output file inventory rejected");
    }
    const orderedFiles = promotionOrder.map(name => filesByName.get(name));
    const parentChain = await ensureProductiveDirectoryChain();
    const output = parentChain[parentChain.length - 1];
    const stagingPath = (0, path_1.join)(output.path, `.k15-staging-${process.pid}-${(0, crypto_1.randomBytes)(16).toString("hex")}`);
    await checkpoint(parentChain, "before-staging-directory-create");
    await (0, promises_1.mkdir)(stagingPath, { mode: 0o700 });
    const staging = await inspectDirectory(stagingPath, "staging directory");
    const chain = [...parentChain, staging];
    await checkpoint(chain, "after-staging-directory-create");
    const heldDirectories = [];
    const stagedNames = [];
    try {
        heldDirectories.push(...await holdDirectories(parentChain));
        for (const file of orderedFiles) {
            stagedNames.push(file.name);
            await createStagedFile((0, path_1.join)(staging.path, file.name), file.bytes, chain);
        }
        for (const file of orderedFiles) {
            const stagedPath = (0, path_1.join)(staging.path, file.name);
            const finalPath = (0, path_1.join)(output.path, file.name);
            await checkpoint(chain, `before-promote:${file.name}`);
            const existing = await readExistingFile(finalPath);
            await checkpoint(chain, `after-existing-check:${file.name}`);
            if (existing) {
                if (!existing.equals(file.bytes) && !file.preserveExisting)
                    throw new Error(`K15 existing ${file.name} differs from pinned bytes`);
                await removeStagedFile(stagedPath, chain);
                continue;
            }
            await (0, promises_1.rename)(stagedPath, finalPath);
            await checkpoint(chain, `after-promote:${file.name}`);
            const promoted = await readExistingFile(finalPath);
            if (!promoted?.equals(file.bytes))
                throw new Error(`K15 promoted ${file.name} identity rejected`);
            await checkpoint(chain, `after-promote-verify:${file.name}`);
        }
        if (!await safelyCleanStaging(staging, stagedNames, parentChain))
            throw new Error("K15 staging cleanup could not be proved safe");
        return output.path;
    }
    catch (error) {
        await safelyCleanStaging(staging, stagedNames, parentChain);
        throw error;
    }
    finally {
        for (const handle of heldDirectories.reverse())
            await handle.close().catch(() => undefined);
    }
}
async function generate(source) {
    const builder = new compact_builder_1.CharacterCompactProjectionBuilder(source.lineage, source.generatedAt, source.datasetVersion);
    await source.streamFields(field => builder.accept(field));
    const { projection, coverage } = builder.finish(true);
    const raw = jsonBytes(projection);
    if (raw.length > compact_contract_1.CHARACTER_COMPACT_RAW_BUDGET_BYTES)
        throw new Error(`K15 raw budget exceeded: ${raw.length} > ${compact_contract_1.CHARACTER_COMPACT_RAW_BUDGET_BYTES}`);
    const gzip = (0, zlib_1.gzipSync)(raw, { level: 9 });
    if (gzip.length > compact_contract_1.CHARACTER_COMPACT_GZIP_BUDGET_BYTES)
        throw new Error(`K15 gzip budget exceeded: ${gzip.length} > ${compact_contract_1.CHARACTER_COMPACT_GZIP_BUDGET_BYTES}`);
    const validation = (0, compact_validator_1.validateCharacterCompactProjection)(projection, coverage, { gzipSizeBytes: gzip.length, rawSizeBytes: raw.length }, true);
    if (!validation.valid)
        throw new Error(`K15 validation failed: ${validation.failures.join("; ")}`);
    return {
        projection,
        coverage,
        validation,
        readiness: (0, compact_validator_1.buildCharacterCompactReadiness)(source.generatedAt),
        raw,
        gzip,
        sha256: (0, artifact_1.sha256Bytes)(gzip),
        rawSha256: (0, artifact_1.sha256Bytes)(raw),
    };
}
async function run() {
    const args = process.argv.slice(2);
    validateCharacterCompactCliArguments(args);
    const shadowRoot = (0, path_1.resolve)(argumentValue(args, "--shadow-root") ?? "D:/Dokkan/DokkanWebScraper-character-shadow/data/database-characters/shadow");
    const outputDir = productiveOutputPath();
    let peakRssBytes = process.memoryUsage().rss;
    const monitor = setInterval(() => { peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss); }, 25);
    try {
        const source = await (0, compact_source_1.loadCharacterCompactGenerationSource)(shadowRoot);
        const first = await generate(source);
        global.gc?.();
        const second = await generate(source);
        peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss);
        for (const [label, left, right] of [
            ["payload", first.gzip, second.gzip],
            ["raw payload", first.raw, second.raw],
            ["coverage", jsonBytes(first.coverage), jsonBytes(second.coverage)],
            ["validation", jsonBytes(first.validation), jsonBytes(second.validation)],
            ["readiness", jsonBytes(first.readiness), jsonBytes(second.readiness)],
        ])
            if (!left.equals(right))
                throw new Error(`K15 two-generation byte identity failed for ${label}`);
        if (peakRssBytes >= 1073741824)
            throw new Error(`K15 memory limit exceeded: ${peakRssBytes}`);
        const fileName = `database-characters-k15-compact-supported.${first.sha256}.json.gz`;
        const coverageBytes = jsonBytes(first.coverage);
        const validationBytes = jsonBytes(first.validation);
        const readinessBytes = jsonBytes(first.readiness);
        const manifest = {
            schemaVersion: 1,
            contract: "dokkan-database-character-compact-shadow-manifest",
            contractVersion: "1.0.0",
            generatedAt: source.generatedAt,
            datasetVersion: source.datasetVersion,
            fileName,
            compression: "gzip",
            sha256: first.sha256,
            sizeBytes: first.gzip.length,
            uncompressedSha256: first.rawSha256,
            uncompressedSizeBytes: first.raw.length,
            recordCount: first.projection.records.length,
            lineage: source.lineage,
            coverageFile: "database-characters-k15-coverage.json",
            coverageSha256: (0, artifact_1.sha256Bytes)(coverageBytes),
            coverageSizeBytes: coverageBytes.length,
            validationFile: "database-characters-k15-validation.json",
            validationSha256: (0, artifact_1.sha256Bytes)(validationBytes),
            validationSizeBytes: validationBytes.length,
            readinessFile: "database-characters-k15-readiness.json",
            readinessSha256: (0, artifact_1.sha256Bytes)(readinessBytes),
            readinessSizeBytes: readinessBytes.length,
        };
        const manifestBytes = jsonBytes(manifest);
        (0, compact_validator_1.assertPinnedCharacterCompactReleaseManifest)(manifest, manifestBytes);
        if (fileName !== compact_contract_1.CHARACTER_COMPACT_PINNED_RELEASE.payloadFile)
            throw new Error("K15 generated payload is not the pinned release");
        const report = {
            outputDir,
            manifest,
            manifestSha256: (0, artifact_1.sha256Bytes)(manifestBytes),
            manifestSizeBytes: manifestBytes.length,
            coverage: first.coverage,
            twoGenerationByteIdentical: true,
            peakRssBytes,
            budgets: { gzipMaximumBytes: compact_contract_1.CHARACTER_COMPACT_GZIP_BUDGET_BYTES, rawMaximumBytes: compact_contract_1.CHARACTER_COMPACT_RAW_BUDGET_BYTES },
            readiness: first.readiness,
        };
        const writtenOutput = await writeProductiveFiles([
            { name: fileName, bytes: first.gzip },
            { name: compact_contract_1.CHARACTER_COMPACT_PINNED_RELEASE.manifestFile, bytes: manifestBytes },
            { name: manifest.coverageFile, bytes: coverageBytes },
            { name: manifest.validationFile, bytes: validationBytes },
            { name: manifest.readinessFile, bytes: readinessBytes },
            { name: RUN_REPORT_FILE, bytes: jsonBytes(report), preserveExisting: true },
        ]);
        if (!samePath(writtenOutput, outputDir))
            throw new Error("K15 productive output path changed");
        await (0, compact_validator_1.validateCharacterCompactArtifact)(outputDir);
        console.log(JSON.stringify(report, null, 2));
    }
    finally {
        clearInterval(monitor);
    }
}
if (require.main === module)
    run().catch(error => { console.error(error); process.exitCode = 1; });
//# sourceMappingURL=compact-run.js.map