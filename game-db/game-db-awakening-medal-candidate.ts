import { createHash } from "crypto";
import { mkdir, readFile, stat, writeFile } from "fs/promises";
import { dirname, resolve } from "path";
import {
    buildAwakeningMedalCatalog,
    buildAwakeningMedalDelivery,
} from "./game-db-awakening-medal-catalog";
import { readGameDbTable } from "./game-db-source";

export interface AwakeningMedalCandidateOptions {
    sourceDataDir: string,
    sourceSnapshotVersion: string,
    sourceDatabaseSha256: string,
    assetBaseUrl: string,
    outputDir: string,
    generatedAt: string,
}

interface FirstPartyExportMetadata {
    source?: string,
    region?: string,
    exportedAt?: string,
    dbVersion?: string,
    apkVersion?: string,
}

export interface AwakeningMedalPinnedSourceProfile {
    databaseSha256: string,
    awakeningItemsSha256: string,
}

const PINNED_FIRST_PARTY_SOURCES: Record<string, AwakeningMedalPinnedSourceProfile> = {
    "1788329250": {
        databaseSha256: "7a6ca01808aea355ef28f9c0190e2c072f43a7c08be41d363f5b052824922495",
        awakeningItemsSha256: "f03b0b442b259d0d7b6d6b0c9b286477d2ebf586f9c9273e3ba282443abfe486",
    },
};

export function parseAwakeningMedalCandidateArgs(args: string[]): AwakeningMedalCandidateOptions {
    const supported = new Set([
        "--source-data-dir", "--source-snapshot-version", "--source-database-sha256",
        "--asset-base-url", "--output-dir", "--generated-at",
    ]);
    const values = new Map<string, string>();
    for (let index = 0; index < args.length; index += 1) {
        const token = args[index];
        const separator = token.indexOf("=");
        const key = separator >= 0 ? token.slice(0, separator) : token;
        if (!supported.has(key)) throw new Error(`Unexpected Awakening Medal candidate argument: ${token}`);
        const value = separator >= 0 ? token.slice(separator + 1) : args[++index];
        if (!value || values.has(key)) throw new Error(`Missing or duplicate Awakening Medal candidate argument: ${key}`);
        values.set(key, value);
    }
    for (const key of ["--source-data-dir", "--source-snapshot-version", "--source-database-sha256", "--asset-base-url", "--output-dir"]) {
        if (!values.has(key)) throw new Error(`Missing Awakening Medal candidate argument: ${key}`);
    }
    const generatedAt = values.get("--generated-at") ?? new Date().toISOString();
    if (Number.isNaN(Date.parse(generatedAt))) throw new Error("Invalid --generated-at");
    return {
        sourceDataDir: resolve(values.get("--source-data-dir")!),
        sourceSnapshotVersion: values.get("--source-snapshot-version")!,
        sourceDatabaseSha256: values.get("--source-database-sha256")!,
        assetBaseUrl: values.get("--asset-base-url")!,
        outputDir: resolve(values.get("--output-dir")!),
        generatedAt,
    };
}

async function requireMissing(path: string): Promise<void> {
    try {
        await stat(path);
        throw new Error(`Awakening Medal candidate output must not already exist: ${path}`);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
}

export async function buildAwakeningMedalCandidate(options: AwakeningMedalCandidateOptions): Promise<void> {
    await requireMissing(options.outputDir);
    await validateAwakeningMedalFirstPartySource(options);
    const rows = await readGameDbTable({ sourceRoot: options.sourceDataDir, dataDir: options.sourceDataDir }, "awakening_items");
    const catalog = buildAwakeningMedalCatalog({ ...options, rows });
    const delivery = buildAwakeningMedalDelivery(catalog);
    await mkdir(options.outputDir, { recursive: true });
    await writeFile(resolve(options.outputDir, "awakening-medals.json"), delivery.bytes, { flag: "wx" });
    await writeFile(resolve(options.outputDir, "awakening-medals.json.gz"), delivery.gzip, { flag: "wx" });
    await writeFile(resolve(options.outputDir, "awakening-medals-manifest.json"), `${JSON.stringify(delivery.manifest, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    console.log(JSON.stringify({
        outputDir: options.outputDir,
        datasetVersion: catalog.datasetVersion,
        count: catalog.count,
        countsByRarity: catalog.countsByRarity,
        payload: delivery.manifest.payload,
    }, null, 2));
}

export async function validateAwakeningMedalFirstPartySource(
    options: AwakeningMedalCandidateOptions,
    profile = PINNED_FIRST_PARTY_SOURCES[options.sourceSnapshotVersion],
): Promise<void> {
    if (!profile) throw new Error(`Awakening Medal snapshot ${options.sourceSnapshotVersion} is not pinned`);
    if (profile.databaseSha256 !== options.sourceDatabaseSha256) {
        throw new Error("Awakening Medal source database digest does not match the pinned first-party profile");
    }
    const metadataPath = resolve(dirname(options.sourceDataDir), "metadata.json");
    const metadata = JSON.parse(await readFile(metadataPath, "utf8")) as FirstPartyExportMetadata;
    if (metadata.source !== "first-party-export" || metadata.region !== "global"
        || metadata.dbVersion !== options.sourceSnapshotVersion || !metadata.apkVersion
        || !metadata.exportedAt || Number.isNaN(Date.parse(metadata.exportedAt))) {
        throw new Error("Awakening Medal source metadata is not a matching official Global export");
    }
    const tableBytes = await readFile(resolve(options.sourceDataDir, "awakening_items.csv"));
    const tableSha = createHash("sha256").update(tableBytes).digest("hex");
    if (tableSha !== profile.awakeningItemsSha256) {
        throw new Error("Awakening Medal table fingerprint does not match the pinned first-party profile");
    }
}

if (require.main === module) {
    buildAwakeningMedalCandidate(parseAwakeningMedalCandidateArgs(process.argv.slice(2))).catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
