"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCharacterLeaderScopeReport = exports.assertPinnedCharacterLeaderScope = exports.evaluateCharacterLeaderStructuralScope = void 0;
const leader_scope_contract_1 = require("./leader-scope-contract");
const structuralOrder = (left, right) => left.localeCompare(right, undefined, { numeric: true });
const exactKeys = (value, keys) => JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
const limited = (values) => [...values].sort(structuralOrder).slice(0, leader_scope_contract_1.CHARACTER_LEADER_SCOPE_SAMPLE_LIMIT);
function validRef(ref) {
    return !!ref && exactKeys(ref, ["table", "rowId"]) && typeof ref.table === "string" && !!ref.table && typeof ref.rowId === "string" && !!ref.rowId;
}
function validateK43State(state) {
    if (!state || !exactKeys(state, ["stateId", "sourceStateKey", "cardId", "releaseState"])
        || !state.stateId || !state.sourceStateKey || !state.cardId || !["initial", "eza", "seza"].includes(state.releaseState)) {
        throw new Error("K45 malformed or presentation-bearing K43 state");
    }
}
function validateK3State(state) {
    if (!state || !exactKeys(state, ["stateId", "sourceStateKey", "cardId", "releaseState", "leader"])
        || !state.stateId || !state.sourceStateKey || !state.cardId || !["initial", "eza", "seza", "unknown"].includes(state.releaseState)
        || !state.leader || !exactKeys(state.leader, ["set", "effects", "targets", "structuredPercentValues"])
        || !validRef(state.leader.set) || !Array.isArray(state.leader.effects) || !state.leader.effects.every(validRef)
        || !Array.isArray(state.leader.targets) || !state.leader.targets.every(validRef)
        || !Array.isArray(state.leader.structuredPercentValues)
        || state.leader.structuredPercentValues.some(value => typeof value !== "number" || !Number.isFinite(value))) {
        throw new Error("K45 malformed or presentation-bearing K3 leader state");
    }
}
function evaluateCharacterLeaderStructuralScope(k43States, k3States) {
    if (!Array.isArray(k43States) || !Array.isArray(k3States))
        throw new Error("K45 requires K43 and K3 state arrays");
    k43States.forEach(validateK43State);
    k3States.forEach(validateK3State);
    const k43Ids = k43States.map(item => item.stateId);
    const k3Ids = k3States.map(item => item.stateId);
    if (new Set(k43Ids).size !== k43Ids.length)
        throw new Error("K45 duplicate K43 stateId");
    if (new Set(k3Ids).size !== k3Ids.length)
        throw new Error("K45 duplicate K3 stateId");
    const k43ById = new Map(k43States.map(item => [item.stateId, item]));
    const k3ById = new Map(k3States.map(item => [item.stateId, item]));
    const excluded = k3States.filter(item => !k43ById.has(item.stateId)).sort((left, right) => structuralOrder(left.stateId, right.stateId));
    if (JSON.stringify(excluded.map(item => item.stateId)) !== JSON.stringify([...leader_scope_contract_1.CHARACTER_LEADER_SCOPE_EXCLUDED_STATE_IDS])
        || excluded.some(item => item.releaseState !== "unknown"))
        throw new Error("K45 K3/K43 exclusion frontier changed");
    for (const k43 of k43States) {
        const k3 = k3ById.get(k43.stateId);
        if (!k3 || k3.sourceStateKey !== k43.sourceStateKey || k3.cardId !== k43.cardId || k3.releaseState !== k43.releaseState) {
            throw new Error(`K45 K3/K43 exact state join mismatch ${k43.stateId}`);
        }
    }
    const included = k43States.map(item => k3ById.get(item.stateId));
    const uniqueSets = new Set();
    let effectReferences = 0, targetReferences = 0, structuredPercentValues = 0;
    let multiEffectStates = 0, multiTargetStates = 0, multiPercentStates = 0;
    let maximumEffectsPerState = 0, maximumTargetsPerState = 0, maximumPercentValuesPerState = 0;
    let emptyEffectStates = 0, emptyTargetStates = 0, emptyPercentStates = 0;
    const multiEffectIds = [], multiTargetIds = [], multiPercentIds = [];
    for (const state of included) {
        const effects = state.leader.effects.length, targets = state.leader.targets.length, percents = state.leader.structuredPercentValues.length;
        uniqueSets.add(JSON.stringify([state.leader.set.table, state.leader.set.rowId]));
        effectReferences += effects;
        targetReferences += targets;
        structuredPercentValues += percents;
        if (effects > 1) {
            multiEffectStates++;
            multiEffectIds.push(state.stateId);
        }
        if (targets > 1) {
            multiTargetStates++;
            multiTargetIds.push(state.stateId);
        }
        if (percents > 1) {
            multiPercentStates++;
            multiPercentIds.push(state.stateId);
        }
        if (effects === 0)
            emptyEffectStates++;
        if (targets === 0)
            emptyTargetStates++;
        if (percents === 0)
            emptyPercentStates++;
        maximumEffectsPerState = Math.max(maximumEffectsPerState, effects);
        maximumTargetsPerState = Math.max(maximumTargetsPerState, targets);
        maximumPercentValuesPerState = Math.max(maximumPercentValuesPerState, percents);
    }
    return {
        includedStates: included.length, excludedStates: excluded.length, excludedStateIds: excluded.map(item => item.stateId),
        uniqueLeaderSetRows: uniqueSets.size, effectReferences, targetReferences, structuredPercentValues,
        multiEffectStates, multiTargetStates, multiPercentStates, maximumEffectsPerState, maximumTargetsPerState,
        maximumPercentValuesPerState, emptyEffectStates, emptyTargetStates, emptyPercentStates,
        samples: {
            multiEffectStateIds: limited(multiEffectIds), multiTargetStateIds: limited(multiTargetIds), multiPercentStateIds: limited(multiPercentIds),
            maximumEffectStateIds: limited(included.filter(item => item.leader.effects.length === maximumEffectsPerState).map(item => item.stateId)),
            maximumTargetStateIds: limited(included.filter(item => item.leader.targets.length === maximumTargetsPerState).map(item => item.stateId)),
            maximumPercentStateIds: limited(included.filter(item => item.leader.structuredPercentValues.length === maximumPercentValuesPerState).map(item => item.stateId)),
            limitPerKind: leader_scope_contract_1.CHARACTER_LEADER_SCOPE_SAMPLE_LIMIT,
        },
    };
}
exports.evaluateCharacterLeaderStructuralScope = evaluateCharacterLeaderStructuralScope;
function assertPinnedCharacterLeaderScope(evaluation) {
    const pin = leader_scope_contract_1.CHARACTER_LEADER_SCOPE_PIN;
    const pairs = [
        ["included states", evaluation.includedStates, pin.includedStates], ["excluded states", evaluation.excludedStates, pin.excludedStates],
        ["unique leader set rows", evaluation.uniqueLeaderSetRows, pin.uniqueLeaderSetRows], ["effect references", evaluation.effectReferences, pin.effectReferences],
        ["target references", evaluation.targetReferences, pin.targetReferences], ["structured percent values", evaluation.structuredPercentValues, pin.structuredPercentValues],
        ["multi-effect states", evaluation.multiEffectStates, pin.multiEffectStates], ["multi-target states", evaluation.multiTargetStates, pin.multiTargetStates],
        ["multi-percent states", evaluation.multiPercentStates, pin.multiPercentStates], ["maximum effects", evaluation.maximumEffectsPerState, pin.maximumEffectsPerState],
        ["maximum targets", evaluation.maximumTargetsPerState, pin.maximumTargetsPerState], ["maximum percentages", evaluation.maximumPercentValuesPerState, pin.maximumPercentValuesPerState],
        ["empty effects", evaluation.emptyEffectStates, pin.emptyEffectStates], ["empty targets", evaluation.emptyTargetStates, pin.emptyTargetStates],
        ["empty percentages", evaluation.emptyPercentStates, pin.emptyPercentStates],
    ];
    for (const [label, actual, expected] of pairs)
        if (actual !== expected)
            throw new Error(`K45 ${label} pin changed`);
    if (JSON.stringify(evaluation.excludedStateIds) !== JSON.stringify([...leader_scope_contract_1.CHARACTER_LEADER_SCOPE_EXCLUDED_STATE_IDS]))
        throw new Error("K45 excluded state IDs changed");
    if (Object.values(evaluation.samples).some(value => Array.isArray(value) && value.length > leader_scope_contract_1.CHARACTER_LEADER_SCOPE_SAMPLE_LIMIT))
        throw new Error("K45 report sample bound exceeded");
}
exports.assertPinnedCharacterLeaderScope = assertPinnedCharacterLeaderScope;
function buildCharacterLeaderScopeReport(k43, k3, scope) {
    assertPinnedCharacterLeaderScope(scope);
    const report = {
        schemaVersion: 1,
        contract: "dokkan-database-character-leader-structural-scope-audit",
        contractVersion: leader_scope_contract_1.CHARACTER_LEADER_SCOPE_CONTRACT_VERSION,
        mode: "offline_local_explicit_opt_in_stdout_only",
        sources: { k43, k3 },
        policy: {
            structuralIdsOnly: true, presentationIncluded: false, rawRowsIncluded: false, leaderClauseSemanticsSelected: false,
            k9PassiveBoundaryFiltersLeaderScope: false, characterArrayIncluded: false, consumerImplemented: false,
            applyOrOverlayImplemented: false, authoritySelected: false, productionModified: false, writerImplemented: false,
            outputArtifactWritten: false, publisherImplemented: false, networkEnabled: false, r2Enabled: false, androidImplemented: false,
        },
        scope,
        passiveComparisonBoundary: { channel: "C2_C3_passive_mechanics_comparison", c3UnknownRuleCount: 59, usedToFilterLeaderScope: false, k9ReadinessChanged: false },
        inputIntegrity: {
            k43SourceBoundBefore: "NOT_EXECUTED", k43SourceBoundAfter: "NOT_EXECUTED", k43IdentityAndFingerprintStable: false,
            k3ExactPinnedFilesBeforeAndAfter: false, k3IdentityAndFingerprintStable: false, k3DecodeBoundedToPinnedRawSize: false,
            reportTimestampIncluded: false, reportMaximumBytesExclusive: leader_scope_contract_1.CHARACTER_LEADER_SCOPE_REPORT_LIMIT_BYTES,
            rssMaximumBytesExclusive: leader_scope_contract_1.CHARACTER_LEADER_SCOPE_RSS_LIMIT_BYTES,
        },
        readiness: {
            structuralScope: "NOT_EXECUTED", nextStructuralIdOnlyProjection: "NOT_EXECUTED", leaderClauseOrVsSumSemantics: "NO-GO", localizedText: "NO-GO",
            productReplacement: "NO-GO", consumer: "NO-GO", applyOrOverlay: "NO-GO", authority: "NO-GO", production: "NO-GO",
            writer: "NO-GO", publisher: "NO-GO", network: "NO-GO", r2: "NO-GO", android: "NO-GO",
            fyiRemoval: "NO-GO", dokkanInfoRemoval: "NO-GO",
        },
    };
    if (Buffer.byteLength(`${JSON.stringify(report, null, 2)}\n`) >= leader_scope_contract_1.CHARACTER_LEADER_SCOPE_REPORT_LIMIT_BYTES)
        throw new Error("K45 report byte limit reached");
    return report;
}
exports.buildCharacterLeaderScopeReport = buildCharacterLeaderScopeReport;
//# sourceMappingURL=leader-scope.js.map