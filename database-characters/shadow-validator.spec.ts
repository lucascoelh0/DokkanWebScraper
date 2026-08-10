import { deepStrictEqual, equal, ok, rejects } from "assert";
import { resolveCharacterInputFile } from "./artifact-path";
import { CharacterFieldProjection, CharacterShadowProjection } from "./shadow-contract";
import { applyOptionalCharacterShadowInMemory, validateCharacterShadowProjection } from "./shadow-validator";

const patch = (values: Partial<CharacterFieldProjection> = {}): CharacterFieldProjection => ({
    cardId: "1", recordKind: "collectable", characterId: "10", stateId: "s", releaseState: "initial", growthRowId: null,
    productionJoin: { status: "joined", externalId: "1", comparisonState: { stateKey: "1:initial" } as any }, fyiJoin: { status: "unjoinable", externalId: null, comparisonState: { stateKey: "1:initial" } as any },
    field: "rarity", characterField: "rarity", databaseValue: "UR", externalValue: { production: "UR", fyi: null }, effectiveShadowValue: "UR",
    evidenceStatus: "supported", authority: "database_candidate", comparison: "agreement", sourceComparisons: { production: "agreement", fyi: "unjoinable" },
    provenance: [{ sidecar: "k7", sidecarSha256: "7", sourceSnapshotVersion: "x", table: "cards", rowId: "1", sourceState: { stateId: "s", sourceStateKey: "1:initial", releaseState: "initial", growthRowId: null } }], fallbackReason: null,
    ...values,
});
const projection = (fields: CharacterFieldProjection[], version: any = "1.0.0"): CharacterShadowProjection => ({
    schemaVersion: 1, contract: "dokkan-database-character-field-shadow", contractVersion: version, generatedAt: "x",
    source: { snapshotVersion: "x", sidecars: { k0: { sha256: "0", sizeBytes: 0 }, k1: { sha256: "1", sizeBytes: 0 }, k2: { sha256: "2", sizeBytes: 0 }, k7: { sha256: "7", sizeBytes: 0 } }, productionCharacters: { sha256: "p", sizeBytes: 1, characterCount: 1 }, fyiCharacters: { sha256: "f", sizeBytes: 1, characterCount: 0, generatedAt: "x" } },
    policy: { structuralIdsOnly: true, nameTextOrNumericProximityInference: false, fieldScopedPatches: true, unsupportedDefaults: false, k7ValuesConsumed: false, productionModified: false, publisherEnabled: false, androidEnabled: false },
    authorityMatrix: [
        { field: "rarity", characterField: "rarity", owner: "k2", authority: "database_candidate", note: "x" },
        { field: "type", characterField: "type", owner: "k2", authority: "database_candidate", note: "x" },
        { field: "name", characterField: "name", owner: "k2", authority: "database_candidate", note: "x" },
        { field: "characterClass", characterField: "characterClass", owner: "k2", authority: "database_candidate", note: "x" },
    ], fields,
});

describe("database character K13 fallback safety", () => {
    it("keeps production byte-identical for absent, old, corrupt and unknown schemas", () => {
        const characters: any[] = [{ id: "1", rarity: "SSR", name: "Goku" }];
        const before = Buffer.from(JSON.stringify(characters));
        for (const input of [undefined, "corrupt", projection([patch()], "0.9.0"), { schemaVersion: 99 }]) {
            const result = applyOptionalCharacterShadowInMemory(characters, input as any);
            equal(result.applied, false);
            equal(Buffer.compare(before, Buffer.from(JSON.stringify(result.characters))), 0);
            equal(Buffer.compare(before, Buffer.from(JSON.stringify(characters))), 0);
        }
    });

    it("rejects partial, unjoinable, conflicting, duplicate and ambiguous patches", () => {
        const unsafe = [
            patch({ evidenceStatus: "partial", authority: "database_candidate" }),
            patch({ field: "type", characterField: "type", productionJoin: { status: "unjoinable", externalId: null, comparisonState: { stateKey: "1:initial" } as any }, authority: "database_candidate" }),
            patch({ field: "name", characterField: "name", comparison: "confirmed_conflict", sourceComparisons: { production: "confirmed_conflict", fyi: "unjoinable" }, authority: "database_candidate", databaseValue: "DB", externalValue: { production: "external", fyi: null }, effectiveShadowValue: "DB" }),
            patch(),
            patch({ stateId: "other", field: "characterClass", characterField: "characterClass" }),
        ];
        const validation = validateCharacterShadowProjection(projection(unsafe));
        equal(validation.valid, false);
        ok(validation.failures.includes("partial or unknown database patch"));
        ok(validation.failures.includes("unjoinable database patch"));
        ok(validation.failures.includes("conflict winner selected"));
        ok(validation.failures.includes("duplicate projection identity"));
        ok(validation.failures.includes("ambiguous state binding"));
    });

    it("keeps missing locale text external and applies valid patches only to memory", () => {
        const localeFallback = patch({ field: "name", characterField: "name", databaseValue: "Global", externalValue: { production: null, fyi: null }, effectiveShadowValue: null, authority: "external_fallback", comparison: "representation_gain", sourceComparisons: { production: "representation_gain", fyi: "unjoinable" } });
        const source: any[] = [{ id: "1", rarity: "SSR", name: "External" }];
        const result = applyOptionalCharacterShadowInMemory(source, projection([localeFallback]));
        equal(result.applied, true);
        equal(result.characters[0].name, "External");
        deepStrictEqual(source, [{ id: "1", rarity: "SSR", name: "External" }]);
    });

    it("rejects paths outside the controlled root", async () => {
        await rejects(resolveCharacterInputFile("D:/controlled", "../characters.json", "characters.json"));
    });
});
