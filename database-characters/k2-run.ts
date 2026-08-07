import { mkdir, writeFile } from "fs/promises";
import { resolve } from "path";
import { buildDeterministicJsonGzipArtifact, sha256Bytes } from "./artifact";
import { assertPinnedDatabaseFile, readCharacterSourceInput, readPinnedDatabaseTable } from "./source";
import { buildDatabaseCharacterTaxonomyCoverage, buildDatabaseCharacterTaxonomyDataset } from "./taxonomy-builder";
import { validateDatabaseCharacterTaxonomyDataset } from "./taxonomy-validator";

function arg(name: string): string | undefined { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]; }
async function run() {
    const inputDir = arg("--input-dir"); const database = arg("--database");
    if (!inputDir || !database) throw new Error("--input-dir and --database are required");
    const outputDir = resolve(arg("--output-dir") ?? "data/database-characters/k2");
    let peakRssBytes = process.memoryUsage().rss; const timer = setInterval(() => peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss), 25);
    try {
        const source = await readCharacterSourceInput(inputDir);
        const linkLevels = await readPinnedDatabaseTable(database, "link_skill_lvs", ["id", "link_skill_id", "skill_lv", "description", "created_at", "updated_at"]);
        const linkEfficacies = await readPinnedDatabaseTable(database, "link_skill_efficacies", ["id", "link_skill_lv_id", "link_check_type", "efficacy_type", "target_type", "sub_target_type_set_id", "calc_option", "turn", "lnk_value1", "lnk_value2", "lnk_value3", "eff_value1", "eff_value2", "eff_value3", "created_at", "updated_at"]);
        await assertPinnedDatabaseFile(database);
        const build = () => buildDatabaseCharacterTaxonomyDataset({ source, linkLevels, linkEfficacies });
        const dataset = await build(); const coverage = buildDatabaseCharacterTaxonomyCoverage(dataset); const validation = validateDatabaseCharacterTaxonomyDataset(dataset, coverage);
        if (!validation.valid) throw new Error(validation.failures.join("; "));
        const artifact = buildDeterministicJsonGzipArtifact(dataset); const second = buildDeterministicJsonGzipArtifact(await build());
        if (!artifact.gzip.equals(second.gzip)) throw new Error("K2 two-generation byte identity failed");
        await assertPinnedDatabaseFile(database);
        const coverageBytes = `${JSON.stringify(coverage, null, 2)}\n`; const validationBytes = `${JSON.stringify(validation, null, 2)}\n`;
        const manifest = { schemaVersion: 1, contractVersion: "1.0.0", generatedAt: source.generatedAt, fileName: "database-characters-k2-taxonomy.json.gz", compression: "gzip", sha256: artifact.sha256, sizeBytes: artifact.gzip.length, uncompressedSizeBytes: artifact.json.length,
            sourceSnapshotVersion: source.snapshotVersion, sourceDatabaseSha256: source.databaseSha256, sourceDb1ArtifactSha256: source.artifactSha256,
            coverageFile: "database-characters-k2-coverage.json", coverageSha256: sha256Bytes(coverageBytes), coverageSizeBytes: Buffer.byteLength(coverageBytes), validationFile: "database-characters-k2-validation.json", validationSha256: sha256Bytes(validationBytes), validationSizeBytes: Buffer.byteLength(validationBytes) };
        await mkdir(outputDir, { recursive: true }); await Promise.all([writeFile(resolve(outputDir, manifest.fileName), artifact.gzip), writeFile(resolve(outputDir, "database-characters-k2-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`), writeFile(resolve(outputDir, manifest.coverageFile), coverageBytes), writeFile(resolve(outputDir, manifest.validationFile), validationBytes)]);
        peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss); console.log(JSON.stringify({ outputDir, manifest, coverage, twoGenerationByteIdentical: true, peakRssBytes }, null, 2));
    } finally { clearInterval(timer); }
}
if (require.main === module) run().catch(error => { console.error(error); process.exitCode = 1; });
