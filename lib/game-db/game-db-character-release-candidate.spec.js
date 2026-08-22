"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const promises_1 = require("fs/promises");
const mocha_1 = require("mocha");
const path_1 = require("path");
const game_db_character_release_candidate_1 = require("./game-db-character-release-candidate");
(0, mocha_1.describe)("game DB character release candidate output safety", function () {
    (0, mocha_1.it)("accepts only fresh output directories below the dedicated candidate root", async () => {
        const unique = `safety-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const freshOutput = (0, path_1.resolve)(game_db_character_release_candidate_1.GAME_DB_CHARACTER_RELEASE_CANDIDATE_ROOT, unique);
        const existingOutput = (0, path_1.resolve)(game_db_character_release_candidate_1.GAME_DB_CHARACTER_RELEASE_CANDIDATE_ROOT, `${unique}-existing`);
        const baseline = (0, path_1.resolve)("data", "fyi-characters", "latest");
        await (0, game_db_character_release_candidate_1.assertFreshCandidateOutput)(freshOutput, baseline);
        await (0, promises_1.mkdir)(existingOutput, { recursive: true });
        try {
            await (0, assert_1.rejects)(() => (0, game_db_character_release_candidate_1.assertFreshCandidateOutput)(existingOutput, baseline), /must be a fresh directory/);
            await (0, assert_1.rejects)(() => (0, game_db_character_release_candidate_1.assertFreshCandidateOutput)(baseline, baseline), /must stay inside the dedicated candidate root/);
        }
        finally {
            await (0, promises_1.rm)(existingOutput, { recursive: true, force: true });
        }
    });
    (0, mocha_1.it)("rejects Team Analysis output that is not bound to the exact Character payload", () => {
        const characterManifest = {
            datasetVersion: "characters-v1",
            sha256: "a".repeat(64),
        };
        const matching = {
            sourceCharacterDatasetVersion: "characters-v1",
            sourceCharacterPayloadSha256: "a".repeat(64),
        };
        (0, game_db_character_release_candidate_1.assertTeamAnalysisBoundToCharacterArtifact)(matching, characterManifest);
        (0, assert_1.throws)(() => (0, game_db_character_release_candidate_1.assertTeamAnalysisBoundToCharacterArtifact)({
            ...matching,
            sourceCharacterPayloadSha256: "b".repeat(64),
        }, characterManifest), /not bound to the generated Character payload/);
        (0, assert_1.throws)(() => (0, game_db_character_release_candidate_1.assertTeamAnalysisBoundToCharacterArtifact)({
            ...matching,
            sourceCharacterDatasetVersion: "characters-v2",
        }, characterManifest), /not bound to the generated Character payload/);
    });
});
//# sourceMappingURL=game-db-character-release-candidate.spec.js.map