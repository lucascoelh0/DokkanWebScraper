"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const mocha_1 = require("mocha");
const os_1 = require("os");
const path_1 = require("path");
const game_db_first_party_export_commit_1 = require("./game-db-first-party-export-commit");
const game_db_table_inventory_1 = require("./game-db-table-inventory");
const metadata = {
    source: "first-party-export",
    region: "global",
    exportedAt: "2026-08-20T12:00:00.000Z",
};
async function writeTableInventory(dataDir, omittedTable) {
    await Promise.all(game_db_table_inventory_1.FIRST_PARTY_EXPORT_GAME_DB_TABLES
        .filter(table => table !== omittedTable)
        .map(table => (0, promises_1.writeFile)((0, path_1.join)(dataDir, `${table}.csv`), `id\n${table.length}\n`, "utf8")));
}
(0, mocha_1.describe)("commitFirstPartyExport", function () {
    (0, mocha_1.it)("preflights the complete source inventory before promotion", async () => {
        const root = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "game-db-export-preflight-"));
        try {
            await writeTableInventory(root, "dokkan_field_passive_skill_relations");
            await (0, assert_1.rejects)(() => (0, game_db_first_party_export_commit_1.assertFirstPartyExportSourceInventory)(root), /dokkan_field_passive_skill_relations\.csv/);
        }
        finally {
            await (0, promises_1.rm)(root, { recursive: true, force: true });
        }
    });
    (0, mocha_1.it)("refuses to replace or delete an existing output directory", async () => {
        const parent = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "game-db-export-failure-"));
        const outputDir = (0, path_1.join)(parent, "latest");
        await (0, promises_1.mkdir)((0, path_1.join)(outputDir, "data"), { recursive: true });
        await (0, promises_1.writeFile)((0, path_1.join)(outputDir, "metadata.json"), "old-metadata\n", "utf8");
        await (0, promises_1.writeFile)((0, path_1.join)(outputDir, "data", "sentinel.csv"), "old-data\n", "utf8");
        try {
            await (0, assert_1.rejects)(() => (0, game_db_first_party_export_commit_1.commitFirstPartyExport)({
                outputDir,
                metadata,
                materializeData: dataDir => writeTableInventory(dataDir),
            }), /Refusing to replace an existing first-party export directory/);
            (0, assert_1.equal)(await (0, promises_1.readFile)((0, path_1.join)(outputDir, "metadata.json"), "utf8"), "old-metadata\n");
            (0, assert_1.equal)(await (0, promises_1.readFile)((0, path_1.join)(outputDir, "data", "sentinel.csv"), "utf8"), "old-data\n");
            (0, assert_1.deepEqual)((await (0, promises_1.readdir)(parent)).filter(name => name.startsWith(".latest.")), []);
        }
        finally {
            await (0, promises_1.rm)(parent, { recursive: true, force: true });
        }
    });
    (0, mocha_1.it)("removes only owned staging when a new export is incomplete", async () => {
        const parent = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "game-db-export-incomplete-"));
        const outputDir = (0, path_1.join)(parent, "latest");
        try {
            await (0, assert_1.rejects)(() => (0, game_db_first_party_export_commit_1.commitFirstPartyExport)({
                outputDir,
                metadata,
                materializeData: dataDir => writeTableInventory(dataDir, "dokkan_field_passive_skill_relations"),
            }), /table inventory is invalid/);
            (0, assert_1.equal)((0, fs_1.existsSync)(outputDir), false);
            (0, assert_1.deepEqual)((await (0, promises_1.readdir)(parent)).filter(name => name.startsWith(".latest.")), []);
        }
        finally {
            await (0, promises_1.rm)(parent, { recursive: true, force: true });
        }
    });
    (0, mocha_1.it)("installs a closed inventory and removes swap staging", async () => {
        const parent = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "game-db-export-success-"));
        const outputDir = (0, path_1.join)(parent, "latest");
        try {
            const result = await (0, game_db_first_party_export_commit_1.commitFirstPartyExport)({
                outputDir,
                metadata,
                materializeData: dataDir => writeTableInventory(dataDir),
            });
            (0, assert_1.equal)(result.outputDir, outputDir);
            const dataMembers = await (0, promises_1.readdir)((0, path_1.join)(outputDir, "data"));
            (0, assert_1.deepEqual)(dataMembers.sort(), game_db_table_inventory_1.FIRST_PARTY_EXPORT_GAME_DB_TABLES.map(table => `${table}.csv`).sort());
            (0, assert_1.equal)(JSON.parse(await (0, promises_1.readFile)(result.metadataPath, "utf8")).source, "first-party-export");
            (0, assert_1.deepEqual)((await (0, promises_1.readdir)(parent)).filter(name => name.startsWith(".latest.")), []);
        }
        finally {
            await (0, promises_1.rm)(parent, { recursive: true, force: true });
        }
    });
    (0, mocha_1.it)("rejects source/output overlap and preserves an empty output that appears during staging", async () => {
        const parent = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "game-db-export-race-"));
        const outputDir = (0, path_1.join)(parent, "latest");
        try {
            await (0, assert_1.rejects)(() => (0, game_db_first_party_export_commit_1.assertNoFirstPartyExportPathOverlap)(parent, outputDir), /must not overlap/);
            await (0, assert_1.rejects)(() => (0, game_db_first_party_export_commit_1.commitFirstPartyExport)({
                outputDir,
                metadata,
                materializeData: async (dataDir) => {
                    await writeTableInventory(dataDir);
                    await (0, promises_1.mkdir)(outputDir);
                },
            }), /output appeared during staging/);
            (0, assert_1.deepEqual)(await (0, promises_1.readdir)(outputDir), []);
            (0, assert_1.deepEqual)((await (0, promises_1.readdir)(parent)).filter(name => name.startsWith(".latest.")), []);
        }
        finally {
            await (0, promises_1.rm)(parent, { recursive: true, force: true });
        }
    });
    (0, mocha_1.it)("rejects a claimed data directory replaced by a junction before installing members", async () => {
        const parent = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "game-db-export-data-race-"));
        const outputDir = (0, path_1.join)(parent, "latest");
        const outsideDir = (0, path_1.join)(parent, "outside");
        await (0, promises_1.mkdir)(outsideDir);
        try {
            await (0, assert_1.rejects)(() => (0, game_db_first_party_export_commit_1.commitFirstPartyExportForTest)({
                outputDir,
                metadata,
                materializeData: dataDir => writeTableInventory(dataDir),
            }, async (_claimedOutputDir, claimedDataDir) => {
                await (0, promises_1.rm)(claimedDataDir, { recursive: true });
                await (0, promises_1.symlink)(outsideDir, claimedDataDir, "junction");
            }), /data directory changed during installation/);
            (0, assert_1.deepEqual)(await (0, promises_1.readdir)(outsideDir), []);
            (0, assert_1.equal)((0, fs_1.existsSync)((0, path_1.join)(outputDir, "metadata.json")), false);
        }
        finally {
            await (0, promises_1.rm)(parent, { recursive: true, force: true });
        }
    });
});
//# sourceMappingURL=game-db-first-party-export-commit.spec.js.map