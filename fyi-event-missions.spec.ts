import { deepEqual, equal } from "assert";
import {
    buildEventMissionDataset,
    mapEventMissionCategoryFromFyi,
    mapEventMissionEntryFromFyi,
    mapEventMissionRewardFromFyi,
} from "./fyi-event-missions";

describe("mapEventMissionRewardFromFyi", () => {
    it("keeps exclusive skill-orb metadata on event mission rewards", () => {
        const mapped = mapEventMissionRewardFromFyi({
            id: 42838,
            item_id: 4311,
            item_type: "EquipmentSkillItem",
            quantity: 1,
            mission_id: 24832,
            item: {
                id: 4311,
                name: "[Character-Exclusive] EX Skill Orb DEF + Lv. 8",
                description: "Can be equipped to Goku & Vegeta.",
                grade: "bronze",
                is_reusable: true,
                img_id: "00009",
                skills: [
                    {
                        id: 431100,
                        attribute: "defense",
                        level: 8,
                        hidden_potential_skill_id: null,
                    },
                ],
            },
        });

        deepEqual(mapped, {
            id: "42838",
            missionId: "24832",
            itemId: "4311",
            itemType: "EquipmentSkillItem",
            quantity: 1,
            name: "[Character-Exclusive] EX Skill Orb DEF + Lv. 8",
            description: "Can be equipped to Goku & Vegeta.",
            rarity: undefined,
            zeni: undefined,
            tradePoints: undefined,
            rewardType: undefined,
            amount: undefined,
            grade: "bronze",
            isReusable: true,
            imageId: "00009",
            skills: [
                {
                    id: "431100",
                    attribute: "defense",
                    level: 8,
                    hiddenPotentialSkillId: undefined,
                },
            ],
        });
    });
});

describe("mapEventMissionEntryFromFyi", () => {
    it("maps mission copy, dates and nested rewards", () => {
        const mapped = mapEventMissionEntryFromFyi({
            id: 24832,
            type: "Mission::QuestAndZBattleClearMission::CountMission",
            name: "Clear Stage 3.",
            description: "Clear Stage 3 once!<br /><br />No retries needed.",
            rewards: [
                {
                    id: 1,
                    item_id: 11,
                    item_type: "Point::Stone",
                    quantity: 2,
                    mission_id: 24832,
                    item: {
                        id: 11,
                        type: "Dragon Stone",
                        amount: 1,
                    },
                },
            ],
            characters: [],
            priority: 1,
            starts_at: "2024-08-26T06:00:00.000000Z",
            ends_at: "2038-01-01T00:00:00.000000Z",
            category_id: 796,
            completed: false,
        });

        equal(mapped.id, "24832");
        equal(mapped.description, "Clear Stage 3 once!\nNo retries needed.");
        equal(mapped.categoryId, "796");
        equal(mapped.rewards[0].itemType, "Point::Stone");
        equal(mapped.rewards[0].amount, 1);
    });
});

describe("mapEventMissionCategoryFromFyi", () => {
    it("keeps preview rewards from the index summary and nested missions from the detail page", () => {
        const mapped = mapEventMissionCategoryFromFyi(
            {
                id: 796,
                type: "MissionCategory::ExtraMissionCategory",
                ends_at: "2038-01-01 00:00:00",
                is_indefinite: 1,
                priority: 80206,
                img: "https://cdn.dokkan.fyi/assets/en/mission/mission_banner_event_796_3.png",
                missions_count: 30,
                completed_count: null,
                missions: [
                    {
                        id: 24832,
                        type: "Mission::QuestAndZBattleClearMission::CountMission",
                        name: "Clear Stage 3.",
                        description: "Clear it once!",
                        rewards: [],
                        characters: [],
                        priority: 1,
                        starts_at: "2024-08-26T06:00:00.000000Z",
                        ends_at: "2038-01-01T00:00:00.000000Z",
                        category_id: 796,
                        completed: false,
                    },
                ],
            },
            {
                id: 796,
                reward: {
                    id: 10,
                    item1_id: 11,
                    item1_type: "Point::Stone",
                    item1: {
                        id: 11,
                        type: "Dragon Stone",
                        amount: 1,
                    },
                },
            },
        );

        equal(mapped.id, "796");
        equal(mapped.previewRewards.length, 1);
        equal(mapped.previewRewards[0].itemType, "Point::Stone");
        equal(mapped.missions.length, 1);
        equal(mapped.missions[0].id, "24832");
    });
});

describe("buildEventMissionDataset", () => {
    it("counts categories and missions at the dataset root", () => {
        const dataset = buildEventMissionDataset([
            {
                id: "796",
                previewRewards: [],
                missions: [
                    {
                        id: "24832",
                        name: "Mission",
                        description: "Description",
                        rewards: [],
                        characters: [],
                    },
                ],
            },
        ]);

        deepEqual(
            {
                count: dataset.count,
                missionCount: dataset.missionCount,
                firstCategory: dataset.categories[0].id,
            },
            {
                count: 1,
                missionCount: 1,
                firstCategory: "796",
            },
        );
    });
});
