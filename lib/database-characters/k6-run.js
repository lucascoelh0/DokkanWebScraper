"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = require("fs/promises");
const path_1 = require("path");
const assets_builder_1 = require("./assets-builder");
const assets_validator_1 = require("./assets-validator");
const artifact_1 = require("./artifact");
const source_1 = require("./source");
const COLUMNS = {
    card_motions: ["id", "card_id", "category", "filename", "created_at", "updated_at"], card_specials: ["id", "card_id", "special_set_id", "priority", "style", "lv_start", "view_id", "special_asset_id", "created_at", "updated_at"], special_views: ["id", "script_name", "cut_in_card_id", "special_name_no", "special_motion", "special_category_id", "created_at", "updated_at"],
    card_active_skills: ["id", "card_id", "active_skill_set_id", "created_at", "updated_at"], active_skill_sets: ["id", "ultimate_special_id", "special_view_id", "costume_special_view_id", "bgm_id", "created_at", "updated_at"], card_standby_skill_set_relations: ["id", "card_id", "standby_skill_set_id", "created_at", "updated_at"], standby_skill_sets: ["id", "ingame_icon_path", "special_view_id", "costume_special_view_id", "bgm_id", "created_at", "updated_at"], card_finish_skill_set_relations: ["id", "card_id", "finish_skill_set_id", "created_at", "updated_at"], finish_skill_sets: ["id", "finish_special_id", "special_view_id", "costume_special_view_id", "bgm_id", "created_at", "updated_at"],
    transformation_views: ["id", "begin_script_name", "end_script_name", "created_at", "updated_at"], metamorphic_views: ["id", "begin_script_name", "continue_script_name", "end_script_name", "created_at", "updated_at"], revival_views: ["id", "effect_pack_id", "script_name", "created_at", "updated_at"],
};
function arg(name) { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]; }
async function run() {
    const inputDir = arg("--input-dir"), database = arg("--database");
    if (!inputDir || !database)
        throw new Error("--input-dir and --database are required");
    const outputDir = (0, path_1.resolve)(arg("--output-dir") ?? "data/database-characters/k6");
    let peakRssBytes = process.memoryUsage().rss;
    const timer = setInterval(() => peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss), 25);
    try {
        const source = await (0, source_1.readCharacterSourceInput)(inputDir), tables = {};
        for (const [table, columns] of Object.entries(COLUMNS))
            tables[table] = await (0, source_1.readPinnedDatabaseTable)(database, table, columns);
        await (0, source_1.assertPinnedDatabaseFile)(database);
        const generate = async () => { const dataset = await (0, assets_builder_1.buildDatabaseCharacterAssetsDataset)(source, tables), coverage = (0, assets_builder_1.buildDatabaseCharacterAssetsCoverage)(dataset), validation = (0, assets_validator_1.validateDatabaseCharacterAssetsDataset)(dataset, coverage); if (!validation.valid)
            throw new Error(`${validation.failures.join("; ")} coverage=${JSON.stringify(coverage)}`); return { artifact: (0, artifact_1.buildDeterministicJsonGzipArtifact)(dataset), coverage, validation }; };
        const first = await generate(), second = await generate();
        if (!first.artifact.gzip.equals(second.artifact.gzip))
            throw new Error("K6 two-generation byte identity failed");
        await (0, source_1.assertPinnedArtifactFile)(source.artifactPath, { sha256: source.artifactSha256, sizeBytes: source.artifactSizeBytes });
        await (0, source_1.assertPinnedDatabaseFile)(database);
        const coverageBytes = `${JSON.stringify(first.coverage, null, 2)}\n`, validationBytes = `${JSON.stringify(first.validation, null, 2)}\n`;
        const manifest = { schemaVersion: 1, contractVersion: "1.0.0", generatedAt: source.generatedAt, fileName: "database-characters-k6-assets.json.gz", compression: "gzip", sha256: first.artifact.sha256, sizeBytes: first.artifact.gzip.length, uncompressedSizeBytes: first.artifact.json.length, sourceSnapshotVersion: source.snapshotVersion, sourceDatabaseSha256: source.databaseSha256, sourceDb1ArtifactSha256: source.artifactSha256, consumedTables: Object.keys(COLUMNS), coverageFile: "database-characters-k6-coverage.json", coverageSha256: (0, artifact_1.sha256Bytes)(coverageBytes), coverageSizeBytes: Buffer.byteLength(coverageBytes), validationFile: "database-characters-k6-validation.json", validationSha256: (0, artifact_1.sha256Bytes)(validationBytes), validationSizeBytes: Buffer.byteLength(validationBytes) };
        peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss);
        if (peakRssBytes >= 1073741824)
            throw new Error(`K6 exceeded 1 GiB RSS ceiling: ${peakRssBytes}`);
        await (0, promises_1.mkdir)(outputDir, { recursive: true });
        await Promise.all([(0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.fileName), first.artifact.gzip), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, "database-characters-k6-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.coverageFile), coverageBytes), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.validationFile), validationBytes)]);
        console.log(JSON.stringify({ outputDir, manifest, coverage: first.coverage, twoGenerationByteIdentical: true, peakRssBytes }, null, 2));
    }
    finally {
        clearInterval(timer);
    }
}
if (require.main === module)
    run().catch(error => { console.error(error); process.exitCode = 1; });
//# sourceMappingURL=k6-run.js.map