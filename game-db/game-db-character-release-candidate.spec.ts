import { rejects, throws } from "assert";
import type { DatasetManifest } from "../dataset-artifacts";
import type { TeamAnalysisManifest } from "../team-analysis-artifacts";
import { mkdir, rm } from "fs/promises";
import { describe, it } from "mocha";
import { resolve } from "path";
import {
    assertFreshCandidateOutput,
    assertTeamAnalysisBoundToCharacterArtifact,
    GAME_DB_CHARACTER_RELEASE_CANDIDATE_ROOT,
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
});
