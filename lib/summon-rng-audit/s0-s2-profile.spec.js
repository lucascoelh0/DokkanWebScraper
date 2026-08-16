"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const mocha_1 = require("mocha");
const s0_s2_contract_1 = require("./s0-s2-contract");
const s0_s2_profile_1 = require("./s0-s2-profile");
(0, mocha_1.describe)("S0-S2 pinned summon audit profile", () => {
    (0, mocha_1.it)("builds a valid fail-closed audit", () => {
        const validation = (0, s0_s2_contract_1.validateS0S2Audit)((0, s0_s2_profile_1.buildS0S2Audit)());
        assert.deepEqual(validation.failures, []);
        assert.equal(validation.valid, true);
    });
    (0, mocha_1.it)("contains one unique descriptor for every locally available artifact role", () => {
        assert.deepEqual(s0_s2_profile_1.S0_S2_ARTIFACTS.map(value => value.role).sort(), ["apk", "elf", "sqlite_backup", "sqlite_current"]);
        assert.equal(new Set(s0_s2_profile_1.S0_S2_ARTIFACTS.map(value => value.id)).size, s0_s2_profile_1.S0_S2_ARTIFACTS.length);
    });
    (0, mocha_1.it)("rejects bytes that do not match a pinned artifact", () => {
        const failures = (0, s0_s2_profile_1.validatePinnedArtifactBytes)(s0_s2_profile_1.S0_S2_ARTIFACTS[0], Buffer.from("not an APK"));
        assert.equal(failures.some(value => value.includes("size changed")), true);
        assert.equal(failures.some(value => value.includes("SHA-256 changed")), true);
        assert.equal(failures.some(value => value.includes("ZIP header changed")), true);
    });
    (0, mocha_1.it)("rejects a non-ELF before evaluating native claims", () => {
        assert.equal((0, s0_s2_profile_1.validatePinnedElf)(Buffer.from("not an ELF"))[0].startsWith("ELF structure:"), true);
    });
});
//# sourceMappingURL=s0-s2-profile.spec.js.map