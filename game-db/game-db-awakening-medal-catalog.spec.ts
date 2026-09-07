import { createHash } from "crypto";
import { deepEqual, equal, rejects, throws } from "assert";
import { mkdir, mkdtemp, rm, writeFile } from "fs/promises";
import { describe, it } from "mocha";
import { tmpdir } from "os";
import { join } from "path";
import {
    AwakeningMedalSourceTables,
    buildAwakeningMedalCatalog,
    buildAwakeningMedalDelivery,
} from "./game-db-awakening-medal-catalog";
import {
    AwakeningMedalCandidateOptions,
    parseAwakeningMedalCandidateArgs,
    validateAwakeningMedalFirstPartySource,
} from "./game-db-awakening-medal-candidate";

const SHA = "a".repeat(64);

function tables(): AwakeningMedalSourceTables {
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
    return buildAwakeningMedalCatalog({
        tables: tables(),
        generatedAt: "2026-09-06T12:00:00.000Z",
        sourceSnapshotVersion: "1788329250",
        sourceDatabaseSha256: SHA,
        assetBaseUrl: "https://assets.example.test/staging/v2/game-assets/",
    });
}

describe("official Awakening Medal catalog", () => {
    it("maps official rows deterministically with canonical image paths", () => {
        const value = catalog();
        deepEqual(value.items.map(item => item.id), ["1", "2", "5"]);
        equal(value.assetBaseUrl, "https://assets.example.test/staging/v2/game-assets");
        equal(value.items[0].iconAssetPath, "item/awaken/en/thumb/thumb_awaken_items_00001/thumb_awaken_items_00001.png");
        equal(value.items[1].eventJumpable, true);
        deepEqual(value.countsByRarity, { bronze: 1, silver: 1, gold: 0, rainbow: 0, super: 1 });
        equal(value.routeGraph.cards.length, 2);
        deepEqual(value.routeGraph.routes[0].requirements.map(item => item.rowId), ["20", "22"]);
        equal(value.routeGraph.routes[1].optimalAwakeningGrowthId, "40");
    });

    it("produces byte-identical content-addressed delivery", () => {
        const first = buildAwakeningMedalDelivery(catalog());
        const second = buildAwakeningMedalDelivery(catalog());
        equal(first.gzip.equals(second.gzip), true);
        equal(first.manifest.payload.sha256, second.manifest.payload.sha256);
        equal(first.manifest.payload.objectKey.endsWith(`${first.manifest.payload.sha256}.json.gz`), true);
    });

    it("rejects unknown rarity and duplicate IDs", () => {
        const base = {
            generatedAt: "2026-09-06T12:00:00.000Z",
            sourceSnapshotVersion: "1788329250",
            sourceDatabaseSha256: SHA,
            assetBaseUrl: "https://assets.example.test/game-assets",
        };
        throws(() => buildAwakeningMedalCatalog({ ...base, tables: { ...tables(), awakening_items: [{ id: "1", name: "x", description: "x", zeni: "0", rarity: "5", selling_exchange_point: "0", event_jumpable: "0" }] } }), /rarity/);
        throws(() => buildAwakeningMedalCatalog({ ...base, tables: { ...tables(), awakening_items: [
            { id: "1", name: "x", description: "x", zeni: "0", rarity: "0", selling_exchange_point: "0", event_jumpable: "0" },
            { id: "1", name: "y", description: "y", zeni: "0", rarity: "0", selling_exchange_point: "0", event_jumpable: "0" },
        ] } }), /Duplicate/);
        throws(() => buildAwakeningMedalCatalog({ ...base, tables: { ...tables(), awakening_items: [
            { id: "01", name: "x", description: "x", zeni: "0", rarity: "0", selling_exchange_point: "0", event_jumpable: "0" },
        ] } }), /canonical positive numeric ID/);
        throws(() => buildAwakeningMedalCatalog({ ...base, tables: { ...tables(), awakening_items: [
            { id: "0", name: "x", description: "x", zeni: "0", rarity: "0", selling_exchange_point: "0", event_jumpable: "0" },
        ] } }), /canonical positive numeric ID/);
    });

    it("rejects branching rather than guessing an awakening chain", () => {
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
        throws(() => buildAwakeningMedalCatalog({
            tables: source,
            generatedAt: "2026-09-06T12:00:00.000Z",
            sourceSnapshotVersion: "1788329250",
            sourceDatabaseSha256: SHA,
            assetBaseUrl: "https://assets.example.test/game-assets",
        }), /branches/);
    });

    it("requires explicit first-party source identity", () => {
        throws(() => parseAwakeningMedalCandidateArgs(["--source-data-dir", "db"]), /Missing Awakening Medal candidate argument/);
        const parsed = parseAwakeningMedalCandidateArgs([
            "--source-data-dir", "db", "--source-snapshot-version", "1788329250",
            "--source-database-sha256", SHA, "--asset-base-url", "https://assets.example.test/game-assets",
            "--output-dir", "candidate", "--generated-at", "2026-09-06T12:00:00.000Z",
        ]);
        equal(parsed.sourceSnapshotVersion, "1788329250");
    });

    it("binds first-party provenance to metadata, database digest, and table fingerprint", async () => {
        const root = await mkdtemp(join(tmpdir(), "awakening-medal-source-"));
        const data = join(root, "data");
        await mkdir(data);
        const tableNames = [
            "awakening_items", "cards", "card_awakening_routes", "card_awakening_sets",
            "card_awakenings", "optimal_awakening_growths",
        ] as const;
        const tableBytes = Object.fromEntries(tableNames.map(name => [
            name,
            Buffer.from(`id,name\n1,${name}\n`, "utf8"),
        ])) as Record<typeof tableNames[number], Buffer>;
        await Promise.all(tableNames.map(name => writeFile(join(data, `${name}.csv`), tableBytes[name])));
        await writeFile(join(root, "metadata.json"), JSON.stringify({
            source: "first-party-export",
            region: "global",
            exportedAt: "2026-09-06T12:00:00.000Z",
            dbVersion: "snapshot-test",
            apkVersion: "6.5.5",
        }));
        const options: AwakeningMedalCandidateOptions = {
            sourceDataDir: data,
            sourceSnapshotVersion: "snapshot-test",
            sourceDatabaseSha256: SHA,
            assetBaseUrl: "https://assets.example.test/game-assets",
            outputDir: join(root, "candidate"),
            generatedAt: "2026-09-06T12:00:00.000Z",
        };
        const profile = {
            databaseSha256: SHA,
            tableSha256: Object.fromEntries(tableNames.map(name => [
                name,
                createHash("sha256").update(tableBytes[name]).digest("hex"),
            ])) as Record<typeof tableNames[number], string>,
        };
        try {
            await validateAwakeningMedalFirstPartySource(options, profile);
            await rejects(
                validateAwakeningMedalFirstPartySource({ ...options, sourceDatabaseSha256: "b".repeat(64) }, profile),
                /database digest/,
            );
            await rejects(
                validateAwakeningMedalFirstPartySource(options, {
                    ...profile,
                    tableSha256: { ...profile.tableSha256, awakening_items: "b".repeat(64) },
                }),
                /awakening_items fingerprint/,
            );
            await writeFile(join(root, "metadata.json"), JSON.stringify({
                source: "third-party-scrape",
                region: "global",
                exportedAt: "2026-09-06T12:00:00.000Z",
                dbVersion: "snapshot-test",
                apkVersion: "6.5.5",
            }));
            await rejects(validateAwakeningMedalFirstPartySource(options, profile), /official Global export/);
        } finally {
            await rm(root, { recursive: true, force: true });
        }
    });
});
