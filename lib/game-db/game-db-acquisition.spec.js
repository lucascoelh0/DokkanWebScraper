"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const path_1 = require("path");
const game_db_acquisition_1 = require("./game-db-acquisition");
(0, mocha_1.describe)("resolveGameDbAcquisitionOptions", function () {
    (0, mocha_1.it)("defaults to existing-export mode", () => {
        const options = (0, game_db_acquisition_1.resolveGameDbAcquisitionOptions)({
            sourceRootOverride: "C:\\dokkan",
        });
        (0, assert_1.equal)(options.mode, "existing-export");
        (0, assert_1.equal)(options.sourceRootOverride, "C:\\dokkan");
    });
    (0, mocha_1.it)("normalizes mirror repo options", () => {
        const options = (0, game_db_acquisition_1.resolveGameDbAcquisitionOptions)({
            mode: "mirror-repo",
            mirrorUrl: "https://github.com/Nicholas1006/dokkan-backend.git",
            mirrorDir: ".\\data\\mirror",
            mirrorBranch: "main",
            skipSync: true,
        });
        (0, assert_1.equal)(options.mode, "mirror-repo");
        (0, assert_1.equal)(options.mirrorDir, (0, path_1.resolve)(".\\data\\mirror"));
        (0, assert_1.equal)(options.skipSync, true);
    });
    (0, mocha_1.it)("normalizes first-party export options", () => {
        const options = (0, game_db_acquisition_1.resolveGameDbAcquisitionOptions)({
            mode: "first-party-export",
            firstPartyDir: ".\\data\\first-party-export",
        });
        (0, assert_1.equal)(options.mode, "first-party-export");
        (0, assert_1.equal)(options.firstPartyDir, (0, path_1.resolve)(".\\data\\first-party-export"));
    });
});
//# sourceMappingURL=game-db-acquisition.spec.js.map