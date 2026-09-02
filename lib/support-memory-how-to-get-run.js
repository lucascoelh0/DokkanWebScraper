"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseSupportMemoryHowToGetArgs = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
const format_json_1 = require("./format-json");
const support_memory_dataset_artifacts_1 = require("./support-memory-dataset-artifacts");
const support_memory_how_to_get_1 = require("./support-memory-how-to-get");
function parseSupportMemoryHowToGetArgs(args) {
    const values = new Map();
    const supported = new Set(["--support-memories", "--stages", "--dokkanstats", "--output-dir"]);
    for (let index = 0; index < args.length; index += 1) {
        const token = args[index];
        const separator = token.indexOf("=");
        const key = separator >= 0 ? token.slice(0, separator) : token;
        if (!supported.has(key))
            throw new Error(`Unexpected how-to-get argument: ${token}`);
        const value = separator >= 0 ? token.slice(separator + 1) : args[++index];
        if (!value || values.has(key))
            throw new Error(`Missing or duplicate how-to-get argument: ${key}`);
        values.set(key, value);
    }
    for (const key of supported)
        if (!values.has(key))
            throw new Error(`Missing how-to-get argument: ${key}`);
    return {
        supportMemoriesPath: (0, path_1.resolve)(values.get("--support-memories")),
        stagesPath: (0, path_1.resolve)(values.get("--stages")),
        dokkanStatsPath: (0, path_1.resolve)(values.get("--dokkanstats")),
        outputDir: (0, path_1.resolve)(values.get("--output-dir")),
    };
}
exports.parseSupportMemoryHowToGetArgs = parseSupportMemoryHowToGetArgs;
async function readJson(path) {
    return JSON.parse(await (0, promises_1.readFile)(path, "utf8"));
}
async function main() {
    const options = parseSupportMemoryHowToGetArgs(process.argv.slice(2));
    const result = (0, support_memory_how_to_get_1.buildSupportMemoryHowToGet)({
        supportMemories: await readJson(options.supportMemoriesPath),
        stages: await readJson(options.stagesPath),
        dokkanStats: await readJson(options.dokkanStatsPath),
    });
    await (0, promises_1.mkdir)(options.outputDir, { recursive: false });
    const detailsPath = (0, path_1.resolve)(options.outputDir, "support-memory-details.json");
    await (0, format_json_1.writeFormattedJson)(detailsPath, result.dataset);
    await (0, format_json_1.writeFormattedJson)((0, path_1.resolve)(options.outputDir, "support-memory-how-to-get-audit.json"), result.audit);
    await (0, support_memory_dataset_artifacts_1.writeSupportMemoryDatasetManifest)(result.dataset, detailsPath, (0, path_1.resolve)(options.outputDir, "support-memory-manifest.json"));
    console.log(JSON.stringify({ outputDir: options.outputDir, counts: result.audit.counts, unmatched: result.audit.unmatched }, null, 2));
}
if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
//# sourceMappingURL=support-memory-how-to-get-run.js.map