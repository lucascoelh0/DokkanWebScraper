import assert = require("assert");
import { describe, it } from "mocha";
import { validateS0S2Audit } from "./s0-s2-contract";
import { buildS0S2Audit, S0_S2_ARTIFACTS, validatePinnedArtifactBytes, validatePinnedElf } from "./s0-s2-profile";

describe("S0-S2 pinned summon audit profile", () => {
    it("builds a valid fail-closed audit", () => {
        const validation = validateS0S2Audit(buildS0S2Audit());
        assert.deepEqual(validation.failures, []);
        assert.equal(validation.valid, true);
    });

    it("contains one unique descriptor for every locally available artifact role", () => {
        assert.deepEqual(S0_S2_ARTIFACTS.map(value => value.role).sort(), ["apk", "elf", "sqlite_backup", "sqlite_current"]);
        assert.equal(new Set(S0_S2_ARTIFACTS.map(value => value.id)).size, S0_S2_ARTIFACTS.length);
    });

    it("rejects bytes that do not match a pinned artifact", () => {
        const failures = validatePinnedArtifactBytes(S0_S2_ARTIFACTS[0], Buffer.from("not an APK"));
        assert.equal(failures.some(value => value.includes("size changed")), true);
        assert.equal(failures.some(value => value.includes("SHA-256 changed")), true);
        assert.equal(failures.some(value => value.includes("ZIP header changed")), true);
    });

    it("rejects a non-ELF before evaluating native claims", () => {
        assert.equal(validatePinnedElf(Buffer.from("not an ELF"))[0].startsWith("ELF structure:"), true);
    });
});
