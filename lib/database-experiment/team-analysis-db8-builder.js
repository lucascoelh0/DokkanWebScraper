"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDatabaseTeamAnalysisDb8Coverage = exports.buildDatabaseTeamAnalysisDb8Dataset = void 0;
const PROFILE_COLUMNS = ["exec_timing_type", "exec_game_type", "target_type", "calc_option", "turn", "is_once", "probability", "eff_value1", "eff_value2", "eff_value3", "passive_skill_effect_id"];
function id(value) {
    return value === null || value === undefined || value === "" ? undefined : String(value);
}
function scalarKey(value) { return `${typeof value}:${JSON.stringify(value)}`; }
function scalarSort(left, right) {
    const ln = typeof left === "number" ? left : typeof left === "string" && left.trim() ? Number(left) : NaN;
    const rn = typeof right === "number" ? right : typeof right === "string" && right.trim() ? Number(right) : NaN;
    if (Number.isFinite(ln) && Number.isFinite(rn) && ln !== rn)
        return ln - rn;
    return scalarKey(left).localeCompare(scalarKey(right));
}
function sortedScalars(values) {
    return [...new Map([...values].map(value => [scalarKey(value), value])).values()].sort(scalarSort);
}
function object(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value) ? value : undefined;
}
function walk(expression, visit) {
    visit(expression);
    if (expression.op === "all" || expression.op === "any")
        expression.children.forEach(child => walk(child, visit));
    if (expression.op === "not")
        walk(expression.child, visit);
}
function statusCounts(values) {
    return { partial: values.filter(value => value === "partial").length, unknown: values.filter(value => value === "unknown").length };
}
function samples(values) {
    return [...new Map(values.map(value => [`${value.stateKey}:${value.ruleKey}:${value.sourceRowId}`, value])).values()]
        .sort((left, right) => left.stateKey.localeCompare(right.stateKey) || left.ruleKey.localeCompare(right.ruleKey) || Number(left.sourceRowId) - Number(right.sourceRowId)).slice(0, 5);
}
function causalityOccurrences(dataset) {
    const result = [];
    const seen = new Set();
    const add = (stateKey, rule, sourceId, type, status, raw) => {
        const key = `${stateKey}:${rule.ruleKey}:${sourceId}`;
        if (seen.has(key))
            return;
        seen.add(key);
        result.push({ type, id: sourceId, status, v1: raw.cau_val1 ?? null, v2: raw.cau_val2 ?? null, v3: raw.cau_val3 ?? null,
            sample: { stateKey, ruleKey: rule.ruleKey, sourceRowId: sourceId, provenance: { table: "skill_causalities", rowId: sourceId } } });
    };
    for (const state of dataset.states)
        for (const rule of state.passive?.rules ?? []) {
            for (const selector of rule.selectorConditions.filter(value => value.status !== "supported"))
                add(state.stateKey, rule, selector.causalityId, selector.causalityType, selector.status, { cau_val1: selector.rawScope, cau_val2: selector.rawSelector, cau_val3: selector.rawCount });
            walk(rule.condition, node => {
                if (node.op !== "unknown" || node.causalityType === undefined || !node.causalityId)
                    return;
                add(state.stateKey, rule, node.causalityId, node.causalityType, "unknown", object(node.raw) ?? {});
            });
        }
    return result;
}
function causalityReason(type, statuses) {
    const numeric = Number(type);
    if (numeric === 41)
        return { reasons: ["name_token_dictionary_unavailable"], required: ["first_party_name_token_dictionary"] };
    if (numeric === 46)
        return { reasons: ["class_type_mask_identity_unknown"], required: ["first_party_named_mask_enum_or_runtime_export"] };
    const reasons = ["causality_semantics_unproven"];
    if (statuses.includes("partial"))
        reasons.push("partial_projection_not_runtime_evaluable");
    return { reasons, required: ["first_party_named_causality_enum_or_runtime_export"] };
}
function buildCausalityGaps(dataset) {
    const groups = new Map();
    for (const occurrence of causalityOccurrences(dataset)) {
        const key = scalarKey(occurrence.type);
        const values = groups.get(key) ?? [];
        values.push(occurrence);
        groups.set(key, values);
    }
    return [...groups.values()].map(values => {
        const evidence = causalityReason(values[0].type, values.map(value => value.status));
        const affectedStateKeys = [...new Set(values.map(value => value.sample.stateKey))].sort();
        return { causalityType: values[0].type, occurrenceCount: values.length, affectedStateCount: affectedStateKeys.length, affectedStateKeys,
            uniqueCausalityCount: new Set(values.map(value => value.id)).size, causalityIds: [...new Set(values.map(value => value.id))].sort((a, b) => Number(a) - Number(b)),
            statusCounts: statusCounts(values.map(value => value.status)), rawValueDomains: { cauVal1: sortedScalars(values.map(value => value.v1)), cauVal2: sortedScalars(values.map(value => value.v2)), cauVal3: sortedScalars(values.map(value => value.v3)) },
            reasonCodes: evidence.reasons, requiredEvidence: evidence.required, samples: samples(values.map(value => value.sample)) };
    }).sort((left, right) => right.occurrenceCount - left.occurrenceCount || scalarSort(left.causalityType, right.causalityType));
}
function effectIncomplete(rule) {
    return rule.effectStatus !== "supported" || rule.effects.some(effect => effect.kind === "unknown" || effect.evidence === "unknown" || effect.unit === "unknown" || effect.scaling?.kind === "unknown" || effect.target.unknownSubTargets.length > 0);
}
function buildEfficacyGaps(dataset, tables) {
    const skills = new Map(tables.passive_skills.flatMap(row => id(row.id) ? [[id(row.id), row]] : []));
    const effectScripts = new Map(tables.passive_skill_effects.flatMap(row => id(row.id) ? [[id(row.id), typeof row.script_name === "string" ? row.script_name.trim() : ""]] : []));
    const groups = new Map();
    for (const state of dataset.states)
        for (const rule of state.passive?.rules ?? []) {
            if (!effectIncomplete(rule))
                continue;
            const type = rule.source.efficacyType;
            const key = scalarKey(type);
            const row = skills.get(rule.source.passiveSkillId) ?? {};
            const reasons = [];
            const requirements = [];
            if (rule.effects.some(effect => effect.kind === "unknown" || effect.evidence === "unknown")) {
                reasons.push("efficacy_semantics_unproven");
                requirements.push("first_party_named_efficacy_enum_or_runtime_export");
            }
            if (rule.effects.some(effect => effect.unit === "unknown")) {
                reasons.push("calculation_option_semantics_unproven");
                requirements.push("first_party_named_calculation_option_enum_or_runtime_export");
            }
            if (rule.effects.some(effect => effect.scaling?.kind === "unknown")) {
                reasons.push("execution_timing_semantics_unproven");
                requirements.push("first_party_named_execution_timing_enum_or_runtime_export");
            }
            if (rule.effects.some(effect => effect.target.unknownSubTargets.length > 0)) {
                reasons.push("sub_target_semantics_unproven");
                requirements.push("first_party_named_sub_target_enum_or_join");
            }
            if (reasons.length === 0) {
                reasons.push("effect_semantics_unproven");
                requirements.push("first_party_structured_effect_runtime_export");
            }
            const values = groups.get(key) ?? [];
            values.push({ type, status: rule.effectStatus === "unknown" ? "unknown" : "partial", row,
                sample: { stateKey: state.stateKey, ruleKey: rule.ruleKey, sourceRowId: rule.source.passiveSkillId, provenance: { table: "passive_skills", rowId: rule.source.passiveSkillId } },
                reasons, requirements });
            groups.set(key, values);
        }
    return [...groups.values()].map(values => {
        const domains = {};
        for (const column of PROFILE_COLUMNS)
            domains[column] = sortedScalars(values.map(value => value.row[column] ?? null));
        const scripts = sortedScalars(values.map(value => { const effectId = id(value.row.passive_skill_effect_id); return effectId ? effectScripts.get(effectId) ?? "" : ""; })).filter((value) => typeof value === "string" && value.length > 0);
        const ids = [...new Set(values.map(value => value.sample.sourceRowId))].sort((a, b) => Number(a) - Number(b));
        const reasons = [...new Set(values.flatMap(value => value.reasons))].sort();
        const requirements = [...new Set(values.flatMap(value => value.requirements))].sort();
        const affectedStateKeys = [...new Set(values.map(value => value.sample.stateKey))].sort();
        return { efficacyType: values[0].type, ruleCount: values.length, affectedStateCount: affectedStateKeys.length, affectedStateKeys, passiveSkillIds: ids,
            statusCounts: statusCounts(values.map(value => value.status)), rawValueDomains: domains, linkedScriptNames: scripts, scriptNameStatus: scripts.length === 0 ? "absent" : "opaque",
            reasonCodes: reasons, requiredEvidence: requirements, samples: samples(values.map(value => value.sample)) };
    }).sort((left, right) => right.ruleCount - left.ruleCount || scalarSort(left.efficacyType, right.efficacyType));
}
function buildDatabaseTeamAnalysisDb8Dataset(options) {
    const rules = options.db7.states.flatMap(state => state.passive?.rules ?? []);
    const selectors = rules.flatMap(rule => rule.selectorConditions);
    const triggers = rules.flatMap(rule => rule.combatHistoryTriggers);
    const causalityRows = new Map(options.tables.skill_causalities.flatMap(row => id(row.id) ? [[id(row.id), row]] : []));
    const combatHistoryGaps = [];
    for (const state of options.db7.states)
        for (const rule of state.passive?.rules ?? [])
            for (const trigger of rule.combatHistoryTriggers) {
                const row = causalityRows.get(trigger.causalityId) ?? {};
                combatHistoryGaps.push({ stateKey: state.stateKey, ruleKey: rule.ruleKey, causalityId: trigger.causalityId, event: trigger.event, minimumCount: trigger.minimumCount,
                    recurrence: "unknown", calculationBucket: "unknown", rawCausality: { cauVal1: row.cau_val1 ?? null, cauVal2: row.cau_val2 ?? null, cauVal3: row.cau_val3 ?? trigger.rawAuxiliary },
                    rawPassive: { executionTimingType: trigger.rawExecutionTimingType, calculationOption: trigger.rawCalculationOption, turn: trigger.rawTurn, isOnce: trigger.rawIsOnce },
                    provenance: { table: "skill_causalities", rowId: trigger.causalityId },
                    requiredEvidence: ["first_party_recurrence_semantics", "first_party_calculation_bucket_semantics"] });
            }
    combatHistoryGaps.sort((left, right) => left.stateKey.localeCompare(right.stateKey) || left.ruleKey.localeCompare(right.ruleKey) || Number(left.causalityId) - Number(right.causalityId));
    return { schemaVersion: 1, contract: "dokkan-team-analysis-database-evidence-gap-experiment", contractVersion: "0.7.0", generatedAt: options.db7.generatedAt,
        sourceDb7ContractVersion: "0.6.0", sourceSnapshotVersion: options.db7.sourceSnapshotVersion, sourceSha256: options.db7.sourceSha256,
        sourceStateCount: options.db7.states.length, semanticPromotionCount: 0, causalityGaps: buildCausalityGaps(options.db7), efficacyGaps: buildEfficacyGaps(options.db7, options.tables), combatHistoryGaps,
        crossCuttingGaps: { nameTokenDictionaryOccurrenceCount: selectors.filter(value => value.causalityType === 41 && value.status === "partial").length,
            unknownClassTypeMaskOccurrenceCount: selectors.filter(value => value.causalityType === 46 && value.status === "unknown").length,
            combatHistoryRecurrenceUnknownCount: triggers.filter(value => value.recurrence === "unknown").length,
            calculationBucketUnknownCount: triggers.filter(value => value.calculationBucket === "unknown").length } };
}
exports.buildDatabaseTeamAnalysisDb8Dataset = buildDatabaseTeamAnalysisDb8Dataset;
function buildDatabaseTeamAnalysisDb8Coverage(dataset) {
    return { schemaVersion: 1, semanticPromotionCount: 0, causalityGapTypeCount: dataset.causalityGaps.length,
        causalityGapOccurrenceCount: dataset.causalityGaps.reduce((sum, value) => sum + value.occurrenceCount, 0), causalityGapAffectedStateCount: new Set(dataset.causalityGaps.flatMap(value => value.affectedStateKeys)).size,
        efficacyGapTypeCount: dataset.efficacyGaps.length, efficacyGapRuleCount: dataset.efficacyGaps.reduce((sum, value) => sum + value.ruleCount, 0), efficacyGapAffectedStateCount: new Set(dataset.efficacyGaps.flatMap(value => value.affectedStateKeys)).size,
        combatHistoryGapCount: dataset.combatHistoryGaps.length, combatHistoryGapAffectedStateCount: new Set(dataset.combatHistoryGaps.map(value => value.stateKey)).size,
        causalityOccurrencesByType: Object.fromEntries(dataset.causalityGaps.map(value => [String(value.causalityType), value.occurrenceCount]).sort(([left], [right]) => Number(left) - Number(right))),
        efficacyRulesByType: Object.fromEntries(dataset.efficacyGaps.map(value => [String(value.efficacyType), value.ruleCount]).sort(([left], [right]) => Number(left) - Number(right))) };
}
exports.buildDatabaseTeamAnalysisDb8Coverage = buildDatabaseTeamAnalysisDb8Coverage;
//# sourceMappingURL=team-analysis-db8-builder.js.map