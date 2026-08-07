"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = require("fs/promises");
const path_1 = require("path");
const artifact_1 = require("./artifact");
const progression_builder_1 = require("./progression-builder");
const progression_validator_1 = require("./progression-validator");
const source_1 = require("./source");
const COLUMNS = {
    card_awakening_routes: ["id", "type", "card_id", "awaked_card_id", "num", "card_awakening_set_id", "optimal_awakening_step", "optimal_awakening_type", "description", "priority", "open_at", "created_at", "updated_at"],
    card_awakening_sets: ["id", "name", "description", "created_at", "updated_at"], card_awakenings: ["id", "num", "awakening_item_id", "quantity", "card_awakening_set_id", "created_at", "updated_at"], awakening_items: ["id", "name", "description", "zeni", "rarity", "selling_exchange_point", "event_jumpable", "created_at", "updated_at"],
    card_growths: ["id", "grow_type", "lv", "coef", "created_at", "updated_at"], card_exps: ["id", "lv", "exp_type", "exp_total", "created_at", "updated_at"], optimal_awakening_growths: ["id", "optimal_awakening_grow_type", "step", "lv_max", "skill_lv_max", "passive_skill_set_id", "leader_skill_set_id"],
    potential_boards: ["id", "comment", "created_at", "updated_at"], potential_squares: ["id", "potential_board_id", "event_id", "condition_set_id", "is_locked", "route", "created_at", "updated_at"], potential_square_relations: ["id", "potential_square_id", "prev_potential_square_id", "created_at", "updated_at"], potential_events: ["id", "type", "currency_id", "additional_value", "created_at", "updated_at"], potential_square_condition_sets: ["id", "comment", "created_at", "updated_at"], potential_square_condition_set_relations: ["id", "condition_set_id", "condition_id", "created_at", "updated_at"], potential_square_conditions: ["id", "type", "conditions", "comment", "created_at", "updated_at"], potential_skills: ["id", "name", "description", "exec_timing_type", "efficacy_type", "target_type", "calc_option", "turn", "is_once", "probability", "causality_conditions", "eff_value1", "eff_value2", "eff_value3", "variable_column", "created_at", "updated_at"], potential_skill_lv_values: ["id", "potential_skill_id", "lv", "value", "created_at", "updated_at"],
    equipment_skill_items: ["id", "name", "description", "grade", "selling_exchange_point", "hp", "attack", "defense", "equipment_skill_limitation_set_id", "icon_image_id", "is_eternal", "created_at", "updated_at"], equipment_skill_limitations: ["id", "equipment_skill_limitation_set_id", "type", "conditions", "created_at", "updated_at"], equipment_skills: ["id", "equipment_skill_item_id", "potential_skill_id", "status_type", "level", "created_at", "updated_at"],
};
function arg(name) { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]; }
async function run() {
    const inputDir = arg("--input-dir"), database = arg("--database");
    if (!inputDir || !database)
        throw new Error("--input-dir and --database are required");
    const outputDir = (0, path_1.resolve)(arg("--output-dir") ?? "data/database-characters/k4");
    let peakRssBytes = process.memoryUsage().rss;
    const timer = setInterval(() => peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss), 25);
    try {
        const source = await (0, source_1.readCharacterSourceInput)(inputDir), tables = {};
        for (const [table, columns] of Object.entries(COLUMNS))
            tables[table] = await (0, source_1.readPinnedDatabaseTable)(database, table, columns);
        await (0, source_1.assertPinnedDatabaseFile)(database);
        const generate = async () => { const dataset = await (0, progression_builder_1.buildDatabaseCharacterProgressionDataset)(source, tables), coverage = (0, progression_builder_1.buildDatabaseCharacterProgressionCoverage)(dataset), validation = (0, progression_validator_1.validateDatabaseCharacterProgressionDataset)(dataset, coverage); if (!validation.valid)
            throw new Error(`${validation.failures.join("; ")} coverage=${JSON.stringify(coverage)}`); return { artifact: (0, artifact_1.buildDeterministicJsonGzipArtifact)(dataset), coverage, validation }; };
        const first = await generate(), second = await generate();
        if (!first.artifact.gzip.equals(second.artifact.gzip))
            throw new Error("K4 two-generation byte identity failed");
        await (0, source_1.assertPinnedArtifactFile)(source.artifactPath, { sha256: source.artifactSha256, sizeBytes: source.artifactSizeBytes });
        await (0, source_1.assertPinnedDatabaseFile)(database);
        const coverageBytes = `${JSON.stringify(first.coverage, null, 2)}\n`, validationBytes = `${JSON.stringify(first.validation, null, 2)}\n`;
        const manifest = { schemaVersion: 1, contractVersion: "1.0.0", generatedAt: source.generatedAt, fileName: "database-characters-k4-progression.json.gz", compression: "gzip", sha256: first.artifact.sha256, sizeBytes: first.artifact.gzip.length, uncompressedSizeBytes: first.artifact.json.length, sourceSnapshotVersion: source.snapshotVersion, sourceDatabaseSha256: source.databaseSha256, sourceDb1ArtifactSha256: source.artifactSha256, consumedTables: Object.keys(COLUMNS), coverageFile: "database-characters-k4-coverage.json", coverageSha256: (0, artifact_1.sha256Bytes)(coverageBytes), coverageSizeBytes: Buffer.byteLength(coverageBytes), validationFile: "database-characters-k4-validation.json", validationSha256: (0, artifact_1.sha256Bytes)(validationBytes), validationSizeBytes: Buffer.byteLength(validationBytes) };
        peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss);
        if (peakRssBytes >= 1073741824)
            throw new Error(`K4 exceeded 1 GiB RSS ceiling: ${peakRssBytes}`);
        await (0, promises_1.mkdir)(outputDir, { recursive: true });
        await Promise.all([(0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.fileName), first.artifact.gzip), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, "database-characters-k4-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.coverageFile), coverageBytes), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.validationFile), validationBytes)]);
        console.log(JSON.stringify({ outputDir, manifest, coverage: first.coverage, twoGenerationByteIdentical: true, peakRssBytes }, null, 2));
    }
    finally {
        clearInterval(timer);
    }
}
if (require.main === module)
    run().catch(error => { console.error(error); process.exitCode = 1; });
//# sourceMappingURL=k4-run.js.map