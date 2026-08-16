"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertCharacterLeaderSupportedProjectionArtifactBytes = exports.validateCharacterLeaderSupportedProjectionArtifact = exports.writeCharacterLeaderSupportedProjectionArtifacts = exports.buildCharacterLeaderSupportedProjectionFromSources = exports.loadCharacterLeaderSupportedProductiveSource = exports.validateCharacterLeaderSupportedProjectionRootSeparation = exports.validateCharacterLeaderSupportedProjectionOutputRoot = void 0;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const zlib_1 = require("zlib");
const artifact_path_1 = require("./artifact-path");
const leader_lifecycle_semantics_run_1 = require("./leader-lifecycle-semantics-run");
const leader_association_projection_1 = require("./leader-association-projection");
const leader_causality_semantics_source_1 = require("./leader-causality-semantics-source");
const leader_supported_projection_contract_1 = require("./leader-supported-projection-contract");
const leader_supported_projection_1 = require("./leader-supported-projection");
const leader_target_semantics_source_1 = require("./leader-target-semantics-source");
const leader_value_scope_source_1 = require("./leader-value-scope-source");
const hash = (bytes) => (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
const samePath = (left, right) => process.platform === "win32"
    ? (0, path_1.resolve)(left).toLowerCase() === (0, path_1.resolve)(right).toLowerCase() : (0, path_1.resolve)(left) === (0, path_1.resolve)(right);
const sameFile = (left, right) => left.dev === right.dev && left.ino === right.ino;
async function inspectRoot(value, label) {
    const path = (0, path_1.resolve)(value), metadata = await (0, promises_1.lstat)(path);
    if (!metadata.isDirectory() || metadata.isSymbolicLink())
        throw new Error(`K56 ${label} must be an existing regular non-link directory`);
    const canonical = await (0, promises_1.realpath)(path);
    if (!samePath(path, canonical))
        throw new Error(`K56 ${label} symlink or junction rejected`);
    return { path, realPath: canonical, dev: metadata.dev, ino: metadata.ino };
}
function containsPath(parent, child) {
    const value = (0, path_1.relative)(parent, child);
    return value === "" || (value !== ".." && !value.startsWith(`..${path_1.sep}`) && !(0, path_1.isAbsolute)(value));
}
async function inspectFile(value, label) {
    const path = (0, path_1.resolve)(value), before = await (0, promises_1.lstat)(path);
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1)
        throw new Error(`K56 ${label} must be a regular single-link non-link file`);
    const canonical = await (0, promises_1.realpath)(path);
    if (!samePath(path, canonical))
        throw new Error(`K56 ${label} symlink rejected`);
    return canonical;
}
async function checkpoint(root) {
    const actual = await inspectRoot(root.path, "output root");
    if (!samePath(root.realPath, actual.realPath) || root.dev !== actual.dev || root.ino !== actual.ino)
        throw new Error("K56 output root identity changed");
}
async function validateCharacterLeaderSupportedProjectionOutputRoot(value) {
    const root = await inspectRoot(value, "output root");
    await checkpoint(root);
}
exports.validateCharacterLeaderSupportedProjectionOutputRoot = validateCharacterLeaderSupportedProjectionOutputRoot;
async function validateCharacterLeaderSupportedProjectionRootSeparation(options) {
    const output = await inspectRoot(options.outputRoot, "output root");
    const roots = await Promise.all([
        inspectRoot(options.sidecarRoot, "sidecar source root"), inspectRoot(options.productionRoot, "production source root"),
        inspectRoot(options.fyiRoot, "FYI source root"), inspectRoot(options.k43Root, "K43 source root"),
        inspectRoot(options.k46Root, "K46 source root"), inspectRoot(options.k48Root, "K48 source root"),
    ]);
    for (const source of roots)
        if (containsPath(source.realPath, output.realPath) || containsPath(output.realPath, source.realPath)
            || source.dev === output.dev && source.ino === output.ino)
            throw new Error("K56 output root must not alias, contain, or descend from a source root");
    const [native, database] = await Promise.all([inspectFile(options.nativeRuntime, "native runtime"), inspectFile(options.database, "database")]);
    for (const source of [native, database])
        if (containsPath(output.realPath, source) || samePath(output.realPath, source)) {
            throw new Error("K56 output root must not contain or alias a source file");
        }
    await checkpoint(output);
}
exports.validateCharacterLeaderSupportedProjectionRootSeparation = validateCharacterLeaderSupportedProjectionRootSeparation;
async function readSnapshot(root, fileName, maximumBytesExclusive, expectedSize) {
    if (!/^[a-z0-9][a-z0-9.-]+$/.test(fileName) || fileName.includes("..") || fileName.includes("/") || fileName.includes("\\"))
        throw new Error("K56 member name rejected");
    const canonicalRoot = await inspectRoot(root, "artifact root");
    const path = (0, path_1.join)(canonicalRoot.path, fileName);
    if (!samePath(path, (0, path_1.resolve)(canonicalRoot.path, fileName)))
        throw new Error("K56 member is outside the caller-controlled stable root");
    const before = await (0, promises_1.lstat)(path);
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || before.size >= maximumBytesExclusive
        || (expectedSize !== undefined && before.size !== expectedSize))
        throw new Error("K56 member identity or byte budget rejected");
    const handle = await (0, promises_1.open)(path, fs_1.constants.O_RDONLY | (fs_1.constants.O_NOFOLLOW ?? 0));
    try {
        const opened = await handle.stat();
        if (!sameFile(before, opened) || !opened.isFile() || opened.nlink !== 1)
            throw new Error("K56 member changed while opening");
        const bytes = await handle.readFile();
        const after = await handle.stat(), visible = await (0, promises_1.lstat)(path);
        if (!sameFile(opened, after) || !sameFile(opened, visible) || after.nlink !== 1 || visible.nlink !== 1
            || visible.isSymbolicLink() || bytes.length !== opened.size || after.size !== opened.size || visible.size !== opened.size) {
            throw new Error("K56 member changed while reading");
        }
        return { path, bytes, metadata: after };
    }
    finally {
        await handle.close();
    }
}
async function loadCharacterLeaderSupportedProductiveSource(productionRoot) {
    const pin = leader_supported_projection_contract_1.CHARACTER_LEADER_SUPPORTED_PROJECTION_PIN;
    const path = await (0, artifact_path_1.resolveCharacterInputFile)((0, path_1.resolve)(productionRoot), pin.productiveFileName, pin.productiveFileName);
    const root = (0, path_1.resolve)(productionRoot);
    if (!samePath(path, (0, path_1.join)(root, pin.productiveFileName)))
        throw new Error("K56 productive path is outside the caller-controlled stable root");
    const snapshot = await readSnapshot(root, pin.productiveFileName, pin.productiveSizeBytes + 1, pin.productiveSizeBytes);
    if (hash(snapshot.bytes) !== pin.productiveSha256)
        throw new Error("K56 productive Character[] identity changed");
    let parsed = JSON.parse(snapshot.bytes.toString("utf8"));
    if (!Array.isArray(parsed) || parsed.length !== pin.productiveTopLevelCount)
        throw new Error("K56 productive Character[] cardinality changed");
    const ids = parsed.map((record) => {
        const value = record?.id;
        if ((typeof value !== "string" && typeof value !== "number") || value === "" || typeof value === "number" && !Number.isFinite(value))
            throw new Error("K56 productive card ID rejected");
        return String(value);
    });
    if (new Set(ids).size !== ids.length)
        throw new Error("K56 productive top-level card ID ambiguity");
    const cardIds = new Set(ids);
    parsed.length = 0;
    parsed = undefined;
    snapshot.bytes = Buffer.alloc(0);
    return {
        identity: { fileName: "characters.json", sha256: pin.productiveSha256, sizeBytes: pin.productiveSizeBytes, topLevelCount: pin.productiveTopLevelCount },
        cardIds,
        async revalidate() {
            const after = await readSnapshot(root, pin.productiveFileName, pin.productiveSizeBytes + 1, pin.productiveSizeBytes);
            if (hash(after.bytes) !== pin.productiveSha256 || !sameFile(snapshot.metadata, after.metadata))
                throw new Error("K56 productive Character[] changed during audit");
        },
        dispose() { cardIds.clear(); },
    };
}
exports.loadCharacterLeaderSupportedProductiveSource = loadCharacterLeaderSupportedProductiveSource;
async function buildCharacterLeaderSupportedProjectionFromSources(options, upstreamK55) {
    let k48 = await (0, leader_association_projection_1.validateCharacterLeaderAssociationProjectionArtifact)({
        artifactRoot: options.k48Root,
        sidecarRoot: options.sidecarRoot,
        productionRoot: options.productionRoot,
        fyiRoot: options.fyiRoot,
        k43Root: options.k43Root,
        k46Root: options.k46Root,
    });
    let k3Value = await (0, leader_value_scope_source_1.loadPinnedK3LeaderValueSource)(options.sidecarRoot);
    let k3Target = await (0, leader_target_semantics_source_1.loadPinnedK3LeaderTargetSource)(options.sidecarRoot);
    let k3Causality = await (0, leader_causality_semantics_source_1.loadPinnedK3LeaderCausalitySource)(options.sidecarRoot);
    let database = await (0, leader_causality_semantics_source_1.loadPinnedLeaderCausalityDatabase)(options.database);
    let productive = await loadCharacterLeaderSupportedProductiveSource(options.productionRoot);
    const identities = {
        value: k3Value.identity,
        target: k3Target.identity,
        causality: k3Causality.identity,
        database: database.identity,
    };
    const built = (0, leader_supported_projection_1.buildCharacterLeaderSupportedProjection)({
        k48: k48.artifacts,
        k3Value,
        k3Target,
        k3Causality,
        causalityDatabase: database,
        productive,
        upstreamK55,
    });
    await productive.revalidate();
    productive.dispose();
    k48 = undefined;
    k3Value = undefined;
    k3Target = undefined;
    k3Causality = undefined;
    database = undefined;
    productive = undefined;
    if (global.gc)
        global.gc();
    let valueAfter = await (0, leader_value_scope_source_1.loadPinnedK3LeaderValueSource)(options.sidecarRoot);
    (0, leader_value_scope_source_1.assertLeaderValueK3Stable)(identities.value, valueAfter.identity);
    valueAfter = undefined;
    let targetAfter = await (0, leader_target_semantics_source_1.loadPinnedK3LeaderTargetSource)(options.sidecarRoot);
    (0, leader_target_semantics_source_1.assertLeaderTargetK3Stable)(identities.target, targetAfter.identity);
    targetAfter = undefined;
    let causalityAfter = await (0, leader_causality_semantics_source_1.loadPinnedK3LeaderCausalitySource)(options.sidecarRoot);
    (0, leader_causality_semantics_source_1.assertLeaderCausalityK3Stable)(identities.causality, causalityAfter.identity);
    causalityAfter = undefined;
    let databaseAfter = await (0, leader_causality_semantics_source_1.loadPinnedLeaderCausalityDatabase)(options.database);
    (0, leader_causality_semantics_source_1.assertLeaderCausalityDatabaseStable)(identities.database, databaseAfter.identity);
    databaseAfter = undefined;
    if (global.gc)
        global.gc();
    return (0, leader_supported_projection_1.materializeCharacterLeaderSupportedProjection)(built.dataset, built.coverage);
}
exports.buildCharacterLeaderSupportedProjectionFromSources = buildCharacterLeaderSupportedProjectionFromSources;
function validOutputName(name) {
    return name === leader_supported_projection_contract_1.CHARACTER_LEADER_SUPPORTED_PROJECTION_FILES.coverage
        || name === leader_supported_projection_contract_1.CHARACTER_LEADER_SUPPORTED_PROJECTION_FILES.validation
        || name === leader_supported_projection_contract_1.CHARACTER_LEADER_SUPPORTED_PROJECTION_FILES.manifest
        || /^database-characters-k56-leader-supported-projection\.[a-f0-9]{64}\.json\.gz$/.test(name);
}
async function writeCreateOnly(root, name, bytes) {
    if (!validOutputName(name))
        throw new Error("K56 output member name rejected");
    await checkpoint(root);
    const path = (0, path_1.join)(root.path, name);
    if (!samePath(path, (0, path_1.resolve)(root.path, name)))
        throw new Error("K56 output member is outside the caller-controlled stable root");
    const handle = await (0, promises_1.open)(path, fs_1.constants.O_CREAT | fs_1.constants.O_EXCL | fs_1.constants.O_RDWR | (fs_1.constants.O_NOFOLLOW ?? 0), 0o600);
    try {
        await handle.writeFile(bytes);
        await handle.sync();
        const opened = await handle.stat(), visible = await (0, promises_1.lstat)(path);
        if (!opened.isFile() || opened.nlink !== 1 || opened.size !== bytes.length || !sameFile(opened, visible)
            || visible.isSymbolicLink() || visible.nlink !== 1)
            throw new Error("K56 create-only member identity rejected");
    }
    finally {
        await handle.close();
    }
    await checkpoint(root);
}
async function writeCharacterLeaderSupportedProjectionArtifacts(outputRoot, artifacts) {
    const canonical = (0, leader_supported_projection_1.materializeCharacterLeaderSupportedProjection)(artifacts.dataset, artifacts.coverage);
    if (!canonical.raw.equals(artifacts.raw) || !canonical.gzip.equals(artifacts.gzip)
        || !canonical.coverageBytes.equals(artifacts.coverageBytes) || !canonical.validationBytes.equals(artifacts.validationBytes)
        || !canonical.manifestBytes.equals(artifacts.manifestBytes))
        throw new Error("K56 output artifact set is not canonical");
    const root = await inspectRoot(outputRoot, "output root");
    const files = [
        { name: artifacts.manifest.fileName, bytes: artifacts.gzip },
        { name: leader_supported_projection_contract_1.CHARACTER_LEADER_SUPPORTED_PROJECTION_FILES.coverage, bytes: artifacts.coverageBytes },
        { name: leader_supported_projection_contract_1.CHARACTER_LEADER_SUPPORTED_PROJECTION_FILES.validation, bytes: artifacts.validationBytes },
        { name: leader_supported_projection_contract_1.CHARACTER_LEADER_SUPPORTED_PROJECTION_FILES.manifest, bytes: artifacts.manifestBytes },
    ];
    for (const file of files) {
        try {
            await (0, promises_1.lstat)((0, path_1.join)(root.path, file.name));
            throw new Error(`K56 output already exists: ${file.name}`);
        }
        catch (error) {
            if (error?.code !== "ENOENT")
                throw error;
        }
    }
    for (const file of files)
        await writeCreateOnly(root, file.name, file.bytes);
}
exports.writeCharacterLeaderSupportedProjectionArtifacts = writeCharacterLeaderSupportedProjectionArtifacts;
async function readArtifactSet(root) {
    const manifestSnapshot = await readSnapshot(root, leader_supported_projection_contract_1.CHARACTER_LEADER_SUPPORTED_PROJECTION_FILES.manifest, leader_supported_projection_contract_1.CHARACTER_LEADER_SUPPORTED_PROJECTION_METADATA_LIMIT_BYTES);
    const manifest = JSON.parse(manifestSnapshot.bytes.toString("utf8"));
    if (!/^database-characters-k56-leader-supported-projection\.[a-f0-9]{64}\.json\.gz$/.test(manifest.fileName)
        || manifest.fileName.split(".")[1] !== manifest.sha256 || manifest.coverageFile !== leader_supported_projection_contract_1.CHARACTER_LEADER_SUPPORTED_PROJECTION_FILES.coverage
        || manifest.validationFile !== leader_supported_projection_contract_1.CHARACTER_LEADER_SUPPORTED_PROJECTION_FILES.validation
        || manifest.outputNamespaceThreatModel !== "caller_controlled_stable_during_operation"
        || manifest.concurrentSameUserAncestorReplacementProtected !== false
        || manifest.sizeBytes >= leader_supported_projection_contract_1.CHARACTER_LEADER_SUPPORTED_PROJECTION_GZIP_LIMIT_BYTES
        || manifest.uncompressedSizeBytes >= leader_supported_projection_contract_1.CHARACTER_LEADER_SUPPORTED_PROJECTION_RAW_LIMIT_BYTES
        || manifest.coverageSizeBytes + manifest.validationSizeBytes + manifestSnapshot.bytes.length >= leader_supported_projection_contract_1.CHARACTER_LEADER_SUPPORTED_PROJECTION_METADATA_LIMIT_BYTES) {
        throw new Error("K56 manifest identity or budget rejected");
    }
    const [payload, coverageSnapshot, validationSnapshot] = await Promise.all([
        readSnapshot(root, manifest.fileName, leader_supported_projection_contract_1.CHARACTER_LEADER_SUPPORTED_PROJECTION_GZIP_LIMIT_BYTES, manifest.sizeBytes),
        readSnapshot(root, manifest.coverageFile, leader_supported_projection_contract_1.CHARACTER_LEADER_SUPPORTED_PROJECTION_METADATA_LIMIT_BYTES, manifest.coverageSizeBytes),
        readSnapshot(root, manifest.validationFile, leader_supported_projection_contract_1.CHARACTER_LEADER_SUPPORTED_PROJECTION_METADATA_LIMIT_BYTES, manifest.validationSizeBytes),
    ]);
    if (hash(payload.bytes) !== manifest.sha256 || hash(coverageSnapshot.bytes) !== manifest.coverageSha256
        || hash(validationSnapshot.bytes) !== manifest.validationSha256)
        throw new Error("K56 artifact hash rejected");
    const raw = (0, zlib_1.gunzipSync)(payload.bytes, { maxOutputLength: leader_supported_projection_contract_1.CHARACTER_LEADER_SUPPORTED_PROJECTION_RAW_LIMIT_BYTES });
    if (raw.length !== manifest.uncompressedSizeBytes || hash(raw) !== manifest.uncompressedSha256
        || !payload.bytes.equals((0, zlib_1.gzipSync)(raw, { level: 9 })))
        throw new Error("K56 canonical payload rejected");
    const dataset = JSON.parse(raw.toString("utf8"));
    const coverage = JSON.parse(coverageSnapshot.bytes.toString("utf8"));
    const validation = JSON.parse(validationSnapshot.bytes.toString("utf8"));
    const rebuilt = (0, leader_supported_projection_1.materializeCharacterLeaderSupportedProjection)(dataset, coverage);
    if (!rebuilt.raw.equals(raw) || !rebuilt.gzip.equals(payload.bytes) || !rebuilt.coverageBytes.equals(coverageSnapshot.bytes)
        || !rebuilt.validationBytes.equals(validationSnapshot.bytes) || !rebuilt.manifestBytes.equals(manifestSnapshot.bytes)
        || JSON.stringify(rebuilt.validation) !== JSON.stringify(validation))
        throw new Error("K56 artifact reconstruction rejected");
    return rebuilt;
}
async function validateCharacterLeaderSupportedProjectionArtifact(options) {
    const upstreamK55 = await (0, leader_lifecycle_semantics_run_1.runCharacterLeaderLifecycleSemanticsAudit)({
        optIn: true,
        sidecarRoot: options.sidecarRoot,
        productionRoot: options.productionRoot,
        fyiRoot: options.fyiRoot,
        k43Root: options.k43Root,
        k46Root: options.k46Root,
        k48Root: options.k48Root,
        nativeRuntime: options.nativeRuntime,
        database: options.database,
    });
    let expected = await buildCharacterLeaderSupportedProjectionFromSources(options, upstreamK55);
    let actual = await readArtifactSet(options.artifactRoot);
    assertCharacterLeaderSupportedProjectionArtifactBytes(actual, expected);
    const reread = await readArtifactSet(options.artifactRoot);
    if (!actual.gzip.equals(reread.gzip) || !actual.coverageBytes.equals(reread.coverageBytes)
        || !actual.validationBytes.equals(reread.validationBytes) || !actual.manifestBytes.equals(reread.manifestBytes)) {
        throw new Error("K56 artifacts changed during source-bound validation");
    }
    expected = undefined;
    actual = undefined;
    if (global.gc)
        global.gc();
    return { artifacts: reread, sourceBoundValidation: "GO" };
}
exports.validateCharacterLeaderSupportedProjectionArtifact = validateCharacterLeaderSupportedProjectionArtifact;
function assertCharacterLeaderSupportedProjectionArtifactBytes(actual, expected) {
    for (const [label, actualBytes, expectedBytes] of [
        ["payload", actual.gzip, expected.gzip], ["coverage", actual.coverageBytes, expected.coverageBytes],
        ["validation", actual.validationBytes, expected.validationBytes], ["manifest", actual.manifestBytes, expected.manifestBytes],
    ])
        if (!actualBytes.equals(expectedBytes))
            throw new Error(`K56 source-bound artifact mismatch: ${label}`);
}
exports.assertCharacterLeaderSupportedProjectionArtifactBytes = assertCharacterLeaderSupportedProjectionArtifactBytes;
//# sourceMappingURL=leader-supported-projection-source.js.map