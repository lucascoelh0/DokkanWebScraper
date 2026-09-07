import { deepEqual, equal, rejects, throws } from "assert";
import type { Character } from "../character";
import type { DatasetManifest } from "../dataset-artifacts";
import { parseLeaderSkillDetails } from "../scraper";
import type { TeamAnalysisManifest } from "../team-analysis-artifacts";
import { mkdir, rm } from "fs/promises";
import { describe, it } from "mocha";
import { resolve } from "path";
import {
    assertFreshCandidateOutput,
    assertTeamAnalysisBoundToCharacterArtifact,
    GAME_DB_CHARACTER_RELEASE_CANDIDATE_ROOT,
    parseGameDbCharacterReleaseCandidateArgs,
    reparseCharacterLeaderSkillDetails,
} from "./game-db-character-release-candidate";

describe("game DB character release candidate output safety", function () {
    it("accepts only fresh output directories below the dedicated candidate root", async () => {
        const unique = `safety-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const freshOutput = resolve(GAME_DB_CHARACTER_RELEASE_CANDIDATE_ROOT, unique);
        const existingOutput = resolve(GAME_DB_CHARACTER_RELEASE_CANDIDATE_ROOT, `${unique}-existing`);
        const baseline = resolve("data", "fyi-characters", "latest");

        await assertFreshCandidateOutput(freshOutput, baseline);
        await mkdir(existingOutput, { recursive: true });
        try {
            await rejects(
                () => assertFreshCandidateOutput(existingOutput, baseline),
                /must be a fresh directory/,
            );
            await rejects(
                () => assertFreshCandidateOutput(baseline, baseline),
                /must stay inside the dedicated candidate root/,
            );
        } finally {
            await rm(existingOutput, { recursive: true, force: true });
        }
    });

    it("rejects Team Analysis output that is not bound to the exact Character payload", () => {
        const characterManifest = {
            datasetVersion: "characters-v1",
            sha256: "a".repeat(64),
        } as DatasetManifest;
        const matching = {
            sourceCharacterDatasetVersion: "characters-v1",
            sourceCharacterPayloadSha256: "a".repeat(64),
        } as TeamAnalysisManifest;

        assertTeamAnalysisBoundToCharacterArtifact(matching, characterManifest);
        throws(
            () => assertTeamAnalysisBoundToCharacterArtifact({
                ...matching,
                sourceCharacterPayloadSha256: "b".repeat(64),
            }, characterManifest),
            /not bound to the generated Character payload/,
        );
        throws(
            () => assertTeamAnalysisBoundToCharacterArtifact({
                ...matching,
                sourceCharacterDatasetVersion: "characters-v2",
            }, characterManifest),
            /not bound to the generated Character payload/,
        );
    });

    it("keeps the card-ID mode unchanged and accepts only an explicit all-character reparse", () => {
        const legacy = parseGameDbCharacterReleaseCandidateArgs([
            "--first-party-dir", "fixtures/first-party",
            "--card-ids", "1002,1001",
        ]);
        const reparse = parseGameDbCharacterReleaseCandidateArgs([
            "--first-party-dir", "fixtures/first-party",
            "--reparse-leader-skills",
        ]);

        deepEqual(legacy.cardIds, ["1002", "1001"]);
        equal(legacy.reparseLeaderSkills, false);
        deepEqual(reparse.cardIds, []);
        equal(reparse.reparseLeaderSkills, true);
        throws(
            () => parseGameDbCharacterReleaseCandidateArgs([
                "--first-party-dir", "fixtures/first-party",
            ]),
            /requires --card-ids or --reparse-leader-skills/,
        );
        throws(
            () => parseGameDbCharacterReleaseCandidateArgs([
                "--first-party-dir", "fixtures/first-party",
                "--reparse-leader-skills",
                "--card-ids", "1001,1001",
            ]),
            /unique numeric IDs/,
        );
        throws(
            () => parseGameDbCharacterReleaseCandidateArgs([
                "--first-party-dir", "fixtures/first-party",
                "--reparse-leader-skills",
                "--reparse-leader-skills",
            ]),
            /duplicate release candidate argument --reparse-leader-skills/,
        );
        throws(
            () => parseGameDbCharacterReleaseCandidateArgs([
                "--first-party-dir", "fixtures/first-party",
                "--reparse-leader-skills", "true",
            ]),
            /unsupported release candidate argument true/,
        );
    });

    it("reparses Mamba base and EZA leaders while preserving Panzy and unrelated fields", () => {
        const mambaBase = `"Peppy Gals" Category or Extreme AGL Type Ki +3 and HP, ATK & DEF +140%`;
        const mambaEza = `"Peppy Gals" Category or Extreme AGL Type Ki +3 and HP, ATK & DEF +150%`;
        const panzyRaw = `"Demonic Power" or "DAIMA" Category Ki +3 and HP, ATK & DEF +170%, plus an additional HP, ATK & DEF +50% for characters who also belong to the "Battle of Wits", "Realm of Gods" or "Pure Saiyans" Category`;
        const panzyDetails = parseLeaderSkillDetails(panzyRaw);
        const missingRawDetails = parseLeaderSkillDetails(`Super Class Ki +3 and HP, ATK & DEF +120%`);
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
        ] as unknown as Character[];
        const unrelatedBefore = characters.map(withoutLeaderSkillDetailsJson);

        const result = reparseCharacterLeaderSkillDetails(characters);
        const mamba = result.characters[0];
        const panzy = result.characters[1];
        const missingRaw = result.characters[2];
        const missingRawAndDetails = result.characters[3];

        deepEqual(
            mamba.leaderSkillDetails?.clauses.map(clause => [clause.ki, clause.hp, clause.atk, clause.def]),
            [[3, 140, 140, 140], [3, 140, 140, 140]],
        );
        deepEqual(
            mamba.ezaLeaderSkillDetails?.clauses.map(clause => [clause.ki, clause.hp, clause.atk, clause.def]),
            [[3, 150, 150, 150], [3, 150, 150, 150]],
        );
        equal(panzy.leaderSkillDetails, panzyDetails);
        equal(panzy.leaderSkillDetails?.displayBoost, 220);
        deepEqual(
            panzy.leaderSkillDetails?.clauses.map(clause => [clause.stackGroup, clause.hp, clause.atk, clause.def]),
            [["primary", 170, 170, 170], ["additional", 50, 50, 50]],
        );
        equal(missingRaw.leaderSkillDetails, missingRawDetails);
        equal("leaderSkillDetails" in missingRawAndDetails, false);
        equal("ezaLeaderSkillDetails" in missingRawAndDetails, false);
        deepEqual(result.characters.map(withoutLeaderSkillDetailsJson), unrelatedBefore);
        deepEqual(result.report.changedCharacterIds, ["101"]);
        equal(result.report.changedCharacterCount, 1);
        equal(result.report.leaderSkillDetailsChangedCount, 1);
        equal(result.report.ezaLeaderSkillDetailsChangedCount, 1);
        equal(result.report.onlyLeaderSkillDetailFieldsChanged, true);
    });
});

function withoutLeaderSkillDetailsJson(character: Character): string {
    return JSON.stringify(Object.fromEntries(
        Object.entries(character).filter(([key]) =>
            key !== "leaderSkillDetails" && key !== "ezaLeaderSkillDetails"),
    ));
}
