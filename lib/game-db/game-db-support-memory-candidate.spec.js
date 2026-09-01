"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const game_db_support_memory_candidate_1 = require("./game-db-support-memory-candidate");
const requiredArgs = [
    "--source-data-dir", "db",
    "--source-snapshot-version", "123",
    "--source-database-sha256", "a".repeat(64),
    "--characters", "characters.json.gz",
    "--source-assets-dir", "assets",
    "--asset-source-identity", "identity.json",
    "--asset-output-dir", "data/support-memories/assets/game/123",
    "--output-dir", "candidate",
];
(0, mocha_1.describe)("Support Memory candidate CLI", function () {
    (0, mocha_1.it)("treats the previous dataset as optional comparison input", () => {
        const withoutPrevious = (0, game_db_support_memory_candidate_1.parseSupportMemoryCandidateArgs)(requiredArgs);
        (0, assert_1.equal)(withoutPrevious.previousDatasetPath, undefined);
        const withPrevious = (0, game_db_support_memory_candidate_1.parseSupportMemoryCandidateArgs)([
            ...requiredArgs,
            "--previous-dataset", "previous.json",
        ]);
        (0, assert_1.equal)(withPrevious.previousDatasetPath?.endsWith("previous.json"), true);
    });
    (0, mocha_1.it)("requires the official source bundle, identity, and managed output", () => {
        const sourceAssetsIndex = requiredArgs.indexOf("--source-assets-dir");
        (0, assert_1.throws)(() => (0, game_db_support_memory_candidate_1.parseSupportMemoryCandidateArgs)([
            ...requiredArgs.slice(0, sourceAssetsIndex),
            ...requiredArgs.slice(sourceAssetsIndex + 2),
        ]), /Missing Support Memory candidate argument: --source-assets-dir/);
    });
});
//# sourceMappingURL=game-db-support-memory-candidate.spec.js.map