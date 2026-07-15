"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const path_1 = require("path");
const game_db_promote_to_first_party_export_1 = require("./game-db-promote-to-first-party-export");
(0, mocha_1.describe)("parsePromoteArgs", function () {
    (0, mocha_1.it)("reads source-root, output-dir, and note", () => {
        const parsed = (0, game_db_promote_to_first_party_export_1.parsePromoteArgs)([
            "--source-root",
            ".\\mirror\\dokkan-backend",
            "--output-dir=.\\exports\\latest",
            "--note",
            "Promoted from mirror",
        ]);
        (0, assert_1.equal)(parsed.sourceRoot, (0, path_1.resolve)(".\\mirror\\dokkan-backend"));
        (0, assert_1.equal)(parsed.outputDir, (0, path_1.resolve)(".\\exports\\latest"));
        (0, assert_1.equal)(parsed.note, "Promoted from mirror");
    });
    (0, mocha_1.it)("uses defaults when no args are passed", () => {
        const parsed = (0, game_db_promote_to_first_party_export_1.parsePromoteArgs)([]);
        (0, assert_1.deepEqual)(Object.keys(parsed).sort(), ["note", "outputDir", "sourceRoot"]);
    });
});
//# sourceMappingURL=game-db-promote-to-first-party-export.spec.js.map