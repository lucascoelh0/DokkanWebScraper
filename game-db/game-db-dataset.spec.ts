import { deepEqual, equal } from "assert";
import { describe, it } from "mocha";
import {
    applyOptionalCardLimit,
    isPrimaryPlayableCardRow,
    parseOptionalCardLimit,
    selectPrimaryGameDbCardIds,
} from "./game-db-dataset";
import { GameDbRow } from "./game-db-source";

describe("isPrimaryPlayableCardRow", function () {
    it("accepts released base card rows and rejects temporary or future rows", () => {
        equal(isPrimaryPlayableCardRow({
            id: "1032521",
            card_unique_info_id: "3",
            rarity: "5",
            hp_init: "4954",
            open_at: "2026-06-17 00:00:00",
        }, new Date("2026-06-27T00:00:00.000Z")), true);

        equal(isPrimaryPlayableCardRow({
            id: "4025741",
            card_unique_info_id: "716",
            rarity: "5",
            hp_init: "5185",
            open_at: "2023-07-07 05:00:00",
        }, new Date("2026-06-27T00:00:00.000Z")), false);

        equal(isPrimaryPlayableCardRow({
            id: "1039991",
            card_unique_info_id: "999",
            rarity: "5",
            hp_init: "5000",
            open_at: "2030-01-01 00:00:00",
        }, new Date("2026-06-27T00:00:00.000Z")), false);
    });
});

describe("selectPrimaryGameDbCardIds", function () {
    it("groups by card_unique_info_id and picks the highest released primary id", () => {
        const rows: GameDbRow[] = [
            {
                id: "1000010",
                card_unique_info_id: "1",
                rarity: "3",
                hp_init: "2210",
                open_at: "2015-10-30 00:00:00",
            },
            {
                id: "1000011",
                card_unique_info_id: "1",
                rarity: "4",
                hp_init: "7367",
                open_at: "2015-10-30 00:00:00",
            },
            {
                id: "4025741",
                card_unique_info_id: "716",
                rarity: "5",
                hp_init: "5185",
                open_at: "2023-07-07 05:00:00",
            },
            {
                id: "1025730",
                card_unique_info_id: "715",
                rarity: "5",
                hp_init: "4210",
                open_at: "2023-07-07 05:00:00",
            },
            {
                id: "1025731",
                card_unique_info_id: "715",
                rarity: "5",
                hp_init: "5185",
                open_at: "2023-07-07 05:00:00",
            },
        ];

        deepEqual(selectPrimaryGameDbCardIds(rows, new Date("2026-06-27T00:00:00.000Z")), [
            "1000011",
            "1025731",
        ]);
    });
});

describe("parseOptionalCardLimit", function () {
    it("reads positive integers and ignores invalid values", () => {
        equal(parseOptionalCardLimit("10"), 10);
        equal(parseOptionalCardLimit("0"), undefined);
        equal(parseOptionalCardLimit("abc"), undefined);
    });
});

describe("applyOptionalCardLimit", function () {
    it("truncates ids only when a limit exists", () => {
        deepEqual(applyOptionalCardLimit(["1", "2", "3"], 2), ["1", "2"]);
        deepEqual(applyOptionalCardLimit(["1", "2", "3"]), ["1", "2", "3"]);
    });
});

