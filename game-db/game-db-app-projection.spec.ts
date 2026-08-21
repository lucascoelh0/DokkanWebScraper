import { deepEqual, equal } from "assert";
import { describe, it } from "mocha";
import { Rarities, Types, Classes } from "../character";
import { GameDbCharacterSnapshot } from "./game-db-contract";
import { projectGameDbCharacterToDokkanpanion } from "./game-db-app-projection";

function makeBaseSnapshot(): GameDbCharacterSnapshot {
    return {
        id: "1033061",
        source: "game-db",
        characterId: "999",
        cardUniqueInfoId: "77",
        name: "Majin Vegeta + Super Saiyan 2 Goku (Angel)",
        rarity: Rarities.LR,
        type: Types.PHY,
        characterClass: Classes.Extreme,
        cost: 77,
        releaseDate: "2025-01-01T00:00:00.000Z",
        baseMaxLevel: 150,
        baseMaxSaLevel: 20,
        stats: {
            hpInitial: 5000,
            hpMax: 15000,
            atkInitial: 4000,
            atkMax: 14000,
            defInitial: 2500,
            defMax: 9000,
        },
        links: [{ id: "1", name: "Prepared for Battle" }],
        categories: [{ id: "2", name: "Majin Buu Saga" }],
        leaderSkill: {
            id: "10",
            name: "Fated Showdown",
            description: "All Types Ki +3 and HP, ATK & DEF +200%",
            effects: [],
        },
        passiveSkillSet: {
            id: "4887",
            name: "Power Boosted through Pride",
            itemizedDescription: "*Basic effect(s)*\n- Guards all attacks",
            passiveSkills: [],
        },
        superAttacks: [],
        activeSkillSets: [],
        standbySkillSets: [
            {
                id: "24",
                name: "Enters Standby Mode",
                effectDescription: "Stands by for 5 turns.",
                conditionDescription: "Can be activated starting from Turn 4.",
                linkedFinishSkillSetIds: ["91"],
            },
        ],
        finishSkillSets: [
            {
                id: "91",
                name: "Finish Attack",
                effectDescription: "Causes ultimate damage and transforms.",
                conditionDescription: "Can be activated when charge count is full.",
                linkedStandbySkillSetIds: ["24"],
            },
        ],
        formRelations: [
            {
                sourceCardId: "1033061",
                targetCardId: "4033071",
                targetName: "Super Saiyan 2 Goku (Angel) + Majin Vegeta",
                kind: "passive-reversible-exchange",
                sourceSkillSetId: "4887",
                sourceSkillId: "4887",
                sourceName: "Power Boosted through Pride",
                description: "Meets up with Super Saiyan 2 Goku (Angel) and can perform Reversible Exchange.",
            },
            {
                sourceCardId: "1033061",
                targetCardId: "4029481",
                targetName: "Super Saiyan Gohan (Teen)",
                kind: "standby-transformation",
                sourceSkillSetId: "24",
                sourceSkillId: "67",
                sourceName: "Enters Standby Mode",
                description: "Can be activated starting from Turn 4.",
            },
            {
                sourceCardId: "1033061",
                targetCardId: "5029111",
                targetName: "Post-Finish Form",
                kind: "finish-transformation",
                sourceSkillSetId: "91",
                sourceSkillId: "99",
                sourceName: "Finish Attack",
                description: "Can be activated when charge count is full.",
            },
        ],
        growthSteps: [],
        hasEza: false,
        hasSeza: false,
        awakeningRoutes: {
            incoming: [],
            outgoing: [],
        },
        raw: {},
    };
}

describe("projectGameDbCharacterToDokkanpanion", function () {
    it("maps standby, finish skill, and reversible exchange mechanics", () => {
        const projection = projectGameDbCharacterToDokkanpanion(makeBaseSnapshot());

        equal(projection.leaderSkillBoost, 200);
        equal(projection.standby?.targetCharacterId, "4029481");
        equal(projection.finishSkills[0].targetTransformationId, "5029111");
        equal(projection.finishSkills[0].effectKind, "mixed");
        equal(projection.reversibleExchange?.targetCharacterId, "4033071");
        equal(projection.transformations.length, 3);
        deepEqual(projection.transformations.map(item => item.source), [
            "reversible-exchange",
            "standby",
            "finish-skill",
        ]);
    });

    it("falls back cleanly when optional mechanics are absent", () => {
        const projection = projectGameDbCharacterToDokkanpanion({
            ...makeBaseSnapshot(),
            standbySkillSets: [],
            finishSkillSets: [],
            formRelations: [],
            leaderSkill: undefined,
            passiveSkillSet: undefined,
        });

        equal(projection.leaderSkill, "");
        equal(projection.activeSkill, "");
        equal(projection.standbySkill, "");
        equal(projection.finishSkills.length, 0);
        equal(projection.reversibleExchange, undefined);
        equal(projection.passive, "");
        equal(projection.createdDomain, undefined);
        equal(projection.domain, "");
    });

    it("projects a snapshot-audited Created Domain without parsing Active Skill text", () => {
        const base = makeBaseSnapshot();
        const projection = projectGameDbCharacterToDokkanpanion({
            ...base,
            activeSkillSets: [{
                id: "323",
                name: "Devastating Minus Energy",
                effectDescription: "Opaque localized text",
                conditionDescription: "",
                effects: [],
                createdDomain: {
                    semanticStatus: "snapshot-audited",
                    sourceSnapshotId: "glb-db-1782367825",
                    activeSkillSetId: "323",
                    field: {
                        id: "11",
                        name: "Earth Shrouded in Minus Energy",
                        resourceId: "3010",
                        description: "Enemies' and allies' ATK +25%",
                    },
                    provenance: {
                        activeSkillSet: { table: "active_skill_sets", rowId: "323" },
                        relation: { table: "dokkan_field_active_skill_set_relations", rowId: "13" },
                        field: { table: "dokkan_fields", rowId: "11" },
                    },
                },
                provenance: {
                    relation: { table: "card_active_skills", rowId: "1" },
                    set: { table: "active_skill_sets", rowId: "323" },
                },
            }],
        });

        equal(projection.domain, "Earth Shrouded in Minus Energy");
        deepEqual(projection.createdDomain, {
            semanticStatus: "snapshot-audited",
            sourceSnapshotId: "glb-db-1782367825",
            activeSkillSetId: "323",
            field: {
                id: "11",
                name: "Earth Shrouded in Minus Energy",
                resourceId: "3010",
                description: "Enemies' and allies' ATK +25%",
            },
            provenance: {
                activeSkillSet: { table: "active_skill_sets", rowId: "323" },
                relation: { table: "dokkan_field_active_skill_set_relations", rowId: "13" },
                field: { table: "dokkan_fields", rowId: "11" },
            },
        });
    });
});

