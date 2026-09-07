import { deepEqual, throws } from "assert";
import { createHash } from "crypto";
import { resolve } from "path";
import { StageAssetManifest } from "./game-db-stage-assets";
import {
    parseStageAssetPublishArgs,
    validateStageAssetManifest,
} from "./game-db-stage-assets-publisher";

describe("Stage asset publisher", () => {
    it("parses a bounded channel-scoped dry run", () => {
        deepEqual(
            parseStageAssetPublishArgs([
                "--dry-run",
                "--remote",
                "--release-dir=release",
                "--object-prefix=/staging/v2/",
                "--state=state.json",
                "--max-upload-bytes=4096",
            ]),
            {
                bucket: "dokkanpanion-data",
                objectPrefix: "staging/v2",
                releaseDir: resolve("release"),
                manifestPath: resolve("release", "stage-assets-manifest.json"),
                statePath: resolve("state.json"),
                target: "remote",
                dryRun: true,
                maxUploadBytes: 4096,
            },
        );
        throws(
            () => parseStageAssetPublishArgs(["--release-dir", "release", "--object-prefix", "../production"]),
            /Invalid R2 object prefix/,
        );
    });

    it("validates inventory identity and rejects duplicate immutable keys", () => {
        const asset = {
            path: "banners/en/event.png",
            objectKey: "game-assets/banners/en/event.png",
            sourceUrl: "https://assets.example.test/event.png",
            sha256: "a".repeat(64),
            sizeBytes: 100,
            contentType: "image/png" as const,
        };
        const manifest = stageAssetManifest([asset]);
        validateStageAssetManifest(manifest);
        const duplicate = stageAssetManifest([asset, asset]);
        throws(() => validateStageAssetManifest(duplicate), /Duplicate Stage asset object key/);
        validateStageAssetManifest(stageAssetManifest([{
            ...asset,
            path: "derived/equipment/levels/lv-7-3.png",
            objectKey: "game-assets/derived/equipment/levels/lv-7-3.png",
            sourceUrl: "official-cpk-derived://derived/equipment/levels/lv-7-3.png",
            sourceFiles: ["fonts/en/black.otf", "layout/en/image/charamenu/potential/equ_Lv_two.png"],
        }]));
        validateStageAssetManifest(stageAssetManifest([{
            ...asset,
            path: "item/wallpaper/0076/full_0076.png",
            objectKey: "game-assets/item/wallpaper/0076/full_0076.png",
            sourceUrl: "official-cpk-extract://item/wallpaper/0076.cpk#Images_0076.png",
            sourceFiles: ["archives/0076.cpk", "extracted/0076/0076.lwf", "extracted/0076/Images_0076.png"],
        }]));
        validateStageAssetManifest(stageAssetManifest([{
            ...asset,
            path: "character/thumb/card_1033950_thumb/card_1033950_thumb.png",
            objectKey: "game-assets/character/thumb/card_1033950_thumb/card_1033950_thumb.png",
            sourceUrl: "official-cpk-extract://character/thumb/card_1033950_thumb/card_1033950_thumb.png",
            sourceFiles: ["historical/thumbs/card_1033950_thumb.cpk", "historical/thumb/card_1033950_thumb.png"],
        }]));
        validateStageAssetManifest(stageAssetManifest([{
            ...asset,
            path: "item/awaken/en/thumb/thumb_awaken_items_33704/thumb_awaken_items_33704.png",
            objectKey: "game-assets/item/awaken/en/thumb/thumb_awaken_items_33704/thumb_awaken_items_33704.png",
            sourceUrl: "official-cpk-extract://item/awaken/en/thumb/thumb_awaken_items_33704.cpk#thumb_awaken_items_33704.png",
            sourceFiles: ["archives/thumb_awaken_items_33704.cpk", "extracted/thumb_awaken_items_33704.png"],
        }]));
        throws(() => validateStageAssetManifest(stageAssetManifest([{
            ...asset,
            sourceUrl: "official-cpk-derived://banners/en/event.png",
        }])), /Unsafe Stage asset source URL/);
        const unsafe = stageAssetManifest([{
            ...asset,
            path: "../event.png",
            objectKey: "game-assets/../event.png",
        }]);
        throws(() => validateStageAssetManifest(unsafe), /Invalid Stage asset path/);
    });
});

function stageAssetManifest(assets: StageAssetManifest["assets"]): StageAssetManifest {
    return {
        schemaVersion: 1,
        contract: "dokkan-game-asset-mirror",
        contractVersion: "1.0.0",
        datasetVersion: "2026-09-03T00:00:00.000Z",
        sourceSnapshotVersion: "1788329250",
        sourceDatabaseSha256: "b".repeat(64),
        sourceBaseUrl: "https://assets.example.test/assets/global/en",
        objectPrefix: "game-assets/",
        requestedAssetCount: assets.length,
        assetCount: assets.length,
        missingAssetCount: 0,
        assetBytes: assets.reduce((sum, asset) => sum + asset.sizeBytes, 0),
        inventorySha256: createHash("sha256").update(JSON.stringify(assets)).digest("hex"),
        assets,
        missingAssets: [],
    };
}
