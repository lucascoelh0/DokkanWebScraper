"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const game_db_support_memory_assets_acquire_1 = require("./game-db-support-memory-assets-acquire");
const row = (values) => Object.fromEntries(Object.entries(values).map(([key, value]) => [key, String(value)]));
(0, mocha_1.describe)("Support Memory official asset acquisition", function () {
    (0, mocha_1.it)("derives root animation archives from script_name instead of memory ID", () => {
        (0, assert_1.deepEqual)((0, game_db_support_memory_assets_acquire_1.deriveSupportMemoryAnimationAssetIds)([
            row({ id: 20011, script_name: "sm20010" }),
            row({ id: 20012, script_name: "sm20012" }),
        ], [
            row({ id: 1, enhanced_support_memory_id: 20012 }),
        ]), [
            { memoryId: "20011", scriptAssetId: "20010" },
        ]);
    });
    (0, mocha_1.it)("rejects missing or duplicate official animation identities", () => {
        (0, assert_1.throws)(() => (0, game_db_support_memory_assets_acquire_1.deriveSupportMemoryAnimationAssetIds)([row({ id: 1, script_name: "legacy" })], []), /unsupported script_name/);
        (0, assert_1.throws)(() => (0, game_db_support_memory_assets_acquire_1.deriveSupportMemoryAnimationAssetIds)([
            row({ id: 1, script_name: "sm9" }),
            row({ id: 2, script_name: "sm9" }),
        ], []), /Duplicate Support Memory animation asset 9/);
    });
    (0, mocha_1.it)("parses a reproducible rooted-emulator acquisition request", () => {
        const parsed = (0, game_db_support_memory_assets_acquire_1.parseSupportMemoryAssetAcquisitionArgs)([
            "--device-serial", "emulator-5554",
            "--source-data-dir", "export",
            "--snapshot-version", "1787900894",
            "--asset-version", "1787810936",
            "--output-dir", "bundle",
            "--cpk-extractor", "extractor.dll",
            "--cpk-reader-commit", "169b001c748dfffc28c9fc14fcec269dd45e6eec",
        ]);
        (0, assert_1.equal)(parsed.deviceSerial, "emulator-5554");
        (0, assert_1.equal)(parsed.snapshotVersion, "1787900894");
        (0, assert_1.equal)(parsed.assetVersion, "1787810936");
        (0, assert_1.equal)(parsed.cpkReaderCommit, "169b001c748dfffc28c9fc14fcec269dd45e6eec");
    });
});
//# sourceMappingURL=game-db-support-memory-assets-acquire.spec.js.map