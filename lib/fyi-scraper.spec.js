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
(0, mocha_1.describe)("preferredSuperAttacks", function () {
    (0, mocha_1.it)("selects one entry per attack slot and prefers awakened variants for the latest awakened state", () => {
        const selected = (0, fyi_scraper_1.preferredSuperAttacks)([
            {
                name: "Burst Rush",
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
            {
                name: "Meteor Burst",
                description: "Base ultra",
                ki: 18,
                level: 0,
                super_attack_type: "Other",
            },
            {
                name: "Meteor Burst",
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
                super_attack_type: "Other",
                character_conditions: [{ name: "Krillin" }],
            },
        ], true);
        (0, assert_1.deepEqual)(selected.map(attack => attack.name), [
            "Burst Rush",
            "Meteor Burst",
            "Unit Combo",
        ]);
        (0, assert_1.deepEqual)(selected.map(attack => attack.description), [
            "Awakened normal",
            "Awakened ultra",
            "Unit effect",
        ]);
    });
    (0, mocha_1.it)("prefers base variants when staying on the initial state", () => {
        const selected = (0, fyi_scraper_1.preferredSuperAttacks)([
            {
                name: "Burst Rush",
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