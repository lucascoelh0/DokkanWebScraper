"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const path_1 = require("path");
const game_db_treasure_catalog_1 = require("./game-db-treasure-catalog");
/** Node 24+, offline and read-only. Explicit provenance prevents accidental snapshot mixing. */
async function run() {
    const [databasePath, snapshot, expectedSha256, outputPath] = process.argv.slice(2);
    if (!databasePath || !outputPath || !/^\d+$/.test(snapshot ?? "") || !/^[a-f0-9]{64}$/.test(expectedSha256 ?? "")) {
        throw Error("Usage: <database.sqlite> <snapshot> <expected-sha256> <new-output-directory>");
    }
    const hash = (0, crypto_1.createHash)("sha256");
    for await (const chunk of (0, fs_1.createReadStream)(databasePath))
        hash.update(chunk);
    if (hash.digest("hex") !== expectedSha256)
        throw Error("Database SHA-256 mismatch");
    const { DatabaseSync } = require("node:sqlite");
    const db = new DatabaseSync(databasePath, { readOnly: true });
    const tables = {};
    try {
        for (const table of ["treasure_items", "missions", "mission_rewards", "areas", "quests",
            "sugoroku_maps", "sugoroku_map_boss_drop_items", "quest_drop_item_views"]) {
            tables[table] = db.prepare(`SELECT * FROM ${table}`).all().map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value == null ? "" : String(value)])));
        }
    }
    finally {
        db.close();
    }
    const result = (0, game_db_treasure_catalog_1.buildTreasureCatalog)(tables, snapshot, expectedSha256);
    (0, fs_1.mkdirSync)((0, path_1.resolve)(outputPath)); // Never overwrite an existing candidate.
    (0, fs_1.writeFileSync)((0, path_1.resolve)(outputPath, "manifest.json"), JSON.stringify(result.manifest, null, 2) + "\n", { flag: "wx" });
    (0, fs_1.writeFileSync)((0, path_1.resolve)(outputPath, "catalog.payload"), result.compressed, { flag: "wx" });
    console.log(JSON.stringify({ treasures: result.catalog.treasures.length, sources: result.catalog.sources.length,
        coveredTreasures: new Set(result.catalog.sources.map(s => s.treasureId)).size, ...result.manifest }));
}
if (require.main === module)
    run().catch(error => { console.error(error.message); process.exitCode = 1; });
//# sourceMappingURL=game-db-treasure-catalog-run.js.map