"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const promises_1 = require("fs/promises");
const mocha_1 = require("mocha");
const os_1 = require("os");
const path_1 = require("path");
const game_db_experiment_1 = require("./game-db-experiment");
const game_db_table_inventory_1 = require("./game-db-table-inventory");
function minimalTables() {
    const tables = Object.fromEntries(game_db_table_inventory_1.CORE_GAME_DB_TABLES.map(table => [table, []]));
    tables.cards = [{
            id: "1031501",
            character_id: "315",
            card_unique_info_id: "315",
            name: "Omega Shenron",
            rarity: "5",
            element: "24",
            cost: "77",
            lv_max: "150",
            skill_lv_max: "20",
            hp_init: "1000",
            hp_max: "20000",
            atk_init: "1000",
            atk_max: "18000",
            def_init: "1000",
            def_max: "14000",
        }];
    tables.card_specials = [{
            id: "17379",
            card_id: "1031501",
            special_set_id: "7731",
            style: "Hyper",
            eball_num_start: "18",
        }];
    tables.special_sets = [{ id: "7731", name: "Demon Death Ball" }];
    return tables;
}
(0, mocha_1.describe)("finalizeFormRelations", function () {
    (0, mocha_1.it)("drops self-links and CardAwakeningRoute::Optimal noise", () => {
        const cardById = new Map([
            ["4025741", { id: "4025741", name: "Super Saiyan Goku (Standby)" }],
        ]);
        const relations = [
            {
                sourceCardId: "1025731",
                targetCardId: "1025731",
                kind: "awakening-other",
                sourceName: "CardAwakeningRoute::Optimal",
            },
            {
                sourceCardId: "1025731",
                targetCardId: "4025741",
                kind: "standby-transformation",
                sourceSkillSetId: "4",
            },
        ];
        (0, assert_1.deepEqual)((0, game_db_experiment_1.finalizeFormRelations)(relations, cardById), [
            {
                sourceCardId: "1025731",
                targetCardId: "4025741",
                targetName: "Super Saiyan Goku (Standby)",
                kind: "standby-transformation",
                sourceSkillSetId: "4",
            },
        ]);
    });
    (0, mocha_1.it)("dedupes identical relations and keeps them in stable order", () => {
        const cardById = new Map([
            ["4033071", { id: "4033071", name: "Super Saiyan 2 Goku (Angel) + Majin Vegeta" }],
            ["5020001", { id: "5020001", name: "Rage Form" }],
        ]);
        const relations = [
            {
                sourceCardId: "1033061",
                targetCardId: "5020001",
                kind: "active-giant-rage",
                sourceSkillSetId: "100",
                sourceSkillId: "9001",
            },
            {
                sourceCardId: "1033061",
                targetCardId: "4033071",
                kind: "passive-reversible-exchange",
                sourceSkillSetId: "4887",
                sourceSkillId: "4887",
            },
            {
                sourceCardId: "1033061",
                targetCardId: "4033071",
                kind: "passive-reversible-exchange",
                sourceSkillSetId: "4887",
                sourceSkillId: "4887",
            },
        ];
        const finalized = (0, game_db_experiment_1.finalizeFormRelations)(relations, cardById);
        (0, assert_1.equal)(finalized.length, 2);
        (0, assert_1.deepEqual)(finalized.map(relation => relation.kind), [
            "passive-reversible-exchange",
            "active-giant-rage",
        ]);
        (0, assert_1.deepEqual)(finalized.map(relation => relation.targetName), [
            "Super Saiyan 2 Goku (Angel) + Majin Vegeta",
            "Rage Form",
        ]);
    });
});
(0, mocha_1.describe)("Super Attack effect snapshot integration", function () {
    (0, mocha_1.it)("propagates structurally joined specials and tolerates their absence in an older source", () => {
        const tables = minimalTables();
        tables.specials = [{
                id: "1007731",
                special_set_id: "7731",
                type: "Special::ExtraEfficacySpecial",
                efficacy_type: "111",
                target_type: "3",
                prob: "100",
            }];
        const [omega] = (0, game_db_experiment_1.buildGameDbCharacterSnapshots)(["1031501"], tables);
        (0, assert_1.deepEqual)(omega.superAttacks[0].effects.map(effect => ({
            id: effect.id,
            specialSetId: effect.specialSetId,
            efficacyType: effect.efficacyType,
        })), [{ id: "1007731", specialSetId: "7731", efficacyType: 111 }]);
        delete tables.specials;
        const [legacyOmega] = (0, game_db_experiment_1.buildGameDbCharacterSnapshots)(["1031501"], tables);
        (0, assert_1.deepEqual)(legacyOmega.superAttacks[0].effects, []);
    });
    (0, mocha_1.it)("fails before grouping when an effect is missing its structural join key", () => {
        const tables = minimalTables();
        tables.specials = [{ id: "1007731", efficacy_type: "111" }];
        (0, assert_1.throws)(() => (0, game_db_experiment_1.buildGameDbCharacterSnapshots)(["1031501"], tables), /specials contains an effect without an id or special_set_id/);
    });
    (0, mocha_1.it)("fails closed when only one Super Attack category table is available", () => {
        const tables = minimalTables();
        tables.special_views = [{ id: "1", special_category_id: "1" }];
        (0, assert_1.throws)(() => (0, game_db_experiment_1.buildGameDbCharacterSnapshots)(["1031501"], tables), /Incomplete Super Attack category table inventory/);
    });
    (0, mocha_1.it)("loads specials when present and keeps older source directories compatible", async () => {
        const dataDir = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "game-db-specials-"));
        try {
            await Promise.all(game_db_table_inventory_1.CORE_GAME_DB_TABLES.map(table => (0, promises_1.writeFile)((0, path_1.join)(dataDir, `${table}.csv`), "id\n", "utf8")));
            const sourceConfig = { sourceRoot: dataDir, dataDir };
            const oldTables = await (0, game_db_experiment_1.loadRequiredGameDbTables)(sourceConfig);
            (0, assert_1.deepEqual)(oldTables.specials, []);
            (0, assert_1.deepEqual)(oldTables.special_views, []);
            (0, assert_1.deepEqual)(oldTables.special_categories, []);
            await (0, promises_1.writeFile)((0, path_1.join)(dataDir, "specials.csv"), "id,special_set_id,efficacy_type\n1007731,7731,111\n", "utf8");
            const currentTables = await (0, game_db_experiment_1.loadRequiredGameDbTables)(sourceConfig);
            (0, assert_1.deepEqual)(currentTables.specials, [{ id: "1007731", special_set_id: "7731", efficacy_type: "111" }]);
        }
        finally {
            await (0, promises_1.rm)(dataDir, { recursive: true, force: true });
        }
    });
});
(0, mocha_1.describe)("release-state snapshot projection", function () {
    (0, mocha_1.it)("keeps initial and final EZA skills separate using the official growth step", () => {
        const tables = minimalTables();
        tables.cards = [{
                ...tables.cards[0],
                id: "1028061",
                name: "Super Saiyan Goku & Super Saiyan Vegeta & Super Saiyan Trunks (Teen)",
                rarity: "5",
                lv_max: "150",
                skill_lv_max: "20",
                leader_skill_set_id: "1028060",
                passive_skill_set_id: "3984",
                optimal_awakening_grow_type: "1147",
                open_at: "2021-02-16 23:00:00",
            }];
        tables.leader_skill_sets = [
            { id: "1028060", name: "Base leader", description: "Ki +3 and HP, ATK & DEF +170%" },
            { id: "1028061", name: "Extreme leader", description: "Ki +3 and HP, ATK & DEF +200%" },
        ];
        tables.passive_skill_sets = [
            { id: "3984", name: "Base passive", itemized_description: "ATK & DEF +180%" },
            { id: "5036", name: "Extreme passive", itemized_description: "ATK & DEF +250%" },
        ];
        tables.optimal_awakening_growths = [
            { id: "1", optimal_awakening_grow_type: "1147", step: "1", lv_max: "150", skill_lv_max: "22", passive_skill_set_id: "3984", leader_skill_set_id: "1028061" },
            { id: "2", optimal_awakening_grow_type: "1147", step: "2", lv_max: "150", skill_lv_max: "24", passive_skill_set_id: "3984", leader_skill_set_id: "1028061" },
            { id: "3", optimal_awakening_grow_type: "1147", step: "3", lv_max: "150", skill_lv_max: "25", passive_skill_set_id: "5036", leader_skill_set_id: "1028061" },
        ];
        tables.card_specials = [
            { id: "13330", card_id: "1028061", special_set_id: "5147", style: "Normal", lv_start: "0", eball_num_start: "12", view_id: "100" },
            { id: "13332", card_id: "1028061", special_set_id: "5148", style: "Hyper", lv_start: "0", eball_num_start: "18", view_id: "101" },
            { id: "20432", card_id: "1028061", special_set_id: "9148", style: "Normal", lv_start: "24", eball_num_start: "12", view_id: "102" },
            { id: "20434", card_id: "1028061", special_set_id: "9149", style: "Hyper", lv_start: "24", eball_num_start: "18", view_id: "103" },
        ];
        tables.special_sets = [
            { id: "5147", name: "Base Super Attack" },
            { id: "5148", name: "Base Ultra Super Attack" },
            { id: "9148", name: "Extreme Super Attack" },
            { id: "9149", name: "Extreme Ultra Super Attack" },
        ];
        tables.special_views = [
            { id: "100", special_category_id: "2" },
            { id: "101", special_category_id: "1" },
            { id: "102", special_category_id: "2" },
            { id: "103", special_category_id: "1" },
        ];
        tables.special_categories = [
            { id: "1", raw_attribute: "1" },
            { id: "2", raw_attribute: "2" },
        ];
        tables.card_awakening_routes = [{
                id: "eza-release",
                type: "CardAwakeningRoute::Optimal",
                card_id: "1028061",
                awaked_card_id: "1028061",
                optimal_awakening_type: "1",
                optimal_awakening_step: "3",
                open_at: "2021-02-17 06:00:00",
            }];
        const [snapshot] = (0, game_db_experiment_1.buildGameDbCharacterSnapshots)(["1028061"], tables);
        (0, assert_1.equal)(snapshot.hasEza, true);
        (0, assert_1.equal)(snapshot.hasSeza, false);
        (0, assert_1.equal)(snapshot.releaseStates?.initial.passiveSkillSet?.id, "3984");
        (0, assert_1.equal)(snapshot.releaseStates?.eza?.passiveSkillSet?.id, "5036");
        (0, assert_1.equal)(snapshot.releaseStates?.initial.leaderSkill?.id, "1028060");
        (0, assert_1.equal)(snapshot.releaseStates?.eza?.leaderSkill?.id, "1028061");
        (0, assert_1.equal)(snapshot.releaseStates?.initial.maxSaLevel, 20);
        (0, assert_1.equal)(snapshot.releaseStates?.eza?.maxSaLevel, 25);
        (0, assert_1.equal)(snapshot.releaseStates?.initial.releaseDate, "2021-02-16T23:00:00.000Z");
        (0, assert_1.equal)(snapshot.releaseStates?.eza?.releaseDate, "2021-02-17T06:00:00.000Z");
        (0, assert_1.deepEqual)(snapshot.releaseStates?.initial.superAttacks.map(attack => attack.cardSpecialId), ["13330", "13332"]);
        (0, assert_1.deepEqual)(snapshot.releaseStates?.eza?.superAttacks.map(attack => attack.cardSpecialId), ["20432", "20434"]);
        (0, assert_1.deepEqual)(snapshot.releaseStates?.initial.superAttacks.map(attack => attack.attackType), ["Unarmed", "Ki Blast"]);
        (0, assert_1.deepEqual)(snapshot.releaseStates?.eza?.superAttacks.map(attack => attack.attackType), ["Unarmed", "Ki Blast"]);
    });
    (0, mocha_1.it)("does not claim an EZA from an incomplete growth sequence", () => {
        const tables = minimalTables();
        tables.cards[0].rarity = "5";
        tables.cards[0].optimal_awakening_grow_type = "999";
        tables.optimal_awakening_growths = [{
                id: "1",
                optimal_awakening_grow_type: "999",
                step: "1",
                lv_max: "150",
                skill_lv_max: "22",
            }];
        const [snapshot] = (0, game_db_experiment_1.buildGameDbCharacterSnapshots)(["1031501"], tables);
        (0, assert_1.equal)(snapshot.hasEza, false);
        (0, assert_1.equal)(snapshot.releaseStates?.eza, undefined);
    });
    (0, mocha_1.it)("uses the exact official final awakening route as the SEZA release date", () => {
        const tables = minimalTables();
        tables.cards[0].rarity = "4";
        tables.cards[0].optimal_awakening_grow_type = "seza-growth";
        tables.optimal_awakening_growths = [{
                id: "seza-final",
                optimal_awakening_grow_type: "seza-growth",
                step: "8",
                lv_max: "140",
                skill_lv_max: "15",
            }];
        tables.card_awakening_routes = [{
                id: "seza-release",
                type: "CardAwakeningRoute::Optimal",
                card_id: "1031501",
                awaked_card_id: "1031501",
                optimal_awakening_type: "2",
                optimal_awakening_step: "8",
                open_at: "2026-08-29 09:00:00",
            }];
        const [snapshot] = (0, game_db_experiment_1.buildGameDbCharacterSnapshots)(["1031501"], tables);
        (0, assert_1.equal)(snapshot.hasSeza, true);
        (0, assert_1.equal)(snapshot.releaseStates?.seza?.releaseDate, "2026-08-29T09:00:00.000Z");
    });
    (0, mocha_1.it)("inherits unchanged leader and passive sets when the final EZA step omits them", () => {
        const tables = minimalTables();
        tables.cards[0] = {
            ...tables.cards[0],
            rarity: "5",
            leader_skill_set_id: "base-leader",
            passive_skill_set_id: "base-passive",
            optimal_awakening_grow_type: "inherit-eza",
        };
        tables.leader_skill_sets = [{ id: "base-leader", name: "Leader", description: "Ki +3" }];
        tables.passive_skill_sets = [{ id: "base-passive", name: "Passive", itemized_description: "ATK +100%" }];
        tables.optimal_awakening_growths = [{
                id: "eza-final",
                optimal_awakening_grow_type: "inherit-eza",
                step: "3",
                lv_max: "150",
                skill_lv_max: "25",
                leader_skill_set_id: "",
                passive_skill_set_id: "",
            }];
        const [snapshot] = (0, game_db_experiment_1.buildGameDbCharacterSnapshots)(["1031501"], tables);
        (0, assert_1.equal)(snapshot.releaseStates?.eza?.leaderSkill?.id, "base-leader");
        (0, assert_1.equal)(snapshot.releaseStates?.eza?.passiveSkillSet?.id, "base-passive");
    });
    (0, mocha_1.it)("replaces a Super Attack across release levels despite JSON formatting and display-priority changes", () => {
        const tables = minimalTables();
        tables.cards[0] = {
            ...tables.cards[0],
            rarity: "5",
            skill_lv_max: "20",
            optimal_awakening_grow_type: "canonical-slot",
        };
        tables.optimal_awakening_growths = [{
                id: "eza-final",
                optimal_awakening_grow_type: "canonical-slot",
                step: "3",
                lv_max: "150",
                skill_lv_max: "25",
            }];
        tables.card_specials = [
            {
                id: "base-sa",
                card_id: "1031501",
                special_set_id: "base-set",
                style: "Normal",
                lv_start: "0",
                eball_num_start: "12",
                causality_conditions: "{\"source\":1,\"compiled\":{\"x\":2}}",
                detail_view_priority: "1",
            },
            {
                id: "eza-sa",
                card_id: "1031501",
                special_set_id: "eza-set",
                style: "Normal",
                lv_start: "24",
                eball_num_start: "12",
                causality_conditions: "{ \"compiled\": {\"x\": 2}, \"source\": 1 }",
                detail_view_priority: "9",
            },
        ];
        tables.special_sets = [
            { id: "base-set", name: "Base Super Attack" },
            { id: "eza-set", name: "EZA Super Attack" },
        ];
        const [snapshot] = (0, game_db_experiment_1.buildGameDbCharacterSnapshots)(["1031501"], tables);
        (0, assert_1.deepEqual)(snapshot.releaseStates?.initial.superAttacks.map(attack => attack.cardSpecialId), ["base-sa"]);
        (0, assert_1.deepEqual)(snapshot.releaseStates?.eza?.superAttacks.map(attack => attack.cardSpecialId), ["eza-sa"]);
    });
});
//# sourceMappingURL=game-db-experiment.spec.js.map