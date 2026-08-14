import { createHash } from "crypto";
import { lstat, readFile } from "fs/promises";
import { resolve } from "path";
import { gunzipSync } from "zlib";
import { resolveCharacterInputFile } from "./artifact-path";
import { loadCharacterCompactGenerationSource } from "./compact-source";
import { CHARACTER_REFRESH_PROFILE, CharacterSidecarProfile } from "./refresh-contract";
import { CHARACTER_SHADOW_PINNED_RELEASE, manifestMatchesPinnedCharacterShadowRelease } from "./shadow-release";
import type { CharacterFieldProjection, CharacterShadowManifest } from "./shadow-contract";
import type { DatabaseCharacterTaxonomyDataset } from "./taxonomy-contract";
import {
    STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN,
    StructuralAuthorityLineage,
    StructuralAuthorityProductiveIndex,
} from "./structural-authority-contract";
import { indexProductiveCharacterRecords } from "./structural-authority-builder";

const K11_MANIFEST_FILE = "database-characters-k10-k14-manifest.json";
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

interface ProductiveManifest {
    schemaVersion: 1;
    datasetVersion: string;
    generatedAt: string;
    fileName: string;
    compression: "gzip";
    sha256: string;
    sizeBytes: number;
    uncompressedSizeBytes: number;
    characterCount: number;
}

export interface StructuralAuthoritySourceOptions {
    shadowRoot: string;
    k2Root: string;
    productiveRoot: string;
}

export interface StructuralAuthorityGenerationSource {
    generatedAt: string;
    taxonomy: DatabaseCharacterTaxonomyDataset;
    productiveIndex: StructuralAuthorityProductiveIndex;
    lineage: StructuralAuthorityLineage;
    streamFields(accept: (field: CharacterFieldProjection) => void): Promise<void>;
    revalidate(): Promise<void>;
}

function k2Profile(): CharacterSidecarProfile {
    const profile = CHARACTER_REFRESH_PROFILE.sidecars.find(item => item.gate === "k2");
    if (!profile) throw new Error("K2 profile missing");
    return profile;
}

async function regularRoot(root: string, label: string): Promise<string> {
    const path = resolve(root);
    const metadata = await lstat(path);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) throw new Error(`${label} root must be a regular non-link directory`);
    return path;
}

async function exactFile(root: string, fileName: string): Promise<string> {
    const path = await resolveCharacterInputFile(root, fileName, fileName);
    const metadata = await lstat(path);
    if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error(`${fileName} must be a regular non-link file`);
    return path;
}

function exact(bytes: Buffer, expected: { sha256: string; sizeBytes: number }, label: string): void {
    if (bytes.length !== expected.sizeBytes || hash(bytes) !== expected.sha256) throw new Error(`${label} identity changed`);
}

export function validateStructuralAuthorityProductiveManifest(manifest: ProductiveManifest): void {
    const pin = STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN;
    if (manifest?.schemaVersion !== 1 || manifest.datasetVersion !== pin.datasetVersion || manifest.generatedAt !== pin.datasetVersion
        || manifest.fileName !== pin.remoteFileName || manifest.compression !== "gzip" || manifest.sha256 !== pin.payloadSha256
        || manifest.sizeBytes !== pin.payloadSizeBytes || manifest.uncompressedSizeBytes !== pin.uncompressedSizeBytes
        || manifest.characterCount !== pin.characterCount) throw new Error("productive Character manifest lineage changed");
}

export function validateStructuralAuthorityK2Manifest(manifest: any, profile = k2Profile()): void {
    if (manifest?.schemaVersion !== 1 || manifest.contractVersion !== profile.contractVersion || manifest.generatedAt !== CHARACTER_REFRESH_PROFILE.generatedAt
        || manifest.fileName !== profile.artifact.fileName || manifest.compression !== "gzip" || manifest.sha256 !== profile.artifact.sha256
        || manifest.sizeBytes !== profile.artifact.sizeBytes || manifest.uncompressedSizeBytes !== profile.artifact.uncompressedSizeBytes
        || manifest.sourceSnapshotVersion !== CHARACTER_REFRESH_PROFILE.snapshotVersion
        || manifest.sourceDatabaseSha256 !== CHARACTER_REFRESH_PROFILE.sqlite.sha256 || manifest.sourceDb1ArtifactSha256 !== CHARACTER_REFRESH_PROFILE.db1.sha256
        || manifest.coverageFile !== profile.coverage.fileName || manifest.coverageSha256 !== profile.coverage.sha256
        || manifest.coverageSizeBytes !== profile.coverage.sizeBytes || manifest.validationFile !== profile.validation.fileName
        || manifest.validationSha256 !== profile.validation.sha256 || manifest.validationSizeBytes !== profile.validation.sizeBytes) {
        throw new Error("K2 manifest lineage changed");
    }
}

function validateTaxonomy(taxonomy: DatabaseCharacterTaxonomyDataset): void {
    if (taxonomy?.schemaVersion !== 1 || taxonomy.contract !== "dokkan-database-characters-taxonomy" || taxonomy.contractVersion !== "1.0.0"
        || taxonomy.generatedAt !== CHARACTER_REFRESH_PROFILE.generatedAt || taxonomy.source?.snapshotVersion !== CHARACTER_REFRESH_PROFILE.snapshotVersion
        || taxonomy.source.databaseSha256 !== CHARACTER_REFRESH_PROFILE.sqlite.sha256 || taxonomy.source.db1ArtifactSha256 !== CHARACTER_REFRESH_PROFILE.db1.sha256
        || taxonomy.localeAudit?.presentationTextAsIdentity !== false || taxonomy.localeAudit?.otherLocales !== "unknown"
        || taxonomy.cards?.length !== 5_759 || taxonomy.categories?.length !== 98 || taxonomy.links?.length !== 133) {
        throw new Error("K2 taxonomy contract changed");
    }
}

async function preflight(options: StructuralAuthoritySourceOptions) {
    const [shadowRoot, k2Root, productiveRoot] = await Promise.all([
        regularRoot(options.shadowRoot, "K11"), regularRoot(options.k2Root, "K2"), regularRoot(options.productiveRoot, "productive Character"),
    ]);
    const profile = k2Profile();
    const [k11ManifestPath, k2ManifestPath, productiveManifestPath] = await Promise.all([
        exactFile(shadowRoot, K11_MANIFEST_FILE), exactFile(k2Root, profile.manifest.fileName), exactFile(productiveRoot, STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.manifestFile),
    ]);
    const [k11ManifestBytes, k2ManifestBytes, productiveManifestBytes] = await Promise.all([
        readFile(k11ManifestPath), readFile(k2ManifestPath), readFile(productiveManifestPath),
    ]);
    exact(k11ManifestBytes, { sha256: CHARACTER_SHADOW_PINNED_RELEASE.manifestSha256, sizeBytes: CHARACTER_SHADOW_PINNED_RELEASE.manifestSizeBytes }, "K10-K14 manifest");
    exact(k2ManifestBytes, profile.manifest, "K2 manifest");
    exact(productiveManifestBytes, { sha256: STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.manifestSha256, sizeBytes: STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.manifestSizeBytes }, "productive Character manifest");
    const k11Manifest = JSON.parse(k11ManifestBytes.toString("utf8")) as CharacterShadowManifest;
    const k2Manifest = JSON.parse(k2ManifestBytes.toString("utf8"));
    const productiveManifest = JSON.parse(productiveManifestBytes.toString("utf8")) as ProductiveManifest;
    if (!manifestMatchesPinnedCharacterShadowRelease(k11Manifest)) throw new Error("K10-K14 manifest is not the pinned release");
    validateStructuralAuthorityK2Manifest(k2Manifest, profile);
    validateStructuralAuthorityProductiveManifest(productiveManifest);
    return { shadowRoot, k2Root, productiveRoot, profile, k11ManifestPath, k2ManifestPath, productiveManifestPath, k11ManifestBytes, k2ManifestBytes, productiveManifestBytes, productiveManifest };
}

export async function loadStructuralAuthorityGenerationSource(options: StructuralAuthoritySourceOptions): Promise<StructuralAuthorityGenerationSource> {
    const checked = await preflight(options);
    const [k2ArtifactPath, k2CoveragePath, k2ValidationPath, productivePayloadPath] = await Promise.all([
        exactFile(checked.k2Root, checked.profile.artifact.fileName), exactFile(checked.k2Root, checked.profile.coverage.fileName),
        exactFile(checked.k2Root, checked.profile.validation.fileName), exactFile(checked.productiveRoot, STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.payloadFile),
    ]);
    const [k2ArtifactBytes, k2CoverageBytes, k2ValidationBytes, productivePayloadBytes] = await Promise.all([
        readFile(k2ArtifactPath), readFile(k2CoveragePath), readFile(k2ValidationPath), readFile(productivePayloadPath),
    ]);
    exact(k2ArtifactBytes, checked.profile.artifact, "K2 artifact");
    exact(k2CoverageBytes, checked.profile.coverage, "K2 coverage");
    exact(k2ValidationBytes, checked.profile.validation, "K2 validation");
    exact(productivePayloadBytes, { sha256: STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.payloadSha256, sizeBytes: STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.payloadSizeBytes }, "productive Character payload");
    const validation = JSON.parse(k2ValidationBytes.toString("utf8"));
    if (validation?.valid !== true || !Array.isArray(validation.failures) || validation.failures.length) throw new Error("K2 validation is not successful");

    const k2Raw = gunzipSync(k2ArtifactBytes);
    if (k2Raw.length !== checked.profile.artifact.uncompressedSizeBytes) throw new Error("K2 raw size changed");
    const taxonomy = JSON.parse(k2Raw.toString("utf8")) as DatabaseCharacterTaxonomyDataset;
    validateTaxonomy(taxonomy);
    const productiveRaw = gunzipSync(productivePayloadBytes);
    if (productiveRaw.length !== STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.uncompressedSizeBytes) throw new Error("productive Character raw size changed");
    const productiveCharacters = JSON.parse(productiveRaw.toString("utf8"));
    if (!Array.isArray(productiveCharacters) || productiveCharacters.length !== STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.characterCount) throw new Error("productive Character cardinality changed");
    const productiveIndex = indexProductiveCharacterRecords(productiveCharacters);

    const k11 = await loadCharacterCompactGenerationSource(checked.shadowRoot);
    if (k11.lineage.k2.sha256 !== checked.profile.artifact.sha256 || k11.lineage.k2.sizeBytes !== checked.profile.artifact.sizeBytes
        || k11.lineage.snapshotVersion !== taxonomy.source.snapshotVersion) throw new Error("K11 and K2 lineage do not match");
    const lineage: StructuralAuthorityLineage = {
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
            manifestSha256: CHARACTER_SHADOW_PINNED_RELEASE.manifestSha256,
            manifestSizeBytes: CHARACTER_SHADOW_PINNED_RELEASE.manifestSizeBytes,
            sha256: k11.lineage.k11.sha256,
            sizeBytes: k11.lineage.k11.sizeBytes,
            uncompressedSha256: k11.lineage.k11.uncompressedSha256,
            uncompressedSizeBytes: k11.lineage.k11.uncompressedSizeBytes,
        },
        productiveCharacters: {
            contract: "Character[]",
            datasetVersion: checked.productiveManifest.datasetVersion,
            manifestFile: "characters-manifest.json",
            manifestSha256: STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.manifestSha256,
            manifestSizeBytes: STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.manifestSizeBytes,
            payloadFile: "characters.json.gz",
            payloadSha256: STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.payloadSha256,
            payloadSizeBytes: STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.payloadSizeBytes,
            uncompressedSizeBytes: STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.uncompressedSizeBytes,
            topLevelCount: STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.characterCount,
        },
    };

    const revalidate = async (): Promise<void> => {
        const [k11ManifestAfter, k2ManifestAfter, k2ArtifactAfter, k2CoverageAfter, k2ValidationAfter, productiveManifestAfter, productivePayloadAfter] = await Promise.all([
            readFile(checked.k11ManifestPath), readFile(checked.k2ManifestPath), readFile(k2ArtifactPath), readFile(k2CoveragePath),
            readFile(k2ValidationPath), readFile(checked.productiveManifestPath), readFile(productivePayloadPath),
        ]);
        if (!k11ManifestAfter.equals(checked.k11ManifestBytes) || !k2ManifestAfter.equals(checked.k2ManifestBytes)
            || !productiveManifestAfter.equals(checked.productiveManifestBytes)) throw new Error("structural authority manifest changed during audit");
        exact(k2ArtifactAfter, checked.profile.artifact, "K2 artifact revalidation");
        exact(k2CoverageAfter, checked.profile.coverage, "K2 coverage revalidation");
        exact(k2ValidationAfter, checked.profile.validation, "K2 validation revalidation");
        exact(productivePayloadAfter, { sha256: STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.payloadSha256, sizeBytes: STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.payloadSizeBytes }, "productive Character payload revalidation");
    };
    return { generatedAt: checked.productiveManifest.generatedAt, taxonomy, productiveIndex, lineage, streamFields: k11.streamFields, revalidate };
}
