import { createHash } from "crypto";
import { createReadStream, mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";
import { buildTreasureCatalog, TreasureSourceTables } from "./game-db-treasure-catalog";
import { TREASURE_MODE_TABLES } from "./game-db-treasure-mode-sources";

/** Node 24+, offline and read-only. Explicit provenance prevents accidental snapshot mixing. */
async function run() {
    const [databasePath, snapshot, expectedSha256, outputPath] = process.argv.slice(2);
    if (!databasePath || !outputPath || !/^\d+$/.test(snapshot ?? "") || !/^[a-f0-9]{64}$/.test(expectedSha256 ?? "")) {
        throw Error("Usage: <database.sqlite> <snapshot> <expected-sha256> <new-output-directory>");
    }
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(databasePath)) hash.update(chunk);
    if (hash.digest("hex") !== expectedSha256) throw Error("Database SHA-256 mismatch");
    const { DatabaseSync } = require("node:sqlite");
    const db = new DatabaseSync(databasePath, { readOnly: true });
    const tables = {} as TreasureSourceTables;
    try {
        for (const table of ["treasure_items", "missions", "mission_rewards", "areas", "quests",
            "sugoroku_maps", "sugoroku_map_boss_drop_items", "quest_drop_item_views", ...TREASURE_MODE_TABLES] as const) {
            tables[table] = db.prepare(`SELECT * FROM ${table}`).all().map(row =>
                Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value == null ? "" : String(value)])));
        }
    } finally { db.close(); }
    const result = buildTreasureCatalog(tables, snapshot, expectedSha256);
    mkdirSync(resolve(outputPath)); // Never overwrite an existing candidate.
    writeFileSync(resolve(outputPath, "manifest.json"), JSON.stringify(result.manifest, null, 2) + "\n", { flag: "wx" });
    writeFileSync(resolve(outputPath, "catalog.payload"), result.compressed, { flag: "wx" });
    console.log(JSON.stringify({ treasures: result.catalog.treasures.length, sources: result.catalog.sources.length,
        coveredTreasures: new Set(result.catalog.sources.map(s => s.treasureId)).size, ...result.manifest }));
}
if (require.main === module) run().catch(error => { console.error(error.message); process.exitCode = 1; });
