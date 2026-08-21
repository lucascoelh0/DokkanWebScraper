"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const assert_1 = require("assert");
const fs_1 = require("fs");
const path_1 = require("path");
const mocha_1 = require("mocha");
const game_db_super_attack_1 = require("../game-db/game-db-super-attack");
const native_runtime_elf_adapter_1 = require("./native-runtime-elf-adapter");
const native_special_action_break_evidence_validator_1 = require("./native-special-action-break-evidence-validator");
(0, mocha_1.describe)("native Special action-break evidence", function () {
    (0, mocha_1.it)("validates the pinned native chain before matching the app projection", function () {
        const nativePath = process.env.DOKKAN_NATIVE_RUNTIME_PATH
            ?? "D:/Dokkan/database/apk/extracted/lib/arm64-v8a/libcocos2dcpp.so";
        if (!(0, fs_1.existsSync)(nativePath))
            this.skip();
        const nativeBytes = (0, fs_1.readFileSync)(nativePath);
        const evidence = JSON.parse((0, fs_1.readFileSync)((0, path_1.join)(__dirname, "..", "..", "database-experiment", "native-special-action-break-semantics.json"), "utf8"));
        (0, native_special_action_break_evidence_validator_1.validateNativeSpecialActionBreakEvidence)((0, native_runtime_elf_adapter_1.parseNativeRuntimeElf)(nativeBytes), evidence, (0, crypto_1.createHash)("sha256").update(nativeBytes).digest("hex"));
        const [attack] = (0, game_db_super_attack_1.mapSuperAttacks)("1031501", [{ id: "17379", special_set_id: "7731" }], new Map([["7731", { id: "7731", name: "Demon Death Ball" }]]), new Map([["7731", [{
                        id: "1007731",
                        special_set_id: "7731",
                        type: "Special::ExtraEfficacySpecial",
                        efficacy_type: "111",
                        target_type: "3",
                        calc_option: "0",
                        turn: "1",
                        prob: "100",
                    }]]]));
        (0, assert_1.deepStrictEqual)(attack.effects[0].semantic, evidence.semanticProjection);
    });
});
//# sourceMappingURL=native-special-action-break-evidence-validator.spec.js.map