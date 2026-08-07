import { createHash } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import { resolve } from "path";
import { buildServerS5, buildServerS5Coverage, validateServerS5 } from "./server-s5-builder";
import { ServerS5InputGate, ServerS5Manifest } from "./server-s5-contract";

const MEMORY_LIMIT = 1024 * 1024 * 1024; let peakWorkingSetBytes = 0;
const memory = () => { peakWorkingSetBytes = Math.max(peakWorkingSetBytes, process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024); if (peakWorkingSetBytes > MEMORY_LIMIT) throw new Error(`S5 memory limit exceeded ${peakWorkingSetBytes}`); };
const sha256 = (value: Buffer | string) => createHash("sha256").update(value).digest("hex"); const text = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
const inputFiles = {
    s1: { payload: "server-s1-schedule-banners.json", validation: "server-s1-validation.json" },
    s2: { payload: "server-s2-roots.json", validation: "server-s2-validation.json" },
    s3: { payload: "server-s3-reward-joins.json", validation: "server-s3-validation.json" },
    s4: { payload: "server-s4-asset-delivery.json", validation: "server-s4-validation.json" },
} as const;
async function inputGate(root: string, gate: "s1" | "s2" | "s3" | "s4", expectedContract: string): Promise<ServerS5InputGate> {
    const dir = resolve(root, gate), manifestName = `server-${gate}-manifest.json`, manifest = JSON.parse(await readFile(resolve(dir, manifestName), "utf8"));
    if (manifest.schemaVersion !== 1 || manifest.contractVersion !== expectedContract || manifest.compression !== "none" || manifest.fileName !== inputFiles[gate].payload || manifest.validation?.fileName !== inputFiles[gate].validation) throw new Error(`S5 ${gate} manifest contract`);
    const bytes = await readFile(resolve(dir, manifest.fileName)), validationBytes = await readFile(resolve(dir, manifest.validation.fileName)); memory();
    if (bytes.byteLength !== manifest.sizeBytes || sha256(bytes) !== manifest.sha256 || validationBytes.byteLength !== manifest.validation.sizeBytes || sha256(validationBytes) !== manifest.validation.sha256 || JSON.parse(validationBytes.toString("utf8")).valid !== true) throw new Error(`S5 ${gate} lineage or validation`);
    const dataset = JSON.parse(bytes.toString("utf8")), receipts = dataset.collection?.receipts ?? [], fetchedAt = gate === "s1" ? receipts.map((value: any) => value.fetchedAt).filter(Boolean).sort().at(-1) ?? null : null;
    if (gate === "s1" && (dataset.generatedAtPolicy !== "derived_from_latest_successful_fetch_time" || dataset.collection?.failures?.length !== 0 || dataset.schedules?.length !== 0 || fetchedAt === null || dataset.generatedAt !== fetchedAt)) throw new Error("S5 rejects stale or invalid final S1 capture");
    if (gate !== "s1" && dataset.generatedAtPolicy !== "pinned_to_static_evidence_checkpoint") throw new Error(`S5 ${gate} generatedAt policy`);
    return { gate, contractVersion: manifest.contractVersion, sha256: manifest.sha256, sizeBytes: manifest.sizeBytes, generatedAt: dataset.generatedAt, fetchedAt, dataset };
}

export async function runServerS5(options: { inputRoot?: string; outputDir?: string } = {}) {
    peakWorkingSetBytes = 0; const inputRoot = resolve(options.inputRoot ?? resolve(process.cwd(), "data", "database-server")), outputDir = resolve(options.outputDir ?? resolve(inputRoot, "s5"));
    const [s1, s2, s3, s4] = await Promise.all([inputGate(inputRoot, "s1", "0.2.0"), inputGate(inputRoot, "s2", "0.3.0"), inputGate(inputRoot, "s3", "0.4.0"), inputGate(inputRoot, "s4", "0.5.0")]); memory();
    const result = buildServerS5({ s1, s2, s3, s4 }), coverage = buildServerS5Coverage(result), validation = validateServerS5(result); if (!validation.valid) throw new Error(`S5 validation failed: ${validation.failures.join(", ")}`);
    await mkdir(outputDir, { recursive: true }); const writes: Array<Promise<void>> = [];
    for (const manifest of result.manifests) { writes.push(writeFile(resolve(outputDir, manifest.payloadFileName), result.payloadTexts.get(manifest.kind)!)); writes.push(writeFile(resolve(outputDir, `server-s5-${manifest.kind}-manifest.json`), result.manifestTexts.get(manifest.kind)!)); }
    const registryText = text(result.registry), coverageText = text(coverage), validationText = text(validation);
    const topManifest: ServerS5Manifest = { schemaVersion: 1, contractVersion: "0.6.0", generatedAt: result.registry.generatedAt, fileName: "server-s5-registry.json", compression: "none", sha256: sha256(registryText), sizeBytes: Buffer.byteLength(registryText), sidecarManifests: result.registry.sidecars.map(value => ({ kind: value.kind, fileName: value.manifestFileName, sha256: value.manifestSha256, sizeBytes: value.manifestSizeBytes })), coverage: { fileName: "server-s5-coverage.json", sha256: sha256(coverageText), sizeBytes: Buffer.byteLength(coverageText) }, validation: { fileName: "server-s5-validation.json", sha256: sha256(validationText), sizeBytes: Buffer.byteLength(validationText) } };
    writes.push(writeFile(resolve(outputDir, topManifest.fileName), registryText), writeFile(resolve(outputDir, topManifest.coverage.fileName), coverageText), writeFile(resolve(outputDir, topManifest.validation.fileName), validationText), writeFile(resolve(outputDir, "server-s5-manifest.json"), text(topManifest))); await Promise.all(writes); memory();
    return { result, coverage, validation, manifest: topManifest, peakWorkingSetBytes };
}
if (require.main === module) runServerS5().then(value => console.log(JSON.stringify({ registry: value.result.registry, coverage: value.coverage, validation: value.validation, manifest: value.manifest, peakWorkingSetBytes: value.peakWorkingSetBytes }, null, 2))).catch(error => { console.error(error); process.exitCode = 1; });
