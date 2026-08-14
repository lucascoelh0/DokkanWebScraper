import { deepStrictEqual, equal, ok, rejects, throws } from "assert";
import { mkdtemp, mkdir, rm, symlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import type { CharacterShadowInputs } from "./shadow-source";
import { assertCharacterStateProductScopeInputsUnchanged } from "./state-product-scope";
import {
    CharacterStateProductProjectionDataset,
} from "./state-product-projection-contract";
import {
    materializeCharacterStateProductProjection,
    projectSupportedCharacterStateProductRecords,
    validateCharacterStateProductProjection,
} from "./state-product-projection";
import {
    parseCharacterStateProductProjectionCli,
    runCharacterStateProductProjection,
    validateCharacterStateProductProjectionOutputRoot,
    validateCharacterStateProductProjectionRootSeparation,
} from "./state-product-projection-run";

function inputs(): CharacterShadowInputs {
    const graphState = (stateId: string, releaseState: "initial" | "eza" | "seza" | "unknown", growthRowId?: string, growthStep?: number) => ({
        stateId, sourceStateKey: `key:${stateId}`, cardId: "1", releaseState, growthRowId, growthStep, hardDuplicateGroupId: "group:1",
    });
    const identityState = (stateId: string, releaseState: "initial" | "eza" | "seza" | "unknown", evidenceStatus: "supported" | "partial" | "unknown") => ({
        stateId, sourceStateKey: `key:${stateId}`, cardId: "1", formId: "1", releaseState, evidenceStatus,
    });
    const comparison = (identity: "agreement" | "unjoinable") => ({
        identity,
        comparisonState: { stateKey: null, releaseState: null, availableAt: null, availableAtSnapshot: null, progressionStep: null, growthStepSource: null, selectionPolicy: "initial_state", comparable: false },
        agreementFields: [], representationGains: [], conflicts: [], unknownFields: [], externalFormIds: [],
    });
    return {
        k0: { cards: [{ cardId: "1", characterId: "1", recordKind: "collectable" }], states: [
            identityState("s1", "initial", "supported"), identityState("s2", "eza", "supported"),
            identityState("s3", "seza", "supported"), identityState("s4", "unknown", "unknown"),
        ] } as any,
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
        } as any,
        k2: { cards: [{ cardId: "1", labels: { cardTitle: "private-presentation" } }] } as any,
        k7: { cards: [
            { cardId: "1", recordKind: "collectable", production: comparison("agreement") },
            { cardId: "2", recordKind: "collectable", production: comparison("unjoinable") },
        ] } as any,
        sidecarIdentities: {
            k0: { sha256: "0".repeat(64), sizeBytes: 1 }, k1: { sha256: "1".repeat(64), sizeBytes: 2 },
            k2: { sha256: "2".repeat(64), sizeBytes: 3 }, k7: { sha256: "7".repeat(64), sizeBytes: 4 },
        },
        production: { characters: new Map([["1", { name: "private-presentation" } as any]]), sha256: "a".repeat(64), sizeBytes: 5, topLevelCount: 1 },
        fyi: { characters: new Map([["1", { name: "private-presentation" } as any]]), sha256: "b".repeat(64), sizeBytes: 6, topLevelCount: 1, generatedAt: "private-timestamp" },
    };
}

function datasetAndCoverage(): ReturnType<typeof projectSupportedCharacterStateProductRecords> & { dataset: CharacterStateProductProjectionDataset } {
    const projected = projectSupportedCharacterStateProductRecords(inputs());
    const dataset: CharacterStateProductProjectionDataset = {
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
        await rejects(runCharacterStateProductProjection({} as any), /explicit opt-in/);
        throws(() => parseCharacterStateProductProjectionCli([]), /exactly one --opt-in-k43/);
        throws(() => parseCharacterStateProductProjectionCli(["--opt-in-k43"]), /requires --sidecar-root/);
        throws(() => parseCharacterStateProductProjectionCli(["--opt-in-k43", "--sidecar-root", "s", "--production-root", "p", "--fyi-root", "f", "--output-root", "o", "--extra", "x"]), /unsupported argument/);
        deepStrictEqual(parseCharacterStateProductProjectionCli(["--opt-in-k43", "--sidecar-root", "s", "--production-root", "p", "--fyi-root", "f", "--output-root", "o"]), {
            optIn: true, sidecarRoot: "s", productionRoot: "p", fyiRoot: "f", outputRoot: "o",
        });
    });

    it("projects only K0-supported K1-known structural records", () => {
        const projected = projectSupportedCharacterStateProductRecords(inputs());
        deepStrictEqual(projected.records.states.map(item => item.stateId), ["s1", "s2", "s3"]);
        deepStrictEqual(projected.records.releaseTransitions.map(item => item.transitionId), ["r1", "r2"]);
        deepStrictEqual(projected.records.awakeningTransitions.map(item => item.transitionId), ["a1"]);
        deepStrictEqual(projected.records.formTransitions.map(item => item.transitionId), ["f1"]);
        deepStrictEqual(projected.records.releaseTransitions[0].routeRowIds, ["10", "20"]);
        equal(projected.coverage.states.excluded, 1);
        equal(projected.coverage.releaseTransitions.excluded, 1);
        equal(projected.coverage.awakeningTransitions.excluded, 2);
        equal(projected.coverage.formTransitions.excluded, 2);
        equal(JSON.stringify(projected).includes("private-presentation"), false);
        equal(JSON.stringify(projected).includes("private-timestamp"), false);
    });

    it("materializes canonical JSON and deterministic gzip bytes within budgets", () => {
        const { dataset, coverage } = datasetAndCoverage();
        const first = materializeCharacterStateProductProjection(dataset, coverage);
        const second = materializeCharacterStateProductProjection(dataset, coverage);
        ok(first.raw.equals(second.raw));
        ok(first.gzip.equals(second.gzip));
        ok(first.coverageBytes.equals(second.coverageBytes));
        ok(first.validationBytes.equals(second.validationBytes));
        ok(first.manifestBytes.equals(second.manifestBytes));
        equal(first.validation.valid, true);
        equal(first.validation.readiness.sourceBoundValidation, "NOT_EXECUTED");
        equal(first.validation.sizes.metadataSizeBytes, first.coverageBytes.length + first.validationBytes.length + first.manifestBytes.length);
        equal(first.manifest.fileName.includes(first.manifest.sha256), true);
    });

    it("fails validation for drift, unsupported records and presentation fields", () => {
        const { dataset, coverage } = datasetAndCoverage();
        const materialized = materializeCharacterStateProductProjection(dataset, coverage);
        const drifted = JSON.parse(JSON.stringify(dataset));
        drifted.states[0].stateId = "missing-source";
        drifted.states[0].name = "presentation-forbidden";
        drifted.formTransitions[0].kind = "unknown";
        const validation = validateCharacterStateProductProjection(drifted, coverage, materialized.validation.sizes);
        equal(validation.valid, false);
        ok(validation.failures.includes("missing state reference"));
        ok(validation.failures.includes("unsupported record included"));
        ok(validation.failures.includes("extra or presentation field included"));
    });

    it("rejects source reload drift before an artifact can be authorized", () => {
        const before = inputs();
        const after = inputs();
        after.k1.formTransitions[0].targetCardId = "999";
        throws(() => assertCharacterStateProductScopeInputsUnchanged(before, after), /structural source fingerprint changed/);
    });

    it("rejects a symlink or junction output root when the platform permits it", async function () {
        const root = await mkdtemp(join(tmpdir(), "k43-link-root-"));
        const target = join(root, "target");
        const linked = join(root, "linked");
        await mkdir(target);
        try {
            try { await symlink(target, linked, process.platform === "win32" ? "junction" : "dir"); }
            catch (error: any) { if (error?.code === "EPERM") this.skip(); throw error; }
            await validateCharacterStateProductProjectionOutputRoot(target);
            await rejects(validateCharacterStateProductProjectionOutputRoot(linked), /regular non-link directory|symlink or junction rejected/);
        } finally { await rm(root, { recursive: true, force: true }); }
    });

    it("rejects an output root that overlaps any source root", async () => {
        const root = await mkdtemp(join(tmpdir(), "k43-overlap-root-"));
        const sidecar = join(root, "sidecar");
        const production = join(root, "production");
        const fyi = join(root, "fyi");
        const nestedOutput = join(sidecar, "output");
        const separateOutput = join(root, "output");
        await Promise.all([mkdir(sidecar), mkdir(production), mkdir(fyi), mkdir(separateOutput)]);
        await mkdir(nestedOutput);
        try {
            await rejects(validateCharacterStateProductProjectionRootSeparation({
                sidecarRoot: sidecar, productionRoot: production, fyiRoot: fyi, outputRoot: nestedOutput,
            }), /must not alias, contain, or descend/);
            await validateCharacterStateProductProjectionRootSeparation({
                sidecarRoot: sidecar, productionRoot: production, fyiRoot: fyi, outputRoot: separateOutput,
            });
        } finally { await rm(root, { recursive: true, force: true }); }
    });
});
