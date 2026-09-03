"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const game_db_stage_candidate_1 = require("./game-db-stage-candidate");
(0, mocha_1.describe)("Stage candidate CLI", () => {
    (0, mocha_1.it)("requires an official table bundle and keeps comparison optional", () => {
        const options = (0, game_db_stage_candidate_1.parseStageCandidateArgs)([
            "--source-data-dir", "source",
            "--source-snapshot-version", "1787900894",
            "--source-database-sha256", "a".repeat(64),
            "--output-dir", "candidate",
            "--generated-at", "2026-08-31T00:00:00.000Z",
        ]);
        (0, assert_1.equal)(options.previousDatasetPath, undefined);
        (0, assert_1.equal)(game_db_stage_candidate_1.REQUIRED_STAGE_TABLES.includes("sugoroku_map_enemy_informations"), true);
        (0, assert_1.equal)(game_db_stage_candidate_1.REQUIRED_STAGE_TABLES.includes("enemy_skills"), true);
        (0, assert_1.equal)(game_db_stage_candidate_1.REQUIRED_STAGE_TABLES.includes("z_battle_first_rewards"), true);
        (0, assert_1.equal)(game_db_stage_candidate_1.REQUIRED_STAGE_TABLES.includes("treasure_items"), true);
    });
    (0, mocha_1.it)("rejects unknown arguments", () => {
        (0, assert_1.throws)(() => (0, game_db_stage_candidate_1.parseStageCandidateArgs)(["--legacy-fallback", "yes"]), /Unexpected Stage candidate argument/);
    });
});
//# sourceMappingURL=game-db-stage-candidate.spec.js.map