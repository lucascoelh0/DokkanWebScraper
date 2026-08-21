"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const game_db_dataset_1 = require("./game-db-dataset");
(0, mocha_1.describe)("isPrimaryPlayableCardRow", function () {
    (0, mocha_1.it)("accepts released base card rows and rejects temporary or future rows", () => {
        (0, assert_1.equal)((0, game_db_dataset_1.isPrimaryPlayableCardRow)({
            id: "1032521",
            card_unique_info_id: "3",
            rarity: "5",
            hp_init: "4954",
            open_at: "2026-06-17 00:00:00",
        }, new Date("2026-06-27T00:00:00.000Z")), true);
        (0, assert_1.equal)((0, game_db_dataset_1.isPrimaryPlayableCardRow)({
            id: "4025741",
            card_unique_info_id: "716",
            rarity: "5",
            hp_init: "5185",
            open_at: "2023-07-07 05:00:00",
        }, new Date("2026-06-27T00:00:00.000Z")), false);
        (0, assert_1.equal)((0, game_db_dataset_1.isPrimaryPlayableCardRow)({
            id: "1039991",
            card_unique_info_id: "999",
            rarity: "5",
            hp_init: "5000",
            open_at: "2030-01-01 00:00:00",
        }, new Date("2026-06-27T00:00:00.000Z")), false);
    });
});
(0, mocha_1.describe)("selectPrimaryGameDbCardIds", function () {
    (0, mocha_1.it)("groups by card_unique_info_id and picks the highest released primary id", () => {
        const rows = [
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
        (0, assert_1.deepEqual)((0, game_db_dataset_1.selectPrimaryGameDbCardIds)(rows, new Date("2026-06-27T00:00:00.000Z")), [
            "1000011",
            "1025731",
        ]);
    });
});
(0, mocha_1.describe)("parseOptionalCardLimit", function () {
    (0, mocha_1.it)("reads positive integers and ignores invalid values", () => {
        (0, assert_1.equal)((0, game_db_dataset_1.parseOptionalCardLimit)("10"), 10);
        (0, assert_1.equal)((0, game_db_dataset_1.parseOptionalCardLimit)("0"), undefined);
        (0, assert_1.equal)((0, game_db_dataset_1.parseOptionalCardLimit)("abc"), undefined);
    });
});
(0, mocha_1.describe)("applyOptionalCardLimit", function () {
    (0, mocha_1.it)("truncates ids only when a limit exists", () => {
        (0, assert_1.deepEqual)((0, game_db_dataset_1.applyOptionalCardLimit)(["1", "2", "3"], 2), ["1", "2"]);
        (0, assert_1.deepEqual)((0, game_db_dataset_1.applyOptionalCardLimit)(["1", "2", "3"]), ["1", "2", "3"]);
    });
});
(0, mocha_1.describe)("enrichGameDbDatasetCreatedDomainsIfSupported", function () {
    (0, mocha_1.it)("preserves old sources when optional Dokkan field tables are absent", async () => {
        const characters = [];
        const result = await (0, game_db_dataset_1.enrichGameDbDatasetCreatedDomainsIfSupported)({
            characters,
            sourceConfig: {
                sourceRoot: __dirname,
                dataDir: __dirname,
            },
        });
        (0, assert_1.equal)(result.characters, characters);
        (0, assert_1.deepEqual)(result.report, { status: "absent", linkCount: 0 });
    });
});
(0, mocha_1.describe)("Created Domain dataset release identity", function () {
    (0, mocha_1.it)("revisions both settings-backed and fallback dataset versions", () => {
        (0, assert_1.equal)((0, game_db_dataset_1.datasetVersionFromSourceSettings)("2026-01-01T00:00:00.000Z", {
            glbDbVersion: 1782367825,
            glbAssetVersion: 1782367204,
        }), "glb-db-1782367825__asset-1782367204__super-attack-details-v3");
        (0, assert_1.equal)((0, game_db_dataset_1.datasetVersionFromSourceSettings)("2026-01-01T00:00:00.000Z", undefined, ["glb-db-1782367825"]), "glb-db-1782367825__super-attack-details-v3");
    });
    (0, mocha_1.it)("uses the explicit hint and rejects conflicting source settings", () => {
        (0, assert_1.equal)((0, game_db_dataset_1.resolveCreatedDomainSourceSnapshotId)(undefined, "glb-db-1782367825"), "glb-db-1782367825");
        (0, assert_1.equal)((0, game_db_dataset_1.resolveCreatedDomainSourceSnapshotId)({ glbDbVersion: 1782367825 }), "glb-db-1782367825");
        (0, assert_1.throws)(() => (0, game_db_dataset_1.resolveCreatedDomainSourceSnapshotId)({ glbDbVersion: 1782367824 }, "glb-db-1782367825"), /conflicts with source settings/);
    });
});
//# sourceMappingURL=game-db-dataset.spec.js.map