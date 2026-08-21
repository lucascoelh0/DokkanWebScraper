"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const character_1 = require("../character");
const game_db_app_projection_1 = require("./game-db-app-projection");
function makeBaseSnapshot() {
    return {
        id: "1033061",
        source: "game-db",
        characterId: "999",
        cardUniqueInfoId: "77",
        name: "Majin Vegeta + Super Saiyan 2 Goku (Angel)",
        rarity: character_1.Rarities.LR,
        type: character_1.Types.PHY,
        characterClass: character_1.Classes.Extreme,
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
(0, mocha_1.describe)("projectGameDbCharacterToDokkanpanion", function () {
    (0, mocha_1.it)("maps standby, finish skill, and reversible exchange mechanics", () => {
        const projection = (0, game_db_app_projection_1.projectGameDbCharacterToDokkanpanion)(makeBaseSnapshot());
        (0, assert_1.equal)(projection.leaderSkillBoost, 200);
        (0, assert_1.equal)(projection.standby?.targetCharacterId, "4029481");
        (0, assert_1.equal)(projection.finishSkills[0].targetTransformationId, "5029111");
        (0, assert_1.equal)(projection.finishSkills[0].effectKind, "mixed");
        (0, assert_1.equal)(projection.reversibleExchange?.targetCharacterId, "4033071");
        (0, assert_1.equal)(projection.superAttackDetails?.length, 0);
        (0, assert_1.equal)(projection.transformations.length, 3);
        (0, assert_1.deepEqual)(projection.transformations.map(item => item.source), [
            "reversible-exchange",
            "standby",
            "finish-skill",
        ]);
    });
    (0, mocha_1.it)("projects distinct first-party Active Skill identities and raw operands", () => {
        const projection = (0, game_db_app_projection_1.projectGameDbCharacterToDokkanpanion)({
            ...makeBaseSnapshot(),
            activeSkillSets: [{
                    id: "216",
                    name: "Spirit Bomb Super Saiyan",
                    effectDescription: "Massively raises ATK temporarily",
                    conditionDescription: "Can be activated once only",
                    turn: 1,
                    execLimit: 1,
                    ultimateSpecialId: "62",
                    effects: [{
                            id: "270",
                            activeSkillSetId: "216",
                            targetType: 1,
                            subTargetTypeSetId: "0",
                            calcOption: 0,
                            efficacyType: 90,
                            values: ["100", "0", "0"],
                            efficacyValues: [],
                            provenance: { table: "active_skills", rowId: "270" },
                        }],
                    provenance: {
                        relation: { table: "card_active_skills", rowId: "327" },
                        set: { table: "active_skill_sets", rowId: "216" },
                    },
                }],
        });
        (0, assert_1.equal)(projection.activeSkillDetails?.length, 1);
        (0, assert_1.deepEqual)(projection.activeSkillDetails?.[0], {
            id: "216",
            name: "Spirit Bomb Super Saiyan",
            description: "Massively raises ATK temporarily",
            condition: "Can be activated once only",
            turn: 1,
            executionLimit: 1,
            ultimateSpecialId: "62",
            effects: [{
                    id: "270",
                    efficacyType: 90,
                    targetType: 1,
                    subTargetTypeSetId: "0",
                    calculationOption: 0,
                    valuesJson: '["100","0","0"]',
                    efficacyValuesJson: '[]',
                    provenance: { table: "active_skills", rowId: "270" },
                }],
            source: {
                kind: "game_db",
                relation: { table: "card_active_skills", rowId: "327" },
                set: { table: "active_skill_sets", rowId: "216" },
            },
        });
    });
    (0, mocha_1.it)("projects source-neutral Super Attack details without leaking audit-only evidence", () => {
        const projection = (0, game_db_app_projection_1.projectGameDbCharacterToDokkanpanion)({
            ...makeBaseSnapshot(),
            superAttacks: [{
                    cardSpecialId: "17379",
                    specialSetId: "7731",
                    name: "Demon Death Ball",
                    description: "Greatly raises DEF for 4 turns and causes mega-colossal damage to all enemies",
                    style: "Hyper",
                    variant: "ultra",
                    levelStart: 1,
                    requiredKi: 18,
                    viewId: "17379",
                    increaseRate: 250,
                    levelBonus: 10,
                    specialBonuses: [{ slot: 1, id: "12", level: 20, viewId: "3" }],
                    effects: [{
                            id: "1007731",
                            specialSetId: "7731",
                            type: "Special::ExtraEfficacySpecial",
                            efficacyType: 111,
                            targetType: 1,
                            calcOption: 0,
                            turn: 1,
                            probability: 100,
                            causalityConditionsRaw: "[]",
                            values: [null, "0", null],
                            semantic: {
                                kind: "action_break",
                                status: "partial",
                                actionSelection: "one_eligible_current_enemy_action_per_marker",
                                evidence: {
                                    fileName: "native-special-action-break-semantics.json",
                                    nativeRuntimeSha256: "7d6c2c1e095fc20a71ec4764e88a17b4d4b82f3f12952b9ba8c6eb0405a7215a",
                                },
                            },
                            provenance: { table: "specials", rowId: "1007731" },
                        }],
                    provenance: {
                        cardSpecial: { table: "card_specials", rowId: "17379" },
                        specialSet: { table: "special_sets", rowId: "7731" },
                    },
                }],
        });
        (0, assert_1.equal)(projection.superAttackDetails?.length, 1);
        const attack = projection.superAttackDetails?.[0];
        if (!attack) {
            throw new Error("Expected one projected Super Attack");
        }
        (0, assert_1.equal)(attack.id, "17379");
        (0, assert_1.equal)(attack.name, "Demon Death Ball");
        (0, assert_1.equal)(attack.variant, "ultra");
        (0, assert_1.equal)(attack.requiredKi, 18);
        (0, assert_1.deepEqual)(attack.attackIncrease, {
            level1Percent: 250,
            maxLevelPercent: 440,
            maxLevel: 20,
        });
        const serialized = JSON.stringify(projection.superAttackDetails);
        (0, assert_1.equal)(serialized.includes("Special::"), false);
        (0, assert_1.equal)(serialized.includes("specialSetId"), false);
        (0, assert_1.equal)(serialized.includes("increaseRate"), false);
        (0, assert_1.equal)(serialized.includes("levelBonus"), false);
        (0, assert_1.equal)(serialized.includes("levelStart"), false);
        (0, assert_1.equal)(serialized.includes("action_break"), false);
        (0, assert_1.equal)(serialized.includes("provenance"), false);
    });
    (0, mocha_1.it)("projects the native Super Attack level curve without exposing source columns", () => {
        const projection = (0, game_db_app_projection_1.projectGameDbCharacterToDokkanpanion)({
            ...makeBaseSnapshot(),
            baseMaxSaLevel: 10,
            superAttacks: [{
                    cardSpecialId: "15001",
                    specialSetId: "5001",
                    name: "Smart Shot",
                    description: "Causes supreme damage to enemy",
                    variant: "super",
                    requiredKi: 12,
                    increaseRate: 150,
                    levelBonus: 20,
                    specialBonuses: [],
                    effects: [],
                    provenance: {
                        cardSpecial: { table: "card_specials", rowId: "15001" },
                        specialSet: { table: "special_sets", rowId: "5001" },
                    },
                }],
        });
        (0, assert_1.deepEqual)(projection.superAttackDetails?.[0].attackIncrease, {
            level1Percent: 150,
            maxLevelPercent: 330,
            maxLevel: 10,
        });
        const serialized = JSON.stringify(projection.superAttackDetails);
        (0, assert_1.equal)(serialized.includes("increaseRate"), false);
        (0, assert_1.equal)(serialized.includes("levelBonus"), false);
    });
    (0, mocha_1.it)("omits an incomplete Super Attack level curve", () => {
        const projection = (0, game_db_app_projection_1.projectGameDbCharacterToDokkanpanion)({
            ...makeBaseSnapshot(),
            superAttacks: [{
                    cardSpecialId: "15001",
                    specialSetId: "5001",
                    name: "Unknown curve",
                    description: "Causes damage to enemy",
                    variant: "super",
                    increaseRate: 150,
                    specialBonuses: [],
                    effects: [],
                    provenance: {
                        cardSpecial: { table: "card_specials", rowId: "15001" },
                        specialSet: { table: "special_sets", rowId: "5001" },
                    },
                }],
        });
        (0, assert_1.equal)(projection.superAttackDetails?.[0].attackIncrease, undefined);
    });
    (0, mocha_1.it)("omits the endpoint when awakening states make the applicable SA cap ambiguous", () => {
        const projection = (0, game_db_app_projection_1.projectGameDbCharacterToDokkanpanion)({
            ...makeBaseSnapshot(),
            growthSteps: [{ id: "1", step: 1, maxSaLevel: 25 }],
            superAttacks: [{
                    cardSpecialId: "20074",
                    specialSetId: "8999",
                    name: "Full-Metal Avalanche (Extreme)",
                    description: "Raises ATK and greatly raises DEF for 1 turn",
                    variant: "super",
                    levelStart: 24,
                    increaseRate: 200,
                    levelBonus: 5,
                    specialBonuses: [],
                    effects: [],
                    provenance: {
                        cardSpecial: { table: "card_specials", rowId: "20074" },
                        specialSet: { table: "special_sets", rowId: "8999" },
                    },
                }],
        });
        (0, assert_1.equal)(projection.superAttackDetails?.[0].attackIncrease, undefined);
    });
    (0, mocha_1.it)("falls back cleanly when optional mechanics are absent", () => {
        const projection = (0, game_db_app_projection_1.projectGameDbCharacterToDokkanpanion)({
            ...makeBaseSnapshot(),
            standbySkillSets: [],
            finishSkillSets: [],
            formRelations: [],
            leaderSkill: undefined,
            passiveSkillSet: undefined,
        });
        (0, assert_1.equal)(projection.leaderSkill, "");
        (0, assert_1.equal)(projection.activeSkill, "");
        (0, assert_1.equal)(projection.standbySkill, "");
        (0, assert_1.equal)(projection.finishSkills.length, 0);
        (0, assert_1.equal)(projection.reversibleExchange, undefined);
        (0, assert_1.equal)(projection.passive, "");
        (0, assert_1.equal)(projection.createdDomain, undefined);
        (0, assert_1.equal)(projection.domain, "");
    });
    (0, mocha_1.it)("projects a snapshot-audited Created Domain without parsing Active Skill text", () => {
        const base = makeBaseSnapshot();
        const projection = (0, game_db_app_projection_1.projectGameDbCharacterToDokkanpanion)({
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
        (0, assert_1.equal)(projection.domain, "Earth Shrouded in Minus Energy");
        (0, assert_1.deepEqual)(projection.createdDomain, {
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
//# sourceMappingURL=game-db-app-projection.spec.js.map