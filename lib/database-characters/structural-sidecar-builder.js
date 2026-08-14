"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCharacterStructuralSidecar = void 0;
const structural_sidecar_contract_1 = require("./structural-sidecar-contract");
const numeric = (left, right) => Number(left) - Number(right) || left.localeCompare(right);
function duplicates(values) {
    const seen = new Set();
    const duplicate = new Set();
    for (const value of values)
        seen.has(value) ? duplicate.add(value) : seen.add(value);
    return [...duplicate].sort(numeric);
}
function status(values, present) {
    if (!present || values.length === 0)
        return "unknown";
    if (values.every(value => value === "supported"))
        return "supported";
    if (values.every(value => value === "unknown"))
        return "unknown";
    return "partial";
}
function collectionState(values) {
    if (!Array.isArray(values))
        return "absent_unproved";
    return values.length === 0 ? "empty_with_container_provenance_absence_unproved" : "present_with_row_provenance";
}
function labelEvidence(label) {
    if (!label)
        return { status: "unknown", reason: "dictionary_mapping_missing" };
    return {
        status: "supported",
        value: label.value,
        sourceLocale: label.sourceLocale,
        source: label.source,
    };
}
function record(card, productiveCardIds, categoryLabels, linkLabels) {
    const rawCategories = card.categoryAssignments;
    const rawLinks = card.links;
    const categories = Array.isArray(rawCategories) ? rawCategories.map(item => ({
        categoryId: String(item.categoryId),
        relationRowId: String(item.relationRowId),
        status: item.status,
        labelEvidence: labelEvidence(categoryLabels.get(String(item.categoryId))),
    })) : [];
    const links = Array.isArray(rawLinks) ? rawLinks.map(item => ({
        slot: item.slot,
        linkSkillId: String(item.linkSkillId),
        sourceColumn: item.sourceColumn,
        status: item.status,
        labelEvidence: labelEvidence(linkLabels.get(String(item.linkSkillId))),
    })) : [];
    const categoryState = collectionState(rawCategories);
    const linkState = collectionState(rawLinks);
    return {
        cardId: card.cardId,
        productiveCardIdCoverage: productiveCardIds.has(card.cardId) ? "covered" : "not_covered",
        characterClass: { raw: card.characterClass.raw, value: card.characterClass.value, status: card.characterClass.status },
        categories: {
            status: status(categories.map(item => item.status), categoryState !== "absent_unproved"),
            state: categoryState,
            containerProvenance: categoryState === "absent_unproved" ? null : {
                contract: "dokkan-database-characters-taxonomy", cardId: card.cardId, field: "categoryAssignments",
            },
            assignments: categories,
        },
        links: {
            status: status(links.map(item => item.status), linkState !== "absent_unproved"),
            state: linkState,
            containerProvenance: linkState === "absent_unproved" ? null : {
                contract: "dokkan-database-characters-taxonomy", cardId: card.cardId, field: "links",
            },
            entries: links,
        },
    };
}
function statusCounts(records, field) {
    const result = { supported: 0, partial: 0, unknown: 0 };
    for (const item of records)
        result[item[field].status]++;
    return result;
}
function buildCharacterStructuralSidecar(taxonomy, productive, lineage) {
    const duplicateCardIds = duplicates(taxonomy.cards.map(item => item.cardId));
    const duplicateCategoryIds = duplicates(taxonomy.categories.map(item => item.id));
    const duplicateLinkIds = duplicates(taxonomy.links.map(item => item.id));
    if (duplicateCardIds.length)
        throw new Error(`duplicate K2 cardId: ${duplicateCardIds.join(",")}`);
    if (duplicateCategoryIds.length)
        throw new Error(`duplicate K2 category dictionary ID: ${duplicateCategoryIds.join(",")}`);
    if (duplicateLinkIds.length)
        throw new Error(`duplicate K2 link dictionary ID: ${duplicateLinkIds.join(",")}`);
    const categoryLabels = new Map(taxonomy.categories.map(item => [item.id, item.label]));
    const linkLabels = new Map(taxonomy.links.map(item => [item.id, item.label]));
    const records = taxonomy.cards.map(card => record(card, productive.cardIds, categoryLabels, linkLabels));
    const databaseCardIds = new Set(records.map(item => item.cardId));
    const outsideDatabaseCardIds = [...productive.cardIds].filter(cardId => !databaseCardIds.has(cardId)).sort(numeric);
    const covered = records.filter(item => item.productiveCardIdCoverage === "covered").length;
    const sidecar = {
        schemaVersion: 1,
        contract: "dokkan-database-character-structural-identity-sidecar",
        contractVersion: structural_sidecar_contract_1.CHARACTER_STRUCTURAL_SIDECAR_CONTRACT_VERSION,
        generatedAt: lineage.productiveCharacters.datasetVersion,
        datasetVersion: `${lineage.snapshotVersion}-k32-structural-identity-v1`,
        mode: "offline_default_off",
        source: lineage,
        policy: {
            recordKey: "cardId",
            productiveComparison: "card_id_only",
            structuralIdentityFrom: "pinned_k2_taxonomy_only",
            productivePayloadUse: "card_id_coverage_only",
            presentationLabelsAreIdentity: false,
            sourceOrderPreserved: true,
            assignmentsDeduplicated: false,
            assignmentsCanonicalized: false,
            sharedLinksComputed: false,
            activeLinksComputed: false,
            collectionOrderIrrelevanceClaimed: false,
            ezaSezaInvariance: "not_claimed",
            characterPatchesCreated: false,
            consumerImplemented: false,
            publisherImplemented: false,
            androidImplemented: false,
        },
        records,
    };
    const coverage = {
        schemaVersion: 1,
        contract: "dokkan-database-character-structural-identity-coverage",
        contractVersion: structural_sidecar_contract_1.CHARACTER_STRUCTURAL_SIDECAR_CONTRACT_VERSION,
        database: {
            cardCount: records.length,
            categoryAssignmentCount: records.reduce((sum, item) => sum + item.categories.assignments.length, 0),
            linkEntryCount: records.reduce((sum, item) => sum + item.links.entries.length, 0),
            emptyCategoryCollectionCount: records.filter(item => item.categories.state === "empty_with_container_provenance_absence_unproved").length,
            absentCategoryCollectionCount: records.filter(item => item.categories.state === "absent_unproved").length,
            emptyLinkCollectionCount: records.filter(item => item.links.state === "empty_with_container_provenance_absence_unproved").length,
            absentLinkCollectionCount: records.filter(item => item.links.state === "absent_unproved").length,
            missingCategoryLabelMappingCount: records.reduce((sum, item) => sum + item.categories.assignments.filter(value => value.labelEvidence.status === "unknown").length, 0),
            missingLinkLabelMappingCount: records.reduce((sum, item) => sum + item.links.entries.filter(value => value.labelEvidence.status === "unknown").length, 0),
            fieldStatuses: {
                characterClass: statusCounts(records, "characterClass"),
                categories: statusCounts(records, "categories"),
                links: statusCounts(records, "links"),
            },
        },
        productiveCardIdCoverage: {
            comparison: "card_id_only",
            topLevelCharacterCount: productive.topLevelCount,
            uniqueCardIdCount: productive.cardIds.size,
            ambiguousCardIdCount: 0,
            databaseCoveredCardCount: covered,
            databaseUncoveredCardCount: records.length - covered,
            outsideDatabaseCardIds,
        },
    };
    return { sidecar, coverage };
}
exports.buildCharacterStructuralSidecar = buildCharacterStructuralSidecar;
//# sourceMappingURL=structural-sidecar-builder.js.map