"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runDatabaseTeamAnalysisDb50 = void 0;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const zlib_1 = require("zlib");
const native_runtime_elf_adapter_1 = require("./native-runtime-elf-adapter");
const team_analysis_db50_builder_1 = require("./team-analysis-db50-builder");
const team_analysis_db50_golden_1 = require("./team-analysis-db50-golden");
const team_analysis_db50_report_1 = require("./team-analysis-db50-report");
const team_analysis_db50_validator_1 = require("./team-analysis-db50-validator");
const DEFAULT_DATABASE = "D:\\Dokkan\\database\\decrypted\\dokkan-global-current.db";
const DEFAULT_NATIVE_RUNTIME = "D:\\Dokkan\\database\\apk\\extracted\\lib\\arm64-v8a\\libcocos2dcpp.so";
const DEFAULT_OUTPUT = (0, path_1.resolve)(process.cwd(), "data", "database-experiment");
const sha256 = (value) => (0, crypto_1.createHash)("sha256").update(value).digest("hex");
async function fingerprint(path) {
    const metadata = await (0, promises_1.stat)(path), hash = (0, crypto_1.createHash)("sha256");
    await new Promise((resolvePromise, reject) => { const stream = (0, fs_1.createReadStream)(path); stream.on("data", chunk => hash.update(chunk)); stream.on("error", reject); stream.on("end", resolvePromise); });
    return { sha256: hash.digest("hex"), sizeBytes: metadata.size, modifiedAtMs: metadata.mtimeMs };
}
async function readArtifact(path) {
    const gzip = await (0, promises_1.readFile)(path);
    return { dataset: JSON.parse((0, zlib_1.gunzipSync)(gzip).toString("utf8")), gzip, sha256: sha256(gzip) };
}
async function runDatabaseTeamAnalysisDb50(options = {}) {
    const databasePath = options.databasePath ?? DEFAULT_DATABASE, nativeRuntimePath = options.nativeRuntimePath ?? DEFAULT_NATIVE_RUNTIME, outputDir = options.outputDir ?? DEFAULT_OUTPUT;
    const databaseBefore = await fingerprint(databasePath), nativeBefore = await fingerprint(nativeRuntimePath);
    const db24 = await readArtifact((0, path_1.resolve)(outputDir, "team-analysis-db24-counter-behavior.json.gz"));
    const db35 = await readArtifact((0, path_1.resolve)(outputDir, "team-analysis-db35-target-dispatch.json.gz"));
    const db47 = await readArtifact((0, path_1.resolve)(outputDir, "team-analysis-db47-puzzle-move-end-timing.json.gz"));
    const evidencePath = (0, fs_1.existsSync)((0, path_1.resolve)(__dirname, "native-counter-consumer-semantics.json")) ? (0, path_1.resolve)(__dirname, "native-counter-consumer-semantics.json") : (0, path_1.resolve)(__dirname, "..", "..", "database-experiment", "native-counter-consumer-semantics.json");
    const evidenceBytes = await (0, promises_1.readFile)(evidencePath), evidence = JSON.parse(evidenceBytes.toString("utf8")), evidenceSha256 = sha256(evidenceBytes);
    const inspection = await (0, native_runtime_elf_adapter_1.inspectNativeRuntimeElf)(nativeRuntimePath);
    const build = () => (0, team_analysis_db50_builder_1.buildDatabaseTeamAnalysisDb50Dataset)({ db24: db24.dataset, db24Sha256: db24.sha256, db35: db35.dataset, db35Sha256: db35.sha256, db47: db47.dataset, db47Sha256: db47.sha256, inspection, nativeSha256: nativeBefore.sha256, nativeSizeBytes: nativeBefore.sizeBytes, evidence, evidenceSha256 });
    const dataset = build(), firstJson = `${JSON.stringify(dataset)}\n`, secondJson = `${JSON.stringify(build())}\n`, firstGzip = (0, zlib_1.gzipSync)(Buffer.from(firstJson, "utf8"), { level: 9 }), secondGzip = (0, zlib_1.gzipSync)(Buffer.from(secondJson, "utf8"), { level: 9 });
    if (sha256(firstJson) !== sha256(secondJson) || !firstGzip.equals(secondGzip))
        throw Error("DB50 focused determinism check failed");
    const validation = (0, team_analysis_db50_validator_1.validateDatabaseTeamAnalysisDb50Dataset)(dataset, db24.dataset, db35.dataset, db47.dataset, { db24Sha256: db24.sha256, db35Sha256: db35.sha256, db47Sha256: db47.sha256, nativeSha256: nativeBefore.sha256, nativeSizeBytes: nativeBefore.sizeBytes, evidenceSha256, proofRoles: evidence.codeRegions.map(value => value.role) });
    if (!validation.valid)
        throw Error(`DB50 focused validation failed: ${JSON.stringify(validation.failures.slice(0, 10))}`);
    const coverage = (0, team_analysis_db50_builder_1.buildDatabaseTeamAnalysisDb50Coverage)(dataset), goldens = await (0, team_analysis_db50_golden_1.validateDatabaseTeamAnalysisDb50Goldens)(dataset, coverage);
    if (goldens.failures.length)
        throw Error(`DB50 focused goldens failed: ${JSON.stringify(goldens.failures)}`);
    const report = (0, team_analysis_db50_report_1.renderDatabaseTeamAnalysisDb50Report)(coverage);
    const manifest = { schemaVersion: 1, contractVersion: "0.49.0", generatedAt: dataset.generatedAt, fileName: "team-analysis-db50-counter-consumer.json.gz", compression: "gzip", sha256: sha256(firstGzip), sizeBytes: firstGzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstJson, "utf8"), ruleCount: coverage.ruleCount, affectedStateCount: coverage.affectedStateCount, inheritedSemanticPromotionCount: 76, semanticPromotionCount: 6, sourceDatabaseSha256: databaseBefore.sha256, sourceDb24Sha256: db24.sha256, sourceDb35Sha256: db35.sha256, sourceDb47Sha256: db47.sha256, nativeRuntimeSha256: nativeBefore.sha256, nativeEvidenceSha256: evidenceSha256, coverageFile: "team-analysis-db50-coverage.json", reportFile: "team-analysis-db50-report.md", validationFile: "team-analysis-db50-validation.json", goldenValidationFile: "team-analysis-db50-golden-validation.json" };
    const databaseAfter = await fingerprint(databasePath), nativeAfter = await fingerprint(nativeRuntimePath);
    if (JSON.stringify(databaseAfter) !== JSON.stringify(databaseBefore))
        throw Error("DB50 focused read-only SQLite guarantee failed");
    if (JSON.stringify(nativeAfter) !== JSON.stringify(nativeBefore))
        throw Error("DB50 focused read-only ELF guarantee failed");
    await (0, promises_1.mkdir)(outputDir, { recursive: true });
    await Promise.all([
        (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.fileName), firstGzip),
        (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, "team-analysis-db50-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`),
        (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.coverageFile), `${JSON.stringify(coverage, null, 2)}\n`),
        (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.reportFile), report),
        (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.validationFile), `${JSON.stringify(validation, null, 2)}\n`),
        (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.goldenValidationFile), `${JSON.stringify(goldens, null, 2)}\n`),
    ]);
    return { manifest, validation, goldens, deterministicJsonSha256: sha256(secondJson), sourceDatabase: databaseAfter, nativeRuntime: nativeAfter };
}
exports.runDatabaseTeamAnalysisDb50 = runDatabaseTeamAnalysisDb50;
if (require.main === module)
    runDatabaseTeamAnalysisDb50().then(result => console.log(JSON.stringify(result, null, 2))).catch(error => { console.error(error); process.exitCode = 1; });
//# sourceMappingURL=team-analysis-db50-run.js.map