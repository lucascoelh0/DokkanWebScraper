"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const shadow_builder_1 = require("./shadow-builder");
const baseProjection = (patch) => ({
    cardId: "1", recordKind: "collectable", characterId: "10", stateId: "card-state:1:initial", releaseState: "initial", growthRowId: null,
    productionJoin: { status: "joined", externalId: "1", comparisonState: {} }, fyiJoin: { status: "unjoinable", externalId: null, comparisonState: {} },
    field: "rarity", characterField: "rarity", databaseValue: "UR", externalValue: { production: "SSR", fyi: null }, effectiveShadowValue: "SSR",
    evidenceStatus: "supported", authority: "external_fallback", comparison: "confirmed_conflict", sourceComparisons: { production: "confirmed_conflict", fyi: "unjoinable" }, provenance: [], fallbackReason: "conflict",
    ...patch,
});
const dataset = (fields) => ({
    schemaVersion: 1, contract: "dokkan-database-character-field-shadow", contractVersion: "1.0.0", generatedAt: "x",
    source: { snapshotVersion: "x", sidecars: { k0: { sha256: "0", sizeBytes: 0 }, k1: { sha256: "1", sizeBytes: 0 }, k2: { sha256: "2", sizeBytes: 0 }, k7: { sha256: "7", sizeBytes: 0 } }, productionCharacters: { sha256: "p", sizeBytes: 1, characterCount: 1 }, fyiCharacters: { sha256: "f", sizeBytes: 1, characterCount: 0, generatedAt: "x" } },
    policy: { structuralIdsOnly: true, nameTextOrNumericProximityInference: false, fieldScopedPatches: true, unsupportedDefaults: false, k7ValuesConsumed: false, productionModified: false, publisherEnabled: false, androidEnabled: false }, authorityMatrix: [], fields,
});
describe("database character K11 shadow projection", () => {
    it("applies only supported agreement/gain patches to an in-memory clone", () => {
        const source = [{ id: "1", rarity: "SSR", name: "Goku" }];
        const projected = (0, shadow_builder_1.applyCharacterShadowInMemory)(source, dataset([
            baseProjection({ authority: "database_candidate", comparison: "agreement", databaseValue: "UR", effectiveShadowValue: "UR" }),
            baseProjection({ field: "name", characterField: "name", databaseValue: "forged", evidenceStatus: "partial", authority: "external_fallback", comparison: "unknown" }),
        ]));
        (0, assert_1.equal)(projected[0].rarity, "UR");
        (0, assert_1.equal)(projected[0].name, "Goku");
        (0, assert_1.deepStrictEqual)(source, [{ id: "1", rarity: "SSR", name: "Goku" }]);
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
});
//# sourceMappingURL=shadow-builder.spec.js.map