"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const path_1 = require("path");
const publish_dokkaninfo_items_r2_1 = require("./publish-dokkaninfo-items-r2");
describe("DokkanInfo item catalog publisher", () => {
    it("requires an explicit production or staging channel", () => {
        (0, assert_1.throws)(() => (0, publish_dokkaninfo_items_r2_1.parseItemCatalogPublishArgs)([]), /explicit item catalog publish channel/);
        (0, assert_1.throws)(() => (0, publish_dokkaninfo_items_r2_1.parseItemCatalogPublishArgs)(["--channel", "preview"]), /Invalid item catalog publish channel/);
        (0, assert_1.throws)(() => (0, publish_dokkaninfo_items_r2_1.parseItemCatalogPublishArgs)(["--channel"]), /Missing value for --channel/);
        (0, assert_1.throws)(() => (0, publish_dokkaninfo_items_r2_1.parseItemCatalogPublishArgs)(["--channel", "staging", "--bucket"]), /Missing value for --bucket/);
    });
    it("selects the production root only when production is explicit", () => {
        const options = (0, publish_dokkaninfo_items_r2_1.parseItemCatalogPublishArgs)(["--channel", "production"]);
        (0, assert_1.equal)(options.bucket, "dokkanpanion-data");
        (0, assert_1.equal)(options.channel, "production");
        (0, assert_1.equal)(options.objectPrefix, "");
        (0, assert_1.equal)(options.target, "remote");
        (0, assert_1.equal)(options.dryRun, false);
        (0, assert_1.equal)(options.maxUploadBytes, 50 * 1024 * 1024);
    });
    it("supports dry-run, local target, and an explicit upload limit", () => {
        const options = (0, publish_dokkaninfo_items_r2_1.parseItemCatalogPublishArgs)([
            "--dry-run",
            "--local",
            "--channel",
            "staging",
            "--bucket",
            "test-bucket",
            "--max-upload-bytes",
            "1024",
        ]);
        (0, assert_1.deepEqual)(options, {
            bucket: "test-bucket",
            channel: "staging",
            objectPrefix: "staging/v2",
            catalogPath: (0, path_1.resolve)("data/dokkaninfo-items/latest/item-catalog.json"),
            manifestPath: (0, path_1.resolve)("data/dokkaninfo-items/latest/item-catalog-manifest.json"),
            dryRun: true,
            target: "local",
            maxUploadBytes: 1024,
        });
    });
    it("scopes catalog and manifest keys to an explicit channel prefix", () => {
        const options = (0, publish_dokkaninfo_items_r2_1.parseItemCatalogPublishArgs)(["--channel", "staging"]);
        const manifest = {
            schemaVersion: 1,
            datasetVersion: "2026-09-02T19:06:45.222Z",
            generatedAt: "2026-09-02T19:06:45.222Z",
            fileName: "item-catalog.json",
            compression: "none",
            sha256: "a".repeat(64),
            sizeBytes: 100,
            itemCount: 1,
            categoryCount: 1,
        };
        const plan = (0, publish_dokkaninfo_items_r2_1.buildItemCatalogPublishPlan)(options, manifest, 100, 20);
        (0, assert_1.equal)(plan.objectPrefix, "staging/v2");
        (0, assert_1.equal)(plan.catalogObjectKey, "staging/v2/item-catalog.json");
        (0, assert_1.equal)(plan.manifestObjectKey, "staging/v2/item-catalog-manifest.json");
    });
    it("rejects a catalog that exceeds the configured budget", () => {
        const options = (0, publish_dokkaninfo_items_r2_1.parseItemCatalogPublishArgs)(["--channel", "production", "--max-upload-bytes", "10"]);
        const manifest = {
            schemaVersion: 1,
            datasetVersion: "2026-07-17T00:00:00.000Z",
            generatedAt: "2026-07-17T00:00:00.000Z",
            fileName: "item-catalog.json",
            compression: "none",
            sha256: "hash",
            sizeBytes: 100,
            itemCount: 1,
            categoryCount: 1,
        };
        (0, assert_1.throws)(() => (0, publish_dokkaninfo_items_r2_1.buildItemCatalogPublishPlan)(options, manifest, 100, 20), /above the configured limit/);
    });
});
//# sourceMappingURL=publish-dokkaninfo-items-r2.spec.js.map