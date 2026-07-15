import { deepEqual, equal, throws } from "assert";
import { describe, it } from "mocha";
import { resolve } from "path";
import {
    parseDownloadDatabaseArtifactArgs,
    resolveClientAssetsDatabaseInput,
} from "./game-db-download-database-artifact";

describe("game-db-download-database-artifact helpers", function () {
    it("parses client-assets capture arguments", function () {
        const parsed = parseDownloadDatabaseArtifactArgs([
            "--client-assets-json",
            ".\\captures\\client-assets-database.json",
            "--settings-json",
            ".\\settings.json",
            "--output-dir",
            ".\\data\\downloads",
            "--output-file-name",
            "global.db.enc",
            "--region",
            "global",
        ]);

        equal(parsed.clientAssetsJson, resolve(".\\captures\\client-assets-database.json"));
        equal(parsed.settingsJson, resolve(".\\settings.json"));
        equal(parsed.outputDir, resolve(".\\data\\downloads"));
        equal(parsed.outputFileName, "global.db.enc");
        equal(parsed.region, "global");
    });

    it("requires a url source", function () {
        throws(() => parseDownloadDatabaseArtifactArgs([]), /database-url|client-assets-json/);
    });

    it("resolves url and version from payload", function () {
        const resolved = resolveClientAssetsDatabaseInput({
            payload: {
                url: "https://example.com/database",
                version: 1782367825,
            },
        });

        deepEqual(resolved, {
            databaseUrl: "https://example.com/database",
            dbVersion: "1782367825",
        });
    });

    it("prefers explicit url and version", function () {
        const resolved = resolveClientAssetsDatabaseInput({
            explicitDatabaseUrl: "https://override.example/database",
            explicitDbVersion: "123",
            payload: {
                url: "https://example.com/database",
                version: 456,
            },
        });

        deepEqual(resolved, {
            databaseUrl: "https://override.example/database",
            dbVersion: "123",
        });
    });
});

