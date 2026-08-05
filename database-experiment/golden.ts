import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { resolve } from "path";
import { DatabaseCardRecord, DatabaseCharacterExperimentDataset } from "./contract";

export type GoldenRequirement =
    | "growth-steps" | "unknown-release-state" | "eza" | "seza" | "release-date" | "future-state"
    | "projected-primary" | "nonterminal-collection"
    | "active" | "standby" | "finish"
    | "transformation" | "reversible-exchange"
    | "ultra-attack" | "unit-attack" | "ex-attack"
    | "unawakened-class";

export interface GoldenValidationResult {
    schemaVersion: 1,
    fixtureCount: number,
    passedCount: number,
    failures: Array<{ cardId: string, label: string, requirement: GoldenRequirement }>,
}

function latest(card: DatabaseCardRecord) {
    return card.skillStates[card.skillStates.length - 1];
}

function satisfies(card: DatabaseCardRecord, requirement: GoldenRequirement): boolean {
    switch (requirement) {
        case "growth-steps": return card.skillStates.length > 1;
        case "unknown-release-state": return card.skillStates.slice(1).every(state => state.releaseState === "unknown");
        case "eza": return card.skillStates.some(state => state.releaseState === "eza");
        case "seza": return card.skillStates.some(state => state.releaseState === "seza");
        case "release-date": return card.skillStates.slice(1).filter(state => state.releaseState !== "unknown").every(state => Boolean(state.release.availableAt));
        case "future-state": return card.skillStates.some(state => state.release.availableAtSnapshot === false);
        case "projected-primary": return card.catalog.isProjectedPrimary;
        case "nonterminal-collection": return card.catalog.isCollectionListed && !card.catalog.isProjectedPrimary && card.catalog.downstreamCollectionCardIds.length > 0;
        case "active": return card.activeSkills.length > 0;
        case "standby": return card.standbySkills.length > 0;
        case "finish": return card.finishSkills.length > 0;
        case "transformation": return card.formRelations.some(relation => relation.kind.value === "transformation");
        case "reversible-exchange": return card.formRelations.some(relation => relation.kind.value === "reversible-exchange");
        case "ultra-attack": return latest(card).attacks.some(attack => attack.variant.value === "ultra");
        case "unit-attack": return latest(card).attacks.some(attack => attack.variant.value === "unit");
        case "ex-attack": return latest(card).attacks.some(attack => attack.variant.value === "ex");
        case "unawakened-class": return card.characterClass.value === "unawakened";
    }
}

export async function validateGoldenFixtures(
    dataset: DatabaseCharacterExperimentDataset,
    fixturePath = existsSync(resolve(__dirname, "golden-fixtures.json"))
        ? resolve(__dirname, "golden-fixtures.json")
        : resolve(__dirname, "..", "..", "database-experiment", "golden-fixtures.json"),
): Promise<GoldenValidationResult> {
    const fixtureFile = JSON.parse(await readFile(fixturePath, "utf8")) as {
        schemaVersion: number,
        fixtures: Array<{ cardId: string, label: string, requires: GoldenRequirement[] }>,
    };
    if (fixtureFile.schemaVersion !== 1 || !Array.isArray(fixtureFile.fixtures)) throw new Error("Unsupported golden fixture contract");
    const cards = new Map(dataset.cards.map(card => [card.cardId, card]));
    const failures: GoldenValidationResult["failures"] = [];
    for (const fixture of fixtureFile.fixtures) {
        const card = cards.get(fixture.cardId);
        for (const requirement of fixture.requires) {
            if (!card || !satisfies(card, requirement)) failures.push({ cardId: fixture.cardId, label: fixture.label, requirement });
        }
    }
    return { schemaVersion: 1, fixtureCount: fixtureFile.fixtures.length, passedCount: fixtureFile.fixtures.length - new Set(failures.map(failure => failure.cardId)).size, failures };
}
