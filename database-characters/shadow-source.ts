import { createHash } from "crypto";
import { readFile } from "fs/promises";
import { resolve } from "path";
import { gunzipSync } from "zlib";
import { Character } from "../character";
import { resolveCharacterInputDirectory, resolveCharacterInputFile } from "./artifact-path";
import { DatabaseCharacterIdentityDataset } from "./identity-contract";
import { DatabaseCharacterParityDataset } from "./parity-contract";
import { CHARACTER_REFRESH_PROFILE, CharacterSidecarGate } from "./refresh-contract";
import { DatabaseCharacterStateGraphDataset } from "./state-graph-contract";
import { DatabaseCharacterTaxonomyDataset } from "./taxonomy-contract";

export interface CompactShadowExternalCharacter {
    id: string;
    sourceRecordPath: string;
    name: unknown;
    title: unknown;
    rarity: unknown;
    type: unknown;
    characterClass: unknown;
    categories: unknown;
    links: unknown;
    transformationIds: string[];
    awakeningCardIds: string[];
}

export interface ShadowExternalInput {
    characters: Map<string, CompactShadowExternalCharacter>;
    sha256: string;
    sizeBytes: number;
    topLevelCount: number;
    generatedAt?: string;
}

export interface CharacterShadowInputs {
    k0: DatabaseCharacterIdentityDataset;
    k1: DatabaseCharacterStateGraphDataset;
    k2: DatabaseCharacterTaxonomyDataset;
    k7: DatabaseCharacterParityDataset;
    sidecarIdentities: Record<"k0" | "k1" | "k2" | "k7", { sha256: string; sizeBytes: number }>;
    production: ShadowExternalInput;
    fyi: ShadowExternalInput & { generatedAt: string };
}

const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

function compactCharacter(value: any, sourceRecordPath: string): CompactShadowExternalCharacter {
    const transformations = Array.isArray(value.transformations) ? value.transformations : [];
    const awakenings = Array.isArray(value.awakeningCards) ? value.awakeningCards : [];
    return {
        id: String(value.id),
        sourceRecordPath,
        name: value.name ?? null,
        title: value.title ?? null,
        rarity: value.rarity ?? null,
        type: value.type ?? null,
        characterClass: value.characterClass ?? null,
        categories: Array.isArray(value.categories) ? value.categories : null,
        links: Array.isArray(value.links) ? value.links : null,
        transformationIds: transformations.flatMap((item: any) => item?.id === undefined ? [] : [String(item.id)]),
        awakeningCardIds: awakenings.flatMap((item: any) => item?.id === undefined ? [] : [String(item.id)]),
    };
}

const comparableExternal = ({ sourceRecordPath: _path, ...value }: CompactShadowExternalCharacter) => JSON.stringify(value);

/** Top-level Character[] records outrank nested presentation; equal nested repeats use their first exact path. */
export function compactCharacters(input: any[]): Map<string, CompactShadowExternalCharacter> {
    const result = new Map<string, CompactShadowExternalCharacter>();
    const topLevelIds = new Set<string>();
    input.forEach((value, index) => {
        if (!value || value.id === undefined || value.id === null) return;
        const id = String(value.id);
        if (topLevelIds.has(id)) throw new Error(`duplicate top-level external character ID ${id}`);
        topLevelIds.add(id);
        result.set(id, compactCharacter(value, `$[${index}]`));
    });
    const visitNested = (value: any, path: string): void => {
        const transformations = Array.isArray(value?.transformations) ? value.transformations : [];
        transformations.forEach((item: any, index: number) => {
            const itemPath = `${path}.transformations[${index}]`;
            if (!item || item.id === undefined || item.id === null) return;
            const id = String(item.id);
            const compact = compactCharacter(item, itemPath);
            const previous = result.get(id);
            if (!previous) result.set(id, compact);
            else if (!topLevelIds.has(id) && comparableExternal(previous) !== comparableExternal(compact)) throw new Error(`ambiguous duplicate nested external character ID ${id}`);
            visitNested(item, itemPath);
        });
    };
    input.forEach((value, index) => visitNested(value, `$[${index}]`));
    return result;
}

async function loadSidecar<T>(root: string, gate: "k0" | "k1" | "k2" | "k7"): Promise<{ dataset: T; identity: { sha256: string; sizeBytes: number } }> {
    const profile = CHARACTER_REFRESH_PROFILE.sidecars.find(item => item.gate === gate);
    if (!profile) throw new Error(`${gate.toUpperCase()} profile is missing`);
    const directory = await resolveCharacterInputDirectory(resolve(root), gate, gate);
    const [manifestPath, artifactPath, coveragePath, validationPath] = await Promise.all([
        resolveCharacterInputFile(directory, profile.manifest.fileName, profile.manifest.fileName),
        resolveCharacterInputFile(directory, profile.artifact.fileName, profile.artifact.fileName),
        resolveCharacterInputFile(directory, profile.coverage.fileName, profile.coverage.fileName),
        resolveCharacterInputFile(directory, profile.validation.fileName, profile.validation.fileName),
    ]);
    const [manifestBytes, artifactBytes, coverageBytes, validationBytes] = await Promise.all([
        readFile(manifestPath), readFile(artifactPath), readFile(coveragePath), readFile(validationPath),
    ]);
    const exact = (bytes: Buffer, expected: { sha256: string; sizeBytes: number }, label: string) => {
        if (bytes.length !== expected.sizeBytes || hash(bytes) !== expected.sha256) throw new Error(`${gate.toUpperCase()} ${label} identity changed`);
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
        || manifest.validationSha256 !== profile.validation.sha256 || (gate !== "k7" && manifest.sourceSnapshotVersion !== CHARACTER_REFRESH_PROFILE.snapshotVersion)
        || manifest.sourceDb1ArtifactSha256 !== CHARACTER_REFRESH_PROFILE.db1.sha256
        || validation.valid !== true || !Array.isArray(validation.failures) || validation.failures.length !== 0) throw new Error(`${gate.toUpperCase()} manifest contract changed`);
    const raw = gunzipSync(artifactBytes);
    if (raw.length !== profile.artifact.uncompressedSizeBytes) throw new Error(`${gate.toUpperCase()} raw size changed`);
    const dataset = JSON.parse(raw.toString("utf8"));
    if (dataset.schemaVersion !== 1 || dataset.contractVersion !== profile.contractVersion || dataset.source?.snapshotVersion !== CHARACTER_REFRESH_PROFILE.snapshotVersion) throw new Error(`${gate.toUpperCase()} dataset contract changed`);
    return { dataset, identity: { sha256: profile.artifact.sha256, sizeBytes: profile.artifact.sizeBytes } };
}

async function loadProduction(root: string, k7: DatabaseCharacterParityDataset): Promise<ShadowExternalInput> {
    const path = await resolveCharacterInputFile(resolve(root), "characters.json", "characters.json");
    const bytes = await readFile(path);
    const expected = k7.source.productionCharacters;
    if (bytes.length !== expected.sizeBytes || hash(bytes) !== expected.sha256) throw new Error("production Character[] identity changed from K7 binding evidence");
    const parsed = JSON.parse(bytes.toString("utf8"));
    if (!Array.isArray(parsed) || parsed.length !== expected.characterCount) throw new Error("production Character[] cardinality changed");
    return { characters: compactCharacters(parsed as Character[]), sha256: expected.sha256, sizeBytes: bytes.length, topLevelCount: parsed.length };
}

async function loadFyi(root: string, k7: DatabaseCharacterParityDataset): Promise<ShadowExternalInput & { generatedAt: string }> {
    const [manifestPath, artifactPath] = await Promise.all([
        resolveCharacterInputFile(resolve(root), "characters-manifest.json", "characters-manifest.json"),
        resolveCharacterInputFile(resolve(root), "characters.json.gz", "characters.json.gz"),
    ]);
    const [manifestBytes, artifactBytes] = await Promise.all([readFile(manifestPath), readFile(artifactPath)]);
    const manifest = JSON.parse(manifestBytes.toString("utf8"));
    const expected = k7.source.fyiCharacters;
    if (manifest.schemaVersion !== 1 || manifest.compression !== "gzip" || manifest.fileName !== "characters.json.gz"
        || manifest.sha256 !== expected.sha256 || manifest.sizeBytes !== expected.sizeBytes || manifest.characterCount !== expected.characterCount
        || manifest.generatedAt !== expected.generatedAt || artifactBytes.length !== manifest.sizeBytes || hash(artifactBytes) !== manifest.sha256) throw new Error("FYI Character[] manifest changed from K7 binding evidence");
    const raw = gunzipSync(artifactBytes);
    if (raw.length !== manifest.uncompressedSizeBytes) throw new Error("FYI Character[] raw size changed");
    const parsed = JSON.parse(raw.toString("utf8"));
    if (!Array.isArray(parsed) || parsed.length !== manifest.characterCount) throw new Error("FYI Character[] cardinality changed");
    return { characters: compactCharacters(parsed), sha256: manifest.sha256, sizeBytes: artifactBytes.length, topLevelCount: parsed.length, generatedAt: manifest.generatedAt };
}

export async function loadCharacterShadowInputs(options: { sidecarRoot: string; productionRoot: string; fyiRoot: string }): Promise<CharacterShadowInputs> {
    const [k0, k1, k2, k7] = await Promise.all([
        loadSidecar<DatabaseCharacterIdentityDataset>(options.sidecarRoot, "k0"),
        loadSidecar<DatabaseCharacterStateGraphDataset>(options.sidecarRoot, "k1"),
        loadSidecar<DatabaseCharacterTaxonomyDataset>(options.sidecarRoot, "k2"),
        loadSidecar<DatabaseCharacterParityDataset>(options.sidecarRoot, "k7"),
    ]);
    if (k7.dataset.source.upstreamSidecars.k1.artifactSha256 !== k1.identity.sha256 || k7.dataset.source.upstreamSidecars.k2.artifactSha256 !== k2.identity.sha256) throw new Error("K7 binding evidence does not reference the pinned K1/K2 inputs");
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

export const CHARACTER_SHADOW_REQUIRED_GATES: CharacterSidecarGate[] = ["k0", "k1", "k2", "k7"];
