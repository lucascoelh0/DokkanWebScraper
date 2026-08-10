"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const artifact_path_1 = require("./artifact-path");
const shadow_contract_1 = require("./shadow-contract");
const shadow_validator_1 = require("./shadow-validator");
const patch = (values = {}) => ({
    cardId: "1", recordKind: "collectable", characterId: "10", stateId: "s", releaseState: "initial", growthRowId: null,
    productionJoin: { status: "joined", externalId: "1", comparisonState: { stateKey: "1:initial" } }, fyiJoin: { status: "unjoinable", externalId: null, comparisonState: { stateKey: "1:initial" } },
    field: "rarity", characterField: "rarity", databaseValue: "UR", externalValue: { production: "UR", fyi: null }, effectiveShadowValue: "UR",
    evidenceStatus: "supported", authority: "database_candidate", comparison: "agreement", sourceComparisons: { production: "agreement", fyi: "unjoinable" },
    provenance: [
        { sidecar: "production", sidecarSha256: "p", sourceSnapshotVersion: "x", table: "Character[]", rowId: "1", column: "rarity", sourceRecordPath: "$[0]", recordSelectionPolicy: "top_level_then_first_nested_structural_id", sourceState: { stateId: "s", sourceStateKey: "1:initial", releaseState: "initial", growthRowId: null } },
        { sidecar: "k7", sidecarSha256: "7", sourceSnapshotVersion: "x", table: "cards", rowId: "1", sourceState: { stateId: "s", sourceStateKey: "1:initial", releaseState: "initial", growthRowId: null } },
    ], fallbackReason: null,
    ...values,
});
const projection = (fields, version = "1.0.0") => ({
    schemaVersion: 1, contract: "dokkan-database-character-field-shadow", contractVersion: version, generatedAt: "x",
    source: { snapshotVersion: "x", sidecars: { k0: { sha256: "0", sizeBytes: 0 }, k1: { sha256: "1", sizeBytes: 0 }, k2: { sha256: "2", sizeBytes: 0 }, k7: { sha256: "7", sizeBytes: 0 } }, productionCharacters: { sha256: "p", sizeBytes: 1, characterCount: 1 }, fyiCharacters: { sha256: "f", sizeBytes: 1, characterCount: 0, generatedAt: "x" } },
    policy: { structuralIdsOnly: true, nameTextOrNumericProximityInference: false, fieldScopedPatches: true, unsupportedDefaults: false, k7ValuesConsumed: false, productionModified: false, publisherEnabled: false, androidEnabled: false },
    authorityMatrix: shadow_contract_1.CHARACTER_FIELD_AUTHORITY_MATRIX, fields,
});
describe("database character K13 fallback safety", () => {
    it("keeps production byte-identical for absent, old, corrupt and unknown schemas", () => {
        const characters = [{ id: "1", rarity: "SSR", name: "Goku" }];
        const before = Buffer.from(JSON.stringify(characters));
        for (const input of [undefined, "corrupt", projection([patch()], "0.9.0"), { schemaVersion: 99 }, { ...projection([patch()]), fields: [null] }, { ...projection([patch()]), authorityMatrix: {} }]) {
            const result = (0, shadow_validator_1.applyOptionalCharacterShadowInMemory)(characters, input);
            (0, assert_1.equal)(result.applied, false);
            (0, assert_1.equal)(Buffer.compare(before, Buffer.from(JSON.stringify(result.characters))), 0);
            (0, assert_1.equal)(Buffer.compare(before, Buffer.from(JSON.stringify(characters))), 0);
        }
    });
    it("rejects a payload-defined authority matrix and keeps external fields unchanged", () => {
        const forged = projection([patch({
                field: "maxLevel", characterField: "maxLevel", databaseValue: 999, externalValue: { production: 120, fyi: null }, effectiveShadowValue: 999,
                authority: "database_candidate", comparison: "agreement", sourceComparisons: { production: "agreement", fyi: "unjoinable" },
            })]);
        forged.authorityMatrix = forged.authorityMatrix.map(rule => rule.field === "maxLevel"
            ? { ...rule, owner: "k2", authority: "database_candidate" }
            : rule);
        const source = [{ id: "1", maxLevel: 120 }];
        const result = (0, shadow_validator_1.applyOptionalCharacterShadowInMemory)(source, forged);
        (0, assert_1.equal)(result.applied, false);
        (0, assert_1.deepStrictEqual)(result.characters, source);
        (0, assert_1.ok)(result.validation?.failures.includes("non-canonical authority matrix"));
    });
    it("rejects a self-declared canonical candidate without the pinned manifest and coverage", () => {
        const selfDeclared = projection([patch({
                field: "type", characterField: "type", databaseValue: "PHY", externalValue: { production: null, fyi: null }, effectiveShadowValue: "PHY",
                authority: "database_candidate", comparison: "representation_gain", sourceComparisons: { production: "representation_gain", fyi: "unjoinable" },
            })]);
        const source = [{ id: "1" }];
        const result = (0, shadow_validator_1.applyOptionalCharacterShadowInMemory)(source, selfDeclared);
        (0, assert_1.equal)(result.applied, false);
        (0, assert_1.equal)(result.characters[0].type, undefined);
        (0, assert_1.ok)(result.validation?.failures.includes("unverified release identity"));
    });
    it("rejects partial, unjoinable, conflicting, duplicate and ambiguous patches", () => {
        const unsafe = [
            patch({ evidenceStatus: "partial", authority: "database_candidate" }),
            patch({ field: "type", characterField: "type", productionJoin: { status: "unjoinable", externalId: null, comparisonState: { stateKey: "1:initial" } }, authority: "database_candidate" }),
            patch({ field: "name", characterField: "name", comparison: "confirmed_conflict", sourceComparisons: { production: "confirmed_conflict", fyi: "unjoinable" }, authority: "database_candidate", databaseValue: "DB", externalValue: { production: "external", fyi: null }, effectiveShadowValue: "DB" }),
            patch(),
            patch({ stateId: "other", field: "characterClass", characterField: "characterClass" }),
        ];
        const validation = (0, shadow_validator_1.validateCharacterShadowProjection)(projection(unsafe));
        (0, assert_1.equal)(validation.valid, false);
        (0, assert_1.ok)(validation.failures.includes("partial or unknown database patch"));
        (0, assert_1.ok)(validation.failures.includes("unjoinable database patch"));
        (0, assert_1.ok)(validation.failures.includes("conflict winner selected"));
        (0, assert_1.ok)(validation.failures.includes("duplicate projection identity"));
        (0, assert_1.ok)(validation.failures.includes("ambiguous state binding"));
    });
    it("keeps missing locale text external and requires the pinned release before in-memory application", () => {
        const localeFallback = patch({ field: "name", characterField: "name", databaseValue: "Global", externalValue: { production: null, fyi: null }, effectiveShadowValue: null, authority: "external_fallback", comparison: "representation_gain", sourceComparisons: { production: "representation_gain", fyi: "unjoinable" } });
        const source = [{ id: "1", rarity: "SSR", name: "External" }];
        const result = (0, shadow_validator_1.applyOptionalCharacterShadowInMemory)(source, projection([localeFallback]));
        (0, assert_1.equal)(result.applied, false);
        (0, assert_1.equal)(result.reason, "invalid");
        (0, assert_1.ok)(result.validation?.failures.includes("unverified release identity"));
        (0, assert_1.equal)(result.characters[0].name, "External");
        (0, assert_1.deepStrictEqual)(source, [{ id: "1", rarity: "SSR", name: "External" }]);
    });
    it("rejects paths outside the controlled root", async () => {
        await (0, assert_1.rejects)((0, artifact_path_1.resolveCharacterInputFile)("D:/controlled", "../characters.json", "characters.json"));
    });
});
//# sourceMappingURL=shadow-validator.spec.js.map