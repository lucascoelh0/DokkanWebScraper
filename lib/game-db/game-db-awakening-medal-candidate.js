"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateAwakeningMedalFirstPartySource = exports.buildAwakeningMedalCandidate = exports.parseAwakeningMedalCandidateArgs = void 0;
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const game_db_awakening_medal_catalog_1 = require("./game-db-awakening-medal-catalog");
const game_db_source_1 = require("./game-db-source");
const PINNED_FIRST_PARTY_SOURCES = {
    "1788329250": {
        databaseSha256: "7a6ca01808aea355ef28f9c0190e2c072f43a7c08be41d363f5b052824922495",
        awakeningItemsSha256: "f03b0b442b259d0d7b6d6b0c9b286477d2ebf586f9c9273e3ba282443abfe486",
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
    const rows = await (0, game_db_source_1.readGameDbTable)({ sourceRoot: options.sourceDataDir, dataDir: options.sourceDataDir }, "awakening_items");
    const catalog = (0, game_db_awakening_medal_catalog_1.buildAwakeningMedalCatalog)({ ...options, rows });
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
    const tableBytes = await (0, promises_1.readFile)((0, path_1.resolve)(options.sourceDataDir, "awakening_items.csv"));
    const tableSha = (0, crypto_1.createHash)("sha256").update(tableBytes).digest("hex");
    if (tableSha !== profile.awakeningItemsSha256) {
        throw new Error("Awakening Medal table fingerprint does not match the pinned first-party profile");
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