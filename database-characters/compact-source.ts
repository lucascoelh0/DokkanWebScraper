import { createHash } from "crypto";
import { createReadStream } from "fs";
import { lstat, readFile } from "fs/promises";
import { join, resolve } from "path";
import { StringDecoder } from "string_decoder";
import { createGunzip } from "zlib";
import { resolveCharacterInputFile } from "./artifact-path";
import { CharacterCompactSourceLineage } from "./compact-contract";
import { CHARACTER_REFRESH_PROFILE } from "./refresh-contract";
import { CharacterFieldProjection, CharacterShadowManifest, CharacterShadowProjection } from "./shadow-contract";
import { DatabaseCharacterShadowCoverage } from "./shadow-parity-contract";
import { DatabaseCharacterShadowReadiness } from "./shadow-readiness-contract";
import { CHARACTER_SHADOW_PINNED_RELEASE, manifestMatchesPinnedCharacterShadowRelease } from "./shadow-release";

const MANIFEST_FILE = "database-characters-k10-k14-manifest.json";
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

export interface CharacterCompactGenerationSource {
    generatedAt: string;
    datasetVersion: string;
    lineage: CharacterCompactSourceLineage;
    coverage: DatabaseCharacterShadowCoverage;
    readiness: DatabaseCharacterShadowReadiness;
    streamFields(accept: (field: CharacterFieldProjection) => void): Promise<void>;
}

async function exactRegularFile(root: string, fileName: string): Promise<string> {
    const rootPath = resolve(root);
    const rootMetadata = await lstat(rootPath);
    if (rootMetadata.isSymbolicLink() || !rootMetadata.isDirectory()) throw new Error("artifact root must be a regular non-link directory");
    const candidate = join(rootPath, fileName);
    const metadata = await lstat(candidate);
    if (metadata.isSymbolicLink() || !metadata.isFile()) throw new Error(`${fileName} must be a regular non-link file`);
    return resolveCharacterInputFile(rootPath, fileName, fileName);
}

function exact(bytes: Buffer, expected: { sha256: string; sizeBytes: number }, label: string): void {
    if (bytes.length !== expected.sizeBytes || hash(bytes) !== expected.sha256) throw new Error(`${label} identity changed`);
}

function sidecar(gate: "k0" | "k1" | "k2") {
    const profile = CHARACTER_REFRESH_PROFILE.sidecars.find(item => item.gate === gate);
    if (!profile) throw new Error(`${gate.toUpperCase()} profile missing`);
    return profile;
}

export async function loadCharacterCompactGenerationSource(root: string): Promise<CharacterCompactGenerationSource> {
    const controlledRoot = resolve(root);
    const manifestPath = await exactRegularFile(controlledRoot, MANIFEST_FILE);
    const manifestBytes = await readFile(manifestPath);
    exact(manifestBytes, { sha256: CHARACTER_SHADOW_PINNED_RELEASE.manifestSha256, sizeBytes: CHARACTER_SHADOW_PINNED_RELEASE.manifestSizeBytes }, "K10-K14 manifest");
    const manifest = JSON.parse(manifestBytes.toString("utf8")) as CharacterShadowManifest;
    if (!manifestMatchesPinnedCharacterShadowRelease(manifest)) throw new Error("K10-K14 manifest is not the pinned offline release");

    const [artifactPath, coveragePath, validationPath, readinessPath] = await Promise.all([
        exactRegularFile(controlledRoot, manifest.fileName),
        exactRegularFile(controlledRoot, manifest.coverageFile),
        exactRegularFile(controlledRoot, manifest.validationFile),
        exactRegularFile(controlledRoot, manifest.readinessFile),
    ]);
    const [artifactBytes, coverageBytes, validationBytes, readinessBytes] = await Promise.all([
        readFile(artifactPath), readFile(coveragePath), readFile(validationPath), readFile(readinessPath),
    ]);
    exact(artifactBytes, { sha256: manifest.sha256, sizeBytes: manifest.sizeBytes }, "K11 projection");
    exact(coverageBytes, { sha256: manifest.coverageSha256, sizeBytes: manifest.coverageSizeBytes }, "K12 coverage");
    exact(validationBytes, { sha256: manifest.validationSha256, sizeBytes: manifest.validationSizeBytes }, "K13 validation");
    exact(readinessBytes, { sha256: manifest.readinessSha256, sizeBytes: manifest.readinessSizeBytes }, "K14 readiness");
    const coverage = JSON.parse(coverageBytes.toString("utf8")) as DatabaseCharacterShadowCoverage;
    const validation = JSON.parse(validationBytes.toString("utf8"));
    const readiness = JSON.parse(readinessBytes.toString("utf8")) as DatabaseCharacterShadowReadiness;
    validateAncillaryContracts(coverage, validation, readiness);

    const header = await readK11Header(artifactPath);
    validateK11Header(header);
    const k0 = sidecar("k0");
    const k1 = sidecar("k1");
    const k2 = sidecar("k2");
    const lineage: CharacterCompactSourceLineage = {
        profileId: CHARACTER_REFRESH_PROFILE.profileId,
        snapshotVersion: CHARACTER_REFRESH_PROFILE.snapshotVersion,
        database: { ...CHARACTER_REFRESH_PROFILE.sqlite },
        db1: { ...CHARACTER_REFRESH_PROFILE.db1 },
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
        datasetVersion: `${CHARACTER_REFRESH_PROFILE.snapshotVersion}-k15-v1`,
        lineage,
        coverage,
        readiness,
        streamFields: async accept => {
            const streamed = await streamPinnedK11(artifactPath, accept);
            validateK11Header(streamed.header);
        },
    };
}

async function readK11Header(path: string): Promise<Omit<CharacterShadowProjection, "fields">> {
    const source = createReadStream(path);
    const stream = source.pipe(createGunzip());
    const decoder = new StringDecoder("utf8");
    const marker = ',"fields":[';
    let prefix = "";
    try {
        for await (const chunk of stream) {
            prefix += decoder.write(chunk as Buffer);
            const index = prefix.indexOf(marker);
            if (index >= 0) return JSON.parse(`${prefix.slice(0, index)}}`);
            if (prefix.length > 1_000_000) throw new Error("K11 header exceeds parser limit");
        }
    } finally {
        stream.destroy();
        source.destroy();
    }
    throw new Error("K11 fields marker missing");
}

function validateAncillaryContracts(coverage: DatabaseCharacterShadowCoverage, validation: any, readiness: DatabaseCharacterShadowReadiness): void {
    if (coverage.schemaVersion !== 1 || coverage.contract !== "dokkan-database-character-field-shadow-coverage" || coverage.contractVersion !== "1.0.0") throw new Error("K12 contract changed");
    if (coverage.cardCount !== 5_759 || coverage.productionJoinedCount !== 4_296 || coverage.productionUnjoinableCount !== 1_463) throw new Error("K12 join inventory changed");
    if (validation?.schemaVersion !== 1 || validation.valid !== true || !Array.isArray(validation.failures) || validation.failures.length) throw new Error("K13 validation contract changed");
    if (readiness.schemaVersion !== 1 || readiness.contract !== "dokkan-database-character-field-shadow-readiness" || readiness.contractVersion !== "1.0.1") throw new Error("K14 contract changed");
    for (const field of ["id", "rarity", "type"] as const) {
        const decision = readiness.fields.find(item => item.field === field);
        if (!decision || decision.decision !== "GO" || decision.patchableCharacterCount !== 4_296 || !Object.values(decision.criteria).every(Boolean)) throw new Error(`K14 did not approve ${field}`);
    }
    if (readiness.nextGate.action !== "generate_compact_supported_projection" || readiness.nextGate.decision !== "GO" || readiness.nextGate.gates.generateAndValidate !== "GO") throw new Error("K14 did not approve K15 generation");
}

function validateK11Header(header: Omit<CharacterShadowProjection, "fields">): void {
    if (header.schemaVersion !== 1 || header.contract !== "dokkan-database-character-field-shadow" || header.contractVersion !== "1.0.0") throw new Error("K11 contract changed");
    if (header.generatedAt !== CHARACTER_REFRESH_PROFILE.generatedAt || header.source.snapshotVersion !== CHARACTER_REFRESH_PROFILE.snapshotVersion) throw new Error("K11 snapshot lineage changed");
    for (const gate of ["k0", "k1", "k2"] as const) {
        const expected = sidecar(gate).artifact;
        const actual = header.source.sidecars[gate];
        if (actual.sha256 !== expected.sha256 || actual.sizeBytes !== expected.sizeBytes) throw new Error(`K11 ${gate.toUpperCase()} lineage changed`);
    }
    if (header.policy.k7ValuesConsumed || header.policy.productionModified || header.policy.publisherEnabled || header.policy.androidEnabled) throw new Error("K11 safety policy changed");
}

async function streamPinnedK11(path: string, accept: (field: CharacterFieldProjection) => void): Promise<{ header: Omit<CharacterShadowProjection, "fields"> }> {
    const compressedHash = createHash("sha256");
    const source = createReadStream(path);
    source.on("data", (chunk: Buffer) => compressedHash.update(chunk));
    const stream = source.pipe(createGunzip());
    const rawHash = createHash("sha256");
    const decoder = new StringDecoder("utf8");
    let rawSize = 0;
    let prefix = "";
    let header: Omit<CharacterShadowProjection, "fields"> | undefined;
    let inArray = false;
    let closed = false;
    let tail = "";
    let depth = 0;
    let inString = false;
    let escaped = false;
    let parts: string[] = [];
    const marker = ',"fields":[';

    const consume = (text: string): void => {
        let offset = 0;
        if (!inArray) {
            prefix += text;
            const index = prefix.indexOf(marker);
            if (index < 0) {
                if (prefix.length > 1_000_000) throw new Error("K11 header exceeds parser limit");
                return;
            }
            header = JSON.parse(`${prefix.slice(0, index)}}`);
            text = prefix.slice(index + marker.length);
            prefix = "";
            inArray = true;
        }
        if (closed) { tail += text; return; }
        let objectStart = depth ? 0 : -1;
        for (let index = offset; index < text.length; index++) {
            const character = text[index];
            if (depth === 0) {
                if (character === "{") { depth = 1; objectStart = index; }
                else if (character === "]") { closed = true; tail += text.slice(index + 1); return; }
                else if (character !== "," && !/\s/.test(character)) throw new Error("K11 fields array syntax changed");
                continue;
            }
            if (inString) {
                if (escaped) escaped = false;
                else if (character === "\\") escaped = true;
                else if (character === '"') inString = false;
                continue;
            }
            if (character === '"') inString = true;
            else if (character === "{") depth++;
            else if (character === "}") {
                depth--;
                if (depth === 0) {
                    parts.push(text.slice(objectStart, index + 1));
                    accept(JSON.parse(parts.join("")) as CharacterFieldProjection);
                    parts = [];
                    objectStart = -1;
                }
            }
        }
        if (depth > 0 && objectStart >= 0) parts.push(text.slice(objectStart));
        if (parts.reduce((sum, value) => sum + value.length, 0) > 1_000_000) throw new Error("K11 field exceeds parser limit");
    };

    for await (const chunk of stream) {
        const bytes = chunk as Buffer;
        rawHash.update(bytes);
        rawSize += bytes.length;
        consume(decoder.write(bytes));
    }
    consume(decoder.end());
    if (!header || !closed || depth !== 0 || tail !== "}\n") throw new Error("K11 projection framing changed");
    if (rawSize !== CHARACTER_SHADOW_PINNED_RELEASE.uncompressedSizeBytes || rawHash.digest("hex") !== CHARACTER_SHADOW_PINNED_RELEASE.uncompressedSha256) throw new Error("K11 raw identity changed");
    if (compressedHash.digest("hex") !== CHARACTER_SHADOW_PINNED_RELEASE.artifactSha256) throw new Error("K11 compressed bytes changed during validation");
    return { header };
}
