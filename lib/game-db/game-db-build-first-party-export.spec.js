"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const path_1 = require("path");
const game_db_build_first_party_export_1 = require("./game-db-build-first-party-export");
(0, mocha_1.describe)("parseBuildFirstPartyExportArgs", function () {
    (0, mocha_1.it)("reads sqlite path and optional metadata args", () => {
        const parsed = (0, game_db_build_first_party_export_1.parseBuildFirstPartyExportArgs)([
            "--sqlite-path",
            ".\\database.db",
            "--output-dir=.\\exports\\latest",
            "--settings-json",
            ".\\settings.json",
            "--region",
            "global",
            "--note",
            "Built from local sqlite",
        ]);
        (0, assert_1.equal)(parsed.sqlitePath, (0, path_1.resolve)(".\\database.db"));
        (0, assert_1.equal)(parsed.outputDir, (0, path_1.resolve)(".\\exports\\latest"));
        (0, assert_1.equal)(parsed.settingsJson, (0, path_1.resolve)(".\\settings.json"));
        (0, assert_1.equal)(parsed.region, "global");
        (0, assert_1.equal)(parsed.note, "Built from local sqlite");
    });
});
//# sourceMappingURL=game-db-build-first-party-export.spec.js.map