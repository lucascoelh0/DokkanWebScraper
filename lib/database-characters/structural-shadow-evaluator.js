"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateCharacterStructuralRepresentation = void 0;
const crypto_1 = require("crypto");
const structural_shadow_contract_1 = require("./structural-shadow-contract");
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const hashJson = (value) => (0, crypto_1.createHash)("sha256").update(JSON.stringify(value)).digest("hex");
function scalarSummary(value) {
    return {
        kind: "scalar",
        elementCount: value === undefined ? 0 : 1,
        orderedSha256: value === undefined ? null : hashJson(value),
        scalarValue: typeof value === "string" ? value : null,
    };
}
function collectionSummary(value) {
    return {
        kind: "ordered_collection",
        elementCount: Array.isArray(value) ? value.length : 0,
        orderedSha256: Array.isArray(value) ? hashJson(value) : null,
        scalarValue: null,
    };
}
function addExample(examples, productive, classification, k32, productiveValue) {
    if (classification === "agreement" || classification === "ordered_agreement"
        || examples.length >= structural_shadow_contract_1.CHARACTER_STRUCTURAL_SHADOW_EXAMPLE_LIMIT)
        return;
    examples.push({
        cardId: productive.cardId,
        recordKind: productive.recordKind,
        productivePath: productive.productivePath,
        releaseStateBinding: "unavailable",
        classification,
        k32,
        productive: productiveValue,
    });
}
function indexProductiveRecords(characters) {
    if (!Array.isArray(characters))
        throw new Error("K33 productive Character payload must be an array");
    const records = [];
    const pathsByCardId = new Map();
    const accept = (value, path, recordKind) => {
        if (!value || typeof value !== "object" || Array.isArray(value))
            throw new Error(`K33 malformed productive record at ${path}`);
        const record = value;
        if (!own(record, "id") || !/^\d+$/.test(String(record.id)))
            throw new Error(`K33 malformed productive cardId at ${path}`);
        const cardId = String(record.id);
        const previous = pathsByCardId.get(cardId);
        if (previous)
            throw new Error(`K33 ambiguous duplicate productive cardId ${cardId} at ${previous} and ${path}`);
        pathsByCardId.set(cardId, path);
        records.push({ cardId, recordKind, productivePath: path, value: record });
        if (own(record, "transformations") && record.transformations !== undefined && !Array.isArray(record.transformations)) {
            throw new Error(`K33 malformed productive transformations at ${path}`);
        }
        (record.transformations ?? []).forEach((item, index) => {
            accept(item, `${path}.transformations[${index}]`, "transformation");
        });
    };
    characters.forEach((value, index) => accept(value, `$[${index}]`, "top_level"));
    return records;
}
function indexSidecarRecords(records) {
    const result = new Map();
    records.forEach((record, index) => {
        if (!record || !/^\d+$/.test(record.cardId))
            throw new Error(`K33 malformed K32 cardId at $.records[${index}]`);
        if (result.has(record.cardId))
            throw new Error(`K33 ambiguous duplicate K32 cardId ${record.cardId}`);
        result.set(record.cardId, record);
    });
    return result;
}
function emptyClassAggregate() {
    return {
        exclusive: { agreement: 0, representation_mismatch: 0, unknown: 0 },
        nonExclusiveDiagnostics: {
            sidecarStatusNotSupported: 0,
            productiveFieldAbsent: 0,
            productiveRepresentationUnsupported: 0,
        },
        examples: [],
    };
}
function emptyCollectionAggregate() {
    return {
        exclusive: {
            ordered_agreement: 0,
            same_multiset_different_order: 0,
            different_representation: 0,
            unknown: 0,
        },
        nonExclusiveDiagnostics: {
            sidecarStatusNotSupported: 0,
            emptyContainerAbsenceUnproved: 0,
            absentContainerUnproved: 0,
            assignmentOrEntryStatusNotSupported: 0,
            presentationLabelUnresolved: 0,
            productiveFieldAbsent: 0,
            productiveValueNotStringArray: 0,
        },
        examples: [],
    };
}
function sameMultiset(left, right) {
    if (left.length !== right.length)
        return false;
    const counts = new Map();
    left.forEach(value => counts.set(value, (counts.get(value) ?? 0) + 1));
    for (const value of right) {
        const count = counts.get(value) ?? 0;
        if (count === 0)
            return false;
        if (count === 1)
            counts.delete(value);
        else
            counts.set(value, count - 1);
    }
    return counts.size === 0;
}
function compareClass(sidecar, productive, aggregate) {
    const fieldPresent = own(productive.value, "characterClass");
    const productiveValue = productive.value.characterClass;
    let classification;
    if (sidecar.characterClass.status !== "supported") {
        aggregate.nonExclusiveDiagnostics.sidecarStatusNotSupported++;
        classification = "unknown";
    }
    else if (!fieldPresent) {
        aggregate.nonExclusiveDiagnostics.productiveFieldAbsent++;
        classification = "unknown";
    }
    else if (!["unawakened", "Super", "Extreme"].includes(String(productiveValue))) {
        aggregate.nonExclusiveDiagnostics.productiveRepresentationUnsupported++;
        classification = "unknown";
    }
    else if (sidecar.characterClass.value === productiveValue) {
        classification = "agreement";
    }
    else {
        classification = "representation_mismatch";
    }
    aggregate.exclusive[classification]++;
    addExample(aggregate.examples, productive, classification, scalarSummary(sidecar.characterClass.value), scalarSummary(productiveValue));
}
function compareCollection(field, sidecar, productive, aggregate) {
    const collection = field === "categories" ? sidecar.categories : sidecar.links;
    const values = field === "categories"
        ? sidecar.categories.assignments.map(item => ({ status: item.status, labelEvidence: item.labelEvidence }))
        : sidecar.links.entries.map(item => ({ status: item.status, labelEvidence: item.labelEvidence }));
    const fieldPresent = own(productive.value, field);
    const productiveValue = productive.value[field];
    const sidecarLabels = values.flatMap(item => item.labelEvidence.status === "supported" ? [item.labelEvidence.value] : []);
    const allStatusesSupported = values.every(item => item.status === "supported");
    const allLabelsResolved = values.every(item => item.labelEvidence.status === "supported");
    const productiveLabels = Array.isArray(productiveValue) && productiveValue.every(item => typeof item === "string")
        ? productiveValue : null;
    if (collection.status !== "supported")
        aggregate.nonExclusiveDiagnostics.sidecarStatusNotSupported++;
    if (collection.state === "empty_with_container_provenance_absence_unproved")
        aggregate.nonExclusiveDiagnostics.emptyContainerAbsenceUnproved++;
    if (collection.state === "absent_unproved")
        aggregate.nonExclusiveDiagnostics.absentContainerUnproved++;
    if (!allStatusesSupported)
        aggregate.nonExclusiveDiagnostics.assignmentOrEntryStatusNotSupported++;
    if (!allLabelsResolved)
        aggregate.nonExclusiveDiagnostics.presentationLabelUnresolved++;
    if (!fieldPresent)
        aggregate.nonExclusiveDiagnostics.productiveFieldAbsent++;
    if (fieldPresent && !productiveLabels)
        aggregate.nonExclusiveDiagnostics.productiveValueNotStringArray++;
    let classification;
    if (collection.status !== "supported" || collection.state !== "present_with_row_provenance"
        || !allStatusesSupported || !allLabelsResolved || !fieldPresent || !productiveLabels) {
        classification = "unknown";
    }
    else if (JSON.stringify(sidecarLabels) === JSON.stringify(productiveLabels)) {
        classification = "ordered_agreement";
    }
    else if (sameMultiset(sidecarLabels, productiveLabels)) {
        classification = "same_multiset_different_order";
    }
    else {
        classification = "different_representation";
    }
    aggregate.exclusive[classification]++;
    addExample(aggregate.examples, productive, classification, collectionSummary(sidecarLabels), collectionSummary(productiveValue));
}
function evaluateCharacterStructuralRepresentation(sidecar, characters) {
    if (!sidecar || !Array.isArray(sidecar.records))
        throw new Error("K33 malformed K32 sidecar records");
    const sidecarIndex = indexSidecarRecords(sidecar.records);
    const productiveRecords = indexProductiveRecords(characters);
    const characterClass = emptyClassAggregate();
    const categories = emptyCollectionAggregate();
    const links = emptyCollectionAggregate();
    let comparableCardIds = 0;
    let productiveCardIdsOutsideSidecar = 0;
    let productiveTopLevelComparableRecords = 0;
    let productiveTransformationComparableRecords = 0;
    let productiveComparableRecordsWithEzaPrefixedFields = 0;
    let productiveComparableRecordsWithSezaPrefixedFields = 0;
    for (const productive of productiveRecords) {
        const record = sidecarIndex.get(productive.cardId);
        if (!record) {
            productiveCardIdsOutsideSidecar++;
            continue;
        }
        comparableCardIds++;
        if (productive.recordKind === "top_level")
            productiveTopLevelComparableRecords++;
        else
            productiveTransformationComparableRecords++;
        const keys = Object.keys(productive.value);
        if (keys.some(key => key.startsWith("eza")))
            productiveComparableRecordsWithEzaPrefixedFields++;
        if (keys.some(key => key.startsWith("seza")))
            productiveComparableRecordsWithSezaPrefixedFields++;
        compareClass(record, productive, characterClass);
        compareCollection("categories", record, productive, categories);
        compareCollection("links", record, productive, links);
    }
    return {
        inventory: {
            sidecarRecords: sidecar.records.length,
            productiveTopLevelRecords: characters.length,
            productiveRecordsIncludingTransformations: productiveRecords.length,
            comparableCardIds,
            sidecarCardIdsWithoutProductiveRecord: sidecar.records.length - comparableCardIds,
            productiveCardIdsOutsideSidecar,
        },
        dimensions: { characterClass, categories, links },
        nonExclusiveDiagnostics: {
            label: "non_exclusive",
            productiveTopLevelComparableRecords,
            productiveTransformationComparableRecords,
            productiveComparableRecordsWithEzaPrefixedFields,
            productiveComparableRecordsWithSezaPrefixedFields,
            releaseStateBindingUnavailable: comparableCardIds,
            confirmedConflictCount: 0,
            zeroConfirmedConflictEstablishesCompleteness: false,
        },
    };
}
exports.evaluateCharacterStructuralRepresentation = evaluateCharacterStructuralRepresentation;
//# sourceMappingURL=structural-shadow-evaluator.js.map