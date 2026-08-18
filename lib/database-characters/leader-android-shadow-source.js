"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readCharacterLeaderAndroidShadowArtifacts = exports.writeCharacterLeaderAndroidShadowArtifacts = exports.validateCharacterLeaderAndroidShadowRootSeparation = exports.loadCharacterLeaderAndroidShadowSources = void 0;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const zlib_1 = require("zlib");
const leader_android_shadow_contract_1 = require("./leader-android-shadow-contract");
const leader_android_shadow_1 = require("./leader-android-shadow");
const leader_supported_compatibility_source_1 = require("./leader-supported-compatibility-source");
const leader_supported_compatibility_git_source_1 = require("./leader-supported-compatibility-git-source");
const O_NOFOLLOW = fs_1.constants.O_NOFOLLOW ?? 0;
function samePath(left, right) {
    const a = (0, path_1.resolve)(left), b = (0, path_1.resolve)(right);
    return process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b;
}
function pathsOverlap(left, right) {
    const a = (0, path_1.resolve)(left), b = (0, path_1.resolve)(right);
    const leftToRight = (0, path_1.relative)(a, b), rightToLeft = (0, path_1.relative)(b, a);
    const inside = (value) => value === "" || !value.startsWith("..") && !(0, path_1.isAbsolute)(value);
    return inside(leftToRight) || inside(rightToLeft);
}
async function canonicalDirectory(value, label) {
    if (!value || !(0, path_1.isAbsolute)(value))
        throw new Error(`K64 ${label} must be absolute`);
    const path = (0, path_1.resolve)(value);
    const [metadata, canonical] = await Promise.all([(0, promises_1.lstat)(path), (0, promises_1.realpath)(path)]);
    if (!metadata.isDirectory() || metadata.isSymbolicLink() || !samePath(path, canonical)) {
        throw new Error(`K64 ${label} must be a canonical non-link directory`);
    }
    return path;
}
async function readExactFile(path, maximumBytesExclusive, label) {
    const handle = await (0, promises_1.open)(path, fs_1.constants.O_RDONLY | O_NOFOLLOW);
    try {
        const before = await handle.stat();
        if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || before.size <= 0
            || before.size >= maximumBytesExclusive)
            throw new Error(`K64 ${label} file rejected`);
        const bytes = Buffer.alloc(before.size);
        let offset = 0;
        while (offset < bytes.length) {
            const result = await handle.read(bytes, offset, bytes.length - offset, offset);
            if (result.bytesRead <= 0)
                throw new Error(`K64 ${label} short read`);
            offset += result.bytesRead;
        }
        const after = await handle.stat();
        if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size
            || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs || before.nlink !== after.nlink) {
            throw new Error(`K64 ${label} changed during read`);
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
        throw new Error(`K64 ${label} JSON rejected`);
    }
    if (!Buffer.from(JSON.stringify(value), "utf8").equals(bytes))
        throw new Error(`K64 ${label} is not canonical JSON`);
    return value;
}
async function loadCharacterLeaderAndroidShadowSources(k56Root, androidRepository) {
    if (pathsOverlap(k56Root, androidRepository))
        throw new Error("K64 source roots overlap");
    const [k56, androidSource] = await Promise.all([
        (0, leader_supported_compatibility_source_1.readCharacterLeaderSupportedCompatibilityK56)(k56Root),
        (0, leader_supported_compatibility_git_source_1.verifyCharacterLeaderCompatibilityAndroidSourcePin)(androidRepository, leader_android_shadow_contract_1.CHARACTER_LEADER_ANDROID_SHADOW_SOURCE_PIN.android),
    ]);
    return { k56, androidSource };
}
exports.loadCharacterLeaderAndroidShadowSources = loadCharacterLeaderAndroidShadowSources;
async function validateCharacterLeaderAndroidShadowRootSeparation(k56Root, androidRepository, outputRoot) {
    const [k56, android, outputParent] = await Promise.all([
        canonicalDirectory(k56Root, "K56 root"),
        canonicalDirectory(androidRepository, "Android repository"),
        canonicalDirectory((0, path_1.dirname)((0, path_1.resolve)(outputRoot)), "output parent"),
    ]);
    const output = (0, path_1.resolve)(outputRoot);
    if (!(0, path_1.isAbsolute)(outputRoot) || !samePath((0, path_1.dirname)(output), outputParent)
        || pathsOverlap(k56, android) || pathsOverlap(k56, output) || pathsOverlap(android, output)) {
        throw new Error("K64 source/output roots overlap or output parent changed");
    }
    try {
        await (0, promises_1.lstat)(output);
        throw new Error("K64 output root already exists");
    }
    catch (error) {
        if (error.code !== "ENOENT")
            throw error;
    }
}
exports.validateCharacterLeaderAndroidShadowRootSeparation = validateCharacterLeaderAndroidShadowRootSeparation;
async function writeExclusive(path, bytes) {
    const handle = await (0, promises_1.open)(path, fs_1.constants.O_CREAT | fs_1.constants.O_EXCL | fs_1.constants.O_WRONLY | O_NOFOLLOW, 0o600);
    try {
        let offset = 0;
        while (offset < bytes.length) {
            const result = await handle.write(bytes, offset, bytes.length - offset, offset);
            if (result.bytesWritten <= 0)
                throw new Error("K64 output short write");
            offset += result.bytesWritten;
        }
        await handle.sync();
    }
    finally {
        await handle.close();
    }
}
async function writeCharacterLeaderAndroidShadowArtifacts(outputRoot, artifacts) {
    (0, leader_android_shadow_1.assertRealCharacterLeaderAndroidShadowArtifactBytes)(artifacts);
    await (0, promises_1.mkdir)(outputRoot, { recursive: false, mode: 0o700 });
    await writeExclusive((0, path_1.resolve)(outputRoot, artifacts.manifest.fileName), artifacts.gzip);
    await writeExclusive((0, path_1.resolve)(outputRoot, leader_android_shadow_contract_1.CHARACTER_LEADER_ANDROID_SHADOW_FILES.provenancePin), artifacts.provenancePinBytes);
    await writeExclusive((0, path_1.resolve)(outputRoot, leader_android_shadow_contract_1.CHARACTER_LEADER_ANDROID_SHADOW_FILES.validation), artifacts.validationBytes);
    await writeExclusive((0, path_1.resolve)(outputRoot, leader_android_shadow_contract_1.CHARACTER_LEADER_ANDROID_SHADOW_FILES.manifest), artifacts.manifestBytes);
}
exports.writeCharacterLeaderAndroidShadowArtifacts = writeCharacterLeaderAndroidShadowArtifacts;
async function readCharacterLeaderAndroidShadowArtifacts(rootValue, expectedProvenancePinSha256) {
    const root = await canonicalDirectory(rootValue, "artifact root");
    const entries = await (0, promises_1.readdir)(root, { withFileTypes: true });
    if (entries.length !== 4 || entries.some(entry => !entry.isFile() || entry.isSymbolicLink())) {
        throw new Error("K64 artifact inventory rejected");
    }
    const manifestBytes = await readExactFile((0, path_1.resolve)(root, leader_android_shadow_contract_1.CHARACTER_LEADER_ANDROID_SHADOW_FILES.manifest), leader_android_shadow_contract_1.CHARACTER_LEADER_ANDROID_SHADOW_MANIFEST_LIMIT_BYTES, "manifest");
    const manifest = parseCanonical(manifestBytes, "manifest");
    const expected = [
        manifest.fileName,
        leader_android_shadow_contract_1.CHARACTER_LEADER_ANDROID_SHADOW_FILES.manifest,
        leader_android_shadow_contract_1.CHARACTER_LEADER_ANDROID_SHADOW_FILES.provenancePin,
        leader_android_shadow_contract_1.CHARACTER_LEADER_ANDROID_SHADOW_FILES.validation,
    ].sort();
    if (JSON.stringify(entries.map(entry => entry.name).sort()) !== JSON.stringify(expected)) {
        throw new Error("K64 artifact member names rejected");
    }
    const [gzip, provenancePinBytes, validationBytes] = await Promise.all([
        readExactFile((0, path_1.resolve)(root, manifest.fileName), leader_android_shadow_contract_1.CHARACTER_LEADER_ANDROID_SHADOW_GZIP_LIMIT_BYTES, "payload"),
        readExactFile((0, path_1.resolve)(root, leader_android_shadow_contract_1.CHARACTER_LEADER_ANDROID_SHADOW_FILES.provenancePin), leader_android_shadow_contract_1.CHARACTER_LEADER_ANDROID_SHADOW_METADATA_LIMIT_BYTES, "provenance pin"),
        readExactFile((0, path_1.resolve)(root, leader_android_shadow_contract_1.CHARACTER_LEADER_ANDROID_SHADOW_FILES.validation), leader_android_shadow_contract_1.CHARACTER_LEADER_ANDROID_SHADOW_METADATA_LIMIT_BYTES, "validation"),
    ]);
    const raw = (0, zlib_1.gunzipSync)(gzip, { maxOutputLength: leader_android_shadow_contract_1.CHARACTER_LEADER_ANDROID_SHADOW_RAW_LIMIT_BYTES });
    const dataset = parseCanonical(raw, "payload");
    const provenancePin = parseCanonical(provenancePinBytes, "provenance pin");
    const validation = parseCanonical(validationBytes, "validation");
    const artifacts = {
        dataset, manifest, provenancePin, validation, raw, gzip, manifestBytes, provenancePinBytes, validationBytes,
    };
    if (!/^[a-f0-9]{64}$/.test(expectedProvenancePinSha256)
        || (0, crypto_1.createHash)("sha256").update(provenancePinBytes).digest("hex") !== expectedProvenancePinSha256) {
        throw new Error("K64 externally supplied provenance pin identity rejected");
    }
    (0, leader_android_shadow_1.assertRealCharacterLeaderAndroidShadowArtifactBytes)(artifacts);
    const rootAfter = await (0, promises_1.stat)(root);
    if (!rootAfter.isDirectory())
        throw new Error("K64 artifact root changed");
    return artifacts;
}
exports.readCharacterLeaderAndroidShadowArtifacts = readCharacterLeaderAndroidShadowArtifacts;
//# sourceMappingURL=leader-android-shadow-source.js.map