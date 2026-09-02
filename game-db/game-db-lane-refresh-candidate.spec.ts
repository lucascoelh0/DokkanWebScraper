import { deepStrictEqual, equal, throws } from "assert";
import { describe, it } from "mocha";
import { gunzipSync } from "zlib";
import type { Character } from "../character";
import { projectCharactersForAndroidV1 } from "../android-v1-contract-projector";
import {
    applyAdditiveCategoryAssignments,
    buildCreatedDomainEnrichedLaneCharacterArtifact,
    LANE_REFRESH_GAME_DB_TABLES,
    mergeReleaseProjections,
    parseGameDbLaneRefreshArgs,
    resolveOfficialCategoryAssignments,
} from "./game-db-lane-refresh-candidate";
import type { GameDbSnapshotAuditedCreatedDomainProjectionV1 } from "./game-db-dokkan-field-created-domain";
import { DOKKAN_FIELD_SIDECAR_TABLES } from "./game-db-dokkan-field-sidecar";

describe("game DB lane refresh candidate", () => {
    it("materializes every inventoried Dokkan Field table required by Domain enrichment", () => {
        deepStrictEqual(
            DOKKAN_FIELD_SIDECAR_TABLES.filter(table => !LANE_REFRESH_GAME_DB_TABLES.includes(table)),
            [],
        );
    });

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

    it("accepts an overlay-only refresh without explicit card additions", () => {
        const options = parseGameDbLaneRefreshArgs([
            "--contract-lane", "v2",
            "--first-party-dir", "first-party",
            "--portrait-assets-dir", "portraits",
            "--baseline-dir", "baseline",
            "--output-dir", "output",
        ]);
        deepStrictEqual(options.newCardIds, []);
        deepStrictEqual(options.releaseStateCardIds, []);
        deepStrictEqual(options.categoryIds, []);
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

    it("writes baseline and added-card Domains into the lane artifact with the complete v1 fallback", () => {
        const domain = (activeSkillSetId: string, fieldId: string, name: string, description: string) => ({
            semanticStatus: "snapshot-audited" as const,
            sourceSnapshotId: "glb-db-1787900894",
            activeSkillSetId,
            field: { id: fieldId, name, resourceId: `30${fieldId}`, description },
            provenance: {
                activeSkillSet: { table: "active_skill_sets" as const, rowId: activeSkillSetId },
                relation: {
                    table: "dokkan_field_active_skill_set_relations" as const,
                    rowId: fieldId,
                },
                field: { table: "dokkan_fields" as const, rowId: fieldId },
            },
        });
        const projection: GameDbSnapshotAuditedCreatedDomainProjectionV1 = {
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
        }] as unknown as Character[];

        const result = buildCreatedDomainEnrichedLaneCharacterArtifact(
            input,
            projection,
            "2026-08-31T12:00:00.000Z",
        );
        const payload = JSON.parse(gunzipSync(result.artifact.gzipBuffer).toString("utf8")) as Character[];

        equal(payload[0].createdDomain?.activeSkillSetId, "323");
        equal(payload[0].domain, "Earth Shrouded in Minus Energy: Omega Domain effects");
        equal(payload[1].createdDomain?.activeSkillSetId, "376");
        deepStrictEqual(result.patches.map(patch => patch.characterId), ["1031501", "new-card"]);
        equal(projectCharactersForAndroidV1(payload).characters[0].domain,
            "Earth Shrouded in Minus Energy: Omega Domain effects");
        equal(input[0].createdDomain, undefined);
    });
});
