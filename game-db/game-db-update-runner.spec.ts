import { deepEqual, equal } from "assert";
import { describe, it } from "mocha";
import { parseGameDbUpdateRunnerArgs } from "./game-db-update-runner";

describe("parseGameDbUpdateRunnerArgs", function () {
    it("splits runner-only options from publish args", () => {
        const parsed = parseGameDbUpdateRunnerArgs([
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

        equal(parsed.skipValidation, true);
        equal(parsed.skipPublish, false);
        equal(parsed.cardLimit, 50);
        equal(parsed.acquisitionMode, "mirror-repo");
        equal(parsed.mirrorDir, ".\\cache\\dokkan");
        equal(parsed.skipSync, true);
        deepEqual(parsed.validationCardIds, ["1032521", "1025731"]);
        deepEqual(parsed.publishArgs, ["--dry-run", "--local", "--bucket", "dokkanpanion-data"]);
    });

    it("reads explicit card ids and skip-publish", () => {
        const parsed = parseGameDbUpdateRunnerArgs([
            "--card-ids=1033061,1029471",
            "--acquisition-mode=first-party-export",
            "--first-party-dir",
            ".\\exports\\latest",
            "--skip-publish",
        ]);

        equal(parsed.explicitCardIds, "1033061,1029471");
        equal(parsed.acquisitionMode, "first-party-export");
        equal(parsed.firstPartyDir, ".\\exports\\latest");
        equal(parsed.skipPublish, true);
    });
});

