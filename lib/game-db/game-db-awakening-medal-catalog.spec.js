"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const assert_1 = require("assert");
const promises_1 = require("fs/promises");
const mocha_1 = require("mocha");
const os_1 = require("os");
const path_1 = require("path");
const game_db_awakening_medal_catalog_1 = require("./game-db-awakening-medal-catalog");
const game_db_awakening_medal_candidate_1 = require("./game-db-awakening-medal-candidate");
const SHA = "a".repeat(64);
function catalog() {
    return (0, game_db_awakening_medal_catalog_1.buildAwakeningMedalCatalog)({
        rows: [
            { id: "2", name: "Bubbles", description: "Silver medal", zeni: "500", rarity: "1", selling_exchange_point: "2", event_jumpable: "1" },
            { id: "1", name: "Gregory", description: "Bronze medal", zeni: "500", rarity: "0", selling_exchange_point: "1", event_jumpable: "0" },
            { id: "5", name: "Special", description: "Super medal", zeni: "0", rarity: "4", selling_exchange_point: "0", event_jumpable: "0" },
        ],
        generatedAt: "2026-09-06T12:00:00.000Z",
        sourceSnapshotVersion: "1788329250",
        sourceDatabaseSha256: SHA,
        assetBaseUrl: "https://assets.example.test/staging/v2/game-assets/",
    });
}
(0, mocha_1.describe)("official Awakening Medal catalog", () => {
    (0, mocha_1.it)("maps official rows deterministically with canonical image paths", () => {
        const value = catalog();
        (0, assert_1.deepEqual)(value.items.map(item => item.id), ["1", "2", "5"]);
        (0, assert_1.equal)(value.assetBaseUrl, "https://assets.example.test/staging/v2/game-assets");
        (0, assert_1.equal)(value.items[0].iconAssetPath, "item/awaken/en/thumb/thumb_awaken_items_00001/thumb_awaken_items_00001.png");
        (0, assert_1.equal)(value.items[1].eventJumpable, true);
        (0, assert_1.deepEqual)(value.countsByRarity, { bronze: 1, silver: 1, gold: 0, rainbow: 0, super: 1 });
    });
    (0, mocha_1.it)("produces byte-identical content-addressed delivery", () => {
        const first = (0, game_db_awakening_medal_catalog_1.buildAwakeningMedalDelivery)(catalog());
        const second = (0, game_db_awakening_medal_catalog_1.buildAwakeningMedalDelivery)(catalog());
        (0, assert_1.equal)(first.gzip.equals(second.gzip), true);
        (0, assert_1.equal)(first.manifest.payload.sha256, second.manifest.payload.sha256);
        (0, assert_1.equal)(first.manifest.payload.objectKey.endsWith(`${first.manifest.payload.sha256}.json.gz`), true);
    });
    (0, mocha_1.it)("rejects unknown rarity and duplicate IDs", () => {
        const base = {
            generatedAt: "2026-09-06T12:00:00.000Z",
            sourceSnapshotVersion: "1788329250",
            sourceDatabaseSha256: SHA,
            assetBaseUrl: "https://assets.example.test/game-assets",
        };
        (0, assert_1.throws)(() => (0, game_db_awakening_medal_catalog_1.buildAwakeningMedalCatalog)({ ...base, rows: [{ id: "1", name: "x", description: "x", zeni: "0", rarity: "5", selling_exchange_point: "0", event_jumpable: "0" }] }), /rarity/);
        (0, assert_1.throws)(() => (0, game_db_awakening_medal_catalog_1.buildAwakeningMedalCatalog)({ ...base, rows: [
                { id: "1", name: "x", description: "x", zeni: "0", rarity: "0", selling_exchange_point: "0", event_jumpable: "0" },
                { id: "1", name: "y", description: "y", zeni: "0", rarity: "0", selling_exchange_point: "0", event_jumpable: "0" },
            ] }), /Duplicate/);
        (0, assert_1.throws)(() => (0, game_db_awakening_medal_catalog_1.buildAwakeningMedalCatalog)({ ...base, rows: [
                { id: "01", name: "x", description: "x", zeni: "0", rarity: "0", selling_exchange_point: "0", event_jumpable: "0" },
            ] }), /canonical positive numeric ID/);
        (0, assert_1.throws)(() => (0, game_db_awakening_medal_catalog_1.buildAwakeningMedalCatalog)({ ...base, rows: [
                { id: "0", name: "x", description: "x", zeni: "0", rarity: "0", selling_exchange_point: "0", event_jumpable: "0" },
            ] }), /canonical positive numeric ID/);
    });
    (0, mocha_1.it)("requires explicit first-party source identity", () => {
        (0, assert_1.throws)(() => (0, game_db_awakening_medal_candidate_1.parseAwakeningMedalCandidateArgs)(["--source-data-dir", "db"]), /Missing Awakening Medal candidate argument/);
        const parsed = (0, game_db_awakening_medal_candidate_1.parseAwakeningMedalCandidateArgs)([
            "--source-data-dir", "db", "--source-snapshot-version", "1788329250",
            "--source-database-sha256", SHA, "--asset-base-url", "https://assets.example.test/game-assets",
            "--output-dir", "candidate", "--generated-at", "2026-09-06T12:00:00.000Z",
        ]);
        (0, assert_1.equal)(parsed.sourceSnapshotVersion, "1788329250");
    });
    (0, mocha_1.it)("binds first-party provenance to metadata, database digest, and table fingerprint", async () => {
        const root = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "awakening-medal-source-"));
        const data = (0, path_1.join)(root, "data");
        await (0, promises_1.mkdir)(data);
        const table = Buffer.from("id,name\n1,Gregory\n", "utf8");
        await (0, promises_1.writeFile)((0, path_1.join)(data, "awakening_items.csv"), table);
        await (0, promises_1.writeFile)((0, path_1.join)(root, "metadata.json"), JSON.stringify({
            source: "first-party-export",
            region: "global",
            exportedAt: "2026-09-06T12:00:00.000Z",
            dbVersion: "snapshot-test",
            apkVersion: "6.5.5",
        }));
        const options = {
            sourceDataDir: data,
            sourceSnapshotVersion: "snapshot-test",
            sourceDatabaseSha256: SHA,
            assetBaseUrl: "https://assets.example.test/game-assets",
            outputDir: (0, path_1.join)(root, "candidate"),
            generatedAt: "2026-09-06T12:00:00.000Z",
        };
        const profile = {
            databaseSha256: SHA,
            awakeningItemsSha256: (0, crypto_1.createHash)("sha256").update(table).digest("hex"),
        };
        try {
            await (0, game_db_awakening_medal_candidate_1.validateAwakeningMedalFirstPartySource)(options, profile);
            await (0, assert_1.rejects)((0, game_db_awakening_medal_candidate_1.validateAwakeningMedalFirstPartySource)({ ...options, sourceDatabaseSha256: "b".repeat(64) }, profile), /database digest/);
            await (0, assert_1.rejects)((0, game_db_awakening_medal_candidate_1.validateAwakeningMedalFirstPartySource)(options, { ...profile, awakeningItemsSha256: "b".repeat(64) }), /table fingerprint/);
            await (0, promises_1.writeFile)((0, path_1.join)(root, "metadata.json"), JSON.stringify({
                source: "third-party-scrape",
                region: "global",
                exportedAt: "2026-09-06T12:00:00.000Z",
                dbVersion: "snapshot-test",
                apkVersion: "6.5.5",
            }));
            await (0, assert_1.rejects)((0, game_db_awakening_medal_candidate_1.validateAwakeningMedalFirstPartySource)(options, profile), /official Global export/);
        }
        finally {
            await (0, promises_1.rm)(root, { recursive: true, force: true });
        }
    });
});
//# sourceMappingURL=game-db-awakening-medal-catalog.spec.js.map