import { constants, Stats } from "fs";
import { createHash } from "crypto";
import { lstat, open, realpath } from "fs/promises";
import { join, resolve } from "path";
import { gunzipSync } from "zlib";
import { resolveCharacterInputFile } from "./artifact-path";
import type { DatabaseCharacterTaxonomyDataset } from "./taxonomy-contract";
import {
    CHARACTER_STRUCTURAL_SIDECAR_SOURCE_PIN,
    CharacterStructuralProductiveCoverage,
    CharacterStructuralSidecarLineage,
} from "./structural-sidecar-contract";

interface K2Manifest {
    schemaVersion: 1;
    contractVersion: string;
    generatedAt: string;
    fileName: string;
    compression: "gzip";
    sha256: string;
    sizeBytes: number;
    uncompressedSizeBytes: number;
    sourceSnapshotVersion: string;
    sourceDatabaseSha256: string;
    sourceDb1ArtifactSha256: string;
    coverageFile: string;
    coverageSha256: string;
    coverageSizeBytes: number;
    validationFile: string;
    validationSha256: string;
    validationSizeBytes: number;
}

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

interface FileSnapshot {
    path: string;
    bytes: Buffer;
    metadata: Stats;
}

export interface CharacterStructuralSidecarSourceOptions {
    k2Root: string;
    productiveRoot: string;
}

export interface CharacterStructuralSidecarGenerationSource {
    taxonomy: DatabaseCharacterTaxonomyDataset;
    productive: CharacterStructuralProductiveCoverage;
    lineage: CharacterStructuralSidecarLineage;
    revalidate(): Promise<void>;
}

const hash = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");
const samePath = (left: string, right: string): boolean => process.platform === "win32"
    ? resolve(left).toLowerCase() === resolve(right).toLowerCase()
    : resolve(left) === resolve(right);
const sameFile = (left: Stats, right: Stats): boolean => left.dev === right.dev && left.ino === right.ino;

async function regularRoot(value: string, label: string): Promise<string> {
    const path = resolve(value);
    const metadata = await lstat(path);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) throw new Error(`K32 ${label} root must be a regular non-link directory`);
    const canonical = await realpath(path);
    if (!samePath(path, canonical)) throw new Error(`K32 ${label} root symlink or junction rejected`);
    return canonical;
}

async function readInputSnapshot(root: string, fileName: string): Promise<FileSnapshot> {
    const path = await resolveCharacterInputFile(root, fileName, fileName);
    const directPath = join(root, fileName);
    if (!samePath(path, directPath)) throw new Error(`K32 ${fileName} symlink or junction rejected`);
    const before = await lstat(directPath);
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1) throw new Error(`K32 ${fileName} must be a single-link regular file`);
    const handle = await open(directPath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try {
        const opened = await handle.stat();
        if (!opened.isFile() || opened.nlink !== 1 || !sameFile(before, opened)) throw new Error(`K32 ${fileName} identity changed while opening`);
        const bytes = await handle.readFile();
        const after = await handle.stat();
        const afterPath = await lstat(directPath);
        if (!sameFile(opened, after) || !sameFile(opened, afterPath) || after.size !== bytes.length || afterPath.size !== bytes.length
            || after.mtimeMs !== opened.mtimeMs || after.ctimeMs !== opened.ctimeMs) throw new Error(`K32 ${fileName} changed while reading`);
        return { path: directPath, bytes, metadata: after };
    } finally {
        await handle.close();
    }
}

function exact(snapshot: FileSnapshot, expected: { sha256: string; sizeBytes: number }, label: string): void {
    if (snapshot.bytes.length !== expected.sizeBytes || hash(snapshot.bytes) !== expected.sha256) throw new Error(`K32 ${label} identity changed`);
}

function unchanged(before: FileSnapshot, after: FileSnapshot, label: string): void {
    if (!samePath(before.path, after.path) || !sameFile(before.metadata, after.metadata) || !before.bytes.equals(after.bytes)) {
        throw new Error(`K32 ${label} changed during generation`);
    }
}

export function validateCharacterStructuralK2Manifest(manifest: K2Manifest): void {
    const pin = CHARACTER_STRUCTURAL_SIDECAR_SOURCE_PIN.k2;
    if (manifest?.schemaVersion !== 1 || manifest.contractVersion !== pin.contractVersion || manifest.generatedAt !== pin.generatedAt
        || manifest.fileName !== pin.payloadFile || manifest.compression !== "gzip" || manifest.sha256 !== pin.payloadSha256
        || manifest.sizeBytes !== pin.payloadSizeBytes || manifest.uncompressedSizeBytes !== pin.uncompressedSizeBytes
        || manifest.sourceSnapshotVersion !== CHARACTER_STRUCTURAL_SIDECAR_SOURCE_PIN.snapshotVersion
        || manifest.sourceDatabaseSha256 !== pin.databaseSha256 || manifest.sourceDb1ArtifactSha256 !== pin.db1ArtifactSha256
        || manifest.coverageFile !== pin.coverageFile || manifest.coverageSha256 !== pin.coverageSha256
        || manifest.coverageSizeBytes !== pin.coverageSizeBytes || manifest.validationFile !== pin.validationFile
        || manifest.validationSha256 !== pin.validationSha256 || manifest.validationSizeBytes !== pin.validationSizeBytes) {
        throw new Error("K32 K2 manifest lineage changed");
    }
}

export function validateCharacterStructuralProductiveManifest(manifest: ProductiveManifest): void {
    const pin = CHARACTER_STRUCTURAL_SIDECAR_SOURCE_PIN.productiveCharacters;
    if (manifest?.schemaVersion !== 1 || manifest.datasetVersion !== pin.datasetVersion || manifest.generatedAt !== pin.datasetVersion
        || manifest.fileName !== pin.manifestPayloadFile || manifest.compression !== "gzip" || manifest.sha256 !== pin.payloadSha256
        || manifest.sizeBytes !== pin.payloadSizeBytes || manifest.uncompressedSizeBytes !== pin.uncompressedSizeBytes
        || manifest.characterCount !== pin.topLevelCount) throw new Error("K32 productive Character manifest lineage changed");
}

export function validateCharacterStructuralTaxonomy(taxonomy: DatabaseCharacterTaxonomyDataset): void {
    const pin = CHARACTER_STRUCTURAL_SIDECAR_SOURCE_PIN;
    if (taxonomy?.schemaVersion !== 1 || taxonomy.contract !== "dokkan-database-characters-taxonomy" || taxonomy.contractVersion !== "1.0.0"
        || taxonomy.generatedAt !== pin.k2.generatedAt || taxonomy.source?.snapshotVersion !== pin.snapshotVersion
        || taxonomy.source.databaseSha256 !== pin.k2.databaseSha256 || taxonomy.source.db1ArtifactSha256 !== pin.k2.db1ArtifactSha256
        || taxonomy.localeAudit?.presentationTextAsIdentity !== false || taxonomy.localeAudit?.otherLocales !== "unknown"
        || !Array.isArray(taxonomy.cards) || taxonomy.cards.length !== pin.k2.cardCount
        || !Array.isArray(taxonomy.categories) || taxonomy.categories.length !== pin.k2.categoryCount
        || !Array.isArray(taxonomy.links) || taxonomy.links.length !== pin.k2.linkCount) throw new Error("K32 K2 taxonomy lineage or cardinality changed");
    if (taxonomy.cards.some(card => typeof card.cardId !== "string" || !/^\d+$/.test(card.cardId))) throw new Error("K32 K2 cardId contract changed");
}

export function indexProductiveCardIds(characters: unknown[]): CharacterStructuralProductiveCoverage {
    if (!Array.isArray(characters)) throw new Error("K32 productive Character payload must be an array");
    const cardIds = new Set<string>();
    let occurrenceCount = 0;
    const accept = (value: any, path: string): void => {
        if (!value || (typeof value !== "object")) throw new Error(`K32 malformed productive Character record at ${path}`);
        if (value.id === undefined || value.id === null || !/^\d+$/.test(String(value.id))) throw new Error(`K32 malformed productive cardId at ${path}`);
        const cardId = String(value.id);
        occurrenceCount++;
        if (cardIds.has(cardId)) throw new Error(`K32 ambiguous productive cardId ${cardId}`);
        cardIds.add(cardId);
        const transformations = value.transformations;
        if (transformations !== undefined && !Array.isArray(transformations)) throw new Error(`K32 malformed productive transformations at ${path}`);
        (transformations ?? []).forEach((item: unknown, index: number) => accept(item, `${path}.transformations[${index}]`));
    };
    characters.forEach((value, index) => accept(value, `$[${index}]`));
    return { topLevelCount: characters.length, occurrenceCount, cardIds };
}

function lineage(productive: CharacterStructuralProductiveCoverage): CharacterStructuralSidecarLineage {
    const pin = CHARACTER_STRUCTURAL_SIDECAR_SOURCE_PIN;
    return {
        profileId: pin.profileId,
        snapshotVersion: pin.snapshotVersion,
        k2: {
            contractVersion: pin.k2.contractVersion,
            manifestSha256: pin.k2.manifestSha256,
            manifestSizeBytes: pin.k2.manifestSizeBytes,
            payloadSha256: pin.k2.payloadSha256,
            payloadSizeBytes: pin.k2.payloadSizeBytes,
            uncompressedSizeBytes: pin.k2.uncompressedSizeBytes,
            coverageSha256: pin.k2.coverageSha256,
            coverageSizeBytes: pin.k2.coverageSizeBytes,
            validationSha256: pin.k2.validationSha256,
            validationSizeBytes: pin.k2.validationSizeBytes,
            databaseSha256: pin.k2.databaseSha256,
            db1ArtifactSha256: pin.k2.db1ArtifactSha256,
        },
        productiveCharacters: {
            contract: "Character[]",
            datasetVersion: pin.productiveCharacters.datasetVersion,
            manifestSha256: pin.productiveCharacters.manifestSha256,
            manifestSizeBytes: pin.productiveCharacters.manifestSizeBytes,
            payloadSha256: pin.productiveCharacters.payloadSha256,
            payloadSizeBytes: pin.productiveCharacters.payloadSizeBytes,
            uncompressedSizeBytes: pin.productiveCharacters.uncompressedSizeBytes,
            topLevelCount: productive.topLevelCount,
            uniqueCardIdCount: productive.cardIds.size,
        },
    };
}

export async function loadCharacterStructuralSidecarSource(options: CharacterStructuralSidecarSourceOptions): Promise<CharacterStructuralSidecarGenerationSource> {
    const [k2Root, productiveRoot] = await Promise.all([regularRoot(options.k2Root, "K2"), regularRoot(options.productiveRoot, "productive")]);
    const pin = CHARACTER_STRUCTURAL_SIDECAR_SOURCE_PIN;
    const names = [pin.k2.manifestFile, pin.k2.payloadFile, pin.k2.coverageFile, pin.k2.validationFile] as const;
    const [k2Manifest, k2Payload, k2Coverage, k2Validation, productiveManifest, productivePayload] = await Promise.all([
        readInputSnapshot(k2Root, names[0]), readInputSnapshot(k2Root, names[1]), readInputSnapshot(k2Root, names[2]), readInputSnapshot(k2Root, names[3]),
        readInputSnapshot(productiveRoot, pin.productiveCharacters.manifestFile), readInputSnapshot(productiveRoot, pin.productiveCharacters.localPayloadFile),
    ]);
    exact(k2Manifest, { sha256: pin.k2.manifestSha256, sizeBytes: pin.k2.manifestSizeBytes }, "K2 manifest");
    exact(k2Payload, { sha256: pin.k2.payloadSha256, sizeBytes: pin.k2.payloadSizeBytes }, "K2 payload");
    exact(k2Coverage, { sha256: pin.k2.coverageSha256, sizeBytes: pin.k2.coverageSizeBytes }, "K2 coverage");
    exact(k2Validation, { sha256: pin.k2.validationSha256, sizeBytes: pin.k2.validationSizeBytes }, "K2 validation");
    exact(productiveManifest, { sha256: pin.productiveCharacters.manifestSha256, sizeBytes: pin.productiveCharacters.manifestSizeBytes }, "productive manifest");
    exact(productivePayload, { sha256: pin.productiveCharacters.payloadSha256, sizeBytes: pin.productiveCharacters.payloadSizeBytes }, "productive payload");

    validateCharacterStructuralK2Manifest(JSON.parse(k2Manifest.bytes.toString("utf8")));
    validateCharacterStructuralProductiveManifest(JSON.parse(productiveManifest.bytes.toString("utf8")));
    const k2CoverageValue = JSON.parse(k2Coverage.bytes.toString("utf8"));
    if (k2CoverageValue?.cardCount !== pin.k2.cardCount || k2CoverageValue.categoryAssignmentCount !== pin.k2.categoryAssignmentCount
        || k2CoverageValue.linkAssignmentCount !== pin.k2.linkAssignmentCount) throw new Error("K32 K2 coverage cardinality changed");
    const k2ValidationValue = JSON.parse(k2Validation.bytes.toString("utf8"));
    if (k2ValidationValue?.valid !== true || !Array.isArray(k2ValidationValue.failures) || k2ValidationValue.failures.length !== 0) throw new Error("K32 K2 validation is not successful");

    const taxonomyRaw = gunzipSync(k2Payload.bytes);
    if (taxonomyRaw.length !== pin.k2.uncompressedSizeBytes) throw new Error("K32 K2 uncompressed size changed");
    const taxonomy = JSON.parse(taxonomyRaw.toString("utf8")) as DatabaseCharacterTaxonomyDataset;
    validateCharacterStructuralTaxonomy(taxonomy);
    const productiveRaw = gunzipSync(productivePayload.bytes);
    if (productiveRaw.length !== pin.productiveCharacters.uncompressedSizeBytes) throw new Error("K32 productive uncompressed size changed");
    const productiveCharacters = JSON.parse(productiveRaw.toString("utf8"));
    if (!Array.isArray(productiveCharacters) || productiveCharacters.length !== pin.productiveCharacters.topLevelCount) throw new Error("K32 productive top-level cardinality changed");
    const productive = indexProductiveCardIds(productiveCharacters);
    if (productive.occurrenceCount !== pin.productiveCharacters.uniqueCardIdCount || productive.cardIds.size !== pin.productiveCharacters.uniqueCardIdCount) {
        throw new Error("K32 productive cardId cardinality changed");
    }

    const snapshots = [k2Manifest, k2Payload, k2Coverage, k2Validation, productiveManifest, productivePayload];
    const revalidate = async (): Promise<void> => {
        const after = await Promise.all([
            readInputSnapshot(k2Root, names[0]), readInputSnapshot(k2Root, names[1]), readInputSnapshot(k2Root, names[2]), readInputSnapshot(k2Root, names[3]),
            readInputSnapshot(productiveRoot, pin.productiveCharacters.manifestFile), readInputSnapshot(productiveRoot, pin.productiveCharacters.localPayloadFile),
        ]);
        after.forEach((item, index) => unchanged(snapshots[index], item, snapshots[index].path));
    };
    return { taxonomy, productive, lineage: lineage(productive), revalidate };
}
