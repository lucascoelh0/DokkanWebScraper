import { deepEqual, equal } from "assert";
import { describe, it } from "mocha";
import { resolve } from "path";
import {
    buildDefaultDokkanBackupPath,
    parsePullEmulatorDatabaseArtifactArgs,
    summarizeArtifactBuffer,
} from "./game-db-pull-emulator-database-artifact";

describe("game-db-pull-emulator-database-artifact helpers", function () {
    it("parses emulator pull arguments", function () {
        const parsed = parsePullEmulatorDatabaseArtifactArgs([
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

        equal(parsed.deviceSerial, "emulator-5554");
        equal(parsed.settingsJson, resolve(".\\settings.json"));
        equal(parsed.outputDir, resolve(".\\data\\downloads"));
        equal(parsed.outputFileName, "global.db.enc");
        equal(parsed.packageName, "com.example.dokkan");
        equal(parsed.remotePath, "/data/data/com.example.dokkan/files/backup/database.db");
        equal(parsed.ensureAdbRoot, false);
    });

    it("builds the default Dokkan backup path", function () {
        equal(
            buildDefaultDokkanBackupPath(),
            "/data/data/com.bandainamcogames.dbzdokkanww/files/backup/database.db",
        );
    });

    it("summarizes a readable sqlite buffer", function () {
        const buffer = Buffer.concat([
            Buffer.from("SQLite format 3\u0000", "utf8"),
            Buffer.from("rest"),
        ]);

        deepEqual(summarizeArtifactBuffer(buffer), {
            artifactByteLength: buffer.length,
            artifactHeaderHex: buffer.subarray(0, 16).toString("hex"),
            appearsReadableSqlite: true,
        });
    });

    it("summarizes a non-sqlite buffer", function () {
        const buffer = Buffer.from("0123456789abcdef", "hex");
        const summary = summarizeArtifactBuffer(buffer);

        equal(summary.appearsReadableSqlite, false);
        equal(summary.artifactHeaderHex, "0123456789abcdef");
        equal(summary.artifactByteLength, buffer.length);
    });
});

