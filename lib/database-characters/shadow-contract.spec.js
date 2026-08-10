"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const shadow_contract_1 = require("./shadow-contract");
describe("database character K10 shadow authority", () => {
    it("keeps K0-K2 candidates distinct from mandatory external fallback", () => {
        const byField = new Map(shadow_contract_1.CHARACTER_FIELD_AUTHORITY_MATRIX.map(rule => [rule.field, rule]));
        (0, assert_1.equal)(byField.size, shadow_contract_1.CHARACTER_FIELD_AUTHORITY_MATRIX.length);
        (0, assert_1.deepStrictEqual)(byField.get("originalRarity"), {
            field: "originalRarity",
            characterField: null,
            owner: "k2",
            authority: "database_candidate",
            note: "shadow-only structural Z-route roots",
        });
        for (const field of ["leaderSkill", "passive", "baseHP", "portraitURL", "releaseDate", "equipment"]) {
            (0, assert_1.equal)(byField.get(field)?.authority, "external_fallback");
        }
        (0, assert_1.ok)(byField.get("formGraph")?.characterField === null);
    });
    it("contains no unsupported product defaults or promoted owner", () => {
        (0, assert_1.equal)(shadow_contract_1.CHARACTER_FIELD_AUTHORITY_MATRIX.some(rule => rule.authority === "unsupported"), false);
        (0, assert_1.equal)(shadow_contract_1.CHARACTER_FIELD_AUTHORITY_MATRIX.some(rule => rule.owner !== "external" && rule.authority !== "database_candidate"), false);
    });
});
//# sourceMappingURL=shadow-contract.spec.js.map