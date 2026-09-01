import { equal, throws } from "assert";
import { describe, it } from "mocha";
import { parseSupportMemoryCandidateArgs } from "./game-db-support-memory-candidate";

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

describe("Support Memory candidate CLI", function () {
    it("treats the previous dataset as optional comparison input", () => {
        const withoutPrevious = parseSupportMemoryCandidateArgs(requiredArgs);
        equal(withoutPrevious.previousDatasetPath, undefined);
        const withPrevious = parseSupportMemoryCandidateArgs([
            ...requiredArgs,
            "--previous-dataset", "previous.json",
        ]);
        equal(withPrevious.previousDatasetPath?.endsWith("previous.json"), true);
    });

    it("requires the official source bundle, identity, and managed output", () => {
        const sourceAssetsIndex = requiredArgs.indexOf("--source-assets-dir");
        throws(
            () => parseSupportMemoryCandidateArgs([
                ...requiredArgs.slice(0, sourceAssetsIndex),
                ...requiredArgs.slice(sourceAssetsIndex + 2),
            ]),
            /Missing Support Memory candidate argument: --source-assets-dir/,
        );
    });
});
