import { createHash } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import { resolve } from "path";
import { buildServerS7, sourceLineageAggregateSha256, validateServerS7 } from "./server-s7-builder";
import { ServerS7Gate, ServerS7InputGate, ServerS7Manifest } from "./server-s7-contract";

const MEMORY_LIMIT = 1024 * 1024 * 1024; let peakWorkingSetBytes = 0;
const memory = () => { peakWorkingSetBytes = Math.max(peakWorkingSetBytes, process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024); if (peakWorkingSetBytes > MEMORY_LIMIT) throw new Error(`S7 memory limit exceeded ${peakWorkingSetBytes}`); };
const sha256 = (value: Buffer | string) => createHash("sha256").update(value).digest("hex"), jsonText = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
const files = {
    s0: { version: "0.1.0", contract: "dokkan-server-source-catalog", payload: "server-s0-catalog.json", validation: "server-s0-validation.json" },
    s1: { version: "0.2.0", contract: "dokkan-server-schedule-and-banners", payload: "server-s1-schedule-banners.json", validation: "server-s1-validation.json" },
    s2: { version: "0.3.0", contract: "dokkan-server-root-resolution", payload: "server-s2-roots.json", validation: "server-s2-validation.json" },
    s3: { version: "0.4.0", contract: "dokkan-server-reward-identity", payload: "server-s3-reward-joins.json", validation: "server-s3-validation.json" },
    s4: { version: "0.5.0", contract: "dokkan-server-asset-delivery", payload: "server-s4-asset-delivery.json", validation: "server-s4-validation.json" },
    s5: { version: "0.6.0", contract: "dokkan-server-sidecar-registry", payload: "server-s5-registry.json", validation: "server-s5-validation.json" },
    s6: { version: "0.7.0", contract: "dokkan-server-shadow-parity", payload: "server-s6-shadow-parity.json", validation: "server-s6-validation.json" },
} as const;
async function inputGate(root: string, gate: ServerS7Gate): Promise<ServerS7InputGate> {
    const expected = files[gate], dir = resolve(root, gate), manifest = JSON.parse(await readFile(resolve(dir, `server-${gate}-manifest.json`), "utf8"));
    if (manifest.schemaVersion !== 1 || manifest.contractVersion !== expected.version || manifest.compression !== "none" || manifest.fileName !== expected.payload || manifest.validation?.fileName !== expected.validation) throw new Error(`S7 ${gate} manifest contract`);
    const bytes = await readFile(resolve(dir, manifest.fileName)), validationBytes = await readFile(resolve(dir, manifest.validation.fileName)); memory(); const validation = JSON.parse(validationBytes.toString("utf8"));
    if (bytes.byteLength !== manifest.sizeBytes || sha256(bytes) !== manifest.sha256 || validationBytes.byteLength !== manifest.validation.sizeBytes || sha256(validationBytes) !== manifest.validation.sha256 || validation.schemaVersion !== 1 || validation.valid !== true) throw new Error(`S7 ${gate} lineage or validation`);
    const dataset = JSON.parse(bytes.toString("utf8")); if (dataset.schemaVersion !== 1 || dataset.contract !== expected.contract || dataset.contractVersion !== expected.version) throw new Error(`S7 ${gate} dataset contract`);
    return { gate, contractVersion: manifest.contractVersion, path: `data/database-server/${gate}/${manifest.fileName}`, sha256: manifest.sha256, sizeBytes: manifest.sizeBytes, generatedAt: dataset.generatedAt, dataset };
}
export async function runServerS7(options: { inputRoot?: string; outputDir?: string } = {}) {
    peakWorkingSetBytes = 0; const inputRoot = resolve(options.inputRoot ?? resolve(process.cwd(), "data", "database-server")), outputDir = resolve(options.outputDir ?? resolve(inputRoot, "s7"));
    const inputs = {} as Record<ServerS7Gate, ServerS7InputGate>; for (const gate of Object.keys(files) as ServerS7Gate[]) inputs[gate] = await inputGate(inputRoot, gate); memory();
    const dataset = buildServerS7(inputs), validation = validateServerS7(dataset); if (!validation.valid) throw new Error(`S7 validation failed: ${validation.failures.join(", ")}`);
    const datasetText = jsonText(dataset), validationText = jsonText(validation), manifest: ServerS7Manifest = { schemaVersion: 1, contractVersion: "0.8.0", generatedAt: dataset.generatedAt, generatedAtPolicy: "latest_validated_gate_derivation_time", fileName: "server-s7-readiness.json", compression: "none", sha256: sha256(datasetText), sizeBytes: Buffer.byteLength(datasetText), sourceLineageAggregateSha256: sourceLineageAggregateSha256(dataset.sourceLineage), validation: { fileName: "server-s7-validation.json", sha256: sha256(validationText), sizeBytes: Buffer.byteLength(validationText) } };
    await mkdir(outputDir, { recursive: true }); await Promise.all([writeFile(resolve(outputDir, manifest.fileName), datasetText), writeFile(resolve(outputDir, manifest.validation.fileName), validationText), writeFile(resolve(outputDir, "server-s7-manifest.json"), jsonText(manifest))]); memory();
    return { dataset, validation, manifest, peakWorkingSetBytes };
}
if (require.main === module) runServerS7().then(value => console.log(JSON.stringify({ decisions: value.dataset.decisions.map(item => ({ key: item.key, decision: item.decision })), coverage: value.dataset.coverage, terminalBoundary: value.dataset.terminalBoundary, validation: value.validation, manifest: value.manifest, peakWorkingSetBytes: value.peakWorkingSetBytes }, null, 2))).catch(error => { console.error(error); process.exitCode = 1; });
