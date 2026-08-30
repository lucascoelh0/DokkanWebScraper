import { deepStrictEqual, throws } from "assert";
import { describe, it } from "mocha";
import type { Character } from "../character";
import {
    applyAdditiveCategoryAssignments,
    mergeReleaseProjections,
    parseGameDbLaneRefreshArgs,
    resolveOfficialCategoryAssignments,
} from "./game-db-lane-refresh-candidate";

describe("game DB lane refresh candidate", () => {
    it("adds only requested official category memberships without changing unrelated cards", () => {
        const characters = [
            { id: "1", categories: ["A"] },
            { id: "2", categories: ["B"] },
        ] as Character[];
        const result = applyAdditiveCategoryAssignments(characters, new Map([
            ["1", [{ categoryId: "99", name: "Golden Fighters" }]],
        ]));
        deepStrictEqual(result.characters.map(character => character.categories), [
            ["A", "Golden Fighters"],
            ["B"],
        ]);
        deepStrictEqual(result.patches, [{
            cardId: "1",
            addedCategories: [{ categoryId: "99", name: "Golden Fighters" }],
        }]);
        deepStrictEqual(characters[0].categories, ["A"]);
    });

    it("requires an explicit lane and fresh output inputs", () => {
        throws(() => parseGameDbLaneRefreshArgs([]), /contract-lane/);
        throws(() => parseGameDbLaneRefreshArgs([
            "--contract-lane", "v3",
        ]), /must be v1 or v2/);
    });

    it("rejects ambiguous card roles before reading first-party data", () => {
        throws(() => parseGameDbLaneRefreshArgs([
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

    it("does not duplicate a related form that is also an explicit release target", () => {
        const root = { id: "1024291", source: "root" };
        const explicitlyTargetedForm = { id: "4024301", source: "explicit" };
        const relatedCopy = { id: "4024301", source: "related" };
        const otherRelatedForm = { id: "4024302", source: "related" };

        deepStrictEqual(
            mergeReleaseProjections(
                [root, explicitlyTargetedForm],
                [relatedCopy, otherRelatedForm],
            ),
            [root, explicitlyTargetedForm, otherRelatedForm],
        );
    });

    it("resolves category membership by official ID and rejects ambiguous display labels", () => {
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
        const resolved = resolveOfficialCategoryAssignments(tables, ["99"]);
        deepStrictEqual(resolved.identities, [{ categoryId: "99", name: "Golden Fighters" }]);
        deepStrictEqual(resolved.assignments.get("1"), [{ categoryId: "99", name: "Golden Fighters" }]);
        deepStrictEqual(resolved.assignments.has("2"), false);
        throws(
            () => resolveOfficialCategoryAssignments(tables, ["99", "199"]),
            /do not have unique display names/,
        );
        throws(() => resolveOfficialCategoryAssignments({
            card_categories: [
                { id: "99", name: "Golden Fighters" },
                { id: "99", name: "Conflicting Name" },
            ],
            card_card_categories: [],
        }, ["99"]), /duplicate game DB category ID 99/);
    });
});
