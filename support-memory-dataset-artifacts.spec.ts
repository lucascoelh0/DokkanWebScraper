import { equal, rejects } from "assert";
import { mkdir, mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { describe, it } from "mocha";
import { SupportMemoryDetailsDataset } from "./support-memory-details";
import { inspectSupportMemoryDatasetAssets } from "./support-memory-dataset-artifacts";

function dataset(localPath: string): SupportMemoryDetailsDataset {
    return {
        generatedAt: "2026-08-31T12:00:00.000Z",
        source: "dokkan-game-db",
        count: 1,
        entries: [{
            id: "1", name: "Memory", description: "", maxLevel: 1, enhancementChain: [], effects: [],
            categoryIds: [], categoryNames: [], applicableCharacterIds: [], unlockMethod: "unknown",
            presentationSource: "game-assets",
            dokkanInfo: {
                detailUrl: "", levelDescriptions: [], enhancementItems: [],
                largeAsset: { remoteUrl: "", localPath },
            },
        }],
    };
}

describe("Support Memory dataset artifacts", function () {
    it("accepts versioned official game assets and preserves stable object keys", async () => {
        const projectRoot = await mkdtemp(join(tmpdir(), "dokkan-support-memory-publish-"));
        try {
            const localPath = "data/support-memories/assets/game/snapshot-1/1/large.png";
            const absolutePath = join(projectRoot, ...localPath.split("/"));
            await mkdir(join(absolutePath, ".."), { recursive: true });
            await writeFile(absolutePath, "official");
            const assets = await inspectSupportMemoryDatasetAssets(dataset(localPath), projectRoot);
            equal(assets.length, 1);
            equal(assets[0].objectKey, "support-memories/assets/1/large.png");
        } finally {
            await rm(projectRoot, { recursive: true, force: true });
        }
    });

    it("rejects presentation assets outside every managed root", async () => {
        const projectRoot = await mkdtemp(join(tmpdir(), "dokkan-support-memory-unmanaged-"));
        try {
            await rejects(inspectSupportMemoryDatasetAssets(dataset("data/unmanaged/large.png"), projectRoot), /cannot be published|outside the managed asset directory/);
        } finally {
            await rm(projectRoot, { recursive: true, force: true });
        }
    });

    it("rejects traversal disguised with the official game-asset prefix", async () => {
        const projectRoot = await mkdtemp(join(tmpdir(), "dokkan-support-memory-traversal-"));
        try {
            await rejects(
                inspectSupportMemoryDatasetAssets(dataset("data/support-memories/assets/game/../dokkaninfo/1/large.png"), projectRoot),
                /cannot be published/,
            );
        } finally {
            await rm(projectRoot, { recursive: true, force: true });
        }
    });
});
