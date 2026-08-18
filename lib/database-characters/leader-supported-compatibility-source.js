"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateCharacterLeaderSupportedCompatibilityRootSeparation = exports.validateCharacterLeaderSupportedCompatibilityArtifact = exports.assertCharacterLeaderSupportedCompatibilityPersistedBytes = exports.readCharacterLeaderSupportedCompatibilityArtifacts = exports.writeCharacterLeaderSupportedCompatibilityArtifacts = exports.loadCharacterLeaderSupportedCompatibilityInputs = exports.readCharacterLeaderSupportedCompatibilityK56 = exports.captureCharacterLeaderSupportedCompatibilityReceiptBeforeHeavyValidation = exports.assertCharacterLeaderSupportedCompatibilitySourceReceiptStable = exports.captureCharacterLeaderSupportedCompatibilitySourceReceipt = exports.assertCharacterLeaderSupportedCompatibilitySelectedPinWithinRootForTest = exports.captureCharacterLeaderSupportedCompatibilitySelectedRootForTest = void 0;
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
const leader_association_projection_contract_1 = require("./leader-association-projection-contract");
const leader_projection_contract_1 = require("./leader-projection-contract");
const refresh_contract_1 = require("./refresh-contract");
const state_product_projection_contract_1 = require("./state-product-projection-contract");
const leader_supported_compatibility_git_source_1 = require("./leader-supported-compatibility-git-source");
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
const SOURCE_RECEIPT_MAX_ENTRIES = 10000;
const SOURCE_RECEIPT_MAX_SELECTED_PATHS = 64;
const SOURCE_RECEIPT_CHUNK_BYTES = 64 * 1024;
function receiptPath(value) {
    return value.replace(/\\/g, "/");
}
async function snapshotReceiptFile(pathValue, role) {
    const path = (0, path_1.resolve)(pathValue), before = await (0, promises_1.lstat)(path), canonical = await (0, promises_1.realpath)(path);
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || !Number.isSafeInteger(before.size) || before.size < 0) {
        throw new Error(`K62 source receipt file rejected: ${role}`);
    }
    const handle = await (0, promises_1.open)(path, fs_1.constants.O_RDONLY | O_NOFOLLOW);
    try {
        const descriptor = await handle.stat();
        if (!descriptor.isFile() || descriptor.dev !== before.dev || descriptor.ino !== before.ino
            || descriptor.nlink !== 1 || descriptor.size !== before.size) {
            throw new Error(`K62 source receipt descriptor changed: ${role}`);
        }
        const digest = (0, crypto_1.createHash)("sha256"), chunk = Buffer.allocUnsafe(SOURCE_RECEIPT_CHUNK_BYTES);
        let position = 0;
        while (position < descriptor.size) {
            const length = Math.min(chunk.length, descriptor.size - position);
            const { bytesRead } = await handle.read(chunk, 0, length, position);
            if (bytesRead <= 0)
                throw new Error(`K62 source receipt short read: ${role}`);
            digest.update(chunk.subarray(0, bytesRead));
            position += bytesRead;
        }
        const after = await handle.stat(), visible = await (0, promises_1.lstat)(path), canonicalAfter = await (0, promises_1.realpath)(path);
        if (after.dev !== descriptor.dev || after.ino !== descriptor.ino || after.size !== descriptor.size
            || visible.dev !== descriptor.dev || visible.ino !== descriptor.ino || visible.size !== descriptor.size
            || visible.isSymbolicLink() || visible.nlink !== 1 || canonicalAfter !== canonical) {
            throw new Error(`K62 source receipt file changed during read: ${role}`);
        }
        return {
            role, path, realPath: canonical, dev: descriptor.dev, ino: descriptor.ino,
            sizeBytes: descriptor.size, sha256: digest.digest("hex"),
        };
    }
    finally {
        await handle.close();
    }
}
async function snapshotReceiptRoot(rootValue, role) {
    const root = await inspectRoot(rootValue, `${role} receipt root`);
    const entries = [];
    const walk = async (directory, prefix) => {
        const before = await (0, promises_1.lstat)(directory), canonical = await (0, promises_1.realpath)(directory);
        if (!before.isDirectory() || before.isSymbolicLink())
            throw new Error(`K62 source receipt directory rejected: ${role}`);
        const names = (await (0, promises_1.readdir)(directory, { withFileTypes: true })).map(entry => entry.name).sort();
        for (const name of names) {
            if (++entryCount > SOURCE_RECEIPT_MAX_ENTRIES)
                throw new Error(`K62 source receipt inventory limit reached: ${role}`);
            const path = (0, path_1.join)(directory, name), relativePath = receiptPath(prefix ? `${prefix}/${name}` : name);
            const metadata = await (0, promises_1.lstat)(path);
            if (metadata.isSymbolicLink())
                throw new Error(`K62 source receipt link rejected: ${role}/${relativePath}`);
            if (metadata.isDirectory()) {
                const directoryCanonical = await (0, promises_1.realpath)(path);
                entries.push({ relativePath, kind: "directory", realPath: directoryCanonical, dev: metadata.dev, ino: metadata.ino });
                await walk(path, relativePath);
            }
            else if (metadata.isFile()) {
                const file = await snapshotReceiptFile(path, `${role}/${relativePath}`);
                entries.push({
                    relativePath, kind: "file", realPath: file.realPath, dev: file.dev, ino: file.ino,
                    sizeBytes: file.sizeBytes, sha256: file.sha256,
                });
            }
            else
                throw new Error(`K62 source receipt member rejected: ${role}/${relativePath}`);
        }
        const after = await (0, promises_1.lstat)(directory), canonicalAfter = await (0, promises_1.realpath)(directory);
        const namesAfter = (await (0, promises_1.readdir)(directory, { withFileTypes: true })).map(entry => entry.name).sort();
        if (after.dev !== before.dev || after.ino !== before.ino || canonicalAfter !== canonical || json(namesAfter) !== json(names)) {
            throw new Error(`K62 source receipt directory changed during scan: ${role}`);
        }
    };
    let entryCount = 0;
    await walk(root.path, "");
    await checkpoint(root);
    return { role, ...root, entries };
}
async function snapshotSelectedReceiptRoot(rootValue, role, relativePaths) {
    if (!relativePaths.length || relativePaths.length > SOURCE_RECEIPT_MAX_SELECTED_PATHS
        || new Set(relativePaths).size !== relativePaths.length) {
        throw new Error(`K62 selected source receipt path set rejected: ${role}`);
    }
    const root = await inspectRoot(rootValue, `${role} receipt root`);
    const entries = [];
    const capturedDirectories = new Set();
    for (const relativePath of [...relativePaths].sort()) {
        const parts = relativePath.split("/");
        if (!parts.length || parts.some(part => !part || part === "." || part === ".." || part.includes("\\"))) {
            throw new Error(`K62 selected source pin path rejected: ${relativePath}`);
        }
        let ancestor = root.path;
        const ancestorParts = [];
        for (const part of parts.slice(0, -1)) {
            ancestorParts.push(part);
            ancestor = (0, path_1.join)(ancestor, part);
            const metadata = await (0, promises_1.lstat)(ancestor), canonical = await (0, promises_1.realpath)(ancestor);
            if (!metadata.isDirectory() || metadata.isSymbolicLink() || !containsPath(root.realPath, canonical)) {
                throw new Error(`K62 selected source pin linked ancestor rejected: ${relativePath}`);
            }
            const ancestorRelativePath = receiptPath(ancestorParts.join("/"));
            if (!capturedDirectories.has(ancestorRelativePath)) {
                entries.push({
                    relativePath: ancestorRelativePath, kind: "directory", realPath: canonical,
                    dev: metadata.dev, ino: metadata.ino,
                });
                capturedDirectories.add(ancestorRelativePath);
            }
        }
        const file = await snapshotReceiptFile((0, path_1.join)(root.path, ...parts), `${role}/${relativePath}`);
        assertCharacterLeaderSupportedCompatibilitySelectedPinWithinRootForTest(root.realPath, relativePath, file.realPath);
        entries.push({
            relativePath, kind: "file", realPath: file.realPath, dev: file.dev, ino: file.ino,
            sizeBytes: file.sizeBytes, sha256: file.sha256,
        });
    }
    await checkpoint(root);
    return { role, ...root, entries };
}
async function captureCharacterLeaderSupportedCompatibilitySelectedRootForTest(rootValue, role, relativePaths) {
    return snapshotSelectedReceiptRoot(rootValue, role, relativePaths);
}
exports.captureCharacterLeaderSupportedCompatibilitySelectedRootForTest = captureCharacterLeaderSupportedCompatibilitySelectedRootForTest;
async function snapshotManifestReceiptRoot(rootValue, role, files) {
    const root = await inspectRoot(rootValue, `${role} manifest receipt root`);
    const manifestBytes = await readBoundedFile((0, path_1.join)(root.path, files.manifest), 128 * 1024, `${role} manifest receipt`);
    let manifest;
    try {
        manifest = JSON.parse(manifestBytes.toString("utf8"));
    }
    catch {
        throw new Error(`K62 ${role} manifest receipt JSON rejected`);
    }
    if (typeof manifest?.fileName !== "string" || manifest.fileName.includes("/") || manifest.fileName.includes("\\")
        || manifest.coverageFile !== files.coverage || manifest.validationFile !== files.validation) {
        throw new Error(`K62 ${role} manifest receipt members rejected`);
    }
    const receipt = await snapshotSelectedReceiptRoot(root.path, role, [files.manifest, manifest.fileName, files.coverage, files.validation]);
    await checkpoint(root);
    if (receipt.dev !== root.dev || receipt.ino !== root.ino || receipt.realPath !== root.realPath) {
        throw new Error(`K62 ${role} manifest receipt root changed`);
    }
    return receipt;
}
function assertCharacterLeaderSupportedCompatibilitySelectedPinWithinRootForTest(canonicalRoot, relativePath, canonicalFile) {
    const parts = relativePath.split("/");
    if (!parts.length || parts.some(part => !part || part === "." || part === ".." || part.includes("\\"))
        || !containsPath((0, path_1.resolve)(canonicalRoot), (0, path_1.resolve)(canonicalFile))) {
        throw new Error(`K62 selected source pin escaped canonical root: ${relativePath}`);
    }
}
exports.assertCharacterLeaderSupportedCompatibilitySelectedPinWithinRootForTest = assertCharacterLeaderSupportedCompatibilitySelectedPinWithinRootForTest;
const K55_NATIVE_EVIDENCE_FILES = [
    ["K50 native evidence", "native-leader-skill-semantics.json"],
    ["K51 target evidence", "native-passive-target-dispatch-semantics.json"],
    ["K51 sub-target evidence", "native-sub-target-type-semantics.json"],
    ["K52 native evidence", "native-leader-causality-semantics.json"],
    ["K53 native evidence", "native-leader-causality-collection.json"],
    ["K54 native evidence", "native-leader-causality-deck-index.json"],
    ["K55 native evidence", "native-leader-lifecycle-semantics.json"],
];
function nativeEvidencePath(name) {
    const adjacent = (0, path_1.resolve)(__dirname, "..", "database-experiment", name);
    return (0, fs_1.existsSync)(adjacent) ? adjacent : (0, path_1.resolve)(__dirname, "..", "..", "database-experiment", name);
}
function freezeReceipt(rootsValue, filesValue, androidValue) {
    const roots = Object.freeze(rootsValue.map(root => Object.freeze({
        ...root,
        entries: Object.freeze(root.entries.map(entry => Object.freeze({ ...entry }))),
    })));
    const files = Object.freeze(filesValue.map(file => Object.freeze({ ...file })));
    const android = Object.freeze({
        ...androidValue,
        files: Object.freeze(androidValue.files.map(file => Object.freeze({ ...file }))),
    });
    const body = {
        schemaVersion: 1,
        contract: "dokkan-database-character-leader-supported-compatibility-source-receipt",
        roots,
        files,
        android,
    };
    return Object.freeze({ ...body, fingerprintSha256: hash(json(body)) });
}
async function captureCharacterLeaderSupportedCompatibilitySourceReceipt(options, androidIdentity) {
    const sidecarPaths = ["k0", "k1", "k2", "k3", "k7"].flatMap(gate => {
        const profile = refresh_contract_1.CHARACTER_REFRESH_PROFILE.sidecars.find(value => value.gate === gate);
        if (!profile)
            throw new Error(`K62 K55 sidecar receipt profile missing: ${gate}`);
        return [profile.manifest.fileName, profile.artifact.fileName, profile.coverage.fileName, profile.validation.fileName]
            .map(file => `${gate}/${file}`);
    });
    const roots = await Promise.all([
        snapshotReceiptRoot(options.k58Root, "K58 artifacts"),
        snapshotReceiptRoot(options.k56Root, "K56 artifacts"),
        snapshotSelectedReceiptRoot(options.sidecarRoot, "K55 sidecar inputs", sidecarPaths),
        snapshotSelectedReceiptRoot(options.productionRoot, "K55 production inputs", [leader_supported_projection_contract_1.CHARACTER_LEADER_SUPPORTED_PROJECTION_PIN.productiveFileName]),
        snapshotSelectedReceiptRoot(options.fyiRoot, "K55 FYI inputs", ["characters-manifest.json", "characters.json.gz"]),
        snapshotManifestReceiptRoot(options.k43Root, "K55 K43 inputs", state_product_projection_contract_1.CHARACTER_STATE_PRODUCT_PROJECTION_FILES),
        snapshotManifestReceiptRoot(options.k46Root, "K55 K46 inputs", leader_projection_contract_1.CHARACTER_LEADER_PROJECTION_FILES),
        snapshotManifestReceiptRoot(options.k48Root, "K55 K48 inputs", leader_association_projection_contract_1.CHARACTER_LEADER_ASSOCIATION_PROJECTION_FILES),
        snapshotSelectedReceiptRoot(options.scraperRoot, "scraper pins", leader_supported_compatibility_golden_1.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_SOURCE_PINS.scraper.map(pin => pin[0])),
    ]);
    const files = await Promise.all([
        snapshotReceiptFile(options.k57Report, "K57 pinned report"),
        snapshotReceiptFile(options.k59Report, "K59 pinned report"),
        snapshotReceiptFile(options.k60Report, "K60 pinned report"),
        snapshotReceiptFile(options.k60Receipt, "K60 pinned receipt"),
        snapshotReceiptFile(options.k61Report, "K61 pinned report"),
        snapshotReceiptFile(options.productiveCharacters, "productive Character[]"),
        snapshotReceiptFile(options.nativeRuntime, "K55 native runtime"),
        ...K55_NATIVE_EVIDENCE_FILES.map(([role, name]) => snapshotReceiptFile(nativeEvidencePath(name), role)),
        snapshotReceiptFile(options.database, "K55 database"),
    ]);
    const android = androidIdentity ?? await (0, leader_supported_compatibility_git_source_1.verifyCharacterLeaderSupportedCompatibilityAndroidSource)(options.androidRepository);
    return freezeReceipt(roots, files, android);
}
exports.captureCharacterLeaderSupportedCompatibilitySourceReceipt = captureCharacterLeaderSupportedCompatibilitySourceReceipt;
function assertReceiptFingerprint(receipt) {
    const { fingerprintSha256, ...body } = receipt;
    const { fingerprintSha256: androidFingerprintSha256, ...androidBody } = receipt.android;
    if (receipt.schemaVersion !== 1
        || receipt.contract !== "dokkan-database-character-leader-supported-compatibility-source-receipt"
        || receipt.android.access !== "git_object_database_only" || receipt.android.checkoutBytesRead !== false
        || androidFingerprintSha256 !== hash(json(androidBody))
        || fingerprintSha256 !== hash(json(body)))
        throw new Error("K62 source receipt integrity rejected");
}
function assertCharacterLeaderSupportedCompatibilitySourceReceiptStable(before, after) {
    assertReceiptFingerprint(before);
    assertReceiptFingerprint(after);
    if (json(before) !== json(after))
        throw new Error("K62 persistent source identity drifted after write");
}
exports.assertCharacterLeaderSupportedCompatibilitySourceReceiptStable = assertCharacterLeaderSupportedCompatibilitySourceReceiptStable;
const preHeavyDependencies = {
    captureReceipt: captureCharacterLeaderSupportedCompatibilitySourceReceipt,
    collectGarbage() {
        if (typeof global.gc !== "function")
            throw new Error("K62 requires GC before K58/K55 validation");
        global.gc();
    },
    validateK58: leader_supported_publisher_dry_run_1.validateCharacterLeaderSupportedPublisherDryRunArtifact,
};
async function captureCharacterLeaderSupportedCompatibilityReceiptBeforeHeavyValidation(options, androidSource, dependencies = preHeavyDependencies) {
    const sourceReceipt = await dependencies.captureReceipt(options, androidSource);
    dependencies.collectGarbage();
    const validatedK58 = await dependencies.validateK58({
        sidecarRoot: options.sidecarRoot, productionRoot: options.productionRoot, fyiRoot: options.fyiRoot,
        k43Root: options.k43Root, k46Root: options.k46Root, k48Root: options.k48Root,
        nativeRuntime: options.nativeRuntime, database: options.database,
        k56Root: options.k56Root, artifactRoot: options.k58Root,
    });
    return { sourceReceipt, validatedK58 };
}
exports.captureCharacterLeaderSupportedCompatibilityReceiptBeforeHeavyValidation = captureCharacterLeaderSupportedCompatibilityReceiptBeforeHeavyValidation;
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
    const androidSource = await (0, leader_supported_compatibility_git_source_1.verifyCharacterLeaderSupportedCompatibilityAndroidSource)(options.androidRepository);
    const { sourceReceipt, validatedK58 } = await captureCharacterLeaderSupportedCompatibilityReceiptBeforeHeavyValidation(options, androidSource);
    const [k56, k57, k59, k60, k60Receipt, k61, productive] = await Promise.all([
        readCharacterLeaderSupportedCompatibilityK56(options.k56Root),
        readPinnedReport(options.k57Report, "k57"), readPinnedReport(options.k59Report, "k59"),
        readPinnedReport(options.k60Report, "k60"), readPinnedReport(options.k60Receipt, "k60Receipt"),
        readPinnedReport(options.k61Report, "k61"), loadProductiveBaseline(options.productiveCharacters),
    ]);
    const afterLoadReceipt = await captureCharacterLeaderSupportedCompatibilitySourceReceipt(options);
    assertCharacterLeaderSupportedCompatibilitySourceReceiptStable(sourceReceipt, afterLoadReceipt);
    return {
        inputs: { k56, k58: validatedK58.artifacts, k57, k59, k60, k60Receipt, k61, productive, androidSource },
        k55ValidationProcessPeakRssBytes: validatedK58.k55ValidationProcessPeakRssBytes,
        sourceReceipt,
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
function assertCharacterLeaderSupportedCompatibilityPersistedBytes(actual, expected) {
    for (const [label, left, right] of [
        ["payload", actual.gzip, expected.gzip], ["coverage", actual.coverageBytes, expected.coverageBytes],
        ["validation", actual.validationBytes, expected.validationBytes], ["manifest", actual.manifestBytes, expected.manifestBytes],
    ])
        if (!left.equals(right))
            throw new Error(`K62 persisted artifact mismatch: ${label}`);
}
exports.assertCharacterLeaderSupportedCompatibilityPersistedBytes = assertCharacterLeaderSupportedCompatibilityPersistedBytes;
async function validateCharacterLeaderSupportedCompatibilityArtifact(options, expected, sourceReceipt) {
    const actual = await readCharacterLeaderSupportedCompatibilityArtifacts(options.outputRoot);
    assertCharacterLeaderSupportedCompatibilityPersistedBytes(actual, expected);
    const afterWriteReceipt = await captureCharacterLeaderSupportedCompatibilitySourceReceipt(options);
    assertCharacterLeaderSupportedCompatibilitySourceReceiptStable(sourceReceipt, afterWriteReceipt);
    return {
        artifacts: actual,
        sourceBoundReconstruction: "GO",
        sourceStability: "CHECKPOINTED_PERSISTENT_DRIFT_ONLY",
    };
}
exports.validateCharacterLeaderSupportedCompatibilityArtifact = validateCharacterLeaderSupportedCompatibilityArtifact;
async function validateCharacterLeaderSupportedCompatibilityRootSeparation(options) {
    const output = await inspectRoot(options.outputRoot, "output root");
    for (const [label, value] of [
        ["K56", options.k56Root], ["K58", options.k58Root],
        ["K55 sidecar", options.sidecarRoot], ["K55 production", options.productionRoot],
        ["K55 FYI", options.fyiRoot], ["K55 K43", options.k43Root],
        ["K55 K46", options.k46Root], ["K55 K48", options.k48Root],
        ["scraper", options.scraperRoot], ["Android repository", options.androidRepository],
    ]) {
        const source = await inspectRoot(value, `${label} root`);
        if (containsPath(source.realPath, output.realPath) || containsPath(output.realPath, source.realPath))
            throw new Error(`K62 output root overlaps ${label} root`);
    }
    for (const [label, value] of [
        ["K57 report", options.k57Report], ["K59 report", options.k59Report],
        ["K60 report", options.k60Report], ["K60 receipt", options.k60Receipt],
        ["K61 report", options.k61Report], ["productive Character[]", options.productiveCharacters],
        ["K55 native runtime", options.nativeRuntime],
        ...K55_NATIVE_EVIDENCE_FILES.map(([label, name]) => [label, nativeEvidencePath(name)]),
        ["K55 database", options.database],
    ]) {
        const path = (0, path_1.resolve)(value), metadata = await (0, promises_1.lstat)(path), canonical = await (0, promises_1.realpath)(path);
        if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.nlink !== 1)
            throw new Error(`K62 ${label} source file rejected`);
        if (containsPath(output.realPath, canonical) || containsPath(canonical, output.realPath)) {
            throw new Error(`K62 output root overlaps ${label} source file`);
        }
    }
}
exports.validateCharacterLeaderSupportedCompatibilityRootSeparation = validateCharacterLeaderSupportedCompatibilityRootSeparation;
//# sourceMappingURL=leader-supported-compatibility-source.js.map