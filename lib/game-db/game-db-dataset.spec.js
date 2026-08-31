"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const promises_1 = require("fs/promises");
const mocha_1 = require("mocha");
const path_1 = require("path");
const os_1 = require("os");
const game_db_dataset_1 = require("./game-db-dataset");
const game_db_dokkan_field_created_domain_1 = require("./game-db-dokkan-field-created-domain");
function csv(rows, headers) {
    const encode = (value) => {
        const text = String(value ?? "");
        return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    return `${headers.join(",")}\n${rows.map(row => headers.map(header => encode(row[header])).join(",")).join("\n")}\n`;
}
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
    (0, mocha_1.it)("audits and enriches a newer first-party snapshot instead of dropping Omega's Domain", async () => {
        const dataDir = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "dokkan-created-domain-"));
        try {
            const fields = [...new Map(game_db_dokkan_field_created_domain_1.AUDITED_CREATED_DOMAIN_LINKS.map(link => [link.fieldId, link])).values()];
            await Promise.all([
                (0, promises_1.writeFile)((0, path_1.join)(dataDir, "dokkan_fields.csv"), csv(fields.map(link => ({
                    id: link.fieldId,
                    dokkan_field_efficacy_set_id: link.fieldId,
                    name: link.fieldName,
                    description: `${link.fieldName} field effect`,
                    resource_id: link.resourceId,
                })), ["id", "dokkan_field_efficacy_set_id", "name", "description", "resource_id"])),
                (0, promises_1.writeFile)((0, path_1.join)(dataDir, "dokkan_field_efficacy_sets.csv"), csv(fields.map(link => ({ id: link.fieldId })), ["id"])),
                (0, promises_1.writeFile)((0, path_1.join)(dataDir, "dokkan_field_efficacies.csv"), csv([], [
                    "id", "dokkan_field_efficacy_set_id",
                ])),
                (0, promises_1.writeFile)((0, path_1.join)(dataDir, "dokkan_field_active_skill_set_relations.csv"), csv(game_db_dokkan_field_created_domain_1.AUDITED_CREATED_DOMAIN_LINKS.map(link => ({
                    id: link.relationRowId,
                    dokkan_field_id: link.fieldId,
                    active_skill_set_id: link.activeSkillSetId,
                })), ["id", "dokkan_field_id", "active_skill_set_id"])),
                (0, promises_1.writeFile)((0, path_1.join)(dataDir, "dokkan_field_passive_skill_relations.csv"), csv([], [
                    "id", "dokkan_field_id", "passive_skill_id",
                ])),
                (0, promises_1.writeFile)((0, path_1.join)(dataDir, "active_skill_sets.csv"), csv(game_db_dokkan_field_created_domain_1.AUDITED_CREATED_DOMAIN_LINKS.map(link => ({
                    id: link.activeSkillSetId,
                    effect_description: `Creates the Domain "${link.fieldName}" for 3 turns`,
                })), ["id", "effect_description"])),
            ]);
            const omega = {
                id: "1031501",
                activeSkillSets: [{ id: "323" }],
            };
            const result = await (0, game_db_dataset_1.enrichGameDbDatasetCreatedDomainsIfSupported)({
                characters: [omega],
                sourceConfig: { sourceRoot: dataDir, dataDir },
                sourceSnapshotIdHint: "glb-db-1787900894",
            });
            (0, assert_1.equal)(result.report.status, "snapshot-audited");
            (0, assert_1.equal)(result.report.linkCount, 15);
            (0, assert_1.equal)(result.characters[0].activeSkillSets[0].createdDomain?.field.name, "Earth Shrouded in Minus Energy");
        }
        finally {
            await (0, promises_1.rm)(dataDir, { recursive: true, force: true });
        }
    });
});
(0, mocha_1.describe)("Created Domain dataset release identity", function () {
    (0, mocha_1.it)("revisions both settings-backed and fallback dataset versions", () => {
        (0, assert_1.equal)((0, game_db_dataset_1.datasetVersionFromSourceSettings)("2026-01-01T00:00:00.000Z", {
            glbDbVersion: 1782367825,
            glbAssetVersion: 1782367204,
        }), "glb-db-1782367825__asset-1782367204__created-domain-details-v5");
        (0, assert_1.equal)((0, game_db_dataset_1.datasetVersionFromSourceSettings)("2026-01-01T00:00:00.000Z", undefined, ["glb-db-1782367825"]), "glb-db-1782367825__created-domain-details-v5");
    });
    (0, mocha_1.it)("uses the explicit hint and rejects conflicting source settings", () => {
        (0, assert_1.equal)((0, game_db_dataset_1.resolveCreatedDomainSourceSnapshotId)(undefined, "glb-db-1782367825"), "glb-db-1782367825");
        (0, assert_1.equal)((0, game_db_dataset_1.resolveCreatedDomainSourceSnapshotId)({ glbDbVersion: 1782367825 }), "glb-db-1782367825");
        (0, assert_1.throws)(() => (0, game_db_dataset_1.resolveCreatedDomainSourceSnapshotId)({ glbDbVersion: 1782367824 }, "glb-db-1782367825"), /conflicts with source settings/);
    });
});
//# sourceMappingURL=game-db-dataset.spec.js.map