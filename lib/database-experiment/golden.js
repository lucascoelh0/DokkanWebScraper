"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateGoldenFixtures = void 0;
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
function latest(card) {
    return card.skillStates[card.skillStates.length - 1];
}
function satisfies(card, requirement) {
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
async function validateGoldenFixtures(dataset, fixturePath = (0, fs_1.existsSync)((0, path_1.resolve)(__dirname, "golden-fixtures.json"))
    ? (0, path_1.resolve)(__dirname, "golden-fixtures.json")
    : (0, path_1.resolve)(__dirname, "..", "..", "database-experiment", "golden-fixtures.json")) {
    const fixtureFile = JSON.parse(await (0, promises_1.readFile)(fixturePath, "utf8"));
    if (fixtureFile.schemaVersion !== 1 || !Array.isArray(fixtureFile.fixtures))
        throw new Error("Unsupported golden fixture contract");
    const cards = new Map(dataset.cards.map(card => [card.cardId, card]));
    const failures = [];
    for (const fixture of fixtureFile.fixtures) {
        const card = cards.get(fixture.cardId);
        for (const requirement of fixture.requires) {
            if (!card || !satisfies(card, requirement))
                failures.push({ cardId: fixture.cardId, label: fixture.label, requirement });
        }
    }
    return { schemaVersion: 1, fixtureCount: fixtureFile.fixtures.length, passedCount: fixtureFile.fixtures.length - new Set(failures.map(failure => failure.cardId)).size, failures };
}
exports.validateGoldenFixtures = validateGoldenFixtures;
//# sourceMappingURL=golden.js.map