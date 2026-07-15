import { deepEqual, equal } from "assert";
import { describe, it } from "mocha";
import { resolve } from "path";
import { parsePromoteArgs } from "./game-db-promote-to-first-party-export";

describe("parsePromoteArgs", function () {
    it("reads source-root, output-dir, and note", () => {
        const parsed = parsePromoteArgs([
            "--source-root",
            ".\\mirror\\dokkan-backend",
            "--output-dir=.\\exports\\latest",
            "--note",
            "Promoted from mirror",
        ]);

        equal(parsed.sourceRoot, resolve(".\\mirror\\dokkan-backend"));
        equal(parsed.outputDir, resolve(".\\exports\\latest"));
        equal(parsed.note, "Promoted from mirror");
    });

    it("uses defaults when no args are passed", () => {
        const parsed = parsePromoteArgs([]);
        deepEqual(Object.keys(parsed).sort(), ["note", "outputDir", "sourceRoot"]);
    });
});

