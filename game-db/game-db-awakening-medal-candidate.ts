import { createHash } from "crypto";
import { mkdir, readFile, stat, writeFile } from "fs/promises";
import { dirname, resolve } from "path";
import {
    AwakeningMedalSourceTables,
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
    tableSha256: Record<keyof AwakeningMedalSourceTables, string>,
}

const REQUIRED_TABLES: Array<keyof AwakeningMedalSourceTables> = [
    "awakening_items",
    "cards",
    "card_awakening_routes",
    "card_awakening_sets",
    "card_awakenings",
    "optimal_awakening_growths",
];

const PINNED_FIRST_PARTY_SOURCES: Record<string, AwakeningMedalPinnedSourceProfile> = {
    "1788329250": {
        databaseSha256: "7a6ca01808aea355ef28f9c0190e2c072f43a7c08be41d363f5b052824922495",
        tableSha256: {
            awakening_items: "f03b0b442b259d0d7b6d6b0c9b286477d2ebf586f9c9273e3ba282443abfe486",
            cards: "cd296c63bfa4732030ec8e4394379920bdb39ca9aa7df3537c3ee7c3657cb21a",
            card_awakening_routes: "5ea594f60e03215175c9c2c42ff00e46598cfc7e657e7ebf121bdc2f3d040797",
            card_awakening_sets: "a6847f3a46b8809eeb9a39797fe8b4cb356faee99b6664a12a5edd185caeb979",
            card_awakenings: "9552f62a0e3d570dcdc88d8d24bb00a8743f1a44241a7df24f9d6d3d4de9a099",
            optimal_awakening_growths: "5ef37a91c34811a87b310b3c83521e12dfb5199d291b56b26bc0a51215a20e5f",
        },
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
    const sourceConfig = { sourceRoot: options.sourceDataDir, dataDir: options.sourceDataDir };
    const tables = Object.fromEntries(await Promise.all(REQUIRED_TABLES.map(async table => [
        table,
        await readGameDbTable(sourceConfig, table),
    ]))) as unknown as AwakeningMedalSourceTables;
    const catalog = buildAwakeningMedalCatalog({ ...options, tables });
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
        routeCardCount: catalog.routeGraph.cards.length,
        routeCount: catalog.routeGraph.routes.length,
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
    for (const table of REQUIRED_TABLES) {
        const tableBytes = await readFile(resolve(options.sourceDataDir, `${table}.csv`));
        const tableSha = createHash("sha256").update(tableBytes).digest("hex");
        if (tableSha !== profile.tableSha256[table]) {
            throw new Error(`Awakening Medal ${table} fingerprint does not match the pinned first-party profile`);
        }
    }
}

if (require.main === module) {
    buildAwakeningMedalCandidate(parseAwakeningMedalCandidateArgs(process.argv.slice(2))).catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
