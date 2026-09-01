import { deepEqual, equal, rejects } from "assert";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join, resolve } from "path";
import { describe, it } from "mocha";
import { buildSupportMemoryGameAssets, SupportMemoryGameAssetSourceIdentity } from "./game-db-support-memory-assets";
import { GameDbRow } from "./game-db-source";

const row = (values: Record<string, string | number>): GameDbRow => Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, String(value)]),
);

async function file(path: string, contents: string): Promise<void> {
    await mkdir(resolve(path, ".."), { recursive: true });
    await writeFile(path, contents);
}

const sourceIdentity: SupportMemoryGameAssetSourceIdentity = {
    packageName: "com.bandainamcogames.dbzdokkanww",
    versionName: "5.31.0",
    versionCode: "5310000",
    databaseSnapshotVersion: "1787900894",
    acquiredAt: "2026-08-31T12:00:00.000Z",
    cpkReader: {
        repository: "https://github.com/Sewer56/CriFsV2Lib",
        commit: "169b001c748dfffc28c9fc14fcec269dd45e6eec",
    },
};

describe("Support Memory official game assets", function () {
    it("builds a complete presentation from official CPK extracts and joins animation by script_name", async () => {
        const projectRoot = await mkdtemp(join(tmpdir(), "dokkan-support-memory-assets-"));
        try {
            const sourceRoot = join(projectRoot, "source");
            await file(join(sourceRoot, "archives", "support_memory.cpk"), "static-cpk");
            await file(join(sourceRoot, "archives", "support_memory_enhancement.cpk"), "enhancement-cpk");
            await file(join(sourceRoot, "archives", "animations", "support_memory_20010.cpk"), "animation-cpk");
            await file(join(sourceRoot, "extracted", "support_memory", "large", "support_memory_large_20011.png"), "large");
            await file(join(sourceRoot, "extracted", "support_memory", "large", "support_memory_large_sepia_20011.png"), "sepia");
            await file(join(sourceRoot, "extracted", "support_memory", "film_icon", "support_memory_film_z.png"), "film");
            await file(join(sourceRoot, "extracted", "support_memory_enhancement", "9001", "9001.png"), "item");
            await file(join(sourceRoot, "extracted", "animations", "20010", "en", "support_memory_20010.lwf"), "lwf");
            await file(join(sourceRoot, "extracted", "animations", "20010", "en", "texture.png"), "texture");

            const outputRoot = join(projectRoot, "data", "support-memories", "assets", "game", "snapshot-1");
            const result = await buildSupportMemoryGameAssets({
                generatedAt: "2026-08-31T12:00:00.000Z",
                sourceIdentity,
                sourceBundleRoot: sourceRoot,
                outputRoot,
                projectRoot,
                tables: {
                    support_films: [row({ id: 2 })],
                    support_memories: [
                        row({ id: 20011, support_film_id: 2, unlock_quantity: 70, cost: 100, description: "Level 1", script_name: "sm20010" }),
                        row({ id: 20012, support_film_id: 2, unlock_quantity: 70, cost: 100, description: "Level 2", script_name: "sm20012" }),
                    ],
                    support_memory_enhancement_items: [row({ id: 9001 })],
                    support_memory_enhancement_levels: [row({ id: 1, root_support_memory_id: 20011, level: 2, support_memory_id: 20011, enhanced_support_memory_id: 20012 })],
                    support_memory_enhancement_require_items: [row({ id: 1, support_memory_id: 20011, support_memory_enhancement_item_id: 9001, quantity: 5, priority: 1 })],
                },
            });

            const presentation = result.presentations.get("20011")!;
            equal(presentation.detailUrl, "");
            deepEqual(presentation.levelDescriptions, [
                { level: 1, description: "Level 1" },
                { level: 2, description: "Level 2" },
            ]);
            equal(presentation.requiredFilm?.filmCode, "z");
            equal(presentation.enhancementItems[0].quantity, 5);
            equal(presentation.animation?.lwf.localPath?.endsWith("20011/animation/support_memory_20010.lwf"), true);
            deepEqual(result.audit.joins.nonIdentityAnimationIds, [{ memoryId: "20011", scriptAssetId: "20010" }]);
            equal(result.audit.output.memoryCount, 1);
            equal(JSON.parse(await readFile(join(outputRoot, "support-memory-game-assets.json"), "utf8")).source.packageName, sourceIdentity.packageName);
        } finally {
            await rm(projectRoot, { recursive: true, force: true });
        }
    });

    it("fails closed when any official presentation asset is missing", async () => {
        const projectRoot = await mkdtemp(join(tmpdir(), "dokkan-support-memory-assets-missing-"));
        try {
            const sourceRoot = join(projectRoot, "source");
            await mkdir(sourceRoot, { recursive: true });
            await rejects(buildSupportMemoryGameAssets({
                generatedAt: "2026-08-31T12:00:00.000Z",
                sourceIdentity,
                sourceBundleRoot: sourceRoot,
                outputRoot: join(projectRoot, "data", "support-memories", "assets", "game", "snapshot-1"),
                projectRoot,
                tables: {
                    support_films: [row({ id: 2 })],
                    support_memories: [row({ id: 20011, support_film_id: 2, unlock_quantity: 70, cost: 100, description: "Level 1", script_name: "sm20011" })],
                    support_memory_enhancement_items: [],
                    support_memory_enhancement_levels: [],
                    support_memory_enhancement_require_items: [],
                },
            }), /Missing Support Memory official asset/);
        } finally {
            await rm(projectRoot, { recursive: true, force: true });
        }
    });
});
