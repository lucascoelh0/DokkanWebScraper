"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDatabaseTeamAnalysisCoverage = exports.buildDatabaseTeamAnalysisDataset = exports.mapDatabasePassiveRule = exports.mapDatabasePassiveEffects = exports.mapDatabasePassiveTarget = void 0;
const CONFIRMED_EFFICACY_TYPES = [1, 2, 3, 4, 5, 9, 13, 16, 18, 20, 48, 51, 76, 78, 81, 90, 91, 101];
const CONFIRMED_TARGET_TYPES = [1, 2, 3, 4, 12, 13, 14, 15, 16];
const TYPE_VALUES = ["AGL", "TEQ", "INT", "STR", "PHY"];
function id(value) {
    return value === null || value === undefined || value === "" ? undefined : String(value);
}
function numberValue(value) {
    const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
    return Number.isFinite(parsed) ? parsed : null;
}
function text(value) {
    return typeof value === "string" ? value.replace(/\r\n/g, "\n").trim() : value === null || value === undefined ? "" : String(value);
}
function provenance(table, row) {
    return { table, rowId: id(row.id) ?? "unknown", columns: Object.keys(row) };
}
function sourced(table, row) {
    return { values: row, provenance: provenance(table, row) };
}
function groupBy(rows, column) {
    const result = new Map();
    for (const row of rows) {
        const key = id(row[column]);
        if (!key)
            continue;
        const values = result.get(key) ?? [];
        values.push(row);
        result.set(key, values);
    }
    return result;
}
function mapped(raw, value, evidence = "first-party-row-join") {
    return { raw, value, evidence };
}
function unknown(raw) {
    return { raw, value: "unknown", evidence: "unknown" };
}
function mapType(raw) {
    const numeric = numberValue(raw);
    if (numeric !== null && numeric >= 0 && numeric < TYPE_VALUES.length)
        return mapped(raw, TYPE_VALUES[numeric]);
    if (numeric === 5)
        return mapped(raw, "rainbow");
    return unknown(raw);
}
function mapDatabasePassiveTarget(skill, targetRows = []) {
    const raw = skill.target_type ?? null;
    const targetType = numberValue(raw);
    const definitions = {
        1: { scope: "self", self: "included" },
        2: { scope: "team_allies", self: "unknown" },
        3: { scope: "enemy", self: "unknown" },
        4: { scope: "all_enemies", self: "unknown" },
        12: { scope: "class_allies", self: "unknown", classes: ["Super"] },
        13: { scope: "class_allies", self: "unknown", classes: ["Extreme"] },
        14: { scope: "all_enemies", self: "unknown", classes: ["Super"] },
        15: { scope: "all_enemies", self: "unknown", classes: ["Extreme"] },
        16: { scope: "team_allies", self: "excluded" },
    };
    const definition = targetType === null ? undefined : definitions[targetType];
    return {
        targetType: definition ? mapped(raw, definition.scope) : unknown(raw),
        selfInclusion: definition?.self ?? "unknown",
        classes: definition?.classes ?? [],
        types: [],
        subTargetTypeSetId: id(skill.sub_target_type_set_id),
        subTargetRows: targetRows,
    };
}
exports.mapDatabasePassiveTarget = mapDatabasePassiveTarget;
function targetWithType(target, rawType) {
    const type = mapType(rawType);
    return { ...target, types: type.value === "unknown" || type.value === "rainbow" ? [] : [type.value] };
}
function effect(rawEfficacy, kind, target, values = {}) {
    return { kind: mapped(rawEfficacy, kind), target, valueEvidence: "first-party-row-join", ...values };
}
function statUnit(calcOption) {
    const raw = numberValue(calcOption);
    if (raw === 0)
        return "flat";
    if (raw === 2 || raw === 3)
        return "percent";
    return "unknown";
}
function chance(value) {
    const numeric = numberValue(value);
    return numeric !== null && numeric >= 0 && numeric <= 100 ? numeric : undefined;
}
function isEnemyTarget(target) {
    return target.targetType.value === "enemy" || target.targetType.value === "all_enemies";
}
function mapDatabasePassiveEffects(skill, baseTarget = mapDatabasePassiveTarget(skill)) {
    const efficacy = numberValue(skill.efficacy_type);
    const rawEfficacy = skill.efficacy_type ?? null;
    const v1 = numberValue(skill.eff_value1);
    const v2 = numberValue(skill.eff_value2);
    const v3 = numberValue(skill.eff_value3);
    const activationChancePercent = chance(skill.probability);
    const unit = statUnit(skill.calc_option ?? null);
    const atkKind = isEnemyTarget(baseTarget) ? "enemy_atk_down" : "atk";
    const defKind = isEnemyTarget(baseTarget) ? "enemy_def_down" : "def";
    const withChance = activationChancePercent === undefined ? {} : { activationChancePercent };
    switch (efficacy) {
        case 1: return [effect(rawEfficacy, atkKind, baseTarget, { value: v1 ?? undefined, unit, ...withChance })];
        case 2: return [effect(rawEfficacy, defKind, baseTarget, { value: v1 ?? undefined, unit, ...withChance })];
        case 3: return [
            effect(rawEfficacy, atkKind, baseTarget, { value: v1 ?? undefined, unit, ...withChance }),
            effect(rawEfficacy, defKind, baseTarget, { value: v2 ?? undefined, unit, ...withChance }),
        ];
        case 4: return [effect(rawEfficacy, "hp", baseTarget, { value: v1 ?? undefined, unit, ...withChance })];
        case 5: return [effect(rawEfficacy, "ki", baseTarget, { value: v1 ?? undefined, unit: "ki", ...withChance })];
        case 9: return [effect(rawEfficacy, "stun_chance", baseTarget, { unit: "percent", ...withChance })];
        case 13: return [effect(rawEfficacy, "damage_reduction", baseTarget, {
                value: v1 !== null && v1 >= 0 && v1 <= 100 ? 100 - v1 : undefined,
                unit: "percent",
                ...withChance,
            })];
        case 16: return [effect(rawEfficacy, atkKind, targetWithType(baseTarget, skill.eff_value1 ?? null), { value: v2 ?? undefined, unit, ...withChance })];
        case 18: {
            const target = targetWithType(baseTarget, skill.eff_value1 ?? null);
            return [
                effect(rawEfficacy, atkKind, target, { value: v2 ?? undefined, unit, ...withChance }),
                effect(rawEfficacy, defKind, target, { value: v3 ?? undefined, unit, ...withChance }),
            ];
        }
        case 20: return [effect(rawEfficacy, "ki", targetWithType(baseTarget, skill.eff_value1 ?? null), { value: v2 ?? undefined, unit: "ki", ...withChance })];
        case 48: return [effect(rawEfficacy, "super_attack_seal", baseTarget, { unit: "percent", ...withChance })];
        case 51: return [effect(rawEfficacy, "ki_sphere_change", baseTarget, {
                kiSphereChange: { source: mapType(skill.eff_value1 ?? null), destination: mapType(skill.eff_value2 ?? null) },
            })];
        case 76: return [effect(rawEfficacy, "effective_against_all_types", baseTarget, { value: 1, unit: "boolean", ...withChance })];
        case 78: return [effect(rawEfficacy, "guard", baseTarget, { value: 1, unit: "boolean", ...withChance })];
        case 81: {
            const conversionChance = chance(skill.eff_value3);
            const kind = conversionChance === 100 ? "additional_super_attack" : "additional_attack";
            const attempts = [activationChancePercent, chance(skill.eff_value2)].filter((value, index, values) => value !== undefined && (index === 0 || value > 0));
            return attempts.map(attemptChance => effect(rawEfficacy, kind, baseTarget, {
                value: 1,
                unit: "flat",
                activationChancePercent: attemptChance,
                additionalToSuperChancePercent: conversionChance,
            }));
        }
        case 90: return [effect(rawEfficacy, "critical_chance", baseTarget, { value: v1 ?? undefined, unit: "percent" })];
        case 91: return [effect(rawEfficacy, "evade_chance", baseTarget, { value: v1 ?? undefined, unit: "percent" })];
        case 101: return [effect(rawEfficacy, "scouter", baseTarget, { value: 1, unit: "boolean", ...withChance })];
        default: return [{ kind: unknown(rawEfficacy), target: baseTarget, valueEvidence: "unknown" }];
    }
}
exports.mapDatabasePassiveEffects = mapDatabasePassiveEffects;
function parseCondition(raw, causalities) {
    if (typeof raw !== "string" || !raw.trim() || raw.trim() === "{}") {
        return { raw, compiled: undefined, referencedCausalityIds: [], causalities, mappingStatus: "unconditional" };
    }
    try {
        const parsed = JSON.parse(raw);
        const referenced = new Set();
        const visit = (value) => {
            if (typeof value === "number")
                referenced.add(String(value));
            else if (Array.isArray(value))
                value.forEach(visit);
            else if (value && typeof value === "object")
                Object.values(value).forEach(visit);
        };
        visit(parsed?.compiled);
        return {
            raw,
            compiled: parsed?.compiled,
            referencedCausalityIds: [...referenced].sort((left, right) => Number(left) - Number(right)),
            causalities,
            mappingStatus: "structured-uninterpreted",
        };
    }
    catch {
        return { raw, compiled: undefined, referencedCausalityIds: [], causalities, mappingStatus: "invalid-json" };
    }
}
function mapDatabasePassiveRule(passiveSkillSetId, relation, targetRows = []) {
    if (!relation.skill)
        return undefined;
    const skill = relation.skill.values;
    const passiveSkillId = relation.skill.provenance.rowId;
    const target = mapDatabasePassiveTarget(skill, targetRows);
    const effects = mapDatabasePassiveEffects(skill, target);
    const unknowns = [];
    if (effects.some(value => value.kind.value === "unknown"))
        unknowns.push(`efficacy_type:${String(skill.efficacy_type)}`);
    if (target.targetType.value === "unknown")
        unknowns.push(`target_type:${String(skill.target_type)}`);
    if (effects.some(value => value.unit === "unknown"))
        unknowns.push(`calc_option:${String(skill.calc_option)}`);
    if (id(skill.sub_target_type_set_id) && numberValue(skill.sub_target_type_set_id) !== 0 && targetRows.length === 0)
        unknowns.push(`missing_sub_target_type_set:${String(skill.sub_target_type_set_id)}`);
    const effectMappingStatus = effects.some(value => value.kind.value === "unknown")
        ? "unknown"
        : unknowns.length > 0 ? "partial" : "supported";
    return {
        ruleKey: `${passiveSkillSetId}:${relation.relation.provenance.rowId}:${passiveSkillId}`,
        passiveSkillSetId,
        passiveSkillId,
        relation: relation.relation,
        skill: relation.skill,
        visualEffect: relation.effect,
        target,
        effects,
        effectMappingStatus,
        condition: parseCondition(skill.causality_conditions ?? null, relation.causalities),
        rawEnums: {
            efficacyType: skill.efficacy_type ?? null,
            targetType: skill.target_type ?? null,
            executionTimingType: skill.exec_timing_type ?? null,
            calculationOption: skill.calc_option ?? null,
        },
        unknowns,
    };
}
exports.mapDatabasePassiveRule = mapDatabasePassiveRule;
function latestReleasedState(card) {
    const released = card.skillStates.filter(state => state.releaseState !== "unknown" && state.release.availableAtSnapshot !== false);
    return released.length > 0 ? [released[released.length - 1]] : [];
}
function formClosure(primary, cardsById) {
    const visited = new Set([primary.cardId]);
    const pending = primary.formRelations.flatMap(relation => relation.targetCardId ? [relation.targetCardId] : []);
    while (pending.length > 0) {
        const cardId = pending.shift();
        if (visited.has(cardId))
            continue;
        visited.add(cardId);
        const card = cardsById.get(cardId);
        if (card)
            pending.push(...card.formRelations.flatMap(relation => relation.targetCardId ? [relation.targetCardId] : []));
    }
    return [...visited].sort((left, right) => Number(left) - Number(right));
}
function buildDatabaseTeamAnalysisDataset(options) {
    const { characterDataset } = options;
    const cardsById = new Map(characterDataset.cards.map(card => [card.cardId, card]));
    const targetRowsBySet = groupBy(options.tables.sub_target_types, "sub_target_type_set_id");
    const compatibilityIds = new Set(options.auditedCompatibilityCardIds);
    const primaries = characterDataset.cards.filter(card => card.catalog.isProjectedPrimary || compatibilityIds.has(card.cardId));
    const states = [];
    for (const primary of primaries.sort((left, right) => Number(left.cardId) - Number(right.cardId))) {
        for (const formId of formClosure(primary, cardsById)) {
            const card = cardsById.get(formId);
            if (!card)
                continue;
            for (const sourceState of latestReleasedState(card)) {
                const projectedReleaseState = formId === primary.cardId ? sourceState.releaseState : "initial";
                const passiveSetId = sourceState.passiveSkill?.set.provenance.rowId;
                const rules = sourceState.passiveSkill?.relations.flatMap(relation => {
                    const targetSetId = id(relation.skill?.values.sub_target_type_set_id);
                    const targetRows = (targetRowsBySet.get(targetSetId ?? "") ?? []).map(row => sourced("sub_target_types", row));
                    const mappedRule = passiveSetId ? mapDatabasePassiveRule(passiveSetId, relation, targetRows) : undefined;
                    return mappedRule ? [mappedRule] : [];
                }) ?? [];
                const mappingStatus = rules.some(rule => rule.effectMappingStatus === "unknown")
                    ? "unknown"
                    : rules.some(rule => rule.effectMappingStatus === "partial") ? "partial" : "supported";
                states.push({
                    stateKey: `${primary.cardId}:${formId}:${projectedReleaseState}`,
                    characterId: primary.cardId,
                    formId,
                    releaseState: projectedReleaseState,
                    sourceReleaseState: sourceState.releaseState,
                    sourceStateKey: sourceState.stateKey,
                    displayName: card.localizedText.name,
                    selectionEvidence: formId !== primary.cardId
                        ? "first-party-form-relation"
                        : compatibilityIds.has(primary.cardId) ? "audited-compatibility" : "first-party-catalog",
                    passive: sourceState.passiveSkill ? {
                        set: sourceState.passiveSkill.set,
                        rawText: text(sourceState.passiveSkill.set.values.itemized_description),
                        rules,
                        mappingStatus,
                    } : undefined,
                });
            }
        }
    }
    states.sort((left, right) => left.stateKey.localeCompare(right.stateKey, "en", { numeric: true }));
    return {
        schemaVersion: 1,
        contract: "dokkan-team-analysis-database-experiment",
        contractVersion: "0.1.0",
        generatedAt: options.generatedAt,
        sourceCharacterContractVersion: characterDataset.contractVersion,
        sourceSnapshotVersion: characterDataset.sourceSnapshotVersion,
        sourceSha256: characterDataset.sourceSha256,
        selection: {
            primaryRule: "first-party-terminal-catalog-plus-explicit-audited-omissions",
            releaseRule: "latest-released-state-per-form-with-initial-compatibility-label-for-nested-forms",
            auditedCompatibilityCardIds: [...compatibilityIds].sort((left, right) => Number(left) - Number(right)),
        },
        states,
    };
}
exports.buildDatabaseTeamAnalysisDataset = buildDatabaseTeamAnalysisDataset;
function buildDatabaseTeamAnalysisCoverage(dataset) {
    const rules = dataset.states.flatMap(state => state.passive?.rules ?? []);
    const effects = rules.flatMap(rule => rule.effects);
    const efficacyCounts = {};
    const targetCounts = {};
    for (const rule of rules) {
        const efficacy = String(rule.rawEnums.efficacyType);
        const target = String(rule.rawEnums.targetType);
        efficacyCounts[efficacy] = (efficacyCounts[efficacy] ?? 0) + 1;
        targetCounts[target] = (targetCounts[target] ?? 0) + 1;
    }
    const presentEfficacies = Object.keys(efficacyCounts).map(Number).sort((a, b) => a - b);
    const presentTargets = Object.keys(targetCounts).map(Number).sort((a, b) => a - b);
    const effectCounts = Object.fromEntries([
        "ki", "hp", "atk", "def", "damage_reduction", "guard", "evade_chance", "critical_chance",
        "additional_attack", "additional_super_attack", "effective_against_all_types", "super_attack_seal",
        "stun_chance", "enemy_atk_down", "enemy_def_down", "ki_sphere_change", "scouter", "unknown",
    ].map(kind => [kind, effects.filter(effect => effect.kind.value === kind).length]));
    return {
        schemaVersion: 1,
        stateCount: dataset.states.length,
        primaryCharacterCount: new Set(dataset.states.map(state => state.characterId)).size,
        formStateCount: dataset.states.filter(state => state.characterId !== state.formId).length,
        releaseStateCounts: {
            initial: dataset.states.filter(state => state.releaseState === "initial").length,
            eza: dataset.states.filter(state => state.releaseState === "eza").length,
            seza: dataset.states.filter(state => state.releaseState === "seza").length,
        },
        passiveStateCount: dataset.states.filter(state => state.passive).length,
        passiveRuleCount: rules.length,
        mappedRuleCount: rules.filter(rule => rule.effectMappingStatus === "supported").length,
        partialRuleCount: rules.filter(rule => rule.effectMappingStatus === "partial").length,
        unknownRuleCount: rules.filter(rule => rule.effectMappingStatus === "unknown").length,
        effectCounts,
        efficacyEnum: {
            confirmed: presentEfficacies.filter(value => CONFIRMED_EFFICACY_TYPES.includes(value)),
            unknown: presentEfficacies.filter(value => !CONFIRMED_EFFICACY_TYPES.includes(value)),
            rowCounts: efficacyCounts,
        },
        targetEnum: {
            confirmed: presentTargets.filter(value => CONFIRMED_TARGET_TYPES.includes(value)),
            unknown: presentTargets.filter(value => !CONFIRMED_TARGET_TYPES.includes(value)),
            rowCounts: targetCounts,
        },
        conditionalRuleCount: rules.filter(rule => rule.condition.mappingStatus === "structured-uninterpreted").length,
        interpretedConditionCount: 0,
        danglingCausalityJoinCount: rules.filter(rule => rule.condition.mappingStatus === "invalid-json"
            || rule.condition.referencedCausalityIds.some(causalityId => !rule.condition.causalities.some(row => row.provenance.rowId === causalityId))).length,
        danglingSubTargetJoinCount: rules.filter(rule => rule.unknowns.some(value => value.startsWith("missing_sub_target_type_set:"))).length,
    };
}
exports.buildDatabaseTeamAnalysisCoverage = buildDatabaseTeamAnalysisCoverage;
//# sourceMappingURL=team-analysis-builder.js.map