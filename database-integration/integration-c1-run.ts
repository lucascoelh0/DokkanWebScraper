import { createHash } from "crypto";
import { readFile, mkdir, writeFile } from "fs/promises";
import { resolve } from "path";
import { gunzipSync, gzipSync } from "zlib";
import { DatabaseTeamAnalysisDb48Dataset } from "../database-experiment/team-analysis-db48-contract";
import { DatabaseTeamAnalysisDb49Dataset } from "../database-experiment/team-analysis-db49-contract";
import { DatabaseTeamAnalysisDb50Dataset } from "../database-experiment/team-analysis-db50-contract";
import { buildIntegrationC1Coverage, buildIntegrationC1Dataset, IntegrationC1Sources } from "./integration-c1-builder";
import { IntegrationC1Manifest } from "./integration-c1-contract";
import { validateIntegrationC1Dataset } from "./integration-c1-validator";

const DEFAULT_INPUT = resolve(process.cwd(), "data", "database-experiment");
const DEFAULT_OUTPUT = resolve(process.cwd(), "data", "database-experiment");
const sha256 = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");
interface SourceManifest { schemaVersion: number; contractVersion: string; fileName: string; compression: string; sha256: string; sizeBytes: number; uncompressedSizeBytes: number; sourceDatabaseSha256: string; nativeRuntimeSha256: string }
async function readSource<T>(root: string, gate: "db48" | "db49" | "db50"): Promise<{ dataset: T; gzip: Buffer; sha256: string; manifest: SourceManifest }> {
    const manifest = JSON.parse(await readFile(resolve(root, `team-analysis-${gate}-manifest.json`), "utf8")) as SourceManifest, gzip = await readFile(resolve(root, manifest.fileName));
    if (manifest.schemaVersion !== 1 || manifest.compression !== "gzip" || manifest.sha256 !== sha256(gzip) || manifest.sizeBytes !== gzip.byteLength) throw Error(`C1 invalid ${gate.toUpperCase()} artifact`);
    const json = gunzipSync(gzip);
    if (manifest.uncompressedSizeBytes !== json.byteLength) throw Error(`C1 invalid ${gate.toUpperCase()} uncompressed size`);
    return { dataset: JSON.parse(json.toString("utf8")) as T, gzip, sha256: sha256(gzip), manifest };
}
export async function runIntegrationC1(options: { inputDir?: string; outputDir?: string } = {}) {
    const inputDir = options.inputDir ?? DEFAULT_INPUT, outputDir = options.outputDir ?? DEFAULT_OUTPUT;
    const db48 = await readSource<DatabaseTeamAnalysisDb48Dataset>(inputDir, "db48"), db49 = await readSource<DatabaseTeamAnalysisDb49Dataset>(inputDir, "db49"), db50 = await readSource<DatabaseTeamAnalysisDb50Dataset>(inputDir, "db50");
    const sources: IntegrationC1Sources = { db48: db48.dataset, db48Sha256: db48.sha256, db49: db49.dataset, db49Sha256: db49.sha256, db50: db50.dataset, db50Sha256: db50.sha256 };
    const build = () => buildIntegrationC1Dataset(sources), dataset = build(), firstJson = `${JSON.stringify(dataset)}\n`, secondJson = `${JSON.stringify(build())}\n`, firstGzip = gzipSync(Buffer.from(firstJson), { level: 9 }), secondGzip = gzipSync(Buffer.from(secondJson), { level: 9 });
    if (sha256(firstJson) !== sha256(secondJson) || !firstGzip.equals(secondGzip)) throw Error("C1 deterministic rebuild failed");
    const validation = validateIntegrationC1Dataset(dataset, sources);
    if (!validation.valid) throw Error(`C1 validation failed: ${JSON.stringify(validation.failures.slice(0, 10))}`);
    const coverage = buildIntegrationC1Coverage(dataset);
    if (coverage.duplicateIdentityCount !== 0 || coverage.ruleCount !== validation.losslessRawTupleCount) throw Error("C1 coverage integrity failed");
    const manifest: IntegrationC1Manifest = { schemaVersion: 1, contractVersion: "1.0.0", generatedAt: dataset.generatedAt, fileName: "team-analysis-database-first-sidecar-c1.json.gz", compression: "gzip", sha256: sha256(firstGzip), sizeBytes: firstGzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstJson), ruleCount: coverage.ruleCount, stateCount: coverage.stateCount, sourceSnapshotVersion: dataset.sourceSnapshotVersion, sourceDatabaseSha256: dataset.sourceDatabaseSha256, nativeRuntimeSha256: dataset.nativeRuntimeSha256, sourceArtifacts: dataset.sources.map(value => ({ gate: value.gate, sha256: value.sha256 })), coverageFile: "team-analysis-database-first-sidecar-c1-coverage.json", validationFile: "team-analysis-database-first-sidecar-c1-validation.json" };
    await mkdir(outputDir, { recursive: true });
    await Promise.all([writeFile(resolve(outputDir, manifest.fileName), firstGzip), writeFile(resolve(outputDir, "team-analysis-database-first-sidecar-c1-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`), writeFile(resolve(outputDir, manifest.coverageFile), `${JSON.stringify(coverage, null, 2)}\n`), writeFile(resolve(outputDir, manifest.validationFile), `${JSON.stringify(validation, null, 2)}\n`)]);
    return { manifest, coverage, validation, deterministicJsonSha256: sha256(secondJson) };
}
if (require.main === module) runIntegrationC1().then(value => console.log(JSON.stringify(value, null, 2))).catch(error => { console.error(error); process.exitCode = 1; });
