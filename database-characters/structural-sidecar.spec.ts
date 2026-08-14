import { deepStrictEqual, equal, rejects, throws } from "assert";
import { createHash } from "crypto";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import type { DatabaseCharacterTaxonomyDataset } from "./taxonomy-contract";
import { buildCharacterStructuralSidecar } from "./structural-sidecar-builder";
import {
    CHARACTER_STRUCTURAL_SIDECAR_FILES,
    CHARACTER_STRUCTURAL_SIDECAR_SOURCE_PIN,
    CharacterStructuralProductiveCoverage,
} from "./structural-sidecar-contract";
import {
    indexProductiveCardIds,
    loadCharacterStructuralSidecarSource,
    validateCharacterStructuralTaxonomy,
    validateCharacterStructuralK2Manifest,
    validateCharacterStructuralProductiveManifest,
} from "./structural-sidecar-source";
import {
    parseCharacterStructuralSidecarCli,
    validateCharacterStructuralOutputRoot,
    writeCharacterStructuralSidecarArtifacts,
} from "./structural-sidecar-run";
import {
    materializeCharacterStructuralSidecar,
    pinnedCharacterStructuralSidecarLineage,
    validateCharacterStructuralSidecarArtifact,
    validateCharacterStructuralSidecarArtifactIntegrityOnly,
} from "./structural-sidecar-validator";

const hash = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");

function label(table: "card_categories" | "link_skills", id: string) {
    return { value: `${table}-${id}`, sourceLocale: "global_snapshot_default" as const, source: { table, rowId: id, column: "name" } };
}

function taxonomy(cards: any[], categoryIds = ["1", "2"], linkIds = ["10", "11"]): DatabaseCharacterTaxonomyDataset {
    const pin = CHARACTER_STRUCTURAL_SIDECAR_SOURCE_PIN;
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

function card(cardId: string, categories: any[] = [], links: any[] = []) {
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

function productive(cardIds: string[] = []): CharacterStructuralProductiveCoverage {
    return { topLevelCount: cardIds.length, occurrenceCount: cardIds.length, cardIds: new Set(cardIds) };
}

function k2Manifest(): any {
    const pin = CHARACTER_STRUCTURAL_SIDECAR_SOURCE_PIN;
    return {
        schemaVersion: 1, contractVersion: pin.k2.contractVersion, generatedAt: pin.k2.generatedAt,
        fileName: pin.k2.payloadFile, compression: "gzip", sha256: pin.k2.payloadSha256,
        sizeBytes: pin.k2.payloadSizeBytes, uncompressedSizeBytes: pin.k2.uncompressedSizeBytes,
        sourceSnapshotVersion: pin.snapshotVersion, sourceDatabaseSha256: pin.k2.databaseSha256, sourceDb1ArtifactSha256: pin.k2.db1ArtifactSha256,
        coverageFile: pin.k2.coverageFile, coverageSha256: pin.k2.coverageSha256, coverageSizeBytes: pin.k2.coverageSizeBytes,
        validationFile: pin.k2.validationFile, validationSha256: pin.k2.validationSha256, validationSizeBytes: pin.k2.validationSizeBytes,
    };
}

function productiveManifest(): any {
    const pin = CHARACTER_STRUCTURAL_SIDECAR_SOURCE_PIN.productiveCharacters;
    return {
        schemaVersion: 1, datasetVersion: pin.datasetVersion, generatedAt: pin.datasetVersion, fileName: pin.manifestPayloadFile,
        compression: "gzip", sha256: pin.payloadSha256, sizeBytes: pin.payloadSizeBytes,
        uncompressedSizeBytes: pin.uncompressedSizeBytes, characterCount: pin.topLevelCount,
    };
}

function fullPinnedFixture() {
    const pin = CHARACTER_STRUCTURAL_SIDECAR_SOURCE_PIN;
    const categories = Array.from({ length: pin.k2.categoryCount }, (_, index) => String(index + 1));
    const links = Array.from({ length: pin.k2.linkCount }, (_, index) => String(index + 1));
    let relationRow = 1;
    const cards = Array.from({ length: pin.k2.cardCount }, (_, index) => {
        const cardId = String(index + 1);
        const categoryCount = 9 + (index < 2_241 ? 1 : 0);
        const linkCount = 5 + (index < 5_223 ? 1 : 0);
        return card(cardId,
            Array.from({ length: categoryCount }, (_, offset) => ({
                categoryId: categories[(index + offset) % categories.length], relationRowId: String(relationRow++), status: "supported",
            })),
            Array.from({ length: linkCount }, (_, offset) => ({
                slot: offset + 1, linkSkillId: links[(index + offset) % links.length], status: "supported", sourceColumn: `link_skill${offset + 1}_id`,
            })),
        );
    });
    const covered = Array.from({ length: pin.productiveCharacters.databaseCoveredCardCount }, (_, index) => String(index + 1));
    const productiveCoverage: CharacterStructuralProductiveCoverage = {
        topLevelCount: pin.productiveCharacters.topLevelCount,
        occurrenceCount: pin.productiveCharacters.uniqueCardIdCount,
        cardIds: new Set([...covered, ...pin.productiveCharacters.outsideDatabaseCardIds]),
    };
    return buildCharacterStructuralSidecar(taxonomy(cards, categories, links), productiveCoverage, pinnedCharacterStructuralSidecarLineage());
}

describe("K32 compact structural identity sidecar", () => {
    it("is default-off and requires every caller-supplied root exactly once", () => {
        const valid = ["--opt-in-k32", "--k2-root", "K2", "--productive-root", "current", "--output-root", "output"];
        throws(() => parseCharacterStructuralSidecarCli([]), /explicit --opt-in-k32/);
        throws(() => parseCharacterStructuralSidecarCli(valid.slice(0, -2)), /requires --output-root/);
        throws(() => parseCharacterStructuralSidecarCli([...valid, "--k2-root", "other"]), /duplicate --k2-root/);
        throws(() => parseCharacterStructuralSidecarCli([...valid, "--unknown"]), /unsupported argument/);
        deepStrictEqual(parseCharacterStructuralSidecarCli(valid), {
            optIn: true, k2Root: "K2", productiveRoot: "current", outputRoot: "output",
        });
    });

    it("requires artifact, K2 and productive roots for authoritative validation", async () => {
        await rejects(
            validateCharacterStructuralSidecarArtifact({ artifactRoot: "", k2Root: "", productiveRoot: "" }),
            /requires artifactRoot, k2Root and productiveRoot/,
        );
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
        const result = buildCharacterStructuralSidecar(source, productive(["100"]), pinnedCharacterStructuralSidecarLineage()).sidecar.records[0];
        deepStrictEqual(result.categories.assignments.map(item => [item.categoryId, item.relationRowId]), [["2", "20"], ["1", "21"], ["2", "22"]]);
        deepStrictEqual(result.links.entries.map(item => [item.slot, item.linkSkillId, item.sourceColumn]), [[2, "11", "link_skill2_id"], [5, "10", "link_skill5_id"]]);
    });

    it("fails duplicate key/dictionary identities closed without deduplicating assignments", () => {
        const duplicateCards = taxonomy([card("100"), card("100")]);
        throws(() => buildCharacterStructuralSidecar(duplicateCards, productive(), pinnedCharacterStructuralSidecarLineage()), /duplicate K2 cardId/);
        const duplicateCategories = taxonomy([card("100")], ["1", "1"]);
        throws(() => buildCharacterStructuralSidecar(duplicateCategories, productive(), pinnedCharacterStructuralSidecarLineage()), /duplicate K2 category dictionary ID/);
        const duplicateLinks = taxonomy([card("100")], ["1"], ["10", "10"]);
        throws(() => buildCharacterStructuralSidecar(duplicateLinks, productive(), pinnedCharacterStructuralSidecarLineage()), /duplicate K2 link dictionary ID/);
    });

    it("keeps missing dictionary mappings presentation-only and explicit", () => {
        const source = taxonomy([card("100", [{ categoryId: "999", relationRowId: "1", status: "supported" }], [
            { slot: 1, linkSkillId: "998", status: "supported", sourceColumn: "link_skill1_id" },
        ])]);
        const record = buildCharacterStructuralSidecar(source, productive(), pinnedCharacterStructuralSidecarLineage()).sidecar.records[0];
        deepStrictEqual(record.categories.assignments[0].labelEvidence, { status: "unknown", reason: "dictionary_mapping_missing" });
        deepStrictEqual(record.links.entries[0].labelEvidence, { status: "unknown", reason: "dictionary_mapping_missing" });
        equal(record.categories.status, "supported");
        equal(record.links.status, "supported");
    });

    it("distinguishes empty container provenance from absent/unproved fields", () => {
        const empty = card("100");
        const absent: any = card("101");
        delete absent.categoryAssignments;
        delete absent.links;
        const records = buildCharacterStructuralSidecar(taxonomy([empty, absent]), productive(), pinnedCharacterStructuralSidecarLineage()).sidecar.records;
        equal(records[0].categories.state, "empty_with_container_provenance_absence_unproved");
        equal(records[0].categories.containerProvenance?.cardId, "100");
        equal(records[0].categories.status, "unknown");
        equal(records[1].categories.state, "absent_unproved");
        equal(records[1].categories.containerProvenance, null);
        equal(records[1].links.state, "absent_unproved");
    });

    it("rejects malformed pinned lineage, traversal, absolute members and ambiguous current card IDs", () => {
        validateCharacterStructuralK2Manifest(k2Manifest());
        validateCharacterStructuralProductiveManifest(productiveManifest());
        throws(() => validateCharacterStructuralK2Manifest({ ...k2Manifest(), sha256: "0".repeat(64) }), /lineage changed/);
        throws(() => validateCharacterStructuralK2Manifest({ ...k2Manifest(), fileName: "../database-characters-k2-taxonomy.json.gz" }), /lineage changed/);
        throws(() => validateCharacterStructuralProductiveManifest({ ...productiveManifest(), fileName: "C:\\escape\\characters.json.gz" }), /lineage changed/);
        throws(() => validateCharacterStructuralProductiveManifest({ ...productiveManifest(), characterCount: 1 }), /lineage changed/);
        throws(() => validateCharacterStructuralTaxonomy(taxonomy([card("100")])), /cardinality changed/);
        throws(() => indexProductiveCardIds([{ id: "100" }, { id: "100" }]), /ambiguous productive cardId 100/);
        throws(() => indexProductiveCardIds([{ id: "100", transformations: [{ name: "missing id" }] }]), /malformed productive cardId/);
    });

    it("writes deterministic canonical gzip/metadata and rejects integrity metadata mutation", async function () {
        this.timeout(30_000);
        const temporary = await mkdtemp(join(tmpdir(), "dokkan-k32-artifact-"));
        const firstRoot = join(temporary, "first");
        const secondRoot = join(temporary, "second");
        await Promise.all([mkdir(firstRoot), mkdir(secondRoot)]);
        try {
            const built = fullPinnedFixture();
            const first = materializeCharacterStructuralSidecar(built.sidecar, built.coverage);
            const second = materializeCharacterStructuralSidecar(built.sidecar, built.coverage);
            equal(first.raw.equals(second.raw), true);
            equal(first.gzip.equals(second.gzip), true);
            equal(first.manifestBytes.equals(second.manifestBytes), true);
            await writeCharacterStructuralSidecarArtifacts(firstRoot, first);
            await writeCharacterStructuralSidecarArtifacts(secondRoot, second);
            const validated = await validateCharacterStructuralSidecarArtifactIntegrityOnly(firstRoot);
            equal(validated.sidecar.records.length, CHARACTER_STRUCTURAL_SIDECAR_SOURCE_PIN.k2.cardCount);
            equal(validated.coverage.productiveCardIdCoverage.databaseCoveredCardCount, 1_623);
            deepStrictEqual(validated.validation.safety, {
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
            deepStrictEqual(validated.validation.readiness, {
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
            await rejects(writeCharacterStructuralSidecarArtifacts(firstRoot, first), /output already exists/);

            const validationPath = join(firstRoot, CHARACTER_STRUCTURAL_SIDECAR_FILES.validation);
            const manifestPath = join(firstRoot, CHARACTER_STRUCTURAL_SIDECAR_FILES.manifest);
            const validation: any = JSON.parse((await readFile(validationPath)).toString("utf8"));
            validation.readiness.publication = "GO";
            const validationBytes = Buffer.from(`${JSON.stringify(validation, null, 2)}\n`, "utf8");
            const manifest: any = JSON.parse((await readFile(manifestPath)).toString("utf8"));
            manifest.validationSha256 = hash(validationBytes);
            manifest.validationSizeBytes = validationBytes.length;
            await Promise.all([
                writeFile(validationPath, validationBytes),
                writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`),
            ]);
            await rejects(validateCharacterStructuralSidecarArtifactIntegrityOnly(firstRoot), /validation metadata rejected/);
        } finally { await rm(temporary, { recursive: true, force: true }); }
    });

    it("binds authoritative validation to the explicit pinned K2 and productive roots", async function () {
        this.timeout(120_000);
        const k2Root = process.env.K32_TEST_K2_ROOT;
        const productiveRoot = process.env.K32_TEST_PRODUCTIVE_ROOT;
        if (!k2Root || !productiveRoot) { this.skip(); return; }
        const temporary = await mkdtemp(join(tmpdir(), "dokkan-k32-source-bound-"));
        const exactRoot = join(temporary, "exact");
        const forgedRoot = join(temporary, "forged");
        await Promise.all([mkdir(exactRoot), mkdir(forgedRoot)]);
        try {
            const source = await loadCharacterStructuralSidecarSource({ k2Root, productiveRoot });
            const built = buildCharacterStructuralSidecar(source.taxonomy, source.productive, source.lineage);
            const exact = materializeCharacterStructuralSidecar(built.sidecar, built.coverage);
            await writeCharacterStructuralSidecarArtifacts(exactRoot, exact);
            const validated = await validateCharacterStructuralSidecarArtifact({ artifactRoot: exactRoot, k2Root, productiveRoot });
            equal(validated.manifest.sha256, exact.manifest.sha256);
            deepStrictEqual(validated.sourceBoundValidation, {
                status: "GO",
                sourceRootsRevalidated: true,
                exactArtifactBytesMatched: true,
            });

            const forgedSidecar = JSON.parse(JSON.stringify(built.sidecar));
            forgedSidecar.records[0].characterClass.raw = "self-consistent-but-not-source-bound";
            const forged = materializeCharacterStructuralSidecar(forgedSidecar, built.coverage);
            await writeCharacterStructuralSidecarArtifacts(forgedRoot, forged);
            await validateCharacterStructuralSidecarArtifactIntegrityOnly(forgedRoot);
            await rejects(
                validateCharacterStructuralSidecarArtifact({ artifactRoot: forgedRoot, k2Root, productiveRoot }),
                /source-bound artifact mismatch: canonical raw payload/,
            );
        } finally { await rm(temporary, { recursive: true, force: true }); }
    });

    it("rejects a junction output root when the environment permits it", async function () {
        const temporary = await mkdtemp(join(tmpdir(), "dokkan-k32-junction-"));
        const target = join(temporary, "target");
        const linked = join(temporary, "linked");
        await mkdir(target);
        try {
            const kind = process.platform === "win32" ? "junction" : "dir";
            try { await symlink(target, linked, kind); }
            catch (error: any) { if (["EPERM", "EACCES", "UNKNOWN"].includes(error?.code)) { this.skip(); return; } throw error; }
            await rejects(validateCharacterStructuralOutputRoot(linked), /non-link|junction/);
        } finally { await rm(temporary, { recursive: true, force: true }); }
    });
});
