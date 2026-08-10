import { deepStrictEqual, equal } from "assert";
import { buildCharacterShadowCoverage } from "./shadow-parity-builder";
import { CharacterShadowProjection } from "./shadow-contract";

describe("database character K12 field parity", () => {
    it("keeps classifications exclusive and preserves the four K7 conflicts", () => {
        const projection: CharacterShadowProjection = {
            schemaVersion: 1, contract: "dokkan-database-character-field-shadow", contractVersion: "1.0.0", generatedAt: "x",
            source: { snapshotVersion: "x", sidecars: { k0: { sha256: "0", sizeBytes: 0 }, k1: { sha256: "1", sizeBytes: 0 }, k2: { sha256: "2", sizeBytes: 0 }, k7: { sha256: "k7", sizeBytes: 0 } }, productionCharacters: { sha256: "p", sizeBytes: 1, characterCount: 1 }, fyiCharacters: { sha256: "f", sizeBytes: 1, characterCount: 1, generatedAt: "x" } },
            policy: { structuralIdsOnly: true, nameTextOrNumericProximityInference: false, fieldScopedPatches: true, unsupportedDefaults: false, k7ValuesConsumed: false, productionModified: false, publisherEnabled: false, androidEnabled: false },
            authorityMatrix: [{ field: "rarity", characterField: "rarity", owner: "k2", authority: "database_candidate", note: "x" }, { field: "leaderSkill", characterField: "leaderSkill", owner: "external", authority: "external_fallback", note: "x" }],
            fields: [{ cardId: "1027621", recordKind: "collectable", characterId: "1", stateId: "s", releaseState: "initial", growthRowId: null, productionJoin: { status: "joined", externalId: "1027621", comparisonState: { releaseState: "initial" } as any }, fyiJoin: { status: "joined", externalId: "1027621", comparisonState: { releaseState: "eza" } as any }, field: "rarity", characterField: "rarity", databaseValue: "UR", externalValue: { production: "UR", fyi: "UR" }, effectiveShadowValue: "UR", evidenceStatus: "supported", authority: "database_candidate", comparison: "agreement", sourceComparisons: { production: "agreement", fyi: "agreement" }, provenance: [], fallbackReason: null }],
        };
        const conflict = (cardId: string, rowId: string) => ({ cardId, fyi: { conflicts: [{ field: "maxLevel", databaseValue: 140, externalValue: 120 }, { field: "maxSALevel", databaseValue: 15, externalValue: 10 }], comparisonState: { stateKey: `${cardId}:growth-7`, releaseState: "eza", growthStepSource: { table: "optimal_awakening_growths", rowId } } } });
        const result = buildCharacterShadowCoverage(projection, { cards: [conflict("1027621", "4885"), conflict("1028161", "4844")] } as any);
        equal(result.fieldCoverage[0].production.agreements, 1);
        equal(result.fieldCoverage[0].stateCoverage.initial, 1);
        equal(result.fieldCoverage[0].stateCoverage.eza, 0);
        equal(result.fieldCoverage[0].comparisonStateCoverage.fyi.eza, 1);
        equal(result.fieldCoverage[1].production.externalFallback, 1);
        equal(result.preservedK7Conflicts.length, 4);
        deepStrictEqual(result.preservedK7Conflicts.map(item => item.cardId), ["1027621", "1027621", "1028161", "1028161"]);
        equal(result.catalogImpact.productionCatalogSizeChange, 0);
    });
});
