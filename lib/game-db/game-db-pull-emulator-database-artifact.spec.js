"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const path_1 = require("path");
const game_db_pull_emulator_database_artifact_1 = require("./game-db-pull-emulator-database-artifact");
(0, mocha_1.describe)("game-db-pull-emulator-database-artifact helpers", function () {
    (0, mocha_1.it)("parses emulator pull arguments", function () {
        const parsed = (0, game_db_pull_emulator_database_artifact_1.parsePullEmulatorDatabaseArtifactArgs)([
            "--device-serial",
            "emulator-5554",
            "--settings-json",
            ".\\settings.json",
            "--output-dir",
            ".\\data\\downloads",
            "--output-file-name",
            "global.db.enc",
            "--package-name",
            "com.example.dokkan",
            "--skip-adb-root",
        ]);
        (0, assert_1.equal)(parsed.deviceSerial, "emulator-5554");
        (0, assert_1.equal)(parsed.settingsJson, (0, path_1.resolve)(".\\settings.json"));
        (0, assert_1.equal)(parsed.outputDir, (0, path_1.resolve)(".\\data\\downloads"));
        (0, assert_1.equal)(parsed.outputFileName, "global.db.enc");
        (0, assert_1.equal)(parsed.packageName, "com.example.dokkan");
        (0, assert_1.equal)(parsed.remotePath, "/data/data/com.example.dokkan/files/backup/database.db");
        (0, assert_1.equal)(parsed.ensureAdbRoot, false);
    });
    (0, mocha_1.it)("builds the default Dokkan backup path", function () {
        (0, assert_1.equal)((0, game_db_pull_emulator_database_artifact_1.buildDefaultDokkanBackupPath)(), "/data/data/com.bandainamcogames.dbzdokkanww/files/backup/database.db");
    });
    (0, mocha_1.it)("summarizes a readable sqlite buffer", function () {
        const buffer = Buffer.concat([
            Buffer.from("SQLite format 3\u0000", "utf8"),
            Buffer.from("rest"),
        ]);
        (0, assert_1.deepEqual)((0, game_db_pull_emulator_database_artifact_1.summarizeArtifactBuffer)(buffer), {
            artifactByteLength: buffer.length,
            artifactHeaderHex: buffer.subarray(0, 16).toString("hex"),
            appearsReadableSqlite: true,
        });
    });
    (0, mocha_1.it)("summarizes a non-sqlite buffer", function () {
        const buffer = Buffer.from("0123456789abcdef", "hex");
        const summary = (0, game_db_pull_emulator_database_artifact_1.summarizeArtifactBuffer)(buffer);
        (0, assert_1.equal)(summary.appearsReadableSqlite, false);
        (0, assert_1.equal)(summary.artifactHeaderHex, "0123456789abcdef");
        (0, assert_1.equal)(summary.artifactByteLength, buffer.length);
    });
});
//# sourceMappingURL=game-db-pull-emulator-database-artifact.spec.js.map