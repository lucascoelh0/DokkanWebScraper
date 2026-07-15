"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const path_1 = require("path");
const game_db_init_first_party_export_1 = require("./game-db-init-first-party-export");
(0, mocha_1.describe)("game-db-init-first-party-export cli parsing", function () {
    (0, mocha_1.it)("resolves --output-dir values in both supported forms", () => {
        (0, assert_1.equal)((0, game_db_init_first_party_export_1.parseOutputDir)(["--output-dir", ".\\exports\\latest"]), (0, path_1.resolve)(".\\exports\\latest"));
        (0, assert_1.equal)((0, game_db_init_first_party_export_1.parseOutputDir)(["--output-dir=.\\exports\\latest"]), (0, path_1.resolve)(".\\exports\\latest"));
    });
});
//# sourceMappingURL=game-db-init-first-party-export.spec.js.map