"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const promises_1 = require("fs/promises");
const os_1 = require("os");
const path_1 = require("path");
const card_scope_contract_1 = require("./card-scope-contract");
const card_scope_evaluator_1 = require("./card-scope-evaluator");
const card_scope_native_1 = require("./card-scope-native");
const structural_sidecar_validator_1 = require("./structural-sidecar-validator");
const taxonomy_projection_builder_1 = require("./taxonomy-projection-builder");
const taxonomy_projection_run_1 = require("./taxonomy-projection-run");
const taxonomy_projection_validator_1 = require("./taxonomy-projection-validator");
function exactCardScope() {
    const schema = {
        status: "supported",
        tableCount: card_scope_contract_1.CARD_SCOPE_SOURCE_PIN.sqlite.tableCount,
        cardsColumns: [...card_scope_contract_1.CARD_SCOPE_TABLE_LAYOUTS.cards],
        categoryRelationColumns: [...card_scope_contract_1.CARD_SCOPE_TABLE_LAYOUTS.card_card_categories],
        optimalAwakeningGrowthColumns: [...card_scope_contract_1.CARD_SCOPE_TABLE_LAYOUTS.optimal_awakening_growths],
        replacementColumns: { characterClass: [], categories: [], links: [] },
    };
    const joinProof = {
        status: "supported",
        db1CardCount: card_scope_contract_1.CARD_SCOPE_EXPECTED_COUNTS.cardCount,
        k2CardCount: card_scope_contract_1.CARD_SCOPE_EXPECTED_COUNTS.cardCount,
        joinedCardCount: card_scope_contract_1.CARD_SCOPE_EXPECTED_COUNTS.cardCount,
        growthStateCount: card_scope_contract_1.CARD_SCOPE_EXPECTED_COUNTS.growthStateCount,
        distinctGrowthRowCount: card_scope_contract_1.CARD_SCOPE_EXPECTED_COUNTS.distinctGrowthRowCount,
        categoryAssignmentCount: card_scope_contract_1.CARD_SCOPE_EXPECTED_COUNTS.categoryAssignmentCount,
        linkAssignmentCount: card_scope_contract_1.CARD_SCOPE_EXPECTED_COUNTS.linkAssignmentCount,
        duplicateCardIdCount: 0,
        missingCardJoinCount: 0,
        duplicateCategoryRelationIdCount: 0,
        missingCategoryJoinCount: 0,
        duplicateLinkSlotCount: 0,
        missingLinkJoinCount: 0,
        identityPolicy: "structural_ids_only_no_names_or_labels",
    };
    const native = (0, card_scope_native_1.buildCardScopeNativeProof)({
        sourceSha256: card_scope_contract_1.CARD_SCOPE_SOURCE_PIN.elf.sha256,
        sourceSizeBytes: card_scope_contract_1.CARD_SCOPE_SOURCE_PIN.elf.sizeBytes,
        layoutSha256: card_scope_contract_1.CARD_SCOPE_SOURCE_PIN.nativeLayout.sha256,
        validatedRoles: new Set(Object.values(card_scope_native_1.CARD_SCOPE_NATIVE_REQUIRED_ROLES).flat()),
        codeRegionCount: card_scope_contract_1.CARD_SCOPE_EXPECTED_COUNTS.nativeCodeRegionCount,
        directCallCount: card_scope_contract_1.CARD_SCOPE_EXPECTED_COUNTS.nativeDirectCallCount,
        relocationCount: card_scope_contract_1.CARD_SCOPE_EXPECTED_COUNTS.nativeRelocationCount,
    });
    const report = (0, card_scope_evaluator_1.buildCardScopeReport)(schema, joinProof, native);
    return { report, stdout: (0, card_scope_evaluator_1.serializeCardScopeReport)(report) };
}
function labelEvidence(table, rowId) {
    return { status: "supported", value: `presentation-${rowId}`, sourceLocale: "global_snapshot_default", source: { table, rowId, column: "name" } };
}
function structuralRecord(cardId, overrides = {}) {
    return {
        cardId,
        productiveCardIdCoverage: "not_covered",
        characterClass: { raw: 10, value: "Super", status: "supported" },
        categories: {
            status: "supported",
            state: "present_with_row_provenance",
            containerProvenance: { contract: "dokkan-database-characters-taxonomy", cardId, field: "categoryAssignments" },
            assignments: [{ categoryId: "1", relationRowId: `${cardId}1`, status: "supported", labelEvidence: labelEvidence("card_categories", "1") }],
        },
        links: {
            status: "supported",
            state: "present_with_row_provenance",
            containerProvenance: { contract: "dokkan-database-characters-taxonomy", cardId, field: "links" },
            entries: [{ slot: 1, linkSkillId: "40", sourceColumn: "link_skill1_id", status: "supported", labelEvidence: labelEvidence("link_skills", "40") }],
        },
        ...overrides,
    };
}
function syntheticSources() {
    const lineage = (0, structural_sidecar_validator_1.pinnedCharacterStructuralSidecarLineage)();
    const records = [
        structuralRecord("20", {
            categories: {
                status: "supported", state: "present_with_row_provenance",
                containerProvenance: { contract: "dokkan-database-characters-taxonomy", cardId: "20", field: "categoryAssignments" },
                assignments: [
                    { categoryId: "2", relationRowId: "202", status: "supported", labelEvidence: labelEvidence("card_categories", "2") },
                    { categoryId: "1", relationRowId: "201", status: "supported", labelEvidence: labelEvidence("card_categories", "1") },
                ],
            },
            links: {
                status: "supported", state: "present_with_row_provenance",
                containerProvenance: { contract: "dokkan-database-characters-taxonomy", cardId: "20", field: "links" },
                entries: [
                    { slot: 3, linkSkillId: "43", sourceColumn: "link_skill3_id", status: "supported", labelEvidence: labelEvidence("link_skills", "43") },
                    { slot: 1, linkSkillId: "41", sourceColumn: "link_skill1_id", status: "supported", labelEvidence: labelEvidence("link_skills", "41") },
                ],
            },
        }),
        structuralRecord("10", {
            categories: {
                status: "unknown", state: "empty_with_container_provenance_absence_unproved",
                containerProvenance: { contract: "dokkan-database-characters-taxonomy", cardId: "10", field: "categoryAssignments" }, assignments: [],
            },
            links: {
                status: "partial", state: "present_with_row_provenance",
                containerProvenance: { contract: "dokkan-database-characters-taxonomy", cardId: "10", field: "links" },
                entries: [{ slot: 1, linkSkillId: "40", sourceColumn: "link_skill1_id", status: "partial", labelEvidence: labelEvidence("link_skills", "40") }],
            },
        }),
        structuralRecord("30", { characterClass: { raw: null, value: "unknown", status: "unknown" } }),
    ];
    const sidecar = {
        schemaVersion: 1,
        contract: "dokkan-database-character-structural-identity-sidecar",
        contractVersion: "1.0.0",
        generatedAt: lineage.productiveCharacters.datasetVersion,
        datasetVersion: `${lineage.snapshotVersion}-k32-structural-identity-v1`,
        mode: "offline_default_off",
        source: lineage,
        policy: {
            recordKey: "cardId", productiveComparison: "card_id_only", structuralIdentityFrom: "pinned_k2_taxonomy_only",
            productivePayloadUse: "card_id_coverage_only", presentationLabelsAreIdentity: false, sourceOrderPreserved: true,
            assignmentsDeduplicated: false, assignmentsCanonicalized: false, sharedLinksComputed: false, activeLinksComputed: false,
            collectionOrderIrrelevanceClaimed: false, ezaSezaInvariance: "not_claimed", characterPatchesCreated: false,
            consumerImplemented: false, publisherImplemented: false, androidImplemented: false,
        },
        records,
    };
    const coverage = {
        schemaVersion: 1,
        contract: "dokkan-database-character-structural-identity-coverage",
        contractVersion: "1.0.0",
        database: {
            cardCount: 3, categoryAssignmentCount: 3, linkEntryCount: 4,
            emptyCategoryCollectionCount: 1, absentCategoryCollectionCount: 0, emptyLinkCollectionCount: 0, absentLinkCollectionCount: 0,
            missingCategoryLabelMappingCount: 0, missingLinkLabelMappingCount: 0,
            fieldStatuses: {
                characterClass: { supported: 2, partial: 0, unknown: 1 },
                categories: { supported: 2, partial: 0, unknown: 1 },
                links: { supported: 2, partial: 1, unknown: 0 },
            },
        },
        productiveCardIdCoverage: {
            comparison: "card_id_only", topLevelCharacterCount: 0, uniqueCardIdCount: 0, ambiguousCardIdCount: 0,
            databaseCoveredCardCount: 0, databaseUncoveredCardCount: 3, outsideDatabaseCardIds: [],
        },
    };
    const manifest = {
        schemaVersion: 1, contract: "dokkan-database-character-structural-identity-manifest", contractVersion: "1.0.0",
        generatedAt: sidecar.generatedAt, datasetVersion: sidecar.datasetVersion,
        fileName: "database-characters-k32-structural-identity.json.gz", compression: "gzip",
        sha256: "1".repeat(64), sizeBytes: 1, uncompressedSha256: "2".repeat(64), uncompressedSizeBytes: 2,
        recordCount: records.length, source: lineage,
        coverageFile: "database-characters-k32-coverage.json", coverageSha256: "3".repeat(64), coverageSizeBytes: 3,
        validationFile: "database-characters-k32-validation.json", validationSha256: "4".repeat(64), validationSizeBytes: 4,
    };
    const k34 = exactCardScope();
    return {
        k32: {
            manifest, sidecar, coverage,
            validation: { valid: true },
            sourceBoundValidation: { status: "GO", sourceRootsRevalidated: true, exactArtifactBytesMatched: true },
        },
        k34Report: k34.report,
        k34Stdout: k34.stdout,
    };
}
describe("K35 supported-only card-scoped taxonomy projection", () => {
    it("requires every source root, including the productive root used by K32", () => {
        const args = [
            "--opt-in-k35", "--k32-root", "k32", "--k2-root", "k2", "--productive-root", "productive",
            "--sqlite-root", "sqlite", "--db1-root", "db1", "--elf-root", "elf",
            "--native-evidence-root", "native", "--output-root", "output",
        ];
        (0, assert_1.deepStrictEqual)((0, taxonomy_projection_run_1.parseTaxonomyProjectionCli)(args), {
            optIn: true, k32Root: "k32", k2Root: "k2", productiveRoot: "productive", sqliteRoot: "sqlite",
            db1Root: "db1", elfRoot: "elf", nativeEvidenceRoot: "native", outputRoot: "output",
        });
        (0, assert_1.throws)(() => (0, taxonomy_projection_run_1.parseTaxonomyProjectionCli)(args.filter(value => value !== "--opt-in-k35")), /exactly one/);
        (0, assert_1.throws)(() => (0, taxonomy_projection_run_1.parseTaxonomyProjectionCli)(args.slice(0, -2)), /requires --output-root/);
        (0, assert_1.throws)(() => (0, taxonomy_projection_run_1.parseTaxonomyProjectionCli)([...args, "--productive-root", "other"]), /duplicate --productive-root/);
        (0, assert_1.throws)(() => (0, taxonomy_projection_run_1.parseTaxonomyProjectionCli)([...args, "--network"]), /unsupported argument/);
    });
    it("sorts structural IDs, removes presentation and omits unsupported dimensions without dropping cards", () => {
        const built = (0, taxonomy_projection_builder_1.projectSupportedTaxonomyRecords)(syntheticSources().k32.sidecar.records);
        (0, assert_1.deepStrictEqual)(built.records.map(record => record.cardId), ["10", "20", "30"]);
        (0, assert_1.equal)(built.records[0].categories, undefined);
        (0, assert_1.equal)(built.records[0].links, undefined);
        (0, assert_1.deepStrictEqual)(built.records[1].categories, [
            { categoryId: "1", relationRowId: "201" },
            { categoryId: "2", relationRowId: "202" },
        ]);
        (0, assert_1.deepStrictEqual)(built.records[1].links, [
            { slot: 1, linkSkillId: "41" },
            { slot: 3, linkSkillId: "43" },
        ]);
        (0, assert_1.equal)(built.records[2].characterClass, undefined);
        (0, assert_1.equal)(JSON.stringify(built.records).includes("presentation"), false);
        (0, assert_1.equal)(built.coverage.projectedCardCount, 3);
        (0, assert_1.equal)(built.coverage.dimensions.categories.exclusions.unknown, 1);
        (0, assert_1.equal)(built.coverage.dimensions.links.exclusions.partial, 1);
        (0, assert_1.deepStrictEqual)(built.coverage.dimensions.categories.examples.unknown, ["10"]);
    });
    it("accepts only the exact K34 report with stable conclusions and productive NO-GOs", () => {
        const exact = exactCardScope();
        (0, taxonomy_projection_builder_1.assertPinnedTaxonomyProjectionCardScope)(exact.report, exact.stdout);
        const partial = JSON.parse(JSON.stringify(exact.report));
        partial.dimensions.links.conclusion = "not_fully_proved";
        (0, assert_1.throws)(() => (0, taxonomy_projection_builder_1.assertPinnedTaxonomyProjectionCardScope)(partial, `${JSON.stringify(partial, null, 2)}\n`), /unsupported GO inference|exact report pin/);
        const promoted = JSON.parse(JSON.stringify(exact.report));
        promoted.gates.android = "GO";
        (0, assert_1.throws)(() => (0, taxonomy_projection_builder_1.assertPinnedTaxonomyProjectionCardScope)(promoted, `${JSON.stringify(promoted, null, 2)}\n`), /gate drift|NO-GO/);
    });
    it("rejects synthetic source claims and never writes an unpinned artifact set", async () => {
        const root = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "k35-output-"));
        try {
            (0, assert_1.throws)(() => (0, taxonomy_projection_builder_1.buildTaxonomyProjection)(syntheticSources()), /artifact pin changed/);
            await (0, assert_1.rejects)((0, taxonomy_projection_run_1.writeTaxonomyProjectionArtifacts)(root, {}), /projection shape rejected|pinned release identity changed/);
            (0, assert_1.deepStrictEqual)(await (0, promises_1.readdir)(root), []);
        }
        finally {
            await (0, promises_1.rm)(root, { recursive: true, force: true });
        }
    });
    it("exposes no weaker artifact authorization path and requires all source roots", async () => {
        await (0, assert_1.rejects)((0, taxonomy_projection_validator_1.validateTaxonomyProjectionArtifact)({
            artifactRoot: "", k32Root: "", k2Root: "", productiveRoot: "", sqliteRoot: "", db1Root: "", elfRoot: "", nativeEvidenceRoot: "",
        }), /requires artifact, K32, K2, productive, SQLite, DB1, ELF and native-evidence roots/);
    });
});
//# sourceMappingURL=taxonomy-projection.spec.js.map