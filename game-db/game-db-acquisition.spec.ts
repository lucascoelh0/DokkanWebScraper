import { equal } from "assert";
import { describe, it } from "mocha";
import { resolve } from "path";
import { resolveGameDbAcquisitionOptions } from "./game-db-acquisition";

describe("resolveGameDbAcquisitionOptions", function () {
    it("defaults to existing-export mode", () => {
        const options = resolveGameDbAcquisitionOptions({
            sourceRootOverride: "C:\\dokkan",
        });

        equal(options.mode, "existing-export");
        equal(options.sourceRootOverride, "C:\\dokkan");
    });

    it("normalizes mirror repo options", () => {
        const options = resolveGameDbAcquisitionOptions({
            mode: "mirror-repo",
            mirrorUrl: "https://github.com/Nicholas1006/dokkan-backend.git",
            mirrorDir: ".\\data\\mirror",
            mirrorBranch: "main",
            skipSync: true,
        });

        equal(options.mode, "mirror-repo");
        equal(options.mirrorDir, resolve(".\\data\\mirror"));
        equal(options.skipSync, true);
    });

    it("normalizes first-party export options", () => {
        const options = resolveGameDbAcquisitionOptions({
            mode: "first-party-export",
            firstPartyDir: ".\\data\\first-party-export",
        });

        equal(options.mode, "first-party-export");
        equal(options.firstPartyDir, resolve(".\\data\\first-party-export"));
    });
});

