"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.streamDb1Cards = exports.assertPinnedArtifactFile = exports.readPinnedGzipJson = exports.readPinnedDatabaseTable = exports.assertPinnedDatabaseFile = exports.readCharacterSourceInput = exports.sha256File = exports.CHARACTER_SOURCE_PROFILE = void 0;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const zlib_1 = require("zlib");
const sqlite_readonly_adapter_1 = require("../database-experiment/sqlite-readonly-adapter");
exports.CHARACTER_SOURCE_PROFILE = {
    snapshotVersion: "global-6.4.0-v338-2026-08-05",
    databaseSha256: "3654eb7db9e18dfe4c238abd02bcc06a688ffa6f30aa1ad93fd108dcfeb78265",
    databaseSizeBytes: 95428608,
    db1ArtifactSha256: "0afae38e1a80e55bc5d8a137f945727149f44403bf1670e830d3ef6f3650e547",
    db1ArtifactSizeBytes: 11217031,
    db1UncompressedSizeBytes: 233969863,
    db1CardCount: 5759,
};
async function sha256File(filePath) {
    return new Promise((resolvePromise, rejectPromise) => {
        const hash = (0, crypto_1.createHash)("sha256");
        const stream = (0, fs_1.createReadStream)(filePath);
        stream.on("data", chunk => hash.update(chunk));
        stream.on("error", rejectPromise);
        stream.on("end", () => resolvePromise(hash.digest("hex")));
    });
}
exports.sha256File = sha256File;
async function readCharacterSourceInput(inputDir) {
    const resolvedInputDir = (0, path_1.resolve)(inputDir);
    const manifest = JSON.parse(await (0, promises_1.readFile)((0, path_1.resolve)(resolvedInputDir, "manifest.json"), "utf8"));
    const source = JSON.parse(await (0, promises_1.readFile)((0, path_1.resolve)(resolvedInputDir, "source-manifest.json"), "utf8"));
    const artifactPath = (0, path_1.resolve)(resolvedInputDir, manifest.fileName);
    const actualHash = await sha256File(artifactPath);
    const failures = [];
    if (manifest.contractVersion !== "1.1.0")
        failures.push(`DB1 contract ${manifest.contractVersion} is not supported`);
    if (source.snapshotVersion !== exports.CHARACTER_SOURCE_PROFILE.snapshotVersion)
        failures.push("snapshot version changed");
    if (source.sha256 !== exports.CHARACTER_SOURCE_PROFILE.databaseSha256 || manifest.sourceSha256 !== source.sha256)
        failures.push("database hash changed");
    if (source.sizeBytes !== exports.CHARACTER_SOURCE_PROFILE.databaseSizeBytes)
        failures.push("database size changed");
    if (source.tableCount !== 232 || source.readOnlyMode !== "sqlite-uri-mode-ro+immutable+query-only")
        failures.push("source read-only/schema profile changed");
    if (manifest.sha256 !== exports.CHARACTER_SOURCE_PROFILE.db1ArtifactSha256 || actualHash !== manifest.sha256)
        failures.push("DB1 artifact hash changed");
    if (manifest.sizeBytes !== exports.CHARACTER_SOURCE_PROFILE.db1ArtifactSizeBytes)
        failures.push("DB1 artifact size changed");
    if (manifest.uncompressedSizeBytes !== exports.CHARACTER_SOURCE_PROFILE.db1UncompressedSizeBytes)
        failures.push("DB1 uncompressed size changed");
    if (manifest.cardCount !== exports.CHARACTER_SOURCE_PROFILE.db1CardCount)
        failures.push("DB1 card count changed");
    if (failures.length > 0)
        throw new Error(`Incompatible character source input: ${failures.join("; ")}`);
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
exports.readCharacterSourceInput = readCharacterSourceInput;
async function assertPinnedDatabaseFile(databasePath) {
    const resolvedPath = (0, path_1.resolve)(databasePath);
    const hash = await sha256File(resolvedPath);
    const { size } = await (0, promises_1.stat)(resolvedPath);
    if (hash !== exports.CHARACTER_SOURCE_PROFILE.databaseSha256 || size !== exports.CHARACTER_SOURCE_PROFILE.databaseSizeBytes) {
        throw new Error("Focused database read rejected an incompatible SQLite snapshot");
    }
}
exports.assertPinnedDatabaseFile = assertPinnedDatabaseFile;
async function readPinnedDatabaseTable(databasePath, table, columns) {
    const resolvedPath = (0, path_1.resolve)(databasePath);
    await assertPinnedDatabaseFile(resolvedPath);
    return new sqlite_readonly_adapter_1.ReadOnlySqliteAdapter(resolvedPath).readTable(table, columns);
}
exports.readPinnedDatabaseTable = readPinnedDatabaseTable;
async function readPinnedGzipJson(filePath, expected) {
    const resolvedPath = (0, path_1.resolve)(filePath);
    const gzip = await (0, promises_1.readFile)(resolvedPath);
    const actualHash = (0, crypto_1.createHash)("sha256").update(gzip).digest("hex");
    if (actualHash !== expected.sha256 || gzip.length !== expected.sizeBytes)
        throw new Error(`Pinned gzip artifact changed: ${resolvedPath}`);
    const json = (0, zlib_1.gunzipSync)(gzip);
    if (json.length !== expected.uncompressedSizeBytes)
        throw new Error(`Pinned gzip uncompressed size changed: ${resolvedPath}`);
    return JSON.parse(json.toString("utf8"));
}
exports.readPinnedGzipJson = readPinnedGzipJson;
async function assertPinnedArtifactFile(filePath, expected) {
    const resolvedPath = (0, path_1.resolve)(filePath);
    const [actualHash, metadata] = await Promise.all([sha256File(resolvedPath), (0, promises_1.stat)(resolvedPath)]);
    if (actualHash !== expected.sha256 || metadata.size !== expected.sizeBytes)
        throw new Error(`Pinned artifact changed: ${resolvedPath}`);
}
exports.assertPinnedArtifactFile = assertPinnedArtifactFile;
/** Streams the DB1 cards array one object at a time instead of materializing 234 MB of JSON. */
async function* streamDb1Cards(artifactPath) {
    const input = (0, fs_1.createReadStream)(artifactPath).pipe((0, zlib_1.createGunzip)());
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
                if (prefix.length > 65536)
                    throw new Error("DB1 cards array was not found in the document prefix");
                continue;
            }
            chunk = prefix.slice(match.index + match[0].length);
            prefix = "";
            locating = false;
        }
        for (const char of chunk) {
            if (arrayEnded)
                break;
            if (depth === 0) {
                if (char === "{") {
                    objectText = "{";
                    depth = 1;
                    inString = false;
                    escaped = false;
                }
                else if (char === "]") {
                    arrayEnded = true;
                }
                else if (!/[\s,]/.test(char)) {
                    throw new Error(`Unexpected token before DB1 card object: ${char}`);
                }
                continue;
            }
            objectText += char;
            if (inString) {
                if (escaped)
                    escaped = false;
                else if (char === "\\")
                    escaped = true;
                else if (char === "\"")
                    inString = false;
                continue;
            }
            if (char === "\"")
                inString = true;
            else if (char === "{")
                depth += 1;
            else if (char === "}") {
                depth -= 1;
                if (depth === 0) {
                    yield JSON.parse(objectText);
                    objectText = "";
                }
            }
        }
        if (arrayEnded)
            break;
    }
    if (locating || !arrayEnded || depth !== 0)
        throw new Error("DB1 cards array ended unexpectedly");
}
exports.streamDb1Cards = streamDb1Cards;
//# sourceMappingURL=source.js.map