"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runServerS7 = void 0;
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const server_s7_builder_1 = require("./server-s7-builder");
const MEMORY_LIMIT = 1024 * 1024 * 1024;
let peakWorkingSetBytes = 0;
const memory = () => { peakWorkingSetBytes = Math.max(peakWorkingSetBytes, process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024); if (peakWorkingSetBytes > MEMORY_LIMIT)
    throw new Error(`S7 memory limit exceeded ${peakWorkingSetBytes}`); };
const sha256 = (value) => (0, crypto_1.createHash)("sha256").update(value).digest("hex"), jsonText = (value) => `${JSON.stringify(value, null, 2)}\n`;
const files = {
    s0: { version: "0.1.0", contract: "dokkan-server-source-catalog", payload: "server-s0-catalog.json", validation: "server-s0-validation.json" },
    s1: { version: "0.2.0", contract: "dokkan-server-schedule-and-banners", payload: "server-s1-schedule-banners.json", validation: "server-s1-validation.json" },
    s2: { version: "0.3.0", contract: "dokkan-server-root-resolution", payload: "server-s2-roots.json", validation: "server-s2-validation.json" },
    s3: { version: "0.4.0", contract: "dokkan-server-reward-identity", payload: "server-s3-reward-joins.json", validation: "server-s3-validation.json" },
    s4: { version: "0.5.0", contract: "dokkan-server-asset-delivery", payload: "server-s4-asset-delivery.json", validation: "server-s4-validation.json" },
    s5: { version: "0.6.0", contract: "dokkan-server-sidecar-registry", payload: "server-s5-registry.json", validation: "server-s5-validation.json" },
    s6: { version: "0.7.0", contract: "dokkan-server-shadow-parity", payload: "server-s6-shadow-parity.json", validation: "server-s6-validation.json" },
};
async function inputGate(root, gate) {
    const expected = files[gate], dir = (0, path_1.resolve)(root, gate), manifest = JSON.parse(await (0, promises_1.readFile)((0, path_1.resolve)(dir, `server-${gate}-manifest.json`), "utf8"));
    if (manifest.schemaVersion !== 1 || manifest.contractVersion !== expected.version || manifest.compression !== "none" || manifest.fileName !== expected.payload || manifest.validation?.fileName !== expected.validation)
        throw new Error(`S7 ${gate} manifest contract`);
    const bytes = await (0, promises_1.readFile)((0, path_1.resolve)(dir, manifest.fileName)), validationBytes = await (0, promises_1.readFile)((0, path_1.resolve)(dir, manifest.validation.fileName));
    memory();
    const validation = JSON.parse(validationBytes.toString("utf8"));
    if (bytes.byteLength !== manifest.sizeBytes || sha256(bytes) !== manifest.sha256 || validationBytes.byteLength !== manifest.validation.sizeBytes || sha256(validationBytes) !== manifest.validation.sha256 || validation.schemaVersion !== 1 || validation.valid !== true)
        throw new Error(`S7 ${gate} lineage or validation`);
    const dataset = JSON.parse(bytes.toString("utf8"));
    if (dataset.schemaVersion !== 1 || dataset.contract !== expected.contract || dataset.contractVersion !== expected.version)
        throw new Error(`S7 ${gate} dataset contract`);
    return { gate, contractVersion: manifest.contractVersion, path: `data/database-server/${gate}/${manifest.fileName}`, sha256: manifest.sha256, sizeBytes: manifest.sizeBytes, generatedAt: dataset.generatedAt, dataset };
}
async function runServerS7(options = {}) {
    peakWorkingSetBytes = 0;
    const inputRoot = (0, path_1.resolve)(options.inputRoot ?? (0, path_1.resolve)(process.cwd(), "data", "database-server")), outputDir = (0, path_1.resolve)(options.outputDir ?? (0, path_1.resolve)(inputRoot, "s7"));
    const inputs = {};
    for (const gate of Object.keys(files))
        inputs[gate] = await inputGate(inputRoot, gate);
    memory();
    const dataset = (0, server_s7_builder_1.buildServerS7)(inputs), validation = (0, server_s7_builder_1.validateServerS7)(dataset);
    if (!validation.valid)
        throw new Error(`S7 validation failed: ${validation.failures.join(", ")}`);
    const datasetText = jsonText(dataset), validationText = jsonText(validation), manifest = { schemaVersion: 1, contractVersion: "0.8.0", generatedAt: dataset.generatedAt, generatedAtPolicy: "latest_validated_gate_derivation_time", fileName: "server-s7-readiness.json", compression: "none", sha256: sha256(datasetText), sizeBytes: Buffer.byteLength(datasetText), sourceLineageAggregateSha256: (0, server_s7_builder_1.sourceLineageAggregateSha256)(dataset.sourceLineage), validation: { fileName: "server-s7-validation.json", sha256: sha256(validationText), sizeBytes: Buffer.byteLength(validationText) } };
    await (0, promises_1.mkdir)(outputDir, { recursive: true });
    await Promise.all([(0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.fileName), datasetText), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.validation.fileName), validationText), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, "server-s7-manifest.json"), jsonText(manifest))]);
    memory();
    return { dataset, validation, manifest, peakWorkingSetBytes };
}
exports.runServerS7 = runServerS7;
if (require.main === module)
    runServerS7().then(value => console.log(JSON.stringify({ decisions: value.dataset.decisions.map(item => ({ key: item.key, decision: item.decision })), coverage: value.dataset.coverage, terminalBoundary: value.dataset.terminalBoundary, validation: value.validation, manifest: value.manifest, peakWorkingSetBytes: value.peakWorkingSetBytes }, null, 2))).catch(error => { console.error(error); process.exitCode = 1; });
//# sourceMappingURL=server-s7-run.js.map