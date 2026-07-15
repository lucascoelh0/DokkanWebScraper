"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const game_db_update_runner_1 = require("./game-db-update-runner");
(0, mocha_1.describe)("parseGameDbUpdateRunnerArgs", function () {
    (0, mocha_1.it)("splits runner-only options from publish args", () => {
        const parsed = (0, game_db_update_runner_1.parseGameDbUpdateRunnerArgs)([
            "--card-limit",
            "50",
            "--validation-card-ids=1032521,1025731",
            "--acquisition-mode",
            "mirror-repo",
            "--mirror-dir",
            ".\\cache\\dokkan",
            "--skip-sync",
            "--skip-validation",
            "--dry-run",
            "--local",
            "--bucket",
            "dokkanpanion-data",
        ]);
        (0, assert_1.equal)(parsed.skipValidation, true);
        (0, assert_1.equal)(parsed.skipPublish, false);
        (0, assert_1.equal)(parsed.cardLimit, 50);
        (0, assert_1.equal)(parsed.acquisitionMode, "mirror-repo");
        (0, assert_1.equal)(parsed.mirrorDir, ".\\cache\\dokkan");
        (0, assert_1.equal)(parsed.skipSync, true);
        (0, assert_1.deepEqual)(parsed.validationCardIds, ["1032521", "1025731"]);
        (0, assert_1.deepEqual)(parsed.publishArgs, ["--dry-run", "--local", "--bucket", "dokkanpanion-data"]);
    });
    (0, mocha_1.it)("reads explicit card ids and skip-publish", () => {
        const parsed = (0, game_db_update_runner_1.parseGameDbUpdateRunnerArgs)([
            "--card-ids=1033061,1029471",
            "--acquisition-mode=first-party-export",
            "--first-party-dir",
            ".\\exports\\latest",
            "--skip-publish",
        ]);
        (0, assert_1.equal)(parsed.explicitCardIds, "1033061,1029471");
        (0, assert_1.equal)(parsed.acquisitionMode, "first-party-export");
        (0, assert_1.equal)(parsed.firstPartyDir, ".\\exports\\latest");
        (0, assert_1.equal)(parsed.skipPublish, true);
    });
});
//# sourceMappingURL=game-db-update-runner.spec.js.map