import { mkdir, readFile, stat, writeFile } from "fs/promises";
import { dirname, resolve } from "path";
import { writeFormattedJson } from "../format-json";
import { StageDetailsDataset } from "../stage-detail";
import { buildStageDelivery } from "./game-db-stage-delivery";

interface Options {
    datasetPath: string,
    outputDir: string,
    compressionLevel: number,
    assetBaseUrl?: string,
}

export function parseStageDeliveryRunArgs(args: string[]): Options {
    const values = new Map<string, string>();
    const supported = new Set(["--dataset", "--output-dir", "--compression-level", "--asset-base-url"]);
    for (let index = 0; index < args.length; index += 1) {
        const token = args[index];
        const [name, inlineValue] = token.split("=", 2);
        if (!supported.has(name)) throw new Error(`Unexpected Stage delivery argument: ${token}`);
        const value = inlineValue ?? args[++index];
        if (!value || value.startsWith("--") || values.has(name)) {
            throw new Error(`Missing or duplicate Stage delivery argument: ${name}`);
        }
        values.set(name, value);
    }
    for (const name of ["--dataset", "--output-dir"]) {
        if (!values.has(name)) throw new Error(`Missing Stage delivery argument: ${name}`);
    }
    const compressionLevel = Number(values.get("--compression-level") ?? "9");
    if (!Number.isSafeInteger(compressionLevel) || compressionLevel < 1 || compressionLevel > 9) {
        throw new Error("Stage delivery compression level must be an integer from 1 to 9");
    }
    return {
        datasetPath: resolve(values.get("--dataset")!),
        outputDir: resolve(values.get("--output-dir")!),
        compressionLevel,
        ...(values.get("--asset-base-url") ? { assetBaseUrl: values.get("--asset-base-url") } : {}),
    };
}

async function requireMissing(path: string): Promise<void> {
    try {
        await stat(path);
        throw new Error(`Stage delivery output must not already exist: ${path}`);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
}

async function main(): Promise<void> {
    const options = parseStageDeliveryRunArgs(process.argv.slice(2));
    await requireMissing(options.outputDir);
    const dataset = JSON.parse(await readFile(options.datasetPath, "utf8")) as StageDetailsDataset;
    const delivery = buildStageDelivery(dataset, undefined, options.compressionLevel, options.assetBaseUrl);
    await mkdir(options.outputDir, { recursive: false });
    await writeFormattedJson(resolve(options.outputDir, "stage-details-manifest.json"), delivery.manifest);
    await writeFormattedJson(resolve(options.outputDir, "stage-delivery-audit.json"), delivery.audit);
    const files = [
        { object: delivery.manifest.catalog, bytes: delivery.catalogGzip },
        ...delivery.shards.map(shard => ({ object: shard.manifest, bytes: shard.gzip })),
    ];
    for (const file of files) {
        const path = resolve(options.outputDir, ...file.object.objectKey.split("/"));
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, file.bytes, { flag: "wx" });
    }
    console.log(JSON.stringify({ outputDir: options.outputDir, manifest: delivery.manifest, audit: delivery.audit }, null, 2));
}

if (require.main === module) {
    main().catch(error => {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    });
}
