import { deepEqual, equal, throws } from "assert";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { describe, it } from "mocha";
import { join } from "path";
import { tmpdir } from "os";
import {
    applyOptionalCardLimit,
    datasetVersionFromSourceSettings,
    enrichGameDbDatasetCreatedDomainsIfSupported,
    isPrimaryPlayableCardRow,
    parseOptionalCardLimit,
    resolveCreatedDomainSourceSnapshotId,
    selectPrimaryGameDbCardIds,
} from "./game-db-dataset";
import { GameDbRow } from "./game-db-source";
import { AUDITED_CREATED_DOMAIN_LINKS } from "./game-db-dokkan-field-created-domain";
import type { GameDbCharacterSnapshot } from "./game-db-contract";

function csv(rows: GameDbRow[], headers: string[]): string {
    const encode = (value: unknown) => {
        const text = String(value ?? "");
        return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    return `${headers.join(",")}\n${rows.map(row => headers.map(header => encode(row[header])).join(",")).join("\n")}\n`;
}

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

describe("enrichGameDbDatasetCreatedDomainsIfSupported", function () {
    it("preserves old sources when optional Dokkan field tables are absent", async () => {
        const characters = [];
        const result = await enrichGameDbDatasetCreatedDomainsIfSupported({
            characters,
            sourceConfig: {
                sourceRoot: __dirname,
                dataDir: __dirname,
            },
        });

        equal(result.characters, characters);
        deepEqual(result.report, { status: "absent", linkCount: 0 });
    });

    it("audits and enriches a newer first-party snapshot instead of dropping Omega's Domain", async () => {
        const dataDir = await mkdtemp(join(tmpdir(), "dokkan-created-domain-"));
        try {
            const fields = [...new Map(AUDITED_CREATED_DOMAIN_LINKS.map(link => [link.fieldId, link])).values()];
            await Promise.all([
                writeFile(join(dataDir, "dokkan_fields.csv"), csv(fields.map(link => ({
                    id: link.fieldId,
                    dokkan_field_efficacy_set_id: link.fieldId,
                    name: link.fieldName,
                    description: `${link.fieldName} field effect`,
                    resource_id: link.resourceId,
                })), ["id", "dokkan_field_efficacy_set_id", "name", "description", "resource_id"])),
                writeFile(join(dataDir, "dokkan_field_efficacy_sets.csv"), csv(
                    fields.map(link => ({ id: link.fieldId })),
                    ["id"],
                )),
                writeFile(join(dataDir, "dokkan_field_efficacies.csv"), csv([], [
                    "id", "dokkan_field_efficacy_set_id",
                ])),
                writeFile(join(dataDir, "dokkan_field_active_skill_set_relations.csv"), csv(
                    AUDITED_CREATED_DOMAIN_LINKS.map(link => ({
                        id: link.relationRowId,
                        dokkan_field_id: link.fieldId,
                        active_skill_set_id: link.activeSkillSetId,
                    })),
                    ["id", "dokkan_field_id", "active_skill_set_id"],
                )),
                writeFile(join(dataDir, "dokkan_field_passive_skill_relations.csv"), csv([], [
                    "id", "dokkan_field_id", "passive_skill_id",
                ])),
                writeFile(join(dataDir, "active_skill_sets.csv"), csv(
                    AUDITED_CREATED_DOMAIN_LINKS.map(link => ({
                        id: link.activeSkillSetId,
                        effect_description: `Creates the Domain "${link.fieldName}" for 3 turns`,
                    })),
                    ["id", "effect_description"],
                )),
            ]);
            const omega = {
                id: "1031501",
                activeSkillSets: [{ id: "323" }],
            } as unknown as GameDbCharacterSnapshot;

            const result = await enrichGameDbDatasetCreatedDomainsIfSupported({
                characters: [omega],
                sourceConfig: { sourceRoot: dataDir, dataDir },
                sourceSnapshotIdHint: "glb-db-1787900894",
            });

            equal(result.report.status, "snapshot-audited");
            equal(result.report.linkCount, 15);
            equal(result.characters[0].activeSkillSets[0].createdDomain?.field.name,
                "Earth Shrouded in Minus Energy");
        } finally {
            await rm(dataDir, { recursive: true, force: true });
        }
    });
});

describe("Created Domain dataset release identity", function () {
    it("revisions both settings-backed and fallback dataset versions", () => {
        equal(datasetVersionFromSourceSettings("2026-01-01T00:00:00.000Z", {
            glbDbVersion: 1782367825,
            glbAssetVersion: 1782367204,
        }), "glb-db-1782367825__asset-1782367204__created-domain-details-v5");
        equal(datasetVersionFromSourceSettings(
            "2026-01-01T00:00:00.000Z",
            undefined,
            ["glb-db-1782367825"],
        ), "glb-db-1782367825__created-domain-details-v5");
    });

    it("uses the explicit hint and rejects conflicting source settings", () => {
        equal(resolveCreatedDomainSourceSnapshotId(undefined, "glb-db-1782367825"), "glb-db-1782367825");
        equal(resolveCreatedDomainSourceSnapshotId({ glbDbVersion: 1782367825 }), "glb-db-1782367825");
        throws(
            () => resolveCreatedDomainSourceSnapshotId(
                { glbDbVersion: 1782367824 },
                "glb-db-1782367825",
            ),
            /conflicts with source settings/,
        );
    });
});

