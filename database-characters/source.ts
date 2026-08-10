import { createHash } from "crypto";
import { createReadStream } from "fs";
import { readFile, stat } from "fs/promises";
import { resolve } from "path";
import { createGunzip, gunzipSync } from "zlib";
import { DatabaseCardRecord } from "../database-experiment/contract";
import { ReadOnlySqliteAdapter, SqliteRow } from "../database-experiment/sqlite-readonly-adapter";
import { resolveCharacterInputFile } from "./artifact-path";

const DB1_MANIFEST_FILE = "manifest.json";
const DB1_SOURCE_MANIFEST_FILE = "source-manifest.json";
const DB1_ARTIFACT_FILE = "characters-db-experiment.json.gz";

export const CHARACTER_SOURCE_PROFILE = {
    snapshotVersion: "global-6.4.0-v338-2026-08-05",
    databaseSha256: "3654eb7db9e18dfe4c238abd02bcc06a688ffa6f30aa1ad93fd108dcfeb78265",
    databaseSizeBytes: 95_428_608,
    db1ArtifactSha256: "0afae38e1a80e55bc5d8a137f945727149f44403bf1670e830d3ef6f3650e547",
    db1ArtifactSizeBytes: 11_217_031,
    db1UncompressedSizeBytes: 233_969_863,
    db1CardCount: 5_759,
} as const;

export interface CharacterSourceInput {
    inputDir: string;
    artifactPath: string;
    generatedAt: string;
    datasetVersion: string;
    snapshotVersion: string;
    databaseSha256: string;
    artifactSha256: string;
    artifactSizeBytes: number;
    uncompressedSizeBytes: number;
    cardCount: number;
}

interface Db1Manifest {
    schemaVersion: number;
    contractVersion: string;
    datasetVersion: string;
    generatedAt: string;
    fileName: string;
    sha256: string;
    sizeBytes: number;
    uncompressedSizeBytes: number;
    cardCount: number;
    sourceSha256: string;
    sourceManifestFile: string;
    compression: string;
}

interface Db1SourceManifest {
    schemaVersion: number;
    sourceKind: string;
    snapshotVersion: string;
    sha256: string;
    sizeBytes: number;
    tableCount: number;
    readOnlyMode: string;
}

export async function sha256File(filePath: string): Promise<string> {
    return new Promise<string>((resolvePromise, rejectPromise) => {
        const hash = createHash("sha256");
        const stream = createReadStream(filePath);
        stream.on("data", chunk => hash.update(chunk));
        stream.on("error", rejectPromise);
        stream.on("end", () => resolvePromise(hash.digest("hex")));
    });
}

export async function readCharacterSourceInput(inputDir: string): Promise<CharacterSourceInput> {
    const resolvedInputDir = resolve(inputDir);
    const [manifestPath, sourceManifestPath] = await Promise.all([
        resolveCharacterInputFile(resolvedInputDir, DB1_MANIFEST_FILE, DB1_MANIFEST_FILE),
        resolveCharacterInputFile(resolvedInputDir, DB1_SOURCE_MANIFEST_FILE, DB1_SOURCE_MANIFEST_FILE),
    ]);
    const [manifest, source] = await Promise.all([
        readFile(manifestPath, "utf8").then(value => JSON.parse(value) as Db1Manifest),
        readFile(sourceManifestPath, "utf8").then(value => JSON.parse(value) as Db1SourceManifest),
    ]);
    const failures: string[] = [];
    if (manifest.schemaVersion !== 1 || manifest.compression !== "gzip") failures.push("DB1 manifest schema changed");
    if (manifest.contractVersion !== "1.1.0") failures.push(`DB1 contract ${manifest.contractVersion} is not supported`);
    if (manifest.fileName !== DB1_ARTIFACT_FILE) failures.push("DB1 manifest file name changed");
    if (manifest.sourceManifestFile !== DB1_SOURCE_MANIFEST_FILE) failures.push("DB1 source manifest file name changed");
    if (source.schemaVersion !== 1 || source.sourceKind !== "first-party-global-sqlite") failures.push("source manifest schema changed");
    if (source.snapshotVersion !== CHARACTER_SOURCE_PROFILE.snapshotVersion) failures.push("snapshot version changed");
    if (source.sha256 !== CHARACTER_SOURCE_PROFILE.databaseSha256 || manifest.sourceSha256 !== source.sha256) failures.push("database hash changed");
    if (source.sizeBytes !== CHARACTER_SOURCE_PROFILE.databaseSizeBytes) failures.push("database size changed");
    if (source.tableCount !== 232 || source.readOnlyMode !== "sqlite-uri-mode-ro+immutable+query-only") failures.push("source read-only/schema profile changed");
    if (manifest.sha256 !== CHARACTER_SOURCE_PROFILE.db1ArtifactSha256) failures.push("DB1 artifact hash changed");
    if (manifest.sizeBytes !== CHARACTER_SOURCE_PROFILE.db1ArtifactSizeBytes) failures.push("DB1 artifact size changed");
    if (manifest.uncompressedSizeBytes !== CHARACTER_SOURCE_PROFILE.db1UncompressedSizeBytes) failures.push("DB1 uncompressed size changed");
    if (manifest.cardCount !== CHARACTER_SOURCE_PROFILE.db1CardCount) failures.push("DB1 card count changed");
    if (failures.length > 0) throw new Error(`Incompatible character source input: ${failures.join("; ")}`);
    const artifactPath = await resolveCharacterInputFile(resolvedInputDir, manifest.fileName, DB1_ARTIFACT_FILE);
    const [actualHash, artifactMetadata] = await Promise.all([sha256File(artifactPath), stat(artifactPath)]);
    if (actualHash !== manifest.sha256 || artifactMetadata.size !== manifest.sizeBytes) throw new Error("Incompatible character source input: DB1 artifact identity changed");
    return {
        inputDir: resolvedInputDir,
        artifactPath,
        generatedAt: manifest.generatedAt,
        datasetVersion: manifest.datasetVersion,
        snapshotVersion: source.snapshotVersion,
        databaseSha256: source.sha256,
        artifactSha256: manifest.sha256,
        artifactSizeBytes: manifest.sizeBytes,
        uncompressedSizeBytes: manifest.uncompressedSizeBytes,
        cardCount: manifest.cardCount,
    };
}

export async function assertPinnedDatabaseFile(databasePath: string): Promise<void> {
    const resolvedPath = resolve(databasePath);
    const hash = await sha256File(resolvedPath);
    const { size } = await stat(resolvedPath);
    if (hash !== CHARACTER_SOURCE_PROFILE.databaseSha256 || size !== CHARACTER_SOURCE_PROFILE.databaseSizeBytes) {
        throw new Error("Focused database read rejected an incompatible SQLite snapshot");
    }
}

export async function readPinnedDatabaseTable(databasePath: string, table: string, columns: string[]): Promise<SqliteRow[]> {
    const resolvedPath = resolve(databasePath);
    await assertPinnedDatabaseFile(resolvedPath);
    return new ReadOnlySqliteAdapter(resolvedPath).readTable(table, columns);
}

export async function readPinnedGzipJson<T>(filePath: string, expected: { sha256: string; sizeBytes: number; uncompressedSizeBytes: number }): Promise<T> {
    const resolvedPath = resolve(filePath);
    const gzip = await readFile(resolvedPath);
    const actualHash = createHash("sha256").update(gzip).digest("hex");
    if (actualHash !== expected.sha256 || gzip.length !== expected.sizeBytes) throw new Error(`Pinned gzip artifact changed: ${resolvedPath}`);
    const json = gunzipSync(gzip);
    if (json.length !== expected.uncompressedSizeBytes) throw new Error(`Pinned gzip uncompressed size changed: ${resolvedPath}`);
    return JSON.parse(json.toString("utf8")) as T;
}

export async function assertPinnedArtifactFile(filePath: string, expected: { sha256: string; sizeBytes: number }): Promise<void> {
    const resolvedPath = resolve(filePath);
    const [actualHash, metadata] = await Promise.all([sha256File(resolvedPath), stat(resolvedPath)]);
    if (actualHash !== expected.sha256 || metadata.size !== expected.sizeBytes) throw new Error(`Pinned artifact changed: ${resolvedPath}`);
}

/** Streams the DB1 cards array one object at a time instead of materializing 234 MB of JSON. */
export async function* streamDb1Cards(artifactPath: string): AsyncGenerator<DatabaseCardRecord> {
    const input = createReadStream(artifactPath).pipe(createGunzip());
    input.setEncoding("utf8");
    let locating = true;
    let prefix = "";
    let objectText = "";
    let depth = 0;
    let inString = false;
    let escaped = false;
    let arrayEnded = false;

    for await (const rawChunk of input) {
        let chunk = String(rawChunk);
        if (locating) {
            prefix += chunk;
            const match = /"cards"\s*:\s*\[/.exec(prefix);
            if (!match) {
                if (prefix.length > 65_536) throw new Error("DB1 cards array was not found in the document prefix");
                continue;
            }
            chunk = prefix.slice(match.index + match[0].length);
            prefix = "";
            locating = false;
        }

        for (const char of chunk) {
            if (arrayEnded) break;
            if (depth === 0) {
                if (char === "{") {
                    objectText = "{";
                    depth = 1;
                    inString = false;
                    escaped = false;
                } else if (char === "]") {
                    arrayEnded = true;
                } else if (!/[\s,]/.test(char)) {
                    throw new Error(`Unexpected token before DB1 card object: ${char}`);
                }
                continue;
            }

            objectText += char;
            if (inString) {
                if (escaped) escaped = false;
                else if (char === "\\") escaped = true;
                else if (char === "\"") inString = false;
                continue;
            }
            if (char === "\"") inString = true;
            else if (char === "{") depth += 1;
            else if (char === "}") {
                depth -= 1;
                if (depth === 0) {
                    yield JSON.parse(objectText) as DatabaseCardRecord;
                    objectText = "";
                }
            }
        }
        if (arrayEnded) break;
    }
    if (locating || !arrayEnded || depth !== 0) throw new Error("DB1 cards array ended unexpectedly");
}
