"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const zlib_1 = require("zlib");
const android_v1_contract_projector_1 = require("../android-v1-contract-projector");
const game_db_lane_refresh_candidate_1 = require("./game-db-lane-refresh-candidate");
const game_db_dokkan_field_sidecar_1 = require("./game-db-dokkan-field-sidecar");
(0, mocha_1.describe)("game DB lane refresh candidate", () => {
    (0, mocha_1.it)("materializes every inventoried Dokkan Field table required by Domain enrichment", () => {
        (0, assert_1.deepStrictEqual)(game_db_dokkan_field_sidecar_1.DOKKAN_FIELD_SIDECAR_TABLES.filter(table => !game_db_lane_refresh_candidate_1.LANE_REFRESH_GAME_DB_TABLES.includes(table)), []);
    });
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
    (0, mocha_1.it)("accepts an overlay-only refresh without explicit card additions", () => {
        const options = (0, game_db_lane_refresh_candidate_1.parseGameDbLaneRefreshArgs)([
            "--contract-lane", "v2",
            "--first-party-dir", "first-party",
            "--portrait-assets-dir", "portraits",
            "--baseline-dir", "baseline",
            "--output-dir", "output",
        ]);
        (0, assert_1.deepStrictEqual)(options.newCardIds, []);
        (0, assert_1.deepStrictEqual)(options.releaseStateCardIds, []);
        (0, assert_1.deepStrictEqual)(options.categoryIds, []);
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
    (0, mocha_1.it)("writes baseline and added-card Domains into the lane artifact with the complete v1 fallback", () => {
        const domain = (activeSkillSetId, fieldId, name, description) => ({
            semanticStatus: "snapshot-audited",
            sourceSnapshotId: "glb-db-1787900894",
            activeSkillSetId,
            field: { id: fieldId, name, resourceId: `30${fieldId}`, description },
            provenance: {
                activeSkillSet: { table: "active_skill_sets", rowId: activeSkillSetId },
                relation: {
                    table: "dokkan_field_active_skill_set_relations",
                    rowId: fieldId,
                },
                field: { table: "dokkan_fields", rowId: fieldId },
            },
        });
        const projection = {
            schemaVersion: "game-db-created-domain-projection-v1",
            sourceSnapshotId: "glb-db-1787900894",
            semanticStatus: "snapshot-audited",
            scope: "active-skills-only",
            excludedSemantics: ["duration", "structured-field-efficacies", "passive-created-domain"],
            byActiveSkillSetId: {
                "323": domain("323", "11", "Earth Shrouded in Minus Energy", "Omega Domain effects"),
                "376": domain("376", "13", "New Red Ribbon Army's Base (Ruined)", "Movie Bosses ATK +60%"),
            },
        };
        const input = [{
                id: "1031501",
                activeSkillDetails: [{ id: "323" }],
                domain: "",
            }, {
                id: "new-card",
                activeSkillDetails: [{ id: "376" }],
                domain: "",
            }];
        const result = (0, game_db_lane_refresh_candidate_1.buildCreatedDomainEnrichedLaneCharacterArtifact)(input, projection, "2026-08-31T12:00:00.000Z");
        const payload = JSON.parse((0, zlib_1.gunzipSync)(result.artifact.gzipBuffer).toString("utf8"));
        (0, assert_1.equal)(payload[0].createdDomain?.activeSkillSetId, "323");
        (0, assert_1.equal)(payload[0].domain, "Earth Shrouded in Minus Energy: Omega Domain effects");
        (0, assert_1.equal)(payload[1].createdDomain?.activeSkillSetId, "376");
        (0, assert_1.deepStrictEqual)(result.patches.map(patch => patch.characterId), ["1031501", "new-card"]);
        (0, assert_1.equal)((0, android_v1_contract_projector_1.projectCharactersForAndroidV1)(payload).characters[0].domain, "Earth Shrouded in Minus Energy: Omega Domain effects");
        (0, assert_1.equal)(input[0].createdDomain, undefined);
    });
});
//# sourceMappingURL=game-db-lane-refresh-candidate.spec.js.map