"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = require("fs/promises");
const path_1 = require("path");
const game_db_source_1 = require("./game-db-source");
const game_db_treasure_exchanges_1 = require("./game-db-treasure-exchanges");
async function main() {
    const args = process.argv.slice(2), opts = new Map();
    const allowed = ["--input", "--source-dir", "--source-db-sha", "--source-snapshot", "--asset-base-url", "--output"];
    for (let i = 0; i < args.length; i += 2) {
        if (!allowed.includes(args[i]) || !args[i + 1] || opts.has(args[i]))
            throw Error("Invalid arguments");
        opts.set(args[i], args[i + 1]);
    }
    if (opts.size !== allowed.length)
        throw Error("All input, source, provenance, asset and output arguments are required");
    const sourceDir = (0, path_1.resolve)(opts.get("--source-dir"));
    const meta = JSON.parse(await (0, promises_1.readFile)((0, path_1.join)(sourceDir, "metadata.json"), "utf8"));
    if (meta.dbVersion !== opts.get("--source-snapshot") || meta.region !== "global")
        throw Error("Source metadata mismatch");
    const table = async (name) => (0, game_db_source_1.parseGameDbTableCsvText)(await (0, promises_1.readFile)((0, path_1.join)(sourceDir, "data", `${name}.csv`), "utf8"));
    const inputText = await (0, promises_1.readFile)((0, path_1.resolve)(opts.get("--input")), "utf8");
    if (Buffer.byteLength(inputText) > 8 * 1024 * 1024)
        throw Error("Source too large");
    const [cards, awakeningItems, treasureItems] = await Promise.all([table("cards"), table("awakening_items"), table("treasure_items")]);
    const result = (0, game_db_treasure_exchanges_1.buildTreasureExchanges)(JSON.parse(inputText), {
        cards, awakeningItems, treasureItems, snapshotVersion: opts.get("--source-snapshot"),
        databaseSha256: opts.get("--source-db-sha"), assetBaseUrl: opts.get("--asset-base-url"),
    });
    const output = (0, path_1.resolve)(opts.get("--output"));
    await (0, promises_1.mkdir)(output, { recursive: false });
    await (0, promises_1.writeFile)((0, path_1.join)(output, "treasure-exchanges.json.gz"), result.gzip, { flag: "wx" });
    await (0, promises_1.writeFile)((0, path_1.join)(output, "treasure-exchanges-manifest.json"), JSON.stringify(result.manifest, null, 2) + "\n", { flag: "wx" });
    await (0, promises_1.writeFile)((0, path_1.join)(output, "coverage.json"), JSON.stringify(result.report, null, 2) + "\n", { flag: "wx" });
    console.log(JSON.stringify(result.report));
}
if (require.main === module)
    main().catch(() => { console.error("Exchange candidate rejected; no publication performed."); process.exitCode = 1; });
//# sourceMappingURL=game-db-treasure-exchanges-run.js.map