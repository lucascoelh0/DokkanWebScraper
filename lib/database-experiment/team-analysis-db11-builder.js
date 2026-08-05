"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDatabaseTeamAnalysisDb11Coverage = exports.buildDatabaseTeamAnalysisDb11Dataset = void 0;
function object(value) { return value !== null && typeof value === "object" && !Array.isArray(value) ? value : undefined; }
function integer(value) {
    const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
    return Number.isSafeInteger(parsed) ? parsed : undefined;
}
function statusCounts(values) { return { supported: values.filter(value => value === "supported").length, partial: values.filter(value => value === "partial").length, unknown: values.filter(value => value === "unknown").length }; }
function combineStatus(condition, effect) {
    if (condition === "supported" && effect === "supported")
        return "supported";
    if (condition === "unknown" && effect === "unknown")
        return "unknown";
    return "partial";
}
function validateSupportedResolution(resolution) {
    const expected = {
        43: { operation: "dodge_success", comparator: "eq_true", parameterReads: [], ignoredParameters: ["cau_val1", "cau_val2", "cau_val3"], gate: null },
        51: { operation: "turns_from_appearance", comparator: "lte", parameterReads: ["cau_val1"], ignoredParameters: ["cau_val2", "cau_val3"], gate: "appearance_initialized" },
        55: { operation: "turns_from_appearance", comparator: "gt", parameterReads: ["cau_val1"], ignoredParameters: ["cau_val2", "cau_val3"], gate: "appearance_initialized" },
    }[resolution.causalityType];
    if (!expected || resolution.status !== "supported" || resolution.unknowns.length > 0 ||
        resolution.operation !== expected.operation || resolution.comparator !== expected.comparator || resolution.gate !== expected.gate ||
        JSON.stringify(resolution.parameterReads) !== JSON.stringify(expected.parameterReads) ||
        JSON.stringify(resolution.ignoredParameters) !== JSON.stringify(expected.ignoredParameters)) {
        throw new Error(`DB11 unsupported DB10 semantic shape for causality ${resolution.causalityType}`);
    }
}
function conditionStatus(expression) {
    if (expression.op === "always")
        return "supported";
    if (expression.op === "unknown")
        return "unknown";
    if (expression.op === "predicate")
        return expression.predicate.kind === "qualifying_unit_count" ? expression.predicate.semanticStatus : "supported";
    if (expression.op === "not")
        return conditionStatus(expression.child);
    const statuses = expression.children.map(conditionStatus);
    return statuses.every(value => value === "supported") ? "supported" : statuses.every(value => value === "unknown") ? "unknown" : "partial";
}
function unknownCount(expression, causalityType) {
    if (expression.op === "unknown")
        return integer(expression.causalityType ?? object(expression.raw)?.causality_type) === causalityType ? 1 : 0;
    if (expression.op === "not")
        return unknownCount(expression.child, causalityType);
    if (expression.op === "all" || expression.op === "any")
        return expression.children.reduce((sum, child) => sum + unknownCount(child, causalityType), 0);
    return 0;
}
function projection(expression, resolution) {
    const raw = object(expression.raw);
    const causalityId = expression.causalityId ?? (raw?.id === undefined ? undefined : String(raw.id));
    if (!causalityId || !resolution.causalityIds.includes(causalityId))
        return { condition: expression };
    const rawValues = { cauVal1: raw?.cau_val1 ?? null, cauVal2: raw?.cau_val2 ?? null, cauVal3: raw?.cau_val3 ?? null };
    let predicate;
    if (resolution.causalityType === 43)
        predicate = { kind: "attacks_evaded", scope: "self", eventMode: "current_event", sourceCausalityId: causalityId, sourceCausalityType: 43, evidence: "first-party-native-runtime" };
    if (resolution.causalityType === 51 || resolution.causalityType === 55) {
        const threshold = integer(rawValues.cauVal1);
        if (threshold !== undefined && threshold >= 0 && (resolution.causalityType === 51 || threshold < Number.MAX_SAFE_INTEGER))
            predicate = {
                kind: "turn_from_entry", scope: "self", comparator: resolution.causalityType === 51 ? "lte" : "gte", value: resolution.causalityType === 51 ? threshold : threshold + 1,
                nativeComparator: resolution.causalityType === 51 ? "lte" : "gt", nativeThreshold: threshold, appearanceGate: "appearance_initialized",
                sourceCausalityId: causalityId, sourceCausalityType: resolution.causalityType, evidence: "first-party-native-runtime",
            };
    }
    if (!predicate)
        return { condition: expression };
    return { condition: { op: "predicate", predicate }, metadata: {
            causalityId, causalityType: predicate.sourceCausalityType, predicate, raw: rawValues,
            provenance: {
                database: { table: "skill_causalities", rowId: causalityId, columns: ["causality_type", "cau_val1", "cau_val2", "cau_val3"] },
                runtime: resolution.provenance.runtime,
            },
        } };
}
function mapCondition(expression, resolutions) {
    if (expression.op === "all" || expression.op === "any") {
        const children = expression.children.map(child => mapCondition(child, resolutions));
        return { condition: { op: expression.op, children: children.map(value => value.condition) }, metadata: children.flatMap(value => value.metadata) };
    }
    if (expression.op === "not") {
        const child = mapCondition(expression.child, resolutions);
        return { condition: { op: "not", child: child.condition }, metadata: child.metadata };
    }
    if (expression.op !== "unknown")
        return { condition: expression, metadata: [] };
    const type = integer(expression.causalityType ?? object(expression.raw)?.causality_type);
    const resolution = type === undefined ? undefined : resolutions.get(type);
    if (!resolution)
        return { condition: expression, metadata: [] };
    const mapped = projection(expression, resolution);
    return { condition: mapped.condition, metadata: mapped.metadata ? [mapped.metadata] : [] };
}
function upgradeRule(rule, resolutions) {
    const mapped = mapCondition(rule.condition, resolutions);
    const uniqueMetadata = [...new Map(mapped.metadata.map(value => [`${value.causalityType}:${value.causalityId}`, value])).values()];
    const supportedIds = new Set(uniqueMetadata.map(value => value.causalityId));
    const mappedStatus = conditionStatus(mapped.condition);
    const status = rule.combatHistoryTriggers.length > 0 ? "partial" : combineStatus(mappedStatus, rule.effectStatus);
    return {
        ...rule, condition: mapped.condition, conditionStatus: mappedStatus, status, runtimeConditions: uniqueMetadata,
        source: { ...rule.source, causalities: rule.source.causalities.map(value => supportedIds.has(value.id) ? { ...value, mappingStatus: "supported" } : value) },
        unknowns: mappedStatus === "supported" ? rule.unknowns.filter(value => value !== "condition_semantics_incomplete") : rule.unknowns,
    };
}
function buildDatabaseTeamAnalysisDb11Dataset(options) {
    if (options.db7.contractVersion !== "0.6.0" || options.db10.contractVersion !== "0.9.0" || options.db7.sourceSnapshotVersion !== options.db10.sourceSnapshotVersion || options.db7.sourceSha256 !== options.db10.sourceDatabaseSha256)
        throw new Error("DB11 DB7/DB10 source lineage mismatch");
    const supported = options.db10.causalityResolutions.filter(value => value.status === "supported");
    if (supported.length !== 3 || supported.map(value => value.causalityType).sort((a, b) => a - b).join(",") !== "43,51,55")
        throw new Error("DB11 requires exactly the DB10 supported causality set 43/51/55");
    supported.forEach(validateSupportedResolution);
    if (options.db10.semanticPromotionCount !== 3 || options.db10.promotedOccurrenceCount !== supported.reduce((sum, value) => sum + value.occurrenceCount, 0))
        throw new Error("DB11 DB10 promotion totals are inconsistent");
    const resolutions = new Map(supported.map(value => [value.causalityType, value]));
    const states = options.db7.states.map(state => {
        if (!state.passive) {
            const { passive: _passive, ...withoutPassive } = state;
            return withoutPassive;
        }
        const rules = state.passive.rules.map(rule => upgradeRule(rule, resolutions));
        const statuses = rules.map(value => value.status);
        const status = statuses.every(value => value === "supported") ? "supported" : statuses.every(value => value === "unknown") ? "unknown" : "partial";
        return { ...state, passive: { ...state.passive, rules, status } };
    });
    const projections = states.flatMap(state => state.passive?.rules.flatMap(rule => rule.runtimeConditions) ?? []);
    for (const resolution of supported) {
        const actual = projections.filter(value => value.causalityType === resolution.causalityType).length;
        const unprojected = states.reduce((sum, state) => sum + (state.passive?.rules.reduce((ruleSum, rule) => ruleSum + unknownCount(rule.condition, resolution.causalityType), 0) ?? 0), 0);
        if (actual + unprojected !== resolution.occurrenceCount)
            throw new Error(`DB11 occurrence accounting mismatch for causality ${resolution.causalityType}: expected ${resolution.occurrenceCount}, got ${actual} projected + ${unprojected} unknown`);
    }
    return {
        schemaVersion: 1, contract: "dokkan-team-analysis-database-experiment", contractVersion: "0.10.0", generatedAt: options.db10.generatedAt,
        sourceDb7: { fileName: "team-analysis-db7-experiment.json.gz", sha256: options.db7Sha256, contractVersion: "0.6.0" },
        sourceDb10: { fileName: "team-analysis-db10-semantic-evidence.json.gz", sha256: options.db10Sha256, contractVersion: "0.9.0" },
        sourceSnapshotVersion: options.db7.sourceSnapshotVersion, sourceSha256: options.db7.sourceSha256, states,
    };
}
exports.buildDatabaseTeamAnalysisDb11Dataset = buildDatabaseTeamAnalysisDb11Dataset;
function buildDatabaseTeamAnalysisDb11Coverage(dataset, db7, db10) {
    const rules = dataset.states.flatMap(state => state.passive?.rules ?? []);
    const beforeRules = db7.states.flatMap(state => state.passive?.rules ?? []);
    const projections = dataset.states.flatMap(state => state.passive?.rules.flatMap(rule => rule.runtimeConditions.map(value => ({ stateKey: state.stateKey, value }))) ?? []);
    const byType = (type) => projections.filter(value => value.value.causalityType === type);
    const beforeConditions = statusCounts(beforeRules.map(value => value.conditionStatus));
    const afterConditions = statusCounts(rules.map(value => value.conditionStatus));
    const beforeStatuses = statusCounts(beforeRules.map(value => value.status));
    const afterStatuses = statusCounts(rules.map(value => value.status));
    return {
        schemaVersion: 1, stateCount: dataset.states.length, passiveStateCount: dataset.states.filter(value => value.passive).length, ruleCount: rules.length,
        runtimePredicateCount: projections.length, uniqueRuntimeCausalityCount: new Set(projections.map(value => value.value.causalityId)).size,
        runtimePredicateCountsByType: Object.fromEntries([43, 51, 55].map(type => [String(type), byType(type).length])),
        unprojectedSupportedTypeOccurrencesByType: Object.fromEntries([43, 51, 55].map(type => [String(type), rules.reduce((sum, rule) => sum + unknownCount(rule.condition, type), 0)])),
        affectedStateCountsByType: Object.fromEntries([43, 51, 55].map(type => [String(type), new Set(byType(type).map(value => value.stateKey)).size])),
        conditionStatusCountsBefore: beforeConditions, conditionStatusCountsAfter: afterConditions, ruleStatusCountsBefore: beforeStatuses, ruleStatusCountsAfter: afterStatuses,
        supportedConditionDelta: afterConditions.supported - beforeConditions.supported, supportedRuleDelta: afterStatuses.supported - beforeStatuses.supported,
        partialType3OccurrenceCount: db10.causalityResolutions.find(value => value.causalityType === 3)?.occurrenceCount ?? 0, semanticPromotionCount: 3,
    };
}
exports.buildDatabaseTeamAnalysisDb11Coverage = buildDatabaseTeamAnalysisDb11Coverage;
//# sourceMappingURL=team-analysis-db11-builder.js.map