"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const os_1 = require("os");
const path_1 = require("path");
const structural_sidecar_builder_1 = require("./structural-sidecar-builder");
const structural_sidecar_contract_1 = require("./structural-sidecar-contract");
const structural_sidecar_source_1 = require("./structural-sidecar-source");
const structural_sidecar_run_1 = require("./structural-sidecar-run");
const structural_sidecar_validator_1 = require("./structural-sidecar-validator");
const hash = (bytes) => (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
function label(table, id) {
    return { value: `${table}-${id}`, sourceLocale: "global_snapshot_default", source: { table, rowId: id, column: "name" } };
}
function taxonomy(cards, categoryIds = ["1", "2"], linkIds = ["10", "11"]) {
    const pin = structural_sidecar_contract_1.CHARACTER_STRUCTURAL_SIDECAR_SOURCE_PIN;
    return {
        schemaVersion: 1,
        contract: "dokkan-database-characters-taxonomy",
        contractVersion: "1.0.0",
        generatedAt: pin.k2.generatedAt,
        source: { snapshotVersion: pin.snapshotVersion, databaseSha256: pin.k2.databaseSha256, db1ArtifactSha256: pin.k2.db1ArtifactSha256 },
        localeAudit: { provedLocales: ["global_snapshot_default"], otherLocales: "unknown", presentationTextAsIdentity: false },
        rarityValues: [], typeValues: [], classValues: ["Super", "Extreme", "unawakened"],
        categories: categoryIds.map(id => ({ id, label: label("card_categories", id) })),
        links: linkIds.map(id => ({ id, label: label("link_skills", id), levels: [] })),
        cards,
        sourceAudit: { linkLevelRowIds: [], linkEfficacyRowIds: [], unjoinedLinkLevelRowIds: [], unjoinedLinkEfficacyRowIds: [] },
    };
}
function card(cardId, categories = [], links = []) {
    return {
        cardId,
        labels: { cardTitle: { value: "presentation only", sourceLocale: "global_snapshot_default", source: { table: "cards", rowId: cardId, column: "name" } } },
        rarity: { raw: 4, value: "UR", status: "supported" },
        originalRarity: { status: "supported", sourceCardIds: [cardId], zRouteRowIds: [], cycleDetected: false, rawValues: [4], values: ["UR"] },
        type: { raw: 0, value: "AGL", status: "supported" },
        characterClass: { raw: 0, value: "Super", status: "supported" },
        categoryAssignments: categories,
        links,
    };
}
function productive(cardIds = []) {
    return { topLevelCount: cardIds.length, occurrenceCount: cardIds.length, cardIds: new Set(cardIds) };
}
function k2Manifest() {
    const pin = structural_sidecar_contract_1.CHARACTER_STRUCTURAL_SIDECAR_SOURCE_PIN;
    return {
        schemaVersion: 1, contractVersion: pin.k2.contractVersion, generatedAt: pin.k2.generatedAt,
        fileName: pin.k2.payloadFile, compression: "gzip", sha256: pin.k2.payloadSha256,
        sizeBytes: pin.k2.payloadSizeBytes, uncompressedSizeBytes: pin.k2.uncompressedSizeBytes,
        sourceSnapshotVersion: pin.snapshotVersion, sourceDatabaseSha256: pin.k2.databaseSha256, sourceDb1ArtifactSha256: pin.k2.db1ArtifactSha256,
        coverageFile: pin.k2.coverageFile, coverageSha256: pin.k2.coverageSha256, coverageSizeBytes: pin.k2.coverageSizeBytes,
        validationFile: pin.k2.validationFile, validationSha256: pin.k2.validationSha256, validationSizeBytes: pin.k2.validationSizeBytes,
    };
}
function productiveManifest() {
    const pin = structural_sidecar_contract_1.CHARACTER_STRUCTURAL_SIDECAR_SOURCE_PIN.productiveCharacters;
    return {
        schemaVersion: 1, datasetVersion: pin.datasetVersion, generatedAt: pin.datasetVersion, fileName: pin.manifestPayloadFile,
        compression: "gzip", sha256: pin.payloadSha256, sizeBytes: pin.payloadSizeBytes,
        uncompressedSizeBytes: pin.uncompressedSizeBytes, characterCount: pin.topLevelCount,
    };
}
function fullPinnedFixture() {
    const pin = structural_sidecar_contract_1.CHARACTER_STRUCTURAL_SIDECAR_SOURCE_PIN;
    const categories = Array.from({ length: pin.k2.categoryCount }, (_, index) => String(index + 1));
    const links = Array.from({ length: pin.k2.linkCount }, (_, index) => String(index + 1));
    let relationRow = 1;
    const cards = Array.from({ length: pin.k2.cardCount }, (_, index) => {
        const cardId = String(index + 1);
        const categoryCount = 9 + (index < 2241 ? 1 : 0);
        const linkCount = 5 + (index < 5223 ? 1 : 0);
        return card(cardId, Array.from({ length: categoryCount }, (_, offset) => ({
            categoryId: categories[(index + offset) % categories.length], relationRowId: String(relationRow++), status: "supported",
        })), Array.from({ length: linkCount }, (_, offset) => ({
            slot: offset + 1, linkSkillId: links[(index + offset) % links.length], status: "supported", sourceColumn: `link_skill${offset + 1}_id`,
        })));
    });
    const covered = Array.from({ length: pin.productiveCharacters.databaseCoveredCardCount }, (_, index) => String(index + 1));
    const productiveCoverage = {
        topLevelCount: pin.productiveCharacters.topLevelCount,
        occurrenceCount: pin.productiveCharacters.uniqueCardIdCount,
        cardIds: new Set([...covered, ...pin.productiveCharacters.outsideDatabaseCardIds]),
    };
    return (0, structural_sidecar_builder_1.buildCharacterStructuralSidecar)(taxonomy(cards, categories, links), productiveCoverage, (0, structural_sidecar_validator_1.pinnedCharacterStructuralSidecarLineage)());
}
describe("K32 compact structural identity sidecar", () => {
    it("is default-off and requires every caller-supplied root exactly once", () => {
        const valid = ["--opt-in-k32", "--k2-root", "K2", "--productive-root", "current", "--output-root", "output"];
        (0, assert_1.throws)(() => (0, structural_sidecar_run_1.parseCharacterStructuralSidecarCli)([]), /explicit --opt-in-k32/);
        (0, assert_1.throws)(() => (0, structural_sidecar_run_1.parseCharacterStructuralSidecarCli)(valid.slice(0, -2)), /requires --output-root/);
        (0, assert_1.throws)(() => (0, structural_sidecar_run_1.parseCharacterStructuralSidecarCli)([...valid, "--k2-root", "other"]), /duplicate --k2-root/);
        (0, assert_1.throws)(() => (0, structural_sidecar_run_1.parseCharacterStructuralSidecarCli)([...valid, "--unknown"]), /unsupported argument/);
        (0, assert_1.deepStrictEqual)((0, structural_sidecar_run_1.parseCharacterStructuralSidecarCli)(valid), {
            optIn: true, k2Root: "K2", productiveRoot: "current", outputRoot: "output",
        });
    });
    it("requires artifact, K2 and productive roots for authoritative validation", async () => {
        await (0, assert_1.rejects)((0, structural_sidecar_validator_1.validateCharacterStructuralSidecarArtifact)({ artifactRoot: "", k2Root: "", productiveRoot: "" }), /requires artifactRoot, k2Root and productiveRoot/);
    });
    it("preserves assignment order, duplicate assignment IDs, link slots and source columns", () => {
        const source = taxonomy([card("100", [
                { categoryId: "2", relationRowId: "20", status: "supported" },
                { categoryId: "1", relationRowId: "21", status: "supported" },
                { categoryId: "2", relationRowId: "22", status: "supported" },
            ], [
                { slot: 2, linkSkillId: "11", status: "supported", sourceColumn: "link_skill2_id" },
                { slot: 5, linkSkillId: "10", status: "supported", sourceColumn: "link_skill5_id" },
            ])]);
        const result = (0, structural_sidecar_builder_1.buildCharacterStructuralSidecar)(source, productive(["100"]), (0, structural_sidecar_validator_1.pinnedCharacterStructuralSidecarLineage)()).sidecar.records[0];
        (0, assert_1.deepStrictEqual)(result.categories.assignments.map(item => [item.categoryId, item.relationRowId]), [["2", "20"], ["1", "21"], ["2", "22"]]);
        (0, assert_1.deepStrictEqual)(result.links.entries.map(item => [item.slot, item.linkSkillId, item.sourceColumn]), [[2, "11", "link_skill2_id"], [5, "10", "link_skill5_id"]]);
    });
    it("fails duplicate key/dictionary identities closed without deduplicating assignments", () => {
        const duplicateCards = taxonomy([card("100"), card("100")]);
        (0, assert_1.throws)(() => (0, structural_sidecar_builder_1.buildCharacterStructuralSidecar)(duplicateCards, productive(), (0, structural_sidecar_validator_1.pinnedCharacterStructuralSidecarLineage)()), /duplicate K2 cardId/);
        const duplicateCategories = taxonomy([card("100")], ["1", "1"]);
        (0, assert_1.throws)(() => (0, structural_sidecar_builder_1.buildCharacterStructuralSidecar)(duplicateCategories, productive(), (0, structural_sidecar_validator_1.pinnedCharacterStructuralSidecarLineage)()), /duplicate K2 category dictionary ID/);
        const duplicateLinks = taxonomy([card("100")], ["1"], ["10", "10"]);
        (0, assert_1.throws)(() => (0, structural_sidecar_builder_1.buildCharacterStructuralSidecar)(duplicateLinks, productive(), (0, structural_sidecar_validator_1.pinnedCharacterStructuralSidecarLineage)()), /duplicate K2 link dictionary ID/);
    });
    it("keeps missing dictionary mappings presentation-only and explicit", () => {
        const source = taxonomy([card("100", [{ categoryId: "999", relationRowId: "1", status: "supported" }], [
                { slot: 1, linkSkillId: "998", status: "supported", sourceColumn: "link_skill1_id" },
            ])]);
        const record = (0, structural_sidecar_builder_1.buildCharacterStructuralSidecar)(source, productive(), (0, structural_sidecar_validator_1.pinnedCharacterStructuralSidecarLineage)()).sidecar.records[0];
        (0, assert_1.deepStrictEqual)(record.categories.assignments[0].labelEvidence, { status: "unknown", reason: "dictionary_mapping_missing" });
        (0, assert_1.deepStrictEqual)(record.links.entries[0].labelEvidence, { status: "unknown", reason: "dictionary_mapping_missing" });
        (0, assert_1.equal)(record.categories.status, "supported");
        (0, assert_1.equal)(record.links.status, "supported");
    });
    it("distinguishes empty container provenance from absent/unproved fields", () => {
        const empty = card("100");
        const absent = card("101");
        delete absent.categoryAssignments;
        delete absent.links;
        const records = (0, structural_sidecar_builder_1.buildCharacterStructuralSidecar)(taxonomy([empty, absent]), productive(), (0, structural_sidecar_validator_1.pinnedCharacterStructuralSidecarLineage)()).sidecar.records;
        (0, assert_1.equal)(records[0].categories.state, "empty_with_container_provenance_absence_unproved");
        (0, assert_1.equal)(records[0].categories.containerProvenance?.cardId, "100");
        (0, assert_1.equal)(records[0].categories.status, "unknown");
        (0, assert_1.equal)(records[1].categories.state, "absent_unproved");
        (0, assert_1.equal)(records[1].categories.containerProvenance, null);
        (0, assert_1.equal)(records[1].links.state, "absent_unproved");
    });
    it("rejects malformed pinned lineage, traversal, absolute members and ambiguous current card IDs", () => {
        (0, structural_sidecar_source_1.validateCharacterStructuralK2Manifest)(k2Manifest());
        (0, structural_sidecar_source_1.validateCharacterStructuralProductiveManifest)(productiveManifest());
        (0, assert_1.throws)(() => (0, structural_sidecar_source_1.validateCharacterStructuralK2Manifest)({ ...k2Manifest(), sha256: "0".repeat(64) }), /lineage changed/);
        (0, assert_1.throws)(() => (0, structural_sidecar_source_1.validateCharacterStructuralK2Manifest)({ ...k2Manifest(), fileName: "../database-characters-k2-taxonomy.json.gz" }), /lineage changed/);
        (0, assert_1.throws)(() => (0, structural_sidecar_source_1.validateCharacterStructuralProductiveManifest)({ ...productiveManifest(), fileName: "C:\\escape\\characters.json.gz" }), /lineage changed/);
        (0, assert_1.throws)(() => (0, structural_sidecar_source_1.validateCharacterStructuralProductiveManifest)({ ...productiveManifest(), characterCount: 1 }), /lineage changed/);
        (0, assert_1.throws)(() => (0, structural_sidecar_source_1.validateCharacterStructuralTaxonomy)(taxonomy([card("100")])), /cardinality changed/);
        (0, assert_1.throws)(() => (0, structural_sidecar_source_1.indexProductiveCardIds)([{ id: "100" }, { id: "100" }]), /ambiguous productive cardId 100/);
        (0, assert_1.throws)(() => (0, structural_sidecar_source_1.indexProductiveCardIds)([{ id: "100", transformations: [{ name: "missing id" }] }]), /malformed productive cardId/);
    });
    it("writes deterministic canonical gzip/metadata and rejects integrity metadata mutation", async function () {
        this.timeout(30000);
        const temporary = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "dokkan-k32-artifact-"));
        const firstRoot = (0, path_1.join)(temporary, "first");
        const secondRoot = (0, path_1.join)(temporary, "second");
        await Promise.all([(0, promises_1.mkdir)(firstRoot), (0, promises_1.mkdir)(secondRoot)]);
        try {
            const built = fullPinnedFixture();
            const first = (0, structural_sidecar_validator_1.materializeCharacterStructuralSidecar)(built.sidecar, built.coverage);
            const second = (0, structural_sidecar_validator_1.materializeCharacterStructuralSidecar)(built.sidecar, built.coverage);
            (0, assert_1.equal)(first.raw.equals(second.raw), true);
            (0, assert_1.equal)(first.gzip.equals(second.gzip), true);
            (0, assert_1.equal)(first.manifestBytes.equals(second.manifestBytes), true);
            await (0, structural_sidecar_run_1.writeCharacterStructuralSidecarArtifacts)(firstRoot, first);
            await (0, structural_sidecar_run_1.writeCharacterStructuralSidecarArtifacts)(secondRoot, second);
            const validated = await (0, structural_sidecar_validator_1.validateCharacterStructuralSidecarArtifactIntegrityOnly)(firstRoot);
            (0, assert_1.equal)(validated.sidecar.records.length, structural_sidecar_contract_1.CHARACTER_STRUCTURAL_SIDECAR_SOURCE_PIN.k2.cardCount);
            (0, assert_1.equal)(validated.coverage.productiveCardIdCoverage.databaseCoveredCardCount, 1623);
            (0, assert_1.deepStrictEqual)(validated.validation.safety, {
                duplicateCardIdCount: 0,
                duplicateCategoryDictionaryIdCount: 0,
                duplicateLinkDictionaryIdCount: 0,
                invalidCollectionStateCount: 0,
                invalidOrderingOrSlotCount: 0,
                characterPatchCount: 0,
                networkRequestCount: 0,
                outputNamespaceThreatModel: "caller_controlled_stable_during_operation",
                portableOpenatProtection: "unavailable",
                sameUserNamespaceAttackerResistanceClaimed: false,
                hardLinkAttackerResistanceClaimed: false,
            });
            (0, assert_1.deepStrictEqual)(validated.validation.readiness, {
                offlineGeneration: "GO",
                integrityOnlyValidation: "NON_AUTHORITATIVE",
                sourceBoundArtifactValidation: "REQUIRED_FOR_GO",
                publication: "NO-GO",
                r2: "NO-GO",
                android: "NO-GO",
                authorityPromotion: "NO-GO",
                gameplaySemantics: "NO-GO",
                consumer: "NO-GO",
                characterApply: "NO-GO",
            });
            await (0, assert_1.rejects)((0, structural_sidecar_run_1.writeCharacterStructuralSidecarArtifacts)(firstRoot, first), /output already exists/);
            const validationPath = (0, path_1.join)(firstRoot, structural_sidecar_contract_1.CHARACTER_STRUCTURAL_SIDECAR_FILES.validation);
            const manifestPath = (0, path_1.join)(firstRoot, structural_sidecar_contract_1.CHARACTER_STRUCTURAL_SIDECAR_FILES.manifest);
            const validation = JSON.parse((await (0, promises_1.readFile)(validationPath)).toString("utf8"));
            validation.readiness.publication = "GO";
            const validationBytes = Buffer.from(`${JSON.stringify(validation, null, 2)}\n`, "utf8");
            const manifest = JSON.parse((await (0, promises_1.readFile)(manifestPath)).toString("utf8"));
            manifest.validationSha256 = hash(validationBytes);
            manifest.validationSizeBytes = validationBytes.length;
            await Promise.all([
                (0, promises_1.writeFile)(validationPath, validationBytes),
                (0, promises_1.writeFile)(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`),
            ]);
            await (0, assert_1.rejects)((0, structural_sidecar_validator_1.validateCharacterStructuralSidecarArtifactIntegrityOnly)(firstRoot), /validation metadata rejected/);
        }
        finally {
            await (0, promises_1.rm)(temporary, { recursive: true, force: true });
        }
    });
    it("binds authoritative validation to the explicit pinned K2 and productive roots", async function () {
        this.timeout(120000);
        const k2Root = process.env.K32_TEST_K2_ROOT;
        const productiveRoot = process.env.K32_TEST_PRODUCTIVE_ROOT;
        if (!k2Root || !productiveRoot) {
            this.skip();
            return;
        }
        const temporary = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "dokkan-k32-source-bound-"));
        const exactRoot = (0, path_1.join)(temporary, "exact");
        const forgedRoot = (0, path_1.join)(temporary, "forged");
        await Promise.all([(0, promises_1.mkdir)(exactRoot), (0, promises_1.mkdir)(forgedRoot)]);
        try {
            const source = await (0, structural_sidecar_source_1.loadCharacterStructuralSidecarSource)({ k2Root, productiveRoot });
            const built = (0, structural_sidecar_builder_1.buildCharacterStructuralSidecar)(source.taxonomy, source.productive, source.lineage);
            const exact = (0, structural_sidecar_validator_1.materializeCharacterStructuralSidecar)(built.sidecar, built.coverage);
            await (0, structural_sidecar_run_1.writeCharacterStructuralSidecarArtifacts)(exactRoot, exact);
            const validated = await (0, structural_sidecar_validator_1.validateCharacterStructuralSidecarArtifact)({ artifactRoot: exactRoot, k2Root, productiveRoot });
            (0, assert_1.equal)(validated.manifest.sha256, exact.manifest.sha256);
            (0, assert_1.deepStrictEqual)(validated.sourceBoundValidation, {
                status: "GO",
                sourceRootsRevalidated: true,
                exactArtifactBytesMatched: true,
            });
            const forgedSidecar = JSON.parse(JSON.stringify(built.sidecar));
            forgedSidecar.records[0].characterClass.raw = "self-consistent-but-not-source-bound";
            const forged = (0, structural_sidecar_validator_1.materializeCharacterStructuralSidecar)(forgedSidecar, built.coverage);
            await (0, structural_sidecar_run_1.writeCharacterStructuralSidecarArtifacts)(forgedRoot, forged);
            await (0, structural_sidecar_validator_1.validateCharacterStructuralSidecarArtifactIntegrityOnly)(forgedRoot);
            await (0, assert_1.rejects)((0, structural_sidecar_validator_1.validateCharacterStructuralSidecarArtifact)({ artifactRoot: forgedRoot, k2Root, productiveRoot }), /source-bound artifact mismatch: canonical raw payload/);
        }
        finally {
            await (0, promises_1.rm)(temporary, { recursive: true, force: true });
        }
    });
    it("rejects a junction output root when the environment permits it", async function () {
        const temporary = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "dokkan-k32-junction-"));
        const target = (0, path_1.join)(temporary, "target");
        const linked = (0, path_1.join)(temporary, "linked");
        await (0, promises_1.mkdir)(target);
        try {
            const kind = process.platform === "win32" ? "junction" : "dir";
            try {
                await (0, promises_1.symlink)(target, linked, kind);
            }
            catch (error) {
                if (["EPERM", "EACCES", "UNKNOWN"].includes(error?.code)) {
                    this.skip();
                    return;
                }
                throw error;
            }
            await (0, assert_1.rejects)((0, structural_sidecar_run_1.validateCharacterStructuralOutputRoot)(linked), /non-link|junction/);
        }
        finally {
            await (0, promises_1.rm)(temporary, { recursive: true, force: true });
        }
    });
});
//# sourceMappingURL=structural-sidecar.spec.js.map