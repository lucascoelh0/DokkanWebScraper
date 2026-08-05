"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDatabaseTeamAnalysisDb3Coverage = exports.buildDatabaseTeamAnalysisDb3Dataset = exports.mapDatabaseTeamAnalysisDb3Rule = exports.createDatabaseTeamAnalysisDb3CausalityMapper = exports.mapDatabaseTeamAnalysisDb3Causality = exports.decodeSphereMask = void 0;
const SPHERE_BITS = [
    [1, "AGL"], [2, "TEQ"], [4, "INT"], [8, "STR"], [16, "PHY"], [32, "rainbow"],
];
function id(value) {
    return value === null || value === undefined || value === "" ? undefined : String(value);
}
function numberValue(value) {
    const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
    return Number.isFinite(parsed) ? parsed : null;
}
function integerValue(value) {
    const parsed = numberValue(value);
    return parsed !== null && Number.isSafeInteger(parsed) ? parsed : null;
}
function text(value) {
    return typeof value === "string" ? value.replace(/\r\n/g, "\n").trim() : value === null || value === undefined ? "" : String(value);
}
function rowValue(row, column) {
    return row.values[column] ?? null;
}
function categoryLookups(tables) {
    return new Map(tables.card_categories.flatMap(row => {
        const rowId = id(row.id);
        return rowId ? [[rowId, text(row.name)]] : [];
    }));
}
function decodeSphereMask(raw) {
    const numeric = integerValue(raw);
    if (numeric === null || numeric < 0)
        return { rawMask: raw, types: [], semantic: "unknown", unknownMask: 0, evidence: "unknown" };
    const types = SPHERE_BITS.filter(([bit]) => (numeric & bit) !== 0).map(([, type]) => type);
    const knownMask = SPHERE_BITS.reduce((value, [bit]) => value | bit, 0);
    const unknownMask = numeric & ~knownMask;
    const semantic = unknownMask !== 0 || types.length === 0
        ? "unknown"
        : numeric === 63 ? "any" : numeric === 31 ? "non_rainbow" : "listed";
    return { rawMask: raw, types, semantic, unknownMask, evidence: unknownMask === 0 && types.length > 0 ? "first-party-row-join" : "unknown" };
}
exports.decodeSphereMask = decodeSphereMask;
function singleSphereBit(raw) {
    const selector = decodeSphereMask(raw);
    return selector.unknownMask === 0 && selector.types.length === 1 ? selector.types[0] : "unknown";
}
function mapTarget(rule, categoriesById) {
    const categories = [];
    const categoryIds = [];
    const excludedCategories = [];
    const excludedCategoryIds = [];
    const unknownSubTargets = [];
    const subTargets = [];
    for (const row of rule.target.subTargetRows) {
        const valueType = numberValue(rowValue(row, "target_value_type"));
        const valueId = id(rowValue(row, "target_value"));
        const category = valueId ? categoriesById.get(valueId) : undefined;
        if (valueType === 1 && valueId && category) {
            categoryIds.push(valueId);
            categories.push(category);
            subTargets.push({ targetValueType: rowValue(row, "target_value_type"), targetValue: rowValue(row, "target_value"), category, mappingStatus: "included_category", provenance: { table: row.provenance.table, rowId: row.provenance.rowId } });
        }
        else if (valueType === 2 && valueId && category) {
            excludedCategoryIds.push(valueId);
            excludedCategories.push(category);
            subTargets.push({ targetValueType: rowValue(row, "target_value_type"), targetValue: rowValue(row, "target_value"), category, mappingStatus: "excluded_category", provenance: { table: row.provenance.table, rowId: row.provenance.rowId } });
        }
        else {
            const raw = { targetValueType: rowValue(row, "target_value_type"), targetValue: rowValue(row, "target_value"), provenance: { table: row.provenance.table, rowId: row.provenance.rowId } };
            unknownSubTargets.push(raw);
            subTargets.push({ ...raw, mappingStatus: "unknown" });
        }
    }
    const scope = categories.length > 0 && (rule.target.targetType.value === "team_allies" || rule.target.targetType.value === "class_allies")
        ? rule.target.classes.length > 0 ? "category_class_allies" : "category_allies"
        : rule.target.targetType.value;
    return {
        scope,
        selfInclusion: rule.target.selfInclusion,
        classes: rule.target.classes,
        types: rule.target.types,
        categories: [...new Set(categories)].sort(),
        categoryIds: [...new Set(categoryIds)].sort((left, right) => Number(left) - Number(right)),
        excludedCategories: [...new Set(excludedCategories)].sort(),
        excludedCategoryIds: [...new Set(excludedCategoryIds)].sort((left, right) => Number(left) - Number(right)),
        subTargets,
        unknownSubTargets,
    };
}
function predicate(source, values) {
    return { op: "predicate", predicate: {
            ...values,
            sourceCausalityId: source.provenance.rowId,
            sourceCausalityType: rowValue(source, "causality_type"),
            evidence: "first-party-row-join",
        } };
}
function classFromMask(raw) {
    const numeric = numberValue(raw);
    return numeric === 32 ? ["Super"] : numeric === 64 ? ["Extreme"] : [];
}
function mapCausality(source, categoriesById) {
    const type = integerValue(rowValue(source, "causality_type"));
    const v1 = integerValue(rowValue(source, "cau_val1"));
    const v2 = integerValue(rowValue(source, "cau_val2"));
    const v3 = integerValue(rowValue(source, "cau_val3"));
    switch (type) {
        case 1:
            if (v1 !== null)
                return predicate(source, { kind: "hp_percent", scope: "team", comparator: "gte", value: v1 });
            break;
        case 2:
            if (v1 !== null)
                return predicate(source, { kind: "hp_percent", scope: "team", comparator: "lte", value: v1 });
            break;
        case 5:
            if (v1 !== null)
                return predicate(source, { kind: "battle_turn", scope: "battle", comparator: "gte", value: v1 + 1 });
            break;
        case 15:
            if (v1 !== null)
                return predicate(source, { kind: "enemy_count", scope: "enemy", comparator: "gte", value: v1 });
            break;
        case 16:
            if (v1 !== null)
                return predicate(source, { kind: "enemy_count", scope: "enemy", comparator: "lte", value: v1 - 1 });
            break;
        case 19:
            if (v1 !== null)
                return predicate(source, { kind: "battle_slot", scope: "self", comparator: "eq", value: v1 + 1 });
            break;
        case 24: return predicate(source, { kind: "attacks_received", scope: "self", eventMode: "current_event" });
        case 25: return predicate(source, { kind: "final_blow_delivered", scope: "self", eventMode: "current_event" });
        case 30: return predicate(source, { kind: "guard_activated", scope: "self", eventMode: "current_event" });
        case 38: {
            const mask = v1 ?? 0;
            const enemyStatuses = [];
            if ((mask & 16) !== 0)
                enemyStatuses.push("atk_down");
            if ((mask & 32) !== 0)
                enemyStatuses.push("def_down");
            if ((mask & 256) !== 0)
                enemyStatuses.push("stunned");
            if ((mask & 1024) !== 0)
                enemyStatuses.push("super_attack_sealed");
            if (enemyStatuses.length > 0 && (mask & ~(16 | 32 | 256 | 1024)) === 0)
                return predicate(source, { kind: "enemy_status", scope: "enemy", enemyStatuses });
            break;
        }
        case 42: {
            const selector = decodeSphereMask(rowValue(source, "cau_val1"));
            if (selector.semantic !== "unknown" && v2 !== null)
                return predicate(source, {
                    kind: "ki_spheres_obtained", scope: "self", comparator: "gte", count: v2,
                    kiSphereTypes: selector.semantic === "any" ? ["any"] : selector.semantic === "non_rainbow" ? ["non_rainbow"] : selector.types,
                });
            break;
        }
    }
    return { op: "unknown", causalityId: source.provenance.rowId, causalityType: rowValue(source, "causality_type"), raw: source.values };
}
function mapDatabaseTeamAnalysisDb3Causality(source, tables) {
    return mapCausality(source, categoryLookups(tables));
}
exports.mapDatabaseTeamAnalysisDb3Causality = mapDatabaseTeamAnalysisDb3Causality;
function createDatabaseTeamAnalysisDb3CausalityMapper(tables) {
    const categoriesById = categoryLookups(tables);
    return source => mapCausality(source, categoriesById);
}
exports.createDatabaseTeamAnalysisDb3CausalityMapper = createDatabaseTeamAnalysisDb3CausalityMapper;
function mapCompiledCondition(value, causalities, categoriesById) {
    if (typeof value === "number") {
        const source = causalities.get(String(value));
        return source ? mapCausality(source, categoriesById) : { op: "unknown", causalityId: String(value), raw: value };
    }
    // The compiled JSON exposes operator symbols, but no first-party enum or
    // checked-in contract proves their boolean semantics. Preserve them raw.
    return { op: "unknown", raw: value };
}
function conditionStatus(expression) {
    if (expression.op === "always" || expression.op === "predicate")
        return expression.op === "predicate" && expression.predicate.kind === "unknown" ? "unknown" : "supported";
    if (expression.op === "unknown")
        return "unknown";
    if (expression.op === "not")
        return conditionStatus(expression.child);
    const statuses = expression.children.map(conditionStatus);
    if (statuses.every(status => status === "supported"))
        return "supported";
    if (statuses.every(status => status === "unknown"))
        return "unknown";
    return "partial";
}
function conditionForRule(rule, categoriesById) {
    if (rule.condition.mappingStatus === "unconditional")
        return { op: "always" };
    if (rule.condition.compiled === undefined)
        return { op: "unknown", raw: rule.condition.raw };
    const causalities = new Map(rule.condition.causalities.map(row => [row.provenance.rowId, row]));
    const expression = mapCompiledCondition(rule.condition.compiled, causalities, categoriesById);
    const efficacy = numberValue(rule.rawEnums.efficacyType);
    if (efficacy === 98) {
        const referencedTypes = rule.condition.causalities.map(row => numberValue(rowValue(row, "causality_type")));
        if (typeof rule.condition.compiled === "number" && referencedTypes.length === 1 && (referencedTypes[0] === 24 || referencedTypes[0] === 25))
            return { op: "always" };
    }
    return expression;
}
function copyBaseEffects(rule, target) {
    return rule.effects.map(source => ({
        kind: source.kind.value,
        target,
        value: source.value,
        unit: source.unit,
        activationChancePercent: source.activationChancePercent,
        additionalToSuperChancePercent: source.additionalToSuperChancePercent,
        kiSphereChange: source.kiSphereChange ? {
            sourceSelection: "listed_types",
            sourceTypes: source.kiSphereChange.source.value === "unknown" ? [] : [source.kiSphereChange.source.value],
            destinationType: source.kiSphereChange.destination.value,
        } : undefined,
        evidence: source.kind.evidence,
    }));
}
function statUnit(raw) {
    const value = numberValue(raw);
    return value === 0 ? "flat" : value === 2 || value === 3 ? "percent" : "unknown";
}
function scalingFor98(rule) {
    const timing = integerValue(rule.rawEnums.executionTimingType);
    const causalityTypes = new Set(rule.condition.causalities.map(row => numberValue(rowValue(row, "causality_type"))));
    if (timing === 1)
        return { kind: "per_turn", turnsPerIncrement: 1 };
    if (timing === 5 && rule.condition.causalities.length === 0)
        return { kind: "per_combat_event", event: "attack_performed", eventsPerIncrement: 1 };
    if (timing === 7 && causalityTypes.has(24))
        return { kind: "per_combat_event", event: "attack_received", eventsPerIncrement: 1 };
    if ((timing === 9 || timing === 14) && causalityTypes.has(25))
        return { kind: "per_combat_event", event: "final_blow_delivered", eventsPerIncrement: 1 };
    return { kind: "unknown", rawTimingType: rule.rawEnums.executionTimingType };
}
function mapEffects(rule, target) {
    const skill = rule.skill.values;
    const efficacy = integerValue(skill.efficacy_type);
    const v1 = integerValue(skill.eff_value1);
    const v2 = integerValue(skill.eff_value2);
    const v3 = integerValue(skill.eff_value3);
    if (efficacy === 67) {
        const source = decodeSphereMask(skill.eff_value1 ?? null);
        return [{
                kind: "ki_sphere_change", target,
                kiSphereChange: {
                    sourceSelection: source.types.length > 0 ? "random_type" : "unknown",
                    sourceTypes: source.types,
                    destinationType: singleSphereBit(skill.eff_value2 ?? null),
                    unknownSourceMask: source.unknownMask || undefined,
                },
                evidence: source.types.length > 0 && source.unknownMask === 0 && singleSphereBit(skill.eff_value2 ?? null) !== "unknown" ? "first-party-row-join" : "unknown",
            }];
    }
    if (efficacy === 68) {
        const kinds = { 1: ["atk"], 2: ["hp"], 3: ["atk", "def"], 4: ["critical_chance"], 5: ["evade_chance"], 6: ["damage_reduction"] };
        const selectedKinds = v2 === null ? undefined : kinds[v2];
        if (!selectedKinds || v3 === null)
            return [{ kind: "unknown", target, evidence: "unknown" }];
        const sphereSelector = decodeSphereMask(skill.eff_value1 ?? null);
        return selectedKinds.map((kind) => ({
            kind, target, value: v3,
            unit: kind === "critical_chance" || kind === "evade_chance" || kind === "damage_reduction" ? "percent" : statUnit(skill.calc_option ?? null),
            scaling: { kind: "per_ki_sphere", selector: sphereSelector, spheresPerIncrement: 1 },
            evidence: "first-party-row-join",
        }));
    }
    if (efficacy === 96) {
        const selector = decodeSphereMask(skill.eff_value1 ?? null);
        if (v2 === null || selector.evidence === "unknown")
            return [{ kind: "unknown", target, evidence: "unknown" }];
        return [{
                kind: "ki", target, value: v2, unit: "ki",
                scaling: { kind: "per_ki_sphere", selector, spheresPerIncrement: 1 },
                evidence: "first-party-row-join",
            }];
    }
    if (efficacy === 98) {
        const kinds = { 0: "atk", 1: "def", 2: "critical_chance", 3: "evade_chance", 4: "damage_reduction", 5: "ki" };
        const kind = v3 === null ? undefined : kinds[v3];
        if (!kind || v1 === null || v2 === null)
            return [{ kind: "unknown", target, evidence: "unknown" }];
        const unit = kind === "ki" ? "ki" : kind === "critical_chance" || kind === "evade_chance" || kind === "damage_reduction" ? "percent" : statUnit(skill.calc_option ?? null);
        return [{ kind, target, value: v1, unit, stackCap: v2, scaling: scalingFor98(rule), evidence: "first-party-row-join" }];
    }
    return copyBaseEffects(rule, target);
}
function effectStatus(effects) {
    const unknown = effects.filter(effect => effect.kind === "unknown"
        || effect.evidence === "unknown"
        || effect.unit === "unknown"
        || effect.scaling?.kind === "unknown"
        || (effect.scaling?.kind === "per_ki_sphere" && effect.scaling.selector.evidence === "unknown")).length;
    const targetIncomplete = effects.some(effect => effect.target.unknownSubTargets.length > 0);
    return unknown === 0 ? targetIncomplete ? "partial" : "supported" : unknown === effects.length ? "unknown" : "partial";
}
function combineStatus(condition, effect) {
    if (condition === "supported" && effect === "supported")
        return "supported";
    if (condition === "unknown" && effect === "unknown")
        return "unknown";
    return "partial";
}
function mapRule(rule, categoriesById) {
    const target = mapTarget(rule, categoriesById);
    const condition = conditionForRule(rule, categoriesById);
    const effects = mapEffects(rule, target);
    const mappedConditionStatus = conditionStatus(condition);
    const mappedEffectStatus = effectStatus(effects);
    const causalityMappings = rule.condition.causalities.map(row => ({
        id: row.provenance.rowId,
        type: rowValue(row, "causality_type"),
        mappingStatus: mapCausality(row, categoriesById).op === "predicate" ? "supported" : "unknown",
    }));
    const compiledConditionOperator = Array.isArray(rule.condition.compiled) && typeof rule.condition.compiled[0] === "string"
        ? rule.condition.compiled[0] : undefined;
    const unknowns = [...rule.unknowns];
    if (mappedConditionStatus !== "supported")
        unknowns.push("condition_semantics_incomplete");
    if (mappedEffectStatus !== "supported")
        unknowns.push("effect_semantics_incomplete");
    if (target.unknownSubTargets.length > 0)
        unknowns.push("sub_target_semantics_incomplete");
    return {
        ruleKey: rule.ruleKey,
        condition,
        conditionStatus: mappedConditionStatus,
        effects,
        effectStatus: mappedEffectStatus,
        status: combineStatus(mappedConditionStatus, mappedEffectStatus),
        source: {
            passiveSkillSetId: rule.passiveSkillSetId,
            passiveSkillRelationId: rule.relation.provenance.rowId,
            passiveSkillId: rule.passiveSkillId,
            efficacyType: rule.rawEnums.efficacyType,
            targetType: rule.rawEnums.targetType,
            executionTimingType: rule.rawEnums.executionTimingType,
            calculationOption: rule.rawEnums.calculationOption,
            causalityIds: rule.condition.referencedCausalityIds,
            causalities: causalityMappings,
            compiledConditionOperator,
            provenance: {
                passiveSkillRelation: { table: rule.relation.provenance.table, rowId: rule.relation.provenance.rowId },
                passiveSkill: { table: rule.skill.provenance.table, rowId: rule.skill.provenance.rowId },
                causalities: rule.condition.causalities.map(row => ({ table: row.provenance.table, rowId: row.provenance.rowId })),
            },
        },
        unknowns: [...new Set(unknowns)],
    };
}
function mapDatabaseTeamAnalysisDb3Rule(rule, tables) {
    return mapRule(rule, categoryLookups(tables));
}
exports.mapDatabaseTeamAnalysisDb3Rule = mapDatabaseTeamAnalysisDb3Rule;
function buildDatabaseTeamAnalysisDb3Dataset(options) {
    const categoriesById = categoryLookups(options.tables);
    return {
        schemaVersion: 1,
        contract: "dokkan-team-analysis-database-experiment",
        contractVersion: "0.2.0",
        generatedAt: options.db2.generatedAt,
        sourceDb2ContractVersion: "0.1.0",
        sourceSnapshotVersion: options.db2.sourceSnapshotVersion,
        sourceSha256: options.db2.sourceSha256,
        states: options.db2.states.map(state => {
            const rules = state.passive?.rules.map(rule => mapRule(rule, categoriesById)) ?? [];
            const statuses = rules.map(rule => rule.status);
            const status = statuses.every(value => value === "supported") ? "supported"
                : statuses.every(value => value === "unknown") ? "unknown" : "partial";
            return {
                stateKey: state.stateKey,
                characterId: state.characterId,
                formId: state.formId,
                releaseState: state.releaseState,
                sourceReleaseState: state.sourceReleaseState,
                displayName: state.displayName,
                passive: state.passive ? {
                    name: text(state.passive.set.values.name) || undefined,
                    rawText: state.passive.rawText,
                    rules,
                    status,
                    source: {
                        passiveSkillSetId: state.passive.set.provenance.rowId,
                        provenance: { table: state.passive.set.provenance.table, rowId: state.passive.set.provenance.rowId },
                    },
                } : undefined,
            };
        }),
    };
}
exports.buildDatabaseTeamAnalysisDb3Dataset = buildDatabaseTeamAnalysisDb3Dataset;
function walkCondition(expression, visit) {
    visit(expression);
    if (expression.op === "all" || expression.op === "any")
        expression.children.forEach(child => walkCondition(child, visit));
    if (expression.op === "not")
        walkCondition(expression.child, visit);
}
function buildDatabaseTeamAnalysisDb3Coverage(dataset) {
    const rules = dataset.states.flatMap(state => state.passive?.rules ?? []);
    const effects = rules.flatMap(rule => rule.effects);
    const statusCounts = (values) => ({
        supported: values.filter(value => value === "supported").length,
        partial: values.filter(value => value === "partial").length,
        unknown: values.filter(value => value === "unknown").length,
    });
    const effectCounts = {};
    const mappedEfficacyRowCounts = {};
    const unknownEfficacyRowCounts = {};
    const mappedCausalityTypeCounts = {};
    const unknownCausalityTypeCounts = {};
    const conditionPredicateCounts = {};
    let causalityLeafCount = 0;
    let mappedCausalityLeafCount = 0;
    let unknownCausalityLeafCount = 0;
    for (const effect of effects)
        effectCounts[effect.kind] = (effectCounts[effect.kind] ?? 0) + 1;
    for (const rule of rules) {
        const efficacy = String(rule.source.efficacyType);
        const bucket = rule.effectStatus === "unknown" ? unknownEfficacyRowCounts : mappedEfficacyRowCounts;
        bucket[efficacy] = (bucket[efficacy] ?? 0) + 1;
        for (const causality of rule.source.causalities) {
            causalityLeafCount += 1;
            const type = String(causality.type);
            if (causality.mappingStatus === "supported") {
                mappedCausalityLeafCount += 1;
                mappedCausalityTypeCounts[type] = (mappedCausalityTypeCounts[type] ?? 0) + 1;
            }
            else {
                unknownCausalityLeafCount += 1;
                unknownCausalityTypeCounts[type] = (unknownCausalityTypeCounts[type] ?? 0) + 1;
            }
        }
        walkCondition(rule.condition, node => {
            if (node.op === "predicate") {
                conditionPredicateCounts[node.predicate.kind] = (conditionPredicateCounts[node.predicate.kind] ?? 0) + 1;
            }
        });
    }
    const subTargets = rules.flatMap(rule => rule.effects[0]?.target.subTargets.map(row => row.mappingStatus === "unknown" ? "unknown" : "mapped") ?? []);
    return {
        schemaVersion: 1,
        stateCount: dataset.states.length,
        passiveStateCount: dataset.states.filter(state => state.passive).length,
        ruleCount: rules.length,
        ruleStatusCounts: statusCounts(rules.map(rule => rule.status)),
        effectStatusCounts: statusCounts(rules.map(rule => rule.effectStatus)),
        conditionStatusCounts: statusCounts(rules.map(rule => rule.conditionStatus)),
        effectCounts,
        mappedEfficacyRowCounts,
        unknownEfficacyRowCounts,
        causalityLeafCount,
        mappedCausalityLeafCount,
        unknownCausalityLeafCount,
        mappedCausalityTypeCounts,
        unknownCausalityTypeCounts,
        conditionalRuleCount: rules.filter(rule => rule.source.causalityIds.length > 0).length,
        unknownCompiledOperatorCount: rules.filter(rule => rule.source.compiledConditionOperator !== undefined).length,
        conditionPredicateCounts,
        subTargetRowCount: subTargets.length,
        mappedSubTargetRowCount: subTargets.filter(value => value === "mapped").length,
        unknownSubTargetRowCount: subTargets.filter(value => value === "unknown").length,
        danglingJoinCount: 0,
    };
}
exports.buildDatabaseTeamAnalysisDb3Coverage = buildDatabaseTeamAnalysisDb3Coverage;
//# sourceMappingURL=team-analysis-db3-builder.js.map