"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseSupportMemoryCandidateArgs = void 0;
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const zlib_1 = require("zlib");
const format_json_1 = require("../format-json");
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
    const required = ["--source-data-dir", "--source-snapshot-version", "--source-database-sha256", "--previous-dataset", "--characters", "--output-dir"];
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
        previousDatasetPath: (0, path_1.resolve)(values.get("--previous-dataset")),
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
async function main() {
    const options = parseSupportMemoryCandidateArgs(process.argv.slice(2));
    const previousDataset = JSON.parse(await (0, promises_1.readFile)(options.previousDatasetPath, "utf8"));
    const characterBuffer = await (0, promises_1.readFile)(options.charactersPath);
    const characterJson = JSON.parse(options.charactersPath.endsWith(".gz") ? (0, zlib_1.gunzipSync)(characterBuffer).toString("utf8") : characterBuffer.toString("utf8"));
    const characters = Array.isArray(characterJson) ? characterJson : characterJson.characters;
    if (!Array.isArray(characters) || characters.some(character => typeof character?.id !== "string")) {
        throw new Error("Support Memory candidate character artifact is invalid");
    }
    const consumerCharacterIds = new Set(characters.map(character => character.id));
    if (consumerCharacterIds.size !== characters.length)
        throw new Error("Support Memory candidate character artifact contains duplicate IDs");
    const candidate = (0, game_db_support_memory_1.buildSupportMemoryFirstPartyCandidate)({
        generatedAt: options.generatedAt,
        sourceSnapshotVersion: options.sourceSnapshotVersion,
        sourceDatabaseSha256: options.sourceDatabaseSha256,
        tables: await loadTables(options.sourceDataDir),
        previousDataset,
        consumerCharacterIds,
    });
    await (0, promises_1.mkdir)((0, path_1.dirname)(options.outputDir), { recursive: true });
    try {
        await (0, promises_1.mkdir)(options.outputDir);
    }
    catch {
        throw new Error(`Support Memory candidate output must not already exist: ${options.outputDir}`);
    }
    const detailsPath = (0, path_1.resolve)(options.outputDir, "support-memory-details.json");
    const auditPath = (0, path_1.resolve)(options.outputDir, "support-memory-first-party-audit.json");
    await (0, format_json_1.writeFormattedJson)(detailsPath, candidate.dataset);
    await (0, format_json_1.writeFormattedJson)(auditPath, candidate.audit);
    const details = await (0, promises_1.readFile)(detailsPath);
    const audit = await (0, promises_1.readFile)(auditPath);
    await (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, "candidate-manifest.json"), `${JSON.stringify({
        schemaVersion: 1,
        generatedAt: options.generatedAt,
        sourceSnapshotVersion: options.sourceSnapshotVersion,
        sourceDatabaseSha256: options.sourceDatabaseSha256,
        supportMemoryCount: candidate.dataset.count,
        files: [
            { name: "support-memory-details.json", sizeBytes: details.byteLength, sha256: (0, crypto_1.createHash)("sha256").update(details).digest("hex") },
            { name: "support-memory-first-party-audit.json", sizeBytes: audit.byteLength, sha256: (0, crypto_1.createHash)("sha256").update(audit).digest("hex") },
        ],
    }, null, 2)}\n`, { encoding: "utf8", flag: "w" });
    console.log(JSON.stringify({
        outputDir: options.outputDir,
        supportMemoryCount: candidate.dataset.count,
        compatibility: candidate.audit.compatibility,
        counts: candidate.audit.counts,
    }, null, 2));
}
if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
//# sourceMappingURL=game-db-support-memory-candidate.js.map