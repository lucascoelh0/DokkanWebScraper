import { createHash } from "crypto";
import { deepEqual, equal, rejects, throws } from "assert";
import { mkdir, mkdtemp, rm, writeFile } from "fs/promises";
import { describe, it } from "mocha";
import { tmpdir } from "os";
import { join } from "path";
import { buildAwakeningMedalCatalog, buildAwakeningMedalDelivery } from "./game-db-awakening-medal-catalog";
import {
    AwakeningMedalCandidateOptions,
    parseAwakeningMedalCandidateArgs,
    validateAwakeningMedalFirstPartySource,
} from "./game-db-awakening-medal-candidate";

const SHA = "a".repeat(64);

function catalog() {
    return buildAwakeningMedalCatalog({
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

describe("official Awakening Medal catalog", () => {
    it("maps official rows deterministically with canonical image paths", () => {
        const value = catalog();
        deepEqual(value.items.map(item => item.id), ["1", "2", "5"]);
        equal(value.assetBaseUrl, "https://assets.example.test/staging/v2/game-assets");
        equal(value.items[0].iconAssetPath, "item/awaken/en/thumb/thumb_awaken_items_00001/thumb_awaken_items_00001.png");
        equal(value.items[1].eventJumpable, true);
        deepEqual(value.countsByRarity, { bronze: 1, silver: 1, gold: 0, rainbow: 0, super: 1 });
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
        throws(() => buildAwakeningMedalCatalog({ ...base, rows: [{ id: "1", name: "x", description: "x", zeni: "0", rarity: "5", selling_exchange_point: "0", event_jumpable: "0" }] }), /rarity/);
        throws(() => buildAwakeningMedalCatalog({ ...base, rows: [
            { id: "1", name: "x", description: "x", zeni: "0", rarity: "0", selling_exchange_point: "0", event_jumpable: "0" },
            { id: "1", name: "y", description: "y", zeni: "0", rarity: "0", selling_exchange_point: "0", event_jumpable: "0" },
        ] }), /Duplicate/);
        throws(() => buildAwakeningMedalCatalog({ ...base, rows: [
            { id: "01", name: "x", description: "x", zeni: "0", rarity: "0", selling_exchange_point: "0", event_jumpable: "0" },
        ] }), /canonical positive numeric ID/);
        throws(() => buildAwakeningMedalCatalog({ ...base, rows: [
            { id: "0", name: "x", description: "x", zeni: "0", rarity: "0", selling_exchange_point: "0", event_jumpable: "0" },
        ] }), /canonical positive numeric ID/);
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
        const table = Buffer.from("id,name\n1,Gregory\n", "utf8");
        await writeFile(join(data, "awakening_items.csv"), table);
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
            awakeningItemsSha256: createHash("sha256").update(table).digest("hex"),
        };
        try {
            await validateAwakeningMedalFirstPartySource(options, profile);
            await rejects(
                validateAwakeningMedalFirstPartySource({ ...options, sourceDatabaseSha256: "b".repeat(64) }, profile),
                /database digest/,
            );
            await rejects(
                validateAwakeningMedalFirstPartySource(options, { ...profile, awakeningItemsSha256: "b".repeat(64) }),
                /table fingerprint/,
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
