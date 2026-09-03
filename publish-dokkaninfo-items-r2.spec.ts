import { deepEqual, equal, throws } from "assert";
import { resolve } from "path";
import {
    buildItemCatalogPublishPlan,
    parseItemCatalogPublishArgs,
} from "./publish-dokkaninfo-items-r2";

describe("DokkanInfo item catalog publisher", () => {
    it("requires an explicit production or staging channel", () => {
        throws(() => parseItemCatalogPublishArgs([]), /explicit item catalog publish channel/);
        throws(() => parseItemCatalogPublishArgs(["--channel", "preview"]), /Invalid item catalog publish channel/);
        throws(() => parseItemCatalogPublishArgs(["--channel"]), /Missing value for --channel/);
        throws(() => parseItemCatalogPublishArgs(["--channel", "staging", "--bucket"]), /Missing value for --bucket/);
    });

    it("selects the production root only when production is explicit", () => {
        const options = parseItemCatalogPublishArgs(["--channel", "production"]);

        equal(options.bucket, "dokkanpanion-data");
        equal(options.channel, "production");
        equal(options.objectPrefix, "");
        equal(options.target, "remote");
        equal(options.dryRun, false);
        equal(options.maxUploadBytes, 50 * 1024 * 1024);
    });

    it("supports dry-run, local target, and an explicit upload limit", () => {
        const options = parseItemCatalogPublishArgs([
            "--dry-run",
            "--local",
            "--channel",
            "staging",
            "--bucket",
            "test-bucket",
            "--max-upload-bytes",
            "1024",
        ]);

        deepEqual(options, {
            bucket: "test-bucket",
            channel: "staging",
            objectPrefix: "staging/v2",
            catalogPath: resolve("data/dokkaninfo-items/latest/item-catalog.json"),
            manifestPath: resolve("data/dokkaninfo-items/latest/item-catalog-manifest.json"),
            dryRun: true,
            target: "local",
            maxUploadBytes: 1024,
        });
    });

    it("scopes catalog and manifest keys to an explicit channel prefix", () => {
        const options = parseItemCatalogPublishArgs(["--channel", "staging"]);
        const manifest = {
            schemaVersion: 1,
            datasetVersion: "2026-09-02T19:06:45.222Z",
            generatedAt: "2026-09-02T19:06:45.222Z",
            fileName: "item-catalog.json" as const,
            compression: "none" as const,
            sha256: "a".repeat(64),
            sizeBytes: 100,
            itemCount: 1,
            categoryCount: 1,
        };

        const plan = buildItemCatalogPublishPlan(options, manifest, 100, 20);

        equal(plan.objectPrefix, "staging/v2");
        equal(plan.catalogObjectKey, "staging/v2/item-catalog.json");
        equal(plan.manifestObjectKey, "staging/v2/item-catalog-manifest.json");
    });

    it("rejects a catalog that exceeds the configured budget", () => {
        const options = parseItemCatalogPublishArgs(["--channel", "production", "--max-upload-bytes", "10"]);
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
