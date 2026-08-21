import { createHash } from "crypto";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { throws } from "assert";
import { describe, it } from "mocha";
import { parseNativeRuntimeElf } from "./native-runtime-elf-adapter";
import { validateNativeSpecialAttackLevelProgressionEvidence } from "./native-special-attack-level-progression-validator";

const nativePath = process.env.DOKKAN_NATIVE_RUNTIME_PATH
    ?? "D:/Dokkan/database/apk/extracted/lib/arm64-v8a/libcocos2dcpp.so";

function loadFixture(): any {
    return JSON.parse(readFileSync(join(
        __dirname,
        "..",
        "..",
        "database-experiment",
        "native-special-attack-level-progression.json",
    ), "utf8"));
}

describe("native Special Attack level-progression evidence", function () {
    it("validates the pinned SQLite-to-runtime formula chain", function () {
        if (!existsSync(nativePath)) this.skip();
        const nativeBytes = readFileSync(nativePath);
        validateNativeSpecialAttackLevelProgressionEvidence(
            parseNativeRuntimeElf(nativeBytes),
            loadFixture(),
            createHash("sha256").update(nativeBytes).digest("hex"),
        );
    });

    it("rejects a changed progression instruction", function () {
        if (!existsSync(nativePath)) this.skip();
        const nativeBytes = readFileSync(nativePath);
        const evidence = loadFixture();
        evidence.structuralAssertions.find((item: any) => item.role === "multiply_add_level_progression").hex = "00000000";

        throws(() => validateNativeSpecialAttackLevelProgressionEvidence(
            parseNativeRuntimeElf(nativeBytes),
            evidence,
            createHash("sha256").update(nativeBytes).digest("hex"),
        ), /identity mismatch/);
    });
});
