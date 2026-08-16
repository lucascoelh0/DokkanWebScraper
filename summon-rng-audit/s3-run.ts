import { open } from "fs/promises";
import { resolve } from "path";
import { TextDecoder } from "util";
import { validateS3ObservationDataset } from "./s3-observation-contract";

const MAX_DATASET_BYTES = 16 * 1024 * 1024;

export function parseS3DatasetBytes(bytes: Buffer): unknown {
    try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
    catch { throw new Error("Dataset is not valid UTF-8 JSON"); }
}

function datasetPath(): string {
    const index = process.argv.indexOf("--dataset");
    if (index < 0 || !process.argv[index + 1]) throw new Error("Missing required --dataset");
    return resolve(process.argv[index + 1]);
}

async function run(): Promise<void> {
    const path = datasetPath();
    const handle = await open(path, "r");
    let bytes: Buffer;
    try {
        const stat = await handle.stat();
        if (!stat.isFile()) throw new Error(`Not a regular file: ${path}`);
        if (stat.size <= 0 || stat.size > MAX_DATASET_BYTES) throw new Error(`Dataset size outside 1..${MAX_DATASET_BYTES}: ${stat.size}`);
        bytes = await handle.readFile();
    } finally { await handle.close(); }
    const parsed = parseS3DatasetBytes(bytes);
    const validation = validateS3ObservationDataset(parsed);
    if (!validation.valid) throw new Error(validation.failures.join("; "));
    process.stdout.write(`${JSON.stringify(validation, null, 2)}\n`);
}

if (require.main === module) run().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
