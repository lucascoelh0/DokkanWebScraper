import { mkdir, readFile } from "fs/promises";
import { resolve } from "path";
import { DokkanStatsSupportMemoryDataset } from "./dokkanstats-support-memories";
import { writeFormattedJson } from "./format-json";
import { StageDetailsDataset } from "./stage-detail";
import { writeSupportMemoryDatasetManifest } from "./support-memory-dataset-artifacts";
import { SupportMemoryDetailsDataset } from "./support-memory-details";
import { buildSupportMemoryHowToGet } from "./support-memory-how-to-get";

interface Options {
    supportMemoriesPath: string,
    stagesPath: string,
    dokkanStatsPath: string,
    outputDir: string,
}

export function parseSupportMemoryHowToGetArgs(args: string[]): Options {
    const values = new Map<string, string>();
    const supported = new Set(["--support-memories", "--stages", "--dokkanstats", "--output-dir"]);
    for (let index = 0; index < args.length; index += 1) {
        const token = args[index];
        const separator = token.indexOf("=");
        const key = separator >= 0 ? token.slice(0, separator) : token;
        if (!supported.has(key)) throw new Error(`Unexpected how-to-get argument: ${token}`);
        const value = separator >= 0 ? token.slice(separator + 1) : args[++index];
        if (!value || values.has(key)) throw new Error(`Missing or duplicate how-to-get argument: ${key}`);
        values.set(key, value);
    }
    for (const key of supported) if (!values.has(key)) throw new Error(`Missing how-to-get argument: ${key}`);
    return {
        supportMemoriesPath: resolve(values.get("--support-memories")!),
        stagesPath: resolve(values.get("--stages")!),
        dokkanStatsPath: resolve(values.get("--dokkanstats")!),
        outputDir: resolve(values.get("--output-dir")!),
    };
}

async function readJson<T>(path: string): Promise<T> {
    return JSON.parse(await readFile(path, "utf8")) as T;
}

async function main(): Promise<void> {
    const options = parseSupportMemoryHowToGetArgs(process.argv.slice(2));
    const result = buildSupportMemoryHowToGet({
        supportMemories: await readJson<SupportMemoryDetailsDataset>(options.supportMemoriesPath),
        stages: await readJson<StageDetailsDataset>(options.stagesPath),
        dokkanStats: await readJson<DokkanStatsSupportMemoryDataset>(options.dokkanStatsPath),
    });
    await mkdir(options.outputDir, { recursive: false });
    const detailsPath = resolve(options.outputDir, "support-memory-details.json");
    await writeFormattedJson(detailsPath, result.dataset);
    await writeFormattedJson(resolve(options.outputDir, "support-memory-how-to-get-audit.json"), result.audit);
    await writeSupportMemoryDatasetManifest(
        result.dataset,
        detailsPath,
        resolve(options.outputDir, "support-memory-manifest.json"),
    );
    console.log(JSON.stringify({ outputDir: options.outputDir, counts: result.audit.counts, unmatched: result.audit.unmatched }, null, 2));
}

if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
