import assert = require("assert");
import { buildDatabaseCharacterIdentityCoverage, buildDatabaseCharacterIdentityDataset } from "./identity-builder";
import { DatabaseCardRecord } from "../database-experiment/contract";
import { validateDatabaseCharacterIdentityDataset } from "./identity-validator";

function card(cardId: string, formTarget?: string): DatabaseCardRecord {
    const source = (table: string, rowId: string, values: Record<string, string | number | null> = { id: rowId }) => ({ values, provenance: { table, rowId, columns: Object.keys(values) } });
    return {
        cardId,
        recordKind: Number(cardId) >= 4_000_000 ? "form" : "collectable",
        ids: { characterId: "10", cardUniqueInfoId: "20", resourceId: "30", potentialBoardId: "40" },
        localizedText: { name: "presentation only" },
        rarity: { raw: 4, value: "UR", evidence: "current-dataset-exact-id-parity" },
        type: { raw: 10, value: "AGL", evidence: "current-dataset-exact-id-parity" },
        characterClass: { raw: 10, value: "Super", evidence: "current-dataset-exact-id-parity" },
        stats: { hpInitial: 1, hpMax: 2, atkInitial: 3, atkMax: 4, defInitial: 5, defMax: 6 },
        dates: { openAt: null, createdAt: null, updatedAt: null },
        grouping: { hardDuplicateGroupId: "card-group:1", awakeningFamilyId: "awakening:1", variantGroupId: "card-unique-info:20" },
        catalog: { collectionEntries: [], collectionUniques: [], downstreamCollectionCardIds: [], isCollectionListed: true, isProjectedPrimary: true, projectionEvidence: "first-party-row-join" },
        card: source("cards", cardId),
        character: source("characters", "10"),
        cardUniqueInfo: source("card_unique_infos", "20"),
        links: [], categories: [], awakeningPaths: { incoming: [], outgoing: [] },
        skillStates: [{ stateKey: `${cardId}:initial`, releaseState: "initial", releaseStateEvidence: "first-party-row-join", release: { availableAt: null, availableAtSnapshot: true, routes: [] }, maxLevel: 120, maxSuperAttackLevel: 10, attacks: [] }],
        activeSkills: [], standbySkills: [], finishSkills: [],
        formRelations: formTarget ? [{ sourceCardId: cardId, targetCardId: formTarget, kind: { raw: 103, value: "transformation", evidence: "first-party-row-join" }, channel: "passive", sourceSkillId: "99", provenance: { table: "passive_skills", rowId: "99", columns: ["id"] } }] : [],
        unknowns: [],
    };
}

describe("database character identity builder", () => {
    it("keeps card, character, form, state and UI grouping identities separate", async () => {
        async function* cards() { yield card("100", "4000001"); yield card("4000001"); }
        const dataset = await buildDatabaseCharacterIdentityDataset({
            inputDir: "fixture", artifactPath: "fixture", generatedAt: "2026-08-05T00:00:00.000Z", datasetVersion: "fixture",
            snapshotVersion: "fixture", databaseSha256: "a", artifactSha256: "b", artifactSizeBytes: 1, uncompressedSizeBytes: 1, cardCount: 2,
        }, cards());
        const coverage = buildDatabaseCharacterIdentityCoverage(dataset);
        assert.strictEqual(dataset.characters.length, 1);
        assert.strictEqual(dataset.cards[0].cardId, "100");
        assert.strictEqual(dataset.states[0].stateId, "card-state:100:initial");
        assert.strictEqual(dataset.relations.find(item => item.relation === "form")?.danglingTargetCount, 0);
        assert.strictEqual(coverage.duplicateCardIdentityCount, 0);
        assert.strictEqual(dataset.relations.find(item => item.relation === "form")?.assignments[0].targetId, "4000001");
    });

    it("rejects a truncated state projection", async () => {
        async function* cards() { yield card("100"); }
        const dataset = await buildDatabaseCharacterIdentityDataset({
            inputDir: "fixture", artifactPath: "fixture", generatedAt: "2026-08-05T00:00:00.000Z", datasetVersion: "fixture",
            snapshotVersion: "fixture", databaseSha256: "a", artifactSha256: "b", artifactSizeBytes: 1, uncompressedSizeBytes: 1, cardCount: 1,
        }, cards());
        const coverage = buildDatabaseCharacterIdentityCoverage(dataset);
        assert.strictEqual(validateDatabaseCharacterIdentityDataset(dataset, coverage).valid, false);
        assert.ok(validateDatabaseCharacterIdentityDataset(dataset, coverage).failures.some(item => item.includes("10654")));
    });
});
