"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const game_db_lane_refresh_candidate_1 = require("./game-db-lane-refresh-candidate");
(0, mocha_1.describe)("game DB lane refresh candidate", () => {
    (0, mocha_1.it)("adds only requested official category memberships without changing unrelated cards", () => {
        const characters = [
            { id: "1", categories: ["A"] },
            { id: "2", categories: ["B"] },
        ];
        const result = (0, game_db_lane_refresh_candidate_1.applyAdditiveCategoryAssignments)(characters, new Map([
            ["1", [{ categoryId: "99", name: "Golden Fighters" }]],
        ]));
        (0, assert_1.deepStrictEqual)(result.characters.map(character => character.categories), [
            ["A", "Golden Fighters"],
            ["B"],
        ]);
        (0, assert_1.deepStrictEqual)(result.patches, [{
                cardId: "1",
                addedCategories: [{ categoryId: "99", name: "Golden Fighters" }],
            }]);
        (0, assert_1.deepStrictEqual)(characters[0].categories, ["A"]);
    });
    (0, mocha_1.it)("requires an explicit lane and fresh output inputs", () => {
        (0, assert_1.throws)(() => (0, game_db_lane_refresh_candidate_1.parseGameDbLaneRefreshArgs)([]), /contract-lane/);
        (0, assert_1.throws)(() => (0, game_db_lane_refresh_candidate_1.parseGameDbLaneRefreshArgs)([
            "--contract-lane", "v3",
        ]), /must be v1 or v2/);
    });
    (0, mocha_1.it)("rejects ambiguous card roles before reading first-party data", () => {
        (0, assert_1.throws)(() => (0, game_db_lane_refresh_candidate_1.parseGameDbLaneRefreshArgs)([
            "--contract-lane", "v2",
            "--first-party-dir", "first-party",
            "--portrait-assets-dir", "portraits",
            "--new-card-ids", "1033971,1034001",
            "--release-state-card-ids", "1034001",
            "--category-ids", "99",
            "--baseline-dir", "baseline",
            "--output-dir", "output",
        ]), /cannot be both new and release-state targets: 1034001/);
    });
    (0, mocha_1.it)("does not duplicate a related form that is also an explicit release target", () => {
        const root = { id: "1024291", source: "root" };
        const explicitlyTargetedForm = { id: "4024301", source: "explicit" };
        const relatedCopy = { id: "4024301", source: "related" };
        const otherRelatedForm = { id: "4024302", source: "related" };
        (0, assert_1.deepStrictEqual)((0, game_db_lane_refresh_candidate_1.mergeReleaseProjections)([root, explicitlyTargetedForm], [relatedCopy, otherRelatedForm]), [root, explicitlyTargetedForm, otherRelatedForm]);
    });
    (0, mocha_1.it)("resolves category membership by official ID and rejects ambiguous display labels", () => {
        const tables = {
            card_categories: [
                { id: "99", name: "Golden Fighters" },
                { id: "199", name: "Golden Fighters" },
            ],
            card_card_categories: [
                { card_id: "1", card_category_id: "99" },
                { card_id: "2", card_category_id: "199" },
            ],
        };
        const resolved = (0, game_db_lane_refresh_candidate_1.resolveOfficialCategoryAssignments)(tables, ["99"]);
        (0, assert_1.deepStrictEqual)(resolved.identities, [{ categoryId: "99", name: "Golden Fighters" }]);
        (0, assert_1.deepStrictEqual)(resolved.assignments.get("1"), [{ categoryId: "99", name: "Golden Fighters" }]);
        (0, assert_1.deepStrictEqual)(resolved.assignments.has("2"), false);
        (0, assert_1.throws)(() => (0, game_db_lane_refresh_candidate_1.resolveOfficialCategoryAssignments)(tables, ["99", "199"]), /do not have unique display names/);
        (0, assert_1.throws)(() => (0, game_db_lane_refresh_candidate_1.resolveOfficialCategoryAssignments)({
            card_categories: [
                { id: "99", name: "Golden Fighters" },
                { id: "99", name: "Conflicting Name" },
            ],
            card_card_categories: [],
        }, ["99"]), /duplicate game DB category ID 99/);
    });
});
//# sourceMappingURL=game-db-lane-refresh-candidate.spec.js.map