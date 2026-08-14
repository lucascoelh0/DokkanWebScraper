import type { DatabaseCharacterTaxonomyDataset, CharacterCardTaxonomy } from "./taxonomy-contract";
import type { CharacterFieldProjection, CharacterFieldProvenance, CharacterShadowField } from "./shadow-contract";
import {
    STRUCTURAL_AUTHORITY_CONTRACT_VERSION,
    STRUCTURAL_AUTHORITY_FIELDS,
    StructuralAuthorityAudit,
    StructuralAuthorityCandidate,
    StructuralAuthorityClassification,
    StructuralAuthorityCollectionComparison,
    StructuralAuthorityCollectionSummary,
    StructuralAuthorityFact,
    StructuralAuthorityField,
    StructuralAuthorityLineage,
    StructuralAuthorityK11Provenance,
    StructuralAuthorityProductiveIndex,
    StructuralAuthorityProductiveRecord,
} from "./structural-authority-contract";

type SourceField = "characterClass" | "categoryIds" | "categories" | "linkIds" | "links";

interface CardAccumulator {
    cardId: string;
    fields: Partial<Record<SourceField, StoredProjection>>;
}

interface StoredProjection {
    cardId: string;
    recordKind: "collectable" | "form";
    stateId: string;
    field: SourceField;
    databaseValue: unknown;
    evidenceStatus: CharacterFieldProjection["evidenceStatus"];
    provenance: CharacterFieldProvenance[];
}

interface CollectionEvidence {
    ids: string[];
    labels: string[] | null;
    rawValue: unknown;
    status: "supported" | "partial" | "unknown";
    exclusions: string[];
    k11Provenance: StructuralAuthorityK11Provenance[];
    k2Provenance: StructuralAuthorityFact["provenance"]["k2"];
}

interface TaxonomyLabel {
    value: string;
    source: { table: string; rowId: string; column: string };
}

const sourceFields = new Set<SourceField>(["characterClass", "categoryIds", "categories", "linkIds", "links"]);
const numeric = (left: string, right: string) => Number(left) - Number(right) || left.localeCompare(right);
const stringify = (value: unknown) => JSON.stringify(value);

function duplicates(values: string[]): string[] {
    const seen = new Set<string>();
    const result = new Set<string>();
    values.forEach(value => seen.has(value) ? result.add(value) : seen.add(value));
    return [...result].sort();
}

function stringArray(value: unknown): string[] | null {
    return Array.isArray(value) && value.every(item => typeof item === "string") ? [...value] : null;
}

function sameSet(left: string[], right: string[]): boolean {
    if (new Set(left).size !== new Set(right).size) return false;
    const rightSet = new Set(right);
    return left.every(value => rightSet.has(value));
}

export function compareStructuralCollection(
    databaseIds: string[],
    projectedLabels: string[] | null,
    productiveRaw: unknown,
): { classification: StructuralAuthorityClassification; comparison: StructuralAuthorityCollectionComparison; exclusions: string[] } {
    const productiveLabels = stringArray(productiveRaw);
    const databaseDuplicateIds = duplicates(databaseIds);
    const databaseDuplicateLabels = projectedLabels ? duplicates(projectedLabels) : [];
    const productiveDuplicateLabels = productiveLabels ? duplicates(productiveLabels) : [];
    const comparison: StructuralAuthorityCollectionComparison = {
        ordered: projectedLabels && productiveLabels ? (stringify(projectedLabels) === stringify(productiveLabels) ? "equal" : "different") : "unavailable",
        set: projectedLabels && productiveLabels ? (sameSet(projectedLabels, productiveLabels) ? "equal" : "different") : "unavailable",
        databaseDuplicateIds,
        databaseDuplicateLabels,
        productiveDuplicateLabels,
    };
    const exclusions: string[] = [];
    if (databaseDuplicateIds.length) exclusions.push("duplicate_structural_ids");
    if (databaseDuplicateLabels.length) exclusions.push("ambiguous_id_to_label_projection");
    if (!projectedLabels) exclusions.push("missing_id_to_label_projection");
    if (productiveRaw !== null && productiveRaw !== undefined && !productiveLabels) exclusions.push("productive_value_is_not_string_array");
    if (productiveDuplicateLabels.length) exclusions.push("duplicate_productive_labels");
    if (exclusions.length) return { classification: "unknown", comparison, exclusions };
    if (productiveRaw === null || productiveRaw === undefined) return { classification: "representation_gain", comparison, exclusions };
    if (comparison.ordered === "equal") return { classification: "agreement", comparison, exclusions };
    if (comparison.set === "equal") return { classification: "representation_mismatch", comparison, exclusions: ["same_set_different_order"] };
    return { classification: "representation_mismatch", comparison, exclusions: ["label_set_difference_without_productive_structural_ids"] };
}

export function compareCharacterClass(databaseValue: unknown, productiveRaw: unknown): { classification: StructuralAuthorityClassification; exclusions: string[] } {
    if (databaseValue !== "Super" && databaseValue !== "Extreme" && databaseValue !== "unawakened") {
        return { classification: "unknown", exclusions: ["unknown_database_class"] };
    }
    if (productiveRaw === null || productiveRaw === undefined) {
        if (databaseValue === "unawakened") return { classification: "unknown", exclusions: ["unawakened_has_no_character_projection"] };
        return { classification: "representation_gain", exclusions: [] };
    }
    if (productiveRaw !== "Super" && productiveRaw !== "Extreme") {
        return { classification: "representation_mismatch", exclusions: ["productive_class_representation_changed"] };
    }
    if (databaseValue === productiveRaw) return { classification: "agreement", exclusions: [] };
    if (databaseValue === "unawakened") return { classification: "representation_mismatch", exclusions: ["unawakened_is_not_coerced"] };
    return { classification: "confirmed_conflict", exclusions: ["different_supported_class"] };
}

function productiveRecord(value: any, sourceRecordPath: string, recordKind: StructuralAuthorityProductiveRecord["recordKind"]): StructuralAuthorityProductiveRecord {
    const has = (field: "characterClass" | "categories" | "links") => Object.prototype.hasOwnProperty.call(value, field);
    return {
        cardId: String(value.id),
        sourceRecordPath,
        recordKind,
        characterClass: has("characterClass") ? value.characterClass : null,
        categories: has("categories") ? value.categories : null,
        links: has("links") ? value.links : null,
        fieldPresence: {
            characterClass: has("characterClass"),
            categories: has("categories"),
            links: has("links"),
        },
    };
}

const productiveSignature = (value: StructuralAuthorityProductiveRecord) => stringify([
    value.fieldPresence.characterClass,
    value.characterClass,
    value.fieldPresence.categories,
    value.categories,
    value.fieldPresence.links,
    value.links,
]);

/** Selects one productive record per card ID; equal repeated nested records use their first exact path. */
export function indexProductiveCharacterRecords(characters: unknown[]): StructuralAuthorityProductiveIndex {
    const topLevel = new Map<string, StructuralAuthorityProductiveRecord[]>();
    const nested = new Map<string, StructuralAuthorityProductiveRecord[]>();
    characters.forEach((value: any, index) => {
        if (!value || value.id === undefined || value.id === null) return;
        const record = productiveRecord(value, `$[${index}]`, "top_level");
        topLevel.set(record.cardId, [...(topLevel.get(record.cardId) ?? []), record]);
    });
    const visit = (value: any, path: string): void => {
        const transformations = Array.isArray(value?.transformations) ? value.transformations : [];
        transformations.forEach((item: any, index: number) => {
            const itemPath = `${path}.transformations[${index}]`;
            if (!item || item.id === undefined || item.id === null) return;
            const record = productiveRecord(item, itemPath, "nested_transformation");
            nested.set(record.cardId, [...(nested.get(record.cardId) ?? []), record]);
            visit(item, itemPath);
        });
    };
    characters.forEach((value, index) => visit(value, `$[${index}]`));

    const selected = new Map<string, StructuralAuthorityProductiveRecord>();
    const ambiguous = new Map<string, string[]>();
    const ids = [...new Set([...topLevel.keys(), ...nested.keys()])].sort(numeric);
    for (const id of ids) {
        const primary = topLevel.get(id) ?? [];
        if (primary.length === 1) selected.set(id, primary[0]);
        else if (primary.length > 1) ambiguous.set(id, primary.map(item => item.sourceRecordPath).sort());
        else {
            const alternatives = nested.get(id) ?? [];
            if (alternatives.length && new Set(alternatives.map(productiveSignature)).size === 1) selected.set(id, alternatives[0]);
            else if (alternatives.length) ambiguous.set(id, alternatives.map(item => item.sourceRecordPath).sort());
        }
    }
    return { selected, ambiguous, topLevelCount: characters.length };
}

function stateIdentity(fields: StoredProjection[]): { stateId: string; stateKey: string; recordKind: "collectable" | "form"; exclusions: string[] } {
    const stateIds = new Set(fields.map(item => item.stateId).filter(Boolean));
    const stateKeys = new Set(fields.flatMap(item => item.provenance.flatMap(provenance =>
        ["k0", "k1", "k2"].includes(provenance.sidecar) && provenance.sourceState ? [provenance.sourceState.sourceStateKey] : [],
    )));
    const recordKinds = new Set(fields.map(item => item.recordKind));
    const exclusions: string[] = [];
    if (stateIds.size !== 1) exclusions.push("ambiguous_state_id");
    if (stateKeys.size !== 1) exclusions.push("ambiguous_state_key");
    if (recordKinds.size !== 1) exclusions.push("ambiguous_record_kind");
    return {
        stateId: stateIds.size === 1 ? [...stateIds][0] : "",
        stateKey: stateKeys.size === 1 ? [...stateKeys][0] : "",
        recordKind: recordKinds.size === 1 ? [...recordKinds][0] : "collectable",
        exclusions,
    };
}

function aggregateStatus(fields: StoredProjection[]): "supported" | "partial" | "unknown" {
    if (fields.some(item => item.evidenceStatus === "unknown")) return "unknown";
    if (fields.some(item => item.evidenceStatus === "partial")) return "partial";
    return "supported";
}

function compactK11Provenance(fields: StoredProjection[]): StructuralAuthorityK11Provenance[] {
    const values = fields.flatMap(item => item.provenance.filter(provenance => provenance.sidecar === "k2").map(provenance => ({
        sourceField: item.field,
        table: provenance.table,
        rowId: provenance.rowId,
        column: provenance.column ?? null,
        stateId: provenance.sourceState?.stateId ?? "",
        stateKey: provenance.sourceState?.sourceStateKey ?? "",
    })));
    const seen = new Set<string>();
    return values.filter(value => {
        const key = stringify(value);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function validateK11K2Provenance(fields: StoredProjection[], cardId: string, stateId: string, stateKey: string, expectedK2Sha256: string): string[] {
    const exclusions: string[] = [];
    for (const item of fields) {
        const evidence = item.provenance.filter(provenance => provenance.sidecar === "k2");
        if (!evidence.length) exclusions.push(`${item.field}:missing_k2_provenance`);
        if (evidence.some(provenance => provenance.sidecarSha256 !== expectedK2Sha256 || provenance.sourceSnapshotVersion === "")) exclusions.push(`${item.field}:k2_provenance_lineage_changed`);
        if (evidence.some(provenance => provenance.sourceState?.stateId !== stateId || provenance.sourceState?.sourceStateKey !== stateKey)) exclusions.push(`${item.field}:field_state_binding_changed`);
        if (evidence.some(provenance => provenance.rowId === "" || provenance.table === "")) exclusions.push(`${item.field}:incomplete_field_provenance`);
    }
    if (fields.some(item => item.cardId !== cardId)) exclusions.push("card_binding_changed");
    return [...new Set(exclusions)].sort();
}

function taxonomyIndexes(taxonomy: DatabaseCharacterTaxonomyDataset): {
    cards: Map<string, CharacterCardTaxonomy>;
    categories: Map<string, TaxonomyLabel>;
    links: Map<string, TaxonomyLabel>;
    ambiguousCategoryLabels: Set<string>;
    ambiguousLinkLabels: Set<string>;
} {
    const unique = <T extends { id: string }>(values: T[], label: string): Map<string, T> => {
        const result = new Map<string, T>();
        values.forEach(value => {
            if (result.has(value.id)) throw new Error(`duplicate K2 ${label} ID ${value.id}`);
            result.set(value.id, value);
        });
        return result;
    };
    const cards = new Map<string, CharacterCardTaxonomy>();
    taxonomy.cards.forEach(card => {
        if (cards.has(card.cardId)) throw new Error(`duplicate K2 card ID ${card.cardId}`);
        cards.set(card.cardId, card);
    });
    const categoryEntries = unique(taxonomy.categories, "category");
    const linkEntries = unique(taxonomy.links, "link");
    const categories = new Map([...categoryEntries].map(([id, value]) => [id, { value: value.label.value, source: value.label.source }]));
    const links = new Map([...linkEntries].map(([id, value]) => [id, { value: value.label.value, source: value.label.source }]));
    const ambiguousLabels = (values: Map<string, TaxonomyLabel>): Set<string> => {
        const labels = [...values.values()].map(value => value.value);
        return new Set(labels.filter((value, index) => labels.indexOf(value) !== index));
    };
    return { cards, categories, links, ambiguousCategoryLabels: ambiguousLabels(categories), ambiguousLinkLabels: ambiguousLabels(links) };
}

function collectionEvidence(
    card: CharacterCardTaxonomy | undefined,
    idsField: StoredProjection,
    labelsField: StoredProjection,
    field: "categories" | "links",
    dictionary: Map<string, TaxonomyLabel>,
    ambiguousLabels: Set<string>,
): CollectionEvidence {
    const ids = stringArray(idsField.databaseValue) ?? [];
    const dictionaryEntries = ids.map(id => dictionary.get(id));
    const labels = dictionaryEntries.map(entry => entry?.value);
    const exclusions: string[] = [];
    if (!Array.isArray(idsField.databaseValue) || !idsField.databaseValue.every(value => typeof value === "string")) exclusions.push("K11_structural_ids_are_not_string_array");
    if (!card) exclusions.push("missing_K2_card");
    const k2Ids = field === "categories" ? card?.categoryAssignments.map(item => item.categoryId) : card?.links.map(item => item.linkSkillId);
    if (k2Ids && stringify(ids) !== stringify(k2Ids)) exclusions.push("K11_K2_structural_order_changed");
    if (labels.some(value => value === undefined)) exclusions.push("missing_id_to_label_projection");
    if (labels.some(value => value !== undefined && ambiguousLabels.has(value))) exclusions.push("ambiguous_id_to_label_projection");
    const k11Labels = stringArray(labelsField.databaseValue);
    if (k11Labels && labels.every(value => value !== undefined) && stringify(k11Labels) !== stringify(labels)) exclusions.push("K11_K2_label_projection_changed");
    const assignmentsSupported = field === "categories"
        ? card?.categoryAssignments.every(item => item.status === "supported")
        : card?.links.every(item => item.status === "supported");
    if (assignmentsSupported === false) exclusions.push("K2_assignment_not_supported");
    const assignmentProvenance: StructuralAuthorityFact["provenance"]["k2"] = field === "categories"
        ? (card?.categoryAssignments ?? []).map(item => ({ role: "assignment", structuralId: item.categoryId, table: "card_card_categories", rowId: item.relationRowId, column: "card_category_id" }))
        : (card?.links ?? []).map(item => ({ role: "assignment", structuralId: item.linkSkillId, table: "cards", rowId: card!.cardId, column: item.sourceColumn }));
    const labelProvenance: StructuralAuthorityFact["provenance"]["k2"] = dictionaryEntries.flatMap((entry, index) => entry ? [{
        role: "dictionary_label" as const,
        structuralId: ids[index],
        table: entry.source.table,
        rowId: entry.source.rowId,
        column: entry.source.column,
    }] : []);
    return {
        ids,
        labels: labels.every(value => value !== undefined) && !labels.some(value => ambiguousLabels.has(value!)) ? labels as string[] : null,
        rawValue: field === "categories" ? card?.categoryAssignments ?? null : card?.links ?? null,
        status: aggregateStatus([idsField, labelsField]),
        exclusions,
        k11Provenance: compactK11Provenance([idsField, labelsField]),
        k2Provenance: [...assignmentProvenance, ...labelProvenance],
    };
}

function candidateFor(classification: StructuralAuthorityClassification, databaseValue: string | string[], ids: string[] | null): StructuralAuthorityCandidate | null {
    if (classification !== "agreement" && classification !== "representation_gain") return null;
    return {
        representation: "audit_only_unbound",
        structuralIds: ids,
        databaseValue,
        projectedCharacterValue: null,
        productiveComparisonBinding: "card_id_only",
        productiveStateBinding: "unavailable",
        authorityEligibility: "ineligible_unproved_productive_state",
        characterPatchable: false,
    };
}

function productiveProvenance(lineage: StructuralAuthorityLineage, productive: StructuralAuthorityProductiveRecord | undefined) {
    return productive ? { payloadSha256: lineage.productiveCharacters.payloadSha256, sourceRecordPath: productive.sourceRecordPath } : null;
}

function classificationCounts(): Record<StructuralAuthorityClassification, number> {
    return { agreement: 0, representation_gain: 0, representation_mismatch: 0, confirmed_conflict: 0, unknown: 0, unjoinable: 0 };
}

function collectionSummary(): StructuralAuthorityCollectionSummary {
    return { label: "non_exclusive_collection_comparisons", orderedEqual: 0, orderedDifferent: 0, setEqual: 0, setDifferent: 0, sameSetDifferentOrder: 0, unavailable: 0 };
}

export class StructuralAuthorityAuditBuilder {
    private readonly cards = new Map<string, CardAccumulator>();

    accept(item: CharacterFieldProjection): void {
        if (!item || !sourceFields.has(item.field as SourceField)) return;
        const field = item.field as SourceField;
        const card = this.cards.get(item.cardId) ?? { cardId: item.cardId, fields: {} };
        if (card.fields[field]) throw new Error(`duplicate K11 structural authority field ${item.cardId}:${field}`);
        card.fields[field] = {
            cardId: item.cardId,
            recordKind: item.recordKind,
            stateId: item.stateId,
            field,
            databaseValue: item.databaseValue,
            evidenceStatus: item.evidenceStatus,
            provenance: item.provenance.filter(provenance => provenance.sidecar === "k2"),
        };
        this.cards.set(item.cardId, card);
    }

    finish(taxonomy: DatabaseCharacterTaxonomyDataset, productiveIndex: StructuralAuthorityProductiveIndex, lineage: StructuralAuthorityLineage, generatedAt: string): StructuralAuthorityAudit {
        const taxonomyIndex = taxonomyIndexes(taxonomy);
        const facts: StructuralAuthorityFact[] = [];
        for (const [cardId, accumulator] of [...this.cards].sort(([left], [right]) => numeric(left, right))) {
            const required = ["characterClass", "categoryIds", "categories", "linkIds", "links"] as const;
            if (required.some(field => !accumulator.fields[field])) throw new Error(`incomplete K11 structural authority fields for ${cardId}`);
            const source = accumulator.fields as Record<SourceField, StoredProjection>;
            const allFields = required.map(field => source[field]);
            const identity = stateIdentity(allFields);
            const productive = productiveIndex.selected.get(cardId);
            const ambiguousPaths = productiveIndex.ambiguous.get(cardId);
            const card = taxonomyIndex.cards.get(cardId);

            const classExclusions = [
                ...identity.exclusions,
                ...validateK11K2Provenance([source.characterClass], cardId, identity.stateId, identity.stateKey, lineage.k2.sha256),
            ];
            if (!card) classExclusions.push("missing_K2_card");
            if (card && source.characterClass.databaseValue !== card.characterClass.value) classExclusions.push("K11_K2_class_projection_changed");
            if (card?.characterClass.status !== "supported") classExclusions.push("K2_class_not_supported");
            const classStatus = aggregateStatus([source.characterClass]);
            let classResult = compareCharacterClass(source.characterClass.databaseValue, productive?.characterClass);
            if (ambiguousPaths || !productive || identity.exclusions.length) classResult = { classification: "unjoinable", exclusions: [ambiguousPaths ? "ambiguous_productive_card_id_binding" : !productive ? "productive_card_id_missing" : "ambiguous_K11_state_binding"] };
            else if (classStatus !== "supported" || classExclusions.length) classResult = { classification: "unknown", exclusions: classExclusions };
            const classCandidate = classStatus === "supported" && classExclusions.length === 0
                ? candidateFor(classResult.classification, String(source.characterClass.databaseValue), null)
                : null;
            facts.push({
                cardId, stateId: identity.stateId, stateKey: identity.stateKey, evidenceBinding: "card_id_state_id_state_key", recordKind: identity.recordKind, field: "characterClass",
                evidenceStatus: classStatus, classification: classResult.classification,
                database: { rawValue: card?.characterClass.raw ?? null, normalizedValue: source.characterClass.databaseValue, structuralIds: null, projectedLabels: null },
                productive: {
                    cardId: productive?.cardId ?? null,
                    comparisonBinding: "card_id_only",
                    stateBinding: "unavailable",
                    fieldPresent: productive?.fieldPresence.characterClass ?? null,
                    rawValue: productive?.characterClass ?? null,
                    sourceRecordPath: productive?.sourceRecordPath ?? null,
                    recordKind: productive?.recordKind ?? null,
                },
                collectionComparison: null,
                provenance: {
                    k11: compactK11Provenance([source.characterClass]),
                    k2: card ? [{ role: "scalar", structuralId: null, table: "cards", rowId: cardId, column: "element" }] : [],
                    productive: productiveProvenance(lineage, productive),
                },
                exclusions: [...new Set([...classExclusions, ...classResult.exclusions])].sort(), candidate: classCandidate,
            });

            for (const field of ["categories", "links"] as const) {
                const idsField = source[field === "categories" ? "categoryIds" : "linkIds"];
                const labelsField = source[field];
                const evidence = collectionEvidence(
                    card, idsField, labelsField, field,
                    field === "categories" ? taxonomyIndex.categories : taxonomyIndex.links,
                    field === "categories" ? taxonomyIndex.ambiguousCategoryLabels : taxonomyIndex.ambiguousLinkLabels,
                );
                const provenanceExclusions = validateK11K2Provenance([idsField, labelsField], cardId, identity.stateId, identity.stateKey, lineage.k2.sha256);
                const baseExclusions = [...identity.exclusions, ...evidence.exclusions, ...provenanceExclusions];
                let result = compareStructuralCollection(evidence.ids, evidence.labels, productive?.[field]);
                if (ambiguousPaths || !productive || identity.exclusions.length) result = {
                    classification: "unjoinable",
                    comparison: result.comparison,
                    exclusions: [ambiguousPaths ? "ambiguous_productive_card_id_binding" : !productive ? "productive_card_id_missing" : "ambiguous_K11_state_binding"],
                };
                else if (evidence.status !== "supported" || baseExclusions.length) result = { classification: "unknown", comparison: result.comparison, exclusions: baseExclusions };
                const exclusions = [...new Set([...baseExclusions, ...result.exclusions])].sort();
                const candidate = evidence.status === "supported" && exclusions.length === 0
                    ? candidateFor(result.classification, evidence.ids, evidence.ids)
                    : null;
                facts.push({
                    cardId, stateId: identity.stateId, stateKey: identity.stateKey, evidenceBinding: "card_id_state_id_state_key", recordKind: identity.recordKind, field,
                    evidenceStatus: evidence.status, classification: result.classification,
                    database: { rawValue: evidence.rawValue, normalizedValue: evidence.labels, structuralIds: evidence.ids, projectedLabels: evidence.labels },
                    productive: {
                        cardId: productive?.cardId ?? null,
                        comparisonBinding: "card_id_only",
                        stateBinding: "unavailable",
                        fieldPresent: productive?.fieldPresence[field] ?? null,
                        rawValue: productive?.[field] ?? null,
                        sourceRecordPath: productive?.sourceRecordPath ?? null,
                        recordKind: productive?.recordKind ?? null,
                    },
                    collectionComparison: result.comparison,
                    provenance: { k11: evidence.k11Provenance, k2: evidence.k2Provenance, productive: productiveProvenance(lineage, productive) },
                    exclusions, candidate,
                });
            }
        }

        const fieldSummaries = STRUCTURAL_AUTHORITY_FIELDS.map(field => {
            const values = facts.filter(item => item.field === field);
            const counts = classificationCounts();
            values.forEach(item => counts[item.classification]++);
            const cardIdComparableFactCount = values.length - counts.unjoinable;
            const blockers = counts.representation_mismatch + counts.confirmed_conflict + counts.unknown;
            return {
                field,
                exclusiveClassifications: counts,
                supportedCandidateCount: values.filter(item => item.candidate).length,
                authorityEligibleCandidateCount: 0,
                characterPatchableCandidateCount: values.filter(item => item.candidate?.characterPatchable).length,
                cardIdComparableFactCount,
                fullCardIdComparableScopeEvidence: cardIdComparableFactCount > 0 && blockers === 0 ? "GO" as const : "NO-GO" as const,
                authorityPromotion: "NO-GO" as const,
            };
        });
        const collectionComparisons = { categories: collectionSummary(), links: collectionSummary() };
        for (const field of ["categories", "links"] as const) {
            facts.filter(item => item.field === field).forEach(item => {
                const value = item.collectionComparison!;
                if (value.ordered === "equal") collectionComparisons[field].orderedEqual++;
                else if (value.ordered === "different") collectionComparisons[field].orderedDifferent++;
                if (value.set === "equal") collectionComparisons[field].setEqual++;
                else if (value.set === "different") collectionComparisons[field].setDifferent++;
                if (value.ordered === "different" && value.set === "equal") collectionComparisons[field].sameSetDifferentOrder++;
                if (value.ordered === "unavailable" || value.set === "unavailable") collectionComparisons[field].unavailable++;
            });
        }
        const databaseIds = new Set(this.cards.keys());
        const productiveCardIdsOutsideDatabase = [...productiveIndex.selected.keys()].filter(cardId => !databaseIds.has(cardId)).sort(numeric);
        return {
            schemaVersion: 1,
            contract: "dokkan-database-character-structural-authority-audit",
            contractVersion: STRUCTURAL_AUTHORITY_CONTRACT_VERSION,
            generatedAt,
            mode: "offline_default_off_audit",
            source: lineage,
            policy: {
                fields: ["characterClass", "categories", "links"], structuralIdentityOnly: true,
                k11K2EvidenceBinding: "card_id_state_id_state_key", productiveComparisonBinding: "card_id_only", productiveStateBinding: "unavailable",
                namesOrLocalizedTextAsJoinIdentity: false, fieldScopedProvenanceRequired: true, rawValuesAndOrderPreserved: true,
                setEqualitySelectsAuthority: false, supportedOnlyCandidates: true, productionValuesChanged: false,
                applyImplemented: false, writerImplemented: false, consumerImplemented: false, publisherEnabled: false, androidEnabled: false,
            },
            inventory: {
                databaseCards: this.cards.size,
                productiveTopLevelCharacters: productiveIndex.topLevelCount,
                productiveSelectedCardIds: productiveIndex.selected.size,
                productiveAmbiguousCardIds: productiveIndex.ambiguous.size,
                productiveCardIdsOutsideDatabase,
                factCount: facts.length,
            },
            fields: fieldSummaries,
            collectionComparisons,
            facts,
            readiness: { audit: "GO", authorityPromotion: "NO-GO", productionMutation: "NO-GO", consumer: "NO-GO", publisher: "NO-GO", r2: "NO-GO", android: "NO-GO" },
        };
    }
}

export function buildStructuralAuthorityAudit(
    fields: CharacterFieldProjection[],
    taxonomy: DatabaseCharacterTaxonomyDataset,
    productiveIndex: StructuralAuthorityProductiveIndex,
    lineage: StructuralAuthorityLineage,
    generatedAt: string,
): StructuralAuthorityAudit {
    const builder = new StructuralAuthorityAuditBuilder();
    fields.forEach(field => builder.accept(field));
    return builder.finish(taxonomy, productiveIndex, lineage, generatedAt);
}
