"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const promises_1 = require("fs/promises");
const os_1 = require("os");
const path_1 = require("path");
const state_product_scope_1 = require("./state-product-scope");
const state_product_projection_1 = require("./state-product-projection");
const state_product_projection_run_1 = require("./state-product-projection-run");
function inputs() {
    const graphState = (stateId, releaseState, growthRowId, growthStep) => ({
        stateId, sourceStateKey: `key:${stateId}`, cardId: "1", releaseState, growthRowId, growthStep, hardDuplicateGroupId: "group:1",
    });
    const identityState = (stateId, releaseState, evidenceStatus) => ({
        stateId, sourceStateKey: `key:${stateId}`, cardId: "1", formId: "1", releaseState, evidenceStatus,
    });
    const comparison = (identity) => ({
        identity,
        comparisonState: { stateKey: null, releaseState: null, availableAt: null, availableAtSnapshot: null, progressionStep: null, growthStepSource: null, selectionPolicy: "initial_state", comparable: false },
        agreementFields: [], representationGains: [], conflicts: [], unknownFields: [], externalFormIds: [],
    });
    return {
        k0: { cards: [{ cardId: "1", characterId: "1", recordKind: "collectable" }], states: [
                identityState("s1", "initial", "supported"), identityState("s2", "eza", "supported"),
                identityState("s3", "seza", "supported"), identityState("s4", "unknown", "unknown"),
            ] },
        k1: {
            states: [graphState("s1", "initial"), graphState("s2", "eza", "g1", 1), graphState("s3", "seza", "g2", 2), graphState("s4", "unknown", "private-presentation", 3)],
            releaseStateTransitions: [
                { transitionId: "r1", cardId: "1", sourceStateId: "s1", targetStateId: "s2", releaseState: "eza", growthRowId: "g1", growthStep: 1, evidenceStatus: "supported", routeRowIds: ["20", "10"] },
                { transitionId: "r2", cardId: "1", sourceStateId: "s2", targetStateId: "s3", releaseState: "seza", growthRowId: "g2", growthStep: 2, evidenceStatus: "supported", routeRowIds: ["30"] },
                { transitionId: "r3", cardId: "1", sourceStateId: "s3", targetStateId: "s4", releaseState: "unknown", growthRowId: "g3", growthStep: 3, evidenceStatus: "unknown", routeRowIds: [] },
            ],
            awakeningTransitions: [
                { transitionId: "a1", kind: "eza", sourceCardId: "1", targetCardId: "1", sourceStateId: "s1", targetStateId: "s2", targetStatus: "supported", cardIdentityPolicy: "same_card_release_progression", route: { rowId: "10", rawType: "private-presentation" } },
                { transitionId: "a2", kind: "z_awaken", sourceCardId: "1", targetCardId: "2", targetStatus: "partial", cardIdentityPolicy: "collapse_z_awakened_ui_duplicate", route: { rowId: "11" } },
                { transitionId: "a3", kind: "unknown", sourceCardId: "1", targetCardId: "1", targetStatus: "supported", cardIdentityPolicy: "unknown", route: { rowId: "12" } },
            ],
            formTransitions: [
                { transitionId: "f1", kind: "transformation", channel: "passive", sourceCardId: "1", targetCardId: "2", sourceSkillId: "skill:1", sourceSkillSetId: "set:1", sourceStateIds: ["s1"], stateBindingStatus: "supported", reversible: false },
                { transitionId: "f2", kind: "giant_or_rage", channel: "active", sourceCardId: "1", targetCardId: "3", sourceSkillId: "skill:2", sourceStateIds: [], stateBindingStatus: "partial", reversible: false },
                { transitionId: "f3", kind: "unknown", channel: "finish", sourceCardId: "1", targetCardId: "4", sourceSkillId: "skill:3", sourceStateIds: ["s1"], stateBindingStatus: "supported", reversible: false },
            ],
        },
        k2: { cards: [{ cardId: "1", labels: { cardTitle: "private-presentation" } }] },
        k7: { cards: [
                { cardId: "1", recordKind: "collectable", production: comparison("agreement") },
                { cardId: "2", recordKind: "collectable", production: comparison("unjoinable") },
            ] },
        sidecarIdentities: {
            k0: { sha256: "0".repeat(64), sizeBytes: 1 }, k1: { sha256: "1".repeat(64), sizeBytes: 2 },
            k2: { sha256: "2".repeat(64), sizeBytes: 3 }, k7: { sha256: "7".repeat(64), sizeBytes: 4 },
        },
        production: { characters: new Map([["1", { name: "private-presentation" }]]), sha256: "a".repeat(64), sizeBytes: 5, topLevelCount: 1 },
        fyi: { characters: new Map([["1", { name: "private-presentation" }]]), sha256: "b".repeat(64), sizeBytes: 6, topLevelCount: 1, generatedAt: "private-timestamp" },
    };
}
function datasetAndCoverage() {
    const projected = (0, state_product_projection_1.projectSupportedCharacterStateProductRecords)(inputs());
    const dataset = {
        schemaVersion: 1,
        contract: "dokkan-database-character-state-product-projection",
        contractVersion: "1.0.0",
        mode: "explicit_opt_in_offline_local_supported_only",
        source: {
            k42: { contractVersion: "1.0.0", scopeAudit: "GO", nextSupportedOnlyProjection: "GO", sourceFingerprintSha256: "c".repeat(64) },
            sidecars: inputs().sidecarIdentities,
            production: { sha256: "a".repeat(64), sizeBytes: 5, topLevelCount: 1 },
            fyi: { sha256: "b".repeat(64), sizeBytes: 6, topLevelCount: 1 },
            k7ProductionCoverage: { agreement: 1, unjoinable: 1, use: "coverage_only" },
        },
        policy: {
            structuralIdsOnly: true, presentationIncluded: false, supportedOnly: true, unknownIncluded: false, partialIncluded: false,
            k7ProductionCoverageFiltersRecords: false, characterArrayIncluded: false, characterArrayReturned: false,
            characterArrayModified: false, consumerImplemented: false,
            applyOrOverlayImplemented: false, authoritySelected: false, productionModified: false, publisherImplemented: false,
            networkEnabled: false, androidImplemented: false,
        },
        ...projected.records,
    };
    return { ...projected, dataset };
}
describe("database character K43 state product projection", () => {
    it("accepts only the exact opt-in and four explicit roots", async () => {
        await (0, assert_1.rejects)((0, state_product_projection_run_1.runCharacterStateProductProjection)({}), /explicit opt-in/);
        (0, assert_1.throws)(() => (0, state_product_projection_run_1.parseCharacterStateProductProjectionCli)([]), /exactly one --opt-in-k43/);
        (0, assert_1.throws)(() => (0, state_product_projection_run_1.parseCharacterStateProductProjectionCli)(["--opt-in-k43"]), /requires --sidecar-root/);
        (0, assert_1.throws)(() => (0, state_product_projection_run_1.parseCharacterStateProductProjectionCli)(["--opt-in-k43", "--sidecar-root", "s", "--production-root", "p", "--fyi-root", "f", "--output-root", "o", "--extra", "x"]), /unsupported argument/);
        (0, assert_1.deepStrictEqual)((0, state_product_projection_run_1.parseCharacterStateProductProjectionCli)(["--opt-in-k43", "--sidecar-root", "s", "--production-root", "p", "--fyi-root", "f", "--output-root", "o"]), {
            optIn: true, sidecarRoot: "s", productionRoot: "p", fyiRoot: "f", outputRoot: "o",
        });
    });
    it("projects only K0-supported K1-known structural records", () => {
        const projected = (0, state_product_projection_1.projectSupportedCharacterStateProductRecords)(inputs());
        (0, assert_1.deepStrictEqual)(projected.records.states.map(item => item.stateId), ["s1", "s2", "s3"]);
        (0, assert_1.deepStrictEqual)(projected.records.releaseTransitions.map(item => item.transitionId), ["r1", "r2"]);
        (0, assert_1.deepStrictEqual)(projected.records.awakeningTransitions.map(item => item.transitionId), ["a1"]);
        (0, assert_1.deepStrictEqual)(projected.records.formTransitions.map(item => item.transitionId), ["f1"]);
        (0, assert_1.deepStrictEqual)(projected.records.releaseTransitions[0].routeRowIds, ["10", "20"]);
        (0, assert_1.equal)(projected.coverage.states.excluded, 1);
        (0, assert_1.equal)(projected.coverage.releaseTransitions.excluded, 1);
        (0, assert_1.equal)(projected.coverage.awakeningTransitions.excluded, 2);
        (0, assert_1.equal)(projected.coverage.formTransitions.excluded, 2);
        (0, assert_1.equal)(JSON.stringify(projected).includes("private-presentation"), false);
        (0, assert_1.equal)(JSON.stringify(projected).includes("private-timestamp"), false);
    });
    it("materializes canonical JSON and deterministic gzip bytes within budgets", () => {
        const { dataset, coverage } = datasetAndCoverage();
        const first = (0, state_product_projection_1.materializeCharacterStateProductProjection)(dataset, coverage);
        const second = (0, state_product_projection_1.materializeCharacterStateProductProjection)(dataset, coverage);
        (0, assert_1.ok)(first.raw.equals(second.raw));
        (0, assert_1.ok)(first.gzip.equals(second.gzip));
        (0, assert_1.ok)(first.coverageBytes.equals(second.coverageBytes));
        (0, assert_1.ok)(first.validationBytes.equals(second.validationBytes));
        (0, assert_1.ok)(first.manifestBytes.equals(second.manifestBytes));
        (0, assert_1.equal)(first.validation.valid, true);
        (0, assert_1.equal)(first.validation.readiness.sourceBoundValidation, "NOT_EXECUTED");
        (0, assert_1.equal)(first.validation.sizes.metadataSizeBytes, first.coverageBytes.length + first.validationBytes.length + first.manifestBytes.length);
        (0, assert_1.equal)(first.manifest.fileName.includes(first.manifest.sha256), true);
    });
    it("fails validation for drift, unsupported records and presentation fields", () => {
        const { dataset, coverage } = datasetAndCoverage();
        const materialized = (0, state_product_projection_1.materializeCharacterStateProductProjection)(dataset, coverage);
        const drifted = JSON.parse(JSON.stringify(dataset));
        drifted.states[0].stateId = "missing-source";
        drifted.states[0].name = "presentation-forbidden";
        drifted.formTransitions[0].kind = "unknown";
        const validation = (0, state_product_projection_1.validateCharacterStateProductProjection)(drifted, coverage, materialized.validation.sizes);
        (0, assert_1.equal)(validation.valid, false);
        (0, assert_1.ok)(validation.failures.includes("missing state reference"));
        (0, assert_1.ok)(validation.failures.includes("unsupported record included"));
        (0, assert_1.ok)(validation.failures.includes("extra or presentation field included"));
    });
    it("rejects source reload drift before an artifact can be authorized", () => {
        const before = inputs();
        const after = inputs();
        after.k1.formTransitions[0].targetCardId = "999";
        (0, assert_1.throws)(() => (0, state_product_scope_1.assertCharacterStateProductScopeInputsUnchanged)(before, after), /structural source fingerprint changed/);
    });
    it("rejects a symlink or junction output root when the platform permits it", async function () {
        const root = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "k43-link-root-"));
        const target = (0, path_1.join)(root, "target");
        const linked = (0, path_1.join)(root, "linked");
        await (0, promises_1.mkdir)(target);
        try {
            try {
                await (0, promises_1.symlink)(target, linked, process.platform === "win32" ? "junction" : "dir");
            }
            catch (error) {
                if (error?.code === "EPERM")
                    this.skip();
                throw error;
            }
            await (0, state_product_projection_run_1.validateCharacterStateProductProjectionOutputRoot)(target);
            await (0, assert_1.rejects)((0, state_product_projection_run_1.validateCharacterStateProductProjectionOutputRoot)(linked), /regular non-link directory|symlink or junction rejected/);
        }
        finally {
            await (0, promises_1.rm)(root, { recursive: true, force: true });
        }
    });
    it("rejects an output root that overlaps any source root", async () => {
        const root = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "k43-overlap-root-"));
        const sidecar = (0, path_1.join)(root, "sidecar");
        const production = (0, path_1.join)(root, "production");
        const fyi = (0, path_1.join)(root, "fyi");
        const nestedOutput = (0, path_1.join)(sidecar, "output");
        const separateOutput = (0, path_1.join)(root, "output");
        await Promise.all([(0, promises_1.mkdir)(sidecar), (0, promises_1.mkdir)(production), (0, promises_1.mkdir)(fyi), (0, promises_1.mkdir)(separateOutput)]);
        await (0, promises_1.mkdir)(nestedOutput);
        try {
            await (0, assert_1.rejects)((0, state_product_projection_run_1.validateCharacterStateProductProjectionRootSeparation)({
                sidecarRoot: sidecar, productionRoot: production, fyiRoot: fyi, outputRoot: nestedOutput,
            }), /must not alias, contain, or descend/);
            await (0, state_product_projection_run_1.validateCharacterStateProductProjectionRootSeparation)({
                sidecarRoot: sidecar, productionRoot: production, fyiRoot: fyi, outputRoot: separateOutput,
            });
        }
        finally {
            await (0, promises_1.rm)(root, { recursive: true, force: true });
        }
    });
});
//# sourceMappingURL=state-product-projection.spec.js.map