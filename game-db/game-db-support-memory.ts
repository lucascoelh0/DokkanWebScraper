import { createHash } from "crypto";
import { SupportMemoryDetailsDataset, SupportMemoryDetailsEntry, SupportMemoryAcquisitionSummary, SupportMemoryAcquisitionSourceEntry } from "../support-memory-details";
import { SupportMemory, SupportMemoryEffect, SupportMemoryEnhancementStep, SupportMemoryFilm } from "../support-memory";
import { GameDbRow, normalizeDbId, parseDbDate } from "./game-db-source";

export const SUPPORT_MEMORY_FIRST_PARTY_CONTRACT = "dokkan-support-memory-first-party-candidate";
export const SUPPORT_MEMORY_FIRST_PARTY_CONTRACT_VERSION = "1.0.0";

export interface SupportMemoryFirstPartyTables {
    cards: GameDbRow[],
    card_card_categories: GameDbRow[],
    card_categories: GameDbRow[],
    card_unique_info_set_relations: GameDbRow[],
    mission_categories: GameDbRow[],
    mission_rewards: GameDbRow[],
    missions: GameDbRow[],
    sub_target_type_sets: GameDbRow[],
    sub_target_types: GameDbRow[],
    support_films: GameDbRow[],
    support_memories: GameDbRow[],
    support_memory_enhancement_items: GameDbRow[],
    support_memory_enhancement_levels: GameDbRow[],
    support_memory_enhancement_require_items: GameDbRow[],
    support_memory_skills: GameDbRow[],
}

export interface SupportMemoryTargetFilterAudit {
    rowId: string,
    valueType: 1 | 2 | 4 | 5,
    selector: "card-category" | "card-unique-info-set",
    inclusion: "include" | "exclude",
    selectorId: string,
}

export interface SupportMemoryTargetRuleAudit {
    skillId: string,
    supportMemoryId: string,
    targetType: number,
    targetSetId: string,
    filters: SupportMemoryTargetFilterAudit[],
    applicableCardCount: number,
}

export interface SupportMemoryEntryProvenanceAudit {
    memoryId: string,
    variantMemoryIds: string[],
    skillRowIds: string[],
    enhancementLevelRowIds: string[],
    enhancementRequirementRowIds: string[],
    categoryIds: string[],
    targetRules: SupportMemoryTargetRuleAudit[],
    missionRewardRowIds: string[],
    legacyPresentationFields: string[],
}

export interface SupportMemoryFirstPartyAudit {
    schemaVersion: 1,
    contract: typeof SUPPORT_MEMORY_FIRST_PARTY_CONTRACT,
    contractVersion: typeof SUPPORT_MEMORY_FIRST_PARTY_CONTRACT_VERSION,
    generatedAt: string,
    source: {
        kind: "first-party-game-database-export",
        snapshotVersion: string,
        databaseSha256: string,
        consumerCharacterCount: number,
        tableNames: string[],
    },
    counts: {
        memoryRows: number,
        rootMemories: number,
        enhancedMemoryRows: number,
        skillRows: number,
        structuralTargetRows: number,
        missionRewardRows: number,
        officialUnlockMemoryCount: number,
        legacyUnlockFallbackCount: number,
        legacyDokkanInfoCount: number,
    },
    compatibility: {
        previousCount: number,
        candidateCount: number,
        addedIds: string[],
        removedIds: string[],
        coreChangedIds: string[],
        categoryChangedIds: string[],
    },
    fieldAuthority: Record<string, "first-party" | "first-party-with-legacy-presentation" | "legacy-presentation-only">,
    entries: SupportMemoryEntryProvenanceAudit[],
}

export interface SupportMemoryFirstPartyCandidate {
    dataset: SupportMemoryDetailsDataset,
    audit: SupportMemoryFirstPartyAudit,
}

interface MissionJoin {
    rewardId: string,
    missionId: string,
    categoryId: string,
    itemType: string,
    itemId: string,
    quantity: number,
    title: string,
    description?: string,
    startsAt?: string,
    endsAt?: string,
}

const numericCompare = (left: string, right: string) => Number(left) - Number(right) || left.localeCompare(right);
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const text = (value?: string): string => (value ?? "").replace(/[ \t]+\r?\n/g, "\n").trim();

function id(row: GameDbRow, column = "id"): string {
    const value = normalizeDbId(row[column]);
    if (!value) throw new Error(`Support Memory first-party row is missing ${column}`);
    return value;
}

function integer(row: GameDbRow, column: string, optional = false): number | undefined {
    const raw = row[column]?.trim();
    const value = raw && Number.isSafeInteger(Number(raw)) ? Number(raw) : undefined;
    if (value === undefined && !optional) throw new Error(`Support Memory first-party row ${id(row)} is missing integer ${column}`);
    return value;
}

function uniqueById(rows: GameDbRow[], label: string): Map<string, GameDbRow> {
    const result = new Map<string, GameDbRow>();
    for (const row of rows) {
        const rowId = id(row);
        if (result.has(rowId)) throw new Error(`Duplicate ${label} row ID ${rowId}`);
        result.set(rowId, row);
    }
    return result;
}

function groupBy(rows: GameDbRow[], column: string): Map<string, GameDbRow[]> {
    const result = new Map<string, GameDbRow[]>();
    for (const row of rows) {
        const key = id(row, column);
        result.set(key, [...(result.get(key) ?? []), row]);
    }
    return result;
}

function strictNumberArray(row: GameDbRow, column: string): number[] {
    const raw = row[column]?.trim();
    let values: unknown;
    try {
        values = raw ? JSON.parse(raw) : undefined;
    } catch {
        values = undefined;
    }
    if (!Array.isArray(values) || values.some(value => typeof value !== "number" || !Number.isFinite(value))) {
        throw new Error(`Invalid ${column} JSON for Support Memory skill ${id(row)}`);
    }
    return values as number[];
}

function date(row: GameDbRow, column: string): string | undefined {
    const raw = row[column]?.trim();
    const parsed = parseDbDate(raw);
    if (raw && !parsed) throw new Error(`Invalid ${column} for Support Memory row ${id(row)}`);
    return parsed;
}

function effect(row: GameDbRow): SupportMemoryEffect {
    return {
        id: id(row),
        effectType: integer(row, "efficacy_type"),
        values: strictNumberArray(row, "efficacy_values"),
        target: integer(row, "target_type"),
        calculation: integer(row, "calc_option"),
        turns: integer(row, "turn"),
        chance: integer(row, "probability"),
        transformationDescription: "",
        scriptName: "",
    };
}

function parseTargetFilters(rows: GameDbRow[]): SupportMemoryTargetFilterAudit[] {
    return rows.map(row => {
        const valueType = integer(row, "target_value_type");
        if (valueType !== 1 && valueType !== 2 && valueType !== 4 && valueType !== 5) {
            throw new Error(`Unsupported Support Memory sub-target value type ${valueType} in row ${id(row)}`);
        }
        return {
            rowId: id(row),
            valueType: valueType as 1 | 2 | 4 | 5,
            selector: valueType <= 2 ? "card-category" as const : "card-unique-info-set" as const,
            inclusion: valueType === 1 || valueType === 4 ? "include" as const : "exclude" as const,
            selectorId: id(row, "target_value"),
        };
    }).sort((left, right) => numericCompare(left.rowId, right.rowId));
}

function applyFilters(
    filters: SupportMemoryTargetFilterAudit[],
    allCardIds: Set<string>,
    categoryCards: Map<string, Set<string>>,
    uniqueInfoSetCards: Map<string, Set<string>>,
): Set<string> {
    let candidates = new Set(allCardIds);
    for (const filter of filters) {
        const members = filter.selector === "card-category"
            ? categoryCards.get(filter.selectorId)
            : uniqueInfoSetCards.get(filter.selectorId);
        if (!members) throw new Error(`Unresolved Support Memory ${filter.selector} ${filter.selectorId}`);
        candidates = new Set([...candidates].filter(cardId => filter.inclusion === "include" ? members.has(cardId) : !members.has(cardId)));
    }
    return candidates;
}

function enhancementChain(
    rootId: string,
    levelsByRoot: Map<string, GameDbRow[]>,
    memoryRows: Map<string, GameDbRow>,
): SupportMemoryEnhancementStep[] {
    const rows = [...(levelsByRoot.get(rootId) ?? [])].sort((left, right) => integer(left, "level")! - integer(right, "level")!);
    let expectedSource = rootId;
    let expectedLevel = 2;
    const steps = rows.map(row => {
        const level = integer(row, "level")!;
        const supportMemoryId = id(row, "support_memory_id");
        const enhancedSupportMemoryId = id(row, "enhanced_support_memory_id");
        if (id(row, "root_support_memory_id") !== rootId || supportMemoryId !== expectedSource || level !== expectedLevel) {
            throw new Error(`Broken Support Memory enhancement chain for ${rootId} at row ${id(row)}`);
        }
        if (!memoryRows.has(supportMemoryId) || !memoryRows.has(enhancedSupportMemoryId)) {
            throw new Error(`Support Memory enhancement row ${id(row)} references a missing memory`);
        }
        expectedSource = enhancedSupportMemoryId;
        expectedLevel += 1;
        return { id: id(row), level, supportMemoryId, enhancedSupportMemoryId, rootSupportMemoryId: rootId };
    });
    return steps;
}

function buildMissionJoins(tables: SupportMemoryFirstPartyTables): MissionJoin[] {
    const missions = uniqueById(tables.missions, "mission");
    const categories = uniqueById(tables.mission_categories, "mission category");
    return tables.mission_rewards
        .filter(row => row.item_type === "SupportMemory" || row.item_type === "SupportFilm")
        .map(row => {
            const missionId = id(row, "mission_id");
            const mission = missions.get(missionId);
            if (!mission) throw new Error(`Mission reward ${id(row)} references missing mission ${missionId}`);
            const categoryId = id(mission, "mission_category_id");
            if (!categories.has(categoryId)) throw new Error(`Mission ${missionId} references missing category ${categoryId}`);
            return {
                rewardId: id(row),
                missionId,
                categoryId,
                itemType: row.item_type,
                itemId: id(row, "item_id"),
                quantity: integer(row, "quantity")!,
                title: text(mission.name) || `Mission ${missionId}`,
                description: text(mission.description) || undefined,
                startsAt: date(mission, "start_at"),
                endsAt: date(mission, "end_at"),
            };
        });
}

function officialMissionSource(join: MissionJoin, legacy?: SupportMemoryAcquisitionSourceEntry): SupportMemoryAcquisitionSourceEntry {
    return {
        ...(legacy ? clone(legacy) : {}),
        sourceKey: `event-mission:${join.categoryId}:${join.missionId}:${join.rewardId}:${join.itemId}`,
        sourceKind: "event-mission",
        groupKey: `event-mission-category:${join.categoryId}`,
        groupKind: "event-mission-category",
        title: join.title,
        ...(join.description ? { description: join.description } : {}),
        quantity: join.quantity,
        ...(join.startsAt ? { startsAt: join.startsAt } : {}),
        ...(join.endsAt ? { endsAt: join.endsAt } : {}),
    };
}

function mergeMissionAcquisition(
    legacy: SupportMemoryAcquisitionSummary | undefined,
    itemType: "SupportMemory" | "SupportFilm",
    itemId: string,
    requiredQuantity: number,
    joins: MissionJoin[],
): SupportMemoryAcquisitionSummary | undefined {
    const official = joins.filter(join => join.itemType === itemType && join.itemId === itemId);
    if (official.length === 0) return legacy ? clone(legacy) : undefined;
    const legacyByRewardId = new Map<string, SupportMemoryAcquisitionSourceEntry>();
    for (const source of legacy?.sources ?? []) {
        const parts = source.sourceKey.split(":");
        if (parts[0] === "event-mission" && parts.length >= 5) legacyByRewardId.set(parts[3], source);
    }
    const officialRewardIds = new Set(official.map(join => join.rewardId));
    const sources = [
        ...official.map(join => officialMissionSource(join, legacyByRewardId.get(join.rewardId))),
        ...(legacy?.sources ?? []).filter(source => {
            const parts = source.sourceKey.split(":");
            return parts[0] !== "event-mission" || !officialRewardIds.has(parts[3]);
        }).map(clone),
    ].sort((left, right) => left.sourceKey.localeCompare(right.sourceKey, "en", { numeric: true }));
    const previousGroups = new Map((legacy?.groups ?? []).map(group => [group.groupKey, group]));
    const grouped = new Map<string, SupportMemoryAcquisitionSourceEntry[]>();
    for (const source of sources) grouped.set(source.groupKey, [...(grouped.get(source.groupKey) ?? []), source]);
    const groups = [...grouped.entries()].map(([groupKey, groupSources]) => {
        const previous = previousGroups.get(groupKey);
        const quantities = groupSources.map(source => source.quantity).filter((value): value is number => value !== undefined);
        const totalQuantity = quantities.length > 0 ? quantities.reduce((sum, value) => sum + value, 0) : undefined;
        const maxQuantity = quantities.length > 0 ? Math.max(...quantities) : undefined;
        return {
            ...(previous ? clone(previous) : {}),
            groupKey,
            groupKind: groupSources[0].groupKind,
            title: groupSources[0].title,
            sourceCount: groupSources.length,
            ...(totalQuantity !== undefined ? { totalQuantity } : {}),
            ...(maxQuantity !== undefined ? { maxQuantity, satisfiesRequiredQuantity: maxQuantity >= requiredQuantity } : {}),
            sourceKeys: groupSources.map(source => source.sourceKey),
        };
    }).sort((left, right) => left.groupKey.localeCompare(right.groupKey, "en", { numeric: true }));
    return {
        itemKey: `${itemType}:${itemId}`,
        itemType,
        itemId,
        sourceModel: "acquisition-item",
        requiredQuantity: legacy?.requiredQuantity ?? requiredQuantity,
        groupCount: groups.length,
        sourceCount: sources.length,
        groups,
        sources,
    };
}

function stableCore(entry: SupportMemoryDetailsEntry): unknown {
    return {
        id: entry.id, name: entry.name, description: entry.description, filmId: entry.filmId,
        cost: entry.cost, unlockQuantity: entry.unlockQuantity, lastsEntireBattle: entry.lastsEntireBattle,
        releaseDate: entry.releaseDate, maxLevel: entry.maxLevel, enhancementChain: entry.enhancementChain,
        effects: entry.effects,
    };
}

function sha(value: unknown): string {
    return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function buildSupportMemoryFirstPartyCandidate(options: {
    generatedAt: string,
    sourceSnapshotVersion: string,
    sourceDatabaseSha256: string,
    tables: SupportMemoryFirstPartyTables,
    previousDataset?: SupportMemoryDetailsDataset,
    consumerCharacterIds?: ReadonlySet<string>,
}): SupportMemoryFirstPartyCandidate {
    if (!/^\d+$/.test(options.sourceSnapshotVersion)) throw new Error("Support Memory source snapshot version must be numeric");
    if (!/^[a-f0-9]{64}$/.test(options.sourceDatabaseSha256)) throw new Error("Support Memory source database SHA-256 is invalid");
    const memoryRows = uniqueById(options.tables.support_memories, "Support Memory");
    const filmRows = uniqueById(options.tables.support_films, "Support Film");
    const categoryRows = uniqueById(options.tables.card_categories, "card category");
    const cardRows = uniqueById(options.tables.cards, "card");
    const targetSetRows = uniqueById(options.tables.sub_target_type_sets, "sub-target set");
    const enhancementItemRows = uniqueById(options.tables.support_memory_enhancement_items, "Support Memory enhancement item");
    uniqueById(options.tables.support_memory_enhancement_require_items, "Support Memory enhancement requirement");
    const levelRows = uniqueById(options.tables.support_memory_enhancement_levels, "Support Memory enhancement level");
    const skillRows = uniqueById(options.tables.support_memory_skills, "Support Memory skill");
    const targetRows = uniqueById(options.tables.sub_target_types, "sub-target");
    const levelsByRoot = groupBy(options.tables.support_memory_enhancement_levels, "root_support_memory_id");
    const skillsByMemory = groupBy(options.tables.support_memory_skills, "support_memory_id");
    const targetsBySet = groupBy(options.tables.sub_target_types, "sub_target_type_set_id");
    const requirementsByMemory = groupBy(options.tables.support_memory_enhancement_require_items, "support_memory_id");
    const enhancedIds = new Set(options.tables.support_memory_enhancement_levels.map(row => id(row, "enhanced_support_memory_id")));
    const rootRows = [...memoryRows.values()].filter(row => !enhancedIds.has(id(row))).sort((left, right) => numericCompare(id(left), id(right)));
    const rootIds = new Set(rootRows.map(row => id(row)));
    for (const row of options.tables.support_memory_skills) {
        if (!memoryRows.has(id(row, "support_memory_id"))) throw new Error(`Orphan Support Memory skill ${id(row)}`);
        const setId = normalizeDbId(row.sub_target_type_set_id);
        if (setId && setId !== "0" && !targetSetRows.has(setId)) throw new Error(`Support Memory skill ${id(row)} references missing sub-target set ${setId}`);
    }
    for (const row of options.tables.sub_target_types) if (!targetSetRows.has(id(row, "sub_target_type_set_id"))) throw new Error(`Orphan sub-target ${id(row)}`);
    for (const row of options.tables.support_memory_enhancement_levels) {
        const rootId = id(row, "root_support_memory_id");
        if (!rootIds.has(rootId)) throw new Error(`Enhancement level ${id(row)} references a non-root Support Memory ${rootId}`);
    }
    for (const row of options.tables.support_memory_enhancement_require_items) {
        if (!memoryRows.has(id(row, "support_memory_id")) || !enhancementItemRows.has(id(row, "support_memory_enhancement_item_id"))) {
            throw new Error(`Broken Support Memory enhancement requirement ${id(row)}`);
        }
    }

    const categoryCards = new Map<string, Set<string>>();
    for (const relation of options.tables.card_card_categories) {
        const cardId = id(relation, "card_id"), categoryId = id(relation, "card_category_id");
        if (!categoryRows.has(categoryId)) throw new Error(`Broken card category relation ${id(relation)}`);
        // The first-party DB retains taxonomy rows for cards outside the current
        // card catalog. They are irrelevant to the delivered character universe.
        if (!cardRows.has(cardId)) continue;
        categoryCards.set(categoryId, new Set([...(categoryCards.get(categoryId) ?? []), cardId]));
    }
    const cardsByUniqueInfo = new Map<string, Set<string>>();
    for (const card of cardRows.values()) {
        const uniqueInfoId = id(card, "card_unique_info_id");
        cardsByUniqueInfo.set(uniqueInfoId, new Set([...(cardsByUniqueInfo.get(uniqueInfoId) ?? []), id(card)]));
    }
    const uniqueInfoSetCards = new Map<string, Set<string>>();
    for (const relation of options.tables.card_unique_info_set_relations) {
        const setId = id(relation, "card_unique_info_set_id"), uniqueInfoId = id(relation, "card_unique_info_id");
        const cards = cardsByUniqueInfo.get(uniqueInfoId);
        if (!cards) continue;
        uniqueInfoSetCards.set(setId, new Set([...(uniqueInfoSetCards.get(setId) ?? []), ...cards]));
    }
    const allCardIds = new Set([...cardRows.keys()].filter(cardId => !options.consumerCharacterIds || options.consumerCharacterIds.has(cardId)));
    const films: SupportMemoryFilm[] = [...filmRows.values()].map(row => ({
        id: id(row), name: text(row.name) || `Film ${id(row)}`, description: text(row.description) || undefined,
    })).sort((left, right) => numericCompare(left.id, right.id));
    const filmsById = new Map(films.map(film => [film.id, film]));
    const missionJoins = buildMissionJoins(options.tables);
    const previousEntries = options.previousDataset?.entries ?? [];
    if (options.previousDataset && options.previousDataset.count !== previousEntries.length) throw new Error("Previous Support Memory dataset count mismatch");
    const previousById = new Map(previousEntries.map(entry => [entry.id, entry]));
    if (previousById.size !== previousEntries.length) throw new Error("Previous Support Memory dataset contains duplicate IDs");
    const provenanceEntries: SupportMemoryEntryProvenanceAudit[] = [];

    const entries = rootRows.map(rootRow => {
        const rootId = id(rootRow);
        const chain = enhancementChain(rootId, levelsByRoot, memoryRows);
        const variantIds = [rootId, ...chain.map(step => step.enhancedSupportMemoryId)];
        const variantSkills = variantIds.flatMap(memoryId => skillsByMemory.get(memoryId) ?? []);
        const rootSkills = [...(skillsByMemory.get(rootId) ?? [])].sort((left, right) => numericCompare(id(left), id(right)));
        const categoryIds = new Set<string>();
        const applicableCardIds = new Set<string>();
        const targetRules: SupportMemoryTargetRuleAudit[] = [];
        for (const skill of variantSkills) {
            const setId = normalizeDbId(skill.sub_target_type_set_id);
            if (!setId || setId === "0") continue;
            const rows = targetsBySet.get(setId);
            if (!rows || rows.length === 0) throw new Error(`Support Memory skill ${id(skill)} references missing sub-target set ${setId}`);
            const filters = parseTargetFilters(rows);
            for (const filter of filters) if (filter.selector === "card-category" && filter.inclusion === "include") categoryIds.add(filter.selectorId);
            const applicable = applyFilters(filters, allCardIds, categoryCards, uniqueInfoSetCards);
            for (const cardId of applicable) applicableCardIds.add(cardId);
            targetRules.push({
                skillId: id(skill), supportMemoryId: id(skill, "support_memory_id"),
                targetType: integer(skill, "target_type")!, targetSetId: setId,
                filters, applicableCardCount: applicable.size,
            });
        }
        const sortedCategoryIds = [...categoryIds].sort(numericCompare);
        const categoryNames = sortedCategoryIds.map(categoryId => {
            const row = categoryRows.get(categoryId);
            if (!row) throw new Error(`Support Memory ${rootId} references missing category ${categoryId}`);
            return text(row.name) || `Category ${categoryId}`;
        });
        const filmId = normalizeDbId(rootRow.support_film_id);
        const film = filmId ? filmsById.get(filmId) : undefined;
        if (filmId && !film) throw new Error(`Support Memory ${rootId} references missing film ${filmId}`);
        const previous = previousById.get(rootId);
        const officialUnlock = mergeMissionAcquisition(previous?.unlockAcquisition, "SupportMemory", rootId, 1, missionJoins);
        const officialFilm = filmId ? mergeMissionAcquisition(previous?.filmAcquisition, "SupportFilm", filmId, integer(rootRow, "unlock_quantity")!, missionJoins) : undefined;
        const requirementRows = variantIds.flatMap(memoryId => requirementsByMemory.get(memoryId) ?? []);
        const officialRequirements = new Map(requirementRows.map(row => [id(row, "support_memory_enhancement_item_id"), integer(row, "quantity")!]));
        const dokkanInfo = previous?.dokkanInfo ? clone(previous.dokkanInfo) : undefined;
        if (dokkanInfo) {
            dokkanInfo.levelDescriptions = variantIds.map((memoryId, index) => ({
                level: index + 1,
                description: text(memoryRows.get(memoryId)!.description),
            }));
            dokkanInfo.enhancementItems = dokkanInfo.enhancementItems.map(item => officialRequirements.has(item.id)
                ? { ...item, quantity: officialRequirements.get(item.id) }
                : item);
        }
        const memory: SupportMemory = {
            id: rootId,
            name: text(rootRow.name) || `Support Memory ${rootId}`,
            description: text(rootRow.description),
            ...(filmId ? { filmId } : {}),
            ...(film ? { film } : {}),
            cost: integer(rootRow, "cost"),
            unlockQuantity: integer(rootRow, "unlock_quantity"),
            lastsEntireBattle: variantSkills.some(skill => {
                const turns = integer(skill, "turn")!;
                return turns === -1 || turns >= 3000;
            }),
            releaseDate: date(rootRow, "open_at"),
            maxLevel: chain.length + 1,
            enhancementChain: chain,
            effects: rootSkills.map(effect),
        };
        const entry: SupportMemoryDetailsEntry = {
            ...memory,
            filmName: film?.name,
            categoryIds: sortedCategoryIds,
            categoryNames,
            categoryTargetSource: "game-db-structural",
            applicableCharacterIds: [...applicableCardIds].sort(numericCompare),
            applicableCharacterSource: "game-db-structural",
            unlockMethod: officialUnlock ? "direct-item" : previous?.unlockMethod ?? (filmId ? "film-only" : "unknown"),
            ...(officialUnlock ? { unlockAcquisition: officialUnlock } : {}),
            ...(officialFilm ? { filmAcquisition: officialFilm } : {}),
            ...(dokkanInfo ? { dokkanInfo } : {}),
        };
        provenanceEntries.push({
            memoryId: rootId,
            variantMemoryIds: variantIds,
            skillRowIds: variantSkills.map(row => id(row)).sort(numericCompare),
            enhancementLevelRowIds: chain.map(step => step.id!).sort(numericCompare),
            enhancementRequirementRowIds: requirementRows.map(row => id(row)).sort(numericCompare),
            categoryIds: sortedCategoryIds,
            targetRules: targetRules.sort((left, right) => numericCompare(left.skillId, right.skillId)),
            missionRewardRowIds: missionJoins.filter(join => (join.itemType === "SupportMemory" && join.itemId === rootId) || (join.itemType === "SupportFilm" && join.itemId === filmId)).map(join => join.rewardId).sort(numericCompare),
            legacyPresentationFields: [
                ...(previous?.dokkanInfo ? ["dokkanInfo.assets"] : []),
                ...(previous?.unlockAcquisition ? ["unlockAcquisition.navigation"] : []),
                ...(previous?.filmAcquisition ? ["filmAcquisition.navigation"] : []),
            ],
        });
        return entry;
    });
    const dataset: SupportMemoryDetailsDataset = { generatedAt: options.generatedAt, source: "dokkan-game-db", count: entries.length, entries };
    const candidateIds = new Set(entries.map(entry => entry.id)), previousIds = new Set(previousEntries.map(entry => entry.id));
    const common = entries.filter(entry => previousIds.has(entry.id));
    const audit: SupportMemoryFirstPartyAudit = {
        schemaVersion: 1,
        contract: SUPPORT_MEMORY_FIRST_PARTY_CONTRACT,
        contractVersion: SUPPORT_MEMORY_FIRST_PARTY_CONTRACT_VERSION,
        generatedAt: options.generatedAt,
        source: {
            kind: "first-party-game-database-export",
            snapshotVersion: options.sourceSnapshotVersion,
            databaseSha256: options.sourceDatabaseSha256,
            consumerCharacterCount: allCardIds.size,
            tableNames: Object.keys(options.tables).sort(),
        },
        counts: {
            memoryRows: memoryRows.size,
            rootMemories: entries.length,
            enhancedMemoryRows: enhancedIds.size,
            skillRows: skillRows.size,
            structuralTargetRows: targetRows.size,
            missionRewardRows: missionJoins.length,
            officialUnlockMemoryCount: entries.filter(entry => missionJoins.some(join => join.itemType === "SupportMemory" && join.itemId === entry.id)).length,
            legacyUnlockFallbackCount: entries.filter(entry => !missionJoins.some(join => join.itemType === "SupportMemory" && join.itemId === entry.id) && previousById.get(entry.id)?.unlockAcquisition).length,
            legacyDokkanInfoCount: entries.filter(entry => entry.dokkanInfo).length,
        },
        compatibility: {
            previousCount: previousEntries.length,
            candidateCount: entries.length,
            addedIds: entries.filter(entry => !previousIds.has(entry.id)).map(entry => entry.id),
            removedIds: previousEntries.filter(entry => !candidateIds.has(entry.id)).map(entry => entry.id),
            coreChangedIds: common.filter(entry => sha(stableCore(entry)) !== sha(stableCore(previousById.get(entry.id)!))).map(entry => entry.id),
            categoryChangedIds: common.filter(entry => JSON.stringify([...entry.categoryIds].sort(numericCompare)) !== JSON.stringify([...previousById.get(entry.id)!.categoryIds].sort(numericCompare))).map(entry => entry.id),
        },
        fieldAuthority: {
            "id,name,description,film,cost,unlockQuantity,releaseDate": "first-party",
            "enhancementChain,effects,duration": "first-party",
            "categoryIds,categoryNames,applicableCharacterIds": "first-party",
            "unlockAcquisition,filmAcquisition": "first-party-with-legacy-presentation",
            "dokkanInfo.levelDescriptions": "first-party",
            "dokkanInfo.assets": "legacy-presentation-only",
            "dokkanInfo.enhancementItems.quantity": "first-party-with-legacy-presentation",
        },
        entries: provenanceEntries,
    };
    return { dataset, audit };
}
