import { equal } from "assert";
import { describe, it } from "mocha";
import { resolve } from "path";
import { parseOutputDir } from "./game-db-init-first-party-export";

describe("game-db-init-first-party-export cli parsing", function () {
    it("resolves --output-dir values in both supported forms", () => {
        equal(parseOutputDir(["--output-dir", ".\\exports\\latest"]), resolve(".\\exports\\latest"));
        equal(parseOutputDir(["--output-dir=.\\exports\\latest"]), resolve(".\\exports\\latest"));
    });
});

