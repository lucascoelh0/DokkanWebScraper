"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const path_1 = require("path");
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const native_runtime_elf_adapter_1 = require("./native-runtime-elf-adapter");
const native_special_attack_level_progression_validator_1 = require("./native-special-attack-level-progression-validator");
const nativePath = process.env.DOKKAN_NATIVE_RUNTIME_PATH
    ?? "D:/Dokkan/database/apk/extracted/lib/arm64-v8a/libcocos2dcpp.so";
function loadFixture() {
    return JSON.parse((0, fs_1.readFileSync)((0, path_1.join)(__dirname, "..", "..", "database-experiment", "native-special-attack-level-progression.json"), "utf8"));
}
(0, mocha_1.describe)("native Special Attack level-progression evidence", function () {
    (0, mocha_1.it)("validates the pinned SQLite-to-runtime formula chain", function () {
        if (!(0, fs_1.existsSync)(nativePath))
            this.skip();
        const nativeBytes = (0, fs_1.readFileSync)(nativePath);
        (0, native_special_attack_level_progression_validator_1.validateNativeSpecialAttackLevelProgressionEvidence)((0, native_runtime_elf_adapter_1.parseNativeRuntimeElf)(nativeBytes), loadFixture(), (0, crypto_1.createHash)("sha256").update(nativeBytes).digest("hex"));
    });
    (0, mocha_1.it)("rejects a changed progression instruction", function () {
        if (!(0, fs_1.existsSync)(nativePath))
            this.skip();
        const nativeBytes = (0, fs_1.readFileSync)(nativePath);
        const evidence = loadFixture();
        evidence.structuralAssertions.find((item) => item.role === "multiply_add_level_progression").hex = "00000000";
        (0, assert_1.throws)(() => (0, native_special_attack_level_progression_validator_1.validateNativeSpecialAttackLevelProgressionEvidence)((0, native_runtime_elf_adapter_1.parseNativeRuntimeElf)(nativeBytes), evidence, (0, crypto_1.createHash)("sha256").update(nativeBytes).digest("hex")), /identity mismatch/);
    });
});
//# sourceMappingURL=native-special-attack-level-progression-validator.spec.js.map