"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseSupportMemoryCandidateArgs = void 0;
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const zlib_1 = require("zlib");
const format_json_1 = require("../format-json");
const game_db_support_memory_assets_1 = require("./game-db-support-memory-assets");
const game_db_support_memory_1 = require("./game-db-support-memory");
const game_db_source_1 = require("./game-db-source");
const REQUIRED_TABLES = [
    "cards",
    "card_card_categories",
    "card_categories",
    "card_unique_info_set_relations",
    "mission_categories",
    "mission_rewards",
    "missions",
    "sub_target_type_sets",
    "sub_target_types",
    "support_films",
    "support_memories",
    "support_memory_enhancement_items",
    "support_memory_enhancement_levels",
    "support_memory_enhancement_require_items",
    "support_memory_skills",
];
function parseSupportMemoryCandidateArgs(args) {
    const supported = new Set([
        "--source-data-dir", "--source-snapshot-version", "--source-database-sha256",
        "--previous-dataset", "--characters", "--output-dir", "--generated-at",
        "--source-assets-dir", "--asset-source-identity", "--asset-output-dir",
    ]);
    const values = new Map();
    for (let index = 0; index < args.length; index += 1) {
        const token = args[index];
        const separator = token.indexOf("=");
        const key = separator >= 0 ? token.slice(0, separator) : token;
        if (!supported.has(key))
            throw new Error(`Unexpected Support Memory candidate argument: ${token}`);
        const value = separator >= 0 ? token.slice(separator + 1) : args[++index];
        if (!value || values.has(key))
            throw new Error(`Missing or duplicate Support Memory candidate argument: ${key}`);
        values.set(key, value);
    }
    const required = [
        "--source-data-dir", "--source-snapshot-version", "--source-database-sha256", "--characters", "--output-dir",
        "--source-assets-dir", "--asset-source-identity", "--asset-output-dir",
    ];
    for (const key of required)
        if (!values.has(key))
            throw new Error(`Missing Support Memory candidate argument: ${key}`);
    const generatedAt = values.get("--generated-at") ?? new Date().toISOString();
    if (Number.isNaN(new Date(generatedAt).getTime()))
        throw new Error("Invalid --generated-at");
    return {
        sourceDataDir: (0, path_1.resolve)(values.get("--source-data-dir")),
        sourceSnapshotVersion: values.get("--source-snapshot-version"),
        sourceDatabaseSha256: values.get("--source-database-sha256"),
        ...(values.get("--previous-dataset") ? { previousDatasetPath: (0, path_1.resolve)(values.get("--previous-dataset")) } : {}),
        sourceAssetsDir: (0, path_1.resolve)(values.get("--source-assets-dir")),
        assetSourceIdentityPath: (0, path_1.resolve)(values.get("--asset-source-identity")),
        assetOutputDir: (0, path_1.resolve)(values.get("--asset-output-dir")),
        charactersPath: (0, path_1.resolve)(values.get("--characters")),
        outputDir: (0, path_1.resolve)(values.get("--output-dir")),
        generatedAt,
    };
}
exports.parseSupportMemoryCandidateArgs = parseSupportMemoryCandidateArgs;
async function loadTables(sourceDataDir) {
    const config = { sourceRoot: sourceDataDir, dataDir: sourceDataDir };
    const entries = await Promise.all(REQUIRED_TABLES.map(async (table) => [table, await (0, game_db_source_1.readGameDbTable)(config, table)]));
    return Object.fromEntries(entries);
}
async function requireMissingOutput(path, label) {
    try {
        await (0, promises_1.stat)(path);
        throw new Error(`${label} must not already exist: ${path}`);
    }
    catch (error) {
        if (error.code !== "ENOENT")
            throw error;
    }
}
async function main() {
    const options = parseSupportMemoryCandidateArgs(process.argv.slice(2));
    await requireMissingOutput(options.outputDir, "Support Memory candidate output");
    await requireMissingOutput(options.assetOutputDir, "Support Memory game-asset output");
    const previousDataset = options.previousDatasetPath
        ? JSON.parse(await (0, promises_1.readFile)(options.previousDatasetPath, "utf8"))
        : undefined;
    const sourceIdentity = JSON.parse(await (0, promises_1.readFile)(options.assetSourceIdentityPath, "utf8"));
    if (sourceIdentity.databaseSnapshotVersion !== options.sourceSnapshotVersion) {
        throw new Error("Support Memory asset source identity does not match the database snapshot");
    }
    const characterBuffer = await (0, promises_1.readFile)(options.charactersPath);
    const characterJson = JSON.parse(options.charactersPath.endsWith(".gz") ? (0, zlib_1.gunzipSync)(characterBuffer).toString("utf8") : characterBuffer.toString("utf8"));
    const characters = Array.isArray(characterJson) ? characterJson : characterJson.characters;
    if (!Array.isArray(characters) || characters.some(character => typeof character?.id !== "string")) {
        throw new Error("Support Memory candidate character artifact is invalid");
    }
    const consumerCharacterIds = new Set(characters.map(character => character.id));
    if (consumerCharacterIds.size !== characters.length)
        throw new Error("Support Memory candidate character artifact contains duplicate IDs");
    const tables = await loadTables(options.sourceDataDir);
    // Validate every database join and comparison before creating the versioned
    // asset output. The second pass below only attaches already validated,
    // first-party presentation bytes.
    (0, game_db_support_memory_1.buildSupportMemoryFirstPartyCandidate)({
        generatedAt: options.generatedAt,
        sourceSnapshotVersion: options.sourceSnapshotVersion,
        sourceDatabaseSha256: options.sourceDatabaseSha256,
        tables,
        previousDataset,
        consumerCharacterIds,
    });
    const gameAssets = await (0, game_db_support_memory_assets_1.buildSupportMemoryGameAssets)({
        generatedAt: options.generatedAt,
        sourceIdentity,
        sourceBundleRoot: options.sourceAssetsDir,
        outputRoot: options.assetOutputDir,
        projectRoot: process.cwd(),
        tables,
    });
    const candidate = (0, game_db_support_memory_1.buildSupportMemoryFirstPartyCandidate)({
        generatedAt: options.generatedAt,
        sourceSnapshotVersion: options.sourceSnapshotVersion,
        sourceDatabaseSha256: options.sourceDatabaseSha256,
        tables,
        previousDataset,
        presentations: gameAssets.presentations,
        consumerCharacterIds,
    });
    await (0, promises_1.mkdir)((0, path_1.dirname)(options.outputDir), { recursive: true });
    await (0, promises_1.mkdir)(options.outputDir);
    const detailsPath = (0, path_1.resolve)(options.outputDir, "support-memory-details.json");
    const auditPath = (0, path_1.resolve)(options.outputDir, "support-memory-first-party-audit.json");
    const assetAuditPath = (0, path_1.resolve)(options.outputDir, "support-memory-first-party-asset-audit.json");
    await (0, format_json_1.writeFormattedJson)(detailsPath, candidate.dataset);
    await (0, format_json_1.writeFormattedJson)(auditPath, candidate.audit);
    await (0, format_json_1.writeFormattedJson)(assetAuditPath, gameAssets.audit);
    const details = await (0, promises_1.readFile)(detailsPath);
    const audit = await (0, promises_1.readFile)(auditPath);
    const assetAudit = await (0, promises_1.readFile)(assetAuditPath);
    await (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, "candidate-manifest.json"), `${JSON.stringify({
        schemaVersion: 1,
        generatedAt: options.generatedAt,
        sourceSnapshotVersion: options.sourceSnapshotVersion,
        sourceDatabaseSha256: options.sourceDatabaseSha256,
        supportMemoryCount: candidate.dataset.count,
        files: [
            { name: "support-memory-details.json", sizeBytes: details.byteLength, sha256: (0, crypto_1.createHash)("sha256").update(details).digest("hex") },
            { name: "support-memory-first-party-audit.json", sizeBytes: audit.byteLength, sha256: (0, crypto_1.createHash)("sha256").update(audit).digest("hex") },
            { name: "support-memory-first-party-asset-audit.json", sizeBytes: assetAudit.byteLength, sha256: (0, crypto_1.createHash)("sha256").update(assetAudit).digest("hex") },
        ],
    }, null, 2)}\n`, { encoding: "utf8", flag: "w" });
    console.log(JSON.stringify({
        outputDir: options.outputDir,
        supportMemoryCount: candidate.dataset.count,
        compatibility: candidate.audit.compatibility,
        counts: candidate.audit.counts,
        assets: {
            root: gameAssets.audit.output.root,
            memoryCount: gameAssets.audit.output.memoryCount,
            fileCount: gameAssets.audit.output.fileCount,
            totalBytes: gameAssets.audit.output.totalBytes,
            inventorySha256: gameAssets.audit.output.inventorySha256,
        },
    }, null, 2));
}
if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
//# sourceMappingURL=game-db-support-memory-candidate.js.map