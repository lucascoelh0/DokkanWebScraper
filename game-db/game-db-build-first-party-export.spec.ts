import { equal } from "assert";
import { describe, it } from "mocha";
import { resolve } from "path";
import { parseBuildFirstPartyExportArgs } from "./game-db-build-first-party-export";

describe("parseBuildFirstPartyExportArgs", function () {
    it("reads sqlite path and optional metadata args", () => {
        const parsed = parseBuildFirstPartyExportArgs([
            "--sqlite-path",
            ".\\database.db",
            "--output-dir=.\\exports\\latest",
            "--settings-json",
            ".\\settings.json",
            "--region",
            "global",
            "--note",
            "Built from local sqlite",
        ]);

        equal(parsed.sqlitePath, resolve(".\\database.db"));
        equal(parsed.outputDir, resolve(".\\exports\\latest"));
        equal(parsed.settingsJson, resolve(".\\settings.json"));
        equal(parsed.region, "global");
        equal(parsed.note, "Built from local sqlite");
    });
});

