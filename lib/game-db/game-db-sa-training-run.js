"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSaTrainingCandidate = exports.readSaSourcePayload = exports.parseSaTrainingArgs = exports.SA_TRAINING_CANDIDATE_ROOT = void 0;
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const zlib_1 = require("zlib");
const game_db_source_1 = require("./game-db-source");
const game_db_sa_training_1 = require("./game-db-sa-training");
const game_db_stage_delivery_1 = require("./game-db-stage-delivery");
const game_db_awakening_medal_catalog_1 = require("./game-db-awakening-medal-catalog");
exports.SA_TRAINING_CANDIDATE_ROOT = (0, path_1.resolve)("game-db/data/sa-training");
const INPUT_MANIFEST_LIMIT = 2 * 1024 * 1024;
const INPUT_COMPRESSED_LIMIT = 32 * 1024 * 1024;
const INPUT_EXPANDED_LIMIT = 128 * 1024 * 1024;
const SOURCE_TABLES = ["cards", "card_awakening_routes", "card_unique_infos"];
const FLAGS = {
    "--first-party-dir": "firstPartyDir",
    "--primary-manifest": "primaryManifestPath",
    "--primary-payload": "primaryPayloadPath",
    "--stage-manifest": "stageManifestPath",
    "--stage-catalog": "stageCatalogPath",
    "--awakening-manifest": "awakeningManifestPath",
    "--awakening-payload": "awakeningPayloadPath",
    "--output-dir": "outputDir",
    "--generated-at": "generatedAt",
};
function parseSaTrainingArgs(args) {
    const values = {};
    for (let i = 0; i < args.length; i++) {
        const split = args[i].indexOf("=");
        const key = split < 0 ? args[i] : args[i].slice(0, split);
        if (!Object.prototype.hasOwnProperty.call(FLAGS, key))
            throw new Error(`Unknown SA argument: ${key}`);
        const value = split < 0 ? args[++i] : args[i].slice(split + 1);
        const field = FLAGS[key];
        if (!value || value.startsWith("--") || values[field] !== undefined) {
            throw new Error(`Missing or duplicate SA argument: ${key}`);
        }
        values[field] = field === "generatedAt" ? value : (0, path_1.resolve)(value);
    }
    for (const [key, field] of Object.entries(FLAGS)) {
        if (!values[field])
            throw new Error(`Missing SA argument: ${key}`);
    }
    if (!Number.isFinite(Date.parse(values.generatedAt))
        || new Date(values.generatedAt).toISOString() !== values.generatedAt) {
        throw new Error("Use canonical ISO-8601 --generated-at");
    }
    return values;
}
exports.parseSaTrainingArgs = parseSaTrainingArgs;
const sha = (bytes) => (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
async function boundedRead(file, limit) {
    const info = await (0, promises_1.stat)(file);
    if (!info.isFile() || info.size <= 0 || info.size > limit)
        throw new Error(`Invalid input size: ${file}`);
    const bytes = await (0, promises_1.readFile)(file);
    if (bytes.length !== info.size || bytes.length > limit)
        throw new Error(`Input changed while reading: ${file}`);
    return bytes;
}
async function json(file) {
    return JSON.parse((await boundedRead(file, INPUT_MANIFEST_LIMIT)).toString("utf8"));
}
async function readSaSourcePayload(file, descriptor) {
    if (!descriptor || !/^[a-f0-9]{64}$/.test(descriptor.sha256)
        || !Number.isSafeInteger(descriptor.sizeBytes) || descriptor.sizeBytes <= 0
        || descriptor.sizeBytes > INPUT_COMPRESSED_LIMIT
        || !Number.isSafeInteger(descriptor.expandedSizeBytes) || descriptor.expandedSizeBytes <= 0
        || descriptor.expandedSizeBytes > INPUT_EXPANDED_LIMIT)
        throw new Error("Invalid SA source descriptor");
    const bytes = await boundedRead(file, INPUT_COMPRESSED_LIMIT);
    const digest = sha(bytes);
    if (bytes.length !== descriptor.sizeBytes || digest !== descriptor.sha256)
        throw new Error("SA source hash/size mismatch");
    const raw = (0, zlib_1.gunzipSync)(bytes, { maxOutputLength: descriptor.expandedSizeBytes });
    if (raw.length !== descriptor.expandedSizeBytes)
        throw new Error("SA source expanded size mismatch");
    return { value: JSON.parse(raw.toString("utf8")), sha256: digest };
}
exports.readSaSourcePayload = readSaSourcePayload;
function contained(root, target) {
    const sub = (0, path_1.relative)(root, target);
    return sub !== "" && sub !== ".." && !sub.startsWith(`..${path_1.sep}`) && !(0, path_1.isAbsolute)(sub);
}
async function assertFreshOutput(outputDir) {
    await (0, promises_1.mkdir)(exports.SA_TRAINING_CANDIDATE_ROOT, { recursive: true });
    const root = await (0, promises_1.realpath)(exports.SA_TRAINING_CANDIDATE_ROOT);
    const target = (0, path_1.resolve)(outputDir);
    const parent = await (0, promises_1.realpath)((0, path_1.dirname)(target));
    if (!contained(root, target) || (parent !== root && !contained(root, parent))) {
        throw new Error("SA output must stay inside its dedicated candidate root");
    }
    if (await (0, promises_1.lstat)(target).catch(error => {
        if (error.code !== "ENOENT")
            throw error;
        return undefined;
    }))
        throw new Error("SA output must be a new directory");
}
/** Local-only candidate. Never invokes a publisher or modifies source artifacts. */
async function buildSaTrainingCandidate(options) {
    await assertFreshOutput(options.outputDir);
    if (!Number.isFinite(Date.parse(options.generatedAt))
        || new Date(options.generatedAt).toISOString() !== options.generatedAt)
        throw new Error("Invalid generatedAt");
    const metadata = await json((0, path_1.resolve)(options.firstPartyDir, "metadata.json"));
    if (metadata.source !== "first-party-export" || metadata.region !== "global"
        || !/^\d+$/.test(metadata.dbVersion ?? ""))
        throw new Error("Expected versioned Global first-party export");
    const primaryManifest = await json(options.primaryManifestPath);
    const stageManifest = await json(options.stageManifestPath);
    const awakeningManifest = await json(options.awakeningManifestPath);
    if (primaryManifest.schemaVersion !== 1 || primaryManifest.compression !== "gzip"
        || stageManifest.catalog?.contentEncoding !== "gzip"
        || stageManifest.catalog?.contentType !== "application/json"
        || awakeningManifest.payload?.contentEncoding !== "gzip"
        || awakeningManifest.payload?.contentType !== "application/json")
        throw new Error("Unsupported source encoding");
    const primary = await readSaSourcePayload(options.primaryPayloadPath, {
        sha256: primaryManifest.sha256, sizeBytes: primaryManifest.sizeBytes,
        expandedSizeBytes: primaryManifest.uncompressedSizeBytes,
    });
    const stage = await readSaSourcePayload(options.stageCatalogPath, stageManifest.catalog);
    const awakening = await readSaSourcePayload(options.awakeningPayloadPath, awakeningManifest.payload);
    (0, game_db_stage_delivery_1.validateStageDeliveryRoutes)(stage.value, stageManifest);
    (0, game_db_awakening_medal_catalog_1.validateAwakeningMedalCatalog)(awakening.value);
    if (!Array.isArray(primary.value) || primary.value.length !== primaryManifest.characterCount) {
        throw new Error("Primary roster count mismatch");
    }
    for (const [manifest, payload] of [[stageManifest, stage.value], [awakeningManifest, awakening.value]]) {
        if (manifest.sourceSnapshotVersion !== metadata.dbVersion
            || payload.sourceSnapshotVersion !== metadata.dbVersion
            || manifest.sourceDatabaseSha256 !== stageManifest.sourceDatabaseSha256
            || payload.sourceDatabaseSha256 !== stageManifest.sourceDatabaseSha256
            || payload.datasetVersion !== manifest.datasetVersion)
            throw new Error("Incoherent SA source snapshot");
    }
    const tables = {};
    const inventory = [];
    for (const table of [...SOURCE_TABLES].sort()) {
        const bytes = await boundedRead((0, path_1.resolve)(options.firstPartyDir, "data", `${table}.csv`), INPUT_EXPANDED_LIMIT);
        inventory.push({ path: `data/${table}.csv`, sizeBytes: bytes.length, sha256: sha(bytes) });
        tables[table] = (0, game_db_source_1.parseGameDbTableCsvText)(bytes.toString("utf8"));
    }
    const build = (0, game_db_sa_training_1.buildSaTrainingIndex)({
        generatedAt: options.generatedAt,
        sourceSnapshotVersion: metadata.dbVersion,
        sourceDatabaseSha256: stageManifest.sourceDatabaseSha256,
        firstPartyTableInventorySha256: sha(Buffer.from(JSON.stringify(inventory))),
        tables, primaryCharacters: primary.value, primaryManifest,
        stageCatalog: stage.value, stageManifest, stagePayloadSha256: stage.sha256,
        awakeningCatalog: awakening.value, awakeningManifest, awakeningPayloadSha256: awakening.sha256,
    });
    const object = build.manifest.catalog;
    if (!/^sa-training\/objects\/[a-f0-9]{64}\.json\.gz$/.test(object.objectKey))
        throw new Error("Invalid candidate object key");
    const payloadPath = (0, path_1.resolve)(options.outputDir, ...object.objectKey.split("/"));
    if (!contained((0, path_1.resolve)(options.outputDir), payloadPath))
        throw new Error("Candidate object escaped output");
    await (0, promises_1.mkdir)(options.outputDir);
    await (0, promises_1.mkdir)((0, path_1.dirname)(payloadPath), { recursive: true });
    await (0, promises_1.writeFile)(payloadPath, build.catalogGzip, { flag: "wx" });
    await readSaSourcePayload(payloadPath, object);
    const reportPath = (0, path_1.resolve)(options.outputDir, "sa-training-audit.json");
    await (0, promises_1.writeFile)(reportPath, JSON.stringify({
        ...build.audit, sourceInventory: inventory, firstPartyMetadata: metadata,
        localOnly: true, primaryRosterUnchanged: true, publicationPerformed: false,
    }, null, 2) + "\n", { flag: "wx" });
    // Manifest last, including for local candidates.
    const manifestPath = (0, path_1.resolve)(options.outputDir, "sa-training-manifest.json");
    await (0, promises_1.writeFile)(manifestPath, JSON.stringify(build.manifest) + "\n", { flag: "wx" });
    return { manifestPath, reportPath, build };
}
exports.buildSaTrainingCandidate = buildSaTrainingCandidate;
if (require.main === module) {
    buildSaTrainingCandidate(parseSaTrainingArgs(process.argv.slice(2)))
        .then(result => console.log(JSON.stringify({ manifestPath: result.manifestPath, reportPath: result.reportPath })))
        .catch(error => { console.error(error.message); process.exitCode = 1; });
}
//# sourceMappingURL=game-db-sa-training-run.js.map