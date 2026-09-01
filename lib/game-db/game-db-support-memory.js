"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSupportMemoryFirstPartyCandidate = exports.SUPPORT_MEMORY_FIRST_PARTY_CONTRACT_VERSION = exports.SUPPORT_MEMORY_FIRST_PARTY_CONTRACT = void 0;
const crypto_1 = require("crypto");
const game_db_mission_stage_relations_1 = require("./game-db-mission-stage-relations");
const game_db_source_1 = require("./game-db-source");
exports.SUPPORT_MEMORY_FIRST_PARTY_CONTRACT = "dokkan-support-memory-first-party-candidate";
exports.SUPPORT_MEMORY_FIRST_PARTY_CONTRACT_VERSION = "2.0.0";
const numericCompare = (left, right) => Number(left) - Number(right) || left.localeCompare(right);
const clone = (value) => JSON.parse(JSON.stringify(value));
const text = (value) => (value ?? "").replace(/[ \t]+\r?\n/g, "\n").trim();
function id(row, column = "id") {
    const value = (0, game_db_source_1.normalizeDbId)(row[column]);
    if (!value)
        throw new Error(`Support Memory first-party row is missing ${column}`);
    return value;
}
function integer(row, column, optional = false) {
    const raw = row[column]?.trim();
    const value = raw && Number.isSafeInteger(Number(raw)) ? Number(raw) : undefined;
    if (value === undefined && !optional)
        throw new Error(`Support Memory first-party row ${id(row)} is missing integer ${column}`);
    return value;
}
function uniqueById(rows, label) {
    const result = new Map();
    for (const row of rows) {
        const rowId = id(row);
        if (result.has(rowId))
            throw new Error(`Duplicate ${label} row ID ${rowId}`);
        result.set(rowId, row);
    }
    return result;
}
function groupBy(rows, column) {
    const result = new Map();
    for (const row of rows) {
        const key = id(row, column);
        result.set(key, [...(result.get(key) ?? []), row]);
    }
    return result;
}
function strictNumberArray(row, column) {
    const raw = row[column]?.trim();
    let values;
    try {
        values = raw ? JSON.parse(raw) : undefined;
    }
    catch {
        values = undefined;
    }
    if (!Array.isArray(values) || values.some(value => typeof value !== "number" || !Number.isFinite(value))) {
        throw new Error(`Invalid ${column} JSON for Support Memory skill ${id(row)}`);
    }
    return values;
}
function date(row, column) {
    const raw = row[column]?.trim();
    const parsed = (0, game_db_source_1.parseDbDate)(raw);
    if (raw && !parsed)
        throw new Error(`Invalid ${column} for Support Memory row ${id(row)}`);
    return parsed;
}
function effect(row) {
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
function parseTargetFilters(rows) {
    return rows.map(row => {
        const valueType = integer(row, "target_value_type");
        if (valueType !== 1 && valueType !== 2 && valueType !== 4 && valueType !== 5) {
            throw new Error(`Unsupported Support Memory sub-target value type ${valueType} in row ${id(row)}`);
        }
        return {
            rowId: id(row),
            valueType: valueType,
            selector: valueType <= 2 ? "card-category" : "card-unique-info-set",
            inclusion: valueType === 1 || valueType === 4 ? "include" : "exclude",
            selectorId: id(row, "target_value"),
        };
    }).sort((left, right) => numericCompare(left.rowId, right.rowId));
}
function applyFilters(filters, allCardIds, categoryCards, uniqueInfoSetCards) {
    let candidates = new Set(allCardIds);
    for (const filter of filters) {
        const members = filter.selector === "card-category"
            ? categoryCards.get(filter.selectorId)
            : uniqueInfoSetCards.get(filter.selectorId);
        if (!members)
            throw new Error(`Unresolved Support Memory ${filter.selector} ${filter.selectorId}`);
        candidates = new Set([...candidates].filter(cardId => filter.inclusion === "include" ? members.has(cardId) : !members.has(cardId)));
    }
    return candidates;
}
function enhancementChain(rootId, levelsByRoot, memoryRows) {
    const rows = [...(levelsByRoot.get(rootId) ?? [])].sort((left, right) => integer(left, "level") - integer(right, "level"));
    let expectedSource = rootId;
    let expectedLevel = 2;
    const steps = rows.map(row => {
        const level = integer(row, "level");
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
function buildMissionJoins(tables) {
    const missions = uniqueById(tables.missions, "mission");
    const categories = uniqueById(tables.mission_categories, "mission category");
    const resolveMissionStages = (0, game_db_mission_stage_relations_1.createMissionStageResolver)(tables.missions);
    return tables.mission_rewards
        .filter(row => row.item_type === "SupportMemory" || row.item_type === "SupportFilm")
        .map(row => {
        const missionId = id(row, "mission_id");
        const mission = missions.get(missionId);
        if (!mission)
            throw new Error(`Mission reward ${id(row)} references missing mission ${missionId}`);
        const categoryId = id(mission, "mission_category_id");
        const category = categories.get(categoryId);
        if (!category)
            throw new Error(`Mission ${missionId} references missing category ${categoryId}`);
        const resolution = resolveMissionStages(missionId);
        const officialStageRelations = [
            ...[...resolution.stageIds].map(([targetId, relation]) => ({ targetKind: "quest-level", targetId, relation })),
            ...[...resolution.areaIds].map(([targetId, relation]) => ({ targetKind: "area", targetId, relation })),
            ...[...resolution.zBattleIds].map(([targetId, relation]) => ({ targetKind: "z-battle", targetId, relation })),
        ].sort((left, right) => left.targetKind.localeCompare(right.targetKind) || numericCompare(left.targetId, right.targetId));
        return {
            rewardId: id(row),
            missionId,
            categoryId,
            categoryTitle: text(category.name) || `Mission category ${categoryId}`,
            itemType: row.item_type,
            itemId: id(row, "item_id"),
            quantity: integer(row, "quantity"),
            title: text(mission.name) || `Mission ${missionId}`,
            description: text(mission.description) || undefined,
            startsAt: date(mission, "start_at"),
            endsAt: date(mission, "end_at"),
            officialStageRelations,
        };
    });
}
function officialMissionSource(join) {
    return {
        sourceKey: `event-mission:${join.categoryId}:${join.missionId}:${join.rewardId}:${join.itemId}`,
        sourceKind: "event-mission",
        groupKey: `event-mission-category:${join.categoryId}`,
        groupKind: "event-mission-category",
        title: join.title,
        ...(join.description ? { description: join.description } : {}),
        quantity: join.quantity,
        ...(join.startsAt ? { startsAt: join.startsAt } : {}),
        ...(join.endsAt ? { endsAt: join.endsAt } : {}),
        ...(join.officialStageRelations.length > 0 ? { officialStageRelations: join.officialStageRelations } : {}),
    };
}
function mergeMissionAcquisition(itemType, itemId, requiredQuantity, joins) {
    const official = joins.filter(join => join.itemType === itemType && join.itemId === itemId);
    if (official.length === 0)
        return undefined;
    const sources = official.map(officialMissionSource)
        .sort((left, right) => left.sourceKey.localeCompare(right.sourceKey, "en", { numeric: true }));
    const grouped = new Map();
    for (const source of sources)
        grouped.set(source.groupKey, [...(grouped.get(source.groupKey) ?? []), source]);
    const groups = [...grouped.entries()].map(([groupKey, groupSources]) => {
        const join = official.find(candidate => `event-mission-category:${candidate.categoryId}` === groupKey);
        const quantities = groupSources.map(source => source.quantity).filter((value) => value !== undefined);
        const totalQuantity = quantities.length > 0 ? quantities.reduce((sum, value) => sum + value, 0) : undefined;
        const maxQuantity = quantities.length > 0 ? Math.max(...quantities) : undefined;
        return {
            groupKey,
            groupKind: groupSources[0].groupKind,
            title: join.categoryTitle,
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
        requiredQuantity,
        groupCount: groups.length,
        sourceCount: sources.length,
        groups,
        sources,
    };
}
function stableCore(entry) {
    return {
        id: entry.id, name: entry.name, description: entry.description, filmId: entry.filmId,
        cost: entry.cost, unlockQuantity: entry.unlockQuantity, lastsEntireBattle: entry.lastsEntireBattle,
        releaseDate: entry.releaseDate, maxLevel: entry.maxLevel, enhancementChain: entry.enhancementChain,
        effects: entry.effects,
    };
}
function sha(value) {
    return (0, crypto_1.createHash)("sha256").update(JSON.stringify(value)).digest("hex");
}
function buildSupportMemoryFirstPartyCandidate(options) {
    if (!/^\d+$/.test(options.sourceSnapshotVersion))
        throw new Error("Support Memory source snapshot version must be numeric");
    if (!/^[a-f0-9]{64}$/.test(options.sourceDatabaseSha256))
        throw new Error("Support Memory source database SHA-256 is invalid");
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
        if (!memoryRows.has(id(row, "support_memory_id")))
            throw new Error(`Orphan Support Memory skill ${id(row)}`);
        const setId = (0, game_db_source_1.normalizeDbId)(row.sub_target_type_set_id);
        if (setId && setId !== "0" && !targetSetRows.has(setId))
            throw new Error(`Support Memory skill ${id(row)} references missing sub-target set ${setId}`);
    }
    for (const row of options.tables.sub_target_types)
        if (!targetSetRows.has(id(row, "sub_target_type_set_id")))
            throw new Error(`Orphan sub-target ${id(row)}`);
    for (const row of options.tables.support_memory_enhancement_levels) {
        const rootId = id(row, "root_support_memory_id");
        if (!rootIds.has(rootId))
            throw new Error(`Enhancement level ${id(row)} references a non-root Support Memory ${rootId}`);
    }
    for (const row of options.tables.support_memory_enhancement_require_items) {
        if (!memoryRows.has(id(row, "support_memory_id")) || !enhancementItemRows.has(id(row, "support_memory_enhancement_item_id"))) {
            throw new Error(`Broken Support Memory enhancement requirement ${id(row)}`);
        }
    }
    const categoryCards = new Map();
    for (const relation of options.tables.card_card_categories) {
        const cardId = id(relation, "card_id"), categoryId = id(relation, "card_category_id");
        if (!categoryRows.has(categoryId))
            throw new Error(`Broken card category relation ${id(relation)}`);
        // The first-party DB retains taxonomy rows for cards outside the current
        // card catalog. They are irrelevant to the delivered character universe.
        if (!cardRows.has(cardId))
            continue;
        categoryCards.set(categoryId, new Set([...(categoryCards.get(categoryId) ?? []), cardId]));
    }
    const cardsByUniqueInfo = new Map();
    for (const card of cardRows.values()) {
        const uniqueInfoId = id(card, "card_unique_info_id");
        cardsByUniqueInfo.set(uniqueInfoId, new Set([...(cardsByUniqueInfo.get(uniqueInfoId) ?? []), id(card)]));
    }
    const uniqueInfoSetCards = new Map();
    for (const relation of options.tables.card_unique_info_set_relations) {
        const setId = id(relation, "card_unique_info_set_id"), uniqueInfoId = id(relation, "card_unique_info_id");
        const cards = cardsByUniqueInfo.get(uniqueInfoId);
        if (!cards)
            continue;
        uniqueInfoSetCards.set(setId, new Set([...(uniqueInfoSetCards.get(setId) ?? []), ...cards]));
    }
    const allCardIds = new Set([...cardRows.keys()].filter(cardId => !options.consumerCharacterIds || options.consumerCharacterIds.has(cardId)));
    const films = [...filmRows.values()].map(row => ({
        id: id(row), name: text(row.name) || `Film ${id(row)}`, description: text(row.description) || undefined,
    })).sort((left, right) => numericCompare(left.id, right.id));
    const filmsById = new Map(films.map(film => [film.id, film]));
    const missionJoins = buildMissionJoins(options.tables);
    const previousEntries = options.previousDataset?.entries ?? [];
    if (options.previousDataset && options.previousDataset.count !== previousEntries.length)
        throw new Error("Previous Support Memory dataset count mismatch");
    const previousById = new Map(previousEntries.map(entry => [entry.id, entry]));
    if (previousById.size !== previousEntries.length)
        throw new Error("Previous Support Memory dataset contains duplicate IDs");
    if (options.presentations) {
        for (const rootId of rootIds)
            if (!options.presentations.has(rootId))
                throw new Error(`Missing official Support Memory presentation ${rootId}`);
        for (const presentationId of options.presentations.keys())
            if (!rootIds.has(presentationId))
                throw new Error(`Unexpected official Support Memory presentation ${presentationId}`);
    }
    const provenanceEntries = [];
    const entries = rootRows.map(rootRow => {
        const rootId = id(rootRow);
        const chain = enhancementChain(rootId, levelsByRoot, memoryRows);
        const variantIds = [rootId, ...chain.map(step => step.enhancedSupportMemoryId)];
        const variantSkills = variantIds.flatMap(memoryId => skillsByMemory.get(memoryId) ?? []);
        const rootSkills = [...(skillsByMemory.get(rootId) ?? [])].sort((left, right) => numericCompare(id(left), id(right)));
        const categoryIds = new Set();
        const applicableCardIds = new Set();
        const targetRules = [];
        for (const skill of variantSkills) {
            const setId = (0, game_db_source_1.normalizeDbId)(skill.sub_target_type_set_id);
            if (!setId || setId === "0")
                continue;
            const rows = targetsBySet.get(setId);
            if (!rows || rows.length === 0)
                throw new Error(`Support Memory skill ${id(skill)} references missing sub-target set ${setId}`);
            const filters = parseTargetFilters(rows);
            for (const filter of filters)
                if (filter.selector === "card-category" && filter.inclusion === "include")
                    categoryIds.add(filter.selectorId);
            const applicable = applyFilters(filters, allCardIds, categoryCards, uniqueInfoSetCards);
            for (const cardId of applicable)
                applicableCardIds.add(cardId);
            targetRules.push({
                skillId: id(skill), supportMemoryId: id(skill, "support_memory_id"),
                targetType: integer(skill, "target_type"), targetSetId: setId,
                filters, applicableCardCount: applicable.size,
            });
        }
        const sortedCategoryIds = [...categoryIds].sort(numericCompare);
        const categoryNames = sortedCategoryIds.map(categoryId => {
            const row = categoryRows.get(categoryId);
            if (!row)
                throw new Error(`Support Memory ${rootId} references missing category ${categoryId}`);
            return text(row.name) || `Category ${categoryId}`;
        });
        const filmId = (0, game_db_source_1.normalizeDbId)(rootRow.support_film_id);
        const film = filmId ? filmsById.get(filmId) : undefined;
        if (filmId && !film)
            throw new Error(`Support Memory ${rootId} references missing film ${filmId}`);
        const officialUnlock = mergeMissionAcquisition("SupportMemory", rootId, 1, missionJoins);
        const officialFilm = filmId ? mergeMissionAcquisition("SupportFilm", filmId, integer(rootRow, "unlock_quantity"), missionJoins) : undefined;
        const requirementRows = variantIds.flatMap(memoryId => requirementsByMemory.get(memoryId) ?? []);
        const presentation = options.presentations?.get(rootId);
        const memory = {
            id: rootId,
            name: text(rootRow.name) || `Support Memory ${rootId}`,
            description: text(rootRow.description),
            ...(filmId ? { filmId } : {}),
            ...(film ? { film } : {}),
            cost: integer(rootRow, "cost"),
            unlockQuantity: integer(rootRow, "unlock_quantity"),
            lastsEntireBattle: variantSkills.some(skill => {
                const turns = integer(skill, "turn");
                return turns === -1 || turns >= 3000;
            }),
            releaseDate: date(rootRow, "open_at"),
            maxLevel: chain.length + 1,
            enhancementChain: chain,
            effects: rootSkills.map(effect),
        };
        const entry = {
            ...memory,
            filmName: film?.name,
            categoryIds: sortedCategoryIds,
            categoryNames,
            categoryTargetSource: "game-db-structural",
            applicableCharacterIds: [...applicableCardIds].sort(numericCompare),
            applicableCharacterSource: "game-db-structural",
            unlockMethod: officialUnlock ? "direct-item" : filmId ? "film-only" : "unknown",
            ...(officialUnlock ? { unlockAcquisition: officialUnlock } : {}),
            ...(officialFilm ? { filmAcquisition: officialFilm } : {}),
            ...(presentation ? { presentationSource: "game-assets", dokkanInfo: clone(presentation) } : {}),
        };
        provenanceEntries.push({
            memoryId: rootId,
            variantMemoryIds: variantIds,
            skillRowIds: variantSkills.map(row => id(row)).sort(numericCompare),
            enhancementLevelRowIds: chain.map(step => step.id).sort(numericCompare),
            enhancementRequirementRowIds: requirementRows.map(row => id(row)).sort(numericCompare),
            categoryIds: sortedCategoryIds,
            targetRules: targetRules.sort((left, right) => numericCompare(left.skillId, right.skillId)),
            missionRewardRowIds: missionJoins.filter(join => (join.itemType === "SupportMemory" && join.itemId === rootId) || (join.itemType === "SupportFilm" && join.itemId === filmId)).map(join => join.rewardId).sort(numericCompare),
            presentationFields: presentation ? ["dokkanInfo"] : [],
        });
        return entry;
    });
    const dataset = { generatedAt: options.generatedAt, source: "dokkan-game-db", count: entries.length, entries };
    const candidateIds = new Set(entries.map(entry => entry.id)), previousIds = new Set(previousEntries.map(entry => entry.id));
    const common = entries.filter(entry => previousIds.has(entry.id));
    const audit = {
        schemaVersion: 1,
        contract: exports.SUPPORT_MEMORY_FIRST_PARTY_CONTRACT,
        contractVersion: exports.SUPPORT_MEMORY_FIRST_PARTY_CONTRACT_VERSION,
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
            unresolvedUnlockMemoryCount: entries.filter(entry => !missionJoins.some(join => join.itemType === "SupportMemory" && join.itemId === entry.id)).length,
            officialPresentationCount: entries.filter(entry => entry.presentationSource === "game-assets").length,
        },
        compatibility: {
            previousCount: previousEntries.length,
            candidateCount: entries.length,
            addedIds: entries.filter(entry => !previousIds.has(entry.id)).map(entry => entry.id),
            removedIds: previousEntries.filter(entry => !candidateIds.has(entry.id)).map(entry => entry.id),
            coreChangedIds: common.filter(entry => sha(stableCore(entry)) !== sha(stableCore(previousById.get(entry.id)))).map(entry => entry.id),
            categoryChangedIds: common.filter(entry => JSON.stringify([...entry.categoryIds].sort(numericCompare)) !== JSON.stringify([...previousById.get(entry.id).categoryIds].sort(numericCompare))).map(entry => entry.id),
        },
        fieldAuthority: {
            "id,name,description,film,cost,unlockQuantity,releaseDate": "first-party",
            "enhancementChain,effects,duration": "first-party",
            "categoryIds,categoryNames,applicableCharacterIds": "first-party",
            "unlockAcquisition,filmAcquisition": "first-party",
            "dokkanInfo.levelDescriptions,dokkanInfo.assets,dokkanInfo.enhancementItems": "first-party",
        },
        entries: provenanceEntries,
    };
    return { dataset, audit };
}
exports.buildSupportMemoryFirstPartyCandidate = buildSupportMemoryFirstPartyCandidate;
//# sourceMappingURL=game-db-support-memory.js.map