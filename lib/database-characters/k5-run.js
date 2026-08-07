"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = require("fs/promises");
const path_1 = require("path");
const artifact_1 = require("./artifact");
const acquisition_builder_1 = require("./acquisition-builder");
const acquisition_validator_1 = require("./acquisition-validator");
const source_1 = require("./source");
const COLUMNS = {
    collection_cards: ["id", "collection_unique_id", "card_id", "event_id", "priority", "created_at", "updated_at"], quests: ["id", "area_id", "name", "prev_quest_id", "created_at", "updated_at"], sugoroku_map_boss_drop_items: ["id", "sugoroku_map_id", "quest_id", "drop_type", "item_id", "item_type", "card_exp_init", "created_at", "updated_at"], quest_drop_item_views: ["id", "quest_id", "difficulties", "item1_id", "item1_type", "item2_id", "item2_type", "item3_id", "item3_type", "item4_id", "item4_type", "item5_id", "item5_type", "item6_id", "item6_type", "created_at", "updated_at"],
    training_fields: ["id", "level_bg_id", "name", "description", "rarity", "zeni", "exp", "elements", "multiplier", "addend", "card_training_field_exp_up_prob_id", "created_at", "updated_at"], training_items: ["id", "name", "description", "element", "exp", "rarity", "zeni_to_use", "created_at", "updated_at"], card_training_field_exp_up_probs: ["id", "key", "effect", "success_prob_percent", "created_at", "updated_at"], card_training_skill_lv_up_probs: ["id", "rarity", "n", "r", "sr", "ssr", "ur", "lr"], card_training_skill_lvs: ["id", "card_id", "skill_lv", "condition", "probability", "created_at", "updated_at"], item_card_properties: ["id", "card_id", "exp", "created_at", "updated_at"],
};
function arg(name) { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]; }
async function run() {
    const inputDir = arg("--input-dir"), database = arg("--database");
    if (!inputDir || !database)
        throw new Error("--input-dir and --database are required");
    const outputDir = (0, path_1.resolve)(arg("--output-dir") ?? "data/database-characters/k5");
    let peakRssBytes = process.memoryUsage().rss;
    const timer = setInterval(() => peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss), 25);
    try {
        const source = await (0, source_1.readCharacterSourceInput)(inputDir), tables = {};
        for (const [table, columns] of Object.entries(COLUMNS))
            tables[table] = await (0, source_1.readPinnedDatabaseTable)(database, table, columns);
        await (0, source_1.assertPinnedDatabaseFile)(database);
        const generate = async () => { const dataset = await (0, acquisition_builder_1.buildDatabaseCharacterAcquisitionDataset)(source, tables), coverage = (0, acquisition_builder_1.buildDatabaseCharacterAcquisitionCoverage)(dataset), validation = (0, acquisition_validator_1.validateDatabaseCharacterAcquisitionDataset)(dataset, coverage); if (!validation.valid)
            throw new Error(`${validation.failures.join("; ")} coverage=${JSON.stringify(coverage)}`); return { artifact: (0, artifact_1.buildDeterministicJsonGzipArtifact)(dataset), coverage, validation }; };
        const first = await generate(), second = await generate();
        if (!first.artifact.gzip.equals(second.artifact.gzip))
            throw new Error("K5 two-generation byte identity failed");
        await (0, source_1.assertPinnedArtifactFile)(source.artifactPath, { sha256: source.artifactSha256, sizeBytes: source.artifactSizeBytes });
        await (0, source_1.assertPinnedDatabaseFile)(database);
        const coverageBytes = `${JSON.stringify(first.coverage, null, 2)}\n`, validationBytes = `${JSON.stringify(first.validation, null, 2)}\n`;
        const manifest = { schemaVersion: 1, contractVersion: "1.0.0", generatedAt: source.generatedAt, fileName: "database-characters-k5-acquisition.json.gz", compression: "gzip", sha256: first.artifact.sha256, sizeBytes: first.artifact.gzip.length, uncompressedSizeBytes: first.artifact.json.length, sourceSnapshotVersion: source.snapshotVersion, sourceDatabaseSha256: source.databaseSha256, sourceDb1ArtifactSha256: source.artifactSha256, consumedTables: Object.keys(COLUMNS), coverageFile: "database-characters-k5-coverage.json", coverageSha256: (0, artifact_1.sha256Bytes)(coverageBytes), coverageSizeBytes: Buffer.byteLength(coverageBytes), validationFile: "database-characters-k5-validation.json", validationSha256: (0, artifact_1.sha256Bytes)(validationBytes), validationSizeBytes: Buffer.byteLength(validationBytes) };
        peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss);
        if (peakRssBytes >= 1073741824)
            throw new Error(`K5 exceeded 1 GiB RSS ceiling: ${peakRssBytes}`);
        await (0, promises_1.mkdir)(outputDir, { recursive: true });
        await Promise.all([(0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.fileName), first.artifact.gzip), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, "database-characters-k5-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.coverageFile), coverageBytes), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.validationFile), validationBytes)]);
        console.log(JSON.stringify({ outputDir, manifest, coverage: first.coverage, twoGenerationByteIdentical: true, peakRssBytes }, null, 2));
    }
    finally {
        clearInterval(timer);
    }
}
if (require.main === module)
    run().catch(error => { console.error(error); process.exitCode = 1; });
//# sourceMappingURL=k5-run.js.map