import { strict as assert } from "assert";
import { chmod, mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { gunzipSync } from "zlib";
import { CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_DIMENSION_GOLDEN, CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_SOURCE_PINS } from "./leader-supported-compatibility-golden";
import {
    materializeCharacterLeaderSupportedCompatibility,
    validateCharacterLeaderSupportedCompatibilityReport,
} from "./leader-supported-compatibility";
import {
    readCharacterLeaderSupportedCompatibilityArtifacts,
    writeCharacterLeaderSupportedCompatibilityArtifacts,
} from "./leader-supported-compatibility-source";

function fixture(): any {
    const effects = Array.from({ length: 3_836 }, (_, index) => ({
        effectRowId: String(index + 1), referenceCount: index === 0 ? 8_430 : 1,
        classification: "additive_contract_required",
        reason: "lossless_supported_shadow_requires_separate_additive_contract",
    }));
    return {
        schemaVersion: 1, contract: "dokkan-database-character-leader-supported-compatibility-audit", contractVersion: "1.0.0",
        mode: "explicit_opt_in_offline_default_off_non_authoritative",
        lineage: { k56: { source: {}, fullArtifactFingerprintSha256: "a".repeat(64), lineageFingerprintSha256: "b".repeat(64), sourceBoundViaK58: "GO" }, stableAcrossAudit: true },
        inventory: { effects: 3_836, references: 12_265, states: 7_248, cards: 3_434, publicIndexes: 4, excludedEffects: 17, excludedReferences: 45, excludedReason: "runtime_deck_index_unresolved" },
        comparison: {
            productiveCharacterDataset: {
                joinableReferences: 8_893, unjoinableReferences: 3_372, identityAgreementReferences: 8_893,
                representationGainReferences: 8_893, representationMismatchReferences: 0, comparableValueReferences: 0,
                confirmedConflictReferences: 0, unknownValueReferences: 12_265, zeroConflictIsCompleteness: false,
                distinctJoinableCards: 2_265, distinctUnjoinableCards: 1_169, textBaselinePresentReferences: 8_893,
                structuredLeaderDetailsPresentReferences: 0, identityOnlyNoTextAuthority: true,
            },
            scraperLeaderContract: {}, teamAnalysisContract: {}, android: {},
        },
        dimensionMatrix: CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_DIMENSION_GOLDEN.map(item => ({ ...item })),
        effectCompatibility: { counts: { directly_representable: 0, additive_contract_required: 3_836, current_model_lossy: 0, runtime_context_required: 0, blocked_unknown: 0 }, effects },
        k63Proposal: { replacesEffectiveValues: false, existingFallback: "byte_and_semantically_identical", modifiesUi: false, modifiesCharacterEntity: false },
        boundaries: { conditional17Included: false, deckIndex: "unknown", leaderFriendComposition: "unknown", finalStacking: "unknown", finalRounding: "unknown", transformationsDeathReviveExchangeStandby: "unknown", combatCalculation: "NOT_EXECUTED", runtimeInstrumentation: "NOT_EXECUTED", newTextParsing: "NOT_EXECUTED", networkRequestCount: 0, authenticatedRequestCount: 0, r2MutationCount: 0, publisherExecuted: false, authoritySelected: false, androidModified: false },
        readiness: { lineageK56ThroughK61: "GO" },
    };
}

describe("K62 supported leader compatibility", () => {
    it("materializes byte-identically and reconstructs losslessly", () => {
        const first = materializeCharacterLeaderSupportedCompatibility(fixture());
        const second = materializeCharacterLeaderSupportedCompatibility(fixture());
        assert(first.raw.equals(second.raw));
        assert(first.gzip.equals(second.gzip));
        assert(first.coverageBytes.equals(second.coverageBytes));
        assert(first.validationBytes.equals(second.validationBytes));
        assert(first.manifestBytes.equals(second.manifestBytes));
        assert(gunzipSync(first.gzip).equals(first.raw));
        assert.equal(first.validation.valid, true);
    });

    it("rejects dimension and effect classification mutations", () => {
        const dimension = fixture();
        dimension.dimensionMatrix[0].classification = "directly_representable";
        assert(validateCharacterLeaderSupportedCompatibilityReport(dimension).includes("dimension matrix changed"));
        const effect = fixture();
        effect.effectCompatibility.effects.pop();
        assert(validateCharacterLeaderSupportedCompatibilityReport(effect).includes("effect classification changed"));
    });

    it("rejects forbidden execution, completeness and text identity mutations", () => {
        const execution = fixture();
        execution.boundaries.networkRequestCount = 1;
        assert(validateCharacterLeaderSupportedCompatibilityReport(execution).includes("forbidden boundary changed"));
        const completeness = fixture();
        completeness.comparison.productiveCharacterDataset.zeroConflictIsCompleteness = true;
        assert(validateCharacterLeaderSupportedCompatibilityReport(completeness).includes("zero-conflict completeness boundary changed"));
        const text = fixture();
        text.identity = { title: "forbidden" };
        assert(validateCharacterLeaderSupportedCompatibilityReport(text).includes("text or presentation entered K62 identity report"));
        const runtime = fixture();
        runtime.boundaries.finalRounding = false;
        assert(validateCharacterLeaderSupportedCompatibilityReport(runtime).includes("runtime unknown boundary changed"));
    });

    it("keeps source pins relative and the K63 proposal absent-compatible", () => {
        for (const tuple of [...CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_SOURCE_PINS.scraper, ...CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_SOURCE_PINS.android]) {
            assert(!tuple[0].includes(":"));
            assert(!tuple[0].startsWith("/"));
        }
        const value = fixture();
        assert.equal(value.k63Proposal.existingFallback, "byte_and_semantically_identical");
        assert.equal(value.k63Proposal.replacesEffectiveValues, false);
    });

    it("writes create-only with manifest last and rejects tampering", async () => {
        const root = await mkdtemp(join(tmpdir(), "k62-spec-"));
        try {
            const artifacts = materializeCharacterLeaderSupportedCompatibility(fixture());
            await writeCharacterLeaderSupportedCompatibilityArtifacts(root, artifacts);
            const reread = await readCharacterLeaderSupportedCompatibilityArtifacts(root);
            assert(reread.gzip.equals(artifacts.gzip));
            await assert.rejects(() => writeCharacterLeaderSupportedCompatibilityArtifacts(root, artifacts));
            await chmod(join(root, artifacts.manifest.fileName), 0o644);
            await writeFile(join(root, artifacts.manifest.fileName), Buffer.from("tampered"));
            await assert.rejects(() => readCharacterLeaderSupportedCompatibilityArtifacts(root));
        } finally { await rm(root, { recursive: true, force: true }); }
    });
});
