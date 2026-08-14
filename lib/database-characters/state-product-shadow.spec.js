"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const state_product_projection_1 = require("./state-product-projection");
const state_product_shadow_contract_1 = require("./state-product-shadow-contract");
const state_product_shadow_1 = require("./state-product-shadow");
const state_product_shadow_run_1 = require("./state-product-shadow-run");
const count = (included = 0, excluded = 0) => ({ included, excluded });
function fixture() {
    const dataset = {
        schemaVersion: 1,
        contract: "dokkan-database-character-state-product-projection",
        contractVersion: "1.0.0",
        mode: "explicit_opt_in_offline_local_supported_only",
        source: {
            k42: { contractVersion: "1.0.0", scopeAudit: "GO", nextSupportedOnlyProjection: "GO", sourceFingerprintSha256: "c".repeat(64) },
            sidecars: {
                k0: { sha256: "0".repeat(64), sizeBytes: 1 }, k1: { sha256: "1".repeat(64), sizeBytes: 2 },
                k2: { sha256: "2".repeat(64), sizeBytes: 3 }, k7: { sha256: "7".repeat(64), sizeBytes: 4 },
            },
            production: { sha256: "a".repeat(64), sizeBytes: 5, topLevelCount: 1 },
            fyi: { sha256: "b".repeat(64), sizeBytes: 6, topLevelCount: 1 },
            k7ProductionCoverage: { agreement: 1, unjoinable: 0, use: "coverage_only" },
        },
        policy: {
            structuralIdsOnly: true, presentationIncluded: false, supportedOnly: true, unknownIncluded: false, partialIncluded: false,
            k7ProductionCoverageFiltersRecords: false, characterArrayIncluded: false, characterArrayReturned: false,
            characterArrayModified: false, consumerImplemented: false, applyOrOverlayImplemented: false, authoritySelected: false,
            productionModified: false, publisherImplemented: false, networkEnabled: false, androidImplemented: false,
        },
        states: [
            { stateId: "s1", sourceStateKey: "key:s1", cardId: "1", formId: "1", releaseState: "initial", growthRowId: null, growthStep: null, hardDuplicateGroupId: "g1" },
            { stateId: "s2", sourceStateKey: "key:s2", cardId: "1", formId: "1", releaseState: "eza", growthRowId: "growth:1", growthStep: 1, hardDuplicateGroupId: "g1" },
        ],
        releaseTransitions: [{ transitionId: "r1", cardId: "1", sourceStateId: "s1", targetStateId: "s2", releaseState: "eza", growthRowId: "growth:1", growthStep: 1, routeRowIds: ["route:1"] }],
        awakeningTransitions: [{ transitionId: "a1", kind: "eza", sourceCardId: "1", targetCardId: "1", sourceStateId: "s1", targetStateId: "s2", cardIdentityPolicy: "same_card_release_progression", routeRowId: "route:1" }],
        formTransitions: [{ transitionId: "f1", kind: "transformation", channel: "passive", sourceCardId: "1", targetCardId: "2", sourceSkillId: "skill:1", sourceSkillSetId: "set:1", sourceStateIds: ["s1"], reversible: false }],
    };
    const coverage = {
        schemaVersion: 1,
        contract: "dokkan-database-character-state-product-projection-coverage",
        contractVersion: "1.0.0",
        states: { ...count(2), byReleaseState: { initial: count(1), eza: count(1), seza: count(), unknown: count() } },
        releaseTransitions: { ...count(1), byReleaseState: { eza: count(1), seza: count(), unknown: count() } },
        awakeningTransitions: { ...count(1), byKind: { z_awaken: count(), dokkan_awaken: count(), eza: count(1), seza: count(), unknown: count() } },
        formTransitions: {
            ...count(1), byKind: { transformation: count(1), giant_or_rage: count(), reversible_exchange: count(), unknown: count() },
            byChannel: { passive: count(1), active: count(), standby: count(), finish: count() },
        },
        k7ProductionCoverage: { agreement: 1, unjoinable: 0, use: "coverage_only" },
        excludedStructuralIds: { stateIds: [], releaseTransitionIds: [], awakeningTransitionIds: [], formTransitionIds: [], limitPerScope: 5 },
    };
    return { dataset, coverage };
}
describe("database character K44 state product shadow consumer", () => {
    it("accepts only the exact opt-in and four explicit roots", async () => {
        await (0, assert_1.rejects)((0, state_product_shadow_run_1.runCharacterStateProductShadow)({}), /explicit opt-in/);
        (0, assert_1.throws)(() => (0, state_product_shadow_run_1.parseCharacterStateProductShadowCli)([]), /exactly one --opt-in-k44/);
        (0, assert_1.throws)(() => (0, state_product_shadow_run_1.parseCharacterStateProductShadowCli)(["--opt-in-k44"]), /requires --sidecar-root/);
        (0, assert_1.throws)(() => (0, state_product_shadow_run_1.parseCharacterStateProductShadowCli)(["--opt-in-k44", "--sidecar-root", "s", "--production-root", "p", "--fyi-root", "f", "--k43-root", "k", "--output", "x"]), /unsupported argument/);
        (0, assert_1.deepStrictEqual)((0, state_product_shadow_run_1.parseCharacterStateProductShadowCli)(["--opt-in-k44", "--sidecar-root", "s", "--production-root", "p", "--fyi-root", "f", "--k43-root", "k"]), {
            optIn: true, sidecarRoot: "s", productionRoot: "p", fyiRoot: "f", k43Root: "k",
        });
    });
    it("looks up cloned structural states and transitions by identity or card", () => {
        const { dataset } = fixture();
        const lookup = (0, state_product_shadow_1.createCharacterStateProductShadowLookup)(dataset);
        (0, assert_1.equal)(lookup.getStateByStateId("s2")?.growthRowId, "growth:1");
        (0, assert_1.deepStrictEqual)(lookup.getStatesByCardId("1").map(item => item.stateId), ["s1", "s2"]);
        (0, assert_1.equal)(lookup.getTransitionByTransitionId("a1")?.transitionType, "awakening");
        (0, assert_1.deepStrictEqual)(lookup.getTransitionsByCardId("1").map(item => item.record.transitionId), ["a1", "f1", "r1"]);
        (0, assert_1.deepStrictEqual)(lookup.getTransitionsByCardId("2").map(item => item.record.transitionId), ["f1"]);
        (0, assert_1.equal)(lookup.getStateByStateId("missing"), null);
        (0, assert_1.deepStrictEqual)(lookup.getTransitionsByCardId("missing"), []);
    });
    it("returns frozen clones and never mutates or exposes internal indexes", () => {
        const { dataset } = fixture();
        const before = JSON.stringify(dataset);
        const lookup = (0, state_product_shadow_1.createCharacterStateProductShadowLookup)(dataset);
        const first = lookup.getStateByStateId("s1");
        const second = lookup.getStateByStateId("s1");
        (0, assert_1.notStrictEqual)(first, second);
        (0, assert_1.equal)(Object.isFrozen(first), true);
        (0, assert_1.throws)(() => { first.cardId = "mutated"; }, /read only|readonly|extensible|assign/i);
        (0, assert_1.equal)(lookup.getStateByStateId("s1").cardId, "1");
        (0, assert_1.equal)(JSON.stringify(dataset), before);
        (0, assert_1.equal)(Object.isFrozen(lookup), true);
        (0, assert_1.equal)(lookup.statesById, undefined);
    });
    it("refuses non-source-bound evidence, changed artifacts and non-pinned datasets", () => {
        (0, assert_1.throws)(() => (0, state_product_shadow_1.assertCharacterStateProductShadowSourceBound)({ sourceBoundValidation: "NON_AUTHORITATIVE" }), /requires source-bound/);
        const { dataset, coverage } = fixture();
        const artifacts = (0, state_product_projection_1.materializeCharacterStateProductProjection)(dataset, coverage);
        const fingerprint = (0, state_product_shadow_1.fingerprintCharacterStateProductShadowArtifact)(artifacts);
        (0, state_product_shadow_1.assertCharacterStateProductShadowArtifactStable)(fingerprint, fingerprint);
        (0, assert_1.throws)(() => (0, state_product_shadow_1.assertCharacterStateProductShadowArtifactStable)(fingerprint, "0".repeat(64)), /artifact changed/);
        (0, assert_1.throws)(() => (0, state_product_shadow_1.assertPinnedCharacterStateProductShadowDataset)(dataset), /projection pins changed/);
    });
    it("rejects presentation fields before indexing", () => {
        const { dataset } = fixture();
        dataset.states[0].name = "private-presentation";
        (0, assert_1.throws)(() => (0, state_product_shadow_1.createCharacterStateProductShadowLookup)(dataset), /presentation or extra/);
    });
    it("builds a deterministic bounded timestamp-free report without Character data", () => {
        const { dataset, coverage } = fixture();
        const artifacts = (0, state_product_projection_1.materializeCharacterStateProductProjection)(dataset, coverage);
        const lookup = (0, state_product_shadow_1.createCharacterStateProductShadowLookup)(dataset);
        const first = (0, state_product_shadow_1.buildCharacterStateProductShadowReport)(artifacts, lookup);
        const second = (0, state_product_shadow_1.buildCharacterStateProductShadowReport)(artifacts, lookup);
        (0, assert_1.deepStrictEqual)(first, second);
        const consumer = (0, state_product_shadow_1.createCharacterStateProductShadowConsumer)(artifacts);
        (0, assert_1.deepStrictEqual)(consumer.report, first);
        const stdout = `${JSON.stringify(first, null, 2)}\n`;
        (0, assert_1.ok)(Buffer.byteLength(stdout) < state_product_shadow_contract_1.CHARACTER_STATE_PRODUCT_SHADOW_REPORT_LIMIT_BYTES);
        (0, assert_1.equal)(stdout.includes("generatedAt"), false);
        (0, assert_1.equal)(stdout.includes("private-presentation"), false);
        (0, assert_1.equal)(stdout.includes("Character[]"), false);
        (0, assert_1.equal)(first.samples.stateIds.length <= 5, true);
        (0, assert_1.equal)(first.inputIntegrity.sourceBoundValidationBeforeLookup, "NOT_EXECUTED");
        (0, assert_1.equal)(first.inputIntegrity.sourceBoundValidationAfterLookup, "NOT_EXECUTED");
        (0, assert_1.equal)(first.readiness.consumerShadow, "NOT_EXECUTED");
        (0, assert_1.equal)(first.readiness.persistedConsumer, "NO-GO");
    });
});
//# sourceMappingURL=state-product-shadow.spec.js.map