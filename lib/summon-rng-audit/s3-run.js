"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseS3DatasetBytes = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
const util_1 = require("util");
const s3_observation_contract_1 = require("./s3-observation-contract");
const MAX_DATASET_BYTES = 16 * 1024 * 1024;
function parseS3DatasetBytes(bytes) {
    try {
        return JSON.parse(new util_1.TextDecoder("utf-8", { fatal: true }).decode(bytes));
    }
    catch {
        throw new Error("Dataset is not valid UTF-8 JSON");
    }
}
exports.parseS3DatasetBytes = parseS3DatasetBytes;
function datasetPath() {
    const index = process.argv.indexOf("--dataset");
    if (index < 0 || !process.argv[index + 1])
        throw new Error("Missing required --dataset");
    return (0, path_1.resolve)(process.argv[index + 1]);
}
async function run() {
    const path = datasetPath();
    const handle = await (0, promises_1.open)(path, "r");
    let bytes;
    try {
        const stat = await handle.stat();
        if (!stat.isFile())
            throw new Error(`Not a regular file: ${path}`);
        if (stat.size <= 0 || stat.size > MAX_DATASET_BYTES)
            throw new Error(`Dataset size outside 1..${MAX_DATASET_BYTES}: ${stat.size}`);
        bytes = await handle.readFile();
    }
    finally {
        await handle.close();
    }
    const parsed = parseS3DatasetBytes(bytes);
    const validation = (0, s3_observation_contract_1.validateS3ObservationDataset)(parsed);
    if (!validation.valid)
        throw new Error(validation.failures.join("; "));
    process.stdout.write(`${JSON.stringify(validation, null, 2)}\n`);
}
if (require.main === module)
    run().catch(error => {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    });
//# sourceMappingURL=s3-run.js.map