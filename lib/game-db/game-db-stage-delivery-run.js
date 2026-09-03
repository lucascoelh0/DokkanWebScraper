"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseStageDeliveryRunArgs = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
const format_json_1 = require("../format-json");
const game_db_stage_delivery_1 = require("./game-db-stage-delivery");
function parseStageDeliveryRunArgs(args) {
    const values = new Map();
    const supported = new Set(["--dataset", "--output-dir", "--compression-level"]);
    for (let index = 0; index < args.length; index += 1) {
        const token = args[index];
        const [name, inlineValue] = token.split("=", 2);
        if (!supported.has(name))
            throw new Error(`Unexpected Stage delivery argument: ${token}`);
        const value = inlineValue ?? args[++index];
        if (!value || value.startsWith("--") || values.has(name)) {
            throw new Error(`Missing or duplicate Stage delivery argument: ${name}`);
        }
        values.set(name, value);
    }
    for (const name of ["--dataset", "--output-dir"]) {
        if (!values.has(name))
            throw new Error(`Missing Stage delivery argument: ${name}`);
    }
    const compressionLevel = Number(values.get("--compression-level") ?? "9");
    if (!Number.isSafeInteger(compressionLevel) || compressionLevel < 1 || compressionLevel > 9) {
        throw new Error("Stage delivery compression level must be an integer from 1 to 9");
    }
    return {
        datasetPath: (0, path_1.resolve)(values.get("--dataset")),
        outputDir: (0, path_1.resolve)(values.get("--output-dir")),
        compressionLevel,
    };
}
exports.parseStageDeliveryRunArgs = parseStageDeliveryRunArgs;
async function requireMissing(path) {
    try {
        await (0, promises_1.stat)(path);
        throw new Error(`Stage delivery output must not already exist: ${path}`);
    }
    catch (error) {
        if (error.code !== "ENOENT")
            throw error;
    }
}
async function main() {
    const options = parseStageDeliveryRunArgs(process.argv.slice(2));
    await requireMissing(options.outputDir);
    const dataset = JSON.parse(await (0, promises_1.readFile)(options.datasetPath, "utf8"));
    const delivery = (0, game_db_stage_delivery_1.buildStageDelivery)(dataset, undefined, options.compressionLevel);
    await (0, promises_1.mkdir)(options.outputDir, { recursive: false });
    await (0, format_json_1.writeFormattedJson)((0, path_1.resolve)(options.outputDir, "stage-details-manifest.json"), delivery.manifest);
    await (0, format_json_1.writeFormattedJson)((0, path_1.resolve)(options.outputDir, "stage-delivery-audit.json"), delivery.audit);
    const files = [
        { object: delivery.manifest.catalog, bytes: delivery.catalogGzip },
        ...delivery.shards.map(shard => ({ object: shard.manifest, bytes: shard.gzip })),
    ];
    for (const file of files) {
        const path = (0, path_1.resolve)(options.outputDir, ...file.object.objectKey.split("/"));
        await (0, promises_1.mkdir)((0, path_1.dirname)(path), { recursive: true });
        await (0, promises_1.writeFile)(path, file.bytes, { flag: "wx" });
    }
    console.log(JSON.stringify({ outputDir: options.outputDir, manifest: delivery.manifest, audit: delivery.audit }, null, 2));
}
if (require.main === module) {
    main().catch(error => {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    });
}
//# sourceMappingURL=game-db-stage-delivery-run.js.map