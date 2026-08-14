"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCharacterStateProductShadowConsumer = exports.assertCharacterStateProductShadowArtifactStable = exports.fingerprintCharacterStateProductShadowArtifact = exports.buildCharacterStateProductShadowReport = exports.assertPinnedCharacterStateProductShadowDataset = exports.assertCharacterStateProductShadowSourceBound = exports.createCharacterStateProductShadowLookup = void 0;
const crypto_1 = require("crypto");
const state_product_shadow_contract_1 = require("./state-product-shadow-contract");
const structuralOrder = (left, right) => left.localeCompare(right, undefined, { numeric: true });
const exactKeys = (value, keys) => JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
const clone = (value) => JSON.parse(JSON.stringify(value));
function deepFreeze(value) {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
        Object.values(value).forEach(item => deepFreeze(item));
        Object.freeze(value);
    }
    return value;
}
function frozenClone(value) { return deepFreeze(clone(value)); }
function assertDatasetBoundary(dataset) {
    if (!dataset || dataset.contract !== "dokkan-database-character-state-product-projection" || dataset.contractVersion !== "1.0.0"
        || !dataset.policy?.structuralIdsOnly || dataset.policy.presentationIncluded || dataset.policy.characterArrayIncluded
        || dataset.policy.characterArrayReturned || dataset.policy.characterArrayModified)
        throw new Error("K44 K43 structural dataset boundary rejected");
    const allowedState = ["stateId", "sourceStateKey", "cardId", "formId", "releaseState", "growthRowId", "growthStep", "hardDuplicateGroupId"];
    const allowedRelease = ["transitionId", "cardId", "sourceStateId", "targetStateId", "releaseState", "growthRowId", "growthStep", "routeRowIds"];
    const allowedAwakening = ["transitionId", "kind", "sourceCardId", "targetCardId", "sourceStateId", "targetStateId", "cardIdentityPolicy", "routeRowId"];
    const allowedForm = ["transitionId", "kind", "channel", "sourceCardId", "targetCardId", "sourceSkillId", "sourceSkillSetId", "sourceStateIds", "reversible"];
    if (dataset.states.some(item => !exactKeys(item, allowedState))
        || dataset.releaseTransitions.some(item => !exactKeys(item, allowedRelease))
        || dataset.awakeningTransitions.some(item => !exactKeys(item, allowedAwakening))
        || dataset.formTransitions.some(item => !exactKeys(item, allowedForm)))
        throw new Error("K44 presentation or extra projection field rejected");
}
function indexDataset(dataset) {
    assertDatasetBoundary(dataset);
    const statesById = new Map();
    const stateIdsByCard = new Map();
    for (const state of dataset.states) {
        if (statesById.has(state.stateId))
            throw new Error(`K44 duplicate stateId ${state.stateId}`);
        statesById.set(state.stateId, frozenClone(state));
        stateIdsByCard.set(state.cardId, [...(stateIdsByCard.get(state.cardId) ?? []), state.stateId]);
    }
    const transitionsById = new Map();
    const transitionIdsByCard = new Map();
    const acceptTransition = (transition, cardIds) => {
        const transitionId = transition.record.transitionId;
        if (transitionsById.has(transitionId))
            throw new Error(`K44 duplicate transitionId ${transitionId}`);
        transitionsById.set(transitionId, deepFreeze(transition));
        for (const cardId of [...new Set(cardIds)])
            transitionIdsByCard.set(cardId, [...(transitionIdsByCard.get(cardId) ?? []), transitionId]);
    };
    dataset.releaseTransitions.forEach(record => acceptTransition({ transitionType: "release", record: frozenClone(record) }, [record.cardId]));
    dataset.awakeningTransitions.forEach(record => acceptTransition({ transitionType: "awakening", record: frozenClone(record) }, [record.sourceCardId, record.targetCardId]));
    dataset.formTransitions.forEach(record => acceptTransition({ transitionType: "form", record: frozenClone(record) }, [record.sourceCardId, record.targetCardId]));
    const stateIdsByCardId = new Map([...stateIdsByCard.entries()].map(([cardId, ids]) => [cardId, deepFreeze(ids.sort(structuralOrder))]));
    const transitionIdsByCardId = new Map([...transitionIdsByCard.entries()].map(([cardId, ids]) => [cardId, deepFreeze(ids.sort(structuralOrder))]));
    const inventory = deepFreeze({
        stateByIdCount: statesById.size,
        stateCardIdCount: stateIdsByCardId.size,
        transitionByIdCount: transitionsById.size,
        transitionCardIdCount: transitionIdsByCardId.size,
    });
    return { statesById, stateIdsByCardId, transitionsById, transitionIdsByCardId, inventory };
}
function createCharacterStateProductShadowLookup(dataset) {
    const index = indexDataset(dataset);
    const lookup = {
        getStateByStateId: stateId => {
            const value = index.statesById.get(stateId);
            return value ? frozenClone(value) : null;
        },
        getStatesByCardId: cardId => deepFreeze((index.stateIdsByCardId.get(cardId) ?? []).map(stateId => frozenClone(index.statesById.get(stateId)))),
        getTransitionByTransitionId: transitionId => {
            const value = index.transitionsById.get(transitionId);
            return value ? frozenClone(value) : null;
        },
        getTransitionsByCardId: cardId => deepFreeze((index.transitionIdsByCardId.get(cardId) ?? []).map(transitionId => frozenClone(index.transitionsById.get(transitionId)))),
        inventory: () => frozenClone(index.inventory),
    };
    return deepFreeze(lookup);
}
exports.createCharacterStateProductShadowLookup = createCharacterStateProductShadowLookup;
function assertCharacterStateProductShadowSourceBound(value) {
    if (!value || typeof value !== "object" || value.sourceBoundValidation !== "GO") {
        throw new Error("K44 requires source-bound K43 validation GO");
    }
}
exports.assertCharacterStateProductShadowSourceBound = assertCharacterStateProductShadowSourceBound;
function assertPinnedCharacterStateProductShadowDataset(dataset) {
    const pin = state_product_shadow_contract_1.CHARACTER_STATE_PRODUCT_SHADOW_PIN;
    if (dataset.states.length !== pin.states || dataset.releaseTransitions.length !== pin.releaseTransitions
        || dataset.awakeningTransitions.length !== pin.awakeningTransitions || dataset.formTransitions.length !== pin.formTransitions
        || dataset.releaseTransitions.length + dataset.awakeningTransitions.length + dataset.formTransitions.length !== pin.allTransitions
        || dataset.source.k7ProductionCoverage.agreement !== pin.k7ProductionAgreement
        || dataset.source.k7ProductionCoverage.unjoinable !== pin.k7ProductionUnjoinable
        || dataset.source.k7ProductionCoverage.use !== "coverage_only")
        throw new Error("K44 K43 projection pins changed");
}
exports.assertPinnedCharacterStateProductShadowDataset = assertPinnedCharacterStateProductShadowDataset;
function limited(values) { return [...values].sort(structuralOrder).slice(0, state_product_shadow_contract_1.CHARACTER_STATE_PRODUCT_SHADOW_SAMPLE_LIMIT); }
function buildCharacterStateProductShadowReport(artifacts, lookup) {
    const dataset = artifacts.dataset;
    const manifest = artifacts.manifest;
    const inventory = lookup.inventory();
    const stateCardIds = new Set(dataset.states.map(item => item.cardId));
    const transitionCardIds = new Set();
    dataset.releaseTransitions.forEach(item => transitionCardIds.add(item.cardId));
    dataset.awakeningTransitions.forEach(item => { transitionCardIds.add(item.sourceCardId); transitionCardIds.add(item.targetCardId); });
    dataset.formTransitions.forEach(item => { transitionCardIds.add(item.sourceCardId); transitionCardIds.add(item.targetCardId); });
    return {
        schemaVersion: 1,
        contract: "dokkan-database-character-state-product-shadow-audit",
        contractVersion: state_product_shadow_contract_1.CHARACTER_STATE_PRODUCT_SHADOW_CONTRACT_VERSION,
        mode: "offline_local_explicit_opt_in_stdout_only",
        source: {
            k43ManifestSha256: (0, crypto_1.createHash)("sha256").update(artifacts.manifestBytes).digest("hex"),
            k43PayloadSha256: manifest.sha256,
            k43RawSha256: manifest.uncompressedSha256,
            k42SourceFingerprintSha256: manifest.source.k42.sourceFingerprintSha256,
            sidecars: manifest.source.sidecars,
            production: manifest.source.production,
            fyi: manifest.source.fyi,
            k7ProductionCoverage: manifest.source.k7ProductionCoverage,
        },
        policy: {
            structuralIdsOnly: true, presentationIncluded: false, characterArrayIncluded: false,
            lookupsReturnFrozenClones: true, internalIndexesMutableByCaller: false, persistedConsumerImplemented: false,
            applyOrOverlayImplemented: false, authoritySelected: false, writerImplemented: false, outputArtifactWritten: false,
            networkEnabled: false, publisherImplemented: false, r2Enabled: false, androidImplemented: false,
        },
        counts: {
            states: dataset.states.length, releaseTransitions: dataset.releaseTransitions.length,
            awakeningTransitions: dataset.awakeningTransitions.length, formTransitions: dataset.formTransitions.length,
            allTransitions: dataset.releaseTransitions.length + dataset.awakeningTransitions.length + dataset.formTransitions.length,
        },
        lookupInventory: clone(inventory),
        samples: {
            stateIds: limited(dataset.states.map(item => item.stateId)), stateCardIds: limited(stateCardIds),
            transitionIds: limited([
                ...dataset.releaseTransitions.map(item => item.transitionId), ...dataset.awakeningTransitions.map(item => item.transitionId),
                ...dataset.formTransitions.map(item => item.transitionId),
            ]),
            transitionCardIds: limited(transitionCardIds), limitPerKind: state_product_shadow_contract_1.CHARACTER_STATE_PRODUCT_SHADOW_SAMPLE_LIMIT,
        },
        inputIntegrity: {
            k43ValidatedOnlyBySourceBoundApi: false, sourceBoundValidationBeforeLookup: "NOT_EXECUTED", sourceBoundValidationAfterLookup: "NOT_EXECUTED",
            exactK43ArtifactIdentityStable: false, exactSourceLineageStable: false, reportTimestampIncluded: false,
            reportMaximumBytesExclusive: state_product_shadow_contract_1.CHARACTER_STATE_PRODUCT_SHADOW_REPORT_LIMIT_BYTES,
            rssMaximumBytesExclusive: state_product_shadow_contract_1.CHARACTER_STATE_PRODUCT_SHADOW_RSS_LIMIT_BYTES,
        },
        readiness: {
            consumerShadow: "NOT_EXECUTED", persistedConsumer: "NO-GO", applyOrOverlay: "NO-GO", authority: "NO-GO",
            production: "NO-GO", writer: "NO-GO", publisher: "NO-GO", network: "NO-GO", r2: "NO-GO",
            android: "NO-GO", fyiRemoval: "NO-GO", dokkanInfoRemoval: "NO-GO",
        },
    };
}
exports.buildCharacterStateProductShadowReport = buildCharacterStateProductShadowReport;
function fingerprintCharacterStateProductShadowArtifact(artifacts) {
    const digest = (0, crypto_1.createHash)("sha256");
    for (const bytes of [artifacts.manifestBytes, artifacts.gzip, artifacts.coverageBytes, artifacts.validationBytes]) {
        digest.update(String(bytes.length));
        digest.update(":");
        digest.update(bytes);
    }
    return digest.digest("hex");
}
exports.fingerprintCharacterStateProductShadowArtifact = fingerprintCharacterStateProductShadowArtifact;
function assertCharacterStateProductShadowArtifactStable(beforeFingerprint, afterFingerprint) {
    if (beforeFingerprint !== afterFingerprint)
        throw new Error("K44 K43 artifact changed between source-bound validations");
}
exports.assertCharacterStateProductShadowArtifactStable = assertCharacterStateProductShadowArtifactStable;
function createCharacterStateProductShadowConsumer(artifacts) {
    const lookup = createCharacterStateProductShadowLookup(artifacts.dataset);
    const report = buildCharacterStateProductShadowReport(artifacts, lookup);
    const bytes = Buffer.from(`${JSON.stringify(report, null, 2)}\n`, "utf8");
    if (bytes.length >= state_product_shadow_contract_1.CHARACTER_STATE_PRODUCT_SHADOW_REPORT_LIMIT_BYTES)
        throw new Error(`K44 stdout report byte limit reached: ${bytes.length}`);
    return deepFreeze({ report, lookup });
}
exports.createCharacterStateProductShadowConsumer = createCharacterStateProductShadowConsumer;
//# sourceMappingURL=state-product-shadow.js.map