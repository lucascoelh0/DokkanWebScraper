"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadCharacterCompactGenerationSource = void 0;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const string_decoder_1 = require("string_decoder");
const zlib_1 = require("zlib");
const artifact_path_1 = require("./artifact-path");
const refresh_contract_1 = require("./refresh-contract");
const shadow_release_1 = require("./shadow-release");
const MANIFEST_FILE = "database-characters-k10-k14-manifest.json";
const hash = (bytes) => (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
async function exactRegularFile(root, fileName) {
    const rootPath = (0, path_1.resolve)(root);
    const rootMetadata = await (0, promises_1.lstat)(rootPath);
    if (rootMetadata.isSymbolicLink() || !rootMetadata.isDirectory())
        throw new Error("artifact root must be a regular non-link directory");
    const candidate = (0, path_1.join)(rootPath, fileName);
    const metadata = await (0, promises_1.lstat)(candidate);
    if (metadata.isSymbolicLink() || !metadata.isFile())
        throw new Error(`${fileName} must be a regular non-link file`);
    return (0, artifact_path_1.resolveCharacterInputFile)(rootPath, fileName, fileName);
}
function exact(bytes, expected, label) {
    if (bytes.length !== expected.sizeBytes || hash(bytes) !== expected.sha256)
        throw new Error(`${label} identity changed`);
}
function sidecar(gate) {
    const profile = refresh_contract_1.CHARACTER_REFRESH_PROFILE.sidecars.find(item => item.gate === gate);
    if (!profile)
        throw new Error(`${gate.toUpperCase()} profile missing`);
    return profile;
}
async function loadCharacterCompactGenerationSource(root) {
    const controlledRoot = (0, path_1.resolve)(root);
    const manifestPath = await exactRegularFile(controlledRoot, MANIFEST_FILE);
    const manifestBytes = await (0, promises_1.readFile)(manifestPath);
    exact(manifestBytes, { sha256: shadow_release_1.CHARACTER_SHADOW_PINNED_RELEASE.manifestSha256, sizeBytes: shadow_release_1.CHARACTER_SHADOW_PINNED_RELEASE.manifestSizeBytes }, "K10-K14 manifest");
    const manifest = JSON.parse(manifestBytes.toString("utf8"));
    if (!(0, shadow_release_1.manifestMatchesPinnedCharacterShadowRelease)(manifest))
        throw new Error("K10-K14 manifest is not the pinned offline release");
    const [artifactPath, coveragePath, validationPath, readinessPath] = await Promise.all([
        exactRegularFile(controlledRoot, manifest.fileName),
        exactRegularFile(controlledRoot, manifest.coverageFile),
        exactRegularFile(controlledRoot, manifest.validationFile),
        exactRegularFile(controlledRoot, manifest.readinessFile),
    ]);
    const [artifactBytes, coverageBytes, validationBytes, readinessBytes] = await Promise.all([
        (0, promises_1.readFile)(artifactPath), (0, promises_1.readFile)(coveragePath), (0, promises_1.readFile)(validationPath), (0, promises_1.readFile)(readinessPath),
    ]);
    exact(artifactBytes, { sha256: manifest.sha256, sizeBytes: manifest.sizeBytes }, "K11 projection");
    exact(coverageBytes, { sha256: manifest.coverageSha256, sizeBytes: manifest.coverageSizeBytes }, "K12 coverage");
    exact(validationBytes, { sha256: manifest.validationSha256, sizeBytes: manifest.validationSizeBytes }, "K13 validation");
    exact(readinessBytes, { sha256: manifest.readinessSha256, sizeBytes: manifest.readinessSizeBytes }, "K14 readiness");
    const coverage = JSON.parse(coverageBytes.toString("utf8"));
    const validation = JSON.parse(validationBytes.toString("utf8"));
    const readiness = JSON.parse(readinessBytes.toString("utf8"));
    validateAncillaryContracts(coverage, validation, readiness);
    const header = await readK11Header(artifactPath);
    validateK11Header(header);
    const k0 = sidecar("k0");
    const k1 = sidecar("k1");
    const k2 = sidecar("k2");
    const lineage = {
        profileId: refresh_contract_1.CHARACTER_REFRESH_PROFILE.profileId,
        snapshotVersion: refresh_contract_1.CHARACTER_REFRESH_PROFILE.snapshotVersion,
        database: { ...refresh_contract_1.CHARACTER_REFRESH_PROFILE.sqlite },
        db1: { ...refresh_contract_1.CHARACTER_REFRESH_PROFILE.db1 },
        k0: { contractVersion: k0.contractVersion, ...header.source.sidecars.k0 },
        k1: { contractVersion: k1.contractVersion, ...header.source.sidecars.k1 },
        k2: { contractVersion: k2.contractVersion, ...header.source.sidecars.k2 },
        k11: {
            contractVersion: manifest.contractVersion,
            sha256: manifest.sha256,
            sizeBytes: manifest.sizeBytes,
            uncompressedSha256: manifest.uncompressedSha256,
            uncompressedSizeBytes: manifest.uncompressedSizeBytes,
        },
        k12: { contractVersion: coverage.contractVersion, sha256: manifest.coverageSha256, sizeBytes: manifest.coverageSizeBytes },
        k13: { contractVersion: "1.0.0", sha256: manifest.validationSha256, sizeBytes: manifest.validationSizeBytes },
        k14: { contractVersion: readiness.contractVersion, sha256: manifest.readinessSha256, sizeBytes: manifest.readinessSizeBytes },
        productionCharacters: { ...header.source.productionCharacters },
    };
    return {
        generatedAt: manifest.generatedAt,
        datasetVersion: `${refresh_contract_1.CHARACTER_REFRESH_PROFILE.snapshotVersion}-k15-v1`,
        lineage,
        coverage,
        readiness,
        streamFields: async (accept) => {
            const streamed = await streamPinnedK11(artifactPath, accept);
            validateK11Header(streamed.header);
        },
    };
}
exports.loadCharacterCompactGenerationSource = loadCharacterCompactGenerationSource;
async function readK11Header(path) {
    const source = (0, fs_1.createReadStream)(path);
    const stream = source.pipe((0, zlib_1.createGunzip)());
    const decoder = new string_decoder_1.StringDecoder("utf8");
    const marker = ',"fields":[';
    let prefix = "";
    try {
        for await (const chunk of stream) {
            prefix += decoder.write(chunk);
            const index = prefix.indexOf(marker);
            if (index >= 0)
                return JSON.parse(`${prefix.slice(0, index)}}`);
            if (prefix.length > 1000000)
                throw new Error("K11 header exceeds parser limit");
        }
    }
    finally {
        stream.destroy();
        source.destroy();
    }
    throw new Error("K11 fields marker missing");
}
function validateAncillaryContracts(coverage, validation, readiness) {
    if (coverage.schemaVersion !== 1 || coverage.contract !== "dokkan-database-character-field-shadow-coverage" || coverage.contractVersion !== "1.0.0")
        throw new Error("K12 contract changed");
    if (coverage.cardCount !== 5759 || coverage.productionJoinedCount !== 4296 || coverage.productionUnjoinableCount !== 1463)
        throw new Error("K12 join inventory changed");
    if (validation?.schemaVersion !== 1 || validation.valid !== true || !Array.isArray(validation.failures) || validation.failures.length)
        throw new Error("K13 validation contract changed");
    if (readiness.schemaVersion !== 1 || readiness.contract !== "dokkan-database-character-field-shadow-readiness" || readiness.contractVersion !== "1.0.1")
        throw new Error("K14 contract changed");
    for (const field of ["id", "rarity", "type"]) {
        const decision = readiness.fields.find(item => item.field === field);
        if (!decision || decision.decision !== "GO" || decision.patchableCharacterCount !== 4296 || !Object.values(decision.criteria).every(Boolean))
            throw new Error(`K14 did not approve ${field}`);
    }
    if (readiness.nextGate.action !== "generate_compact_supported_projection" || readiness.nextGate.decision !== "GO" || readiness.nextGate.gates.generateAndValidate !== "GO")
        throw new Error("K14 did not approve K15 generation");
}
function validateK11Header(header) {
    if (header.schemaVersion !== 1 || header.contract !== "dokkan-database-character-field-shadow" || header.contractVersion !== "1.0.0")
        throw new Error("K11 contract changed");
    if (header.generatedAt !== refresh_contract_1.CHARACTER_REFRESH_PROFILE.generatedAt || header.source.snapshotVersion !== refresh_contract_1.CHARACTER_REFRESH_PROFILE.snapshotVersion)
        throw new Error("K11 snapshot lineage changed");
    for (const gate of ["k0", "k1", "k2"]) {
        const expected = sidecar(gate).artifact;
        const actual = header.source.sidecars[gate];
        if (actual.sha256 !== expected.sha256 || actual.sizeBytes !== expected.sizeBytes)
            throw new Error(`K11 ${gate.toUpperCase()} lineage changed`);
    }
    if (header.policy.k7ValuesConsumed || header.policy.productionModified || header.policy.publisherEnabled || header.policy.androidEnabled)
        throw new Error("K11 safety policy changed");
}
async function streamPinnedK11(path, accept) {
    const compressedHash = (0, crypto_1.createHash)("sha256");
    const source = (0, fs_1.createReadStream)(path);
    source.on("data", (chunk) => compressedHash.update(chunk));
    const stream = source.pipe((0, zlib_1.createGunzip)());
    const rawHash = (0, crypto_1.createHash)("sha256");
    const decoder = new string_decoder_1.StringDecoder("utf8");
    let rawSize = 0;
    let prefix = "";
    let header;
    let inArray = false;
    let closed = false;
    let tail = "";
    let depth = 0;
    let inString = false;
    let escaped = false;
    let parts = [];
    const marker = ',"fields":[';
    const consume = (text) => {
        let offset = 0;
        if (!inArray) {
            prefix += text;
            const index = prefix.indexOf(marker);
            if (index < 0) {
                if (prefix.length > 1000000)
                    throw new Error("K11 header exceeds parser limit");
                return;
            }
            header = JSON.parse(`${prefix.slice(0, index)}}`);
            text = prefix.slice(index + marker.length);
            prefix = "";
            inArray = true;
        }
        if (closed) {
            tail += text;
            return;
        }
        let objectStart = depth ? 0 : -1;
        for (let index = offset; index < text.length; index++) {
            const character = text[index];
            if (depth === 0) {
                if (character === "{") {
                    depth = 1;
                    objectStart = index;
                }
                else if (character === "]") {
                    closed = true;
                    tail += text.slice(index + 1);
                    return;
                }
                else if (character !== "," && !/\s/.test(character))
                    throw new Error("K11 fields array syntax changed");
                continue;
            }
            if (inString) {
                if (escaped)
                    escaped = false;
                else if (character === "\\")
                    escaped = true;
                else if (character === '"')
                    inString = false;
                continue;
            }
            if (character === '"')
                inString = true;
            else if (character === "{")
                depth++;
            else if (character === "}") {
                depth--;
                if (depth === 0) {
                    parts.push(text.slice(objectStart, index + 1));
                    accept(JSON.parse(parts.join("")));
                    parts = [];
                    objectStart = -1;
                }
            }
        }
        if (depth > 0 && objectStart >= 0)
            parts.push(text.slice(objectStart));
        if (parts.reduce((sum, value) => sum + value.length, 0) > 1000000)
            throw new Error("K11 field exceeds parser limit");
    };
    for await (const chunk of stream) {
        const bytes = chunk;
        rawHash.update(bytes);
        rawSize += bytes.length;
        consume(decoder.write(bytes));
    }
    consume(decoder.end());
    if (!header || !closed || depth !== 0 || tail !== "}\n")
        throw new Error("K11 projection framing changed");
    if (rawSize !== shadow_release_1.CHARACTER_SHADOW_PINNED_RELEASE.uncompressedSizeBytes || rawHash.digest("hex") !== shadow_release_1.CHARACTER_SHADOW_PINNED_RELEASE.uncompressedSha256)
        throw new Error("K11 raw identity changed");
    if (compressedHash.digest("hex") !== shadow_release_1.CHARACTER_SHADOW_PINNED_RELEASE.artifactSha256)
        throw new Error("K11 compressed bytes changed during validation");
    return { header };
}
//# sourceMappingURL=compact-source.js.map