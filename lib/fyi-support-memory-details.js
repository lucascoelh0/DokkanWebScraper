"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSupportMemoryDetailsDataset = exports.writeDokkanFyiSupportMemoryDetails = exports.getDokkanFyiSupportMemoryDetails = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
const format_json_1 = require("./format-json");
async function getDokkanFyiSupportMemoryDetails() {
    const [supportMemories, categoryContext, missionCatalog, stageCatalog, acquisition, sourceIndex, navigation, dokkanInfoEnrichment] = await Promise.all([
        readJsonFile("data/support-memories/latest/support-memories.json"),
        readJsonFile("data/category-context/latest/category-context.json"),
        readJsonFile("data/mission-catalog/latest/mission-catalog.json"),
        readJsonFile("data/stage-catalog/latest/stage-catalog.json"),
        readJsonFile("data/acquisition/latest/acquisition.json"),
        readJsonFile("data/acquisition/latest/acquisition-source-index.json"),
        readJsonFile("data/acquisition/latest/acquisition-navigation.json"),
        readOptionalJsonFile("data/support-memories/latest/support-memory-dokkaninfo-enrichment.json"),
    ]);
    return buildSupportMemoryDetailsDataset({
        supportMemories,
        categoryContext,
        missionCatalog,
        stageCatalog,
        acquisition,
        sourceIndex,
        navigation,
        dokkanInfoEnrichment,
    });
}
exports.getDokkanFyiSupportMemoryDetails = getDokkanFyiSupportMemoryDetails;
async function writeDokkanFyiSupportMemoryDetails(dataset) {
    const resolvedDataset = dataset ?? await getDokkanFyiSupportMemoryDetails();
    const outputDir = (0, path_1.resolve)(__dirname, "data/support-memories/latest");
    const outputPath = (0, path_1.resolve)(outputDir, "support-memory-details.json");
    await (0, promises_1.mkdir)(outputDir, { recursive: true });
    await (0, format_json_1.writeFormattedJson)(outputPath, resolvedDataset);
    return outputPath;
}
exports.writeDokkanFyiSupportMemoryDetails = writeDokkanFyiSupportMemoryDetails;
function buildSupportMemoryDetailsDataset(input) {
    const supportMemoryContextById = new Map(input.categoryContext.supportMemories.map(memory => [memory.id, memory]));
    const missionGroupByKey = new Map(input.missionCatalog.groups.map(group => [group.key, group]));
    const stageGroupByKey = new Map(input.stageCatalog.groups.map(group => [group.key, group]));
    const acquisitionByKey = new Map(input.acquisition.items.map(item => [item.key, item]));
    const sourceIndexByKey = new Map(input.sourceIndex.sources.map(source => [source.key, source]));
    const navigationBySourceKey = new Map(input.navigation.entries.map(entry => [entry.sourceKey, entry.target]));
    const dokkanInfoById = new Map((input.dokkanInfoEnrichment?.entries ?? []).map(entry => [entry.id, entry]));
    const entries = input.supportMemories.supportMemories
        .map(memory => mapSupportMemoryDetailsEntry(memory, supportMemoryContextById.get(memory.id), findSupportMemoryUnlockMissionFallbacks(memory.name, input.missionCatalog.missions), missionGroupByKey, stageGroupByKey, acquisitionByKey, sourceIndexByKey, navigationBySourceKey, dokkanInfoById.get(memory.id)))
        .sort(compareSupportMemoryDetailsEntries);
    return {
        generatedAt: new Date().toISOString(),
        source: "dokkan.fyi",
        count: entries.length,
        entries,
    };
}
exports.buildSupportMemoryDetailsDataset = buildSupportMemoryDetailsDataset;
function mapSupportMemoryDetailsEntry(memory, context, unlockMissionFallbacks, missionGroupByKey, stageGroupByKey, acquisitionByKey, sourceIndexByKey, navigationBySourceKey, dokkanInfoEntry) {
    const unlockItem = acquisitionByKey.get(`SupportMemory:${memory.id}`);
    const unlockAcquisition = unlockItem
        ? mapAcquisitionSummary(unlockItem, 1, missionGroupByKey, stageGroupByKey, sourceIndexByKey, navigationBySourceKey)
        : mapMissionFallbackSummary(memory.id, unlockMissionFallbacks, missionGroupByKey, stageGroupByKey);
    const filmAcquisition = memory.filmId
        ? mapAcquisitionSummary(acquisitionByKey.get(`SupportFilm:${memory.filmId}`), memory.unlockQuantity, missionGroupByKey, stageGroupByKey, sourceIndexByKey, navigationBySourceKey)
        : undefined;
    const unlockMethod = resolveUnlockMethod(unlockAcquisition, filmAcquisition);
    return {
        ...memory,
        filmName: memory.film?.name,
        categoryIds: [...(context?.categoryIds ?? [])].sort(compareStrings),
        categoryNames: [...(context?.categoryNames ?? [])].sort(compareStrings),
        applicableCharacterIds: [...(context?.applicableCharacterIds ?? [])].sort(compareStrings),
        unlockMethod,
        unlockAcquisition,
        filmAcquisition,
        dokkanInfo: mapDokkanInfoPresentation(dokkanInfoEntry),
    };
}
function mapDokkanInfoPresentation(entry) {
    if (!entry) {
        return undefined;
    }
    return {
        detailUrl: entry.detailUrl,
        levelDescriptions: entry.levelDescriptions,
        largeAsset: entry.largeAsset,
        completeAsset: entry.completeAsset,
        requiredFilm: entry.requiredFilm,
        enhancementItems: entry.enhancementItems,
        animation: entry.animation,
    };
}
function mapAcquisitionSummary(item, requiredQuantity, missionGroupByKey, stageGroupByKey, sourceIndexByKey, navigationBySourceKey) {
    if (!item) {
        return undefined;
    }
    const sources = item.sources
        .map(source => mapAcquisitionSourceEntry(source, sourceIndexByKey.get(source.key), navigationBySourceKey.get(source.key)))
        .sort(compareAcquisitionSourceEntries);
    const groups = buildAcquisitionGroups(sources, requiredQuantity, missionGroupByKey, stageGroupByKey);
    return {
        itemKey: item.key,
        itemType: item.itemType,
        itemId: item.itemId,
        sourceModel: "acquisition-item",
        requiredQuantity,
        groupCount: groups.length,
        sourceCount: sources.length,
        groups,
        sources,
    };
}
function mapMissionFallbackSummary(supportMemoryId, missions, missionGroupByKey, stageGroupByKey) {
    if (missions.length === 0) {
        return undefined;
    }
    const sources = missions
        .map(mission => mapMissionFallbackSourceEntry(mission, missionGroupByKey.get(mission.groupKey)))
        .sort(compareAcquisitionSourceEntries);
    const groups = buildAcquisitionGroups(sources, 1, missionGroupByKey, stageGroupByKey);
    return {
        itemKey: `SupportMemory:${supportMemoryId}`,
        itemType: "SupportMemory",
        itemId: supportMemoryId,
        sourceModel: "mission-fallback",
        requiredQuantity: 1,
        groupCount: groups.length,
        sourceCount: sources.length,
        groups,
        sources,
    };
}
function resolveUnlockMethod(unlockAcquisition, filmAcquisition) {
    if (unlockAcquisition?.sourceModel === "acquisition-item") {
        return "direct-item";
    }
    if (unlockAcquisition?.sourceModel === "mission-fallback") {
        return "mission-fallback";
    }
    if ((filmAcquisition?.sourceCount ?? 0) > 0) {
        return "film-only";
    }
    return "unknown";
}
function buildAcquisitionGroups(sources, requiredQuantity, missionGroupByKey, stageGroupByKey) {
    const groupsByKey = new Map();
    for (const source of sources) {
        const quantity = source.quantity ?? 0;
        const existing = groupsByKey.get(source.groupKey);
        if (existing) {
            existing.sourceCount += 1;
            existing.totalQuantity = (existing.totalQuantity ?? 0) + quantity;
            existing.maxQuantity = Math.max(existing.maxQuantity ?? 0, quantity);
            existing.sourceKeys.push(source.sourceKey);
            if (!existing.imageUrl) {
                existing.imageUrl = source.imageUrl;
            }
            if (!existing.sourcePath) {
                existing.sourcePath = source.sourcePath;
            }
            if (!existing.navigationTarget) {
                existing.navigationTarget = source.navigationTarget;
            }
            continue;
        }
        const metadata = resolveAcquisitionGroupMetadata(source.groupKey, missionGroupByKey, stageGroupByKey);
        groupsByKey.set(source.groupKey, {
            groupKey: source.groupKey,
            groupKind: source.groupKind,
            title: metadata.title || source.title,
            groupTitle: metadata.groupTitle,
            subtitle: source.subtitle,
            imageUrl: metadata.imageUrl || source.imageUrl,
            sourcePath: metadata.sourcePath || source.sourcePath,
            sourceCount: 1,
            totalQuantity: quantity,
            maxQuantity: quantity,
            satisfiesRequiredQuantity: requiredQuantity !== undefined ? quantity >= requiredQuantity : undefined,
            navigationTarget: metadata.navigationTarget || source.navigationTarget,
            sourceKeys: [source.sourceKey],
        });
    }
    const groups = [...groupsByKey.values()]
        .map(group => ({
        ...group,
        satisfiesRequiredQuantity: requiredQuantity !== undefined
            ? (group.totalQuantity ?? 0) >= requiredQuantity
            : undefined,
        sourceKeys: [...group.sourceKeys].sort(compareStrings),
    }))
        .sort(compareAcquisitionGroups);
    return groups;
}
function resolveAcquisitionGroupMetadata(groupKey, missionGroupByKey, stageGroupByKey) {
    const missionGroup = missionGroupByKey.get(groupKey);
    if (missionGroup) {
        const generic = missionGroup.title.startsWith("MissionCategory::");
        return {
            title: generic ? groupKey : missionGroup.title,
            groupTitle: generic ? missionGroup.title : undefined,
            imageUrl: missionGroup.imageUrl,
            sourcePath: missionGroup.kind === "event-category" ? `https://dokkan.fyi/missions/${missionGroup.id}` : undefined,
            navigationTarget: {
                kind: "mission-catalog-group",
                sourcePath: missionGroup.kind === "event-category" ? `https://dokkan.fyi/missions/${missionGroup.id}` : undefined,
                missionGroupKey: missionGroup.key,
            },
        };
    }
    const stageGroup = stageGroupByKey.get(groupKey);
    if (stageGroup) {
        return {
            title: stageGroup.title,
            imageUrl: stageGroup.imageUrl,
            sourcePath: stageGroup.sourcePath,
            navigationTarget: {
                kind: "stage-catalog-group",
                sourcePath: stageGroup.sourcePath,
                stageGroupKey: stageGroup.key,
                areaId: stageGroup.kind === "event-area" || stageGroup.kind === "quest-story-area" ? stageGroup.id : undefined,
                zBattleId: stageGroup.kind === "z-battle" ? stageGroup.zBattleId : undefined,
            },
        };
    }
    return {
        title: "",
    };
}
function mapAcquisitionSourceEntry(source, indexedSource, navigationTarget) {
    return {
        sourceKey: source.key,
        sourceKind: source.kind,
        groupKey: indexedSource?.groupKey || source.key,
        groupKind: indexedSource?.groupKind || "standalone",
        title: source.title,
        subtitle: source.subtitle,
        description: source.description,
        quantity: source.quantity,
        imageUrl: source.imageUrl,
        sourcePath: source.sourcePath,
        startsAt: source.startsAt,
        endsAt: source.endsAt,
        navigationTarget,
    };
}
function mapMissionFallbackSourceEntry(mission, group) {
    const sourcePath = mission.categoryId ? `https://dokkan.fyi/missions/${mission.categoryId}` : undefined;
    return {
        sourceKey: `mission-fallback:${mission.key}`,
        sourceKind: "event-mission",
        groupKey: mission.categoryId ? `event-mission-category:${mission.categoryId}` : mission.groupKey,
        groupKind: "event-mission-category",
        title: mission.title,
        subtitle: group?.title,
        description: mission.description,
        quantity: 1,
        sourcePath,
        startsAt: mission.startsAt,
        endsAt: mission.endsAt,
        navigationTarget: {
            kind: "mission-catalog-mission",
            sourcePath,
            missionKey: mission.key,
            missionGroupKey: mission.groupKey,
        },
    };
}
function findSupportMemoryUnlockMissionFallbacks(supportMemoryName, missions) {
    return missions.filter(mission => mission.kind === "event"
        && mission.type === "Mission::SupportMemoryGetMission::CompleteSupportMemoryMission"
        && mission.description.includes(supportMemoryName));
}
function compareSupportMemoryDetailsEntries(left, right) {
    return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
}
function compareAcquisitionSourceEntries(left, right) {
    return left.groupKind.localeCompare(right.groupKind)
        || left.groupKey.localeCompare(right.groupKey)
        || left.sourceKind.localeCompare(right.sourceKind)
        || left.title.localeCompare(right.title)
        || left.sourceKey.localeCompare(right.sourceKey);
}
function compareAcquisitionGroups(left, right) {
    return (right.satisfiesRequiredQuantity ? 1 : 0) - (left.satisfiesRequiredQuantity ? 1 : 0)
        || (right.totalQuantity ?? 0) - (left.totalQuantity ?? 0)
        || left.title.localeCompare(right.title)
        || left.groupKey.localeCompare(right.groupKey);
}
function compareStrings(left, right) {
    return left.localeCompare(right);
}
async function readJsonFile(relativePath) {
    const filePath = (0, path_1.resolve)(__dirname, relativePath);
    const raw = await (0, promises_1.readFile)(filePath, { encoding: "utf8" });
    return JSON.parse(raw);
}
async function readOptionalJsonFile(relativePath) {
    try {
        return await readJsonFile(relativePath);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("ENOENT")) {
            return undefined;
        }
        throw error;
    }
}
//# sourceMappingURL=fyi-support-memory-details.js.map