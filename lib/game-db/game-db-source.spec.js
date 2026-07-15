"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const game_db_source_1 = require("./game-db-source");
(0, mocha_1.describe)("parseCsv", function () {
    (0, mocha_1.it)("parses quoted commas, escaped quotes, and multiline cells", () => {
        const rows = (0, game_db_source_1.parseCsv)("id,name,description\r\n" +
            "1,\"Spirit, Bomb\",\"Line 1\nLine 2\"\r\n" +
            "2,\"He said \"\"hello\"\"\",\"Simple\"\r\n");
        (0, assert_1.deepEqual)(rows, [
            ["id", "name", "description"],
            ["1", "Spirit, Bomb", "Line 1\nLine 2"],
            ["2", "He said \"hello\"", "Simple"],
        ]);
    });
});
(0, mocha_1.describe)("normalizeDbId", function () {
    (0, mocha_1.it)("removes trailing decimal suffixes from id-like strings", () => {
        (0, assert_1.equal)((0, game_db_source_1.normalizeDbId)("100001.0"), "100001");
        (0, assert_1.equal)((0, game_db_source_1.normalizeDbId)("1025731"), "1025731");
        (0, assert_1.equal)((0, game_db_source_1.normalizeDbId)(""), undefined);
    });
});
(0, mocha_1.describe)("parseDbInt", function () {
    (0, mocha_1.it)("reads integer and float-formatted numeric strings", () => {
        (0, assert_1.equal)((0, game_db_source_1.parseDbInt)("25"), 25);
        (0, assert_1.equal)((0, game_db_source_1.parseDbInt)("25.0"), 25);
        (0, assert_1.equal)((0, game_db_source_1.parseDbInt)(""), undefined);
    });
});
(0, mocha_1.describe)("parseDbDate", function () {
    (0, mocha_1.it)("normalizes game-db timestamps into ISO strings", () => {
        (0, assert_1.equal)((0, game_db_source_1.parseDbDate)("2015-10-30 00:00:00"), "2015-10-30T00:00:00.000Z");
    });
});
(0, mocha_1.describe)("parseDbJsonArray", function () {
    (0, mocha_1.it)("parses json arrays from csv cells", () => {
        (0, assert_1.deepEqual)((0, game_db_source_1.parseDbJsonArray)("[0, 30, 0]"), [0, 30, 0]);
        (0, assert_1.deepEqual)((0, game_db_source_1.parseDbJsonArray)(""), []);
    });
});
//# sourceMappingURL=game-db-source.spec.js.map