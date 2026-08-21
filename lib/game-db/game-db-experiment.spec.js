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
    (0, mocha_1.it)("loads specials when present and keeps older source directories compatible", async () => {
        const dataDir = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "game-db-specials-"));
        try {
            await Promise.all(game_db_table_inventory_1.CORE_GAME_DB_TABLES.map(table => (0, promises_1.writeFile)((0, path_1.join)(dataDir, `${table}.csv`), "id\n", "utf8")));
            const sourceConfig = { sourceRoot: dataDir, dataDir };
            const oldTables = await (0, game_db_experiment_1.loadRequiredGameDbTables)(sourceConfig);
            (0, assert_1.deepEqual)(oldTables.specials, []);
            await (0, promises_1.writeFile)((0, path_1.join)(dataDir, "specials.csv"), "id,special_set_id,efficacy_type\n1007731,7731,111\n", "utf8");
            const currentTables = await (0, game_db_experiment_1.loadRequiredGameDbTables)(sourceConfig);
            (0, assert_1.deepEqual)(currentTables.specials, [{ id: "1007731", special_set_id: "7731", efficacy_type: "111" }]);
        }
        finally {
            await (0, promises_1.rm)(dataDir, { recursive: true, force: true });
        }
    });
});
//# sourceMappingURL=game-db-experiment.spec.js.map