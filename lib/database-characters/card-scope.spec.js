"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const assert_1 = require("assert");
const card_scope_contract_1 = require("./card-scope-contract");
const card_scope_evaluator_1 = require("./card-scope-evaluator");
const card_scope_native_1 = require("./card-scope-native");
const card_scope_source_1 = require("./card-scope-source");
const card_scope_run_1 = require("./card-scope-run");
const source = (table, rowId, values, columns = Object.keys(values)) => ({
    values,
    provenance: { table, rowId, columns },
});
function taxonomy() {
    const label = (table, rowId, value) => ({
        value,
        sourceLocale: "global_snapshot_default",
        source: { table, rowId, column: "name" },
    });
    return {
        schemaVersion: 1,
        contract: "dokkan-database-characters-taxonomy",
        contractVersion: "1.0.0",
        generatedAt: "2026-08-05T00:00:00.000Z",
        source: { snapshotVersion: card_scope_contract_1.CARD_SCOPE_SOURCE_PIN.snapshotVersion, databaseSha256: card_scope_contract_1.CARD_SCOPE_SOURCE_PIN.sqlite.sha256, db1ArtifactSha256: card_scope_contract_1.CARD_SCOPE_SOURCE_PIN.db1.sha256 },
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
function card() {
    const values = { id: 1, element: 10, optimal_awakening_grow_type: 7 };
    for (let slot = 1; slot <= 7; slot++)
        values[`link_skill${slot}_id`] = slot === 1 ? 40 : null;
    const growthValues = {
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
        card: source("cards", "1", values, [...card_scope_contract_1.CARD_SCOPE_DB1_LAYOUTS.cards]),
        links: [{ slot: 1, skill: source("link_skills", "40", { id: 40 }, [...card_scope_contract_1.CARD_SCOPE_DB1_LAYOUTS.link_skills]) }],
        categories: [{ relation: source("card_card_categories", "100", { id: 100, card_id: 1, card_category_id: 9 }, [...card_scope_contract_1.CARD_SCOPE_DB1_LAYOUTS.card_card_categories]), category: source("card_categories", "9", { id: 9 }, [...card_scope_contract_1.CARD_SCOPE_DB1_LAYOUTS.card_categories]) }],
        awakeningPaths: { incoming: [], outgoing: [] },
        skillStates: [
            { stateKey: "1:initial", releaseState: "initial", releaseStateEvidence: "first-party-row-join", release: { availableAt: null, availableAtSnapshot: true, routes: [] }, maxLevel: 120, maxSuperAttackLevel: 10, attacks: [] },
            { stateKey: "1:eza:700", releaseState: "eza", releaseStateEvidence: "first-party-row-join", release: { availableAt: null, availableAtSnapshot: true, routes: [] }, growthStep: source("optimal_awakening_growths", "700", growthValues, [...card_scope_contract_1.CARD_SCOPE_TABLE_LAYOUTS.optimal_awakening_growths]), maxLevel: 140, maxSuperAttackLevel: 15, attacks: [] },
        ],
        activeSkills: [], standbySkills: [], finishSkills: [], formRelations: [], unknowns: [],
    };
}
async function* cards(...values) {
    for (const value of values)
        yield value;
}
function schemaInspection() {
    return {
        tableCount: card_scope_contract_1.CARD_SCOPE_SOURCE_PIN.sqlite.tableCount,
        tables: Object.entries(card_scope_contract_1.CARD_SCOPE_TABLE_LAYOUTS).map(([name, columns]) => ({ name, columns: [...columns], rowCount: 1 })),
    };
}
function nativeProof(validatedRoles = new Set(Object.values(card_scope_native_1.CARD_SCOPE_NATIVE_REQUIRED_ROLES).flat())) {
    return (0, card_scope_native_1.buildCardScopeNativeProof)({
        sourceSha256: card_scope_contract_1.CARD_SCOPE_SOURCE_PIN.elf.sha256,
        sourceSizeBytes: card_scope_contract_1.CARD_SCOPE_SOURCE_PIN.elf.sizeBytes,
        layoutSha256: card_scope_contract_1.CARD_SCOPE_SOURCE_PIN.nativeLayout.sha256,
        validatedRoles,
        codeRegionCount: 26,
        directCallCount: 16,
        relocationCount: 17,
    });
}
describe("K34 card-scope report gate", () => {
    it("decodes and rejects drift in inline AArch64 column names", () => {
        const instruction = (hex) => Buffer.from(hex, "hex");
        (0, assert_1.equal)((0, card_scope_native_1.decodeCardScopeInlineColumn)([
            { offset: 0, instructions: [instruction("a98c8d52"), instruction("a9acad72")] },
            { offset: 3, instructions: [instruction("a8ad8c52"), instruction("c88dae72")] },
        ], 7), "element");
        (0, assert_1.equal)((0, card_scope_native_1.decodeCardScopeInlineColumn)([
            { offset: 0, instructions: [instruction("298d8c52")] },
        ], 2), "id");
        (0, assert_1.throws)(() => (0, card_scope_native_1.decodeCardScopeInlineColumn)([
            { offset: 0, instructions: [instruction("00000000")] },
        ], 2), /opcode drift/);
        (0, assert_1.throws)(() => (0, card_scope_native_1.decodeCardScopeInlineColumn)([
            { offset: 0, instructions: [instruction("a98c8d52"), instruction("a8acad72")] },
        ], 4), /register drift/);
    });
    it("builds the positive structural golden deterministically", async () => {
        const schema = (0, card_scope_source_1.validateCardScopeSchema)(schemaInspection());
        const join = await (0, card_scope_source_1.buildCardScopeJoinProof)(taxonomy(), cards(card()));
        const native = nativeProof();
        const exactProfileJoin = {
            ...join,
            db1CardCount: card_scope_contract_1.CARD_SCOPE_EXPECTED_COUNTS.cardCount,
            k2CardCount: card_scope_contract_1.CARD_SCOPE_EXPECTED_COUNTS.cardCount,
            joinedCardCount: card_scope_contract_1.CARD_SCOPE_EXPECTED_COUNTS.cardCount,
            growthStateCount: card_scope_contract_1.CARD_SCOPE_EXPECTED_COUNTS.growthStateCount,
            distinctGrowthRowCount: card_scope_contract_1.CARD_SCOPE_EXPECTED_COUNTS.distinctGrowthRowCount,
            categoryAssignmentCount: card_scope_contract_1.CARD_SCOPE_EXPECTED_COUNTS.categoryAssignmentCount,
            linkAssignmentCount: card_scope_contract_1.CARD_SCOPE_EXPECTED_COUNTS.linkAssignmentCount,
        };
        const report = (0, card_scope_evaluator_1.buildCardScopeReport)(schema, exactProfileJoin, native);
        (0, card_scope_evaluator_1.validateCardScopeReport)(report);
        const expectedJoin = {
            status: "supported", db1CardCount: 1, k2CardCount: 1, joinedCardCount: 1, growthStateCount: 1,
            distinctGrowthRowCount: 1, categoryAssignmentCount: 1, linkAssignmentCount: 1,
            duplicateCardIdCount: 0, missingCardJoinCount: 0, duplicateCategoryRelationIdCount: 0,
            missingCategoryJoinCount: 0, duplicateLinkSlotCount: 0, missingLinkJoinCount: 0,
            identityPolicy: "structural_ids_only_no_names_or_labels",
        };
        (0, assert_1.deepStrictEqual)(join, expectedJoin);
        (0, assert_1.deepStrictEqual)(Object.values(report.dimensions).map(value => value.conclusion), [
            "stable_for_exact_pinned_profile", "stable_for_exact_pinned_profile", "stable_for_exact_pinned_profile",
        ]);
        const first = (0, card_scope_evaluator_1.serializeCardScopeReport)(report);
        const second = (0, card_scope_evaluator_1.serializeCardScopeReport)((0, card_scope_evaluator_1.buildCardScopeReport)(schema, exactProfileJoin, native));
        (0, assert_1.equal)(first, second);
        (0, assert_1.equal)((0, crypto_1.createHash)("sha256").update(first).digest("hex"), "a34afd7895d40dbdfd085c7c1b5af1304247b4e7476e89bec6c81e17758f638a");
    });
    it("rejects schema replacement, removal and order mutations", () => {
        const added = schemaInspection();
        added.tables.find(value => value.name === "optimal_awakening_growths").columns.push("element");
        (0, assert_1.throws)(() => (0, card_scope_source_1.validateCardScopeSchema)(added), /layout drift/);
        const removed = schemaInspection();
        removed.tables.find(value => value.name === "cards").columns = removed.tables.find(value => value.name === "cards").columns.filter(value => value !== "element");
        (0, assert_1.throws)(() => (0, card_scope_source_1.validateCardScopeSchema)(removed), /layout drift/);
        const reordered = schemaInspection();
        reordered.tables.find(value => value.name === "card_card_categories").columns.reverse();
        (0, assert_1.throws)(() => (0, card_scope_source_1.validateCardScopeSchema)(reordered), /layout drift/);
    });
    it("rejects duplicate and missing structural joins", async () => {
        await (0, assert_1.rejects)((0, card_scope_source_1.buildCardScopeJoinProof)(taxonomy(), cards(card(), card())), /duplicate DB1 card identity/);
        const missingCategory = card();
        missingCategory.categories = [];
        await (0, assert_1.rejects)((0, card_scope_source_1.buildCardScopeJoinProof)(taxonomy(), cards(missingCategory)), /category structural join mismatch/);
        const duplicateLink = card();
        duplicateLink.links.push({ ...duplicateLink.links[0] });
        await (0, assert_1.rejects)((0, card_scope_source_1.buildCardScopeJoinProof)(taxonomy(), cards(duplicateLink)), /duplicate DB1 link slot/);
        const missingGrowth = card();
        missingGrowth.skillStates[1].growthStep.values.optimal_awakening_grow_type = 8;
        await (0, assert_1.rejects)((0, card_scope_source_1.buildCardScopeJoinProof)(taxonomy(), cards(missingGrowth)), /malformed optimal-awakening row join/);
        const missingDictionary = taxonomy();
        missingDictionary.categories = [];
        await (0, assert_1.rejects)((0, card_scope_source_1.buildCardScopeJoinProof)(missingDictionary, cards(card())), /missing K2 category dictionary join/);
    });
    it("preserves partial and unknown native dimensions as NO-GO", async () => {
        const schema = (0, card_scope_source_1.validateCardScopeSchema)(schemaInspection());
        const join = await (0, card_scope_source_1.buildCardScopeJoinProof)(taxonomy(), cards(card()));
        const exactProfileJoin = {
            ...join,
            db1CardCount: card_scope_contract_1.CARD_SCOPE_EXPECTED_COUNTS.cardCount,
            k2CardCount: card_scope_contract_1.CARD_SCOPE_EXPECTED_COUNTS.cardCount,
            joinedCardCount: card_scope_contract_1.CARD_SCOPE_EXPECTED_COUNTS.cardCount,
            growthStateCount: card_scope_contract_1.CARD_SCOPE_EXPECTED_COUNTS.growthStateCount,
            distinctGrowthRowCount: card_scope_contract_1.CARD_SCOPE_EXPECTED_COUNTS.distinctGrowthRowCount,
            categoryAssignmentCount: card_scope_contract_1.CARD_SCOPE_EXPECTED_COUNTS.categoryAssignmentCount,
            linkAssignmentCount: card_scope_contract_1.CARD_SCOPE_EXPECTED_COUNTS.linkAssignmentCount,
        };
        const partial = nativeProof(new Set(["card_constructor", "cards_element_read"]));
        (0, assert_1.equal)(partial.dimensions.characterClass.status, "partial");
        (0, assert_1.equal)(partial.dimensions.categories.status, "partial");
        (0, assert_1.equal)(partial.dimensions.links.status, "partial");
        const report = (0, card_scope_evaluator_1.buildCardScopeReport)(schema, exactProfileJoin, partial);
        for (const decision of Object.values(report.dimensions)) {
            (0, assert_1.equal)(decision.conclusion, "not_fully_proved");
            (0, assert_1.equal)(decision.authority, "NO-GO");
        }
        (0, card_scope_evaluator_1.validateCardScopeReport)(report);
        const unknown = nativeProof(new Set());
        (0, assert_1.equal)(unknown.status, "unknown");
        (0, assert_1.equal)(unknown.dimensions.links.status, "unknown");
        const mutated = JSON.parse(JSON.stringify((0, card_scope_evaluator_1.buildCardScopeReport)(schema, exactProfileJoin, nativeProof())));
        mutated.dimensions.links.nativeStatus = "partial";
        (0, assert_1.throws)(() => (0, card_scope_evaluator_1.validateCardScopeReport)(mutated), /unsupported GO inference/);
        const drifted = JSON.parse(JSON.stringify((0, card_scope_evaluator_1.buildCardScopeReport)(schema, exactProfileJoin, nativeProof())));
        drifted.provenance.sqlite.sha256 = "0".repeat(64);
        (0, assert_1.throws)(() => (0, card_scope_evaluator_1.validateCardScopeReport)(drifted), /provenance drift/);
        const forgedRoles = JSON.parse(JSON.stringify((0, card_scope_evaluator_1.buildCardScopeReport)(schema, exactProfileJoin, nativeProof())));
        forgedRoles.nativeProof.dimensions.links.proofRoles.pop();
        (0, assert_1.throws)(() => (0, card_scope_evaluator_1.validateCardScopeReport)(forgedRoles), /native proof roles/);
        const forgedCounts = JSON.parse(JSON.stringify((0, card_scope_evaluator_1.buildCardScopeReport)(schema, exactProfileJoin, nativeProof())));
        forgedCounts.joinProof.linkAssignmentCount--;
        (0, assert_1.throws)(() => (0, card_scope_evaluator_1.validateCardScopeReport)(forgedCounts), /join-proof drift/);
    });
    it("requires one opt-in and every explicit root", () => {
        const valid = [
            "--opt-in-k34", "--sqlite-root", "D:/sqlite", "--db1-root", "D:/db1", "--k2-root", "D:/k2",
            "--elf-root", "D:/elf", "--native-evidence-root", "D:/native",
        ];
        (0, assert_1.deepStrictEqual)((0, card_scope_run_1.parseCardScopeCli)(valid), {
            optIn: true, sqliteRoot: "D:/sqlite", db1Root: "D:/db1", k2Root: "D:/k2", elfRoot: "D:/elf", nativeEvidenceRoot: "D:/native",
        });
        (0, assert_1.throws)(() => (0, card_scope_run_1.parseCardScopeCli)(valid.filter(value => value !== "--opt-in-k34")), /exactly one/);
        (0, assert_1.throws)(() => (0, card_scope_run_1.parseCardScopeCli)([...valid, "--opt-in-k34"]), /exactly one/);
        (0, assert_1.throws)(() => (0, card_scope_run_1.parseCardScopeCli)(valid.slice(0, -2)), /requires --native-evidence-root/);
        (0, assert_1.throws)(() => (0, card_scope_run_1.parseCardScopeCli)([...valid, "--network"]), /unsupported argument/);
        (0, assert_1.throws)(() => (0, card_scope_run_1.parseCardScopeCli)([...valid, "--db1-root", "D:/other"]), /duplicate --db1-root/);
    });
});
//# sourceMappingURL=card-scope.spec.js.map