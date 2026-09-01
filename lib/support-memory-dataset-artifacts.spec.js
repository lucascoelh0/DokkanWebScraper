"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const promises_1 = require("fs/promises");
const os_1 = require("os");
const path_1 = require("path");
const mocha_1 = require("mocha");
const support_memory_dataset_artifacts_1 = require("./support-memory-dataset-artifacts");
function dataset(localPath) {
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
(0, mocha_1.describe)("Support Memory dataset artifacts", function () {
    (0, mocha_1.it)("accepts versioned official game assets and preserves stable object keys", async () => {
        const projectRoot = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "dokkan-support-memory-publish-"));
        try {
            const localPath = "data/support-memories/assets/game/snapshot-1/1/large.png";
            const absolutePath = (0, path_1.join)(projectRoot, ...localPath.split("/"));
            await (0, promises_1.mkdir)((0, path_1.join)(absolutePath, ".."), { recursive: true });
            await (0, promises_1.writeFile)(absolutePath, "official");
            const assets = await (0, support_memory_dataset_artifacts_1.inspectSupportMemoryDatasetAssets)(dataset(localPath), projectRoot);
            (0, assert_1.equal)(assets.length, 1);
            (0, assert_1.equal)(assets[0].objectKey, "support-memories/assets/1/large.png");
        }
        finally {
            await (0, promises_1.rm)(projectRoot, { recursive: true, force: true });
        }
    });
    (0, mocha_1.it)("rejects presentation assets outside every managed root", async () => {
        const projectRoot = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "dokkan-support-memory-unmanaged-"));
        try {
            await (0, assert_1.rejects)((0, support_memory_dataset_artifacts_1.inspectSupportMemoryDatasetAssets)(dataset("data/unmanaged/large.png"), projectRoot), /cannot be published|outside the managed asset directory/);
        }
        finally {
            await (0, promises_1.rm)(projectRoot, { recursive: true, force: true });
        }
    });
    (0, mocha_1.it)("rejects traversal disguised with the official game-asset prefix", async () => {
        const projectRoot = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "dokkan-support-memory-traversal-"));
        try {
            await (0, assert_1.rejects)((0, support_memory_dataset_artifacts_1.inspectSupportMemoryDatasetAssets)(dataset("data/support-memories/assets/game/../dokkaninfo/1/large.png"), projectRoot), /cannot be published/);
        }
        finally {
            await (0, promises_1.rm)(projectRoot, { recursive: true, force: true });
        }
    });
});
//# sourceMappingURL=support-memory-dataset-artifacts.spec.js.map