import { DatabaseCardRecord, SourcedRow } from "../database-experiment/contract";
import { SqliteRow } from "../database-experiment/sqlite-readonly-adapter";
import { CharacterCardTaxonomy, CharacterLinkDictionaryEntry, CharacterTaxonomyDictionaryEntry, DatabaseCharacterTaxonomyCoverage, DatabaseCharacterTaxonomyDataset, PresentationLabel } from "./taxonomy-contract";
import { CharacterSourceInput, streamDb1Cards } from "./source";

function text(value: unknown): string { return value === null || value === undefined ? "" : String(value).trim(); }
function label(row: SourcedRow, column: string): PresentationLabel { return { value: text(row.values[column]), sourceLocale: "global_snapshot_default", source: { table: row.provenance.table, rowId: row.provenance.rowId, column } }; }
function rowId(row: SqliteRow): string { return String(row.id); }

export async function buildDatabaseCharacterTaxonomyDataset(options: {
    source: CharacterSourceInput;
    linkLevels: SqliteRow[];
    linkEfficacies: SqliteRow[];
    cardsInput?: AsyncIterable<DatabaseCardRecord>;
}): Promise<DatabaseCharacterTaxonomyDataset> {
    const sourceCards: DatabaseCardRecord[] = [];
    for await (const card of options.cardsInput ?? streamDb1Cards(options.source.artifactPath)) sourceCards.push(card);
    const cardById = new Map(sourceCards.map(card => [card.cardId, card]));
    const zSources = new Map<string, Array<{ cardId: string; routeRowId: string }>>();
    for (const card of sourceCards) for (const route of card.awakeningPaths.outgoing) if (route.values.type === "CardAwakeningRoute::Zet") {
        const target = String(route.values.awaked_card_id);
        zSources.set(target, [...(zSources.get(target) ?? []), { cardId: card.cardId, routeRowId: route.provenance.rowId }]);
    }
    const roots = (cardId: string, visited = new Set<string>()): { cardIds: string[]; routeRowIds: string[]; cycle: boolean } => {
        if (visited.has(cardId)) return { cardIds: [], routeRowIds: [], cycle: true };
        visited.add(cardId);
        const sources = zSources.get(cardId) ?? [];
        if (sources.length === 0) return { cardIds: [cardId], routeRowIds: [], cycle: false };
        const nested = sources.map(source => ({ source, result: roots(source.cardId, new Set(visited)) }));
        return { cardIds: [...new Set(nested.flatMap(item => item.result.cardIds))], routeRowIds: [...new Set(nested.flatMap(item => [item.source.routeRowId, ...item.result.routeRowIds]))], cycle: nested.some(item => item.result.cycle) };
    };
    const categoryRows = new Map<string, SourcedRow>();
    const linkRows = new Map<string, SourcedRow>();
    for (const card of sourceCards) {
        card.categories.forEach(item => { if (item.category) categoryRows.set(item.category.provenance.rowId, item.category); });
        card.links.forEach(item => { if (item.skill) linkRows.set(item.skill.provenance.rowId, item.skill); });
    }
    const levelsByLink = new Map<string, SqliteRow[]>();
    for (const row of options.linkLevels) levelsByLink.set(String(row.link_skill_id), [...(levelsByLink.get(String(row.link_skill_id)) ?? []), row]);
    const effectsByLevel = new Map<string, SqliteRow[]>();
    for (const row of options.linkEfficacies) effectsByLevel.set(String(row.link_skill_lv_id), [...(effectsByLevel.get(String(row.link_skill_lv_id)) ?? []), row]);
    const categories: CharacterTaxonomyDictionaryEntry[] = [...categoryRows].map(([id, row]) => ({ id, label: label(row, "name") })).sort((a, b) => Number(a.id) - Number(b.id));
    const links: CharacterLinkDictionaryEntry[] = [...linkRows].map(([id, row]) => ({
        id, label: label(row, "name"),
        levels: (levelsByLink.get(id) ?? []).sort((a, b) => Number(a.skill_lv) - Number(b.skill_lv)).map(levelRow => ({
            linkSkillLevelId: rowId(levelRow), level: Number(levelRow.skill_lv),
            description: { value: text(levelRow.description), sourceLocale: "global_snapshot_default" as const, source: { table: "link_skill_lvs", rowId: rowId(levelRow), column: "description" } },
            effects: (effectsByLevel.get(rowId(levelRow)) ?? []).sort((a, b) => Number(a.id) - Number(b.id)).map(effect => ({ rowId: rowId(effect), raw: effect, status: "supported_structural_raw_semantics_uninterpreted" as const })),
        })),
    })).sort((a, b) => Number(a.id) - Number(b.id));
    const joinedLevelIds = new Set(links.flatMap(item => item.levels.map(level => level.linkSkillLevelId)));
    const joinedEffectIds = new Set(links.flatMap(item => item.levels.flatMap(level => level.effects.map(effect => effect.rowId))));
    const cards: CharacterCardTaxonomy[] = sourceCards.map(card => {
        const rootEvidence = roots(card.cardId);
        const rootIds = rootEvidence.cardIds.sort((a, b) => Number(a) - Number(b));
        const rootCards = rootIds.flatMap(id => cardById.get(id) ?? []);
        return {
            cardId: card.cardId,
            labels: {
                cardTitle: label(card.card, "name"),
                characterName: card.character ? label(card.character, "name") : undefined,
                uniqueInfoName: card.cardUniqueInfo ? label(card.cardUniqueInfo, "name") : undefined,
            },
            rarity: { raw: card.rarity.raw, value: card.rarity.value, status: (card.rarity.value === "unknown" ? "unknown" : "supported") as "unknown" | "supported" },
            originalRarity: { status: (rootEvidence.cycle ? "unknown" : rootIds.length === 1 ? "supported" : "partial") as "supported" | "partial" | "unknown", sourceCardIds: rootIds, zRouteRowIds: rootEvidence.routeRowIds.sort((a, b) => Number(a) - Number(b)), cycleDetected: rootEvidence.cycle, rawValues: rootCards.map(item => item.rarity.raw), values: rootCards.map(item => item.rarity.value) },
            type: { raw: card.type.raw, value: card.type.value, status: (card.type.value === "unknown" ? "unknown" : "supported") as "unknown" | "supported" },
            characterClass: { raw: card.characterClass.raw, value: card.characterClass.value, status: (card.characterClass.value === "unknown" ? "unknown" : "supported") as "unknown" | "supported" },
            categoryAssignments: card.categories.map(item => ({ categoryId: String(item.relation.values.card_category_id), relationRowId: item.relation.provenance.rowId, status: (item.category ? "supported" : "unknown") as "supported" | "unknown" })).sort((a, b) => Number(a.relationRowId) - Number(b.relationRowId)),
            links: card.links.map(item => ({ slot: item.slot, linkSkillId: String(card.card.values[`link_skill${item.slot}_id`]), status: (item.skill ? "supported" : "unknown") as "supported" | "unknown", sourceColumn: `link_skill${item.slot}_id` })),
        };
    }).sort((a, b) => Number(a.cardId) - Number(b.cardId));
    return { schemaVersion: 1, contract: "dokkan-database-characters-taxonomy", contractVersion: "1.0.0", generatedAt: options.source.generatedAt,
        source: { snapshotVersion: options.source.snapshotVersion, databaseSha256: options.source.databaseSha256, db1ArtifactSha256: options.source.artifactSha256 },
        localeAudit: { provedLocales: ["global_snapshot_default"], otherLocales: "unknown", presentationTextAsIdentity: false },
        rarityValues: ["N", "R", "SR", "SSR", "UR", "LR"], typeValues: ["AGL", "TEQ", "INT", "STR", "PHY"], classValues: ["unawakened", "Super", "Extreme"],
        categories, links, cards,
        sourceAudit: { linkLevelRowIds: options.linkLevels.map(rowId).sort((a, b) => Number(a) - Number(b)), linkEfficacyRowIds: options.linkEfficacies.map(rowId).sort((a, b) => Number(a) - Number(b)), unjoinedLinkLevelRowIds: options.linkLevels.map(rowId).filter(id => !joinedLevelIds.has(id)).sort((a, b) => Number(a) - Number(b)), unjoinedLinkEfficacyRowIds: options.linkEfficacies.map(rowId).filter(id => !joinedEffectIds.has(id)).sort((a, b) => Number(a) - Number(b)) } };
}

export function buildDatabaseCharacterTaxonomyCoverage(dataset: DatabaseCharacterTaxonomyDataset): DatabaseCharacterTaxonomyCoverage {
    return { schemaVersion: 1, cardCount: dataset.cards.length, categoryCount: dataset.categories.length, linkCount: dataset.links.length,
        linkLevelCount: dataset.links.reduce((sum, item) => sum + item.levels.length, 0), linkEffectRowCount: dataset.links.reduce((sum, item) => sum + item.levels.reduce((inner, level) => inner + level.effects.length, 0), 0),
        categoryAssignmentCount: dataset.cards.reduce((sum, item) => sum + item.categoryAssignments.length, 0), linkAssignmentCount: dataset.cards.reduce((sum, item) => sum + item.links.length, 0),
        unresolvedCategoryAssignmentCount: dataset.cards.reduce((sum, item) => sum + item.categoryAssignments.filter(value => value.status !== "supported").length, 0), unresolvedLinkAssignmentCount: dataset.cards.reduce((sum, item) => sum + item.links.filter(value => value.status !== "supported").length, 0),
        missingCardLabelCount: dataset.cards.filter(item => !item.labels.cardTitle.value).length, missingCategoryLabelCount: dataset.categories.filter(item => !item.label.value).length,
        missingLinkLabelCount: dataset.links.filter(item => !item.label.value).length, multiRootOriginalRarityCount: dataset.cards.filter(item => item.originalRarity.status === "partial").length, originalRarityCycleCount: dataset.cards.filter(item => item.originalRarity.cycleDetected).length,
        duplicateCategoryIdentityCount: dataset.categories.length - new Set(dataset.categories.map(item => item.id)).size, duplicateLinkIdentityCount: dataset.links.length - new Set(dataset.links.map(item => item.id)).size,
        duplicateLinkLevelSourceRowCount: dataset.sourceAudit.linkLevelRowIds.length - new Set(dataset.sourceAudit.linkLevelRowIds).size, duplicateLinkEfficacySourceRowCount: dataset.sourceAudit.linkEfficacyRowIds.length - new Set(dataset.sourceAudit.linkEfficacyRowIds).size,
        unjoinedLinkLevelRowCount: dataset.sourceAudit.unjoinedLinkLevelRowIds.length, unjoinedLinkEfficacyRowCount: dataset.sourceAudit.unjoinedLinkEfficacyRowIds.length };
}
