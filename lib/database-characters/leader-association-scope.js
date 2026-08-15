"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCharacterLeaderAssociationScopeReport = exports.assertPinnedCharacterLeaderAssociationScope = exports.evaluateCharacterLeaderAssociationScope = void 0;
const leader_association_scope_contract_1 = require("./leader-association-scope-contract");
const leader_scope_contract_1 = require("./leader-scope-contract");
const structuralOrder = (left, right) => left.localeCompare(right, undefined, { numeric: true });
const limited = (values) => [...new Set(values)].sort(structuralOrder).slice(0, leader_association_scope_contract_1.CHARACTER_LEADER_ASSOCIATION_SCOPE_SAMPLE_LIMIT);
const idSequenceEqual = (left, right) => Buffer.from(JSON.stringify(left)).equals(Buffer.from(JSON.stringify(right)));
function baseK3Identity(identity) {
    const { associationInputFingerprintSha256: _associationFingerprint, ...base } = identity;
    return base;
}
function pinnedK46K3Identity(k46) {
    const { compactFingerprintSha256: _scopeFingerprint, ...pinned } = k46.k3;
    return pinned;
}
function evaluateCharacterLeaderAssociationScope(k46, k3) {
    if (!k46.policy.sourceReferenceOrderAndMultiplicityPreserved || k46.policy.referencesDeduplicated || k46.policy.effectTargetAssociationsSelected) {
        throw new Error("K47 requires K46 source-order multiplicity boundary");
    }
    if (JSON.stringify(pinnedK46K3Identity(k46.identity)) !== JSON.stringify(baseK3Identity(k3.identity)))
        throw new Error("K47 K46/K3 identity mismatch");
    const k46ByState = new Map(k46.states.map(state => [state.stateId, state]));
    const k3ByState = new Map(k3.states.map(state => [state.stateId, state]));
    if (k46ByState.size !== k46.states.length || k3ByState.size !== k3.states.length)
        throw new Error("K47 duplicate state identity");
    const excluded = k3.states.filter(state => !k46ByState.has(state.stateId)).map(state => state.stateId).sort(structuralOrder);
    if (JSON.stringify(excluded) !== JSON.stringify([...leader_scope_contract_1.CHARACTER_LEADER_SCOPE_EXCLUDED_STATE_IDS]))
        throw new Error("K47 K3/K46 exclusion frontier changed");
    const effects = new Map(k3.effects.map(row => [row.rowId, row]));
    const rawTargets = new Map(k3.targets.map(row => [row.rowId, row]));
    if (effects.size !== k3.effects.length || rawTargets.size !== k3.targets.length)
        throw new Error("K47 duplicate raw row identity");
    const targetsBySet = new Map();
    for (const target of k3.targets)
        targetsBySet.set(target.targetSetId, [...(targetsBySet.get(target.targetSetId) ?? []), target.rowId]);
    let effectAssociations = 0, flattenedTargetReferences = 0, uniqueTargetReferencesWithinState = 0;
    let repeatedFlattenedTargetReferences = 0, repetitionsFromRepeatedTargetSetExpansion = 0;
    let missingEffectRows = 0, missingTargetRows = 0, flattenedTargetMismatchStates = 0;
    const repeatedStateIds = [], repeatedTargetSetIds = [], effectsWithoutTargetSetIds = [];
    for (const state of k46.states) {
        const k3State = k3ByState.get(state.stateId);
        if (!k3State || k3State.sourceStateKey !== state.sourceStateKey || k3State.cardId !== state.cardId
            || k3State.releaseState !== state.releaseState || !idSequenceEqual(k3State.effectRowIds, state.effectRowIds)
            || !idSequenceEqual(k3State.flattenedTargetRowIds, state.flattenedTargetRowIds)) {
            throw new Error(`K47 K3/K46 exact state join mismatch ${state.stateId}`);
        }
        const reconstructed = [];
        const seenTargetSets = new Set();
        for (const effectRowId of state.effectRowIds) {
            effectAssociations++;
            const effect = effects.get(effectRowId);
            if (!effect) {
                missingEffectRows++;
                continue;
            }
            if (effect.targetSetId === null) {
                effectsWithoutTargetSetIds.push(effectRowId);
                continue;
            }
            const targetRowIds = targetsBySet.get(effect.targetSetId) ?? [];
            if (seenTargetSets.has(effect.targetSetId)) {
                repetitionsFromRepeatedTargetSetExpansion += targetRowIds.length;
                if (targetRowIds.length)
                    repeatedTargetSetIds.push(effect.targetSetId);
            }
            seenTargetSets.add(effect.targetSetId);
            reconstructed.push(...targetRowIds);
        }
        missingTargetRows += state.flattenedTargetRowIds.filter(rowId => !rawTargets.has(rowId)).length;
        flattenedTargetReferences += reconstructed.length;
        const uniqueCount = new Set(reconstructed).size;
        uniqueTargetReferencesWithinState += uniqueCount;
        const repeated = reconstructed.length - uniqueCount;
        repeatedFlattenedTargetReferences += repeated;
        if (repeated)
            repeatedStateIds.push(state.stateId);
        if (!idSequenceEqual(reconstructed, state.flattenedTargetRowIds))
            flattenedTargetMismatchStates++;
    }
    return {
        states: k46.states.length, effectAssociations, flattenedTargetReferences, uniqueTargetReferencesWithinState,
        repeatedFlattenedTargetReferences, repetitionsFromRepeatedTargetSetExpansion,
        missingEffectRows, missingTargetRows, flattenedTargetMismatchStates,
        samples: {
            repeatedStateIds: limited(repeatedStateIds), repeatedTargetSetIds: limited(repeatedTargetSetIds),
            effectsWithoutTargetSetIds: limited(effectsWithoutTargetSetIds), limitPerKind: leader_association_scope_contract_1.CHARACTER_LEADER_ASSOCIATION_SCOPE_SAMPLE_LIMIT,
        },
    };
}
exports.evaluateCharacterLeaderAssociationScope = evaluateCharacterLeaderAssociationScope;
function assertPinnedCharacterLeaderAssociationScope(evaluation) {
    const pin = leader_association_scope_contract_1.CHARACTER_LEADER_ASSOCIATION_SCOPE_PIN;
    for (const [label, actual, expected] of [
        ["states", evaluation.states, pin.states], ["effect associations", evaluation.effectAssociations, pin.effectAssociations],
        ["flattened target references", evaluation.flattenedTargetReferences, pin.flattenedTargetReferences],
        ["unique target references", evaluation.uniqueTargetReferencesWithinState, pin.uniqueTargetReferencesWithinState],
        ["repeated target references", evaluation.repeatedFlattenedTargetReferences, pin.repeatedFlattenedTargetReferences],
        ["repeated target-set expansion", evaluation.repetitionsFromRepeatedTargetSetExpansion, pin.repetitionsFromRepeatedTargetSetExpansion],
        ["missing effect rows", evaluation.missingEffectRows, pin.missingEffectRows], ["missing target rows", evaluation.missingTargetRows, pin.missingTargetRows],
        ["flatten mismatch states", evaluation.flattenedTargetMismatchStates, pin.flattenedTargetMismatchStates],
    ])
        if (actual !== expected)
            throw new Error(`K47 ${label} pin changed`);
    if (Object.values(evaluation.samples).some(value => Array.isArray(value) && value.length > leader_association_scope_contract_1.CHARACTER_LEADER_ASSOCIATION_SCOPE_SAMPLE_LIMIT)) {
        throw new Error("K47 sample bound exceeded");
    }
}
exports.assertPinnedCharacterLeaderAssociationScope = assertPinnedCharacterLeaderAssociationScope;
function buildCharacterLeaderAssociationScopeReport(k46, k3, scope) {
    assertPinnedCharacterLeaderAssociationScope(scope);
    const report = {
        schemaVersion: 1,
        contract: "dokkan-database-character-leader-effect-target-association-scope-audit",
        contractVersion: leader_association_scope_contract_1.CHARACTER_LEADER_ASSOCIATION_SCOPE_CONTRACT_VERSION,
        mode: "offline_local_explicit_opt_in_stdout_only",
        sources: { k46, k3 },
        policy: {
            structuralIdsOnly: true, sourceOrderAndMultiplicityPreserved: true, flattenedTargetsComparedByteExact: true,
            repetitionsExplainedByRepeatedTargetSetExpansion: true, semanticAssociationSelected: false,
            percentTextOrValueIncluded: false, payloadWritten: false, consumerImplemented: false,
            applyOrOverlayImplemented: false, authoritySelected: false, productionModified: false, publisherImplemented: false,
            networkEnabled: false, r2Enabled: false, androidImplemented: false,
        },
        scope,
        inputIntegrity: {
            k46SourceBoundBefore: "NOT_EXECUTED", k46SourceBoundAfter: "NOT_EXECUTED", k46IdentityAndFingerprintStable: false,
            k3ExactPinnedBeforeAndAfter: false, k3AssociationFingerprintStable: false, k3DecodeBoundedToPinnedRawSize: false,
            reportTimestampIncluded: false, reportMaximumBytesExclusive: leader_association_scope_contract_1.CHARACTER_LEADER_ASSOCIATION_SCOPE_REPORT_LIMIT_BYTES,
            rssMaximumBytesExclusive: leader_association_scope_contract_1.CHARACTER_LEADER_ASSOCIATION_SCOPE_RSS_LIMIT_BYTES,
        },
        readiness: {
            structuralAssociationScope: "NOT_EXECUTED", nextStructuralIdAssociationProjection: "NOT_EXECUTED", semanticAssociation: "NO-GO",
            leaderClauseSemantics: "NO-GO", presentation: "NO-GO", productProjection: "NO-GO", consumer: "NO-GO",
            applyOrOverlay: "NO-GO", authority: "NO-GO", production: "NO-GO", writer: "NO-GO", publisher: "NO-GO",
            network: "NO-GO", r2: "NO-GO", android: "NO-GO",
        },
    };
    if (Buffer.byteLength(`${JSON.stringify(report, null, 2)}\n`) >= leader_association_scope_contract_1.CHARACTER_LEADER_ASSOCIATION_SCOPE_REPORT_LIMIT_BYTES) {
        throw new Error("K47 report byte limit reached");
    }
    return report;
}
exports.buildCharacterLeaderAssociationScopeReport = buildCharacterLeaderAssociationScopeReport;
//# sourceMappingURL=leader-association-scope.js.map