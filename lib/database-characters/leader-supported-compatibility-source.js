"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateCharacterLeaderSupportedCompatibilityRootSeparation = exports.validateCharacterLeaderSupportedCompatibilityArtifact = exports.readCharacterLeaderSupportedCompatibilityArtifacts = exports.writeCharacterLeaderSupportedCompatibilityArtifacts = exports.loadCharacterLeaderSupportedCompatibilityInputs = exports.readCharacterLeaderSupportedCompatibilityK56 = void 0;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const zlib_1 = require("zlib");
const leader_supported_projection_contract_1 = require("./leader-supported-projection-contract");
const leader_supported_projection_1 = require("./leader-supported-projection");
const leader_supported_publisher_dry_run_1 = require("./leader-supported-publisher-dry-run");
const leader_supported_shadow_1 = require("./leader-supported-shadow");
const leader_supported_compatibility_contract_1 = require("./leader-supported-compatibility-contract");
const leader_supported_compatibility_golden_1 = require("./leader-supported-compatibility-golden");
const leader_supported_compatibility_1 = require("./leader-supported-compatibility");
const hash = (bytes) => (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
const json = (value) => JSON.stringify(value);
const O_NOFOLLOW = fs_1.constants.O_NOFOLLOW ?? 0;
async function inspectRoot(value, label) {
    if (!value || !(0, path_1.isAbsolute)(value))
        throw new Error(`K62 ${label} must be an absolute path`);
    const path = (0, path_1.resolve)(value), metadata = await (0, promises_1.lstat)(path), canonical = await (0, promises_1.realpath)(path);
    if (!metadata.isDirectory() || metadata.isSymbolicLink() || (0, path_1.resolve)(canonical) !== path)
        throw new Error(`K62 ${label} must be a canonical non-link directory`);
    return { path, realPath: canonical, dev: metadata.dev, ino: metadata.ino };
}
async function checkpoint(root) {
    const metadata = await (0, promises_1.lstat)(root.path), canonical = await (0, promises_1.realpath)(root.path);
    if (!metadata.isDirectory() || metadata.isSymbolicLink() || metadata.dev !== root.dev || metadata.ino !== root.ino || canonical !== root.realPath) {
        throw new Error("K62 root identity changed");
    }
}
function containsPath(parent, child) {
    const suffix = (0, path_1.relative)(parent, child);
    return suffix === "" || (!suffix.startsWith("..") && !(0, path_1.isAbsolute)(suffix));
}
async function readBoundedFile(path, maximumBytesExclusive, label) {
    const before = await (0, promises_1.lstat)(path);
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || before.size <= 0 || before.size >= maximumBytesExclusive) {
        throw new Error(`K62 ${label} source rejected`);
    }
    const handle = await (0, promises_1.open)(path, fs_1.constants.O_RDONLY | O_NOFOLLOW);
    try {
        const descriptor = await handle.stat();
        if (!descriptor.isFile() || descriptor.dev !== before.dev || descriptor.ino !== before.ino || descriptor.size !== before.size) {
            throw new Error(`K62 ${label} descriptor changed`);
        }
        const bytes = await handle.readFile();
        const after = await handle.stat();
        if (bytes.length !== descriptor.size || after.dev !== descriptor.dev || after.ino !== descriptor.ino || after.size !== descriptor.size) {
            throw new Error(`K62 ${label} changed during read`);
        }
        return bytes;
    }
    finally {
        await handle.close();
    }
}
function parseCanonical(bytes, label) {
    let value;
    try {
        value = JSON.parse(bytes.toString("utf8"));
    }
    catch {
        throw new Error(`K62 ${label} JSON rejected`);
    }
    if (!bytes.equals(Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8")))
        throw new Error(`K62 ${label} must be canonical pretty JSON`);
    return value;
}
async function readPinnedReport(path, label) {
    const pin = leader_supported_compatibility_contract_1.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_PIN.reports[label];
    const bytes = await readBoundedFile((0, path_1.resolve)(path), 128 * 1024, `${label} report`);
    if (bytes.length !== pin.sizeBytes || hash(bytes) !== pin.sha256)
        throw new Error(`K62 ${label} report pin changed`);
    return { bytes, value: parseCanonical(bytes, `${label} report`) };
}
async function readCharacterLeaderSupportedCompatibilityK56(value) {
    const root = await inspectRoot(value, "K56 root");
    const names = (await (0, promises_1.readdir)(root.path, { withFileTypes: true }));
    if (names.some(entry => !entry.isFile() || entry.isSymbolicLink()) || names.length !== 4)
        throw new Error("K62 K56 root inventory rejected");
    const manifestPath = (0, path_1.join)(root.path, leader_supported_projection_contract_1.CHARACTER_LEADER_SUPPORTED_PROJECTION_FILES.manifest);
    const manifestBytes = await readBoundedFile(manifestPath, 128 * 1024, "K56 manifest");
    const manifest = parseCanonical(manifestBytes, "K56 manifest");
    const expectedNames = [manifest.fileName, leader_supported_projection_contract_1.CHARACTER_LEADER_SUPPORTED_PROJECTION_FILES.coverage,
        leader_supported_projection_contract_1.CHARACTER_LEADER_SUPPORTED_PROJECTION_FILES.validation, leader_supported_projection_contract_1.CHARACTER_LEADER_SUPPORTED_PROJECTION_FILES.manifest].sort();
    if (json(names.map(entry => entry.name).sort()) !== json(expectedNames))
        throw new Error("K62 K56 member inventory changed");
    const [gzip, coverageBytes, validationBytes] = await Promise.all([
        readBoundedFile((0, path_1.join)(root.path, manifest.fileName), leader_supported_projection_contract_1.CHARACTER_LEADER_SUPPORTED_PROJECTION_GZIP_LIMIT_BYTES, "K56 payload"),
        readBoundedFile((0, path_1.join)(root.path, leader_supported_projection_contract_1.CHARACTER_LEADER_SUPPORTED_PROJECTION_FILES.coverage), 128 * 1024, "K56 coverage"),
        readBoundedFile((0, path_1.join)(root.path, leader_supported_projection_contract_1.CHARACTER_LEADER_SUPPORTED_PROJECTION_FILES.validation), 128 * 1024, "K56 validation"),
    ]);
    await checkpoint(root);
    if (hash(gzip) !== manifest.sha256 || gzip.length !== manifest.sizeBytes || hash(coverageBytes) !== manifest.coverageSha256
        || coverageBytes.length !== manifest.coverageSizeBytes || hash(validationBytes) !== manifest.validationSha256
        || validationBytes.length !== manifest.validationSizeBytes)
        throw new Error("K62 K56 member identity rejected");
    const raw = (0, zlib_1.gunzipSync)(gzip, { maxOutputLength: leader_supported_projection_contract_1.CHARACTER_LEADER_SUPPORTED_PROJECTION_RAW_LIMIT_BYTES - 1 });
    if (raw.length !== manifest.uncompressedSizeBytes || hash(raw) !== manifest.uncompressedSha256)
        throw new Error("K62 K56 raw identity rejected");
    const dataset = parseCanonical(raw, "K56 raw payload");
    const coverage = parseCanonical(coverageBytes, "K56 coverage");
    const validation = parseCanonical(validationBytes, "K56 validation");
    const rebuilt = (0, leader_supported_projection_1.materializeCharacterLeaderSupportedProjection)(dataset, coverage);
    if (!rebuilt.raw.equals(raw) || !rebuilt.gzip.equals(gzip) || !rebuilt.coverageBytes.equals(coverageBytes)
        || !rebuilt.validationBytes.equals(validationBytes) || !rebuilt.manifestBytes.equals(manifestBytes)
        || json(rebuilt.validation) !== json(validation))
        throw new Error("K62 K56 lossless reconstruction rejected");
    (0, leader_supported_shadow_1.assertExactCharacterLeaderSupportedShadowK56Identity)(rebuilt);
    return rebuilt;
}
exports.readCharacterLeaderSupportedCompatibilityK56 = readCharacterLeaderSupportedCompatibilityK56;
async function loadProductiveBaseline(path) {
    const pin = leader_supported_compatibility_contract_1.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_PIN.productive;
    const bytes = await readBoundedFile((0, path_1.resolve)(path), pin.sizeBytes + 1, "productive Character[]");
    if (bytes.length !== pin.sizeBytes || hash(bytes) !== pin.sha256)
        throw new Error("K62 productive Character[] pin changed");
    let values;
    try {
        values = JSON.parse(bytes.toString("utf8"));
    }
    catch {
        throw new Error("K62 productive Character[] JSON rejected");
    }
    if (!Array.isArray(values) || values.length !== pin.topLevelCount)
        throw new Error("K62 productive Character[] cardinality changed");
    const ids = new Set(), textIds = new Set(), structuredLeaderDetailIds = new Set();
    for (const value of values) {
        const id = value?.id;
        if (typeof id !== "string" || !id || ids.has(id))
            throw new Error("K62 productive structural card ID rejected");
        ids.add(id);
        if (typeof value.leaderSkill === "string" && value.leaderSkill.length > 0)
            textIds.add(id);
        if (value.leaderSkillDetails !== undefined || value.ezaLeaderSkillDetails !== undefined)
            structuredLeaderDetailIds.add(id);
    }
    return { ids, textIds, structuredLeaderDetailIds };
}
async function verifySourcePins(rootValue, label, pins) {
    const root = await inspectRoot(rootValue, `${label} source root`);
    const identities = [];
    for (const [file, sizeBytes, sha256] of pins) {
        const path = (0, path_1.join)(root.path, ...file.split("/"));
        const bytes = await readBoundedFile(path, Math.max(sizeBytes + 1, 512 * 1024), `${label} source ${file}`);
        if (bytes.length !== sizeBytes || hash(bytes) !== sha256)
            throw new Error(`K62 ${label} source pin changed: ${file}`);
        identities.push({ file, sizeBytes, sha256 });
    }
    await checkpoint(root);
    return hash(JSON.stringify(identities));
}
async function loadCharacterLeaderSupportedCompatibilityInputs(options) {
    await verifySourcePins(options.scraperRoot, "scraper", leader_supported_compatibility_golden_1.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_SOURCE_PINS.scraper);
    const androidSourceFingerprintSha256 = await verifySourcePins(options.androidRoot, "Android", leader_supported_compatibility_golden_1.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_SOURCE_PINS.android);
    const validatedK58 = await (0, leader_supported_publisher_dry_run_1.validateCharacterLeaderSupportedPublisherDryRunArtifact)({
        sidecarRoot: options.sidecarRoot, productionRoot: options.productionRoot, fyiRoot: options.fyiRoot,
        k43Root: options.k43Root, k46Root: options.k46Root, k48Root: options.k48Root,
        nativeRuntime: options.nativeRuntime, database: options.database,
        k56Root: options.k56Root, artifactRoot: options.k58Root,
    });
    const [k56, k57, k59, k60, k60Receipt, k61, productive] = await Promise.all([
        readCharacterLeaderSupportedCompatibilityK56(options.k56Root),
        readPinnedReport(options.k57Report, "k57"), readPinnedReport(options.k59Report, "k59"),
        readPinnedReport(options.k60Report, "k60"), readPinnedReport(options.k60Receipt, "k60Receipt"),
        readPinnedReport(options.k61Report, "k61"), loadProductiveBaseline(options.productiveCharacters),
    ]);
    return {
        inputs: { k56, k58: validatedK58.artifacts, k57, k59, k60, k60Receipt, k61, productive, androidSourceFingerprintSha256 },
        k55ValidationProcessPeakRssBytes: validatedK58.k55ValidationProcessPeakRssBytes,
    };
}
exports.loadCharacterLeaderSupportedCompatibilityInputs = loadCharacterLeaderSupportedCompatibilityInputs;
async function writeCreateOnly(root, name, bytes) {
    await checkpoint(root);
    const path = (0, path_1.join)(root.path, name);
    const handle = await (0, promises_1.open)(path, fs_1.constants.O_WRONLY | fs_1.constants.O_CREAT | fs_1.constants.O_EXCL | O_NOFOLLOW, 0o444);
    try {
        await handle.writeFile(bytes);
        await handle.sync();
    }
    finally {
        await handle.close();
    }
    const metadata = await (0, promises_1.lstat)(path);
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.nlink !== 1 || metadata.size !== bytes.length)
        throw new Error(`K62 written member rejected: ${name}`);
    const reread = await readBoundedFile(path, Math.max(bytes.length + 1, leader_supported_compatibility_contract_1.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_RAW_LIMIT_BYTES), `written ${name}`);
    if (!reread.equals(bytes))
        throw new Error(`K62 written member drifted: ${name}`);
    await checkpoint(root);
}
async function writeCharacterLeaderSupportedCompatibilityArtifacts(outputRoot, artifacts) {
    const root = await inspectRoot(outputRoot, "output root");
    if ((await (0, promises_1.readdir)(root.path)).length !== 0)
        throw new Error("K62 output root must be empty");
    await writeCreateOnly(root, artifacts.manifest.fileName, artifacts.gzip);
    await writeCreateOnly(root, leader_supported_compatibility_contract_1.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_FILES.coverage, artifacts.coverageBytes);
    await writeCreateOnly(root, leader_supported_compatibility_contract_1.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_FILES.validation, artifacts.validationBytes);
    await writeCreateOnly(root, leader_supported_compatibility_contract_1.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_FILES.manifest, artifacts.manifestBytes);
}
exports.writeCharacterLeaderSupportedCompatibilityArtifacts = writeCharacterLeaderSupportedCompatibilityArtifacts;
async function readCharacterLeaderSupportedCompatibilityArtifacts(outputRoot) {
    const root = await inspectRoot(outputRoot, "artifact root");
    const entries = await (0, promises_1.readdir)(root.path, { withFileTypes: true });
    if (entries.length !== 4 || entries.some(entry => !entry.isFile() || entry.isSymbolicLink()))
        throw new Error("K62 artifact root inventory rejected");
    const manifestBytes = await readBoundedFile((0, path_1.join)(root.path, leader_supported_compatibility_contract_1.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_FILES.manifest), leader_supported_compatibility_contract_1.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_METADATA_LIMIT_BYTES, "K62 manifest");
    const manifest = parseCanonical(manifestBytes, "K62 manifest");
    const expected = [manifest.fileName, leader_supported_compatibility_contract_1.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_FILES.coverage,
        leader_supported_compatibility_contract_1.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_FILES.validation, leader_supported_compatibility_contract_1.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_FILES.manifest].sort();
    if (json(entries.map(entry => entry.name).sort()) !== json(expected))
        throw new Error("K62 artifact member names rejected");
    const [gzip, coverageBytes, validationBytes] = await Promise.all([
        readBoundedFile((0, path_1.join)(root.path, manifest.fileName), leader_supported_compatibility_contract_1.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_GZIP_LIMIT_BYTES, "K62 payload"),
        readBoundedFile((0, path_1.join)(root.path, leader_supported_compatibility_contract_1.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_FILES.coverage), leader_supported_compatibility_contract_1.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_METADATA_LIMIT_BYTES, "K62 coverage"),
        readBoundedFile((0, path_1.join)(root.path, leader_supported_compatibility_contract_1.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_FILES.validation), leader_supported_compatibility_contract_1.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_METADATA_LIMIT_BYTES, "K62 validation"),
    ]);
    await checkpoint(root);
    if (gzip.length !== manifest.sizeBytes || hash(gzip) !== manifest.sha256 || coverageBytes.length !== manifest.coverageSizeBytes
        || hash(coverageBytes) !== manifest.coverageSha256 || validationBytes.length !== manifest.validationSizeBytes
        || hash(validationBytes) !== manifest.validationSha256)
        throw new Error("K62 artifact member identity rejected");
    const raw = (0, zlib_1.gunzipSync)(gzip, { maxOutputLength: leader_supported_compatibility_contract_1.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_RAW_LIMIT_BYTES - 1 });
    if (raw.length !== manifest.uncompressedSizeBytes || hash(raw) !== manifest.uncompressedSha256)
        throw new Error("K62 raw identity rejected");
    const report = parseCanonical(raw, "K62 report");
    const coverage = parseCanonical(coverageBytes, "K62 coverage");
    const validation = parseCanonical(validationBytes, "K62 validation");
    const rebuilt = (0, leader_supported_compatibility_1.materializeCharacterLeaderSupportedCompatibility)(report);
    if (!rebuilt.raw.equals(raw) || !rebuilt.gzip.equals(gzip) || !rebuilt.coverageBytes.equals(coverageBytes)
        || !rebuilt.validationBytes.equals(validationBytes) || !rebuilt.manifestBytes.equals(manifestBytes)
        || json(rebuilt.coverage) !== json(coverage) || json(rebuilt.validation) !== json(validation)) {
        throw new Error("K62 lossless artifact reconstruction rejected");
    }
    return rebuilt;
}
exports.readCharacterLeaderSupportedCompatibilityArtifacts = readCharacterLeaderSupportedCompatibilityArtifacts;
async function validateCharacterLeaderSupportedCompatibilityArtifact(options) {
    const loaded = await loadCharacterLeaderSupportedCompatibilityInputs(options);
    const expected = (0, leader_supported_compatibility_1.materializeCharacterLeaderSupportedCompatibility)((0, leader_supported_compatibility_1.buildCharacterLeaderSupportedCompatibilityReport)(loaded.inputs));
    const actual = await readCharacterLeaderSupportedCompatibilityArtifacts(options.outputRoot);
    for (const [label, left, right] of [
        ["payload", actual.gzip, expected.gzip], ["coverage", actual.coverageBytes, expected.coverageBytes],
        ["validation", actual.validationBytes, expected.validationBytes], ["manifest", actual.manifestBytes, expected.manifestBytes],
    ])
        if (!left.equals(right))
            throw new Error(`K62 source-bound artifact mismatch: ${label}`);
    return { artifacts: actual, sourceBoundValidation: "GO", k55ValidationProcessPeakRssBytes: loaded.k55ValidationProcessPeakRssBytes };
}
exports.validateCharacterLeaderSupportedCompatibilityArtifact = validateCharacterLeaderSupportedCompatibilityArtifact;
async function validateCharacterLeaderSupportedCompatibilityRootSeparation(options) {
    const output = await inspectRoot(options.outputRoot, "output root");
    for (const [label, value] of [["K56", options.k56Root], ["K58", options.k58Root], ["Android", options.androidRoot]]) {
        const source = await inspectRoot(value, `${label} root`);
        if (containsPath(source.realPath, output.realPath) || containsPath(output.realPath, source.realPath))
            throw new Error(`K62 output root overlaps ${label} root`);
    }
    for (const value of [options.k57Report, options.k59Report, options.k60Report, options.k60Receipt, options.k61Report, options.productiveCharacters]) {
        const canonical = await (0, promises_1.realpath)((0, path_1.resolve)(value));
        if (containsPath(output.realPath, canonical))
            throw new Error("K62 output root contains a source file");
    }
}
exports.validateCharacterLeaderSupportedCompatibilityRootSeparation = validateCharacterLeaderSupportedCompatibilityRootSeparation;
//# sourceMappingURL=leader-supported-compatibility-source.js.map