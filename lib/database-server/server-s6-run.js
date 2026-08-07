"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runServerS6 = void 0;
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const zlib_1 = require("zlib");
const util_1 = require("util");
const server_s6_builder_1 = require("./server-s6-builder");
const unzip = (0, util_1.promisify)(zlib_1.gunzip), MEMORY_LIMIT = 1024 * 1024 * 1024;
let peakWorkingSetBytes = 0;
const memory = () => { peakWorkingSetBytes = Math.max(peakWorkingSetBytes, process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024); if (peakWorkingSetBytes > MEMORY_LIMIT)
    throw new Error(`S6 memory limit exceeded ${peakWorkingSetBytes}`); };
const sha256 = (value) => (0, crypto_1.createHash)("sha256").update(value).digest("hex"), jsonText = (value) => `${JSON.stringify(value, null, 2)}\n`;
const gateFiles = {
    s1: { contract: "0.2.0", datasetContract: "dokkan-server-schedule-and-banners", payload: "server-s1-schedule-banners.json", validation: "server-s1-validation.json" },
    s2: { contract: "0.3.0", datasetContract: "dokkan-server-root-resolution", payload: "server-s2-roots.json", validation: "server-s2-validation.json" },
    s3: { contract: "0.4.0", datasetContract: "dokkan-server-reward-identity", payload: "server-s3-reward-joins.json", validation: "server-s3-validation.json" },
    s4: { contract: "0.5.0", datasetContract: "dokkan-server-asset-delivery", payload: "server-s4-asset-delivery.json", validation: "server-s4-validation.json" },
    s5: { contract: "0.6.0", datasetContract: "dokkan-server-sidecar-registry", payload: "server-s5-registry.json", validation: "server-s5-validation.json" },
};
async function inputGate(root, gate) {
    const dir = (0, path_1.resolve)(root, gate), manifest = JSON.parse(await (0, promises_1.readFile)((0, path_1.resolve)(dir, `server-${gate}-manifest.json`), "utf8")), expected = gateFiles[gate];
    if (manifest.schemaVersion !== 1 || manifest.contractVersion !== expected.contract || manifest.compression !== "none" || manifest.fileName !== expected.payload || manifest.validation?.fileName !== expected.validation)
        throw new Error(`S6 ${gate} manifest contract`);
    const bytes = await (0, promises_1.readFile)((0, path_1.resolve)(dir, manifest.fileName)), validationBytes = await (0, promises_1.readFile)((0, path_1.resolve)(dir, manifest.validation.fileName));
    memory();
    const validation = JSON.parse(validationBytes.toString("utf8"));
    if (bytes.byteLength !== manifest.sizeBytes || sha256(bytes) !== manifest.sha256 || validationBytes.byteLength !== manifest.validation.sizeBytes || sha256(validationBytes) !== manifest.validation.sha256 || validation.schemaVersion !== 1 || validation.valid !== true)
        throw new Error(`S6 ${gate} lineage or validation`);
    const dataset = JSON.parse(bytes.toString("utf8"));
    if (dataset.schemaVersion !== 1 || dataset.contract !== expected.datasetContract || dataset.contractVersion !== expected.contract)
        throw new Error(`S6 ${gate} dataset contract`);
    return { gate, contractVersion: manifest.contractVersion, path: `data/database-server/${gate}/${manifest.fileName}`, sha256: manifest.sha256, sizeBytes: manifest.sizeBytes, generatedAt: dataset.generatedAt, dataset };
}
async function cacheInput(root) {
    const implementationPath = (0, path_1.resolve)(root, "fyi-summons.ts"), indexPath = (0, path_1.resolve)(root, "data", "summons", "latest", "summons-index.json"), detailsPath = (0, path_1.resolve)(root, "data", "summons", "latest", "summons-details.json"), characterManifestPath = (0, path_1.resolve)(root, "data", "latest", "characters-manifest.json"), characterPath = (0, path_1.resolve)(root, "data", "latest", "characters.json.gz");
    const implementationBytes = await (0, promises_1.readFile)(implementationPath), indexBytes = await (0, promises_1.readFile)(indexPath), detailsBytes = await (0, promises_1.readFile)(detailsPath), characterManifestBytes = await (0, promises_1.readFile)(characterManifestPath), characterBytes = await (0, promises_1.readFile)(characterPath);
    memory();
    const implementation = implementationBytes.toString("utf8"), index = JSON.parse(indexBytes.toString("utf8")), details = JSON.parse(detailsBytes.toString("utf8")), characterManifest = JSON.parse(characterManifestBytes.toString("utf8"));
    if (!["buildSummonIndexDataset", "buildSummonDetailsDataset", "featuredCharacters", "id: summon.id.toString()"].every(value => implementation.includes(value)))
        throw new Error("S6 current FYI scraper implementation contract");
    const indexIds = index.summons.map((value) => String(value.id)).sort(), detailIds = details.summons.map((value) => String(value.id)).sort();
    if (index.source !== "dokkan.fyi" || details.source !== "dokkan.fyi" || index.activeOnly !== true || details.activeOnly !== true || index.count !== indexIds.length || details.count !== detailIds.length || JSON.stringify(indexIds) !== JSON.stringify(detailIds) || new Set(indexIds).size !== indexIds.length)
        throw new Error("S6 existing summon cache contract");
    if (characterManifest.schemaVersion !== 1 || characterManifest.compression !== "gzip" || characterManifest.fileName !== "characters.json.gz" || characterManifest.sizeBytes !== characterBytes.byteLength || characterManifest.sha256 !== sha256(characterBytes))
        throw new Error("S6 character manifest contract");
    const uncompressed = await unzip(characterBytes);
    memory();
    if (uncompressed.byteLength !== characterManifest.uncompressedSizeBytes)
        throw new Error("S6 character payload size");
    const characters = JSON.parse(uncompressed.toString("utf8"));
    if (!Array.isArray(characters) || characters.length !== characterManifest.characterCount || characters.some((value) => !/^\d+$/.test(String(value.id))))
        throw new Error("S6 character payload contract");
    const lineage = (key, path, bytes, authority, generatedAt) => ({ key, path, contractVersion: null, sha256: sha256(bytes), sizeBytes: bytes.byteLength, authority, generatedAt });
    return { existingBannerIds: indexIds, characterIds: characters.map((value) => String(value.id)), generatedAt: [index.generatedAt, details.generatedAt, characterManifest.generatedAt].sort().at(-1), sourceLineage: [lineage("fyi_summons_implementation", "fyi-summons.ts", implementationBytes, "repository_implementation", null), lineage("summons_index_cache", "data/summons/latest/summons-index.json", indexBytes, "existing_community_cache", index.generatedAt), lineage("summons_details_cache", "data/summons/latest/summons-details.json", detailsBytes, "existing_community_cache", details.generatedAt), lineage("characters_manifest", "data/latest/characters-manifest.json", characterManifestBytes, "existing_community_cache", characterManifest.generatedAt), lineage("characters_payload", "data/latest/characters.json.gz", characterBytes, "existing_community_cache", characterManifest.generatedAt)] };
}
async function runServerS6(options = {}) {
    peakWorkingSetBytes = 0;
    const root = (0, path_1.resolve)(options.root ?? process.cwd()), inputRoot = (0, path_1.resolve)(options.inputRoot ?? (0, path_1.resolve)(root, "data", "database-server")), outputDir = (0, path_1.resolve)(options.outputDir ?? (0, path_1.resolve)(inputRoot, "s6"));
    const s1 = await inputGate(inputRoot, "s1"), s2 = await inputGate(inputRoot, "s2"), s3 = await inputGate(inputRoot, "s3"), s4 = await inputGate(inputRoot, "s4"), s5 = await inputGate(inputRoot, "s5"), cache = await cacheInput(root);
    memory();
    const dataset = (0, server_s6_builder_1.buildServerS6)({ s1, s2, s3, s4, s5, cache }), validation = (0, server_s6_builder_1.validateServerS6)(dataset);
    if (!validation.valid)
        throw new Error(`S6 validation failed: ${validation.failures.join(", ")}`);
    const datasetText = jsonText(dataset), validationText = jsonText(validation), manifest = { schemaVersion: 1, contractVersion: "0.7.0", generatedAt: dataset.generatedAt, generatedAtPolicy: "latest_input_derivation_time", fileName: "server-s6-shadow-parity.json", compression: "none", sha256: sha256(datasetText), sizeBytes: Buffer.byteLength(datasetText), sourceLineageAggregateSha256: (0, server_s6_builder_1.sourceLineageAggregateSha256)(dataset.sourceLineage), validation: { fileName: "server-s6-validation.json", sha256: sha256(validationText), sizeBytes: Buffer.byteLength(validationText) } };
    await (0, promises_1.mkdir)(outputDir, { recursive: true });
    await Promise.all([(0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.fileName), datasetText), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.validation.fileName), validationText), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, "server-s6-manifest.json"), jsonText(manifest))]);
    memory();
    return { dataset, validation, manifest, peakWorkingSetBytes };
}
exports.runServerS6 = runServerS6;
if (require.main === module)
    runServerS6().then(value => console.log(JSON.stringify({ totals: value.dataset.totals, completeness: value.dataset.completeness, validation: value.validation, manifest: value.manifest, peakWorkingSetBytes: value.peakWorkingSetBytes }, null, 2))).catch(error => { console.error(error); process.exitCode = 1; });
//# sourceMappingURL=server-s6-run.js.map