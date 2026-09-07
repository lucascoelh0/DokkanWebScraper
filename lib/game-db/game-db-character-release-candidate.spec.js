"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const scraper_1 = require("../scraper");
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
    (0, mocha_1.it)("keeps the card-ID mode unchanged and accepts only an explicit all-character reparse", () => {
        const legacy = (0, game_db_character_release_candidate_1.parseGameDbCharacterReleaseCandidateArgs)([
            "--first-party-dir", "fixtures/first-party",
            "--card-ids", "1002,1001",
        ]);
        const reparse = (0, game_db_character_release_candidate_1.parseGameDbCharacterReleaseCandidateArgs)([
            "--first-party-dir", "fixtures/first-party",
            "--reparse-leader-skills",
        ]);
        (0, assert_1.deepEqual)(legacy.cardIds, ["1002", "1001"]);
        (0, assert_1.equal)(legacy.reparseLeaderSkills, false);
        (0, assert_1.deepEqual)(reparse.cardIds, []);
        (0, assert_1.equal)(reparse.reparseLeaderSkills, true);
        (0, assert_1.throws)(() => (0, game_db_character_release_candidate_1.parseGameDbCharacterReleaseCandidateArgs)([
            "--first-party-dir", "fixtures/first-party",
        ]), /requires --card-ids or --reparse-leader-skills/);
        (0, assert_1.throws)(() => (0, game_db_character_release_candidate_1.parseGameDbCharacterReleaseCandidateArgs)([
            "--first-party-dir", "fixtures/first-party",
            "--reparse-leader-skills",
            "--card-ids", "1001,1001",
        ]), /unique numeric IDs/);
        (0, assert_1.throws)(() => (0, game_db_character_release_candidate_1.parseGameDbCharacterReleaseCandidateArgs)([
            "--first-party-dir", "fixtures/first-party",
            "--reparse-leader-skills",
            "--reparse-leader-skills",
        ]), /duplicate release candidate argument --reparse-leader-skills/);
        (0, assert_1.throws)(() => (0, game_db_character_release_candidate_1.parseGameDbCharacterReleaseCandidateArgs)([
            "--first-party-dir", "fixtures/first-party",
            "--reparse-leader-skills", "true",
        ]), /unsupported release candidate argument true/);
    });
    (0, mocha_1.it)("reparses Mamba base and EZA leaders while preserving Panzy and unrelated fields", () => {
        const mambaBase = `"Peppy Gals" Category or Extreme AGL Type Ki +3 and HP, ATK & DEF +140%`;
        const mambaEza = `"Peppy Gals" Category or Extreme AGL Type Ki +3 and HP, ATK & DEF +150%`;
        const panzyRaw = `"Demonic Power" or "DAIMA" Category Ki +3 and HP, ATK & DEF +170%, plus an additional HP, ATK & DEF +50% for characters who also belong to the "Battle of Wits", "Realm of Gods" or "Pure Saiyans" Category`;
        const panzyDetails = (0, scraper_1.parseLeaderSkillDetails)(panzyRaw);
        const missingRawDetails = (0, scraper_1.parseLeaderSkillDetails)(`Super Class Ki +3 and HP, ATK & DEF +120%`);
        const characters = [
            {
                id: "101",
                name: "Mamba",
                leaderSkill: mambaBase,
                ezaLeaderSkill: mambaEza,
                leaderSkillDetails: { rawText: mambaBase, displayBoost: 140, clauses: [] },
                ezaLeaderSkillDetails: { rawText: mambaEza, displayBoost: 150, clauses: [] },
                passive: "Unrelated passive",
                transformations: [{ id: "1011", name: "Unrelated transformation" }],
            },
            {
                id: "102",
                name: "Panzy",
                leaderSkill: panzyRaw,
                leaderSkillDetails: panzyDetails,
                passive: "Panzy passive",
            },
            {
                id: "103",
                name: "Missing raw",
                leaderSkillDetails: missingRawDetails,
                passive: "Must remain byte-equivalent",
            },
            {
                id: "104",
                name: "Missing raw and details",
                passive: "Must remain absent-compatible",
            },
        ];
        const unrelatedBefore = characters.map(withoutLeaderSkillDetailsJson);
        const result = (0, game_db_character_release_candidate_1.reparseCharacterLeaderSkillDetails)(characters);
        const mamba = result.characters[0];
        const panzy = result.characters[1];
        const missingRaw = result.characters[2];
        const missingRawAndDetails = result.characters[3];
        (0, assert_1.deepEqual)(mamba.leaderSkillDetails?.clauses.map(clause => [clause.ki, clause.hp, clause.atk, clause.def]), [[3, 140, 140, 140], [3, 140, 140, 140]]);
        (0, assert_1.deepEqual)(mamba.ezaLeaderSkillDetails?.clauses.map(clause => [clause.ki, clause.hp, clause.atk, clause.def]), [[3, 150, 150, 150], [3, 150, 150, 150]]);
        (0, assert_1.equal)(panzy.leaderSkillDetails, panzyDetails);
        (0, assert_1.equal)(panzy.leaderSkillDetails?.displayBoost, 220);
        (0, assert_1.deepEqual)(panzy.leaderSkillDetails?.clauses.map(clause => [clause.stackGroup, clause.hp, clause.atk, clause.def]), [["primary", 170, 170, 170], ["additional", 50, 50, 50]]);
        (0, assert_1.equal)(missingRaw.leaderSkillDetails, missingRawDetails);
        (0, assert_1.equal)("leaderSkillDetails" in missingRawAndDetails, false);
        (0, assert_1.equal)("ezaLeaderSkillDetails" in missingRawAndDetails, false);
        (0, assert_1.deepEqual)(result.characters.map(withoutLeaderSkillDetailsJson), unrelatedBefore);
        (0, assert_1.deepEqual)(result.report.changedCharacterIds, ["101"]);
        (0, assert_1.equal)(result.report.changedCharacterCount, 1);
        (0, assert_1.equal)(result.report.leaderSkillDetailsChangedCount, 1);
        (0, assert_1.equal)(result.report.ezaLeaderSkillDetailsChangedCount, 1);
        (0, assert_1.equal)(result.report.onlyLeaderSkillDetailFieldsChanged, true);
    });
});
function withoutLeaderSkillDetailsJson(character) {
    return JSON.stringify(Object.fromEntries(Object.entries(character).filter(([key]) => key !== "leaderSkillDetails" && key !== "ezaLeaderSkillDetails")));
}
//# sourceMappingURL=game-db-character-release-candidate.spec.js.map