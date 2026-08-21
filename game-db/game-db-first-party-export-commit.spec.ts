import { deepEqual, equal, rejects } from "assert";
import { existsSync } from "fs";
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from "fs/promises";
import { describe, it } from "mocha";
import { tmpdir } from "os";
import { join } from "path";
import {
    assertFirstPartyExportSourceInventory,
    assertNoFirstPartyExportPathOverlap,
    commitFirstPartyExport,
    commitFirstPartyExportForTest,
} from "./game-db-first-party-export-commit";
import { FIRST_PARTY_EXPORT_GAME_DB_TABLES } from "./game-db-table-inventory";

const metadata = {
    source: "first-party-export" as const,
    region: "global" as const,
    exportedAt: "2026-08-20T12:00:00.000Z",
};

async function writeTableInventory(dataDir: string, omittedTable?: string): Promise<void> {
    await Promise.all(FIRST_PARTY_EXPORT_GAME_DB_TABLES
        .filter(table => table !== omittedTable)
        .map(table => writeFile(join(dataDir, `${table}.csv`), `id\n${table.length}\n`, "utf8")));
}

describe("commitFirstPartyExport", function () {
    it("preflights the complete source inventory before promotion", async () => {
        const root = await mkdtemp(join(tmpdir(), "game-db-export-preflight-"));
        try {
            await writeTableInventory(root, "dokkan_field_passive_skill_relations");
            await rejects(
                () => assertFirstPartyExportSourceInventory(root),
                /dokkan_field_passive_skill_relations\.csv/,
            );
        } finally {
            await rm(root, { recursive: true, force: true });
        }
    });

    it("refuses to replace or delete an existing output directory", async () => {
        const parent = await mkdtemp(join(tmpdir(), "game-db-export-failure-"));
        const outputDir = join(parent, "latest");
        await mkdir(join(outputDir, "data"), { recursive: true });
        await writeFile(join(outputDir, "metadata.json"), "old-metadata\n", "utf8");
        await writeFile(join(outputDir, "data", "sentinel.csv"), "old-data\n", "utf8");
        try {
            await rejects(
                () => commitFirstPartyExport({
                    outputDir,
                    metadata,
                    materializeData: dataDir => writeTableInventory(dataDir),
                }),
                /Refusing to replace an existing first-party export directory/,
            );
            equal(await readFile(join(outputDir, "metadata.json"), "utf8"), "old-metadata\n");
            equal(await readFile(join(outputDir, "data", "sentinel.csv"), "utf8"), "old-data\n");
            deepEqual((await readdir(parent)).filter(name => name.startsWith(".latest.")), []);
        } finally {
            await rm(parent, { recursive: true, force: true });
        }
    });

    it("removes only owned staging when a new export is incomplete", async () => {
        const parent = await mkdtemp(join(tmpdir(), "game-db-export-incomplete-"));
        const outputDir = join(parent, "latest");
        try {
            await rejects(
                () => commitFirstPartyExport({
                    outputDir,
                    metadata,
                    materializeData: dataDir => writeTableInventory(
                        dataDir,
                        "dokkan_field_passive_skill_relations",
                    ),
                }),
                /table inventory is invalid/,
            );
            equal(existsSync(outputDir), false);
            deepEqual((await readdir(parent)).filter(name => name.startsWith(".latest.")), []);
        } finally {
            await rm(parent, { recursive: true, force: true });
        }
    });

    it("installs a closed inventory and removes swap staging", async () => {
        const parent = await mkdtemp(join(tmpdir(), "game-db-export-success-"));
        const outputDir = join(parent, "latest");
        try {
            const result = await commitFirstPartyExport({
                outputDir,
                metadata,
                materializeData: dataDir => writeTableInventory(dataDir),
            });

            equal(result.outputDir, outputDir);
            const dataMembers = await readdir(join(outputDir, "data"));
            deepEqual(dataMembers.sort(), FIRST_PARTY_EXPORT_GAME_DB_TABLES.map(table => `${table}.csv`).sort());
            equal(JSON.parse(await readFile(result.metadataPath, "utf8")).source, "first-party-export");
            deepEqual((await readdir(parent)).filter(name => name.startsWith(".latest.")), []);
        } finally {
            await rm(parent, { recursive: true, force: true });
        }
    });

    it("rejects source/output overlap and preserves an empty output that appears during staging", async () => {
        const parent = await mkdtemp(join(tmpdir(), "game-db-export-race-"));
        const outputDir = join(parent, "latest");
        try {
            await rejects(() => assertNoFirstPartyExportPathOverlap(parent, outputDir), /must not overlap/);
            await rejects(
                () => commitFirstPartyExport({
                    outputDir,
                    metadata,
                    materializeData: async dataDir => {
                        await writeTableInventory(dataDir);
                        await mkdir(outputDir);
                    },
                }),
                /output appeared during staging/,
            );
            deepEqual(await readdir(outputDir), []);
            deepEqual((await readdir(parent)).filter(name => name.startsWith(".latest.")), []);
        } finally {
            await rm(parent, { recursive: true, force: true });
        }
    });

    it("rejects a claimed data directory replaced by a junction before installing members", async () => {
        const parent = await mkdtemp(join(tmpdir(), "game-db-export-data-race-"));
        const outputDir = join(parent, "latest");
        const outsideDir = join(parent, "outside");
        await mkdir(outsideDir);
        try {
            await rejects(
                () => commitFirstPartyExportForTest(
                    {
                        outputDir,
                        metadata,
                        materializeData: dataDir => writeTableInventory(dataDir),
                    },
                    async (_claimedOutputDir, claimedDataDir) => {
                        await rm(claimedDataDir, { recursive: true });
                        await symlink(outsideDir, claimedDataDir, "junction");
                    },
                ),
                /data directory changed during installation/,
            );
            deepEqual(await readdir(outsideDir), []);
            equal(existsSync(join(outputDir, "metadata.json")), false);
        } finally {
            await rm(parent, { recursive: true, force: true });
        }
    });
});
