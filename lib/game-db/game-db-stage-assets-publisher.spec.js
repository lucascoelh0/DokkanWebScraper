"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const crypto_1 = require("crypto");
const path_1 = require("path");
const game_db_stage_assets_publisher_1 = require("./game-db-stage-assets-publisher");
describe("Stage asset publisher", () => {
    it("parses a bounded channel-scoped dry run", () => {
        (0, assert_1.deepEqual)((0, game_db_stage_assets_publisher_1.parseStageAssetPublishArgs)([
            "--dry-run",
            "--remote",
            "--release-dir=release",
            "--object-prefix=/staging/v2/",
            "--state=state.json",
            "--max-upload-bytes=4096",
        ]), {
            bucket: "dokkanpanion-data",
            objectPrefix: "staging/v2",
            releaseDir: (0, path_1.resolve)("release"),
            manifestPath: (0, path_1.resolve)("release", "stage-assets-manifest.json"),
            statePath: (0, path_1.resolve)("state.json"),
            target: "remote",
            dryRun: true,
            maxUploadBytes: 4096,
        });
        (0, assert_1.throws)(() => (0, game_db_stage_assets_publisher_1.parseStageAssetPublishArgs)(["--release-dir", "release", "--object-prefix", "../production"]), /Invalid R2 object prefix/);
    });
    it("validates inventory identity and rejects duplicate immutable keys", () => {
        const asset = {
            path: "banners/en/event.png",
            objectKey: "game-assets/banners/en/event.png",
            sourceUrl: "https://assets.example.test/event.png",
            sha256: "a".repeat(64),
            sizeBytes: 100,
            contentType: "image/png",
        };
        const manifest = stageAssetManifest([asset]);
        (0, game_db_stage_assets_publisher_1.validateStageAssetManifest)(manifest);
        const duplicate = stageAssetManifest([asset, asset]);
        (0, assert_1.throws)(() => (0, game_db_stage_assets_publisher_1.validateStageAssetManifest)(duplicate), /Duplicate Stage asset object key/);
        const unsafe = stageAssetManifest([{
                ...asset,
                path: "../event.png",
                objectKey: "game-assets/../event.png",
            }]);
        (0, assert_1.throws)(() => (0, game_db_stage_assets_publisher_1.validateStageAssetManifest)(unsafe), /Invalid Stage asset path/);
    });
});
function stageAssetManifest(assets) {
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
        inventorySha256: (0, crypto_1.createHash)("sha256").update(JSON.stringify(assets)).digest("hex"),
        assets,
        missingAssets: [],
    };
}
//# sourceMappingURL=game-db-stage-assets-publisher.spec.js.map