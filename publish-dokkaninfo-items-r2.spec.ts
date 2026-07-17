import { deepEqual, equal, throws } from "assert";
import { resolve } from "path";
import {
    buildItemCatalogPublishPlan,
    parseItemCatalogPublishArgs,
} from "./publish-dokkaninfo-items-r2";

describe("DokkanInfo item catalog publisher", () => {
    it("defaults to the production bucket and remote R2 target", () => {
        const options = parseItemCatalogPublishArgs([]);

        equal(options.bucket, "dokkanpanion-data");
        equal(options.target, "remote");
        equal(options.dryRun, false);
        equal(options.maxUploadBytes, 50 * 1024 * 1024);
    });

    it("supports dry-run, local target, and an explicit upload limit", () => {
        const options = parseItemCatalogPublishArgs([
            "--dry-run",
            "--local",
            "--bucket",
            "test-bucket",
            "--max-upload-bytes",
            "1024",
        ]);

        deepEqual(options, {
            bucket: "test-bucket",
            catalogPath: resolve("data/dokkaninfo-items/latest/item-catalog.json"),
            manifestPath: resolve("data/dokkaninfo-items/latest/item-catalog-manifest.json"),
            dryRun: true,
            target: "local",
            maxUploadBytes: 1024,
        });
    });

    it("rejects a catalog that exceeds the configured budget", () => {
        const options = parseItemCatalogPublishArgs(["--max-upload-bytes", "10"]);
        const manifest = {
            schemaVersion: 1,
            datasetVersion: "2026-07-17T00:00:00.000Z",
            generatedAt: "2026-07-17T00:00:00.000Z",
            fileName: "item-catalog.json" as const,
            compression: "none" as const,
            sha256: "hash",
            sizeBytes: 100,
            itemCount: 1,
            categoryCount: 1,
        };

        throws(() => buildItemCatalogPublishPlan(options, manifest, 100, 20), /above the configured limit/);
    });
});
