"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const artifact_path_1 = require("./artifact-path");
const refresh_contract_1 = require("./refresh-contract");
const structural_authority_builder_1 = require("./structural-authority-builder");
const structural_authority_contract_1 = require("./structural-authority-contract");
const structural_authority_run_1 = require("./structural-authority-run");
const structural_authority_source_1 = require("./structural-authority-source");
const k2 = refresh_contract_1.CHARACTER_REFRESH_PROFILE.sidecars.find(item => item.gate === "k2");
const lineage = {
    profileId: refresh_contract_1.CHARACTER_REFRESH_PROFILE.profileId,
    snapshotVersion: refresh_contract_1.CHARACTER_REFRESH_PROFILE.snapshotVersion,
    k0: { contractVersion: "1.0.0", sha256: refresh_contract_1.CHARACTER_REFRESH_PROFILE.sidecars[0].artifact.sha256, sizeBytes: refresh_contract_1.CHARACTER_REFRESH_PROFILE.sidecars[0].artifact.sizeBytes },
    k2: { contractVersion: "1.0.0", manifestSha256: k2.manifest.sha256, manifestSizeBytes: k2.manifest.sizeBytes, sha256: k2.artifact.sha256, sizeBytes: k2.artifact.sizeBytes, uncompressedSizeBytes: k2.artifact.uncompressedSizeBytes },
    k11: { contractVersion: "1.0.0", manifestSha256: "a".repeat(64), manifestSizeBytes: 1, sha256: "b".repeat(64), sizeBytes: 1, uncompressedSha256: "c".repeat(64), uncompressedSizeBytes: 1 },
    productiveCharacters: {
        contract: "Character[]", datasetVersion: structural_authority_contract_1.STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.datasetVersion,
        manifestFile: "characters-manifest.json", manifestSha256: structural_authority_contract_1.STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.manifestSha256,
        manifestSizeBytes: structural_authority_contract_1.STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.manifestSizeBytes, payloadFile: "characters.json.gz",
        payloadSha256: structural_authority_contract_1.STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.payloadSha256, payloadSizeBytes: structural_authority_contract_1.STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.payloadSizeBytes,
        uncompressedSizeBytes: structural_authority_contract_1.STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.uncompressedSizeBytes, topLevelCount: 1,
    },
};
function projection(field, databaseValue, status = "supported", stateKey = "100:initial") {
    const stateId = "card-state:100:initial";
    return {
        cardId: "100", recordKind: "collectable", characterId: "10", stateId, releaseState: "initial", growthRowId: null,
        productionJoin: { status: "joined", externalId: "100", comparisonState: { stateKey, releaseState: "initial", source: "initial" } },
        fyiJoin: { status: "joined", externalId: "100", comparisonState: { stateKey, releaseState: "initial", source: "initial" } },
        field, characterField: field === "categoryIds" || field === "linkIds" ? null : field,
        databaseValue, externalValue: { production: null, fyi: null }, effectiveShadowValue: null,
        evidenceStatus: status, authority: "database_candidate", comparison: "agreement",
        sourceComparisons: { production: "agreement", fyi: "agreement" }, fallbackReason: null,
        provenance: [{
                sidecar: "k2", sidecarSha256: k2.artifact.sha256, sourceSnapshotVersion: refresh_contract_1.CHARACTER_REFRESH_PROFILE.snapshotVersion,
                table: field === "categories" || field === "categoryIds" ? "card_card_categories" : "cards",
                rowId: "100", column: String(field), sourceState: { stateId, sourceStateKey: stateKey, releaseState: "initial", growthRowId: null },
            }],
    };
}
function taxonomy() {
    return {
        schemaVersion: 1, contract: "dokkan-database-characters-taxonomy", contractVersion: "1.0.0", generatedAt: refresh_contract_1.CHARACTER_REFRESH_PROFILE.generatedAt,
        source: { snapshotVersion: refresh_contract_1.CHARACTER_REFRESH_PROFILE.snapshotVersion, databaseSha256: refresh_contract_1.CHARACTER_REFRESH_PROFILE.sqlite.sha256, db1ArtifactSha256: refresh_contract_1.CHARACTER_REFRESH_PROFILE.db1.sha256 },
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
        (0, assert_1.throws)(() => (0, structural_authority_run_1.parseStructuralAuthorityCli)([]), /explicit --opt-in-k29-k31/);
        (0, assert_1.throws)(() => (0, structural_authority_run_1.parseStructuralAuthorityCli)([...validCliArgs, "--opt-in-k29-k31"]), /explicit --opt-in-k29-k31/);
        const parsed = (0, structural_authority_run_1.parseStructuralAuthorityCli)(validCliArgs);
        (0, assert_1.equal)(parsed.optIn, true);
        (0, assert_1.equal)(parsed.shadowRoot, "D:/evidence/shadow");
    });
    it("requires every caller-supplied evidence root", () => {
        (0, assert_1.throws)(() => (0, structural_authority_run_1.parseStructuralAuthorityCli)(validCliArgs.filter((_, index) => index !== 1 && index !== 2)), /requires --shadow-root/);
        (0, assert_1.throws)(() => (0, structural_authority_run_1.parseStructuralAuthorityCli)(validCliArgs.filter((_, index) => index !== 3 && index !== 4)), /requires --k2-root/);
        (0, assert_1.throws)(() => (0, structural_authority_run_1.parseStructuralAuthorityCli)(validCliArgs.filter((_, index) => index !== 5 && index !== 6)), /requires --productive-root/);
    });
    it("rejects duplicate root arguments and missing values", () => {
        (0, assert_1.throws)(() => (0, structural_authority_run_1.parseStructuralAuthorityCli)([...validCliArgs, "--shadow-root", "D:/other"]), /duplicate --shadow-root/);
        (0, assert_1.throws)(() => (0, structural_authority_run_1.parseStructuralAuthorityCli)([...validCliArgs, "--k2-root", "D:/other"]), /duplicate --k2-root/);
        (0, assert_1.throws)(() => (0, structural_authority_run_1.parseStructuralAuthorityCli)([...validCliArgs, "--productive-root", "D:/other"]), /duplicate --productive-root/);
        (0, assert_1.throws)(() => (0, structural_authority_run_1.parseStructuralAuthorityCli)([...validCliArgs.slice(0, 1), "--shadow-root", ...validCliArgs.slice(3)]), /missing value for --shadow-root/);
        (0, assert_1.throws)(() => (0, structural_authority_run_1.parseStructuralAuthorityCli)([...validCliArgs.slice(0, 3), "--k2-root", ...validCliArgs.slice(5)]), /missing value for --k2-root/);
        (0, assert_1.throws)(() => (0, structural_authority_run_1.parseStructuralAuthorityCli)([...validCliArgs.slice(0, 5), "--productive-root"]), /missing value for --productive-root/);
    });
    it("preserves order differences separately from equal set membership", () => {
        const result = (0, structural_authority_builder_1.compareStructuralCollection)(["1", "2"], ["Alpha", "Beta"], ["Beta", "Alpha"]);
        (0, assert_1.equal)(result.classification, "representation_mismatch");
        (0, assert_1.deepStrictEqual)(result.comparison, {
            ordered: "different", set: "equal", databaseDuplicateIds: [], databaseDuplicateLabels: [], productiveDuplicateLabels: [],
        });
    });
    it("excludes duplicate structural IDs from supported candidates", () => {
        const result = (0, structural_authority_builder_1.compareStructuralCollection)(["1", "1"], ["Alpha", "Alpha"], ["Alpha"]);
        (0, assert_1.equal)(result.classification, "unknown");
        (0, assert_1.deepStrictEqual)(result.comparison.databaseDuplicateIds, ["1"]);
        (0, assert_1.equal)(result.exclusions.includes("duplicate_structural_ids"), true);
    });
    it("keeps missing ID-to-label mappings unknown and IDs-only", () => {
        const result = (0, structural_authority_builder_1.compareStructuralCollection)(["1", "999"], null, ["Alpha", "Missing"]);
        (0, assert_1.equal)(result.classification, "unknown");
        (0, assert_1.equal)(result.exclusions.includes("missing_id_to_label_projection"), true);
    });
    it("fails ambiguous structural state bindings closed", () => {
        const productive = (0, structural_authority_builder_1.indexProductiveCharacterRecords)([{ id: "parent", transformations: [
                    { id: "100", characterClass: "Super", links: ["Link A"] },
                    { id: "100", characterClass: "Extreme", links: ["Link B"] },
                ] }]);
        const report = (0, structural_authority_builder_1.buildStructuralAuthorityAudit)(fields(), taxonomy(), productive, lineage, structural_authority_contract_1.STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.datasetVersion);
        (0, assert_1.equal)(productive.ambiguous.has("100"), true);
        (0, assert_1.equal)(report.facts.every(fact => fact.classification === "unjoinable" && fact.candidate === null), true);
    });
    it("preserves absent versus explicit-null productive fields during ambiguity detection", () => {
        const productive = (0, structural_authority_builder_1.indexProductiveCharacterRecords)([{ id: "parent", transformations: [
                    { id: "100", characterClass: "Super", categories: null, links: ["Link A", "Link B"] },
                    { id: "100", characterClass: "Super", links: ["Link A", "Link B"] },
                ] }]);
        (0, assert_1.equal)(productive.selected.has("100"), false);
        (0, assert_1.deepStrictEqual)(productive.ambiguous.get("100"), ["$[0].transformations[0]", "$[0].transformations[1]"]);
    });
    it("distinguishes label representation mismatch from a true scalar conflict", () => {
        (0, assert_1.equal)((0, structural_authority_builder_1.compareCharacterClass)("unawakened", "Super").classification, "representation_mismatch");
        (0, assert_1.equal)((0, structural_authority_builder_1.compareCharacterClass)("Super", "Extreme").classification, "confirmed_conflict");
        (0, assert_1.equal)((0, structural_authority_builder_1.compareStructuralCollection)(["1", "2"], ["Alpha", "Beta"], ["Beta", "Alpha"]).classification, "representation_mismatch");
        const labelSetDifference = (0, structural_authority_builder_1.compareStructuralCollection)(["1", "2"], ["Alpha", "Beta"], ["Alpha", "Gamma"]);
        (0, assert_1.equal)(labelSetDifference.classification, "representation_mismatch");
        (0, assert_1.equal)(labelSetDifference.exclusions.includes("label_set_difference_without_productive_structural_ids"), true);
    });
    it("emits byte-deterministic supported-only facts without mutating productive values", () => {
        const productiveCharacters = [{ id: "100", name: "Never an identity", characterClass: "Super", categories: ["Alpha", "Beta"], links: ["Link A", "Link B"] }];
        const first = (0, structural_authority_builder_1.buildStructuralAuthorityAudit)(fields(), taxonomy(), (0, structural_authority_builder_1.indexProductiveCharacterRecords)(productiveCharacters), lineage, structural_authority_contract_1.STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.datasetVersion);
        const second = (0, structural_authority_builder_1.buildStructuralAuthorityAudit)(fields(), taxonomy(), (0, structural_authority_builder_1.indexProductiveCharacterRecords)(productiveCharacters), lineage, structural_authority_contract_1.STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.datasetVersion);
        (0, assert_1.equal)(JSON.stringify(first), JSON.stringify(second));
        (0, assert_1.equal)(first.facts.every(fact => fact.classification === "agreement" && fact.candidate !== null), true);
        (0, assert_1.equal)(first.facts.every(fact => fact.evidenceBinding === "card_id_state_id_state_key"), true);
        (0, assert_1.equal)(first.facts.every(fact => fact.productive.comparisonBinding === "card_id_only" && fact.productive.stateBinding === "unavailable"), true);
        (0, assert_1.equal)(first.facts.every(fact => fact.productive.fieldPresent === true), true);
        (0, assert_1.equal)(first.facts.every(fact => fact.candidate?.characterPatchable === false), true);
        (0, assert_1.equal)(first.fields.every(field => field.authorityEligibleCandidateCount === 0 && field.characterPatchableCandidateCount === 0), true);
        (0, assert_1.deepStrictEqual)(productiveCharacters[0].categories, ["Alpha", "Beta"]);
        (0, assert_1.equal)(first.readiness.audit, "GO");
        (0, assert_1.equal)(first.readiness.authorityPromotion, "NO-GO");
    });
    it("does not infer productive state binding or Character patchability from the same cardId", () => {
        const productive = (0, structural_authority_builder_1.indexProductiveCharacterRecords)([{
                id: "100", characterClass: "Super", categories: ["Alpha", "Beta"], links: ["Link A", "Link B"],
            }]);
        const report = (0, structural_authority_builder_1.buildStructuralAuthorityAudit)(fields(), taxonomy(), productive, lineage, structural_authority_contract_1.STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.datasetVersion);
        const candidate = report.facts.find(fact => fact.field === "characterClass").candidate;
        (0, assert_1.equal)(report.facts.every(fact => fact.productive.cardId === "100"), true);
        (0, assert_1.equal)(report.facts.every(fact => fact.productive.comparisonBinding === "card_id_only"), true);
        (0, assert_1.equal)(report.facts.every(fact => fact.productive.stateBinding === "unavailable"), true);
        (0, assert_1.equal)(candidate.authorityEligibility, "ineligible_unproved_productive_state");
        (0, assert_1.equal)(candidate.projectedCharacterValue, null);
        (0, assert_1.equal)(candidate.characterPatchable, false);
    });
    it("keeps assignment and dictionary-row provenance for every projected collection label", () => {
        const productive = (0, structural_authority_builder_1.indexProductiveCharacterRecords)([{
                id: "100", characterClass: "Super", categories: ["Alpha", "Beta"], links: ["Link A", "Link B"],
            }]);
        const report = (0, structural_authority_builder_1.buildStructuralAuthorityAudit)(fields(), taxonomy(), productive, lineage, structural_authority_contract_1.STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.datasetVersion);
        const categories = report.facts.find(fact => fact.field === "categories");
        const links = report.facts.find(fact => fact.field === "links");
        (0, assert_1.deepStrictEqual)(categories.provenance.k2.filter(value => value.role === "dictionary_label"), [
            { role: "dictionary_label", structuralId: "1", table: "card_categories", rowId: "1", column: "name" },
            { role: "dictionary_label", structuralId: "2", table: "card_categories", rowId: "2", column: "name" },
        ]);
        (0, assert_1.deepStrictEqual)(links.provenance.k2.filter(value => value.role === "dictionary_label"), [
            { role: "dictionary_label", structuralId: "10", table: "link_skills", rowId: "10", column: "name" },
            { role: "dictionary_label", structuralId: "11", table: "link_skills", rowId: "11", column: "name" },
        ]);
        (0, assert_1.deepStrictEqual)(categories.provenance.k2.filter(value => value.role === "assignment").map(value => value.structuralId), ["1", "2"]);
        (0, assert_1.deepStrictEqual)(links.provenance.k2.filter(value => value.role === "assignment").map(value => value.structuralId), ["10", "11"]);
    });
    it("keeps collection gains IDs-only when the productive record has no target field", () => {
        const productive = (0, structural_authority_builder_1.indexProductiveCharacterRecords)([{ id: "parent", transformations: [{ id: "100", characterClass: "Super", links: ["Link A", "Link B"] }] }]);
        const report = (0, structural_authority_builder_1.buildStructuralAuthorityAudit)(fields(), taxonomy(), productive, lineage, structural_authority_contract_1.STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.datasetVersion);
        const candidate = report.facts.find(fact => fact.field === "categories").candidate;
        (0, assert_1.equal)(candidate.representation, "audit_only_unbound");
        (0, assert_1.deepStrictEqual)(candidate.databaseValue, ["1", "2"]);
        (0, assert_1.equal)(candidate.projectedCharacterValue, null);
        (0, assert_1.equal)(candidate.authorityEligibility, "ineligible_unproved_productive_state");
        (0, assert_1.equal)(candidate.characterPatchable, false);
    });
    it("samples and enforces RSS while the serialized report remains live", () => {
        const report = (0, structural_authority_builder_1.buildStructuralAuthorityAudit)(fields(), taxonomy(), (0, structural_authority_builder_1.indexProductiveCharacterRecords)([{
                id: "100", characterClass: "Super", categories: ["Alpha", "Beta"], links: ["Link A", "Link B"],
            }]), lineage, structural_authority_contract_1.STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.datasetVersion);
        let samples = 0;
        const identity = (0, structural_authority_run_1.measureStructuralAuthorityReportIdentity)(report, () => { samples++; });
        (0, assert_1.equal)(samples, 1);
        (0, assert_1.equal)(identity.sizeBytes > 0, true);
        (0, assert_1.throws)(() => (0, structural_authority_run_1.measureStructuralAuthorityReportIdentity)(report, () => { throw new Error("sampled RSS limit"); }), /sampled RSS limit/);
    });
    it("rejects malformed lineage and path traversal", async () => {
        (0, assert_1.throws)(() => (0, structural_authority_source_1.validateStructuralAuthorityK2Manifest)({ fileName: "../database-characters-k2-taxonomy.json.gz" }), /lineage changed/);
        (0, assert_1.throws)(() => (0, structural_authority_source_1.validateStructuralAuthorityProductiveManifest)({ ...structural_authority_contract_1.STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN, schemaVersion: 1, generatedAt: structural_authority_contract_1.STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.datasetVersion, compression: "gzip", fileName: "../characters.json.gz", sha256: structural_authority_contract_1.STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.payloadSha256, sizeBytes: structural_authority_contract_1.STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.payloadSizeBytes, uncompressedSizeBytes: structural_authority_contract_1.STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.uncompressedSizeBytes, characterCount: structural_authority_contract_1.STRUCTURAL_AUTHORITY_PRODUCTIVE_PIN.characterCount }), /lineage changed/);
        await (0, assert_1.rejects)((0, artifact_path_1.resolveCharacterInputFile)("D:/controlled", "../characters.json.gz", "characters.json.gz"));
        await (0, assert_1.rejects)((0, artifact_path_1.resolveCharacterInputFile)("D:/controlled", "D:/escape/characters.json.gz", "characters.json.gz"));
    });
});
//# sourceMappingURL=structural-authority.spec.js.map