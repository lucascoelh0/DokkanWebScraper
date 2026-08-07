"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runServerS5 = void 0;
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const server_s5_builder_1 = require("./server-s5-builder");
const MEMORY_LIMIT = 1024 * 1024 * 1024;
let peakWorkingSetBytes = 0;
const memory = () => { peakWorkingSetBytes = Math.max(peakWorkingSetBytes, process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024); if (peakWorkingSetBytes > MEMORY_LIMIT)
    throw new Error(`S5 memory limit exceeded ${peakWorkingSetBytes}`); };
const sha256 = (value) => (0, crypto_1.createHash)("sha256").update(value).digest("hex");
const text = (value) => `${JSON.stringify(value, null, 2)}\n`;
const inputFiles = {
    s1: { payload: "server-s1-schedule-banners.json", validation: "server-s1-validation.json" },
    s2: { payload: "server-s2-roots.json", validation: "server-s2-validation.json" },
    s3: { payload: "server-s3-reward-joins.json", validation: "server-s3-validation.json" },
    s4: { payload: "server-s4-asset-delivery.json", validation: "server-s4-validation.json" },
};
async function inputGate(root, gate, expectedContract) {
    const dir = (0, path_1.resolve)(root, gate), manifestName = `server-${gate}-manifest.json`, manifest = JSON.parse(await (0, promises_1.readFile)((0, path_1.resolve)(dir, manifestName), "utf8"));
    if (manifest.schemaVersion !== 1 || manifest.contractVersion !== expectedContract || manifest.compression !== "none" || manifest.fileName !== inputFiles[gate].payload || manifest.validation?.fileName !== inputFiles[gate].validation)
        throw new Error(`S5 ${gate} manifest contract`);
    const bytes = await (0, promises_1.readFile)((0, path_1.resolve)(dir, manifest.fileName)), validationBytes = await (0, promises_1.readFile)((0, path_1.resolve)(dir, manifest.validation.fileName));
    memory();
    if (bytes.byteLength !== manifest.sizeBytes || sha256(bytes) !== manifest.sha256 || validationBytes.byteLength !== manifest.validation.sizeBytes || sha256(validationBytes) !== manifest.validation.sha256 || JSON.parse(validationBytes.toString("utf8")).valid !== true)
        throw new Error(`S5 ${gate} lineage or validation`);
    const dataset = JSON.parse(bytes.toString("utf8")), receipts = dataset.collection?.receipts ?? [], fetchedAt = gate === "s1" ? receipts.map((value) => value.fetchedAt).filter(Boolean).sort().at(-1) ?? null : null;
    if (gate === "s1" && (dataset.generatedAtPolicy !== "derived_from_latest_successful_fetch_time" || dataset.collection?.failures?.length !== 0 || dataset.schedules?.length !== 0 || fetchedAt === null || dataset.generatedAt !== fetchedAt))
        throw new Error("S5 rejects stale or invalid final S1 capture");
    if (gate !== "s1" && dataset.generatedAtPolicy !== "pinned_to_static_evidence_checkpoint")
        throw new Error(`S5 ${gate} generatedAt policy`);
    return { gate, contractVersion: manifest.contractVersion, sha256: manifest.sha256, sizeBytes: manifest.sizeBytes, generatedAt: dataset.generatedAt, fetchedAt, dataset };
}
async function runServerS5(options = {}) {
    peakWorkingSetBytes = 0;
    const inputRoot = (0, path_1.resolve)(options.inputRoot ?? (0, path_1.resolve)(process.cwd(), "data", "database-server")), outputDir = (0, path_1.resolve)(options.outputDir ?? (0, path_1.resolve)(inputRoot, "s5"));
    const [s1, s2, s3, s4] = await Promise.all([inputGate(inputRoot, "s1", "0.2.0"), inputGate(inputRoot, "s2", "0.3.0"), inputGate(inputRoot, "s3", "0.4.0"), inputGate(inputRoot, "s4", "0.5.0")]);
    memory();
    const result = (0, server_s5_builder_1.buildServerS5)({ s1, s2, s3, s4 }), coverage = (0, server_s5_builder_1.buildServerS5Coverage)(result), validation = (0, server_s5_builder_1.validateServerS5)(result);
    if (!validation.valid)
        throw new Error(`S5 validation failed: ${validation.failures.join(", ")}`);
    await (0, promises_1.mkdir)(outputDir, { recursive: true });
    const writes = [];
    for (const manifest of result.manifests) {
        writes.push((0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.payloadFileName), result.payloadTexts.get(manifest.kind)));
        writes.push((0, promises_1.writeFile)((0, path_1.resolve)(outputDir, `server-s5-${manifest.kind}-manifest.json`), result.manifestTexts.get(manifest.kind)));
    }
    const registryText = text(result.registry), coverageText = text(coverage), validationText = text(validation);
    const topManifest = { schemaVersion: 1, contractVersion: "0.6.0", generatedAt: result.registry.generatedAt, fileName: "server-s5-registry.json", compression: "none", sha256: sha256(registryText), sizeBytes: Buffer.byteLength(registryText), sidecarManifests: result.registry.sidecars.map(value => ({ kind: value.kind, fileName: value.manifestFileName, sha256: value.manifestSha256, sizeBytes: value.manifestSizeBytes })), coverage: { fileName: "server-s5-coverage.json", sha256: sha256(coverageText), sizeBytes: Buffer.byteLength(coverageText) }, validation: { fileName: "server-s5-validation.json", sha256: sha256(validationText), sizeBytes: Buffer.byteLength(validationText) } };
    writes.push((0, promises_1.writeFile)((0, path_1.resolve)(outputDir, topManifest.fileName), registryText), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, topManifest.coverage.fileName), coverageText), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, topManifest.validation.fileName), validationText), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, "server-s5-manifest.json"), text(topManifest)));
    await Promise.all(writes);
    memory();
    return { result, coverage, validation, manifest: topManifest, peakWorkingSetBytes };
}
exports.runServerS5 = runServerS5;
if (require.main === module)
    runServerS5().then(value => console.log(JSON.stringify({ registry: value.result.registry, coverage: value.coverage, validation: value.validation, manifest: value.manifest, peakWorkingSetBytes: value.peakWorkingSetBytes }, null, 2))).catch(error => { console.error(error); process.exitCode = 1; });
//# sourceMappingURL=server-s5-run.js.map