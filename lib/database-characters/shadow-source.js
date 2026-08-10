"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHARACTER_SHADOW_REQUIRED_GATES = exports.loadCharacterShadowInputs = void 0;
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const zlib_1 = require("zlib");
const artifact_path_1 = require("./artifact-path");
const refresh_contract_1 = require("./refresh-contract");
const hash = (bytes) => (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
function compactCharacters(input) {
    const result = new Map();
    const visit = (value) => {
        if (!value || value.id === undefined || value.id === null)
            return;
        const transformations = Array.isArray(value.transformations) ? value.transformations : [];
        const awakenings = Array.isArray(value.awakeningCards) ? value.awakeningCards : [];
        const id = String(value.id);
        const compact = {
            id,
            name: value.name ?? null,
            title: value.title ?? null,
            rarity: value.rarity ?? null,
            type: value.type ?? null,
            characterClass: value.characterClass ?? null,
            categories: Array.isArray(value.categories) ? value.categories : null,
            links: Array.isArray(value.links) ? value.links : null,
            transformationIds: transformations.flatMap((item) => item?.id === undefined ? [] : [String(item.id)]),
            awakeningCardIds: awakenings.flatMap((item) => item?.id === undefined ? [] : [String(item.id)]),
        };
        // Legacy Character[] can repeat a top-level card as nested presentation. The
        // first traversal occurrence is the product record; K7 is used only to prove
        // that the structural ID joins, never to select values from either duplicate.
        if (!result.has(id))
            result.set(id, compact);
        transformations.forEach(visit);
    };
    input.forEach(visit);
    return result;
}
async function loadSidecar(root, gate) {
    const profile = refresh_contract_1.CHARACTER_REFRESH_PROFILE.sidecars.find(item => item.gate === gate);
    if (!profile)
        throw new Error(`${gate.toUpperCase()} profile is missing`);
    const directory = await (0, artifact_path_1.resolveCharacterInputDirectory)((0, path_1.resolve)(root), gate, gate);
    const [manifestPath, artifactPath, coveragePath, validationPath] = await Promise.all([
        (0, artifact_path_1.resolveCharacterInputFile)(directory, profile.manifest.fileName, profile.manifest.fileName),
        (0, artifact_path_1.resolveCharacterInputFile)(directory, profile.artifact.fileName, profile.artifact.fileName),
        (0, artifact_path_1.resolveCharacterInputFile)(directory, profile.coverage.fileName, profile.coverage.fileName),
        (0, artifact_path_1.resolveCharacterInputFile)(directory, profile.validation.fileName, profile.validation.fileName),
    ]);
    const [manifestBytes, artifactBytes, coverageBytes, validationBytes] = await Promise.all([
        (0, promises_1.readFile)(manifestPath), (0, promises_1.readFile)(artifactPath), (0, promises_1.readFile)(coveragePath), (0, promises_1.readFile)(validationPath),
    ]);
    const exact = (bytes, expected, label) => {
        if (bytes.length !== expected.sizeBytes || hash(bytes) !== expected.sha256)
            throw new Error(`${gate.toUpperCase()} ${label} identity changed`);
    };
    exact(manifestBytes, profile.manifest, "manifest");
    exact(artifactBytes, profile.artifact, "artifact");
    exact(coverageBytes, profile.coverage, "coverage");
    exact(validationBytes, profile.validation, "validation");
    const manifest = JSON.parse(manifestBytes.toString("utf8"));
    const validation = JSON.parse(validationBytes.toString("utf8"));
    if (manifest.schemaVersion !== 1 || manifest.contractVersion !== profile.contractVersion || manifest.fileName !== profile.artifact.fileName
        || manifest.sha256 !== profile.artifact.sha256 || manifest.sizeBytes !== profile.artifact.sizeBytes
        || manifest.uncompressedSizeBytes !== profile.artifact.uncompressedSizeBytes || manifest.coverageFile !== profile.coverage.fileName
        || manifest.coverageSha256 !== profile.coverage.sha256 || manifest.validationFile !== profile.validation.fileName
        || manifest.validationSha256 !== profile.validation.sha256 || (gate !== "k7" && manifest.sourceSnapshotVersion !== refresh_contract_1.CHARACTER_REFRESH_PROFILE.snapshotVersion)
        || manifest.sourceDb1ArtifactSha256 !== refresh_contract_1.CHARACTER_REFRESH_PROFILE.db1.sha256
        || validation.valid !== true || !Array.isArray(validation.failures) || validation.failures.length !== 0)
        throw new Error(`${gate.toUpperCase()} manifest contract changed`);
    const raw = (0, zlib_1.gunzipSync)(artifactBytes);
    if (raw.length !== profile.artifact.uncompressedSizeBytes)
        throw new Error(`${gate.toUpperCase()} raw size changed`);
    const dataset = JSON.parse(raw.toString("utf8"));
    if (dataset.schemaVersion !== 1 || dataset.contractVersion !== profile.contractVersion || dataset.source?.snapshotVersion !== refresh_contract_1.CHARACTER_REFRESH_PROFILE.snapshotVersion)
        throw new Error(`${gate.toUpperCase()} dataset contract changed`);
    return { dataset, identity: { sha256: profile.artifact.sha256, sizeBytes: profile.artifact.sizeBytes } };
}
async function loadProduction(root, k7) {
    const path = await (0, artifact_path_1.resolveCharacterInputFile)((0, path_1.resolve)(root), "characters.json", "characters.json");
    const bytes = await (0, promises_1.readFile)(path);
    const expected = k7.source.productionCharacters;
    if (bytes.length !== expected.sizeBytes || hash(bytes) !== expected.sha256)
        throw new Error("production Character[] identity changed from K7 binding evidence");
    const parsed = JSON.parse(bytes.toString("utf8"));
    if (!Array.isArray(parsed) || parsed.length !== expected.characterCount)
        throw new Error("production Character[] cardinality changed");
    return { characters: compactCharacters(parsed), sha256: expected.sha256, sizeBytes: bytes.length, topLevelCount: parsed.length };
}
async function loadFyi(root, k7) {
    const [manifestPath, artifactPath] = await Promise.all([
        (0, artifact_path_1.resolveCharacterInputFile)((0, path_1.resolve)(root), "characters-manifest.json", "characters-manifest.json"),
        (0, artifact_path_1.resolveCharacterInputFile)((0, path_1.resolve)(root), "characters.json.gz", "characters.json.gz"),
    ]);
    const [manifestBytes, artifactBytes] = await Promise.all([(0, promises_1.readFile)(manifestPath), (0, promises_1.readFile)(artifactPath)]);
    const manifest = JSON.parse(manifestBytes.toString("utf8"));
    const expected = k7.source.fyiCharacters;
    if (manifest.schemaVersion !== 1 || manifest.compression !== "gzip" || manifest.fileName !== "characters.json.gz"
        || manifest.sha256 !== expected.sha256 || manifest.sizeBytes !== expected.sizeBytes || manifest.characterCount !== expected.characterCount
        || manifest.generatedAt !== expected.generatedAt || artifactBytes.length !== manifest.sizeBytes || hash(artifactBytes) !== manifest.sha256)
        throw new Error("FYI Character[] manifest changed from K7 binding evidence");
    const raw = (0, zlib_1.gunzipSync)(artifactBytes);
    if (raw.length !== manifest.uncompressedSizeBytes)
        throw new Error("FYI Character[] raw size changed");
    const parsed = JSON.parse(raw.toString("utf8"));
    if (!Array.isArray(parsed) || parsed.length !== manifest.characterCount)
        throw new Error("FYI Character[] cardinality changed");
    return { characters: compactCharacters(parsed), sha256: manifest.sha256, sizeBytes: artifactBytes.length, topLevelCount: parsed.length, generatedAt: manifest.generatedAt };
}
async function loadCharacterShadowInputs(options) {
    const [k0, k1, k2, k7] = await Promise.all([
        loadSidecar(options.sidecarRoot, "k0"),
        loadSidecar(options.sidecarRoot, "k1"),
        loadSidecar(options.sidecarRoot, "k2"),
        loadSidecar(options.sidecarRoot, "k7"),
    ]);
    if (k7.dataset.source.upstreamSidecars.k1.artifactSha256 !== k1.identity.sha256 || k7.dataset.source.upstreamSidecars.k2.artifactSha256 !== k2.identity.sha256)
        throw new Error("K7 binding evidence does not reference the pinned K1/K2 inputs");
    const [production, fyi] = await Promise.all([loadProduction(options.productionRoot, k7.dataset), loadFyi(options.fyiRoot, k7.dataset)]);
    return {
        k0: k0.dataset,
        k1: k1.dataset,
        k2: k2.dataset,
        k7: k7.dataset,
        sidecarIdentities: { k0: k0.identity, k1: k1.identity, k2: k2.identity, k7: k7.identity },
        production,
        fyi,
    };
}
exports.loadCharacterShadowInputs = loadCharacterShadowInputs;
exports.CHARACTER_SHADOW_REQUIRED_GATES = ["k0", "k1", "k2", "k7"];
//# sourceMappingURL=shadow-source.js.map