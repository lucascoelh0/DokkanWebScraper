import { createHash } from "crypto";
import { createReadStream, existsSync } from "fs";
import { mkdir, readFile, stat, writeFile } from "fs/promises";
import { resolve } from "path";
import { gunzipSync, gzipSync } from "zlib";
import { inspectNativeRuntimeElf } from "./native-runtime-elf-adapter";
import { buildDatabaseTeamAnalysisDb50Coverage, buildDatabaseTeamAnalysisDb50Dataset } from "./team-analysis-db50-builder";
import { DatabaseTeamAnalysisDb24Dataset } from "./team-analysis-db24-contract";
import { DatabaseTeamAnalysisDb35Dataset } from "./team-analysis-db35-contract";
import { DatabaseTeamAnalysisDb47Dataset } from "./team-analysis-db47-contract";
import { DatabaseTeamAnalysisDb50Manifest, Db50Evidence } from "./team-analysis-db50-contract";
import { validateDatabaseTeamAnalysisDb50Goldens } from "./team-analysis-db50-golden";
import { renderDatabaseTeamAnalysisDb50Report } from "./team-analysis-db50-report";
import { validateDatabaseTeamAnalysisDb50Dataset } from "./team-analysis-db50-validator";

const DEFAULT_DATABASE = "D:\\Dokkan\\database\\decrypted\\dokkan-global-current.db";
const DEFAULT_NATIVE_RUNTIME = "D:\\Dokkan\\database\\apk\\extracted\\lib\\arm64-v8a\\libcocos2dcpp.so";
const DEFAULT_OUTPUT = resolve(process.cwd(), "data", "database-experiment");
const sha256 = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");
async function fingerprint(path: string) {
    const metadata = await stat(path), hash = createHash("sha256");
    await new Promise<void>((resolvePromise, reject) => { const stream = createReadStream(path); stream.on("data", chunk => hash.update(chunk)); stream.on("error", reject); stream.on("end", resolvePromise); });
    return { sha256: hash.digest("hex"), sizeBytes: metadata.size, modifiedAtMs: metadata.mtimeMs };
}
async function readArtifact<T>(path: string): Promise<{ dataset: T; gzip: Buffer; sha256: string }> {
    const gzip = await readFile(path);
    return { dataset: JSON.parse(gunzipSync(gzip).toString("utf8")) as T, gzip, sha256: sha256(gzip) };
}

export async function runDatabaseTeamAnalysisDb50(options: { databasePath?: string; nativeRuntimePath?: string; outputDir?: string } = {}) {
    const databasePath = options.databasePath ?? DEFAULT_DATABASE, nativeRuntimePath = options.nativeRuntimePath ?? DEFAULT_NATIVE_RUNTIME, outputDir = options.outputDir ?? DEFAULT_OUTPUT;
    const databaseBefore = await fingerprint(databasePath), nativeBefore = await fingerprint(nativeRuntimePath);
    const db24 = await readArtifact<DatabaseTeamAnalysisDb24Dataset>(resolve(outputDir, "team-analysis-db24-counter-behavior.json.gz"));
    const db35 = await readArtifact<DatabaseTeamAnalysisDb35Dataset>(resolve(outputDir, "team-analysis-db35-target-dispatch.json.gz"));
    const db47 = await readArtifact<DatabaseTeamAnalysisDb47Dataset>(resolve(outputDir, "team-analysis-db47-puzzle-move-end-timing.json.gz"));
    const evidencePath = existsSync(resolve(__dirname, "native-counter-consumer-semantics.json")) ? resolve(__dirname, "native-counter-consumer-semantics.json") : resolve(__dirname, "..", "..", "database-experiment", "native-counter-consumer-semantics.json");
    const evidenceBytes = await readFile(evidencePath), evidence = JSON.parse(evidenceBytes.toString("utf8")) as Db50Evidence, evidenceSha256 = sha256(evidenceBytes);
    const inspection = await inspectNativeRuntimeElf(nativeRuntimePath);
    const build = () => buildDatabaseTeamAnalysisDb50Dataset({ db24: db24.dataset, db24Sha256: db24.sha256, db35: db35.dataset, db35Sha256: db35.sha256, db47: db47.dataset, db47Sha256: db47.sha256, inspection, nativeSha256: nativeBefore.sha256, nativeSizeBytes: nativeBefore.sizeBytes, evidence, evidenceSha256 });
    const dataset = build(), firstJson = `${JSON.stringify(dataset)}\n`, secondJson = `${JSON.stringify(build())}\n`, firstGzip = gzipSync(Buffer.from(firstJson, "utf8"), { level: 9 }), secondGzip = gzipSync(Buffer.from(secondJson, "utf8"), { level: 9 });
    if (sha256(firstJson) !== sha256(secondJson) || !firstGzip.equals(secondGzip)) throw Error("DB50 focused determinism check failed");
    const validation = validateDatabaseTeamAnalysisDb50Dataset(dataset, db24.dataset, db35.dataset, db47.dataset, { db24Sha256: db24.sha256, db35Sha256: db35.sha256, db47Sha256: db47.sha256, nativeSha256: nativeBefore.sha256, nativeSizeBytes: nativeBefore.sizeBytes, evidenceSha256, proofRoles: evidence.codeRegions.map(value => value.role) });
    if (!validation.valid) throw Error(`DB50 focused validation failed: ${JSON.stringify(validation.failures.slice(0, 10))}`);
    const coverage = buildDatabaseTeamAnalysisDb50Coverage(dataset), goldens = await validateDatabaseTeamAnalysisDb50Goldens(dataset, coverage);
    if (goldens.failures.length) throw Error(`DB50 focused goldens failed: ${JSON.stringify(goldens.failures)}`);
    const report = renderDatabaseTeamAnalysisDb50Report(coverage);
    const manifest: DatabaseTeamAnalysisDb50Manifest = { schemaVersion: 1, contractVersion: "0.49.0", generatedAt: dataset.generatedAt, fileName: "team-analysis-db50-counter-consumer.json.gz", compression: "gzip", sha256: sha256(firstGzip), sizeBytes: firstGzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstJson, "utf8"), ruleCount: coverage.ruleCount, affectedStateCount: coverage.affectedStateCount, inheritedSemanticPromotionCount: 76, semanticPromotionCount: 6, sourceDatabaseSha256: databaseBefore.sha256, sourceDb24Sha256: db24.sha256, sourceDb35Sha256: db35.sha256, sourceDb47Sha256: db47.sha256, nativeRuntimeSha256: nativeBefore.sha256, nativeEvidenceSha256: evidenceSha256, coverageFile: "team-analysis-db50-coverage.json", reportFile: "team-analysis-db50-report.md", validationFile: "team-analysis-db50-validation.json", goldenValidationFile: "team-analysis-db50-golden-validation.json" };
    const databaseAfter = await fingerprint(databasePath), nativeAfter = await fingerprint(nativeRuntimePath);
    if (JSON.stringify(databaseAfter) !== JSON.stringify(databaseBefore)) throw Error("DB50 focused read-only SQLite guarantee failed");
    if (JSON.stringify(nativeAfter) !== JSON.stringify(nativeBefore)) throw Error("DB50 focused read-only ELF guarantee failed");
    await mkdir(outputDir, { recursive: true });
    await Promise.all([
        writeFile(resolve(outputDir, manifest.fileName), firstGzip),
        writeFile(resolve(outputDir, "team-analysis-db50-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`),
        writeFile(resolve(outputDir, manifest.coverageFile), `${JSON.stringify(coverage, null, 2)}\n`),
        writeFile(resolve(outputDir, manifest.reportFile), report),
        writeFile(resolve(outputDir, manifest.validationFile), `${JSON.stringify(validation, null, 2)}\n`),
        writeFile(resolve(outputDir, manifest.goldenValidationFile), `${JSON.stringify(goldens, null, 2)}\n`),
    ]);
    return { manifest, validation, goldens, deterministicJsonSha256: sha256(secondJson), sourceDatabase: databaseAfter, nativeRuntime: nativeAfter };
}

if (require.main === module) runDatabaseTeamAnalysisDb50().then(result => console.log(JSON.stringify(result, null, 2))).catch(error => { console.error(error); process.exitCode = 1; });
