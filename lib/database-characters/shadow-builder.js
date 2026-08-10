"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyCharacterShadowInMemory = exports.buildCharacterShadowProjection = void 0;
const shadow_contract_1 = require("./shadow-contract");
const shadow_release_1 = require("./shadow-release");
const numeric = (left, right) => Number(left) - Number(right) || left.localeCompare(right);
const missing = (value) => value === null || value === undefined;
const jsonEqual = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const normalizeArray = (value) => Array.isArray(value) ? value.map(String) : null;
const sortedArray = (value) => normalizeArray(value)?.slice().sort() ?? null;
function join(parity) {
    return { status: parity.identity === "agreement" ? "joined" : "unjoinable", externalId: parity.identity === "agreement" ? "pending" : null, comparisonState: parity.comparisonState };
}
function stateSource(state) {
    return state ? { stateId: state.stateId, sourceStateKey: state.sourceStateKey, releaseState: state.releaseState, growthRowId: state.growthRowId ?? null } : null;
}
function aggregateStatus(values) {
    return values.includes("unknown") ? "unknown" : values.includes("partial") ? "partial" : "supported";
}
function comparison(field, databaseValue, externalValue, status, joined) {
    if (!joined)
        return "unjoinable";
    if (status !== "supported" || missing(databaseValue))
        return "unknown";
    if (missing(externalValue))
        return "representation_gain";
    if (jsonEqual(databaseValue, externalValue))
        return "agreement";
    if (Array.isArray(databaseValue) && Array.isArray(externalValue) && jsonEqual(sortedArray(databaseValue), sortedArray(externalValue)))
        return "representation_mismatch";
    if (["name", "title", "categories", "links", "awakeningGraph", "formGraph"].includes(field))
        return field === "formGraph" ? "unknown" : "representation_mismatch";
    if (field === "characterClass" && databaseValue === "unawakened")
        return "representation_mismatch";
    if (["rarity", "type", "characterClass", "id"].includes(field))
        return "confirmed_conflict";
    return "representation_mismatch";
}
function externalValue(field, external) {
    if (!external)
        return null;
    switch (field) {
        case "id": return external.id;
        case "name": return external.name;
        case "title": return external.title;
        case "rarity": return external.rarity;
        case "type": return external.type;
        case "characterClass": return external.characterClass;
        case "categories": return external.categories;
        case "links": return external.links;
        case "awakeningGraph": return external.awakeningCardIds;
        case "formGraph": return external.transformationIds;
        default: return null;
    }
}
function externalColumn(field) {
    if (field === "awakeningGraph")
        return "awakeningCards[].id";
    if (field === "formGraph")
        return "transformations[].id";
    if (["id", "name", "title", "rarity", "type", "characterClass", "categories", "links"].includes(field))
        return field;
    return "(structural dimension absent from Character)";
}
function buildCharacterShadowProjection(inputs) {
    const k0Cards = new Map(inputs.k0.cards.map(card => [card.cardId, card]));
    const k0States = new Map(inputs.k0.states.map(state => [state.sourceStateKey, state]));
    const k2Cards = new Map(inputs.k2.cards.map(card => [card.cardId, card]));
    const categories = new Map(inputs.k2.categories.map(item => [item.id, item]));
    const links = new Map(inputs.k2.links.map(item => [item.id, item]));
    const releaseByCard = group(inputs.k1.releaseStateTransitions, item => item.cardId);
    const awakeningsByCard = group(inputs.k1.awakeningTransitions, item => item.sourceCardId);
    const formsByCard = group(inputs.k1.formTransitions, item => item.sourceCardId);
    const fields = [];
    const candidateRules = shadow_contract_1.CHARACTER_FIELD_AUTHORITY_MATRIX.filter(rule => rule.owner !== "external");
    for (const parityCard of inputs.k7.cards.slice().sort((a, b) => numeric(a.cardId, b.cardId))) {
        const identity = k0Cards.get(parityCard.cardId);
        const taxonomy = k2Cards.get(parityCard.cardId);
        if (!identity || !taxonomy)
            throw new Error(`K0/K2 card missing for K7 card ${parityCard.cardId}`);
        const productionState = k0States.get(parityCard.production.comparisonState.stateKey ?? "");
        const fyiState = k0States.get(parityCard.fyi.comparisonState.stateKey ?? "");
        const selected = productionState ?? fyiState;
        if (!selected)
            throw new Error(`K7 comparison state has no K0 binding for ${parityCard.cardId}`);
        const selectedComparisonSource = productionState ? "production" : "fyi";
        const productionExternal = inputs.production.characters.get(parityCard.cardId);
        const fyiExternal = inputs.fyi.characters.get(parityCard.cardId);
        const productionJoin = join(parityCard.production);
        const fyiJoin = join(parityCard.fyi);
        if (productionJoin.status === "joined")
            productionJoin.externalId = parityCard.cardId;
        if (fyiJoin.status === "joined")
            fyiJoin.externalId = parityCard.cardId;
        const k7StateProvenance = {
            sidecar: "k7",
            sidecarSha256: inputs.sidecarIdentities.k7.sha256,
            sourceSnapshotVersion: inputs.k0.source.snapshotVersion,
            table: "cards",
            rowId: parityCard.cardId,
            column: `${selectedComparisonSource}.comparisonState`,
            sourceState: stateSource(selected),
        };
        for (const rule of candidateRules) {
            const context = buildFieldContext(rule, identity, selected, taxonomy, categories, links, releaseByCard.get(identity.cardId) ?? [], awakeningsByCard.get(identity.cardId) ?? [], formsByCard.get(identity.cardId) ?? [], inputs);
            const productionValue = externalValue(rule.field, productionExternal);
            const fyiValue = externalValue(rule.field, fyiExternal);
            const externalProvenance = (source, external, parity) => external ? [{
                    sidecar: source,
                    sidecarSha256: source === "production" ? inputs.production.sha256 : inputs.fyi.sha256,
                    sourceSnapshotVersion: source === "production" ? inputs.k7.source.productionCharacters.asOf : inputs.fyi.generatedAt,
                    table: "Character[]",
                    rowId: external.id,
                    column: externalColumn(rule.field),
                    sourceRecordPath: external.sourceRecordPath,
                    recordSelectionPolicy: "top_level_then_first_nested_structural_id",
                    sourceState: stateSource(k0States.get(parity.comparisonState.stateKey ?? "")),
                }] : [];
            const productionComparison = comparison(rule.field, context.value, productionValue, context.status, productionJoin.status === "joined");
            const fyiComparison = comparison(rule.field, context.value, fyiValue, context.status, fyiJoin.status === "joined");
            const presentationNeedsExternalLocale = ["name", "title", "categories", "links"].includes(rule.field);
            const safeDatabaseCandidate = context.status === "supported" && ["agreement", "representation_gain"].includes(productionComparison)
                && (!presentationNeedsExternalLocale || productionComparison === "agreement");
            const authority = safeDatabaseCandidate ? "database_candidate" : rule.characterField && productionJoin.status === "joined" ? "external_fallback" : "unsupported";
            const fallbackReason = authority === "database_candidate" ? null
                : productionComparison === "unjoinable" ? "production structural ID is unjoinable; no Character may be created"
                    : context.status !== "supported" ? `${context.status} evidence cannot replace the external value`
                        : productionComparison === "confirmed_conflict" ? "confirmed conflict has no selected winner"
                            : productionComparison === "representation_mismatch" ? "representation differs; external ordering/presentation is retained"
                                : productionComparison === "unknown" ? "no proved common representation; external value is retained"
                                    : "shadow-only dimension has no Character field";
            fields.push({
                cardId: identity.cardId,
                recordKind: identity.recordKind,
                characterId: identity.characterId,
                stateId: selected.stateId,
                releaseState: selected.releaseState,
                growthRowId: selected.growthRowId ?? null,
                productionJoin,
                fyiJoin,
                field: rule.field,
                characterField: rule.characterField,
                databaseValue: context.value ?? null,
                externalValue: { production: productionValue ?? null, fyi: fyiValue ?? null },
                effectiveShadowValue: authority === "database_candidate" ? context.value ?? null : productionValue ?? null,
                evidenceStatus: context.status,
                authority,
                comparison: productionComparison,
                sourceComparisons: { production: productionComparison, fyi: fyiComparison },
                provenance: [
                    ...context.provenance,
                    ...externalProvenance("production", productionExternal, parityCard.production),
                    ...externalProvenance("fyi", fyiExternal, parityCard.fyi),
                    k7StateProvenance,
                ],
                fallbackReason,
            });
        }
    }
    return {
        schemaVersion: 1,
        contract: "dokkan-database-character-field-shadow",
        contractVersion: "1.0.0",
        generatedAt: inputs.k0.generatedAt,
        source: {
            snapshotVersion: inputs.k0.source.snapshotVersion,
            sidecars: inputs.sidecarIdentities,
            productionCharacters: { sha256: inputs.production.sha256, sizeBytes: inputs.production.sizeBytes, characterCount: inputs.production.topLevelCount },
            fyiCharacters: { sha256: inputs.fyi.sha256, sizeBytes: inputs.fyi.sizeBytes, characterCount: inputs.fyi.topLevelCount, generatedAt: inputs.fyi.generatedAt },
        },
        policy: { structuralIdsOnly: true, nameTextOrNumericProximityInference: false, fieldScopedPatches: true, unsupportedDefaults: false, k7ValuesConsumed: false, productionModified: false, publisherEnabled: false, androidEnabled: false },
        authorityMatrix: shadow_contract_1.CHARACTER_FIELD_AUTHORITY_MATRIX,
        fields,
    };
}
exports.buildCharacterShadowProjection = buildCharacterShadowProjection;
function group(values, key) {
    const result = new Map();
    for (const value of values)
        result.set(key(value), [...(result.get(key(value)) ?? []), value]);
    return result;
}
function buildFieldContext(rule, identity, state, taxonomy, categories, links, releases, awakenings, forms, inputs) {
    const stateValue = stateSource(state);
    const provenance = (sidecar, table, rowId, column) => ({
        sidecar, sidecarSha256: inputs.sidecarIdentities[sidecar].sha256, sourceSnapshotVersion: inputs.k0.source.snapshotVersion,
        table, rowId, column, sourceState: stateValue,
    });
    const labelProvenance = (label) => provenance("k2", label.source.table, label.source.rowId, label.source.column);
    switch (rule.field) {
        case "id": return { rule, value: identity.cardId, status: "supported", provenance: [provenance("k0", "cards", identity.cardId, "id")] };
        case "characterId": return { rule, value: identity.characterId, status: "supported", provenance: [provenance("k0", "cards", identity.cardId, "character_id"), provenance("k0", "characters", identity.characterId, "id")] };
        case "stateId": return { rule, value: state.stateId, status: state.evidenceStatus, provenance: [provenance("k0", "states", state.stateId)] };
        case "releaseState": return { rule, value: state.releaseState, status: state.evidenceStatus, provenance: [provenance("k0", "states", state.stateId, "releaseState")] };
        case "growthRowId": return { rule, value: state.growthRowId ?? null, status: state.evidenceStatus, provenance: [provenance("k0", "optimal_awakening_growths", state.growthRowId ?? state.stateId, "id")] };
        case "rarity": return { rule, value: taxonomy.rarity.value, status: taxonomy.rarity.status, provenance: [provenance("k2", "cards", identity.cardId, "rarity")] };
        case "originalRarity": return { rule, value: taxonomy.originalRarity.values, status: taxonomy.originalRarity.status, provenance: taxonomy.originalRarity.sourceCardIds.map(id => provenance("k2", "cards", id, "rarity")) };
        case "type": return { rule, value: taxonomy.type.value, status: taxonomy.type.status, provenance: [provenance("k2", "cards", identity.cardId, "element")] };
        case "characterClass": return { rule, value: taxonomy.characterClass.value, status: taxonomy.characterClass.status, provenance: [provenance("k2", "cards", identity.cardId, "element")] };
        case "name": {
            const label = taxonomy.labels.characterName ?? taxonomy.labels.uniqueInfoName ?? taxonomy.labels.cardTitle;
            return { rule, value: label?.value ?? null, status: label ? "supported" : "unknown", provenance: label ? [labelProvenance(label)] : [] };
        }
        case "title": {
            const label = taxonomy.labels.cardTitle;
            return { rule, value: label?.value ?? null, status: label ? "supported" : "unknown", provenance: label ? [labelProvenance(label)] : [] };
        }
        case "categoryIds": return { rule, value: taxonomy.categoryAssignments.map(item => item.categoryId), status: aggregateStatus(taxonomy.categoryAssignments.map(item => item.status)), provenance: taxonomy.categoryAssignments.map(item => provenance("k2", "card_card_categories", item.relationRowId, "card_category_id")) };
        case "categories": return {
            rule, value: taxonomy.categoryAssignments.map(item => categories.get(item.categoryId)?.label.value ?? null), status: aggregateStatus(taxonomy.categoryAssignments.map(item => categories.has(item.categoryId) ? item.status : "unknown")),
            provenance: taxonomy.categoryAssignments.flatMap(item => { const value = categories.get(item.categoryId); return [provenance("k2", "card_card_categories", item.relationRowId, "card_category_id"), ...(value ? [labelProvenance(value.label)] : [])]; }),
        };
        case "linkIds": return { rule, value: taxonomy.links.map(item => item.linkSkillId), status: aggregateStatus(taxonomy.links.map(item => item.status)), provenance: taxonomy.links.map(item => provenance("k2", "cards", identity.cardId, item.sourceColumn)) };
        case "links": return {
            rule, value: taxonomy.links.map(item => links.get(item.linkSkillId)?.label.value ?? null), status: aggregateStatus(taxonomy.links.map(item => links.has(item.linkSkillId) ? item.status : "unknown")),
            provenance: taxonomy.links.flatMap(item => { const value = links.get(item.linkSkillId); return [provenance("k2", "cards", identity.cardId, item.sourceColumn), ...(value ? [labelProvenance(value.label)] : [])]; }),
        };
        case "linkLevels": return {
            rule,
            value: taxonomy.links.map(item => ({ linkSkillId: item.linkSkillId, levels: (links.get(item.linkSkillId)?.levels ?? []).map(level => ({ linkSkillLevelId: level.linkSkillLevelId, level: level.level, label: level.description.value })) })),
            status: aggregateStatus(taxonomy.links.map(item => links.has(item.linkSkillId) ? item.status : "unknown")),
            provenance: taxonomy.links.flatMap(item => (links.get(item.linkSkillId)?.levels ?? []).map(level => labelProvenance(level.description))),
        };
        case "awakeningGraph": return {
            rule, value: awakenings.map(item => ({ transitionId: item.transitionId, kind: item.kind, targetCardId: item.targetCardId, targetStatus: item.targetStatus, routeRowId: item.route.rowId })),
            status: aggregateStatus(awakenings.map(item => item.targetStatus)), provenance: awakenings.map(item => provenance("k1", item.route.table, item.route.rowId)),
        };
        case "releaseStateGraph": return {
            rule, value: releases.map(item => ({ transitionId: item.transitionId, sourceStateId: item.sourceStateId, targetStateId: item.targetStateId, releaseState: item.releaseState, growthRowId: item.growthRowId, growthStep: item.growthStep })),
            status: aggregateStatus(releases.map(item => item.evidenceStatus)), provenance: releases.map(item => provenance("k1", "optimal_awakening_growths", item.growthRowId)),
        };
        case "formGraph": return {
            rule, value: forms.map(item => ({ transitionId: item.transitionId, kind: item.kind, channel: item.channel, targetCardId: item.targetCardId, stateBindingStatus: item.stateBindingStatus, reversible: item.reversible })),
            status: aggregateStatus(forms.map(item => item.stateBindingStatus)), provenance: forms.map(item => provenance("k1", item.source.table, item.source.rowId)),
        };
        default: throw new Error(`unsupported K0-K2 shadow field: ${rule.field}`);
    }
}
/** Applies only supported, conflict-free product fields to an in-memory clone. */
function applyCharacterShadowInMemory(characters, projection) {
    const clone = JSON.parse(JSON.stringify(characters));
    if (!(0, shadow_release_1.isVerifiedCharacterShadowProjection)(projection))
        return clone;
    const byPath = new Map();
    const visit = (character, path) => {
        if (character?.id !== undefined && character?.id !== null)
            byPath.set(path, character);
        (character?.transformations ?? []).forEach((item, index) => visit(item, `${path}.transformations[${index}]`));
    };
    clone.forEach((character, index) => visit(character, `$[${index}]`));
    const rules = new Map(shadow_contract_1.CHARACTER_FIELD_AUTHORITY_MATRIX.map(rule => [rule.field, rule]));
    for (const patch of projection.fields) {
        const rule = rules.get(patch.field);
        const source = patch.provenance.find(value => value.sidecar === "production" && value.sidecarSha256 === projection.source.productionCharacters.sha256 && value.rowId === patch.cardId);
        if (!rule || rule.owner === "external" || !rule.characterField || patch.characterField !== rule.characterField
            || patch.productionJoin.status !== "joined" || patch.authority !== "database_candidate" || patch.evidenceStatus !== "supported"
            || !["agreement", "representation_gain"].includes(patch.comparison) || !source?.sourceRecordPath)
            continue;
        const target = byPath.get(source.sourceRecordPath);
        if (!target || String(target.id) !== patch.cardId)
            continue;
        const currentValue = target[rule.characterField];
        const comparisonIsTrue = patch.comparison === "agreement"
            ? jsonEqual(patch.databaseValue, patch.externalValue.production) && jsonEqual(currentValue, patch.externalValue.production)
            : missing(patch.externalValue.production) && missing(currentValue);
        if (comparisonIsTrue)
            target[rule.characterField] = patch.databaseValue;
    }
    return clone;
}
exports.applyCharacterShadowInMemory = applyCharacterShadowInMemory;
//# sourceMappingURL=shadow-builder.js.map