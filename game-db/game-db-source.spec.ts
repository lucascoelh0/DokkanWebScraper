import { deepEqual, equal } from "assert";
import { describe, it } from "mocha";
import { normalizeDbId, parseCsv, parseDbDate, parseDbInt, parseDbJsonArray } from "./game-db-source";

describe("parseCsv", function () {
    it("parses quoted commas, escaped quotes, and multiline cells", () => {
        const rows = parseCsv(
            "id,name,description\r\n" +
            "1,\"Spirit, Bomb\",\"Line 1\nLine 2\"\r\n" +
            "2,\"He said \"\"hello\"\"\",\"Simple\"\r\n",
        );

        deepEqual(rows, [
            ["id", "name", "description"],
            ["1", "Spirit, Bomb", "Line 1\nLine 2"],
            ["2", "He said \"hello\"", "Simple"],
        ]);
    });
});

describe("normalizeDbId", function () {
    it("removes trailing decimal suffixes from id-like strings", () => {
        equal(normalizeDbId("100001.0"), "100001");
        equal(normalizeDbId("1025731"), "1025731");
        equal(normalizeDbId(""), undefined);
    });
});

describe("parseDbInt", function () {
    it("reads integer and float-formatted numeric strings", () => {
        equal(parseDbInt("25"), 25);
        equal(parseDbInt("25.0"), 25);
        equal(parseDbInt(""), undefined);
    });
});

describe("parseDbDate", function () {
    it("normalizes game-db timestamps into ISO strings", () => {
        equal(parseDbDate("2015-10-30 00:00:00"), "2015-10-30T00:00:00.000Z");
    });
});

describe("parseDbJsonArray", function () {
    it("parses json arrays from csv cells", () => {
        deepEqual(parseDbJsonArray("[0, 30, 0]"), [0, 30, 0]);
        deepEqual(parseDbJsonArray(""), []);
    });
});

