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
function tables() {
    return {
        awakening_items: [
            { id: "2", name: "Bubbles", description: "Silver medal", zeni: "500", rarity: "1", selling_exchange_point: "2", event_jumpable: "1" },
            { id: "1", name: "Gregory", description: "Bronze medal", zeni: "500", rarity: "0", selling_exchange_point: "1", event_jumpable: "0" },
            { id: "5", name: "Special", description: "Super medal", zeni: "1000", rarity: "4", selling_exchange_point: "0", event_jumpable: "0" },
        ],
        cards: [
            { id: "100", character_id: "10", name: "Base", rarity: "2", element: "0", resource_id: "", optimal_awakening_grow_type: "", open_at: "2026-01-01 00:00:00" },
            { id: "101", character_id: "10", name: "Awakened", rarity: "3", element: "10", resource_id: "100", optimal_awakening_grow_type: "7", open_at: "2026-01-02 00:00:00" },
        ],
        card_awakening_sets: [{ id: "10" }, { id: "11" }],
        card_awakenings: [
            { id: "20", num: "1", awakening_item_id: "1", quantity: "2", card_awakening_set_id: "10" },
            { id: "22", num: "1", awakening_item_id: "2", quantity: "1", card_awakening_set_id: "10" },
            { id: "21", num: "1", awakening_item_id: "5", quantity: "3", card_awakening_set_id: "11" },
        ],
        card_awakening_routes: [
            { id: "30", type: "CardAwakeningRoute::Zet", card_id: "100", awaked_card_id: "101", card_awakening_set_id: "10", optimal_awakening_type: "0", optimal_awakening_step: "", open_at: "2026-01-02 00:00:00" },
            { id: "31", type: "CardAwakeningRoute::Optimal", card_id: "101", awaked_card_id: "101", card_awakening_set_id: "11", optimal_awakening_type: "1", optimal_awakening_step: "1", open_at: "2026-02-01 00:00:00" },
        ],
        optimal_awakening_growths: [{ id: "40", optimal_awakening_grow_type: "7", step: "1" }],
    };
}
function catalog() {
    return (0, game_db_awakening_medal_catalog_1.buildAwakeningMedalCatalog)({
        tables: tables(),
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
        (0, assert_1.equal)(value.routeGraph.cards.length, 2);
        (0, assert_1.deepEqual)(value.routeGraph.routes[0].requirements.map(item => item.rowId), ["20", "22"]);
        (0, assert_1.equal)(value.routeGraph.routes[1].optimalAwakeningGrowthId, "40");
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
        (0, assert_1.throws)(() => (0, game_db_awakening_medal_catalog_1.buildAwakeningMedalCatalog)({ ...base, tables: { ...tables(), awakening_items: [{ id: "1", name: "x", description: "x", zeni: "0", rarity: "5", selling_exchange_point: "0", event_jumpable: "0" }] } }), /rarity/);
        (0, assert_1.throws)(() => (0, game_db_awakening_medal_catalog_1.buildAwakeningMedalCatalog)({ ...base, tables: { ...tables(), awakening_items: [
                    { id: "1", name: "x", description: "x", zeni: "0", rarity: "0", selling_exchange_point: "0", event_jumpable: "0" },
                    { id: "1", name: "y", description: "y", zeni: "0", rarity: "0", selling_exchange_point: "0", event_jumpable: "0" },
                ] } }), /Duplicate/);
        (0, assert_1.throws)(() => (0, game_db_awakening_medal_catalog_1.buildAwakeningMedalCatalog)({ ...base, tables: { ...tables(), awakening_items: [
                    { id: "01", name: "x", description: "x", zeni: "0", rarity: "0", selling_exchange_point: "0", event_jumpable: "0" },
                ] } }), /canonical positive numeric ID/);
        (0, assert_1.throws)(() => (0, game_db_awakening_medal_catalog_1.buildAwakeningMedalCatalog)({ ...base, tables: { ...tables(), awakening_items: [
                    { id: "0", name: "x", description: "x", zeni: "0", rarity: "0", selling_exchange_point: "0", event_jumpable: "0" },
                ] } }), /canonical positive numeric ID/);
    });
    (0, mocha_1.it)("rejects branching rather than guessing an awakening chain", () => {
        const source = tables();
        source.cards.push({
            id: "102", character_id: "11", name: "Branch", rarity: "3", element: "11",
            resource_id: "", optimal_awakening_grow_type: "", open_at: "2026-01-03 00:00:00",
        });
        source.card_awakening_routes.push({
            id: "32", type: "CardAwakeningRoute::Dokkan", card_id: "100", awaked_card_id: "102",
            card_awakening_set_id: "10", optimal_awakening_type: "0", optimal_awakening_step: "",
            open_at: "2026-01-03 00:00:00",
        });
        (0, assert_1.throws)(() => (0, game_db_awakening_medal_catalog_1.buildAwakeningMedalCatalog)({
            tables: source,
            generatedAt: "2026-09-06T12:00:00.000Z",
            sourceSnapshotVersion: "1788329250",
            sourceDatabaseSha256: SHA,
            assetBaseUrl: "https://assets.example.test/game-assets",
        }), /branches/);
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
        const tableNames = [
            "awakening_items", "cards", "card_awakening_routes", "card_awakening_sets",
            "card_awakenings", "optimal_awakening_growths",
        ];
        const tableBytes = Object.fromEntries(tableNames.map(name => [
            name,
            Buffer.from(`id,name\n1,${name}\n`, "utf8"),
        ]));
        await Promise.all(tableNames.map(name => (0, promises_1.writeFile)((0, path_1.join)(data, `${name}.csv`), tableBytes[name])));
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
            tableSha256: Object.fromEntries(tableNames.map(name => [
                name,
                (0, crypto_1.createHash)("sha256").update(tableBytes[name]).digest("hex"),
            ])),
        };
        try {
            await (0, game_db_awakening_medal_candidate_1.validateAwakeningMedalFirstPartySource)(options, profile);
            await (0, assert_1.rejects)((0, game_db_awakening_medal_candidate_1.validateAwakeningMedalFirstPartySource)({ ...options, sourceDatabaseSha256: "b".repeat(64) }, profile), /database digest/);
            await (0, assert_1.rejects)((0, game_db_awakening_medal_candidate_1.validateAwakeningMedalFirstPartySource)(options, {
                ...profile,
                tableSha256: { ...profile.tableSha256, awakening_items: "b".repeat(64) },
            }), /awakening_items fingerprint/);
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