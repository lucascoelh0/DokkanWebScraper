"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const promises_1 = require("fs/promises");
const os_1 = require("os");
const path_1 = require("path");
const zlib_1 = require("zlib");
const leader_supported_compatibility_golden_1 = require("./leader-supported-compatibility-golden");
const leader_supported_compatibility_1 = require("./leader-supported-compatibility");
const leader_supported_compatibility_source_1 = require("./leader-supported-compatibility-source");
function fixture() {
    const effects = Array.from({ length: 3836 }, (_, index) => ({
        effectRowId: String(index + 1), referenceCount: index === 0 ? 8430 : 1,
        classification: "additive_contract_required",
        reason: "lossless_supported_shadow_requires_separate_additive_contract",
    }));
    return {
        schemaVersion: 1, contract: "dokkan-database-character-leader-supported-compatibility-audit", contractVersion: "1.0.0",
        mode: "explicit_opt_in_offline_default_off_non_authoritative",
        lineage: { k56: { source: {}, fullArtifactFingerprintSha256: "a".repeat(64), lineageFingerprintSha256: "b".repeat(64), sourceBoundViaK58: "GO" }, stableAcrossAudit: true },
        inventory: { effects: 3836, references: 12265, states: 7248, cards: 3434, publicIndexes: 4, excludedEffects: 17, excludedReferences: 45, excludedReason: "runtime_deck_index_unresolved" },
        comparison: {
            productiveCharacterDataset: {
                joinableReferences: 8893, unjoinableReferences: 3372, identityAgreementReferences: 8893,
                representationGainReferences: 8893, representationMismatchReferences: 0, comparableValueReferences: 0,
                confirmedConflictReferences: 0, unknownValueReferences: 12265, zeroConflictIsCompleteness: false,
                distinctJoinableCards: 2265, distinctUnjoinableCards: 1169, textBaselinePresentReferences: 8893,
                structuredLeaderDetailsPresentReferences: 0, identityOnlyNoTextAuthority: true,
            },
            scraperLeaderContract: {}, teamAnalysisContract: {}, android: {},
        },
        dimensionMatrix: leader_supported_compatibility_golden_1.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_DIMENSION_GOLDEN.map(item => ({ ...item })),
        effectCompatibility: { counts: { directly_representable: 0, additive_contract_required: 3836, current_model_lossy: 0, runtime_context_required: 0, blocked_unknown: 0 }, effects },
        k63Proposal: { replacesEffectiveValues: false, existingFallback: "byte_and_semantically_identical", modifiesUi: false, modifiesCharacterEntity: false },
        boundaries: { conditional17Included: false, deckIndex: "unknown", leaderFriendComposition: "unknown", finalStacking: "unknown", finalRounding: "unknown", transformationsDeathReviveExchangeStandby: "unknown", combatCalculation: "NOT_EXECUTED", runtimeInstrumentation: "NOT_EXECUTED", newTextParsing: "NOT_EXECUTED", networkRequestCount: 0, authenticatedRequestCount: 0, r2MutationCount: 0, publisherExecuted: false, authoritySelected: false, androidModified: false },
        readiness: { lineageK56ThroughK61: "GO" },
    };
}
describe("K62 supported leader compatibility", () => {
    it("materializes byte-identically and reconstructs losslessly", () => {
        const first = (0, leader_supported_compatibility_1.materializeCharacterLeaderSupportedCompatibility)(fixture());
        const second = (0, leader_supported_compatibility_1.materializeCharacterLeaderSupportedCompatibility)(fixture());
        (0, assert_1.strict)(first.raw.equals(second.raw));
        (0, assert_1.strict)(first.gzip.equals(second.gzip));
        (0, assert_1.strict)(first.coverageBytes.equals(second.coverageBytes));
        (0, assert_1.strict)(first.validationBytes.equals(second.validationBytes));
        (0, assert_1.strict)(first.manifestBytes.equals(second.manifestBytes));
        (0, assert_1.strict)((0, zlib_1.gunzipSync)(first.gzip).equals(first.raw));
        assert_1.strict.equal(first.validation.valid, true);
    });
    it("rejects dimension and effect classification mutations", () => {
        const dimension = fixture();
        dimension.dimensionMatrix[0].classification = "directly_representable";
        (0, assert_1.strict)((0, leader_supported_compatibility_1.validateCharacterLeaderSupportedCompatibilityReport)(dimension).includes("dimension matrix changed"));
        const effect = fixture();
        effect.effectCompatibility.effects.pop();
        (0, assert_1.strict)((0, leader_supported_compatibility_1.validateCharacterLeaderSupportedCompatibilityReport)(effect).includes("effect classification changed"));
    });
    it("rejects forbidden execution, completeness and text identity mutations", () => {
        const execution = fixture();
        execution.boundaries.networkRequestCount = 1;
        (0, assert_1.strict)((0, leader_supported_compatibility_1.validateCharacterLeaderSupportedCompatibilityReport)(execution).includes("forbidden boundary changed"));
        const completeness = fixture();
        completeness.comparison.productiveCharacterDataset.zeroConflictIsCompleteness = true;
        (0, assert_1.strict)((0, leader_supported_compatibility_1.validateCharacterLeaderSupportedCompatibilityReport)(completeness).includes("zero-conflict completeness boundary changed"));
        const text = fixture();
        text.identity = { title: "forbidden" };
        (0, assert_1.strict)((0, leader_supported_compatibility_1.validateCharacterLeaderSupportedCompatibilityReport)(text).includes("text or presentation entered K62 identity report"));
        const runtime = fixture();
        runtime.boundaries.finalRounding = false;
        (0, assert_1.strict)((0, leader_supported_compatibility_1.validateCharacterLeaderSupportedCompatibilityReport)(runtime).includes("runtime unknown boundary changed"));
    });
    it("keeps source pins relative and the K63 proposal absent-compatible", () => {
        for (const tuple of [...leader_supported_compatibility_golden_1.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_SOURCE_PINS.scraper, ...leader_supported_compatibility_golden_1.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_SOURCE_PINS.android]) {
            (0, assert_1.strict)(!tuple[0].includes(":"));
            (0, assert_1.strict)(!tuple[0].startsWith("/"));
        }
        const value = fixture();
        assert_1.strict.equal(value.k63Proposal.existingFallback, "byte_and_semantically_identical");
        assert_1.strict.equal(value.k63Proposal.replacesEffectiveValues, false);
    });
    it("writes create-only with manifest last and rejects tampering", async () => {
        const root = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "k62-spec-"));
        try {
            const artifacts = (0, leader_supported_compatibility_1.materializeCharacterLeaderSupportedCompatibility)(fixture());
            await (0, leader_supported_compatibility_source_1.writeCharacterLeaderSupportedCompatibilityArtifacts)(root, artifacts);
            const reread = await (0, leader_supported_compatibility_source_1.readCharacterLeaderSupportedCompatibilityArtifacts)(root);
            (0, assert_1.strict)(reread.gzip.equals(artifacts.gzip));
            await assert_1.strict.rejects(() => (0, leader_supported_compatibility_source_1.writeCharacterLeaderSupportedCompatibilityArtifacts)(root, artifacts));
            await (0, promises_1.chmod)((0, path_1.join)(root, artifacts.manifest.fileName), 0o644);
            await (0, promises_1.writeFile)((0, path_1.join)(root, artifacts.manifest.fileName), Buffer.from("tampered"));
            await assert_1.strict.rejects(() => (0, leader_supported_compatibility_source_1.readCharacterLeaderSupportedCompatibilityArtifacts)(root));
        }
        finally {
            await (0, promises_1.rm)(root, { recursive: true, force: true });
        }
    });
});
//# sourceMappingURL=leader-supported-compatibility.spec.js.map