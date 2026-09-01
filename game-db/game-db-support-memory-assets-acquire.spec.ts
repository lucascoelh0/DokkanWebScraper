import { deepEqual, equal, throws } from "assert";
import { describe, it } from "mocha";
import { deriveSupportMemoryAnimationAssetIds, parseSupportMemoryAssetAcquisitionArgs } from "./game-db-support-memory-assets-acquire";
import { GameDbRow } from "./game-db-source";

const row = (values: Record<string, string | number>): GameDbRow => Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, String(value)]),
);

describe("Support Memory official asset acquisition", function () {
    it("derives root animation archives from script_name instead of memory ID", () => {
        deepEqual(deriveSupportMemoryAnimationAssetIds([
            row({ id: 20011, script_name: "sm20010" }),
            row({ id: 20012, script_name: "sm20012" }),
        ], [
            row({ id: 1, enhanced_support_memory_id: 20012 }),
        ]), [
            { memoryId: "20011", scriptAssetId: "20010" },
        ]);
    });

    it("rejects missing or duplicate official animation identities", () => {
        throws(() => deriveSupportMemoryAnimationAssetIds([row({ id: 1, script_name: "legacy" })], []), /unsupported script_name/);
        throws(() => deriveSupportMemoryAnimationAssetIds([
            row({ id: 1, script_name: "sm9" }),
            row({ id: 2, script_name: "sm9" }),
        ], []), /Duplicate Support Memory animation asset 9/);
    });

    it("parses a reproducible rooted-emulator acquisition request", () => {
        const parsed = parseSupportMemoryAssetAcquisitionArgs([
            "--device-serial", "emulator-5554",
            "--source-data-dir", "export",
            "--snapshot-version", "1787900894",
            "--asset-version", "1787810936",
            "--output-dir", "bundle",
            "--cpk-extractor", "extractor.dll",
            "--cpk-reader-commit", "169b001c748dfffc28c9fc14fcec269dd45e6eec",
        ]);
        equal(parsed.deviceSerial, "emulator-5554");
        equal(parsed.snapshotVersion, "1787900894");
        equal(parsed.assetVersion, "1787810936");
        equal(parsed.cpkReaderCommit, "169b001c748dfffc28c9fc14fcec269dd45e6eec");
    });
});
