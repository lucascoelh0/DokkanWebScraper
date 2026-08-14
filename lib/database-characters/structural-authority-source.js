"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadStructuralAuthorityGenerationSource = exports.validateStructuralAuthorityK2Manifest = exports.validateStructuralAuthorityProductiveManifest = void 0;
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const zlib_1 = require("zlib");
const artifact_path_1 = require("./artifact-path");
const compact_source_1 = require("./compact-source");
const refresh_contract_1 = require("./refresh-contract");
const shadow_release_1 = require("./shadow-release");
const structural_authority_contract_1 = require("./structural-authority-contract");
const structural_authority_builder_1 = require("./structural-authority-builder");
const K11_MANIFEST_FILE = "database-characters-k10-k14-manifest.json";
const hash = (bytes) => (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
function k2Profile() {
    const profile = refresh_contract_1.CHARACTER_REFRESH_PROFILE.sidecars.find(item => item.gate === "k2");
    if (!profile)
        throw new Error("K2 profile missing");
    return profile;
}
async function regularRoot(root, label) {
    const path = (0, path_1.resolve)(root);
    const metadata = await (0, promises_1.lstat)(path);
    if (!metadata.isDirectory() || metadata.isSymbolicLink())
        throw new Error(`${label} root must be a regular non-link directory`);
    return path;
}
async function exactFile(root, fileName) {
    const path = await (0, artifact_path_1.resolveCharacterInputFile)(root, fileName, fileName);
    const metadata = await (0, promises_1.lstat)(path);
    if (!metadata.isFile() || metadata.isSymbolicLink())
        throw new Error(`${fileName} must be a regular non-link file`);
    return path;
}
function exact(bytes, expected, label) {
    if (bytes.length !== expected.sizeBytes || hash(bytes) !== expected.sha256)
        throw new Error(`${label} identity changed`);
}
function validateStructuralAuthorityProductiveManifest(manifest) {
    const pin = structural_authority_contract_1.STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN;
    if (manifest?.schemaVersion !== 1 || manifest.datasetVersion !== pin.datasetVersion || manifest.generatedAt !== pin.datasetVersion
        || manifest.fileName !== pin.remoteFileName || manifest.compression !== "gzip" || manifest.sha256 !== pin.payloadSha256
        || manifest.sizeBytes !== pin.payloadSizeBytes || manifest.uncompressedSizeBytes !== pin.uncompressedSizeBytes
        || manifest.characterCount !== pin.characterCount)
        throw new Error("productive Character manifest lineage changed");
}
exports.validateStructuralAuthorityProductiveManifest = validateStructuralAuthorityProductiveManifest;
function validateStructuralAuthorityK2Manifest(manifest, profile = k2Profile()) {
    if (manifest?.schemaVersion !== 1 || manifest.contractVersion !== profile.contractVersion || manifest.generatedAt !== refresh_contract_1.CHARACTER_REFRESH_PROFILE.generatedAt
        || manifest.fileName !== profile.artifact.fileName || manifest.compression !== "gzip" || manifest.sha256 !== profile.artifact.sha256
        || manifest.sizeBytes !== profile.artifact.sizeBytes || manifest.uncompressedSizeBytes !== profile.artifact.uncompressedSizeBytes
        || manifest.sourceSnapshotVersion !== refresh_contract_1.CHARACTER_REFRESH_PROFILE.snapshotVersion
        || manifest.sourceDatabaseSha256 !== refresh_contract_1.CHARACTER_REFRESH_PROFILE.sqlite.sha256 || manifest.sourceDb1ArtifactSha256 !== refresh_contract_1.CHARACTER_REFRESH_PROFILE.db1.sha256
        || manifest.coverageFile !== profile.coverage.fileName || manifest.coverageSha256 !== profile.coverage.sha256
        || manifest.coverageSizeBytes !== profile.coverage.sizeBytes || manifest.validationFile !== profile.validation.fileName
        || manifest.validationSha256 !== profile.validation.sha256 || manifest.validationSizeBytes !== profile.validation.sizeBytes) {
        throw new Error("K2 manifest lineage changed");
    }
}
exports.validateStructuralAuthorityK2Manifest = validateStructuralAuthorityK2Manifest;
function validateTaxonomy(taxonomy) {
    if (taxonomy?.schemaVersion !== 1 || taxonomy.contract !== "dokkan-database-characters-taxonomy" || taxonomy.contractVersion !== "1.0.0"
        || taxonomy.generatedAt !== refresh_contract_1.CHARACTER_REFRESH_PROFILE.generatedAt || taxonomy.source?.snapshotVersion !== refresh_contract_1.CHARACTER_REFRESH_PROFILE.snapshotVersion
        || taxonomy.source.databaseSha256 !== refresh_contract_1.CHARACTER_REFRESH_PROFILE.sqlite.sha256 || taxonomy.source.db1ArtifactSha256 !== refresh_contract_1.CHARACTER_REFRESH_PROFILE.db1.sha256
        || taxonomy.localeAudit?.presentationTextAsIdentity !== false || taxonomy.localeAudit?.otherLocales !== "unknown"
        || taxonomy.cards?.length !== 5759 || taxonomy.categories?.length !== 98 || taxonomy.links?.length !== 133) {
        throw new Error("K2 taxonomy contract changed");
    }
}
async function preflight(options) {
    const [shadowRoot, k2Root, productiveRoot] = await Promise.all([
        regularRoot(options.shadowRoot, "K11"), regularRoot(options.k2Root, "K2"), regularRoot(options.productiveRoot, "productive Character"),
    ]);
    const profile = k2Profile();
    const [k11ManifestPath, k2ManifestPath, productiveManifestPath] = await Promise.all([
        exactFile(shadowRoot, K11_MANIFEST_FILE), exactFile(k2Root, profile.manifest.fileName), exactFile(productiveRoot, structural_authority_contract_1.STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.manifestFile),
    ]);
    const [k11ManifestBytes, k2ManifestBytes, productiveManifestBytes] = await Promise.all([
        (0, promises_1.readFile)(k11ManifestPath), (0, promises_1.readFile)(k2ManifestPath), (0, promises_1.readFile)(productiveManifestPath),
    ]);
    exact(k11ManifestBytes, { sha256: shadow_release_1.CHARACTER_SHADOW_PINNED_RELEASE.manifestSha256, sizeBytes: shadow_release_1.CHARACTER_SHADOW_PINNED_RELEASE.manifestSizeBytes }, "K10-K14 manifest");
    exact(k2ManifestBytes, profile.manifest, "K2 manifest");
    exact(productiveManifestBytes, { sha256: structural_authority_contract_1.STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.manifestSha256, sizeBytes: structural_authority_contract_1.STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.manifestSizeBytes }, "productive Character manifest");
    const k11Manifest = JSON.parse(k11ManifestBytes.toString("utf8"));
    const k2Manifest = JSON.parse(k2ManifestBytes.toString("utf8"));
    const productiveManifest = JSON.parse(productiveManifestBytes.toString("utf8"));
    if (!(0, shadow_release_1.manifestMatchesPinnedCharacterShadowRelease)(k11Manifest))
        throw new Error("K10-K14 manifest is not the pinned release");
    validateStructuralAuthorityK2Manifest(k2Manifest, profile);
    validateStructuralAuthorityProductiveManifest(productiveManifest);
    return { shadowRoot, k2Root, productiveRoot, profile, k11ManifestPath, k2ManifestPath, productiveManifestPath, k11ManifestBytes, k2ManifestBytes, productiveManifestBytes, productiveManifest };
}
async function loadStructuralAuthorityGenerationSource(options) {
    const checked = await preflight(options);
    const [k2ArtifactPath, k2CoveragePath, k2ValidationPath, productivePayloadPath] = await Promise.all([
        exactFile(checked.k2Root, checked.profile.artifact.fileName), exactFile(checked.k2Root, checked.profile.coverage.fileName),
        exactFile(checked.k2Root, checked.profile.validation.fileName), exactFile(checked.productiveRoot, structural_authority_contract_1.STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.payloadFile),
    ]);
    const [k2ArtifactBytes, k2CoverageBytes, k2ValidationBytes, productivePayloadBytes] = await Promise.all([
        (0, promises_1.readFile)(k2ArtifactPath), (0, promises_1.readFile)(k2CoveragePath), (0, promises_1.readFile)(k2ValidationPath), (0, promises_1.readFile)(productivePayloadPath),
    ]);
    exact(k2ArtifactBytes, checked.profile.artifact, "K2 artifact");
    exact(k2CoverageBytes, checked.profile.coverage, "K2 coverage");
    exact(k2ValidationBytes, checked.profile.validation, "K2 validation");
    exact(productivePayloadBytes, { sha256: structural_authority_contract_1.STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.payloadSha256, sizeBytes: structural_authority_contract_1.STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.payloadSizeBytes }, "productive Character payload");
    const validation = JSON.parse(k2ValidationBytes.toString("utf8"));
    if (validation?.valid !== true || !Array.isArray(validation.failures) || validation.failures.length)
        throw new Error("K2 validation is not successful");
    const k2Raw = (0, zlib_1.gunzipSync)(k2ArtifactBytes);
    if (k2Raw.length !== checked.profile.artifact.uncompressedSizeBytes)
        throw new Error("K2 raw size changed");
    const taxonomy = JSON.parse(k2Raw.toString("utf8"));
    validateTaxonomy(taxonomy);
    const productiveRaw = (0, zlib_1.gunzipSync)(productivePayloadBytes);
    if (productiveRaw.length !== structural_authority_contract_1.STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.uncompressedSizeBytes)
        throw new Error("productive Character raw size changed");
    const productiveCharacters = JSON.parse(productiveRaw.toString("utf8"));
    if (!Array.isArray(productiveCharacters) || productiveCharacters.length !== structural_authority_contract_1.STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.characterCount)
        throw new Error("productive Character cardinality changed");
    const productiveIndex = (0, structural_authority_builder_1.indexProductiveCharacterRecords)(productiveCharacters);
    const k11 = await (0, compact_source_1.loadCharacterCompactGenerationSource)(checked.shadowRoot);
    if (k11.lineage.k2.sha256 !== checked.profile.artifact.sha256 || k11.lineage.k2.sizeBytes !== checked.profile.artifact.sizeBytes
        || k11.lineage.snapshotVersion !== taxonomy.source.snapshotVersion)
        throw new Error("K11 and K2 lineage do not match");
    const lineage = {
        profileId: k11.lineage.profileId,
        snapshotVersion: k11.lineage.snapshotVersion,
        k0: { ...k11.lineage.k0 },
        k2: {
            contractVersion: checked.profile.contractVersion,
            manifestSha256: checked.profile.manifest.sha256,
            manifestSizeBytes: checked.profile.manifest.sizeBytes,
            sha256: checked.profile.artifact.sha256,
            sizeBytes: checked.profile.artifact.sizeBytes,
            uncompressedSizeBytes: checked.profile.artifact.uncompressedSizeBytes,
        },
        k11: {
            contractVersion: k11.lineage.k11.contractVersion,
            manifestSha256: shadow_release_1.CHARACTER_SHADOW_PINNED_RELEASE.manifestSha256,
            manifestSizeBytes: shadow_release_1.CHARACTER_SHADOW_PINNED_RELEASE.manifestSizeBytes,
            sha256: k11.lineage.k11.sha256,
            sizeBytes: k11.lineage.k11.sizeBytes,
            uncompressedSha256: k11.lineage.k11.uncompressedSha256,
            uncompressedSizeBytes: k11.lineage.k11.uncompressedSizeBytes,
        },
        productiveCharacters: {
            contract: "Character[]",
            datasetVersion: checked.productiveManifest.datasetVersion,
            manifestFile: "characters-manifest.json",
            manifestSha256: structural_authority_contract_1.STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.manifestSha256,
            manifestSizeBytes: structural_authority_contract_1.STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.manifestSizeBytes,
            payloadFile: "characters.json.gz",
            payloadSha256: structural_authority_contract_1.STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.payloadSha256,
            payloadSizeBytes: structural_authority_contract_1.STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.payloadSizeBytes,
            uncompressedSizeBytes: structural_authority_contract_1.STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.uncompressedSizeBytes,
            topLevelCount: structural_authority_contract_1.STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.characterCount,
        },
    };
    const revalidate = async () => {
        const [k11ManifestAfter, k2ManifestAfter, k2ArtifactAfter, k2CoverageAfter, k2ValidationAfter, productiveManifestAfter, productivePayloadAfter] = await Promise.all([
            (0, promises_1.readFile)(checked.k11ManifestPath), (0, promises_1.readFile)(checked.k2ManifestPath), (0, promises_1.readFile)(k2ArtifactPath), (0, promises_1.readFile)(k2CoveragePath),
            (0, promises_1.readFile)(k2ValidationPath), (0, promises_1.readFile)(checked.productiveManifestPath), (0, promises_1.readFile)(productivePayloadPath),
        ]);
        if (!k11ManifestAfter.equals(checked.k11ManifestBytes) || !k2ManifestAfter.equals(checked.k2ManifestBytes)
            || !productiveManifestAfter.equals(checked.productiveManifestBytes))
            throw new Error("structural authority manifest changed during audit");
        exact(k2ArtifactAfter, checked.profile.artifact, "K2 artifact revalidation");
        exact(k2CoverageAfter, checked.profile.coverage, "K2 coverage revalidation");
        exact(k2ValidationAfter, checked.profile.validation, "K2 validation revalidation");
        exact(productivePayloadAfter, { sha256: structural_authority_contract_1.STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.payloadSha256, sizeBytes: structural_authority_contract_1.STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.payloadSizeBytes }, "productive Character payload revalidation");
    };
    return { generatedAt: checked.productiveManifest.generatedAt, taxonomy, productiveIndex, lineage, streamFields: k11.streamFields, revalidate };
}
exports.loadStructuralAuthorityGenerationSource = loadStructuralAuthorityGenerationSource;
//# sourceMappingURL=structural-authority-source.js.map