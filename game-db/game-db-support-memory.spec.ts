import { deepEqual, equal, throws } from "assert";
import { describe, it } from "mocha";
import { SupportMemoryDetailsDataset } from "../support-memory-details";
import { buildSupportMemoryFirstPartyCandidate, SupportMemoryFirstPartyTables } from "./game-db-support-memory";
import { GameDbRow } from "./game-db-source";

const row = (values: Record<string, string | number | null>): GameDbRow => Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, value === null ? "" : String(value)]),
);

function fixture(): SupportMemoryFirstPartyTables {
    return {
        cards: [
            row({ id: 1, card_unique_info_id: 1 }), row({ id: 2, card_unique_info_id: 2 }),
            row({ id: 3, card_unique_info_id: 3 }), row({ id: 4, card_unique_info_id: 4 }),
        ],
        card_card_categories: [
            row({ id: 1, card_id: 1, card_category_id: 16 }),
            row({ id: 2, card_id: 2, card_category_id: 48 }),
            row({ id: 3, card_id: 3, card_category_id: 98 }),
            row({ id: 4, card_id: 4, card_category_id: 16 }),
            row({ id: 5, card_id: 4, card_category_id: 48 }),
        ],
        card_categories: [
            row({ id: 16, name: "Movie Bosses" }), row({ id: 48, name: "Revenge" }), row({ id: 98, name: "DAIMA" }),
        ],
        card_unique_info_set_relations: [row({ id: 1, card_unique_info_set_id: 98, card_unique_info_id: 3 })],
        mission_categories: [row({ id: 798, name: "Broly missions" })],
        mission_rewards: [row({ id: 43837, mission_id: 25331, item_id: 50015, item_type: "SupportMemory", quantity: 100 })],
        missions: [row({
            id: 25331, mission_category_id: 798, name: "Official mission", description: "Official description",
            start_at: "2024-09-20 06:00:00", end_at: "2038-01-01 00:00:00",
        })],
        sub_target_type_sets: [row({ id: 31 }), row({ id: 618 }), row({ id: 619 })],
        sub_target_types: [
            row({ id: 1, sub_target_type_set_id: 31, target_value_type: 1, target_value: 16 }),
            row({ id: 2, sub_target_type_set_id: 618, target_value_type: 2, target_value: 16 }),
            row({ id: 3, sub_target_type_set_id: 618, target_value_type: 1, target_value: 48 }),
            row({ id: 4, sub_target_type_set_id: 619, target_value_type: 4, target_value: 98 }),
        ],
        support_films: [row({ id: 5, name: "Film (Green)", description: "Green film" })],
        support_memories: [row({
            id: 50015, name: "Broly's Inner Power", description: "Official memory text", support_film_id: 5,
            cost: 200, unlock_quantity: 100, open_at: "2024-09-20 06:00:00",
        })],
        support_memory_enhancement_items: [],
        support_memory_enhancement_levels: [],
        support_memory_enhancement_require_items: [],
        support_memory_skills: [
            row({ id: 500151, support_memory_id: 50015, efficacy_type: 3, efficacy_values: "[10,10,0]", target_type: 2, calc_option: 2, turn: -1, probability: 100, sub_target_type_set_id: 31 }),
            row({ id: 500152, support_memory_id: 50015, efficacy_type: 3, efficacy_values: "[10,10,0]", target_type: 2, calc_option: 2, turn: -1, probability: 100, sub_target_type_set_id: 618 }),
            row({ id: 500153, support_memory_id: 50015, efficacy_type: 5, efficacy_values: "[1,0,0]", target_type: 2, calc_option: 0, turn: 7, probability: 100, sub_target_type_set_id: 619 }),
        ],
    };
}

function previous(): SupportMemoryDetailsDataset {
    return {
        generatedAt: "old",
        source: "dokkan.fyi",
        count: 1,
        entries: [{
            id: "50015", name: "Old", description: "Old", maxLevel: 1, enhancementChain: [], effects: [],
            categoryIds: ["16", "48", "98"], categoryNames: ["DAIMA", "Movie Bosses", "Revenge"],
            applicableCharacterIds: ["1"], unlockMethod: "direct-item",
            unlockAcquisition: {
                itemKey: "SupportMemory:50015", itemType: "SupportMemory", itemId: "50015", sourceModel: "acquisition-item",
                requiredQuantity: 1, groupCount: 1, sourceCount: 1,
                groups: [{ groupKey: "event-mission-category:798", groupKind: "event-mission-category", title: "Old mission", sourceCount: 1, sourceKeys: ["event-mission:798:25331:43837:50015"] }],
                sources: [{ sourceKey: "event-mission:798:25331:43837:50015", sourceKind: "event-mission", groupKey: "event-mission-category:798", groupKind: "event-mission-category", title: "Old mission", description: "Old description", quantity: 1 }],
            },
        }],
    };
}

const options = (tables: SupportMemoryFirstPartyTables) => ({
    generatedAt: "2026-08-31T12:00:00.000Z",
    sourceSnapshotVersion: "1787900894",
    sourceDatabaseSha256: "a".repeat(64),
    tables,
    previousDataset: previous(),
});

describe("Support Memory first-party candidate", function () {
    it("uses structural target sets, removes the false DAIMA relation, and overlays official mission facts", () => {
        const candidate = buildSupportMemoryFirstPartyCandidate(options(fixture()));
        const memory = candidate.dataset.entries[0];
        equal(candidate.dataset.source, "dokkan-game-db");
        deepEqual(memory.categoryIds, ["16", "48"]);
        deepEqual(memory.categoryNames, ["Movie Bosses", "Revenge"]);
        equal(memory.categoryTargetSource, "game-db-structural");
        deepEqual(memory.applicableCharacterIds, ["1", "2", "3", "4"]);
        equal(memory.applicableCharacterSource, "game-db-structural");
        equal(memory.lastsEntireBattle, true);
        equal(memory.unlockAcquisition?.sources[0].title, "Official mission");
        equal(memory.unlockAcquisition?.sources[0].quantity, 100);
        deepEqual(candidate.audit.compatibility.categoryChangedIds, ["50015"]);
        equal(candidate.audit.entries[0].targetRules.length, 3);
    });

    it("fails closed for unknown structural target semantics", () => {
        const tables = fixture();
        tables.sub_target_types[0].target_value_type = "3";
        throws(() => buildSupportMemoryFirstPartyCandidate(options(tables)), /Unsupported Support Memory sub-target value type/);
    });

    it("fails closed for malformed effect values", () => {
        const tables = fixture();
        tables.support_memory_skills[0].efficacy_values = "not-json";
        throws(() => buildSupportMemoryFirstPartyCandidate(options(tables)), /Invalid efficacy_values JSON/);
    });

    it("fails closed for a broken enhancement chain", () => {
        const tables = fixture();
        tables.support_memories.push(row({ id: 500152, name: "Enhanced", description: "Enhanced", support_film_id: 5, cost: 200, unlock_quantity: 1, open_at: "2024-09-20 06:00:00" }));
        tables.support_memory_enhancement_levels.push(row({ id: 9, root_support_memory_id: 50015, level: 3, support_memory_id: 50015, enhanced_support_memory_id: 500152 }));
        throws(() => buildSupportMemoryFirstPartyCandidate(options(tables)), /Broken Support Memory enhancement chain/);
    });
});
