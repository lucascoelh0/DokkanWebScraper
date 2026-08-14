import { createHash } from "crypto";
import { deepStrictEqual, equal, rejects, throws } from "assert";
import { DatabaseCardRecord, SourcedRow } from "../database-experiment/contract";
import { SqliteInspection } from "../database-experiment/sqlite-readonly-adapter";
import {
    CARD_SCOPE_EXPECTED_COUNTS,
    CARD_SCOPE_SOURCE_PIN,
    CARD_SCOPE_DB1_LAYOUTS,
    CARD_SCOPE_TABLE_LAYOUTS,
    CardScopeJoinProof,
} from "./card-scope-contract";
import { buildCardScopeReport, serializeCardScopeReport, validateCardScopeReport } from "./card-scope-evaluator";
import { CARD_SCOPE_NATIVE_REQUIRED_ROLES, buildCardScopeNativeProof, decodeCardScopeInlineColumn } from "./card-scope-native";
import { buildCardScopeJoinProof, validateCardScopeSchema } from "./card-scope-source";
import { parseCardScopeCli } from "./card-scope-run";
import { DatabaseCharacterTaxonomyDataset } from "./taxonomy-contract";

const source = (table: string, rowId: string, values: Record<string, string | number | null>, columns = Object.keys(values)): SourcedRow => ({
    values,
    provenance: { table, rowId, columns },
});

function taxonomy(): DatabaseCharacterTaxonomyDataset {
    const label = (table: string, rowId: string, value: string) => ({
        value,
        sourceLocale: "global_snapshot_default" as const,
        source: { table, rowId, column: "name" },
    });
    return {
        schemaVersion: 1,
        contract: "dokkan-database-characters-taxonomy",
        contractVersion: "1.0.0",
        generatedAt: "2026-08-05T00:00:00.000Z",
        source: { snapshotVersion: CARD_SCOPE_SOURCE_PIN.snapshotVersion, databaseSha256: CARD_SCOPE_SOURCE_PIN.sqlite.sha256, db1ArtifactSha256: CARD_SCOPE_SOURCE_PIN.db1.sha256 },
        localeAudit: { provedLocales: ["global_snapshot_default"], otherLocales: "unknown", presentationTextAsIdentity: false },
        rarityValues: ["UR"],
        typeValues: ["AGL"],
        classValues: ["Super"],
        categories: [{ id: "9", label: label("card_categories", "9", "Ignored category label") }],
        links: [{ id: "40", label: label("link_skills", "40", "Ignored link label"), levels: [] }],
        cards: [{
            cardId: "1",
            labels: { cardTitle: label("cards", "1", "Ignored card label") },
            rarity: { raw: 4, value: "UR", status: "supported" },
            originalRarity: { status: "supported", sourceCardIds: ["1"], zRouteRowIds: [], cycleDetected: false, rawValues: [4], values: ["UR"] },
            type: { raw: 0, value: "AGL", status: "supported" },
            characterClass: { raw: 10, value: "Super", status: "supported" },
            categoryAssignments: [{ categoryId: "9", relationRowId: "100", status: "supported" }],
            links: [{ slot: 1, linkSkillId: "40", status: "supported", sourceColumn: "link_skill1_id" }],
        }],
        sourceAudit: { linkLevelRowIds: [], linkEfficacyRowIds: [], unjoinedLinkLevelRowIds: [], unjoinedLinkEfficacyRowIds: [] },
    };
}

function card(): DatabaseCardRecord {
    const values: Record<string, string | number | null> = { id: 1, element: 10, optimal_awakening_grow_type: 7 };
    for (let slot = 1; slot <= 7; slot++) values[`link_skill${slot}_id`] = slot === 1 ? 40 : null;
    const growthValues: Record<string, string | number | null> = {
        id: 700, optimal_awakening_grow_type: 7, step: 1, lv_max: 140, skill_lv_max: 15,
        passive_skill_set_id: 71, leader_skill_set_id: 72,
    };
    return {
        cardId: "1",
        recordKind: "collectable",
        ids: {},
        localizedText: { name: "Ignored DB1 label" },
        rarity: { raw: 4, value: "UR", evidence: "first-party-labeled-enum" },
        type: { raw: 0, value: "AGL", evidence: "first-party-labeled-enum" },
        characterClass: { raw: 10, value: "Super", evidence: "current-dataset-exact-id-parity" },
        stats: { hpInitial: null, hpMax: null, atkInitial: null, atkMax: null, defInitial: null, defMax: null },
        dates: { openAt: null, createdAt: null, updatedAt: null },
        grouping: { hardDuplicateGroupId: "1", awakeningFamilyId: "1" },
        catalog: { collectionEntries: [], collectionUniques: [], downstreamCollectionCardIds: [], isCollectionListed: true, isProjectedPrimary: true, projectionEvidence: "first-party-row-join" },
        card: source("cards", "1", values, [...CARD_SCOPE_DB1_LAYOUTS.cards]),
        links: [{ slot: 1, skill: source("link_skills", "40", { id: 40 }, [...CARD_SCOPE_DB1_LAYOUTS.link_skills]) }],
        categories: [{ relation: source("card_card_categories", "100", { id: 100, card_id: 1, card_category_id: 9 }, [...CARD_SCOPE_DB1_LAYOUTS.card_card_categories]), category: source("card_categories", "9", { id: 9 }, [...CARD_SCOPE_DB1_LAYOUTS.card_categories]) }],
        awakeningPaths: { incoming: [], outgoing: [] },
        skillStates: [
            { stateKey: "1:initial", releaseState: "initial", releaseStateEvidence: "first-party-row-join", release: { availableAt: null, availableAtSnapshot: true, routes: [] }, maxLevel: 120, maxSuperAttackLevel: 10, attacks: [] },
            { stateKey: "1:eza:700", releaseState: "eza", releaseStateEvidence: "first-party-row-join", release: { availableAt: null, availableAtSnapshot: true, routes: [] }, growthStep: source("optimal_awakening_growths", "700", growthValues, [...CARD_SCOPE_TABLE_LAYOUTS.optimal_awakening_growths]), maxLevel: 140, maxSuperAttackLevel: 15, attacks: [] },
        ],
        activeSkills: [], standbySkills: [], finishSkills: [], formRelations: [], unknowns: [],
    };
}

async function* cards(...values: DatabaseCardRecord[]): AsyncGenerator<DatabaseCardRecord> {
    for (const value of values) yield value;
}

function schemaInspection(): SqliteInspection {
    return {
        tableCount: CARD_SCOPE_SOURCE_PIN.sqlite.tableCount,
        tables: Object.entries(CARD_SCOPE_TABLE_LAYOUTS).map(([name, columns]) => ({ name, columns: [...columns], rowCount: 1 })),
    };
}

function nativeProof(validatedRoles = new Set(Object.values(CARD_SCOPE_NATIVE_REQUIRED_ROLES).flat())) {
    return buildCardScopeNativeProof({
        sourceSha256: CARD_SCOPE_SOURCE_PIN.elf.sha256,
        sourceSizeBytes: CARD_SCOPE_SOURCE_PIN.elf.sizeBytes,
        layoutSha256: CARD_SCOPE_SOURCE_PIN.nativeLayout.sha256,
        validatedRoles,
        codeRegionCount: 26,
        directCallCount: 16,
        relocationCount: 17,
    });
}

describe("K34 card-scope report gate", () => {
    it("decodes and rejects drift in inline AArch64 column names", () => {
        const instruction = (hex: string) => Buffer.from(hex, "hex");
        equal(decodeCardScopeInlineColumn([
            { offset: 0, instructions: [instruction("a98c8d52"), instruction("a9acad72")] },
            { offset: 3, instructions: [instruction("a8ad8c52"), instruction("c88dae72")] },
        ], 7), "element");
        equal(decodeCardScopeInlineColumn([
            { offset: 0, instructions: [instruction("298d8c52")] },
        ], 2), "id");
        throws(() => decodeCardScopeInlineColumn([
            { offset: 0, instructions: [instruction("00000000")] },
        ], 2), /opcode drift/);
        throws(() => decodeCardScopeInlineColumn([
            { offset: 0, instructions: [instruction("a98c8d52"), instruction("a8acad72")] },
        ], 4), /register drift/);
    });

    it("builds the positive structural golden deterministically", async () => {
        const schema = validateCardScopeSchema(schemaInspection());
        const join = await buildCardScopeJoinProof(taxonomy(), cards(card()));
        const native = nativeProof();
        const exactProfileJoin = {
            ...join,
            db1CardCount: CARD_SCOPE_EXPECTED_COUNTS.cardCount,
            k2CardCount: CARD_SCOPE_EXPECTED_COUNTS.cardCount,
            joinedCardCount: CARD_SCOPE_EXPECTED_COUNTS.cardCount,
            growthStateCount: CARD_SCOPE_EXPECTED_COUNTS.growthStateCount,
            distinctGrowthRowCount: CARD_SCOPE_EXPECTED_COUNTS.distinctGrowthRowCount,
            categoryAssignmentCount: CARD_SCOPE_EXPECTED_COUNTS.categoryAssignmentCount,
            linkAssignmentCount: CARD_SCOPE_EXPECTED_COUNTS.linkAssignmentCount,
        };
        const report = buildCardScopeReport(schema, exactProfileJoin, native);
        validateCardScopeReport(report);
        const expectedJoin: CardScopeJoinProof = {
            status: "supported", db1CardCount: 1, k2CardCount: 1, joinedCardCount: 1, growthStateCount: 1,
            distinctGrowthRowCount: 1, categoryAssignmentCount: 1, linkAssignmentCount: 1,
            duplicateCardIdCount: 0, missingCardJoinCount: 0, duplicateCategoryRelationIdCount: 0,
            missingCategoryJoinCount: 0, duplicateLinkSlotCount: 0, missingLinkJoinCount: 0,
            identityPolicy: "structural_ids_only_no_names_or_labels",
        };
        deepStrictEqual(join, expectedJoin);
        deepStrictEqual(Object.values(report.dimensions).map(value => value.conclusion), [
            "stable_for_exact_pinned_profile", "stable_for_exact_pinned_profile", "stable_for_exact_pinned_profile",
        ]);
        const first = serializeCardScopeReport(report);
        const second = serializeCardScopeReport(buildCardScopeReport(schema, exactProfileJoin, native));
        equal(first, second);
        equal(createHash("sha256").update(first).digest("hex"), "a34afd7895d40dbdfd085c7c1b5af1304247b4e7476e89bec6c81e17758f638a");
    });

    it("rejects schema replacement, removal and order mutations", () => {
        const added = schemaInspection();
        added.tables.find(value => value.name === "optimal_awakening_growths")!.columns.push("element");
        throws(() => validateCardScopeSchema(added), /layout drift/);
        const removed = schemaInspection();
        removed.tables.find(value => value.name === "cards")!.columns = removed.tables.find(value => value.name === "cards")!.columns.filter(value => value !== "element");
        throws(() => validateCardScopeSchema(removed), /layout drift/);
        const reordered = schemaInspection();
        reordered.tables.find(value => value.name === "card_card_categories")!.columns.reverse();
        throws(() => validateCardScopeSchema(reordered), /layout drift/);
    });

    it("rejects duplicate and missing structural joins", async () => {
        await rejects(buildCardScopeJoinProof(taxonomy(), cards(card(), card())), /duplicate DB1 card identity/);
        const missingCategory = card();
        missingCategory.categories = [];
        await rejects(buildCardScopeJoinProof(taxonomy(), cards(missingCategory)), /category structural join mismatch/);
        const duplicateLink = card();
        duplicateLink.links.push({ ...duplicateLink.links[0] });
        await rejects(buildCardScopeJoinProof(taxonomy(), cards(duplicateLink)), /duplicate DB1 link slot/);
        const missingGrowth = card();
        missingGrowth.skillStates[1].growthStep!.values.optimal_awakening_grow_type = 8;
        await rejects(buildCardScopeJoinProof(taxonomy(), cards(missingGrowth)), /malformed optimal-awakening row join/);
        const missingDictionary = taxonomy();
        missingDictionary.categories = [];
        await rejects(buildCardScopeJoinProof(missingDictionary, cards(card())), /missing K2 category dictionary join/);
    });

    it("preserves partial and unknown native dimensions as NO-GO", async () => {
        const schema = validateCardScopeSchema(schemaInspection());
        const join = await buildCardScopeJoinProof(taxonomy(), cards(card()));
        const exactProfileJoin = {
            ...join,
            db1CardCount: CARD_SCOPE_EXPECTED_COUNTS.cardCount,
            k2CardCount: CARD_SCOPE_EXPECTED_COUNTS.cardCount,
            joinedCardCount: CARD_SCOPE_EXPECTED_COUNTS.cardCount,
            growthStateCount: CARD_SCOPE_EXPECTED_COUNTS.growthStateCount,
            distinctGrowthRowCount: CARD_SCOPE_EXPECTED_COUNTS.distinctGrowthRowCount,
            categoryAssignmentCount: CARD_SCOPE_EXPECTED_COUNTS.categoryAssignmentCount,
            linkAssignmentCount: CARD_SCOPE_EXPECTED_COUNTS.linkAssignmentCount,
        };
        const partial = nativeProof(new Set(["card_constructor", "cards_element_read"]));
        equal(partial.dimensions.characterClass.status, "partial");
        equal(partial.dimensions.categories.status, "partial");
        equal(partial.dimensions.links.status, "partial");
        const report = buildCardScopeReport(schema, exactProfileJoin, partial);
        for (const decision of Object.values(report.dimensions)) {
            equal(decision.conclusion, "not_fully_proved");
            equal(decision.authority, "NO-GO");
        }
        validateCardScopeReport(report);
        const unknown = nativeProof(new Set());
        equal(unknown.status, "unknown");
        equal(unknown.dimensions.links.status, "unknown");
        const mutated = JSON.parse(JSON.stringify(buildCardScopeReport(schema, exactProfileJoin, nativeProof())));
        mutated.dimensions.links.nativeStatus = "partial";
        throws(() => validateCardScopeReport(mutated), /unsupported GO inference/);
        const drifted = JSON.parse(JSON.stringify(buildCardScopeReport(schema, exactProfileJoin, nativeProof())));
        drifted.provenance.sqlite.sha256 = "0".repeat(64);
        throws(() => validateCardScopeReport(drifted), /provenance drift/);
        const forgedRoles = JSON.parse(JSON.stringify(buildCardScopeReport(schema, exactProfileJoin, nativeProof())));
        forgedRoles.nativeProof.dimensions.links.proofRoles.pop();
        throws(() => validateCardScopeReport(forgedRoles), /native proof roles/);
        const forgedCounts = JSON.parse(JSON.stringify(buildCardScopeReport(schema, exactProfileJoin, nativeProof())));
        forgedCounts.joinProof.linkAssignmentCount--;
        throws(() => validateCardScopeReport(forgedCounts), /join-proof drift/);
    });

    it("requires one opt-in and every explicit root", () => {
        const valid = [
            "--opt-in-k34", "--sqlite-root", "D:/sqlite", "--db1-root", "D:/db1", "--k2-root", "D:/k2",
            "--elf-root", "D:/elf", "--native-evidence-root", "D:/native",
        ];
        deepStrictEqual(parseCardScopeCli(valid), {
            optIn: true, sqliteRoot: "D:/sqlite", db1Root: "D:/db1", k2Root: "D:/k2", elfRoot: "D:/elf", nativeEvidenceRoot: "D:/native",
        });
        throws(() => parseCardScopeCli(valid.filter(value => value !== "--opt-in-k34")), /exactly one/);
        throws(() => parseCardScopeCli([...valid, "--opt-in-k34"]), /exactly one/);
        throws(() => parseCardScopeCli(valid.slice(0, -2)), /requires --native-evidence-root/);
        throws(() => parseCardScopeCli([...valid, "--network"]), /unsupported argument/);
        throws(() => parseCardScopeCli([...valid, "--db1-root", "D:/other"]), /duplicate --db1-root/);
    });
});
