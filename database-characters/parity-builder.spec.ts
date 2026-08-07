import { deepStrictEqual, equal, ok } from "assert";
import { buildDatabaseCharacterParityCoverage, buildDatabaseCharacterParityDataset, compareCharacterParity, CompactDatabaseCard, compactExternalCharacters } from "./parity-builder";
import { validateDatabaseCharacterParityDataset } from "./parity-validator";

const card = (): CompactDatabaseCard => ({
    cardId: "1",
    recordKind: "collectable",
    rarity: "UR",
    type: "AGL",
    characterClass: "unawakened",
    stats: { hpInitial: 1, hpMax: 10, atkInitial: 2, atkMax: 20, defInitial: 3, defMax: 30 },
    states: [
        { stateKey: "1:initial", releaseState: "initial", availableAt: "2020-01-01 00:00:00", availableAtSnapshot: true, progressionStep: 0, growthStepSource: null, maxLevel: 120, maxSALevel: 10 },
        { stateKey: "1:growth-7", releaseState: "eza", availableAt: "2021-01-01 00:00:00", availableAtSnapshot: true, progressionStep: 7, growthStepSource: { table: "optimal_awakening_growths", rowId: "7" }, maxLevel: 140, maxSALevel: 15 },
    ],
    hasExAttack: false,
    formIds: ["4"],
});

describe("database character parity", () => {
    it("joins nested forms only by their structural IDs", () => {
        const values = compactExternalCharacters([{ id: "1", name: "ignored", transformations: [{ id: "4", name: "also ignored", transformations: [] }] }]);
        ok(values.has("1"));
        ok(values.has("4"));
        equal(values.get("1")!.transformationIds[0], "4");
    });

    it("keeps incompatible class, EZA max-stat and form domains unknown", () => {
        const external = compactExternalCharacters([{ id: "1", rarity: "UR", type: "AGL", characterClass: "Super", maxLevel: 140, maxSALevel: 15, baseHP: 1, maxLevelHP: 99, baseAttack: 2, maxLevelAttack: 99, baseDefence: 3, maxDefence: 99, transformations: [{ id: "9" }] }]).get("1")!;
        const parity = compareCharacterParity(card(), external, "fyi", "2022-01-01T00:00:00.000Z");
        equal(parity.comparisonState.stateKey, "1:growth-7");
        deepStrictEqual(parity.conflicts, []);
        for (const field of ["characterClass", "maxLevelHP", "maxLevelAttack", "maxDefence", "form_target_set"]) ok(parity.unknownFields.includes(field));
    });

    it("selects the initial state for the legacy production contract", () => {
        const external = compactExternalCharacters([{ id: "1", rarity: "UR", type: "AGL", maxLevel: 120, maxSALevel: 10, baseHP: 1, maxLevelHP: 10, baseAttack: 2, maxLevelAttack: 20, baseDefence: 3, maxDefence: 30 }]).get("1")!;
        const parity = compareCharacterParity(card(), external, "production", "");
        equal(parity.comparisonState.stateKey, "1:initial");
        equal(parity.conflicts.length, 0);
    });

    it("rejects a forged FYI future state and a changed audit inventory", () => {
        const external = compactExternalCharacters([{ id: "1", rarity: "UR", type: "AGL", maxLevel: 140, maxSALevel: 15, baseHP: 1, baseAttack: 2, baseDefence: 3 }]);
        const dataset = buildDatabaseCharacterParityDataset({
            source: { inputDir: "", artifactPath: "", generatedAt: "2026-08-05T00:00:00.000Z", datasetVersion: "test", snapshotVersion: "test", databaseSha256: "db", artifactSha256: "db1", artifactSizeBytes: 1, uncompressedSizeBytes: 1, cardCount: 1 },
            cards: [card()],
            production: external,
            productionSha256: "production",
            productionSizeBytes: 1,
            productionTopLevelCount: 1,
            fyi: external,
            fyiSha256: "fyi",
            fyiSizeBytes: 1,
            fyiTopLevelCount: 1,
            fyiGeneratedAt: "2022-01-01T00:00:00.000Z",
            teamSha256: "team",
            teamStateCount: 0,
            c3: { records: [] } as any,
            c3Sha256: "c3",
        });
        dataset.cards[0].fyi.comparisonState.availableAt = "2023-01-01 00:00:00";
        (dataset.historicalAudits[0] as any).issue = "forged";
        const validation = validateDatabaseCharacterParityDataset(dataset, buildDatabaseCharacterParityCoverage(dataset));
        ok(validation.failures.some(failure => failure.startsWith("FYI unavailable state")));
        ok(validation.failures.includes("historical audit inventory"));
        ok(validation.failures.includes("historical audit derivation"));
    });
});
