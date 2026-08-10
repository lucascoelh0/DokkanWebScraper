import { deepStrictEqual, equal, ok } from "assert";
import { CHARACTER_FIELD_AUTHORITY_MATRIX } from "./shadow-contract";

describe("database character K10 shadow authority", () => {
    it("keeps K0-K2 candidates distinct from mandatory external fallback", () => {
        const byField = new Map(CHARACTER_FIELD_AUTHORITY_MATRIX.map(rule => [rule.field, rule]));
        equal(byField.size, CHARACTER_FIELD_AUTHORITY_MATRIX.length);
        deepStrictEqual(byField.get("originalRarity"), {
            field: "originalRarity",
            characterField: null,
            owner: "k2",
            authority: "database_candidate",
            note: "shadow-only structural Z-route roots",
        });
        for (const field of ["leaderSkill", "passive", "baseHP", "portraitURL", "releaseDate", "equipment"] as const) {
            equal(byField.get(field)?.authority, "external_fallback");
        }
        ok(byField.get("formGraph")?.characterField === "transformations");
    });

    it("contains no unsupported product defaults or promoted owner", () => {
        equal(CHARACTER_FIELD_AUTHORITY_MATRIX.some(rule => rule.authority === "unsupported"), false);
        equal(CHARACTER_FIELD_AUTHORITY_MATRIX.some(rule => rule.owner !== "external" && rule.authority !== "database_candidate"), false);
    });
});
