"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const shadow_builder_1 = require("./shadow-builder");
const shadow_source_1 = require("./shadow-source");
const baseProjection = (patch) => ({
    cardId: "1", recordKind: "collectable", characterId: "10", stateId: "card-state:1:initial", releaseState: "initial", growthRowId: null,
    productionJoin: { status: "joined", externalId: "1", comparisonState: {} }, fyiJoin: { status: "unjoinable", externalId: null, comparisonState: {} },
    field: "rarity", characterField: "rarity", databaseValue: "UR", externalValue: { production: "SSR", fyi: null }, effectiveShadowValue: "SSR",
    evidenceStatus: "supported", authority: "external_fallback", comparison: "confirmed_conflict", sourceComparisons: { production: "confirmed_conflict", fyi: "unjoinable" },
    provenance: [{ sidecar: "production", sidecarSha256: "p", sourceSnapshotVersion: "x", table: "Character[]", rowId: "1", column: "rarity", sourceRecordPath: "$[0]", recordSelectionPolicy: "top_level_then_first_nested_structural_id", sourceState: null }], fallbackReason: "conflict",
    ...patch,
});
const dataset = (fields) => ({
    schemaVersion: 1, contract: "dokkan-database-character-field-shadow", contractVersion: "1.0.0", generatedAt: "x",
    source: { snapshotVersion: "x", sidecars: { k0: { sha256: "0", sizeBytes: 0 }, k1: { sha256: "1", sizeBytes: 0 }, k2: { sha256: "2", sizeBytes: 0 }, k7: { sha256: "7", sizeBytes: 0 } }, productionCharacters: { sha256: "p", sizeBytes: 1, characterCount: 1 }, fyiCharacters: { sha256: "f", sizeBytes: 1, characterCount: 0, generatedAt: "x" } },
    policy: { structuralIdsOnly: true, nameTextOrNumericProximityInference: false, fieldScopedPatches: true, unsupportedDefaults: false, k7ValuesConsumed: false, productionModified: false, publisherEnabled: false, androidEnabled: false }, authorityMatrix: [], fields,
});
describe("database character K11 shadow projection", () => {
    it("does not apply manually declared patches without pinned release verification", () => {
        const source = [{ id: "1", name: "Goku" }];
        const projected = (0, shadow_builder_1.applyCharacterShadowInMemory)(source, dataset([
            baseProjection({ authority: "database_candidate", comparison: "representation_gain", databaseValue: "UR", externalValue: { production: null, fyi: null }, effectiveShadowValue: "UR" }),
            baseProjection({ field: "name", characterField: "name", databaseValue: "forged", evidenceStatus: "partial", authority: "external_fallback", comparison: "unknown" }),
        ]));
        (0, assert_1.equal)(projected[0].rarity, undefined);
        (0, assert_1.equal)(projected[0].name, "Goku");
        (0, assert_1.deepStrictEqual)(source, [{ id: "1", name: "Goku" }]);
    });
    it("does not create an unjoinable character or choose a conflict winner", () => {
        const source = [{ id: "1", rarity: "SSR" }];
        const projected = (0, shadow_builder_1.applyCharacterShadowInMemory)(source, dataset([
            baseProjection({ cardId: "2", productionJoin: { status: "unjoinable", externalId: null, comparisonState: {} }, authority: "unsupported", comparison: "unjoinable" }),
            baseProjection({ authority: "external_fallback", comparison: "confirmed_conflict" }),
        ]));
        (0, assert_1.equal)(projected.length, 1);
        (0, assert_1.equal)(projected[0].rarity, "SSR");
        (0, assert_1.ok)(!projected.some(item => item.id === "2"));
    });
    it("keeps both top-level and nested records unchanged for unverified or forged patches", () => {
        const source = [{ id: "1" }, { id: "base", transformations: [{ id: "1", rarity: "nested" }] }];
        const projected = (0, shadow_builder_1.applyCharacterShadowInMemory)(source, dataset([
            baseProjection({ authority: "database_candidate", comparison: "representation_gain", databaseValue: "UR", externalValue: { production: null, fyi: null }, effectiveShadowValue: "UR" }),
            baseProjection({ field: "maxLevel", characterField: "maxLevel", databaseValue: 999, externalValue: { production: 120, fyi: null }, effectiveShadowValue: 999, authority: "database_candidate", comparison: "agreement" }),
        ]));
        (0, assert_1.equal)(projected[0].rarity, undefined);
        (0, assert_1.equal)(projected[1].transformations[0].rarity, "nested");
        (0, assert_1.equal)(projected[0].maxLevel, undefined);
    });
    it("prefers top-level product records and rejects divergent nested duplicate IDs", () => {
        const compact = (0, shadow_source_1.compactCharacters)([{ id: "base", transformations: [{ id: "1", name: "nested" }] }, { id: "1", name: "top" }]);
        (0, assert_1.equal)(compact.get("1")?.name, "top");
        (0, assert_1.equal)(compact.get("1")?.sourceRecordPath, "$[1]");
        assertThrows(() => (0, shadow_source_1.compactCharacters)([
            { id: "a", transformations: [{ id: "2", name: "left" }] },
            { id: "b", transformations: [{ id: "2", name: "right" }] },
        ]));
    });
});
function assertThrows(action) {
    let threw = false;
    try {
        action();
    }
    catch {
        threw = true;
    }
    (0, assert_1.equal)(threw, true);
}
//# sourceMappingURL=shadow-builder.spec.js.map