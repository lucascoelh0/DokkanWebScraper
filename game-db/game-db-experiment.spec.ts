import { deepEqual, equal, throws } from "assert";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { describe, it } from "mocha";
import { tmpdir } from "os";
import { join } from "path";
import { GameDbFormRelation } from "./game-db-contract";
import {
    buildGameDbCharacterSnapshots,
    finalizeFormRelations,
    loadRequiredGameDbTables,
} from "./game-db-experiment";
import { GameDbRow } from "./game-db-source";
import { CORE_GAME_DB_TABLES } from "./game-db-table-inventory";

function minimalTables(): Record<string, GameDbRow[]> {
    const tables = Object.fromEntries(CORE_GAME_DB_TABLES.map(table => [table, []])) as Record<string, GameDbRow[]>;
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

describe("finalizeFormRelations", function () {
    it("drops self-links and CardAwakeningRoute::Optimal noise", () => {
        const cardById = new Map<string, GameDbRow>([
            ["4025741", { id: "4025741", name: "Super Saiyan Goku (Standby)" }],
        ]);

        const relations: GameDbFormRelation[] = [
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

        deepEqual(finalizeFormRelations(relations, cardById), [
            {
                sourceCardId: "1025731",
                targetCardId: "4025741",
                targetName: "Super Saiyan Goku (Standby)",
                kind: "standby-transformation",
                sourceSkillSetId: "4",
            },
        ]);
    });

    it("dedupes identical relations and keeps them in stable order", () => {
        const cardById = new Map<string, GameDbRow>([
            ["4033071", { id: "4033071", name: "Super Saiyan 2 Goku (Angel) + Majin Vegeta" }],
            ["5020001", { id: "5020001", name: "Rage Form" }],
        ]);

        const relations: GameDbFormRelation[] = [
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

        const finalized = finalizeFormRelations(relations, cardById);

        equal(finalized.length, 2);
        deepEqual(finalized.map(relation => relation.kind), [
            "passive-reversible-exchange",
            "active-giant-rage",
        ]);
        deepEqual(finalized.map(relation => relation.targetName), [
            "Super Saiyan 2 Goku (Angel) + Majin Vegeta",
            "Rage Form",
        ]);
    });
});

describe("Super Attack effect snapshot integration", function () {
    it("propagates structurally joined specials and tolerates their absence in an older source", () => {
        const tables = minimalTables();
        tables.specials = [{
            id: "1007731",
            special_set_id: "7731",
            type: "Special::ExtraEfficacySpecial",
            efficacy_type: "111",
            target_type: "3",
            prob: "100",
        }];

        const [omega] = buildGameDbCharacterSnapshots(["1031501"], tables);
        deepEqual(omega.superAttacks[0].effects.map(effect => ({
            id: effect.id,
            specialSetId: effect.specialSetId,
            efficacyType: effect.efficacyType,
        })), [{ id: "1007731", specialSetId: "7731", efficacyType: 111 }]);

        delete tables.specials;
        const [legacyOmega] = buildGameDbCharacterSnapshots(["1031501"], tables);
        deepEqual(legacyOmega.superAttacks[0].effects, []);
    });

    it("fails before grouping when an effect is missing its structural join key", () => {
        const tables = minimalTables();
        tables.specials = [{ id: "1007731", efficacy_type: "111" }];
        throws(
            () => buildGameDbCharacterSnapshots(["1031501"], tables),
            /specials contains an effect without an id or special_set_id/,
        );
    });

    it("loads specials when present and keeps older source directories compatible", async () => {
        const dataDir = await mkdtemp(join(tmpdir(), "game-db-specials-"));
        try {
            await Promise.all(CORE_GAME_DB_TABLES.map(table => writeFile(join(dataDir, `${table}.csv`), "id\n", "utf8")));
            const sourceConfig = { sourceRoot: dataDir, dataDir };

            const oldTables = await loadRequiredGameDbTables(sourceConfig);
            deepEqual(oldTables.specials, []);

            await writeFile(join(dataDir, "specials.csv"), "id,special_set_id,efficacy_type\n1007731,7731,111\n", "utf8");
            const currentTables = await loadRequiredGameDbTables(sourceConfig);
            deepEqual(currentTables.specials, [{ id: "1007731", special_set_id: "7731", efficacy_type: "111" }]);
        } finally {
            await rm(dataDir, { recursive: true, force: true });
        }
    });
});

