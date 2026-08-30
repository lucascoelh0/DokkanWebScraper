"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const fyi_scraper_1 = require("./fyi-scraper");
(0, mocha_1.describe)("passiveDetailsFromSkill enemy-status evidence", function () {
    (0, mocha_1.it)("keeps display text unchanged while preserving ordered structural status markers", () => {
        const description = "*When the target enemy is in the following status: {passiveImg:atk_down} or {passiveImg:astute}*\n- ATK 20%{passiveImg:up_g}";
        const details = (0, fyi_scraper_1.passiveDetailsFromSkill)({
            id: 4112,
            name: "Structural passive",
            description,
            effects: [{ id: 4112, type: 90, target: 1 }],
        }, {
            characterId: "1012001",
            formId: "1012001",
            releaseState: "eza",
            sourceVersion: "9b8400b8f2f713f705f9ee5b2c56470d",
            payloadField: "props.character.extreme_z_awakening.passive_skill.description",
        });
        (0, assert_1.equal)(details?.text, "When the target enemy is in the following status:  or\n- ATK 20%");
        (0, assert_1.deepEqual)(details?.conditionEvidence?.[0].statuses, [
            { order: 0, sourceToken: "atk_down", status: "atk_down", resolution: "supported" },
            { order: 1, sourceToken: "astute", status: "super_attack_sealed", resolution: "supported" },
        ]);
        (0, assert_1.equal)(details?.conditionEvidence?.[0].connector, "or");
        (0, assert_1.equal)(details?.conditionEvidence?.[0].resolution, "supported");
        (0, assert_1.equal)(details?.conditionEvidence?.[0].anchor.lineIndex, 0);
        (0, assert_1.equal)(details?.conditionEvidence?.[0].provenance.source, "dokkan_fyi_payload");
        (0, assert_1.equal)(details?.conditionEvidence?.[0].passiveTextSha256.length, 64);
        (0, assert_1.equal)(details?.text?.includes("passiveImg"), false);
    });
    (0, mocha_1.it)("marks missing labels unresolved instead of fabricating a status", () => {
        const details = (0, fyi_scraper_1.passiveDetailsFromSkill)({
            description: "*When the target enemy is in the following status:*\n- ATK 20%",
        }, {
            characterId: "1",
            formId: "1",
            releaseState: "initial",
            sourceVersion: "fixture-v1",
            payloadField: "props.character.passive_skill.description",
        });
        (0, assert_1.deepEqual)(details?.conditionEvidence?.[0].statuses, []);
        (0, assert_1.equal)(details?.conditionEvidence?.[0].resolution, "unresolved");
    });
});
(0, mocha_1.describe)("selectCurrentState", function () {
    (0, mocha_1.it)("prefers extreme z awakening fields when the latest state is awakened", () => {
        const currentState = (0, fyi_scraper_1.selectCurrentState)({
            max_level: 120,
            max_super_attack_level: 20,
            leader_skill: { name: "Base leader", description: "Base leader description" },
            passive_skill: { name: "Base passive", description: "Base passive description" },
            super_attacks: [
                {
                    name: "Burst Rush",
                    description: "Base 12 Ki effect",
                    ki: 12,
                    level: 0,
                    super_attack_type: "Physical",
                },
                {
                    name: "Burst Rush",
                    description: "EZA 12 Ki effect",
                    ki: 12,
                    level: 1,
                    super_attack_type: "Physical",
                },
            ],
            release_dates: { latest_type: "eza" },
            extreme_z_awakening: {
                max_level: 140,
                max_super_attack_level: 25,
                leader_skill: { name: "EZA leader", description: "EZA leader description" },
                passive_skill: { name: "EZA passive", description: "EZA passive description" },
            },
        });
        (0, assert_1.equal)(currentState.latestType, "eza");
        (0, assert_1.equal)(currentState.maxLevel, 140);
        (0, assert_1.equal)(currentState.maxSuperAttackLevel, 25);
        (0, assert_1.equal)(currentState.leaderSkill?.name, "EZA leader");
        (0, assert_1.equal)(currentState.passiveSkill?.name, "EZA passive");
        (0, assert_1.equal)(currentState.currentSuperAttacks[0]?.description, "EZA 12 Ki effect");
    });
    (0, mocha_1.it)("keeps base fields when the latest state is initial", () => {
        const currentState = (0, fyi_scraper_1.selectCurrentState)({
            max_level: 120,
            max_super_attack_level: 20,
            leader_skill: { name: "Base leader", description: "Base leader description" },
            passive_skill: { name: "Base passive", description: "Base passive description" },
            super_attacks: [
                {
                    name: "Burst Rush",
                    description: "Base 12 Ki effect",
                    ki: 12,
                    level: 0,
                    super_attack_type: "Physical",
                },
                {
                    name: "Burst Rush",
                    description: "EZA 12 Ki effect",
                    ki: 12,
                    level: 1,
                    super_attack_type: "Physical",
                },
            ],
            release_dates: { latest_type: "initial" },
            extreme_z_awakening: {
                max_level: 140,
                max_super_attack_level: 25,
                leader_skill: { name: "EZA leader", description: "EZA leader description" },
                passive_skill: { name: "EZA passive", description: "EZA passive description" },
            },
        });
        (0, assert_1.equal)(currentState.latestType, "initial");
        (0, assert_1.equal)(currentState.maxLevel, 120);
        (0, assert_1.equal)(currentState.maxSuperAttackLevel, 20);
        (0, assert_1.equal)(currentState.leaderSkill?.name, "Base leader");
        (0, assert_1.equal)(currentState.passiveSkill?.name, "Base passive");
        (0, assert_1.equal)(currentState.currentSuperAttacks[0]?.description, "Base 12 Ki effect");
    });
});
(0, mocha_1.describe)("selectInitialState", function () {
    (0, mocha_1.it)("preserves the base combat fields when an awakened state is available", () => {
        const initialState = (0, fyi_scraper_1.selectInitialState)({
            max_level: 120,
            max_super_attack_level: 10,
            leader_skill: { name: "Base leader", description: "Base leader description" },
            passive_skill: { name: "Base passive", description: "Base passive description" },
            super_attacks: [
                { id: 1, name: "Attack", description: "Base effect", ki: 12, level: 0 },
                { id: 2, name: "Attack (Extreme)", description: "EZA effect", ki: 12, level: 1 },
            ],
            release_dates: { latest_type: "eza" },
            extreme_z_awakening: {
                max_level: 140,
                max_super_attack_level: 15,
                leader_skill: { name: "EZA leader", description: "EZA leader description" },
                passive_skill: { name: "EZA passive", description: "EZA passive description" },
            },
        });
        (0, assert_1.equal)(initialState.latestType, "initial");
        (0, assert_1.equal)(initialState.maxLevel, 120);
        (0, assert_1.equal)(initialState.maxSuperAttackLevel, 10);
        (0, assert_1.equal)(initialState.leaderSkill?.name, "Base leader");
        (0, assert_1.equal)(initialState.passiveSkill?.name, "Base passive");
        (0, assert_1.equal)(initialState.currentSuperAttacks[0]?.description, "Base effect");
    });
    (0, mocha_1.it)("does not relabel an awakened-only Super Attack as BASE", () => {
        const initialState = (0, fyi_scraper_1.selectInitialState)({
            super_attacks: [
                { id: 2, name: "Attack (Extreme)", description: "EZA-only effect", ki: 12, level: 1 },
            ],
        });
        (0, assert_1.deepEqual)(initialState.currentSuperAttacks, []);
    });
});
(0, mocha_1.describe)("selectAwakenedState", function () {
    (0, mocha_1.it)("fails closed when latest type is unknown or the awakened payload is missing", () => {
        (0, assert_1.equal)((0, fyi_scraper_1.selectAwakenedState)({
            release_dates: { latest_type: "future_state" },
            extreme_z_awakening: {
                passive_skill: { name: "Unknown", description: "Must not be labeled EZA" },
            },
        }), undefined);
        (0, assert_1.equal)((0, fyi_scraper_1.selectAwakenedState)({
            release_dates: { latest_type: "seza" },
            passive_skill: { name: "Base", description: "Base passive" },
            extreme_z_awakening: null,
        }), undefined);
    });
    (0, mocha_1.it)("does not relabel a base super attack as awakened when no awakened variant exists", () => {
        const state = (0, fyi_scraper_1.selectAwakenedState)({
            max_level: 120,
            max_super_attack_level: 10,
            release_dates: { latest_type: "eza" },
            super_attacks: [
                { id: 1, name: "Base only", description: "Base effect", ki: 12, level: 0 },
            ],
            extreme_z_awakening: {
                max_level: 140,
                max_super_attack_level: 15,
                passive_skill: { name: "EZA passive", description: "EZA passive" },
            },
        });
        (0, assert_1.deepEqual)(state?.currentSuperAttacks, []);
    });
    (0, mocha_1.it)("does not reuse base level caps when the awakened payload omits them", () => {
        const state = (0, fyi_scraper_1.selectAwakenedState)({
            max_level: 120,
            max_super_attack_level: 10,
            release_dates: { latest_type: "eza" },
            extreme_z_awakening: {
                passive_skill: { name: "EZA passive", description: "EZA passive" },
            },
        });
        (0, assert_1.equal)(state?.maxLevel, 0);
        (0, assert_1.equal)(state?.maxSuperAttackLevel, 0);
    });
    (0, mocha_1.it)("inherits an owning card's EZA state only when the form has an awakened payload", () => {
        const state = (0, fyi_scraper_1.selectAwakenedState)({
            release_dates: { latest_type: "initial" },
            extreme_z_awakening: {
                max_level: 140,
                max_super_attack_level: 15,
                passive_skill: { name: "EZA form passive", description: "EZA form effect" },
            },
        }, "eza");
        (0, assert_1.equal)(state?.latestType, "eza");
        (0, assert_1.equal)(state?.passiveSkill?.description, "EZA form effect");
        (0, assert_1.equal)((0, fyi_scraper_1.selectAwakenedState)({
            release_dates: { latest_type: "initial" },
            extreme_z_awakening: null,
        }, "eza"), undefined);
    });
});
(0, mocha_1.describe)("mapDokkanFyiCharacter transformed release inheritance", function () {
    (0, mocha_1.it)("maps an EZA transformed passive and inherited EZA release date", async () => {
        const common = {
            canonical_id: 1,
            character_id: 1,
            rarity: 3,
            rarity_text: "UR",
            type: 2,
            type_text: "STR",
            awakening_type: 0,
            awakening_type_text: "Super",
            stats: { hp: {}, atk: {}, def: {} },
            max_level: 120,
            max_super_attack_level: 10,
            cost: 42,
            has_images: true,
        };
        const form = {
            ...common,
            id: 4024301,
            base_character_id: 4024301,
            thumbnail_id: 4024301,
            name: "Super Saiyan Gohan (Youth)",
            release_dates: { initial: "2019-09-01T00:00:00Z", latest_type: "initial" },
            passive_skill: { name: "Base form passive", description: "Base form effect" },
            super_attacks: [],
            extreme_z_awakening: {
                max_level: 140,
                max_super_attack_level: 15,
                passive_skill: { name: "Surpass Your Dad!", description: "EZA transformed effect" },
            },
        };
        const root = {
            ...common,
            id: 1024291,
            base_character_id: 1024291,
            thumbnail_id: 1024291,
            name: "Super Saiyan Goku/Super Saiyan Gohan (Youth)",
            release_dates: {
                initial: "2019-09-01T00:00:00Z",
                eza: "2025-04-03T06:00:00Z",
                latest_type: "eza",
            },
            passive_skill: { name: "Base root passive", description: "Base root effect" },
            super_attacks: [],
            extreme_z_awakening: {
                max_level: 140,
                max_super_attack_level: 15,
                passive_skill: { name: "EZA root passive", description: "EZA root effect" },
            },
        };
        const mapped = await (0, fyi_scraper_1.mapDokkanFyiCharacter)({
            version: "fixture-version",
            payload: {
                props: {
                    character: root,
                    transformationPath: [{
                            character: form,
                            description: "Exchange with Gohan",
                            source: "Active Skill",
                        }],
                },
            },
        }, {
            fetchCharacterPage: async () => ({
                version: "fixture-version",
                payload: { props: { character: form, transformationPath: [] } },
            }),
        });
        const transformed = mapped.transformations?.[0];
        (0, assert_1.equal)(transformed?.ezaReleaseDate, "2025-04-03T06:00:00.000Z");
        (0, assert_1.equal)(transformed?.ezaPassive, "EZA transformed effect");
        (0, assert_1.equal)(transformed?.ezaPassiveDetails?.conditionEvidence?.[0]?.stateKey, undefined);
        const formWithoutAwakenedPayload = {
            ...form,
            id: 4024302,
            base_character_id: 4024302,
            thumbnail_id: 4024302,
            extreme_z_awakening: null,
        };
        const mappedWithoutAwakenedPayload = await (0, fyi_scraper_1.mapDokkanFyiCharacter)({
            version: "fixture-version",
            payload: {
                props: {
                    character: root,
                    transformationPath: [{
                            character: formWithoutAwakenedPayload,
                            description: "Exchange with another form",
                            source: "Active Skill",
                        }],
                },
            },
        }, {
            fetchCharacterPage: async () => ({
                version: "fixture-version",
                payload: { props: { character: formWithoutAwakenedPayload, transformationPath: [] } },
            }),
        });
        (0, assert_1.equal)(mappedWithoutAwakenedPayload.transformations?.[0].ezaReleaseDate, undefined);
        (0, assert_1.equal)(mappedWithoutAwakenedPayload.transformations?.[0].ezaPassive, undefined);
    });
});
(0, mocha_1.describe)("currentMaxStat", function () {
    (0, mocha_1.it)("does not publish a base max stat as an awakened stat when EZA data is absent", () => {
        (0, assert_1.equal)((0, fyi_scraper_1.currentMaxStat)({ max: 12345 }, "eza"), 0);
        (0, assert_1.equal)((0, fyi_scraper_1.currentMaxStat)({ max: 12345, eza: 14000 }, "eza"), 14000);
        (0, assert_1.equal)((0, fyi_scraper_1.currentMaxStat)({ max: 12345 }, "initial"), 12345);
    });
});
(0, mocha_1.describe)("mapDokkanFyiCharacter versioned combat fields", function () {
    (0, mocha_1.it)("keeps BASE fields distinct from the latest EZA fields", async () => {
        const character = await (0, fyi_scraper_1.mapDokkanFyiCharacter)({
            version: "fixture-version",
            payload: {
                props: {
                    character: {
                        id: 1014941,
                        canonical_id: 1014941,
                        character_id: 101494,
                        base_character_id: 1014941,
                        name: "Cell (Perfect Form) & Cell Jr.",
                        rarity: 4,
                        rarity_text: "LR",
                        type: 1,
                        type_text: "PHY",
                        awakening_type: 1,
                        awakening_type_text: "Extreme",
                        stats: { hp: {}, atk: {}, def: {} },
                        max_level: 150,
                        max_super_attack_level: 20,
                        cost: 77,
                        thumbnail_id: 1014941,
                        has_images: true,
                        release_dates: {
                            initial: "2019-07-31T00:00:00Z",
                            eza: "2022-12-28T00:00:00Z",
                            latest_type: "eza",
                        },
                        leader_skill: { name: "Base leader", description: "Base allies ATK +100%" },
                        passive_skill: { name: "Base passive", description: "Base passive effect" },
                        active_skills: [{
                                id: 42,
                                name: "Perfect Active",
                                description: "Causes ultimate damage",
                                condition: "Can be activated once only",
                                ultimate_attack: {
                                    id: 36,
                                    name: "Ultimate attack",
                                    description: "Ultimate damage +50%",
                                    atk_multiplier: 600,
                                    is_multi_target: false,
                                },
                                effects: [
                                    { id: 7, type: 90, target: 1, calculation: 0, turns: 1, chance: 100, values: [600, 0, 0] },
                                    { id: 7, type: 90, target: 1, values: [999] },
                                ],
                            }, {
                                id: 42,
                                name: "Duplicate relation",
                                description: "Must not be projected twice",
                            }],
                        super_attacks: [
                            { id: 1, name: "Perfect Attack", description: "Base SA", condition: "Base SA condition", ki: 12, level: 0 },
                            { id: 2, name: "Perfect Attack (Extreme)", description: "EZA SA", condition: "EZA SA condition", ki: 12, level: 1 },
                            { id: 3, name: "Perfect Ultra", description: "Base Ultra SA", condition: "Base Ultra condition", ki: 18, level: 0 },
                            { id: 4, name: "Perfect Ultra (Extreme)", description: "EZA Ultra SA", condition: "EZA Ultra condition", ki: 18, level: 1 },
                            { id: 5, name: "Unit Attack", description: "Base Unit effect", condition: "Base Unit condition", ki: 12, level: 0, style: "Unit Super Attack" },
                            { id: 6, name: "Unit Attack (Extreme)", description: "EZA Unit effect", condition: "EZA Unit condition", ki: 12, level: 1, style: "Unit Super Attack" },
                        ],
                        extreme_z_awakening: {
                            max_level: 150,
                            max_super_attack_level: 25,
                            leader_skill: { name: "EZA leader", description: "EZA allies ATK +180%" },
                            passive_skill: { name: "EZA passive", description: "EZA passive effect" },
                        },
                        has_eza: true,
                        has_seza: false,
                    },
                    transformationPath: [],
                },
            },
        }, {});
        (0, assert_1.equal)(character.leaderSkill, "Base allies ATK +100%");
        (0, assert_1.equal)(character.ezaLeaderSkill, "EZA allies ATK +180%");
        (0, assert_1.equal)(character.passive, "Base passive effect");
        (0, assert_1.equal)(character.ezaPassive, "EZA passive effect");
        (0, assert_1.equal)(character.superAttack, "Base SA");
        (0, assert_1.equal)(character.ezaSuperAttack, "EZA SA");
        (0, assert_1.equal)(character.superAttackDetails?.condition, "Base SA condition");
        (0, assert_1.equal)(character.ezaSuperAttackDetails?.condition, "EZA SA condition");
        (0, assert_1.equal)(character.ultraSuperAttack, "Base Ultra SA");
        (0, assert_1.equal)(character.ezaUltraSuperAttack, "EZA Ultra SA");
        (0, assert_1.equal)(character.ultraSuperAttackDetails?.condition, "Base Ultra condition");
        (0, assert_1.equal)(character.ezaUltraSuperAttackDetails?.condition, "EZA Ultra condition");
        (0, assert_1.deepEqual)(character.unitSuperAttacks?.map(attack => attack.effect), ["Base Unit effect"]);
        (0, assert_1.deepEqual)(character.ezaUnitSuperAttacks?.map(attack => attack.effect), ["EZA Unit effect"]);
        (0, assert_1.equal)(character.passiveDetails?.text, "Base passive effect");
        (0, assert_1.equal)(character.ezaPassiveDetails?.text, "EZA passive effect");
        (0, assert_1.equal)(character.activeSkill, "Perfect Active: Causes ultimate damage");
        (0, assert_1.equal)(character.activeSkillDetails?.length, 1);
        (0, assert_1.deepEqual)(character.activeSkillDetails?.[0], {
            id: "42",
            name: "Perfect Active",
            description: "Causes ultimate damage",
            condition: "Can be activated once only",
            ultimateSpecialId: "36",
            ultimateAttack: {
                id: "36",
                name: "Ultimate attack",
                description: "Ultimate damage +50%",
                attackMultiplierPercent: 600,
                isMultiTarget: false,
            },
            effects: [{
                    id: "7",
                    efficacyType: 90,
                    targetType: 1,
                    calculationOption: 0,
                    turns: 1,
                    chance: 100,
                    valuesJson: "[600,0,0]",
                }],
            source: {
                kind: "dokkan_fyi_payload",
                sourceVersion: "fixture-version",
                payloadField: "props.character.active_skills",
            },
        });
    });
    (0, mocha_1.it)("keeps BASE and applicable EZA fields distinct from the latest SEZA passive", async () => {
        const character = await (0, fyi_scraper_1.mapDokkanFyiCharacter)({
            version: "9b8400b8f2f713f705f9ee5b2c56470d",
            payload: {
                props: {
                    character: {
                        id: 1003211,
                        canonical_id: 1003211,
                        character_id: 100321,
                        base_character_id: 1003211,
                        name: "Super Saiyan 3 Goku",
                        rarity: 3,
                        rarity_text: "UR",
                        type: 0,
                        type_text: "AGL",
                        awakening_type: 0,
                        awakening_type_text: "Super",
                        stats: { hp: {}, atk: {}, def: {} },
                        max_level: 120,
                        max_super_attack_level: 10,
                        cost: 42,
                        thumbnail_id: 1003210,
                        has_images: true,
                        release_dates: {
                            initial: "2016-05-05T07:10:00Z",
                            eza: "2018-03-16T06:30:00Z",
                            seza: "2024-03-21T08:00:00Z",
                            latest_type: "seza",
                        },
                        leader_skill: { name: "Base leader", description: "Base leader effect" },
                        passive_skill: { id: 10, name: "Base passive", description: "Base passive effect" },
                        super_attacks: [
                            { id: 11, name: "Dragon Fist", description: "Base SA", condition: "Base SA condition", ki: 12, level: 0 },
                            { id: 12, name: "Dragon Fist (Extreme)", description: "{passiveImg:once}EZA SA", condition: "EZA SA condition", ki: 12, level: 1 },
                            { id: 13, name: "Dragon Fist Ultra", description: "Base Ultra SA", condition: "Base Ultra condition", ki: 18, level: 0 },
                            { id: 14, name: "Dragon Fist Ultra (Extreme)", description: "EZA Ultra SA", condition: "EZA Ultra condition", ki: 18, level: 1 },
                            { id: 15, name: "Unit Attack", description: "Base Unit effect", condition: "Base Unit condition", ki: 12, level: 0, style: "Unit Super Attack" },
                            { id: 16, name: "Unit Attack (Extreme)", description: "EZA Unit effect", condition: "EZA Unit condition", ki: 12, level: 1, style: "Unit Super Attack" },
                        ],
                        extreme_z_awakening: {
                            max_level: 140,
                            max_super_attack_level: 15,
                            leader_skill: { name: "EZA leader", description: "EZA leader effect" },
                            passive_skill: {
                                id: 20,
                                name: "SEZA passive",
                                description: "*When the target enemy is in the following status: {passiveImg:atk_down}*\n- ATK 200%",
                            },
                        },
                        has_eza: true,
                        has_seza: true,
                    },
                    transformationPath: [],
                },
            },
        }, {});
        (0, assert_1.equal)(character.leaderSkill, "Base leader effect");
        (0, assert_1.equal)(character.ezaLeaderSkill, "EZA leader effect");
        (0, assert_1.equal)(character.passive, "Base passive effect");
        (0, assert_1.equal)(character.ezaPassive, undefined);
        (0, assert_1.equal)(character.sezaPassive, "When the target enemy is in the following status:\n- ATK 200%");
        (0, assert_1.equal)(character.sezaPassiveDetails?.name, "SEZA passive");
        (0, assert_1.equal)(character.sezaPassiveDetails?.conditionEvidence?.[0].stateKey, "1003211:1003211:seza");
        (0, assert_1.equal)(character.sezaPassiveDetails?.conditionEvidence?.[0].releaseState, "seza");
        (0, assert_1.equal)(character.superAttack, "Base SA");
        (0, assert_1.equal)(character.ezaSuperAttack, "EZA SA");
        (0, assert_1.equal)(character.ezaSuperAttackDetails?.condition, "EZA SA condition");
        (0, assert_1.equal)(character.ezaSuperAttackDetails?.structuralSource?.evidence[0].stateKey, "1003211:1003211:seza");
        (0, assert_1.equal)(character.ezaSuperAttackDetails?.structuralSource?.evidence[0].releaseState, "seza");
        (0, assert_1.equal)(character.ultraSuperAttack, "Base Ultra SA");
        (0, assert_1.equal)(character.ezaUltraSuperAttack, "EZA Ultra SA");
        (0, assert_1.equal)(character.ezaUltraSuperAttackDetails?.condition, "EZA Ultra condition");
        (0, assert_1.deepEqual)(character.unitSuperAttacks?.map(attack => attack.effect), ["Base Unit effect"]);
        (0, assert_1.deepEqual)(character.ezaUnitSuperAttacks?.map(attack => attack.effect), ["EZA Unit effect"]);
    });
});
(0, mocha_1.describe)("mapSuperAttackDetails structured effects", function () {
    (0, mocha_1.it)("preserves the exact Super Attack level curve from typed FYI fields", () => {
        const details = (0, fyi_scraper_1.mapSuperAttackDetails)({
            id: 1007731,
            name: "Full-Metal Avalanche (Extreme)",
            description: "Raises ATK and greatly raises DEF for 1 turn",
            atk_multiplier: 200,
            atk_multiplier_level_bonus: 5,
        }, undefined, 25);
        (0, assert_1.deepEqual)(details?.attackIncrease, {
            level1Percent: 200,
            maxLevelPercent: 320,
            maxLevel: 25,
        });
    });
    (0, mocha_1.it)("omits an incomplete or unsafe Super Attack level curve", () => {
        (0, assert_1.equal)((0, fyi_scraper_1.mapSuperAttackDetails)({
            id: 1,
            atk_multiplier: 200,
        }, undefined, 25)?.attackIncrease, undefined);
        (0, assert_1.equal)((0, fyi_scraper_1.mapSuperAttackDetails)({
            id: 2,
            atk_multiplier: 200,
            atk_multiplier_level_bonus: 5,
        }, undefined, 0)?.attackIncrease, undefined);
    });
    (0, mocha_1.it)("preserves exact stat values and status effects from the FYI payload", () => {
        const details = (0, fyi_scraper_1.mapSuperAttackDetails)({
            id: 99,
            name: "Fixture attack",
            description: "Opaque localized description",
            effects: [
                { id: 1, type: 3, target: 1, calculation: 2, turns: 1, values: [30, 50] },
                { id: 2, type: 1, target: 3, calculation: 3, turns: 3, values: [20] },
                { id: 3, type: 9, target: 3, calculation: 0, turns: 2, values: [] },
                { id: 4, type: 48, target: 3, calculation: 0, turns: 1, values: [] },
                { id: 5, type: 111, target: 3, calculation: 0, turns: 1, values: [] },
            ],
        }, {
            characterId: "fixture",
            formId: "fixture",
            releaseState: "initial",
            sourceVersion: "fixture-version",
            payloadField: "props.character.super_attacks[].description",
            attackVariant: "normal",
        });
        (0, assert_1.deepEqual)(details?.effects, [
            { id: "1:atk", kind: "atk_raise", target: "self", value: 30, durationTurns: 1, status: "supported", source: { kind: "dokkan_fyi_payload", sourceVersion: "fixture-version", rowId: "1" } },
            { id: "1:def", kind: "def_raise", target: "self", value: 50, durationTurns: 1, status: "supported", source: { kind: "dokkan_fyi_payload", sourceVersion: "fixture-version", rowId: "1" } },
            { id: "2", kind: "enemy_atk_lowering", target: "current_target", value: 20, durationTurns: 3, status: "supported", source: { kind: "dokkan_fyi_payload", sourceVersion: "fixture-version", rowId: "2" } },
            { id: "3", kind: "stun", target: "current_target", durationTurns: 2, status: "supported", source: { kind: "dokkan_fyi_payload", sourceVersion: "fixture-version", rowId: "3" } },
            { id: "4", kind: "super_attack_seal", target: "current_target", durationTurns: 1, status: "supported", source: { kind: "dokkan_fyi_payload", sourceVersion: "fixture-version", rowId: "4" } },
            { id: "5", kind: "action_break", target: "current_target", durationTurns: 1, status: "partial", source: { kind: "dokkan_fyi_payload", sourceVersion: "fixture-version", rowId: "5" } },
        ]);
    });
});
(0, mocha_1.describe)("preferredSuperAttacks", function () {
    (0, mocha_1.it)("keeps all three Pan-style Unit Super Attack slots distinct by release", () => {
        const attacks = [
            ...["Unit A", "Unit B", "Unit C"].map((name, index) => ({ name, description: `Base ${name} effect`, ki: 12 + index, level: 0, style: "Unit Super Attack", condition: "Base condition" })),
            ...["Unit A", "Unit B", "Unit C"].map((name, index) => ({ name, description: `EZA ${name} effect`, ki: 12 + index, level: 1, style: "Unit Super Attack", condition: "EZA condition" })),
        ];
        const base = (0, fyi_scraper_1.preferredSuperAttacks)(attacks, false).filter(item => item.style === "Unit Super Attack");
        const eza = (0, fyi_scraper_1.preferredSuperAttacks)(attacks, true).filter(item => item.style === "Unit Super Attack");
        (0, assert_1.deepEqual)(base.map(item => item.description), ["Base Unit A effect", "Base Unit B effect", "Base Unit C effect"]);
        (0, assert_1.deepEqual)(eza.map(item => item.description), ["EZA Unit A effect", "EZA Unit B effect", "EZA Unit C effect"]);
    });
    (0, mocha_1.it)("selects awakened attack slots without leaking a base-only Unit attack", () => {
        const selected = (0, fyi_scraper_1.preferredSuperAttacks)([
            {
                name: "Burst Rush",
                description: "Base normal",
                ki: 12,
                level: 0,
                super_attack_type: "Physical",
            },
            {
                name: "Burst Rush (Extreme)",
                description: "Awakened normal",
                ki: 12,
                level: 1,
                super_attack_type: "Physical",
            },
            {
                name: "Meteor Burst",
                description: "Base ultra",
                ki: 18,
                level: 0,
                super_attack_type: "Other",
            },
            {
                name: "Meteor Burst (Extreme)",
                description: "Awakened ultra",
                ki: 18,
                level: 1,
                super_attack_type: "Other",
            },
            {
                name: "Unit Combo",
                description: "Unit effect",
                ki: 18,
                level: 0,
                style: "Unit Super Attack",
                condition: "When Krillin is on the team",
            },
        ], true);
        (0, assert_1.deepEqual)(selected.map(attack => attack.name), [
            "Burst Rush (Extreme)",
            "Meteor Burst (Extreme)",
        ]);
        (0, assert_1.deepEqual)(selected.map(attack => attack.description), [
            "Awakened normal",
            "Awakened ultra",
        ]);
    });
    (0, mocha_1.it)("prefers base variants when staying on the initial state", () => {
        const selected = (0, fyi_scraper_1.preferredSuperAttacks)([
            {
                name: "Burst Rush (Extreme)",
                description: "Base normal",
                ki: 12,
                level: 0,
                super_attack_type: "Physical",
            },
            {
                name: "Burst Rush",
                description: "Awakened normal",
                ki: 12,
                level: 1,
                super_attack_type: "Physical",
            },
        ], false);
        (0, assert_1.equal)(selected.length, 1);
        (0, assert_1.equal)(selected[0].description, "Base normal");
    });
});
(0, mocha_1.describe)("standbyDetailsFromFyi", function () {
    (0, mocha_1.it)("maps standby finish skills from the base card payload and links them to the standby target", () => {
        const standby = (0, fyi_scraper_1.standbyDetailsFromFyi)({
            id: 24,
            name: "Enters Standby Mode",
            description: "Stands by for 5 turns.",
            condition: "Can be activated starting from the 3rd turn.",
            effects: [
                {
                    transformation: {
                        character: {
                            id: 4029481,
                        },
                    },
                },
            ],
            finish_skills: [
                {
                    id: 20,
                    name: "Kamehameha",
                    description: "Raises ATK by 15% temporarily per charge count and causes ultimate damage to enemy.",
                    condition: "Can be activated when charge count is 34 or less (once only).",
                    effects: [],
                },
                {
                    id: 22,
                    name: "Family Kamehameha",
                    description: "Raises ATK by 20% temporarily per charge count, causes super-ultimate damage to enemy and attacks effective against all Types.",
                    condition: "Can be activated when charge count is 35 or more with 7 Dragon Balls obtained (once only).",
                    effects: [],
                },
            ],
        });
        (0, assert_1.equal)(standby?.targetCharacterId, "4029481");
        (0, assert_1.equal)(standby?.finishSkills.length, 2);
        (0, assert_1.deepEqual)(standby?.finishSkills.map(skill => skill.name), [
            "Kamehameha",
            "Family Kamehameha",
        ]);
        (0, assert_1.deepEqual)(standby?.finishSkills.map(skill => skill.effectKind), [
            "mixed",
            "mixed",
        ]);
    });
});
(0, mocha_1.describe)("finishSkillsFromFyi", function () {
    (0, mocha_1.it)("detects finish-skill-triggered transformations like Jiren's post-standby state", () => {
        const finishSkills = (0, fyi_scraper_1.finishSkillsFromFyi)([
            {
                id: 15,
                name: "Resurfaced Trauma",
                description: "Character's Standby Mode ends; Ki +3 and ATK +30% for 3 turns.",
                condition: "Can be activated when charge count is 24 or less (once only).",
                effects: [],
            },
            {
                id: 17,
                name: "Awakened Full Power",
                description: "Awakens into Jiren (Full Power).",
                condition: "Can be activated when charge count is 25 or more (once only).",
                effects: [
                    {
                        transformation: {
                            character: {
                                id: 4029111,
                            },
                        },
                    },
                ],
            },
        ]);
        (0, assert_1.equal)(finishSkills.length, 2);
        (0, assert_1.equal)(finishSkills[0].effectKind, "buff");
        (0, assert_1.equal)(finishSkills[1].effectKind, "transform");
        (0, assert_1.equal)(finishSkills[1].targetTransformationId, "4029111");
    });
});
(0, mocha_1.describe)("normalizeTransformationSource", function () {
    (0, mocha_1.it)("normalizes standby, finish and reversible exchange sources", () => {
        (0, assert_1.equal)((0, fyi_scraper_1.normalizeTransformationSource)("Standby Skill"), "standby");
        (0, assert_1.equal)((0, fyi_scraper_1.normalizeTransformationSource)("Finish Effect"), "finish-skill");
        (0, assert_1.equal)((0, fyi_scraper_1.normalizeTransformationSource)(undefined, "Meets up with Super Saiyan 2 Goku (Angel) and can perform Reversible Exchange"), "reversible-exchange");
    });
    (0, mocha_1.it)("keeps active skill transformations as active even when the condition mentions reversible exchange", () => {
        (0, assert_1.equal)((0, fyi_scraper_1.normalizeTransformationSource)("Active Skill", "Can be activated starting from the 5th turn from the start of battle (once only, be it before or after Reversible Exchange)."), "active-skill");
    });
});
(0, mocha_1.describe)("obtainabilityDetailsFromFyi", function () {
    (0, mocha_1.it)("marks freely obtainable characters as free to play", () => {
        const obtainability = (0, fyi_scraper_1.obtainabilityDetailsFromFyi)({
            is_freely_obtainable: true,
            is_stage_drop_reward: false,
            is_world_tournament_reward: false,
        });
        (0, assert_1.equal)(obtainability.type, "freely-obtainable");
        (0, assert_1.equal)(obtainability.isFreeToPlay, true);
    });
    (0, mocha_1.it)("marks summonable characters as not free to play", () => {
        const obtainability = (0, fyi_scraper_1.obtainabilityDetailsFromFyi)({
            is_freely_obtainable: false,
            is_stage_drop_reward: false,
            is_world_tournament_reward: false,
        });
        (0, assert_1.equal)(obtainability.type, "summonable");
        (0, assert_1.equal)(obtainability.isFreeToPlay, false);
    });
});
(0, mocha_1.describe)("reversibleExchangeDetailsFromFyi", function () {
    (0, mocha_1.it)("maps the reversible exchange counterpart and condition separately from generic transformations", () => {
        const reversibleExchange = (0, fyi_scraper_1.reversibleExchangeDetailsFromFyi)({
            reversible_exchange_character_id: 4033561,
            reversible_exchange_character: {
                name: "Nappa + Vegeta",
            },
        }, [
            {
                id: "4033561",
                transformationCondition: "Meets up with Nappa and can perform Reversible Exchange when facing 2 or more enemies, or starting from the 3rd turn from the character's entry turn.",
            },
        ]);
        (0, assert_1.equal)(reversibleExchange?.targetCharacterId, "4033561");
        (0, assert_1.equal)(reversibleExchange?.targetCharacterName, "Nappa + Vegeta");
        (0, assert_1.equal)(reversibleExchange?.condition, "Meets up with Nappa and can perform Reversible Exchange when facing 2 or more enemies, or starting from the 3rd turn from the character's entry turn.");
    });
});
(0, mocha_1.describe)("exclusiveSkillOrbsFromFyi", function () {
    (0, mocha_1.it)("maps mission-reward skill orbs with icon and banner metadata", () => {
        const orbs = (0, fyi_scraper_1.exclusiveSkillOrbsFromFyi)([
            {
                id: 4409,
                name: "[Character-Exclusive] EX Skill Orb DEF + Lv. 8",
                description: "Can be equipped to Super Saiyan Gohan (Teen).",
                grade: "bronze",
                is_reusable: true,
                img_id: "00009",
                skills: [
                    {
                        id: 440900,
                        attribute: "defense",
                        level: 8,
                        hidden_potential_skill_id: null,
                    },
                ],
                mission_reward: {
                    mission_id: 25160,
                    mission_category_id: 796,
                    quantity: 1,
                    mission_category: {
                        img: "https://cdn.dokkan.fyi/assets/en/mission/mission_banner_event_796_3.png",
                    },
                },
                shop_items: [],
            },
        ]);
        (0, assert_1.equal)(orbs.length, 1);
        (0, assert_1.equal)(orbs[0].iconURL, "https://cdn.dokkan.fyi/assets/en/item/equ_item_00009.png");
        (0, assert_1.equal)(orbs[0].backgroundURL, "https://cdn.dokkan.fyi/assets/en/layout/en/image/equipment/equipment_thumb_bg/equ_base_bronze.png");
        (0, assert_1.equal)(orbs[0].acquisition?.[0].sourceType, "mission-reward");
        (0, assert_1.equal)(orbs[0].acquisition?.[0].missionId, "25160");
        (0, assert_1.equal)(orbs[0].acquisition?.[0].missionCategoryId, "796");
    });
    (0, mocha_1.it)("maps shop-item skill orbs with treasure and pricing metadata", () => {
        const orbs = (0, fyi_scraper_1.exclusiveSkillOrbsFromFyi)([
            {
                id: 3085,
                name: "[Character-Exclusive] EX Skill Orb HP + Lv. 8",
                description: "Can be equipped to Piccolo (Power Awakening).",
                grade: "bronze",
                is_reusable: true,
                img_id: "00008",
                skills: [],
                mission_reward: null,
                shop_items: [
                    {
                        id: 26903020,
                        price: 2,
                        discounted_price: 2,
                        treasure_item_id: 32,
                        treasure_item: {
                            name: "Super Mineral Water",
                            description: "Can be used at Baba's Shop.",
                            image_suffix: 47,
                        },
                        starts_at: "2025-12-29 01:00:00",
                        ends_at: "2026-01-29 14:59:59",
                        is_indefinite: false,
                    },
                ],
            },
        ]);
        (0, assert_1.equal)(orbs.length, 1);
        (0, assert_1.equal)(orbs[0].acquisition?.[0].sourceType, "shop-item");
        (0, assert_1.equal)(orbs[0].acquisition?.[0].shopItemId, "26903020");
        (0, assert_1.equal)(orbs[0].acquisition?.[0].price, 2);
        (0, assert_1.equal)(orbs[0].acquisition?.[0].treasureItemId, "32");
        (0, assert_1.equal)(orbs[0].acquisition?.[0].treasureItemName, "Super Mineral Water");
        (0, assert_1.equal)(orbs[0].acquisition?.[0].startsAt, "2025-12-29 01:00:00");
    });
});
(0, mocha_1.describe)("buildDokkanFyiContractReferenceSample", function () {
    (0, mocha_1.it)("wraps curated characters with contract metadata for human review", () => {
        const sample = (0, fyi_scraper_1.buildDokkanFyiContractReferenceSample)([
            {
                id: "1029471",
                name: "Super Saiyan Gohan (Teen)",
            },
            {
                id: "1030431",
                name: "Super Saiyan Goku (Angel) + Super Saiyan Vegeta (Angel)",
            },
        ]);
        (0, assert_1.equal)(sample.schemaName, "dokkan-fyi-character-contract");
        (0, assert_1.equal)(sample.schemaVersion, 1);
        (0, assert_1.equal)(sample.specPath, "docs/specs/dokkan-fyi-character-contract.md");
        (0, assert_1.deepEqual)(sample.sampleCharacterIds, ["1029471", "1030431"]);
        (0, assert_1.equal)(sample.characters.length, 2);
    });
});
//# sourceMappingURL=fyi-scraper.spec.js.map