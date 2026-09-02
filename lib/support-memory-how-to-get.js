"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSupportMemoryHowToGet = exports.SUPPORT_MEMORY_HOW_TO_GET_CONTRACT_VERSION = exports.SUPPORT_MEMORY_HOW_TO_GET_CONTRACT = void 0;
exports.SUPPORT_MEMORY_HOW_TO_GET_CONTRACT = "support-memory-how-to-get-enrichment";
exports.SUPPORT_MEMORY_HOW_TO_GET_CONTRACT_VERSION = "1.0.0";
function buildSupportMemoryHowToGet(input) {
    validateInputs(input.supportMemories, input.stages, input.dokkanStats);
    const stagesById = new Map(input.stages.entries.map(stage => [stage.id, stage]));
    const stagesByAreaId = groupBy(input.stages.entries, stage => stage.areaId);
    const dokkanStatsById = new Map(input.dokkanStats.entries.map(entry => [entry.id, entry]));
    const firstPartyMissionKeys = new Set();
    const matchedMissionKeys = new Set();
    const firstPartyDropKeys = new Set();
    const matchedDropKeys = new Set();
    const entries = input.supportMemories.entries.map(memory => {
        const external = dokkanStatsById.get(memory.id);
        const missionVisuals = uniqueSourceMap(external.acquisitionSources.filter(isMissionSource), source => source.missionId, `DokkanStats Support Memory ${memory.id} mission`);
        const dropVisuals = uniqueSourceMap(external.acquisitionSources.filter(isStageDropSource), source => stageDropKey(memory.id, source.mapId, source.dropType), `DokkanStats Support Memory ${memory.id} stage drop`);
        const context = { stagesById, stagesByAreaId, missionVisuals, dropVisuals };
        const missionSources = memory.unlockAcquisition?.sources.map(source => {
            const missionId = missionIdFromSourceKey(source.sourceKey);
            if (!missionId)
                return source;
            const key = `${memory.id}:${missionId}`;
            firstPartyMissionKeys.add(key);
            const visual = missionVisuals.get(missionId);
            if (visual)
                matchedMissionKeys.add(key);
            return enrichMissionSource(source, visual);
        }) ?? [];
        const dropSources = stageDropSources(memory, input.stages.entries, dropVisuals, firstPartyDropKeys, matchedDropKeys);
        const unlockSources = uniqueSources([...missionSources, ...dropSources]);
        const unlockAcquisition = unlockSources.length > 0
            ? buildAcquisitionSummary(memory.unlockAcquisition, memory.id, "SupportMemory", 1, unlockSources, context)
            : undefined;
        const filmAcquisition = memory.filmAcquisition
            ? buildAcquisitionSummary(memory.filmAcquisition, memory.filmAcquisition.itemId, memory.filmAcquisition.itemType, memory.filmAcquisition.requiredQuantity, memory.filmAcquisition.sources, { ...context, missionVisuals: new Map(), dropVisuals: new Map() })
            : undefined;
        return {
            ...memory,
            unlockMethod: unlockAcquisition ? "direct-item" : memory.unlockMethod,
            ...(unlockAcquisition ? { unlockAcquisition } : {}),
            ...(filmAcquisition ? { filmAcquisition } : {}),
        };
    });
    const dokkanStatsMissionKeys = new Set(input.dokkanStats.entries.flatMap(entry => entry.acquisitionSources
        .filter(isMissionSource)
        .map(source => `${entry.id}:${source.missionId}`)));
    const dokkanStatsDropKeys = new Set(input.dokkanStats.entries.flatMap(entry => entry.acquisitionSources
        .filter(isStageDropSource)
        .map(source => stageDropKey(entry.id, source.mapId, source.dropType))));
    const unmatched = {
        dokkanStatsMissionKeys: difference(dokkanStatsMissionKeys, matchedMissionKeys),
        firstPartyMissionKeys: difference(firstPartyMissionKeys, matchedMissionKeys),
        dokkanStatsStageDropKeys: difference(dokkanStatsDropKeys, matchedDropKeys),
        firstPartyStageDropKeys: difference(firstPartyDropKeys, matchedDropKeys),
    };
    if (unmatched.dokkanStatsStageDropKeys.length > 0 || unmatched.firstPartyStageDropKeys.length > 0) {
        throw new Error("DokkanStats and first-party Support Memory stage drops do not match exactly.");
    }
    if (unmatched.dokkanStatsMissionKeys.length > 0) {
        throw new Error("DokkanStats exposes Support Memory missions absent from the first-party unlock projection.");
    }
    const generatedAt = input.generatedAt ?? new Date().toISOString();
    const dataset = {
        ...input.supportMemories,
        generatedAt,
        entries,
        count: entries.length,
    };
    const groups = entries.flatMap(entry => [
        ...(entry.unlockAcquisition?.groups ?? []),
        ...(entry.filmAcquisition?.groups ?? []),
    ]);
    const allSources = entries.flatMap(entry => [
        ...(entry.unlockAcquisition?.sources ?? []),
        ...(entry.filmAcquisition?.sources ?? []),
    ]);
    return {
        dataset,
        audit: {
            schemaVersion: 1,
            contract: exports.SUPPORT_MEMORY_HOW_TO_GET_CONTRACT,
            contractVersion: exports.SUPPORT_MEMORY_HOW_TO_GET_CONTRACT_VERSION,
            generatedAt,
            counts: {
                memories: entries.length,
                missionSources: allSources.filter(source => source.sourceKind === "event-mission").length,
                stageDropSources: allSources.filter(source => source.sourceKind === "support-memory-stage-drop").length,
                acquisitionGroups: groups.length,
                groupsWithImages: groups.filter(group => Boolean(group.imageUrl)).length,
                groupsWithFirstPartyDisplayTitles: groups.filter(group => Boolean(group.groupTitle)).length,
                dokkanStatsMissionMatches: matchedMissionKeys.size,
                dokkanStatsStageDropMatches: matchedDropKeys.size,
            },
            unmatched,
        },
    };
}
exports.buildSupportMemoryHowToGet = buildSupportMemoryHowToGet;
function validateInputs(supportMemories, stages, dokkanStats) {
    if (supportMemories.source !== "dokkan-game-db")
        throw new Error("How-to-get enrichment requires first-party Support Memories.");
    if (stages.source !== "dokkan-game-db")
        throw new Error("How-to-get enrichment requires first-party Stages.");
    if (dokkanStats.contract !== "dokkanstats-support-memory-enrichment" || dokkanStats.contractVersion !== "1.0.0") {
        throw new Error("Unsupported DokkanStats Support Memory enrichment contract.");
    }
    const memories = uniqueMap(supportMemories.entries, entry => entry.id, "first-party Support Memory");
    const external = uniqueMap(dokkanStats.entries, entry => entry.id, "DokkanStats Support Memory");
    if (memories.size !== supportMemories.count || external.size !== dokkanStats.rootMemoryCount) {
        throw new Error("Support Memory input count mismatch.");
    }
    const missing = difference(new Set(memories.keys()), new Set(external.keys()));
    const extra = difference(new Set(external.keys()), new Set(memories.keys()));
    if (missing.length > 0 || extra.length > 0)
        throw new Error("DokkanStats Support Memory root IDs do not match first-party roots.");
    for (const memory of supportMemories.entries) {
        const evidence = external.get(memory.id);
        if (evidence.name !== memory.name || evidence.maxLevel !== memory.maxLevel) {
            throw new Error(`DokkanStats Support Memory ${memory.id} identity does not match first-party data.`);
        }
    }
    uniqueMap(stages.entries, stage => stage.id, "first-party Stage");
}
function stageDropSources(memory, stages, visuals, firstPartyKeys, matchedKeys) {
    return stages.flatMap(stage => (stage.bossDrops ?? [])
        .filter(drop => drop.itemType === "SupportMemory" && drop.itemId === memory.id)
        .map(drop => {
        const dropType = requiredNonNegativeInt(drop.dropTypeRaw, `Stage ${stage.id} Support Memory drop type`);
        const comparisonKey = stageDropKey(memory.id, stage.id, dropType);
        firstPartyKeys.add(comparisonKey);
        const visual = visuals.get(comparisonKey);
        if (visual)
            matchedKeys.add(comparisonKey);
        const relation = {
            targetKind: "quest-level",
            targetId: stage.id,
            relation: "stage-drop",
        };
        const areaRelation = {
            targetKind: "area",
            targetId: stage.areaId,
            relation: "stage-drop",
        };
        return {
            sourceKey: `support-memory-stage-drop:${stage.id}:${drop.sourceRowId}:${memory.id}`,
            sourceKind: "support-memory-stage-drop",
            groupKey: `support-memory-stage-drop:${stage.areaId}:${stage.questId}`,
            groupKind: "support-memory-stage-drop",
            title: stage.questName,
            subtitle: stageDropDifficultyLabel(visual?.difficulty, stage.difficulty),
            ...(visual?.imageUrl ? { imageUrl: visual.imageUrl } : {}),
            ...(stage.images.button?.sourcePath ? { sourcePath: stage.images.button.sourcePath } : {}),
            ...(stage.startDate ? { startsAt: stage.startDate } : {}),
            ...(visual?.endsAt ? { endsAt: visual.endsAt } : {}),
            officialStageRelations: [relation, areaRelation],
        };
    }));
}
function enrichMissionSource(source, visual) {
    if (!visual)
        return source;
    return {
        ...source,
        imageUrl: visual.imageUrl,
        sourcePath: source.sourcePath ?? pathFromUrl(visual.imageUrl),
    };
}
function buildAcquisitionSummary(previous, itemId, itemType, requiredQuantity, sources, context) {
    const groups = buildGroups(sources, requiredQuantity, previous, context);
    return {
        itemKey: previous?.itemKey ?? `${itemType}:${itemId}`,
        itemType,
        itemId,
        sourceModel: previous?.sourceModel ?? "acquisition-item",
        ...(requiredQuantity !== undefined ? { requiredQuantity } : {}),
        groupCount: groups.length,
        sourceCount: sources.length,
        groups,
        sources,
    };
}
function buildGroups(sources, requiredQuantity, previous, context) {
    const previousByKey = new Map((previous?.groups ?? []).map(group => [group.groupKey, group]));
    const grouped = groupBy(sources, source => source.groupKey);
    return [...grouped.entries()].map(([groupKey, groupSources]) => {
        const first = groupSources[0];
        const old = previousByKey.get(groupKey);
        const quantities = groupSources.map(source => source.quantity).filter((value) => value !== undefined);
        const totalQuantity = quantities.length > 0 ? quantities.reduce((sum, value) => sum + value, 0) : undefined;
        const maxQuantity = quantities.length > 0 ? Math.max(...quantities) : undefined;
        const missionVisuals = groupSources.flatMap(source => {
            const missionId = missionIdFromSourceKey(source.sourceKey);
            const visual = missionId ? context.missionVisuals.get(missionId) : undefined;
            return visual ? [visual] : [];
        });
        const imageUrl = uniqueOptional(missionVisuals.map(value => value.imageUrl), `${groupKey} image URL`)
            ?? uniqueOptional(groupSources.map(value => value.imageUrl), `${groupKey} source image URL`)
            ?? old?.imageUrl;
        const sourceCategoryType = uniqueOptional(missionVisuals.map(value => value.categoryType), `${groupKey} category type`);
        const display = groupDisplay(groupSources, context);
        return {
            groupKey,
            groupKind: first.groupKind,
            title: old?.title ?? display.title,
            ...(display.groupTitle ? { groupTitle: display.groupTitle } : old?.groupTitle ? { groupTitle: old.groupTitle } : {}),
            ...(display.subtitle ? { subtitle: display.subtitle } : old?.subtitle ? { subtitle: old.subtitle } : {}),
            ...(imageUrl ? { imageUrl } : {}),
            ...(display.sourcePath ? { sourcePath: display.sourcePath } : old?.sourcePath ? { sourcePath: old.sourcePath } : {}),
            sourceCount: groupSources.length,
            ...(totalQuantity !== undefined ? { totalQuantity } : {}),
            ...(maxQuantity !== undefined ? {
                maxQuantity,
                ...(requiredQuantity !== undefined ? { satisfiesRequiredQuantity: maxQuantity >= requiredQuantity } : {}),
            } : {}),
            ...(sourceCategoryType ? { sourceCategoryType } : {}),
            isAlwaysAvailable: groupSources.every(source => isAlwaysAvailable(source.endsAt)),
            sourceKeys: groupSources.map(source => source.sourceKey),
        };
    }).sort((left, right) => left.groupKey.localeCompare(right.groupKey, "en", { numeric: true }));
}
function groupDisplay(sources, context) {
    const first = sources[0];
    if (first.sourceKind === "support-memory-stage-drop") {
        const stageId = first.officialStageRelations?.find(relation => relation.targetKind === "quest-level")?.targetId;
        const stage = stageId ? context.stagesById.get(stageId) : undefined;
        return {
            title: stage?.areaName ?? first.title,
            groupTitle: stage?.areaName,
            subtitle: stage?.questName,
            sourcePath: stage?.images.button?.sourcePath,
        };
    }
    const stages = sources.flatMap(source => source.officialStageRelations ?? [])
        .flatMap(relation => stagesForRelation(relation, context));
    const areaNames = unique(stages.map(stage => stage.areaName).filter(Boolean));
    const sourcePaths = unique(stages.map(stage => stage.images.button?.sourcePath).filter((value) => Boolean(value)));
    return {
        title: first.title,
        ...(areaNames.length === 1 ? { groupTitle: areaNames[0] } : {}),
        ...(sourcePaths.length === 1 ? { sourcePath: sourcePaths[0] } : {}),
    };
}
function stagesForRelation(relation, context) {
    if (relation.targetKind === "quest-level") {
        const stage = context.stagesById.get(relation.targetId);
        return stage ? [stage] : [];
    }
    if (relation.targetKind === "area")
        return context.stagesByAreaId.get(relation.targetId) ?? [];
    return [];
}
function missionIdFromSourceKey(key) {
    return key.match(/^event-mission:\d+:(\d+):/)?.[1];
}
function stageDropKey(memoryId, mapId, dropType) {
    return `${memoryId}:${mapId}:${dropType}`;
}
function stageDropDifficultyLabel(raw, fallback) {
    switch (raw) {
        case 0: return "NORMAL";
        case 1: return "HARD";
        case 2: return "Z-HARD";
        default: return fallback;
    }
}
function isMissionSource(source) {
    return source.kind === "mission";
}
function isStageDropSource(source) {
    return source.kind === "stage-drop";
}
function isAlwaysAvailable(value) {
    return Boolean(value && /^2038-01-01(?:T| )00:00:00/.test(value));
}
function pathFromUrl(value) {
    if (!value)
        return undefined;
    const url = new URL(value);
    return decodeURIComponent(url.pathname).replace(/^\/+/, "");
}
function requiredNonNegativeInt(value, label) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0)
        throw new Error(`${label} is invalid.`);
    return parsed;
}
function uniqueSources(values) {
    const map = uniqueMap(values, value => value.sourceKey, "Support Memory acquisition source");
    return [...map.values()].sort((left, right) => left.sourceKey.localeCompare(right.sourceKey, "en", { numeric: true }));
}
function uniqueOptional(values, label) {
    const distinct = unique(values.filter((value) => Boolean(value)));
    if (distinct.length > 1)
        throw new Error(`Conflicting ${label}.`);
    return distinct[0];
}
function unique(values) {
    return [...new Set(values)].sort((left, right) => left.localeCompare(right, "en", { numeric: true }));
}
function uniqueMap(values, key, label) {
    const result = new Map();
    for (const value of values) {
        const id = key(value);
        if (result.has(id))
            throw new Error(`Duplicate ${label} ${id}.`);
        result.set(id, value);
    }
    return result;
}
function uniqueSourceMap(values, key, label) {
    const result = new Map();
    for (const value of values) {
        const id = key(value);
        const previous = result.get(id);
        if (previous && JSON.stringify(previous) !== JSON.stringify(value))
            throw new Error(`Conflicting ${label} ${id}.`);
        result.set(id, value);
    }
    return result;
}
function groupBy(values, key) {
    const result = new Map();
    for (const value of values)
        result.set(key(value), [...(result.get(key(value)) ?? []), value]);
    return result;
}
function difference(left, right) {
    return [...left].filter(value => !right.has(value)).sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
}
//# sourceMappingURL=support-memory-how-to-get.js.map