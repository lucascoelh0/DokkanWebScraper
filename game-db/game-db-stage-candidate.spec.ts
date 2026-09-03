import { equal, throws } from "assert";
import { describe, it } from "mocha";
import { parseStageCandidateArgs, REQUIRED_STAGE_TABLES } from "./game-db-stage-candidate";

describe("Stage candidate CLI", () => {
    it("requires an official table bundle and keeps comparison optional", () => {
        const options = parseStageCandidateArgs([
            "--source-data-dir", "source",
            "--source-snapshot-version", "1787900894",
            "--source-database-sha256", "a".repeat(64),
            "--output-dir", "candidate",
            "--generated-at", "2026-08-31T00:00:00.000Z",
        ]);
        equal(options.previousDatasetPath, undefined);
        equal(REQUIRED_STAGE_TABLES.includes("sugoroku_map_enemy_informations"), true);
        equal(REQUIRED_STAGE_TABLES.includes("enemy_skills"), true);
        equal(REQUIRED_STAGE_TABLES.includes("z_battle_first_rewards"), true);
        equal(REQUIRED_STAGE_TABLES.includes("treasure_items"), true);
    });

    it("rejects unknown arguments", () => {
        throws(() => parseStageCandidateArgs(["--legacy-fallback", "yes"]), /Unexpected Stage candidate argument/);
    });
});
