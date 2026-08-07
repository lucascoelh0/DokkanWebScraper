import { createHash } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import { resolve } from "path";
import { gunzipSync, gzipSync } from "zlib";
import { IntegrationC1Dataset, IntegrationC1Manifest } from "./integration-c1-contract";
import { buildIntegrationC2Coverage, buildIntegrationC2Dataset } from "./integration-c2-builder";
import { IntegrationC2Manifest } from "./integration-c2-contract";
import { validateIntegrationC2Dataset } from "./integration-c2-validator";

const DEFAULT_ROOT = resolve(process.cwd(), "data", "database-experiment"), sha256 = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");
export async function runIntegrationC2(options: { inputDir?: string; outputDir?: string } = {}) {
    const inputDir = options.inputDir ?? DEFAULT_ROOT, outputDir = options.outputDir ?? DEFAULT_ROOT, manifest = JSON.parse(await readFile(resolve(inputDir, "team-analysis-database-first-sidecar-c1-manifest.json"), "utf8")) as IntegrationC1Manifest, gzip = await readFile(resolve(inputDir, manifest.fileName));
    if (manifest.schemaVersion !== 1 || manifest.contractVersion !== "1.0.0" || manifest.sha256 !== sha256(gzip) || manifest.sizeBytes !== gzip.byteLength) throw Error("C2 invalid C1 artifact");
    const json = gunzipSync(gzip); if (manifest.uncompressedSizeBytes !== json.byteLength) throw Error("C2 invalid C1 uncompressed size"); const source = JSON.parse(json.toString("utf8")) as IntegrationC1Dataset, sourceSha256 = sha256(gzip);
    const build = () => buildIntegrationC2Dataset(source, sourceSha256), dataset = build(), firstJson = `${JSON.stringify(dataset)}\n`, secondJson = `${JSON.stringify(build())}\n`, firstGzip = gzipSync(Buffer.from(firstJson), { level: 9 }), secondGzip = gzipSync(Buffer.from(secondJson), { level: 9 });
    if (sha256(firstJson) !== sha256(secondJson) || !firstGzip.equals(secondGzip)) throw Error("C2 deterministic rebuild failed");
    const validation = validateIntegrationC2Dataset(dataset, source, sourceSha256); if (!validation.valid) throw Error(`C2 validation failed: ${JSON.stringify(validation.failures.slice(0, 10))}`); const coverage = buildIntegrationC2Coverage(dataset, source); if (coverage.forbiddenFieldCount !== 0 || coverage.omittedRuleCount !== 0) throw Error("C2 supported-only coverage failed");
    const outputManifest: IntegrationC2Manifest = { schemaVersion: 1, contractVersion: "1.0.0", generatedAt: dataset.generatedAt, fileName: "team-analysis-database-first-supported-c2.json.gz", compression: "gzip", sha256: sha256(firstGzip), sizeBytes: firstGzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstJson), ruleCount: dataset.rules.length, stateCount: coverage.stateCount, sourceSnapshotVersion: dataset.sourceSnapshotVersion, sourceAuditSidecarSha256: sourceSha256, coverageFile: "team-analysis-database-first-supported-c2-coverage.json", validationFile: "team-analysis-database-first-supported-c2-validation.json" };
    await mkdir(outputDir, { recursive: true }); await Promise.all([writeFile(resolve(outputDir, outputManifest.fileName), firstGzip), writeFile(resolve(outputDir, "team-analysis-database-first-supported-c2-manifest.json"), `${JSON.stringify(outputManifest, null, 2)}\n`), writeFile(resolve(outputDir, outputManifest.coverageFile), `${JSON.stringify(coverage, null, 2)}\n`), writeFile(resolve(outputDir, outputManifest.validationFile), `${JSON.stringify(validation, null, 2)}\n`)]);
    return { manifest: outputManifest, coverage, validation, deterministicJsonSha256: sha256(secondJson) };
}
if (require.main === module) runIntegrationC2().then(value => console.log(JSON.stringify(value, null, 2))).catch(error => { console.error(error); process.exitCode = 1; });
