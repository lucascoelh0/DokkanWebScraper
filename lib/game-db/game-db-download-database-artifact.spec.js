"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const path_1 = require("path");
const game_db_download_database_artifact_1 = require("./game-db-download-database-artifact");
(0, mocha_1.describe)("game-db-download-database-artifact helpers", function () {
    (0, mocha_1.it)("parses client-assets capture arguments", function () {
        const parsed = (0, game_db_download_database_artifact_1.parseDownloadDatabaseArtifactArgs)([
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
        (0, assert_1.equal)(parsed.clientAssetsJson, (0, path_1.resolve)(".\\captures\\client-assets-database.json"));
        (0, assert_1.equal)(parsed.settingsJson, (0, path_1.resolve)(".\\settings.json"));
        (0, assert_1.equal)(parsed.outputDir, (0, path_1.resolve)(".\\data\\downloads"));
        (0, assert_1.equal)(parsed.outputFileName, "global.db.enc");
        (0, assert_1.equal)(parsed.region, "global");
    });
    (0, mocha_1.it)("requires a url source", function () {
        (0, assert_1.throws)(() => (0, game_db_download_database_artifact_1.parseDownloadDatabaseArtifactArgs)([]), /database-url|client-assets-json/);
    });
    (0, mocha_1.it)("resolves url and version from payload", function () {
        const resolved = (0, game_db_download_database_artifact_1.resolveClientAssetsDatabaseInput)({
            payload: {
                url: "https://example.com/database",
                version: 1782367825,
            },
        });
        (0, assert_1.deepEqual)(resolved, {
            databaseUrl: "https://example.com/database",
            dbVersion: "1782367825",
        });
    });
    (0, mocha_1.it)("prefers explicit url and version", function () {
        const resolved = (0, game_db_download_database_artifact_1.resolveClientAssetsDatabaseInput)({
            explicitDatabaseUrl: "https://override.example/database",
            explicitDbVersion: "123",
            payload: {
                url: "https://example.com/database",
                version: 456,
            },
        });
        (0, assert_1.deepEqual)(resolved, {
            databaseUrl: "https://override.example/database",
            dbVersion: "123",
        });
    });
});
//# sourceMappingURL=game-db-download-database-artifact.spec.js.map