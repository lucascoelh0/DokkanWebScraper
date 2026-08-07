"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = require("fs/promises");
const path_1 = require("path");
const artifact_1 = require("./artifact");
const source_1 = require("./source");
const taxonomy_builder_1 = require("./taxonomy-builder");
const taxonomy_validator_1 = require("./taxonomy-validator");
function arg(name) { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]; }
async function run() {
    const inputDir = arg("--input-dir");
    const database = arg("--database");
    if (!inputDir || !database)
        throw new Error("--input-dir and --database are required");
    const outputDir = (0, path_1.resolve)(arg("--output-dir") ?? "data/database-characters/k2");
    let peakRssBytes = process.memoryUsage().rss;
    const timer = setInterval(() => peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss), 25);
    try {
        const source = await (0, source_1.readCharacterSourceInput)(inputDir);
        const linkLevels = await (0, source_1.readPinnedDatabaseTable)(database, "link_skill_lvs", ["id", "link_skill_id", "skill_lv", "description", "created_at", "updated_at"]);
        const linkEfficacies = await (0, source_1.readPinnedDatabaseTable)(database, "link_skill_efficacies", ["id", "link_skill_lv_id", "link_check_type", "efficacy_type", "target_type", "sub_target_type_set_id", "calc_option", "turn", "lnk_value1", "lnk_value2", "lnk_value3", "eff_value1", "eff_value2", "eff_value3", "created_at", "updated_at"]);
        await (0, source_1.assertPinnedDatabaseFile)(database);
        const build = () => (0, taxonomy_builder_1.buildDatabaseCharacterTaxonomyDataset)({ source, linkLevels, linkEfficacies });
        const dataset = await build();
        const coverage = (0, taxonomy_builder_1.buildDatabaseCharacterTaxonomyCoverage)(dataset);
        const validation = (0, taxonomy_validator_1.validateDatabaseCharacterTaxonomyDataset)(dataset, coverage);
        if (!validation.valid)
            throw new Error(validation.failures.join("; "));
        const artifact = (0, artifact_1.buildDeterministicJsonGzipArtifact)(dataset);
        const second = (0, artifact_1.buildDeterministicJsonGzipArtifact)(await build());
        if (!artifact.gzip.equals(second.gzip))
            throw new Error("K2 two-generation byte identity failed");
        await (0, source_1.assertPinnedDatabaseFile)(database);
        const coverageBytes = `${JSON.stringify(coverage, null, 2)}\n`;
        const validationBytes = `${JSON.stringify(validation, null, 2)}\n`;
        const manifest = { schemaVersion: 1, contractVersion: "1.0.0", generatedAt: source.generatedAt, fileName: "database-characters-k2-taxonomy.json.gz", compression: "gzip", sha256: artifact.sha256, sizeBytes: artifact.gzip.length, uncompressedSizeBytes: artifact.json.length,
            sourceSnapshotVersion: source.snapshotVersion, sourceDatabaseSha256: source.databaseSha256, sourceDb1ArtifactSha256: source.artifactSha256,
            coverageFile: "database-characters-k2-coverage.json", coverageSha256: (0, artifact_1.sha256Bytes)(coverageBytes), coverageSizeBytes: Buffer.byteLength(coverageBytes), validationFile: "database-characters-k2-validation.json", validationSha256: (0, artifact_1.sha256Bytes)(validationBytes), validationSizeBytes: Buffer.byteLength(validationBytes) };
        await (0, promises_1.mkdir)(outputDir, { recursive: true });
        await Promise.all([(0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.fileName), artifact.gzip), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, "database-characters-k2-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.coverageFile), coverageBytes), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.validationFile), validationBytes)]);
        peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss);
        console.log(JSON.stringify({ outputDir, manifest, coverage, twoGenerationByteIdentical: true, peakRssBytes }, null, 2));
    }
    finally {
        clearInterval(timer);
    }
}
if (require.main === module)
    run().catch(error => { console.error(error); process.exitCode = 1; });
//# sourceMappingURL=k2-run.js.map