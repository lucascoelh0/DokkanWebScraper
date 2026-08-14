import { deepStrictEqual, equal, rejects, throws } from "assert";
import { resolveCharacterInputFile } from "./artifact-path";
import { CHARACTER_REFRESH_PROFILE } from "./refresh-contract";
import type { CharacterFieldProjection, CharacterShadowField } from "./shadow-contract";
import type { DatabaseCharacterTaxonomyDataset } from "./taxonomy-contract";
import {
    buildStructuralAuthorityAudit,
    compareCharacterClass,
    compareStructuralCollection,
    indexProductiveCharacterRecords,
} from "./structural-authority-builder";
import { STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN, StructuralAuthorityLineage } from "./structural-authority-contract";
import { measureStructuralAuthorityReportIdentity, parseStructuralAuthorityCli } from "./structural-authority-run";
import { validateStructuralAuthorityK2Manifest, validateStructuralAuthorityProductiveManifest } from "./structural-authority-source";

const k2 = CHARACTER_REFRESH_PROFILE.sidecars.find(item => item.gate === "k2")!;
const lineage: StructuralAuthorityLineage = {
    profileId: CHARACTER_REFRESH_PROFILE.profileId,
    snapshotVersion: CHARACTER_REFRESH_PROFILE.snapshotVersion,
    k0: { contractVersion: "1.0.0", sha256: CHARACTER_REFRESH_PROFILE.sidecars[0].artifact.sha256, sizeBytes: CHARACTER_REFRESH_PROFILE.sidecars[0].artifact.sizeBytes },
    k2: { contractVersion: "1.0.0", manifestSha256: k2.manifest.sha256, manifestSizeBytes: k2.manifest.sizeBytes, sha256: k2.artifact.sha256, sizeBytes: k2.artifact.sizeBytes, uncompressedSizeBytes: k2.artifact.uncompressedSizeBytes },
    k11: { contractVersion: "1.0.0", manifestSha256: "a".repeat(64), manifestSizeBytes: 1, sha256: "b".repeat(64), sizeBytes: 1, uncompressedSha256: "c".repeat(64), uncompressedSizeBytes: 1 },
    productiveCharacters: {
        contract: "Character[]", datasetVersion: STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.datasetVersion,
        manifestFile: "characters-manifest.json", manifestSha256: STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.manifestSha256,
        manifestSizeBytes: STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.manifestSizeBytes, payloadFile: "characters.json.gz",
        payloadSha256: STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.payloadSha256, payloadSizeBytes: STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.payloadSizeBytes,
        uncompressedSizeBytes: STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.uncompressedSizeBytes, topLevelCount: 1,
    },
};

function projection(field: CharacterShadowField, databaseValue: unknown, status: "supported" | "partial" | "unknown" = "supported", stateKey = "100:initial"): CharacterFieldProjection {
    const stateId = "card-state:100:initial";
    return {
        cardId: "100", recordKind: "collectable", characterId: "10", stateId, releaseState: "initial", growthRowId: null,
        productionJoin: { status: "joined", externalId: "100", comparisonState: { stateKey, releaseState: "initial", source: "initial" } as any },
        fyiJoin: { status: "joined", externalId: "100", comparisonState: { stateKey, releaseState: "initial", source: "initial" } as any },
        field, characterField: field === "categoryIds" || field === "linkIds" ? null : field as any,
        databaseValue, externalValue: { production: null, fyi: null }, effectiveShadowValue: null,
        evidenceStatus: status, authority: "database_candidate", comparison: "agreement",
        sourceComparisons: { production: "agreement", fyi: "agreement" }, fallbackReason: null,
        provenance: [{
            sidecar: "k2", sidecarSha256: k2.artifact.sha256, sourceSnapshotVersion: CHARACTER_REFRESH_PROFILE.snapshotVersion,
            table: field === "categories" || field === "categoryIds" ? "card_card_categories" : "cards",
            rowId: "100", column: String(field), sourceState: { stateId, sourceStateKey: stateKey, releaseState: "initial", growthRowId: null },
        }],
    };
}

function taxonomy(): DatabaseCharacterTaxonomyDataset {
    return {
        schemaVersion: 1, contract: "dokkan-database-characters-taxonomy", contractVersion: "1.0.0", generatedAt: CHARACTER_REFRESH_PROFILE.generatedAt,
        source: { snapshotVersion: CHARACTER_REFRESH_PROFILE.snapshotVersion, databaseSha256: CHARACTER_REFRESH_PROFILE.sqlite.sha256, db1ArtifactSha256: CHARACTER_REFRESH_PROFILE.db1.sha256 },
        localeAudit: { provedLocales: ["global_snapshot_default"], otherLocales: "unknown", presentationTextAsIdentity: false },
        rarityValues: [], typeValues: [], classValues: ["Super", "Extreme", "unawakened"],
        categories: [
            { id: "1", label: { value: "Alpha", sourceLocale: "global_snapshot_default", source: { table: "card_categories", rowId: "1", column: "name" } } },
            { id: "2", label: { value: "Beta", sourceLocale: "global_snapshot_default", source: { table: "card_categories", rowId: "2", column: "name" } } },
        ],
        links: [
            { id: "10", label: { value: "Link A", sourceLocale: "global_snapshot_default", source: { table: "link_skills", rowId: "10", column: "name" } }, levels: [] },
            { id: "11", label: { value: "Link B", sourceLocale: "global_snapshot_default", source: { table: "link_skills", rowId: "11", column: "name" } }, levels: [] },
        ],
        cards: [{
            cardId: "100", labels: { cardTitle: { value: "Ignored Name", sourceLocale: "global_snapshot_default", source: { table: "cards", rowId: "100", column: "name" } } },
            rarity: { raw: 4, value: "UR", status: "supported" }, originalRarity: { status: "supported", sourceCardIds: ["100"], zRouteRowIds: [], cycleDetected: false, rawValues: [4], values: ["UR"] },
            type: { raw: 0, value: "AGL", status: "supported" }, characterClass: { raw: 0, value: "Super", status: "supported" },
            categoryAssignments: [
                { categoryId: "1", relationRowId: "10001", status: "supported" },
                { categoryId: "2", relationRowId: "10002", status: "supported" },
            ],
            links: [
                { slot: 1, linkSkillId: "10", status: "supported", sourceColumn: "link_skill1_id" },
                { slot: 2, linkSkillId: "11", status: "supported", sourceColumn: "link_skill2_id" },
            ],
        }],
        sourceAudit: { linkLevelRowIds: [], linkEfficacyRowIds: [], unjoinedLinkLevelRowIds: [], unjoinedLinkEfficacyRowIds: [] },
    };
}

const fields = () => [
    projection("characterClass", "Super"),
    projection("categoryIds", ["1", "2"]),
    projection("categories", ["Alpha", "Beta"]),
    projection("linkIds", ["10", "11"]),
    projection("links", ["Link A", "Link B"]),
];

const validCliArgs = [
    "--opt-in-k29-k31",
    "--shadow-root", "D:/evidence/shadow",
    "--k2-root", "D:/evidence/k2",
    "--productive-root", "D:/evidence/productive",
];

describe("K29-K31 structural authority audit", () => {
    it("is default-off and requires exactly one explicit opt-in", () => {
        throws(() => parseStructuralAuthorityCli([]), /explicit --opt-in-k29-k31/);
        throws(() => parseStructuralAuthorityCli([...validCliArgs, "--opt-in-k29-k31"]), /explicit --opt-in-k29-k31/);
        const parsed = parseStructuralAuthorityCli(validCliArgs);
        equal(parsed.optIn, true);
        equal(parsed.shadowRoot, "D:/evidence/shadow");
    });

    it("requires every caller-supplied evidence root", () => {
        throws(() => parseStructuralAuthorityCli(validCliArgs.filter((_, index) => index !== 1 && index !== 2)), /requires --shadow-root/);
        throws(() => parseStructuralAuthorityCli(validCliArgs.filter((_, index) => index !== 3 && index !== 4)), /requires --k2-root/);
        throws(() => parseStructuralAuthorityCli(validCliArgs.filter((_, index) => index !== 5 && index !== 6)), /requires --productive-root/);
    });

    it("rejects duplicate root arguments and missing values", () => {
        throws(() => parseStructuralAuthorityCli([...validCliArgs, "--shadow-root", "D:/other"]), /duplicate --shadow-root/);
        throws(() => parseStructuralAuthorityCli([...validCliArgs, "--k2-root", "D:/other"]), /duplicate --k2-root/);
        throws(() => parseStructuralAuthorityCli([...validCliArgs, "--productive-root", "D:/other"]), /duplicate --productive-root/);
        throws(() => parseStructuralAuthorityCli([...validCliArgs.slice(0, 1), "--shadow-root", ...validCliArgs.slice(3)]), /missing value for --shadow-root/);
        throws(() => parseStructuralAuthorityCli([...validCliArgs.slice(0, 3), "--k2-root", ...validCliArgs.slice(5)]), /missing value for --k2-root/);
        throws(() => parseStructuralAuthorityCli([...validCliArgs.slice(0, 5), "--productive-root"]), /missing value for --productive-root/);
    });

    it("preserves order differences separately from equal set membership", () => {
        const result = compareStructuralCollection(["1", "2"], ["Alpha", "Beta"], ["Beta", "Alpha"]);
        equal(result.classification, "representation_mismatch");
        deepStrictEqual(result.comparison, {
            ordered: "different", set: "equal", databaseDuplicateIds: [], databaseDuplicateLabels: [], productiveDuplicateLabels: [],
        });
    });

    it("excludes duplicate structural IDs from supported candidates", () => {
        const result = compareStructuralCollection(["1", "1"], ["Alpha", "Alpha"], ["Alpha"]);
        equal(result.classification, "unknown");
        deepStrictEqual(result.comparison.databaseDuplicateIds, ["1"]);
        equal(result.exclusions.includes("duplicate_structural_ids"), true);
    });

    it("keeps missing ID-to-label mappings unknown and IDs-only", () => {
        const result = compareStructuralCollection(["1", "999"], null, ["Alpha", "Missing"]);
        equal(result.classification, "unknown");
        equal(result.exclusions.includes("missing_id_to_label_projection"), true);
    });

    it("fails ambiguous structural state bindings closed", () => {
        const productive = indexProductiveCharacterRecords([{ id: "parent", transformations: [
            { id: "100", characterClass: "Super", links: ["Link A"] },
            { id: "100", characterClass: "Extreme", links: ["Link B"] },
        ] }]);
        const report = buildStructuralAuthorityAudit(fields(), taxonomy(), productive, lineage, STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.datasetVersion);
        equal(productive.ambiguous.has("100"), true);
        equal(report.facts.every(fact => fact.classification === "unjoinable" && fact.candidate === null), true);
    });

    it("preserves absent versus explicit-null productive fields during ambiguity detection", () => {
        const productive = indexProductiveCharacterRecords([{ id: "parent", transformations: [
            { id: "100", characterClass: "Super", categories: null, links: ["Link A", "Link B"] },
            { id: "100", characterClass: "Super", links: ["Link A", "Link B"] },
        ] }]);
        equal(productive.selected.has("100"), false);
        deepStrictEqual(productive.ambiguous.get("100"), ["$[0].transformations[0]", "$[0].transformations[1]"]);
    });

    it("distinguishes label representation mismatch from a true scalar conflict", () => {
        equal(compareCharacterClass("unawakened", "Super").classification, "representation_mismatch");
        equal(compareCharacterClass("Super", "Extreme").classification, "confirmed_conflict");
        equal(compareStructuralCollection(["1", "2"], ["Alpha", "Beta"], ["Beta", "Alpha"]).classification, "representation_mismatch");
        const labelSetDifference = compareStructuralCollection(["1", "2"], ["Alpha", "Beta"], ["Alpha", "Gamma"]);
        equal(labelSetDifference.classification, "representation_mismatch");
        equal(labelSetDifference.exclusions.includes("label_set_difference_without_productive_structural_ids"), true);
    });

    it("emits byte-deterministic supported-only facts without mutating productive values", () => {
        const productiveCharacters = [{ id: "100", name: "Never an identity", characterClass: "Super", categories: ["Alpha", "Beta"], links: ["Link A", "Link B"] }];
        const first = buildStructuralAuthorityAudit(fields(), taxonomy(), indexProductiveCharacterRecords(productiveCharacters), lineage, STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.datasetVersion);
        const second = buildStructuralAuthorityAudit(fields(), taxonomy(), indexProductiveCharacterRecords(productiveCharacters), lineage, STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.datasetVersion);
        equal(JSON.stringify(first), JSON.stringify(second));
        equal(first.facts.every(fact => fact.classification === "agreement" && fact.candidate !== null), true);
        equal(first.facts.every(fact => fact.evidenceBinding === "card_id_state_id_state_key"), true);
        equal(first.facts.every(fact => fact.productive.comparisonBinding === "card_id_only" && fact.productive.stateBinding === "unavailable"), true);
        equal(first.facts.every(fact => fact.productive.fieldPresent === true), true);
        equal(first.facts.every(fact => fact.candidate?.characterPatchable === false), true);
        equal(first.fields.every(field => field.authorityEligibleCandidateCount === 0 && field.characterPatchableCandidateCount === 0), true);
        deepStrictEqual(productiveCharacters[0].categories, ["Alpha", "Beta"]);
        equal(first.readiness.audit, "GO");
        equal(first.readiness.authorityPromotion, "NO-GO");
    });

    it("does not infer productive state binding or Character patchability from the same cardId", () => {
        const productive = indexProductiveCharacterRecords([{
            id: "100", characterClass: "Super", categories: ["Alpha", "Beta"], links: ["Link A", "Link B"],
        }]);
        const report = buildStructuralAuthorityAudit(fields(), taxonomy(), productive, lineage, STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.datasetVersion);
        const candidate = report.facts.find(fact => fact.field === "characterClass")!.candidate!;
        equal(report.facts.every(fact => fact.productive.cardId === "100"), true);
        equal(report.facts.every(fact => fact.productive.comparisonBinding === "card_id_only"), true);
        equal(report.facts.every(fact => fact.productive.stateBinding === "unavailable"), true);
        equal(candidate.authorityEligibility, "ineligible_unproved_productive_state");
        equal(candidate.projectedCharacterValue, null);
        equal(candidate.characterPatchable, false);
    });

    it("keeps assignment and dictionary-row provenance for every projected collection label", () => {
        const productive = indexProductiveCharacterRecords([{
            id: "100", characterClass: "Super", categories: ["Alpha", "Beta"], links: ["Link A", "Link B"],
        }]);
        const report = buildStructuralAuthorityAudit(fields(), taxonomy(), productive, lineage, STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.datasetVersion);
        const categories = report.facts.find(fact => fact.field === "categories")!;
        const links = report.facts.find(fact => fact.field === "links")!;
        deepStrictEqual(categories.provenance.k2.filter(value => value.role === "dictionary_label"), [
            { role: "dictionary_label", structuralId: "1", table: "card_categories", rowId: "1", column: "name" },
            { role: "dictionary_label", structuralId: "2", table: "card_categories", rowId: "2", column: "name" },
        ]);
        deepStrictEqual(links.provenance.k2.filter(value => value.role === "dictionary_label"), [
            { role: "dictionary_label", structuralId: "10", table: "link_skills", rowId: "10", column: "name" },
            { role: "dictionary_label", structuralId: "11", table: "link_skills", rowId: "11", column: "name" },
        ]);
        deepStrictEqual(categories.provenance.k2.filter(value => value.role === "assignment").map(value => value.structuralId), ["1", "2"]);
        deepStrictEqual(links.provenance.k2.filter(value => value.role === "assignment").map(value => value.structuralId), ["10", "11"]);
    });

    it("keeps collection gains IDs-only when the productive record has no target field", () => {
        const productive = indexProductiveCharacterRecords([{ id: "parent", transformations: [{ id: "100", characterClass: "Super", links: ["Link A", "Link B"] }] }]);
        const report = buildStructuralAuthorityAudit(fields(), taxonomy(), productive, lineage, STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.datasetVersion);
        const candidate = report.facts.find(fact => fact.field === "categories")!.candidate!;
        equal(candidate.representation, "audit_only_unbound");
        deepStrictEqual(candidate.databaseValue, ["1", "2"]);
        equal(candidate.projectedCharacterValue, null);
        equal(candidate.authorityEligibility, "ineligible_unproved_productive_state");
        equal(candidate.characterPatchable, false);
    });

    it("samples and enforces RSS while the serialized report remains live", () => {
        const report = buildStructuralAuthorityAudit(fields(), taxonomy(), indexProductiveCharacterRecords([{
            id: "100", characterClass: "Super", categories: ["Alpha", "Beta"], links: ["Link A", "Link B"],
        }]), lineage, STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.datasetVersion);
        let samples = 0;
        const identity = measureStructuralAuthorityReportIdentity(report, () => { samples++; });
        equal(samples, 1);
        equal(identity.sizeBytes > 0, true);
        throws(() => measureStructuralAuthorityReportIdentity(report, () => { throw new Error("sampled RSS limit"); }), /sampled RSS limit/);
    });

    it("rejects malformed lineage and path traversal", async () => {
        throws(() => validateStructuralAuthorityK2Manifest({ fileName: "../database-characters-k2-taxonomy.json.gz" }), /lineage changed/);
        throws(() => validateStructuralAuthorityProductiveManifest({ ...STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN, schemaVersion: 1, generatedAt: STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.datasetVersion, compression: "gzip", fileName: "../characters.json.gz", sha256: STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.payloadSha256, sizeBytes: STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.payloadSizeBytes, uncompressedSizeBytes: STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.uncompressedSizeBytes, characterCount: STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.characterCount }), /lineage changed/);
        await rejects(resolveCharacterInputFile("D:/controlled", "../characters.json.gz", "characters.json.gz"));
        await rejects(resolveCharacterInputFile("D:/controlled", "D:/escape/characters.json.gz", "characters.json.gz"));
    });
});
