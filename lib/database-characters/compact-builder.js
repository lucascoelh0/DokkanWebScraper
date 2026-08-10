"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCharacterCompactProjection = exports.CharacterCompactProjectionBuilder = void 0;
const character_1 = require("../character");
const compact_contract_1 = require("./compact-contract");
const compactFields = new Set(["id", "rarity", "type"]);
const rarities = new Set(Object.values(character_1.Rarities));
const types = new Set(Object.values(character_1.Types));
const numeric = (left, right) => Number(left) - Number(right) || left.localeCompare(right);
class CharacterCompactProjectionBuilder {
    source;
    generatedAt;
    datasetVersion;
    cards = new Map();
    constructor(source, generatedAt, datasetVersion) {
        this.source = source;
        this.generatedAt = generatedAt;
        this.datasetVersion = datasetVersion;
    }
    accept(item) {
        if (!item || !compactFields.has(item.field))
            return;
        const field = item.field;
        const card = this.cards.get(item.cardId) ?? { ambiguousBinding: false, fields: {} };
        if (card.fields[field])
            throw new Error(`duplicate K11 compact source field ${item.cardId}:${field}`);
        if (!item.stateId)
            card.ambiguousBinding = true;
        else if (card.binding !== undefined && card.binding !== item.stateId)
            card.ambiguousBinding = true;
        else
            card.binding = item.stateId;
        card.fields[field] = {
            databaseValue: item.databaseValue,
            comparison: item.comparison === "agreement" ? "agreement" : "representation_gain",
            exclusion: classifyFieldExclusion(item),
        };
        this.cards.set(item.cardId, card);
    }
    finish(enforcePinnedSnapshot = false) {
        const records = [];
        const exclusions = {
            unjoinable: 0, partial: 0, unknown: 0, mismatch: 0, conflict: 0,
            invalidEnum: 0, ambiguousBinding: 0, incomplete: 0,
        };
        const comparisons = {
            id: { agreements: 0, representationGains: 0 },
            rarity: { agreements: 0, representationGains: 0 },
            type: { agreements: 0, representationGains: 0 },
        };
        for (const [cardId, card] of [...this.cards].sort(([left], [right]) => numeric(left, right))) {
            const exclusion = classifyExclusion(card);
            if (exclusion) {
                exclusions[exclusion]++;
                continue;
            }
            const id = card.fields.id;
            const rarity = card.fields.rarity;
            const type = card.fields.type;
            if (String(id.databaseValue) !== cardId)
                throw new Error(`K11 id binding changed for ${cardId}`);
            records.push({ cardId, stateId: card.binding, rarity: rarity.databaseValue, type: type.databaseValue });
            for (const [field, item] of [["id", id], ["rarity", rarity], ["type", type]]) {
                if (item.comparison === "agreement")
                    comparisons[field].agreements++;
                else
                    comparisons[field].representationGains++;
            }
        }
        const coverage = {
            schemaVersion: 1,
            contract: "dokkan-database-character-compact-shadow-coverage",
            contractVersion: compact_contract_1.CHARACTER_COMPACT_CONTRACT_VERSION,
            databaseCardCount: this.cards.size,
            recordCount: records.length,
            excludedCardCount: this.cards.size - records.length,
            exclusions,
            comparisons,
            catalogImpact: { charactersCreated: 0, charactersRemoved: 0, productionModified: false },
        };
        if (enforcePinnedSnapshot)
            assertPinnedCoverage(coverage);
        return {
            projection: {
                schemaVersion: 1,
                contract: "dokkan-database-character-compact-shadow",
                contractVersion: compact_contract_1.CHARACTER_COMPACT_CONTRACT_VERSION,
                generatedAt: this.generatedAt,
                datasetVersion: this.datasetVersion,
                source: this.source,
                policy: {
                    id: compact_contract_1.CHARACTER_COMPACT_POLICY_ID,
                    version: compact_contract_1.CHARACTER_COMPACT_POLICY_VERSION,
                    approvedBy: { contract: "dokkan-database-character-field-shadow-readiness", contractVersion: "1.0.1" },
                    records: "supported_only",
                    fields: ["id", "rarity", "type"],
                    allowedComparisons: ["agreement", "representation_gain"],
                    structuralJoinOnly: true,
                    externalFallbackIncluded: false,
                    auditFieldsIncluded: false,
                    productionModified: false,
                    consumerImplemented: false,
                    publisherEnabled: false,
                    androidEnabled: false,
                },
                records,
            },
            coverage,
        };
    }
}
exports.CharacterCompactProjectionBuilder = CharacterCompactProjectionBuilder;
function classifyExclusion(card) {
    if (card.ambiguousBinding || !card.binding)
        return "ambiguousBinding";
    const values = [card.fields.id, card.fields.rarity, card.fields.type];
    if (values.some(item => !item))
        return "incomplete";
    const fields = values;
    for (const exclusion of ["unjoinable", "partial", "unknown", "conflict", "mismatch", "invalidEnum"]) {
        if (fields.some(item => item.exclusion === exclusion))
            return exclusion;
    }
    return null;
}
function classifyFieldExclusion(item) {
    if (item.productionJoin?.status !== "joined" || item.comparison === "unjoinable")
        return "unjoinable";
    if (item.evidenceStatus === "partial")
        return "partial";
    if (item.evidenceStatus !== "supported" || item.comparison === "unknown")
        return "unknown";
    if (item.comparison === "confirmed_conflict" || item.sourceComparisons?.production === "confirmed_conflict")
        return "conflict";
    if (!["agreement", "representation_gain"].includes(item.comparison))
        return "mismatch";
    if (item.authority !== "database_candidate" || item.characterField !== item.field)
        return "mismatch";
    if (item.field === "rarity" && !rarities.has(String(item.databaseValue)))
        return "invalidEnum";
    if (item.field === "type" && !types.has(String(item.databaseValue)))
        return "invalidEnum";
    return null;
}
function assertPinnedCoverage(coverage) {
    const expected = compact_contract_1.CHARACTER_COMPACT_EXPECTATIONS;
    const failures = [];
    if (coverage.databaseCardCount !== expected.databaseCardCount)
        failures.push(`database cards ${coverage.databaseCardCount} != ${expected.databaseCardCount}`);
    if (coverage.recordCount !== expected.recordCount)
        failures.push(`records ${coverage.recordCount} != ${expected.recordCount}`);
    if (coverage.exclusions.unjoinable !== expected.productionUnjoinableCount)
        failures.push(`unjoinables ${coverage.exclusions.unjoinable} != ${expected.productionUnjoinableCount}`);
    if (Object.entries(coverage.exclusions).some(([key, value]) => key !== "unjoinable" && value !== 0))
        failures.push(`unexpected exclusions ${JSON.stringify(coverage.exclusions)}`);
    if (coverage.comparisons.id.agreements !== expected.idAgreements || coverage.comparisons.id.representationGains !== 0)
        failures.push(`id comparison inventory ${JSON.stringify(coverage.comparisons.id)}`);
    if (coverage.comparisons.rarity.agreements !== expected.rarityAgreements || coverage.comparisons.rarity.representationGains !== expected.rarityRepresentationGains)
        failures.push(`rarity comparison inventory ${JSON.stringify(coverage.comparisons.rarity)}`);
    if (coverage.comparisons.type.agreements !== expected.typeAgreements || coverage.comparisons.type.representationGains !== 0)
        failures.push(`type comparison inventory ${JSON.stringify(coverage.comparisons.type)}`);
    if (failures.length)
        throw new Error(`K15 pinned snapshot expectations changed: ${failures.join("; ")}`);
}
function buildCharacterCompactProjection(projection, source, generatedAt, datasetVersion, enforcePinnedSnapshot = false) {
    const builder = new CharacterCompactProjectionBuilder(source, generatedAt, datasetVersion);
    projection.fields.forEach(item => builder.accept(item));
    return builder.finish(enforcePinnedSnapshot);
}
exports.buildCharacterCompactProjection = buildCharacterCompactProjection;
//# sourceMappingURL=compact-builder.js.map