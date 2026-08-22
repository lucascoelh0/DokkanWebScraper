import { deepEqual, equal } from "assert";
import { describe, it } from "mocha";
import { Rarities, Types, Classes } from "../character";
import { GameDbCharacterSnapshot, GameDbSuperAttackEffect } from "./game-db-contract";
import { projectGameDbCharacterToDokkanpanion } from "./game-db-app-projection";

function makeBaseSnapshot(): GameDbCharacterSnapshot {
    const leaderSkill = {
        id: "10",
        name: "Fated Showdown",
        description: "All Types Ki +3 and HP, ATK & DEF +200%",
        effects: [],
    };
    const passiveSkillSet = {
        id: "4887",
        name: "Power Boosted through Pride",
        itemizedDescription: "*Basic effect(s)*\n- Guards all attacks",
        passiveSkills: [],
    };

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
        leaderSkill,
        passiveSkillSet,
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
        equal(projection.superAttackDetails?.length, 0);
        equal(projection.transformations.length, 3);
        deepEqual(projection.transformations.map(item => item.source), [
            "reversible-exchange",
            "standby",
            "finish-skill",
        ]);
    });

    it("projects distinct first-party Active Skill identities and raw operands", () => {
        const projection = projectGameDbCharacterToDokkanpanion({
            ...makeBaseSnapshot(),
            activeSkillSets: [{
                id: "216",
                name: "Spirit Bomb Super Saiyan",
                effectDescription: "Massively raises ATK temporarily",
                conditionDescription: "Can be activated once only",
                turn: 1,
                execLimit: 1,
                ultimateSpecialId: "62",
                ultimateAttack: {
                    id: "62",
                    name: "Ultimate attack",
                    description: "Ultimate damage +50%",
                    attackMultiplierPercent: 600,
                    isMultiTarget: false,
                    provenance: { table: "ultimate_specials", rowId: "62" },
                },
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

        equal(projection.activeSkillDetails?.length, 1);
        deepEqual(projection.activeSkillDetails?.[0], {
            id: "216",
            name: "Spirit Bomb Super Saiyan",
            description: "Massively raises ATK temporarily",
            condition: "Can be activated once only",
            turn: 1,
            executionLimit: 1,
            ultimateSpecialId: "62",
            ultimateAttack: {
                id: "62",
                name: "Ultimate attack",
                description: "Ultimate damage +50%",
                attackMultiplierPercent: 600,
                isMultiTarget: false,
                provenance: { table: "ultimate_specials", rowId: "62" },
            },
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

    it("projects source-neutral Super Attack details without leaking audit-only evidence", () => {
        const projection = projectGameDbCharacterToDokkanpanion({
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

        equal(projection.superAttackDetails?.length, 1);
        const attack = projection.superAttackDetails?.[0];
        if (!attack) {
            throw new Error("Expected one projected Super Attack");
        }
        equal(attack.id, "17379");
        equal(attack.name, "Demon Death Ball");
        equal(attack.variant, "ultra");
        equal(attack.requiredKi, 18);
        deepEqual(attack.attackIncrease, {
            level1Percent: 250,
            maxLevelPercent: 440,
            maxLevel: 20,
        });
        const serialized = JSON.stringify(projection.superAttackDetails);
        equal(serialized.includes("Special::"), false);
        equal(serialized.includes("specialSetId"), false);
        equal(serialized.includes("increaseRate"), false);
        equal(serialized.includes("levelBonus"), false);
        equal(serialized.includes("levelStart"), false);
        equal(serialized.includes("action_break"), false);
        equal(serialized.includes("provenance"), false);
    });

    it("projects the native Super Attack level curve without exposing source columns", () => {
        const projection = projectGameDbCharacterToDokkanpanion({
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

        deepEqual(projection.superAttackDetails?.[0].attackIncrease, {
            level1Percent: 150,
            maxLevelPercent: 330,
            maxLevel: 10,
        });
        const serialized = JSON.stringify(projection.superAttackDetails);
        equal(serialized.includes("increaseRate"), false);
        equal(serialized.includes("levelBonus"), false);
    });

    it("adds a typed self-applicable ally ATK compensation to the displayed Super Attack curve", () => {
        const projection = projectGameDbCharacterToDokkanpanion({
            ...makeBaseSnapshot(),
            baseMaxSaLevel: 25,
            superAttacks: [{
                cardSpecialId: "20432",
                specialSetId: "9148",
                name: "Rivalry Between Three Great Super Saiyans (Extreme)",
                description: "Raises allies' ATK & DEF by 3% for 3 turns",
                variant: "super",
                requiredKi: 12,
                increaseRate: 197,
                levelBonus: 5,
                specialBonuses: [],
                effects: [{
                    id: "1009148",
                    specialSetId: "9148",
                    type: "Special::NormalEfficacySpecial",
                    efficacyType: 3,
                    targetType: 2,
                    calcOption: 2,
                    turn: 3,
                    probability: 100,
                    values: ["3", "3", "0"],
                    provenance: { table: "specials", rowId: "1009148" },
                }],
                provenance: {
                    cardSpecial: { table: "card_specials", rowId: "20432" },
                    specialSet: { table: "special_sets", rowId: "9148" },
                },
            }],
        });

        deepEqual(projection.superAttackDetails?.[0].attackIncrease, {
            level1Percent: 200,
            maxLevelPercent: 320,
            maxLevel: 25,
        });
    });

    it("does not adjust a Super Attack curve for conditional or ambiguous compensation effects", () => {
        const matchingEffect: GameDbSuperAttackEffect = {
            id: "1009148",
            specialSetId: "9148",
            type: "Special::NormalEfficacySpecial",
            efficacyType: 3,
            targetType: 2,
            calcOption: 2,
            turn: 3,
            probability: 100,
            values: ["3", "3", "0"],
            provenance: { table: "specials" as const, rowId: "1009148" },
        };
        const project = (effects: typeof matchingEffect[]) => projectGameDbCharacterToDokkanpanion({
            ...makeBaseSnapshot(),
            baseMaxSaLevel: 25,
            superAttacks: [{
                cardSpecialId: "20432",
                specialSetId: "9148",
                name: "Rivalry Between Three Great Super Saiyans (Extreme)",
                description: "Raises allies' ATK & DEF by 3% for 3 turns",
                variant: "super",
                requiredKi: 12,
                increaseRate: 197,
                levelBonus: 5,
                specialBonuses: [],
                effects,
                provenance: {
                    cardSpecial: { table: "card_specials", rowId: "20432" },
                    specialSet: { table: "special_sets", rowId: "9148" },
                },
            }],
        }).superAttackDetails?.[0].attackIncrease;

        deepEqual(project([{ ...matchingEffect, causalityConditionsRaw: "[{\"condition\":1}]" }]), {
            level1Percent: 197,
            maxLevelPercent: 317,
            maxLevel: 25,
        });
        deepEqual(project([
            matchingEffect,
            { ...matchingEffect, id: "1009149", provenance: { table: "specials", rowId: "1009149" } },
        ]), {
            level1Percent: 197,
            maxLevelPercent: 317,
            maxLevel: 25,
        });
    });

    it("preserves first-party passive markers with game DB provenance", () => {
        const base = makeBaseSnapshot();
        const rawPassive = [
            "*Basic effect(s)*",
            "- {passiveImg:once}ATK & DEF 250%{passiveImg:up_g} for 7 turns",
            "*When attacking*",
            "- ATK 200%{passiveImg:up_g}",
        ].join("\n");
        const projection = projectGameDbCharacterToDokkanpanion({
            ...base,
            passiveSkillSet: {
                id: "5036",
                name: "Three Super Saiyans",
                itemizedDescription: rawPassive,
                passiveSkills: [],
            },
        }, { sourceVersion: "1787282006" });

        const source = projection.passiveDetails?.structuralSource;
        equal(source?.rawText, rawPassive);
        equal(source?.evidence.length, 2);
        deepEqual(source?.evidence[0].markers.map(marker => marker.markerKind), ["once", "value_up"]);
        equal(source?.evidence[0].provenance.source, "first_party_game_db");
        equal(source?.evidence[0].provenance.sourceVersion, "1787282006");
        equal(source?.evidence[0].provenance.payloadField, "passive_skill_sets.itemized_description");
        equal(source?.evidence[1].anchor.normalizedText, "ATK 200%");
    });

    it("omits an incomplete Super Attack level curve", () => {
        const projection = projectGameDbCharacterToDokkanpanion({
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

        equal(projection.superAttackDetails?.[0].attackIncrease, undefined);
    });

    it("omits the endpoint when awakening states make the applicable SA cap ambiguous", () => {
        const projection = projectGameDbCharacterToDokkanpanion({
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

        equal(projection.superAttackDetails?.[0].attackIncrease, undefined);
    });

    it("projects distinct initial, EZA, and SEZA fields from typed release states", () => {
        const baseAttack = {
            cardSpecialId: "13330",
            specialSetId: "5147",
            name: "Rivalry Between Three Great Super Saiyans",
            description: "Greatly raises ATK for 3 turns and causes colossal damage",
            variant: "super" as const,
            levelStart: 0,
            requiredKi: 12,
            increaseRate: 200,
            levelBonus: 5,
            specialBonuses: [],
            effects: [],
            provenance: {
                cardSpecial: { table: "card_specials" as const, rowId: "13330" },
                specialSet: { table: "special_sets" as const, rowId: "5147" },
            },
        };
        const ezaAttack = {
            ...baseAttack,
            cardSpecialId: "20432",
            specialSetId: "9148",
            name: "Rivalry Between Three Great Super Saiyans (Extreme)",
            levelStart: 24,
            provenance: {
                cardSpecial: { table: "card_specials" as const, rowId: "20432" },
                specialSet: { table: "special_sets" as const, rowId: "9148" },
            },
        };
        const snapshot = makeBaseSnapshot();
        const projection = projectGameDbCharacterToDokkanpanion({
            ...snapshot,
            hasEza: true,
            hasSeza: true,
            growthSteps: [
                { id: "3", step: 3, maxLevel: 150, maxSaLevel: 25, passiveSkillSetId: "5036", leaderSkillSetId: "1028061" },
                { id: "4", step: 4, maxLevel: 150, maxSaLevel: 25, passiveSkillSetId: "6000", leaderSkillSetId: "1028061" },
            ],
            superAttacks: [baseAttack, ezaAttack],
            releaseStates: {
                initial: {
                    releaseState: "initial",
                    maxLevel: 150,
                    maxSaLevel: 20,
                    leaderSkill: snapshot.leaderSkill,
                    passiveSkillSet: snapshot.passiveSkillSet,
                    superAttacks: [baseAttack],
                },
                eza: {
                    releaseState: "eza",
                    maxLevel: 150,
                    maxSaLevel: 25,
                    leaderSkill: {
                        id: "1028061",
                        name: "Extreme leader",
                        description: "All Types Ki +3 and HP, ATK & DEF +200%",
                        effects: [],
                    },
                    passiveSkillSet: {
                        id: "5036",
                        name: "Extreme passive",
                        itemizedDescription: "ATK & DEF +250%",
                        passiveSkills: [],
                    },
                    superAttacks: [ezaAttack],
                    growthStep: { id: "3", step: 3, maxLevel: 150, maxSaLevel: 25 },
                },
                seza: {
                    releaseState: "seza",
                    maxLevel: 150,
                    maxSaLevel: 25,
                    passiveSkillSet: {
                        id: "6000",
                        name: "Super Extreme passive",
                        itemizedDescription: "ATK & DEF +300%",
                        passiveSkills: [],
                    },
                    superAttacks: [ezaAttack],
                    growthStep: { id: "4", step: 4, maxLevel: 150, maxSaLevel: 25 },
                },
            },
        });

        equal(projection.leaderSkillBoost, 200);
        equal(projection.ezaLeaderSkillBoost, 200);
        equal(projection.passiveDetails?.name, "Power Boosted through Pride");
        equal(projection.ezaPassiveDetails?.name, "Extreme passive");
        equal(projection.sezaPassiveDetails?.name, "Super Extreme passive");
        deepEqual(projection.superAttackDetails?.[0].attackIncrease, {
            level1Percent: 200,
            maxLevelPercent: 295,
            maxLevel: 20,
        });
        deepEqual(projection.ezaSuperAttackDetails?.[0].attackIncrease, {
            level1Percent: 200,
            maxLevelPercent: 320,
            maxLevel: 25,
        });
        equal(projection.superAttackDetails?.[0].id, "13330");
        equal(projection.ezaSuperAttackDetails?.[0].id, "20432");
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

