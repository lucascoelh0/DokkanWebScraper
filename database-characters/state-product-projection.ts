import { constants, Stats } from "fs";
import { createHash } from "crypto";
import { lstat, open, realpath } from "fs/promises";
import { join, resolve } from "path";
import { gunzipSync, gzipSync } from "zlib";
import type { CharacterShadowInputs } from "./shadow-source";
import { loadCharacterShadowInputs } from "./shadow-source";
import {
    assertCharacterStateProductScopePins,
    evaluateCharacterStateProductScope,
    fingerprintCharacterStateProductScopeInputs,
} from "./state-product-scope";
import type { CharacterStateProductScopeReport } from "./state-product-scope-contract";
import { runCharacterStateProductScopeAudit } from "./state-product-scope-run";
import {
    CHARACTER_STATE_PRODUCT_PROJECTION_CONTRACT_VERSION,
    CHARACTER_STATE_PRODUCT_PROJECTION_FILES,
    CHARACTER_STATE_PRODUCT_PROJECTION_GZIP_LIMIT_BYTES,
    CHARACTER_STATE_PRODUCT_PROJECTION_METADATA_LIMIT_BYTES,
    CHARACTER_STATE_PRODUCT_PROJECTION_RAW_LIMIT_BYTES,
    CHARACTER_STATE_PRODUCT_PROJECTION_SAMPLE_LIMIT,
    CharacterStateProductProjectionArtifactSet,
    CharacterStateProductProjectionCoverage,
    CharacterStateProductProjectionDataset,
    CharacterStateProductProjectionLineage,
    CharacterStateProductProjectionManifest,
    CharacterStateProductProjectionValidation,
} from "./state-product-projection-contract";

const hash = (bytes: Buffer | string): string => createHash("sha256").update(bytes).digest("hex");
const jsonBytes = (value: unknown): Buffer => Buffer.from(`${JSON.stringify(value)}\n`, "utf8");
const structuralOrder = (left: string, right: string): number => left.localeCompare(right, undefined, { numeric: true });
const exactKeys = (value: object, keys: readonly string[]): boolean => {
    const actual = Object.keys(value).sort();
    const expected = [...keys].sort();
    return JSON.stringify(actual) === JSON.stringify(expected);
};

function assertK42(k42: CharacterStateProductScopeReport, inputs: CharacterShadowInputs): void {
    if (!k42 || k42.contract !== "dokkan-database-character-state-product-scope-audit" || k42.contractVersion !== "1.0.0"
        || k42.readiness.scopeAudit !== "GO" || k42.readiness.nextSupportedOnlyProjection !== "GO"
        || k42.readiness.productProjection !== "NOT_EXECUTED") throw new Error("K43 requires K42 audit GO");
    assertCharacterStateProductScopePins(k42.scope);
    if (k42.sources.fingerprintSha256 !== fingerprintCharacterStateProductScopeInputs(inputs)) {
        throw new Error("K43 K42/source fingerprint mismatch");
    }
}

function assertInputsMatchK42Audit(k42: CharacterStateProductScopeReport, inputs: CharacterShadowInputs, context: string): void {
    const actual = {
        fingerprintSha256: fingerprintCharacterStateProductScopeInputs(inputs),
        sidecars: inputs.sidecarIdentities,
        production: { sha256: inputs.production.sha256, sizeBytes: inputs.production.sizeBytes, topLevelCount: inputs.production.topLevelCount },
        fyi: { sha256: inputs.fyi.sha256, sizeBytes: inputs.fyi.sizeBytes, topLevelCount: inputs.fyi.topLevelCount },
    };
    if (JSON.stringify(actual) !== JSON.stringify(k42.sources)) throw new Error(`K43 source identities or fingerprint changed ${context}`);
}

function lineage(inputs: CharacterShadowInputs, k42: CharacterStateProductScopeReport): CharacterStateProductProjectionLineage {
    return {
        k42: {
            contractVersion: "1.0.0",
            scopeAudit: "GO",
            nextSupportedOnlyProjection: "GO",
            sourceFingerprintSha256: k42.sources.fingerprintSha256,
        },
        sidecars: inputs.sidecarIdentities,
        production: { sha256: inputs.production.sha256, sizeBytes: inputs.production.sizeBytes, topLevelCount: inputs.production.topLevelCount },
        fyi: { sha256: inputs.fyi.sha256, sizeBytes: inputs.fyi.sizeBytes, topLevelCount: inputs.fyi.topLevelCount },
        k7ProductionCoverage: { agreement: 4_296, unjoinable: 1_463, use: "coverage_only" },
    };
}

export function projectSupportedCharacterStateProductRecords(inputs: CharacterShadowInputs): {
    records: Pick<CharacterStateProductProjectionDataset, "states" | "releaseTransitions" | "awakeningTransitions" | "formTransitions">;
    coverage: CharacterStateProductProjectionCoverage;
} {
    const scope = evaluateCharacterStateProductScope(inputs);
    const k0States = new Map<string, CharacterShadowInputs["k0"]["states"][number]>();
    for (const state of inputs.k0.states) {
        if (k0States.has(state.stateId)) throw new Error(`K43 duplicate K0 state identity ${state.stateId}`);
        k0States.set(state.stateId, state);
    }
    const states = inputs.k1.states.flatMap(state => {
        const identity = k0States.get(state.stateId);
        if (state.releaseState === "unknown" || identity?.evidenceStatus !== "supported") return [];
        const releaseState: "initial" | "eza" | "seza" = state.releaseState;
        if (identity.cardId !== state.cardId || identity.sourceStateKey !== state.sourceStateKey || identity.releaseState !== state.releaseState) {
            throw new Error(`K43 K0/K1 state binding mismatch ${state.stateId}`);
        }
        return [{
            stateId: state.stateId,
            sourceStateKey: state.sourceStateKey,
            cardId: state.cardId,
            formId: identity.formId,
            releaseState,
            growthRowId: state.growthRowId ?? null,
            growthStep: state.growthStep ?? null,
            hardDuplicateGroupId: state.hardDuplicateGroupId,
        }];
    }).sort((left, right) => structuralOrder(left.stateId, right.stateId));
    const releaseTransitions = inputs.k1.releaseStateTransitions.flatMap(item => item.evidenceStatus === "supported"
        && item.releaseState !== "unknown" ? [{
            transitionId: item.transitionId, cardId: item.cardId, sourceStateId: item.sourceStateId,
            targetStateId: item.targetStateId, releaseState: item.releaseState, growthRowId: item.growthRowId,
            growthStep: item.growthStep, routeRowIds: [...item.routeRowIds].sort(structuralOrder),
        }] : []).sort((left, right) => structuralOrder(left.transitionId, right.transitionId));
    const awakeningTransitions = inputs.k1.awakeningTransitions.flatMap(item => item.targetStatus === "supported"
        && item.kind !== "unknown" && item.cardIdentityPolicy !== "unknown" ? [{
            transitionId: item.transitionId, kind: item.kind, sourceCardId: item.sourceCardId, targetCardId: item.targetCardId,
            sourceStateId: item.sourceStateId ?? null, targetStateId: item.targetStateId ?? null,
            cardIdentityPolicy: item.cardIdentityPolicy, routeRowId: item.route.rowId,
        }] : []).sort((left, right) => structuralOrder(left.transitionId, right.transitionId));
    const formTransitions = inputs.k1.formTransitions.flatMap(item => item.stateBindingStatus === "supported"
        && item.kind !== "unknown" ? [{
            transitionId: item.transitionId, kind: item.kind, channel: item.channel, sourceCardId: item.sourceCardId,
            targetCardId: item.targetCardId, sourceSkillId: item.sourceSkillId, sourceSkillSetId: item.sourceSkillSetId ?? null,
            sourceStateIds: [...item.sourceStateIds].sort(structuralOrder), reversible: item.reversible,
        }] : []).sort((left, right) => structuralOrder(left.transitionId, right.transitionId));
    const coverage: CharacterStateProductProjectionCoverage = {
        schemaVersion: 1,
        contract: "dokkan-database-character-state-product-projection-coverage",
        contractVersion: CHARACTER_STATE_PRODUCT_PROJECTION_CONTRACT_VERSION,
        states: scope.states,
        releaseTransitions: scope.releaseTransitions,
        awakeningTransitions: scope.awakeningTransitions,
        formTransitions: scope.formTransitions,
        k7ProductionCoverage: scope.productionCoverage,
        excludedStructuralIds: { ...scope.excludedStructuralIds, limitPerScope: CHARACTER_STATE_PRODUCT_PROJECTION_SAMPLE_LIMIT },
    };
    return { records: { states, releaseTransitions, awakeningTransitions, formTransitions }, coverage };
}

export function buildCharacterStateProductProjection(
    inputs: CharacterShadowInputs,
    k42: CharacterStateProductScopeReport,
): { dataset: CharacterStateProductProjectionDataset; coverage: CharacterStateProductProjectionCoverage } {
    assertK42(k42, inputs);
    const projected = projectSupportedCharacterStateProductRecords(inputs);
    const dataset: CharacterStateProductProjectionDataset = {
        schemaVersion: 1,
        contract: "dokkan-database-character-state-product-projection",
        contractVersion: CHARACTER_STATE_PRODUCT_PROJECTION_CONTRACT_VERSION,
        mode: "explicit_opt_in_offline_local_supported_only",
        source: lineage(inputs, k42),
        policy: {
            structuralIdsOnly: true, presentationIncluded: false, supportedOnly: true, unknownIncluded: false, partialIncluded: false,
            k7ProductionCoverageFiltersRecords: false, characterArrayIncluded: false, characterArrayReturned: false,
            characterArrayModified: false, consumerImplemented: false,
            applyOrOverlayImplemented: false, authoritySelected: false, productionModified: false, publisherImplemented: false,
            networkEnabled: false, androidImplemented: false,
        },
        ...projected.records,
    };
    return { dataset, coverage: projected.coverage };
}

function duplicates(values: string[]): number { return values.length - new Set(values).size; }
function unstable(values: string[]): number {
    const sorted = [...values].sort(structuralOrder);
    return values.reduce((count, value, index) => count + (value === sorted[index] ? 0 : 1), 0);
}

export function validateCharacterStateProductProjection(
    dataset: CharacterStateProductProjectionDataset,
    coverage: CharacterStateProductProjectionCoverage,
    sizes: { rawSizeBytes: number; gzipSizeBytes: number; metadataSizeBytes: number },
): CharacterStateProductProjectionValidation {
    const failures: string[] = [];
    const expectedDatasetKeys = ["schemaVersion", "contract", "contractVersion", "mode", "source", "policy", "states", "releaseTransitions", "awakeningTransitions", "formTransitions"];
    if (!dataset || !exactKeys(dataset, expectedDatasetKeys) || dataset.schemaVersion !== 1
        || dataset.contract !== "dokkan-database-character-state-product-projection"
        || dataset.contractVersion !== CHARACTER_STATE_PRODUCT_PROJECTION_CONTRACT_VERSION
        || dataset.mode !== "explicit_opt_in_offline_local_supported_only") failures.push("dataset contract rejected");
    const source = dataset.source;
    const identityValid = (value: any): boolean => !!value && exactKeys(value, ["sha256", "sizeBytes"])
        && /^[a-f0-9]{64}$/.test(value.sha256) && Number.isInteger(value.sizeBytes) && value.sizeBytes >= 0;
    const externalIdentityValid = (value: any): boolean => !!value && exactKeys(value, ["sha256", "sizeBytes", "topLevelCount"])
        && /^[a-f0-9]{64}$/.test(value.sha256) && Number.isInteger(value.sizeBytes) && value.sizeBytes >= 0
        && Number.isInteger(value.topLevelCount) && value.topLevelCount >= 0;
    if (!source || !exactKeys(source, ["k42", "sidecars", "production", "fyi", "k7ProductionCoverage"])
        || !source.k42 || !exactKeys(source.k42, ["contractVersion", "scopeAudit", "nextSupportedOnlyProjection", "sourceFingerprintSha256"])
        || source.k42.contractVersion !== "1.0.0" || source.k42.scopeAudit !== "GO" || source.k42.nextSupportedOnlyProjection !== "GO"
        || !/^[a-f0-9]{64}$/.test(source.k42.sourceFingerprintSha256)
        || !source.sidecars || !exactKeys(source.sidecars, ["k0", "k1", "k2", "k7"])
        || !(Object.values(source.sidecars) as any[]).every(identityValid)
        || !externalIdentityValid(source.production) || !externalIdentityValid(source.fyi)
        || !source.k7ProductionCoverage || !exactKeys(source.k7ProductionCoverage, ["agreement", "unjoinable", "use"])) {
        failures.push("source lineage rejected");
    }
    const policy = dataset.policy;
    const policyKeys = ["structuralIdsOnly", "presentationIncluded", "supportedOnly", "unknownIncluded", "partialIncluded", "k7ProductionCoverageFiltersRecords", "characterArrayIncluded", "characterArrayReturned", "characterArrayModified", "consumerImplemented", "applyOrOverlayImplemented", "authoritySelected", "productionModified", "publisherImplemented", "networkEnabled", "androidImplemented"];
    if (!policy || !exactKeys(policy, policyKeys) || !Object.values(policy).every(value => value === true || value === false)
        || !policy.structuralIdsOnly || policy.presentationIncluded || !policy.supportedOnly || policy.unknownIncluded
        || policy.partialIncluded || policy.k7ProductionCoverageFiltersRecords || policy.characterArrayIncluded
        || policy.characterArrayReturned || policy.characterArrayModified
        || policy.consumerImplemented || policy.applyOrOverlayImplemented || policy.authoritySelected || policy.productionModified
        || policy.publisherImplemented || policy.networkEnabled || policy.androidImplemented) failures.push("dataset policy rejected");
    const ids = [
        ...dataset.states.map(item => item.stateId), ...dataset.releaseTransitions.map(item => item.transitionId),
        ...dataset.awakeningTransitions.map(item => item.transitionId), ...dataset.formTransitions.map(item => item.transitionId),
    ];
    const duplicateStructuralIdCount = duplicates(ids);
    const unstableOrderCount = unstable(dataset.states.map(item => item.stateId))
        + unstable(dataset.releaseTransitions.map(item => item.transitionId))
        + unstable(dataset.awakeningTransitions.map(item => item.transitionId))
        + unstable(dataset.formTransitions.map(item => item.transitionId));
    const stateIds = new Set(dataset.states.map(item => item.stateId));
    let missingStateReferenceCount = 0;
    dataset.releaseTransitions.forEach(item => {
        if (!stateIds.has(item.sourceStateId)) missingStateReferenceCount++;
        if (!stateIds.has(item.targetStateId)) missingStateReferenceCount++;
    });
    dataset.awakeningTransitions.forEach(item => {
        if (item.sourceStateId && !stateIds.has(item.sourceStateId)) missingStateReferenceCount++;
        if (item.targetStateId && !stateIds.has(item.targetStateId)) missingStateReferenceCount++;
    });
    dataset.formTransitions.forEach(item => item.sourceStateIds.forEach(id => { if (!stateIds.has(id)) missingStateReferenceCount++; }));
    const unsupportedRecordCount = dataset.states.filter(item => item.releaseState === ("unknown" as any)).length
        + dataset.releaseTransitions.filter(item => item.releaseState === ("unknown" as any)).length
        + dataset.awakeningTransitions.filter(item => item.kind === ("unknown" as any) || item.cardIdentityPolicy === ("unknown" as any)).length
        + dataset.formTransitions.filter(item => item.kind === ("unknown" as any) || item.sourceStateIds.length === 0).length;
    let extraOrPresentationFieldCount = 0;
    const exactRecords = <T extends object>(values: T[], keys: string[]) => values.forEach(value => { if (!exactKeys(value, keys)) extraOrPresentationFieldCount++; });
    exactRecords(dataset.states, ["stateId", "sourceStateKey", "cardId", "formId", "releaseState", "growthRowId", "growthStep", "hardDuplicateGroupId"]);
    exactRecords(dataset.releaseTransitions, ["transitionId", "cardId", "sourceStateId", "targetStateId", "releaseState", "growthRowId", "growthStep", "routeRowIds"]);
    exactRecords(dataset.awakeningTransitions, ["transitionId", "kind", "sourceCardId", "targetCardId", "sourceStateId", "targetStateId", "cardIdentityPolicy", "routeRowId"]);
    exactRecords(dataset.formTransitions, ["transitionId", "kind", "channel", "sourceCardId", "targetCardId", "sourceSkillId", "sourceSkillSetId", "sourceStateIds", "reversible"]);
    if (duplicateStructuralIdCount) failures.push("duplicate structural identity");
    if (unstableOrderCount) failures.push("unstable structural order");
    if (missingStateReferenceCount) failures.push("missing state reference");
    if (unsupportedRecordCount) failures.push("unsupported record included");
    if (extraOrPresentationFieldCount) failures.push("extra or presentation field included");
    if (dataset.states.length !== coverage.states.included || dataset.releaseTransitions.length !== coverage.releaseTransitions.included
        || dataset.awakeningTransitions.length !== coverage.awakeningTransitions.included || dataset.formTransitions.length !== coverage.formTransitions.included) {
        failures.push("coverage cardinality mismatch");
    }
    const scopeCounts = [coverage.states, coverage.releaseTransitions, coverage.awakeningTransitions, coverage.formTransitions];
    if (!coverage || coverage.schemaVersion !== 1 || coverage.contract !== "dokkan-database-character-state-product-projection-coverage"
        || coverage.contractVersion !== CHARACTER_STATE_PRODUCT_PROJECTION_CONTRACT_VERSION
        || scopeCounts.some(item => !Number.isInteger(item.included) || item.included < 0 || !Number.isInteger(item.excluded) || item.excluded < 0)
        || [coverage.excludedStructuralIds.stateIds, coverage.excludedStructuralIds.releaseTransitionIds,
            coverage.excludedStructuralIds.awakeningTransitionIds, coverage.excludedStructuralIds.formTransitionIds]
            .some(value => !Array.isArray(value) || value.length > CHARACTER_STATE_PRODUCT_PROJECTION_SAMPLE_LIMIT)
        || coverage.excludedStructuralIds.limitPerScope !== CHARACTER_STATE_PRODUCT_PROJECTION_SAMPLE_LIMIT) failures.push("coverage contract rejected");
    const countIncluded = <T extends string>(values: T[], keys: readonly T[]): Record<T, number> => Object.fromEntries(keys.map(key => [key, values.filter(value => value === key).length])) as Record<T, number>;
    const stateIncluded = countIncluded(dataset.states.map(item => item.releaseState), ["initial", "eza", "seza"] as const);
    const releaseIncluded = countIncluded(dataset.releaseTransitions.map(item => item.releaseState), ["eza", "seza"] as const);
    const awakeningIncluded = countIncluded(dataset.awakeningTransitions.map(item => item.kind), ["z_awaken", "dokkan_awaken", "eza", "seza"] as const);
    const formKindIncluded = countIncluded(dataset.formTransitions.map(item => item.kind), ["transformation", "giant_or_rage", "reversible_exchange"] as const);
    const formChannelIncluded = countIncluded(dataset.formTransitions.map(item => item.channel), ["passive", "active", "standby", "finish"] as const);
    const groupedTotals = (values: Record<string, { included: number; excluded: number }>): { included: number; excluded: number } =>
        Object.values(values).reduce((total, value) => ({ included: total.included + value.included, excluded: total.excluded + value.excluded }), { included: 0, excluded: 0 });
    const sameTotals = (grouped: { included: number; excluded: number }, total: { included: number; excluded: number }): boolean =>
        grouped.included === total.included && grouped.excluded === total.excluded;
    if (Object.entries(stateIncluded).some(([key, count]) => coverage.states.byReleaseState[key as keyof typeof coverage.states.byReleaseState].included !== count)
        || coverage.states.byReleaseState.unknown.included !== 0
        || Object.entries(releaseIncluded).some(([key, count]) => coverage.releaseTransitions.byReleaseState[key as keyof typeof coverage.releaseTransitions.byReleaseState].included !== count)
        || coverage.releaseTransitions.byReleaseState.unknown.included !== 0
        || Object.entries(awakeningIncluded).some(([key, count]) => coverage.awakeningTransitions.byKind[key as keyof typeof coverage.awakeningTransitions.byKind].included !== count)
        || coverage.awakeningTransitions.byKind.unknown.included !== 0
        || Object.entries(formKindIncluded).some(([key, count]) => coverage.formTransitions.byKind[key as keyof typeof coverage.formTransitions.byKind].included !== count)
        || coverage.formTransitions.byKind.unknown.included !== 0
        || Object.entries(formChannelIncluded).some(([key, count]) => coverage.formTransitions.byChannel[key as keyof typeof coverage.formTransitions.byChannel].included !== count)
        || !sameTotals(groupedTotals(coverage.states.byReleaseState), coverage.states)
        || !sameTotals(groupedTotals(coverage.releaseTransitions.byReleaseState), coverage.releaseTransitions)
        || !sameTotals(groupedTotals(coverage.awakeningTransitions.byKind), coverage.awakeningTransitions)
        || !sameTotals(groupedTotals(coverage.formTransitions.byKind), coverage.formTransitions)
        || !sameTotals(groupedTotals(coverage.formTransitions.byChannel), coverage.formTransitions)) {
        failures.push("grouped included coverage mismatch");
    }
    if (!Number.isInteger(coverage.k7ProductionCoverage.agreement) || coverage.k7ProductionCoverage.agreement < 0
        || !Number.isInteger(coverage.k7ProductionCoverage.unjoinable) || coverage.k7ProductionCoverage.unjoinable < 0
        || coverage.k7ProductionCoverage.use !== "coverage_only"
        || dataset.source.k7ProductionCoverage.agreement !== coverage.k7ProductionCoverage.agreement
        || dataset.source.k7ProductionCoverage.unjoinable !== coverage.k7ProductionCoverage.unjoinable
        || dataset.source.k7ProductionCoverage.use !== "coverage_only") failures.push("K7 coverage rejected");
    if (sizes.rawSizeBytes >= CHARACTER_STATE_PRODUCT_PROJECTION_RAW_LIMIT_BYTES) failures.push("raw byte budget reached");
    if (sizes.gzipSizeBytes >= CHARACTER_STATE_PRODUCT_PROJECTION_GZIP_LIMIT_BYTES) failures.push("gzip byte budget reached");
    if (sizes.metadataSizeBytes >= CHARACTER_STATE_PRODUCT_PROJECTION_METADATA_LIMIT_BYTES) failures.push("metadata byte budget reached");
    const uniqueFailures = [...new Set(failures)].sort();
    return {
        schemaVersion: 1,
        contract: "dokkan-database-character-state-product-projection-validation",
        contractVersion: CHARACTER_STATE_PRODUCT_PROJECTION_CONTRACT_VERSION,
        valid: uniqueFailures.length === 0,
        failures: uniqueFailures.slice(0, CHARACTER_STATE_PRODUCT_PROJECTION_SAMPLE_LIMIT),
        failuresTruncated: uniqueFailures.length > CHARACTER_STATE_PRODUCT_PROJECTION_SAMPLE_LIMIT,
        sizes: {
            rawMaximumBytesExclusive: CHARACTER_STATE_PRODUCT_PROJECTION_RAW_LIMIT_BYTES,
            gzipMaximumBytesExclusive: CHARACTER_STATE_PRODUCT_PROJECTION_GZIP_LIMIT_BYTES,
            metadataMaximumBytesExclusive: CHARACTER_STATE_PRODUCT_PROJECTION_METADATA_LIMIT_BYTES,
            ...sizes,
        },
        safety: {
            duplicateStructuralIdCount, unstableOrderCount, missingStateReferenceCount, unsupportedRecordCount,
            extraOrPresentationFieldCount, characterArrayRecordCount: 0, networkRequestCount: 0,
            outputNamespaceThreatModel: "caller_controlled_stable_during_operation",
        },
        readiness: {
            offlineGeneration: "GO", sourceBoundValidation: "NOT_EXECUTED", consumer: "NO-GO", applyOrOverlay: "NO-GO",
            authority: "NO-GO", production: "NO-GO", publisher: "NO-GO", r2: "NO-GO", android: "NO-GO",
            fyiRemoval: "NO-GO", dokkanInfoRemoval: "NO-GO",
        },
    };
}

export function materializeCharacterStateProductProjection(
    dataset: CharacterStateProductProjectionDataset,
    coverage: CharacterStateProductProjectionCoverage,
): CharacterStateProductProjectionArtifactSet {
    const raw = jsonBytes(dataset);
    const gzip = gzipSync(raw, { level: 9 });
    const coverageBytes = jsonBytes(coverage);
    const payloadSha256 = hash(gzip);
    let metadataSizeBytes = 0;
    for (let attempt = 0; attempt < 8; attempt++) {
        const validation = validateCharacterStateProductProjection(dataset, coverage, {
            rawSizeBytes: raw.length, gzipSizeBytes: gzip.length, metadataSizeBytes,
        });
        if (!validation.valid) throw new Error(`K43 projection validation failed: ${validation.failures.join("; ")}`);
        const validationBytes = jsonBytes(validation);
        const manifest: CharacterStateProductProjectionManifest = {
            schemaVersion: 1,
            contract: "dokkan-database-character-state-product-projection-manifest",
            contractVersion: CHARACTER_STATE_PRODUCT_PROJECTION_CONTRACT_VERSION,
            fileName: `database-characters-k43-state-product-projection.${payloadSha256}.json.gz`,
            compression: "gzip", sha256: payloadSha256, sizeBytes: gzip.length,
            uncompressedSha256: hash(raw), uncompressedSizeBytes: raw.length,
            counts: { states: dataset.states.length, releaseTransitions: dataset.releaseTransitions.length, awakeningTransitions: dataset.awakeningTransitions.length, formTransitions: dataset.formTransitions.length },
            source: dataset.source,
            coverageFile: CHARACTER_STATE_PRODUCT_PROJECTION_FILES.coverage,
            coverageSha256: hash(coverageBytes), coverageSizeBytes: coverageBytes.length,
            validationFile: CHARACTER_STATE_PRODUCT_PROJECTION_FILES.validation,
            validationSha256: hash(validationBytes), validationSizeBytes: validationBytes.length,
        };
        const manifestBytes = jsonBytes(manifest);
        const actualMetadataSizeBytes = coverageBytes.length + validationBytes.length + manifestBytes.length;
        if (actualMetadataSizeBytes >= CHARACTER_STATE_PRODUCT_PROJECTION_METADATA_LIMIT_BYTES) throw new Error(`K43 metadata byte budget reached: ${actualMetadataSizeBytes}`);
        if (actualMetadataSizeBytes === metadataSizeBytes) {
            return { dataset, coverage, validation, manifest, raw, gzip, coverageBytes, validationBytes, manifestBytes };
        }
        metadataSizeBytes = actualMetadataSizeBytes;
    }
    throw new Error("K43 metadata size did not converge");
}

function samePath(left: string, right: string): boolean {
    return process.platform === "win32" ? resolve(left).toLowerCase() === resolve(right).toLowerCase() : resolve(left) === resolve(right);
}
function sameFile(left: Stats, right: Stats): boolean { return left.dev === right.dev && left.ino === right.ino; }

async function regularRoot(value: string): Promise<string> {
    const root = resolve(value);
    const before = await lstat(root);
    if (!before.isDirectory() || before.isSymbolicLink()) throw new Error("K43 artifact root must be an existing regular non-link directory");
    const canonical = await realpath(root);
    if (!samePath(root, canonical)) throw new Error("K43 artifact root symlink or junction rejected");
    return canonical;
}

async function readMember(rootValue: string, fileName: string): Promise<Buffer> {
    const root = await regularRoot(rootValue);
    if (!/^[a-z0-9][a-z0-9.-]+$/.test(fileName) || fileName.includes("..") || fileName.includes("/") || fileName.includes("\\")) throw new Error("K43 artifact member name rejected");
    const path = join(root, fileName);
    if (!samePath(path, resolve(root, fileName))) throw new Error("K43 artifact member escaped root");
    const before = await lstat(path);
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1) throw new Error("K43 artifact member must be a single-link regular file");
    const handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try {
        const opened = await handle.stat();
        if (!sameFile(before, opened)) throw new Error("K43 artifact member identity changed while opening");
        const bytes = await handle.readFile();
        const after = await handle.stat();
        const pathAfter = await lstat(path);
        if (!sameFile(opened, after) || !sameFile(opened, pathAfter) || bytes.length !== after.size || after.nlink !== 1) throw new Error("K43 artifact member changed while reading");
        return bytes;
    } finally { await handle.close(); }
}

async function readArtifactSet(root: string): Promise<CharacterStateProductProjectionArtifactSet> {
    const manifestBytes = await readMember(root, CHARACTER_STATE_PRODUCT_PROJECTION_FILES.manifest);
    const manifest = JSON.parse(manifestBytes.toString("utf8")) as CharacterStateProductProjectionManifest;
    if (!/^database-characters-k43-state-product-projection\.[a-f0-9]{64}\.json\.gz$/.test(manifest.fileName)
        || manifest.fileName.split(".")[1] !== manifest.sha256) throw new Error("K43 manifest payload identity rejected");
    const [gzip, coverageBytes, validationBytes] = await Promise.all([
        readMember(root, manifest.fileName), readMember(root, manifest.coverageFile), readMember(root, manifest.validationFile),
    ]);
    if (gzip.length !== manifest.sizeBytes || hash(gzip) !== manifest.sha256 || gzip.length >= CHARACTER_STATE_PRODUCT_PROJECTION_GZIP_LIMIT_BYTES
        || coverageBytes.length !== manifest.coverageSizeBytes || hash(coverageBytes) !== manifest.coverageSha256
        || validationBytes.length !== manifest.validationSizeBytes || hash(validationBytes) !== manifest.validationSha256) throw new Error("K43 artifact identity rejected");
    const raw = gunzipSync(gzip, { maxOutputLength: CHARACTER_STATE_PRODUCT_PROJECTION_RAW_LIMIT_BYTES });
    if (raw.length !== manifest.uncompressedSizeBytes || hash(raw) !== manifest.uncompressedSha256 || raw.length >= CHARACTER_STATE_PRODUCT_PROJECTION_RAW_LIMIT_BYTES) throw new Error("K43 raw artifact identity rejected");
    const dataset = JSON.parse(raw.toString("utf8")) as CharacterStateProductProjectionDataset;
    const coverage = JSON.parse(coverageBytes.toString("utf8")) as CharacterStateProductProjectionCoverage;
    const validation = JSON.parse(validationBytes.toString("utf8")) as CharacterStateProductProjectionValidation;
    if (!raw.equals(jsonBytes(dataset)) || !gzip.equals(gzipSync(raw, { level: 9 }))) throw new Error("K43 canonical payload rejected");
    const rebuilt = materializeCharacterStateProductProjection(dataset, coverage);
    if (!rebuilt.raw.equals(raw) || !rebuilt.gzip.equals(gzip) || !rebuilt.coverageBytes.equals(coverageBytes)
        || !rebuilt.validationBytes.equals(validationBytes) || !rebuilt.manifestBytes.equals(manifestBytes)
        || JSON.stringify(validation) !== JSON.stringify(rebuilt.validation)) throw new Error("K43 artifact reconstruction rejected");
    return rebuilt;
}

export interface CharacterStateProductProjectionSourceOptions {
    sidecarRoot: string;
    productionRoot: string;
    fyiRoot: string;
}

export async function validateCharacterStateProductProjectionArtifact(
    options: CharacterStateProductProjectionSourceOptions & { artifactRoot: string },
): Promise<{ artifacts: CharacterStateProductProjectionArtifactSet; sourceBoundValidation: "GO" }> {
    const k42 = await runCharacterStateProductScopeAudit({ optIn: true, sidecarRoot: options.sidecarRoot, productionRoot: options.productionRoot, fyiRoot: options.fyiRoot });
    if (global.gc) global.gc();
    let before: CharacterShadowInputs | undefined = await loadCharacterShadowInputs(options);
    const built = buildCharacterStateProductProjection(before, k42);
    before = undefined;
    if (global.gc) global.gc();
    let after: CharacterShadowInputs | undefined = await loadCharacterShadowInputs(options);
    assertInputsMatchK42Audit(k42, after, "during source-bound validation");
    after = undefined;
    if (global.gc) global.gc();
    const expected = materializeCharacterStateProductProjection(built.dataset, built.coverage);
    const actual = await readArtifactSet(options.artifactRoot);
    for (const [label, actualBytes, expectedBytes] of [
        ["payload", actual.gzip, expected.gzip], ["coverage", actual.coverageBytes, expected.coverageBytes],
        ["validation", actual.validationBytes, expected.validationBytes], ["manifest", actual.manifestBytes, expected.manifestBytes],
    ] as Array<[string, Buffer, Buffer]>) if (!actualBytes.equals(expectedBytes)) throw new Error(`K43 source-bound artifact mismatch: ${label}`);
    const reread = await readArtifactSet(options.artifactRoot);
    if (!actual.gzip.equals(reread.gzip) || !actual.coverageBytes.equals(reread.coverageBytes)
        || !actual.validationBytes.equals(reread.validationBytes) || !actual.manifestBytes.equals(reread.manifestBytes)) {
        throw new Error("K43 artifact changed during source-bound validation");
    }
    let finalSources: CharacterShadowInputs | undefined = await loadCharacterShadowInputs(options);
    assertInputsMatchK42Audit(k42, finalSources, "after artifact reread");
    finalSources = undefined;
    if (global.gc) global.gc();
    return { artifacts: reread, sourceBoundValidation: "GO" };
}
