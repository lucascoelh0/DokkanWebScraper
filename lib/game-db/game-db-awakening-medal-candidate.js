"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateAwakeningMedalFirstPartySource = exports.buildAwakeningMedalCandidate = exports.parseAwakeningMedalCandidateArgs = void 0;
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const game_db_awakening_medal_catalog_1 = require("./game-db-awakening-medal-catalog");
const game_db_source_1 = require("./game-db-source");
const REQUIRED_TABLES = [
    "awakening_items",
    "cards",
    "card_awakening_routes",
    "card_awakening_sets",
    "card_awakenings",
    "optimal_awakening_growths",
];
const PINNED_FIRST_PARTY_SOURCES = {
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
function parseAwakeningMedalCandidateArgs(args) {
    const supported = new Set([
        "--source-data-dir", "--source-snapshot-version", "--source-database-sha256",
        "--asset-base-url", "--output-dir", "--generated-at",
    ]);
    const values = new Map();
    for (let index = 0; index < args.length; index += 1) {
        const token = args[index];
        const separator = token.indexOf("=");
        const key = separator >= 0 ? token.slice(0, separator) : token;
        if (!supported.has(key))
            throw new Error(`Unexpected Awakening Medal candidate argument: ${token}`);
        const value = separator >= 0 ? token.slice(separator + 1) : args[++index];
        if (!value || values.has(key))
            throw new Error(`Missing or duplicate Awakening Medal candidate argument: ${key}`);
        values.set(key, value);
    }
    for (const key of ["--source-data-dir", "--source-snapshot-version", "--source-database-sha256", "--asset-base-url", "--output-dir"]) {
        if (!values.has(key))
            throw new Error(`Missing Awakening Medal candidate argument: ${key}`);
    }
    const generatedAt = values.get("--generated-at") ?? new Date().toISOString();
    if (Number.isNaN(Date.parse(generatedAt)))
        throw new Error("Invalid --generated-at");
    return {
        sourceDataDir: (0, path_1.resolve)(values.get("--source-data-dir")),
        sourceSnapshotVersion: values.get("--source-snapshot-version"),
        sourceDatabaseSha256: values.get("--source-database-sha256"),
        assetBaseUrl: values.get("--asset-base-url"),
        outputDir: (0, path_1.resolve)(values.get("--output-dir")),
        generatedAt,
    };
}
exports.parseAwakeningMedalCandidateArgs = parseAwakeningMedalCandidateArgs;
async function requireMissing(path) {
    try {
        await (0, promises_1.stat)(path);
        throw new Error(`Awakening Medal candidate output must not already exist: ${path}`);
    }
    catch (error) {
        if (error.code !== "ENOENT")
            throw error;
    }
}
async function buildAwakeningMedalCandidate(options) {
    await requireMissing(options.outputDir);
    await validateAwakeningMedalFirstPartySource(options);
    const sourceConfig = { sourceRoot: options.sourceDataDir, dataDir: options.sourceDataDir };
    const tables = Object.fromEntries(await Promise.all(REQUIRED_TABLES.map(async (table) => [
        table,
        await (0, game_db_source_1.readGameDbTable)(sourceConfig, table),
    ])));
    const catalog = (0, game_db_awakening_medal_catalog_1.buildAwakeningMedalCatalog)({ ...options, tables });
    const delivery = (0, game_db_awakening_medal_catalog_1.buildAwakeningMedalDelivery)(catalog);
    await (0, promises_1.mkdir)(options.outputDir, { recursive: true });
    await (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, "awakening-medals.json"), delivery.bytes, { flag: "wx" });
    await (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, "awakening-medals.json.gz"), delivery.gzip, { flag: "wx" });
    await (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, "awakening-medals-manifest.json"), `${JSON.stringify(delivery.manifest, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
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
exports.buildAwakeningMedalCandidate = buildAwakeningMedalCandidate;
async function validateAwakeningMedalFirstPartySource(options, profile = PINNED_FIRST_PARTY_SOURCES[options.sourceSnapshotVersion]) {
    if (!profile)
        throw new Error(`Awakening Medal snapshot ${options.sourceSnapshotVersion} is not pinned`);
    if (profile.databaseSha256 !== options.sourceDatabaseSha256) {
        throw new Error("Awakening Medal source database digest does not match the pinned first-party profile");
    }
    const metadataPath = (0, path_1.resolve)((0, path_1.dirname)(options.sourceDataDir), "metadata.json");
    const metadata = JSON.parse(await (0, promises_1.readFile)(metadataPath, "utf8"));
    if (metadata.source !== "first-party-export" || metadata.region !== "global"
        || metadata.dbVersion !== options.sourceSnapshotVersion || !metadata.apkVersion
        || !metadata.exportedAt || Number.isNaN(Date.parse(metadata.exportedAt))) {
        throw new Error("Awakening Medal source metadata is not a matching official Global export");
    }
    for (const table of REQUIRED_TABLES) {
        const tableBytes = await (0, promises_1.readFile)((0, path_1.resolve)(options.sourceDataDir, `${table}.csv`));
        const tableSha = (0, crypto_1.createHash)("sha256").update(tableBytes).digest("hex");
        if (tableSha !== profile.tableSha256[table]) {
            throw new Error(`Awakening Medal ${table} fingerprint does not match the pinned first-party profile`);
        }
    }
}
exports.validateAwakeningMedalFirstPartySource = validateAwakeningMedalFirstPartySource;
if (require.main === module) {
    buildAwakeningMedalCandidate(parseAwakeningMedalCandidateArgs(process.argv.slice(2))).catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
//# sourceMappingURL=game-db-awakening-medal-candidate.js.map