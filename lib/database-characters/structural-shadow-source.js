"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadCharacterStructuralShadowProductiveSource = void 0;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const stream_1 = require("stream");
const zlib_1 = require("zlib");
const artifact_path_1 = require("./artifact-path");
const structural_sidecar_contract_1 = require("./structural-sidecar-contract");
const structural_shadow_evaluator_1 = require("./structural-shadow-evaluator");
const hash = (bytes) => (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
const samePath = (left, right) => process.platform === "win32"
    ? (0, path_1.resolve)(left).toLowerCase() === (0, path_1.resolve)(right).toLowerCase()
    : (0, path_1.resolve)(left) === (0, path_1.resolve)(right);
const sameFile = (left, right) => left.dev === right.dev && left.ino === right.ino;
async function regularRoot(value) {
    const path = (0, path_1.resolve)(value);
    const metadata = await (0, promises_1.lstat)(path);
    if (!metadata.isDirectory() || metadata.isSymbolicLink())
        throw new Error("K33 productive root must be a regular non-link directory");
    const canonical = await (0, promises_1.realpath)(path);
    if (!samePath(path, canonical))
        throw new Error("K33 productive root symlink or junction rejected");
    return canonical;
}
async function readSnapshot(root, fileName) {
    const path = await (0, artifact_path_1.resolveCharacterInputFile)(root, fileName, fileName);
    const direct = (0, path_1.join)(root, fileName);
    if (!samePath(path, direct))
        throw new Error(`K33 productive ${fileName} escaped its literal contained path`);
    const before = await (0, promises_1.lstat)(direct);
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1) {
        throw new Error(`K33 productive ${fileName} must be a single-link regular non-link file`);
    }
    const handle = await (0, promises_1.open)(direct, fs_1.constants.O_RDONLY | (fs_1.constants.O_NOFOLLOW ?? 0));
    try {
        const opened = await handle.stat();
        if (!opened.isFile() || opened.nlink !== 1 || !sameFile(before, opened)) {
            throw new Error(`K33 productive ${fileName} identity changed while opening`);
        }
        const bytes = await handle.readFile();
        const after = await handle.stat();
        const afterPath = await (0, promises_1.lstat)(direct);
        if (!afterPath.isFile() || afterPath.isSymbolicLink() || afterPath.nlink !== 1
            || !sameFile(opened, after) || !sameFile(opened, afterPath)
            || after.size !== bytes.length || afterPath.size !== bytes.length
            || after.mtimeMs !== opened.mtimeMs || after.ctimeMs !== opened.ctimeMs
            || afterPath.mtimeMs !== opened.mtimeMs || afterPath.ctimeMs !== opened.ctimeMs) {
            throw new Error(`K33 productive ${fileName} changed while reading`);
        }
        return { path: direct, bytes, metadata: after };
    }
    finally {
        await handle.close();
    }
}
function exact(snapshot, expected, label) {
    if (snapshot.bytes.length !== expected.sizeBytes || hash(snapshot.bytes) !== expected.sha256) {
        throw new Error(`K33 ${label} identity changed`);
    }
}
function unchanged(before, after, label) {
    if (!samePath(before.path, after.path) || !sameFile(before.metadata, after.metadata)
        || before.metadata.size !== after.metadata.size || before.metadata.mtimeMs !== after.metadata.mtimeMs
        || before.metadata.ctimeMs !== after.metadata.ctimeMs || !before.bytes.equals(after.bytes)) {
        throw new Error(`K33 ${label} changed during shadow evaluation`);
    }
}
async function gunzipExactlyBounded(bytes, exactSizeBytes) {
    const chunks = [];
    let size = 0;
    const stream = stream_1.Readable.from([bytes]).pipe((0, zlib_1.createGunzip)());
    for await (const value of stream) {
        const chunk = Buffer.from(value);
        size += chunk.length;
        if (size > exactSizeBytes) {
            stream.destroy();
            throw new Error("K33 productive decompression exceeded pinned size");
        }
        chunks.push(chunk);
    }
    if (size !== exactSizeBytes)
        throw new Error("K33 productive uncompressed size changed");
    return Buffer.concat(chunks, size);
}
function validateManifest(value) {
    const pin = structural_sidecar_contract_1.CHARACTER_STRUCTURAL_SIDECAR_SOURCE_PIN.productiveCharacters;
    if (value?.schemaVersion !== 1 || value.datasetVersion !== pin.datasetVersion || value.generatedAt !== pin.datasetVersion
        || value.fileName !== pin.manifestPayloadFile || value.compression !== "gzip" || value.sha256 !== pin.payloadSha256
        || value.sizeBytes !== pin.payloadSizeBytes || value.uncompressedSizeBytes !== pin.uncompressedSizeBytes
        || value.characterCount !== pin.topLevelCount)
        throw new Error("K33 productive Character manifest lineage changed");
}
async function loadCharacterStructuralShadowProductiveSource(productiveRootValue) {
    const root = await regularRoot(productiveRootValue);
    const pin = structural_sidecar_contract_1.CHARACTER_STRUCTURAL_SIDECAR_SOURCE_PIN.productiveCharacters;
    const [manifestSnapshot, payloadSnapshot] = await Promise.all([
        readSnapshot(root, pin.manifestFile),
        readSnapshot(root, pin.localPayloadFile),
    ]);
    exact(manifestSnapshot, { sha256: pin.manifestSha256, sizeBytes: pin.manifestSizeBytes }, "productive manifest");
    exact(payloadSnapshot, { sha256: pin.payloadSha256, sizeBytes: pin.payloadSizeBytes }, "productive payload");
    validateManifest(JSON.parse(manifestSnapshot.bytes.toString("utf8")));
    let raw = await gunzipExactlyBounded(payloadSnapshot.bytes, pin.uncompressedSizeBytes);
    const parsedCharacters = JSON.parse(raw.toString("utf8"));
    if (!Array.isArray(parsedCharacters) || parsedCharacters.length !== pin.topLevelCount)
        throw new Error("K33 productive Character[] cardinality changed");
    let characters = parsedCharacters;
    const characterSnapshotSha256 = hash(Buffer.from(JSON.stringify(characters), "utf8"));
    raw = null;
    return {
        evaluate(sidecar) {
            if (!characters)
                throw new Error("K33 productive source already disposed");
            const sidecarSnapshotSha256 = hash(Buffer.from(JSON.stringify(sidecar), "utf8"));
            const result = (0, structural_shadow_evaluator_1.evaluateCharacterStructuralRepresentation)(sidecar, characters);
            if (hash(Buffer.from(JSON.stringify(sidecar), "utf8")) !== sidecarSnapshotSha256
                || hash(Buffer.from(JSON.stringify(characters), "utf8")) !== characterSnapshotSha256) {
                throw new Error("K33 input object mutation detected");
            }
            return result;
        },
        async revalidate() {
            const [manifestAfter, payloadAfter] = await Promise.all([
                readSnapshot(root, pin.manifestFile),
                readSnapshot(root, pin.localPayloadFile),
            ]);
            exact(manifestAfter, { sha256: pin.manifestSha256, sizeBytes: pin.manifestSizeBytes }, "productive manifest revalidation");
            exact(payloadAfter, { sha256: pin.payloadSha256, sizeBytes: pin.payloadSizeBytes }, "productive payload revalidation");
            unchanged(manifestSnapshot, manifestAfter, "productive manifest");
            unchanged(payloadSnapshot, payloadAfter, "productive payload");
        },
        dispose() {
            characters = null;
            manifestSnapshot.bytes = Buffer.alloc(0);
            payloadSnapshot.bytes = Buffer.alloc(0);
        },
    };
}
exports.loadCharacterStructuralShadowProductiveSource = loadCharacterStructuralShadowProductiveSource;
//# sourceMappingURL=structural-shadow-source.js.map