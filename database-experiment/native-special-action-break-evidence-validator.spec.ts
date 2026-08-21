import { createHash } from "crypto";
import { deepStrictEqual } from "assert";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { describe, it } from "mocha";
import { mapSuperAttacks } from "../game-db/game-db-super-attack";
import { parseNativeRuntimeElf } from "./native-runtime-elf-adapter";
import { validateNativeSpecialActionBreakEvidence } from "./native-special-action-break-evidence-validator";

describe("native Special action-break evidence", function () {
    it("validates the pinned native chain before matching the app projection", function () {
        const nativePath = process.env.DOKKAN_NATIVE_RUNTIME_PATH
            ?? "D:/Dokkan/database/apk/extracted/lib/arm64-v8a/libcocos2dcpp.so";
        if (!existsSync(nativePath)) this.skip();

        const nativeBytes = readFileSync(nativePath);
        const evidence = JSON.parse(readFileSync(join(
            __dirname,
            "..",
            "..",
            "database-experiment",
            "native-special-action-break-semantics.json",
        ), "utf8"));
        validateNativeSpecialActionBreakEvidence(
            parseNativeRuntimeElf(nativeBytes),
            evidence,
            createHash("sha256").update(nativeBytes).digest("hex"),
        );

        const [attack] = mapSuperAttacks(
            "1031501",
            [{ id: "17379", special_set_id: "7731" }],
            new Map([["7731", { id: "7731", name: "Demon Death Ball" }]]),
            new Map([["7731", [{
                id: "1007731",
                special_set_id: "7731",
                type: "Special::ExtraEfficacySpecial",
                efficacy_type: "111",
                target_type: "3",
                calc_option: "0",
                turn: "1",
                prob: "100",
            }]]]),
        );
        deepStrictEqual(attack.effects[0].semantic, evidence.semanticProjection);
    });
});
