import { mkdir, readFile } from "fs/promises";
import { resolve } from "path";
import { AcquisitionDataset, AcquisitionItem, AcquisitionSource } from "./acquisition";
import { AcquisitionNavigationDataset, AcquisitionNavigationTarget } from "./acquisition-navigation";
import { AcquisitionSourceEntry, AcquisitionSourceIndexDataset } from "./acquisition-source-index";
import { CategoryContextDataset, SupportMemoryContextEntry } from "./category-context";
import { writeFormattedJson } from "./format-json";
import { MissionCatalogDataset, MissionCatalogGroup, MissionCatalogMission } from "./mission-catalog";
import { StageCatalogDataset, StageCatalogGroup } from "./stage-catalog";
import { SupportMemoryDataset } from "./support-memory";
import { SupportMemoryDokkanInfoEnrichmentDataset, SupportMemoryDokkanInfoEnrichmentEntry } from "./support-memory-dokkaninfo-enrichment";
import { writeSupportMemoryDatasetManifest } from "./support-memory-dataset-artifacts";
import {
    SupportMemoryAcquisitionGroupEntry,
    SupportMemoryAcquisitionSourceEntry,
    SupportMemoryAcquisitionSummary,
    SupportMemoryDokkanInfoPresentation,
    SupportMemoryDetailsDataset,
    SupportMemoryDetailsEntry,
} from "./support-memory-details";

interface SupportMemoryDetailsBuildInput {
    supportMemories: SupportMemoryDataset,
    categoryContext: CategoryContextDataset,
    missionCatalog: MissionCatalogDataset,
    stageCatalog: StageCatalogDataset,
    acquisition: AcquisitionDataset,
    sourceIndex: AcquisitionSourceIndexDataset,
    navigation: AcquisitionNavigationDataset,
    dokkanInfoEnrichment?: SupportMemoryDokkanInfoEnrichmentDataset,
}

export async function getDokkanFyiSupportMemoryDetails(): Promise<SupportMemoryDetailsDataset> {
    const [supportMemories, categoryContext, missionCatalog, stageCatalog, acquisition, sourceIndex, navigation, dokkanInfoEnrichment] = await Promise.all([
        readJsonFile<SupportMemoryDataset>("data/support-memories/latest/support-memories.json"),
        readJsonFile<CategoryContextDataset>("data/category-context/latest/category-context.json"),
        readJsonFile<MissionCatalogDataset>("data/mission-catalog/latest/mission-catalog.json"),
        readJsonFile<StageCatalogDataset>("data/stage-catalog/latest/stage-catalog.json"),
        readJsonFile<AcquisitionDataset>("data/acquisition/latest/acquisition.json"),
        readJsonFile<AcquisitionSourceIndexDataset>("data/acquisition/latest/acquisition-source-index.json"),
        readJsonFile<AcquisitionNavigationDataset>("data/acquisition/latest/acquisition-navigation.json"),
        readOptionalJsonFile<SupportMemoryDokkanInfoEnrichmentDataset>("data/support-memories/latest/support-memory-dokkaninfo-enrichment.json"),
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

export async function writeDokkanFyiSupportMemoryDetails(
    dataset?: SupportMemoryDetailsDataset,
): Promise<string> {
    const resolvedDataset = dataset ?? await getDokkanFyiSupportMemoryDetails();
    const outputDir = resolve(__dirname, "data/support-memories/latest");
    const outputPath = resolve(outputDir, "support-memory-details.json");
    const manifestPath = resolve(outputDir, "support-memory-manifest.json");

    await mkdir(outputDir, { recursive: true });
    await writeFormattedJson(outputPath, resolvedDataset);
    await writeSupportMemoryDatasetManifest(resolvedDataset, outputPath, manifestPath);

    return outputPath;
}

export function buildSupportMemoryDetailsDataset(
    input: SupportMemoryDetailsBuildInput,
): SupportMemoryDetailsDataset {
    const supportMemoryContextById = new Map(
        input.categoryContext.supportMemories.map(memory => [memory.id, memory]),
    );
    const missionGroupByKey = new Map(
        input.missionCatalog.groups.map(group => [group.key, group]),
    );
    const stageGroupByKey = new Map(
        input.stageCatalog.groups.map(group => [group.key, group]),
    );
    const acquisitionByKey = new Map(
        input.acquisition.items.map(item => [item.key, item]),
    );
    const sourceIndexByKey = new Map(
        input.sourceIndex.sources.map(source => [source.key, source]),
    );
    const navigationBySourceKey = new Map(
        input.navigation.entries.map(entry => [entry.sourceKey, entry.target]),
    );
    const dokkanInfoById = new Map(
        (input.dokkanInfoEnrichment?.entries ?? []).map(entry => [entry.id, entry]),
    );

    const entries = input.supportMemories.supportMemories
        .map(memory => mapSupportMemoryDetailsEntry(
            memory,
            supportMemoryContextById.get(memory.id),
            findSupportMemoryUnlockMissionFallbacks(memory.name, input.missionCatalog.missions),
            missionGroupByKey,
            stageGroupByKey,
            acquisitionByKey,
            sourceIndexByKey,
            navigationBySourceKey,
            dokkanInfoById.get(memory.id),
        ))
        .sort(compareSupportMemoryDetailsEntries);

    return {
        generatedAt: new Date().toISOString(),
        source: "dokkan.fyi",
        count: entries.length,
        entries,
    };
}

function mapSupportMemoryDetailsEntry(
    memory: SupportMemoryDataset["supportMemories"][number],
    context: SupportMemoryContextEntry | undefined,
    unlockMissionFallbacks: MissionCatalogMission[],
    missionGroupByKey: Map<string, MissionCatalogGroup>,
    stageGroupByKey: Map<string, StageCatalogGroup>,
    acquisitionByKey: Map<string, AcquisitionItem>,
    sourceIndexByKey: Map<string, AcquisitionSourceEntry>,
    navigationBySourceKey: Map<string, AcquisitionNavigationTarget>,
    dokkanInfoEntry: SupportMemoryDokkanInfoEnrichmentEntry | undefined,
): SupportMemoryDetailsEntry {
    const unlockItem = acquisitionByKey.get(`SupportMemory:${memory.id}`);
    const unlockAcquisition = unlockItem
        ? mapAcquisitionSummary(
            unlockItem,
            1,
            missionGroupByKey,
            stageGroupByKey,
            sourceIndexByKey,
            navigationBySourceKey,
        )
        : mapMissionFallbackSummary(memory.id, unlockMissionFallbacks, missionGroupByKey, stageGroupByKey);
    const filmAcquisition = memory.filmId
        ? mapAcquisitionSummary(
            acquisitionByKey.get(`SupportFilm:${memory.filmId}`),
            memory.unlockQuantity,
            missionGroupByKey,
            stageGroupByKey,
            sourceIndexByKey,
            navigationBySourceKey,
        )
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

function mapDokkanInfoPresentation(
    entry: SupportMemoryDokkanInfoEnrichmentEntry | undefined,
): SupportMemoryDokkanInfoPresentation | undefined {
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

function mapAcquisitionSummary(
    item: AcquisitionItem | undefined,
    requiredQuantity: number | undefined,
    missionGroupByKey: Map<string, MissionCatalogGroup>,
    stageGroupByKey: Map<string, StageCatalogGroup>,
    sourceIndexByKey: Map<string, AcquisitionSourceEntry>,
    navigationBySourceKey: Map<string, AcquisitionNavigationTarget>,
): SupportMemoryAcquisitionSummary | undefined {
    if (!item) {
        return undefined;
    }

    const sources = item.sources
        .map(source => mapAcquisitionSourceEntry(source, sourceIndexByKey.get(source.key), navigationBySourceKey.get(source.key)))
        .sort(compareAcquisitionSourceEntries);
    const groups = buildAcquisitionGroups(
        sources,
        requiredQuantity,
        missionGroupByKey,
        stageGroupByKey,
    );

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

function mapMissionFallbackSummary(
    supportMemoryId: string,
    missions: MissionCatalogMission[],
    missionGroupByKey: Map<string, MissionCatalogGroup>,
    stageGroupByKey: Map<string, StageCatalogGroup>,
): SupportMemoryAcquisitionSummary | undefined {
    if (missions.length === 0) {
        return undefined;
    }

    const sources = missions
        .map(mission => mapMissionFallbackSourceEntry(mission, missionGroupByKey.get(mission.groupKey)))
        .sort(compareAcquisitionSourceEntries);
    const groups = buildAcquisitionGroups(
        sources,
        1,
        missionGroupByKey,
        stageGroupByKey,
    );

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

function resolveUnlockMethod(
    unlockAcquisition: SupportMemoryAcquisitionSummary | undefined,
    filmAcquisition: SupportMemoryAcquisitionSummary | undefined,
): "direct-item" | "mission-fallback" | "film-only" | "unknown" {
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

function buildAcquisitionGroups(
    sources: SupportMemoryAcquisitionSourceEntry[],
    requiredQuantity: number | undefined,
    missionGroupByKey: Map<string, MissionCatalogGroup>,
    stageGroupByKey: Map<string, StageCatalogGroup>,
): SupportMemoryAcquisitionGroupEntry[] {
    const groupsByKey = new Map<string, SupportMemoryAcquisitionGroupEntry>();

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

function resolveAcquisitionGroupMetadata(
    groupKey: string,
    missionGroupByKey: Map<string, MissionCatalogGroup>,
    stageGroupByKey: Map<string, StageCatalogGroup>,
): {
    title: string,
    groupTitle?: string,
    imageUrl?: string,
    sourcePath?: string,
    navigationTarget?: AcquisitionNavigationTarget,
} {
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

function mapAcquisitionSourceEntry(
    source: AcquisitionSource,
    indexedSource: AcquisitionSourceEntry | undefined,
    navigationTarget: AcquisitionNavigationTarget | undefined,
): SupportMemoryAcquisitionSourceEntry {
    return {
        sourceKey: source.key,
        sourceKind: source.kind,
        groupKey: indexedSource?.groupKey || source.key,
        groupKind: indexedSource?.groupKind || "standalone",
        title: source.title,
        subtitle: cleanAcquisitionText(source.subtitle),
        description: source.description,
        quantity: source.quantity,
        imageUrl: source.imageUrl,
        sourcePath: source.sourcePath,
        startsAt: source.startsAt,
        endsAt: source.endsAt,
        navigationTarget,
    };
}

function mapMissionFallbackSourceEntry(
    mission: MissionCatalogMission,
    group: MissionCatalogGroup | undefined,
): SupportMemoryAcquisitionSourceEntry {
    const sourcePath = mission.categoryId ? `https://dokkan.fyi/missions/${mission.categoryId}` : undefined;

    return {
        sourceKey: `mission-fallback:${mission.key}`,
        sourceKind: "event-mission",
        groupKey: mission.categoryId ? `event-mission-category:${mission.categoryId}` : mission.groupKey,
        groupKind: "event-mission-category",
        title: mission.title,
        subtitle: cleanAcquisitionText(group?.title),
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

function cleanAcquisitionText(value: string | undefined): string | undefined {
    const normalized = value?.replace(/\s+/g, " ").trim();
    if (!normalized || /^MissionCategory::/i.test(normalized)) {
        return undefined;
    }

    return normalized;
}

function findSupportMemoryUnlockMissionFallbacks(
    supportMemoryName: string,
    missions: MissionCatalogMission[],
): MissionCatalogMission[] {
    return missions.filter(mission =>
        mission.kind === "event"
        && mission.type === "Mission::SupportMemoryGetMission::CompleteSupportMemoryMission"
        && mission.description.includes(supportMemoryName),
    );
}

function compareSupportMemoryDetailsEntries(
    left: SupportMemoryDetailsEntry,
    right: SupportMemoryDetailsEntry,
): number {
    return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
}

function compareAcquisitionSourceEntries(
    left: SupportMemoryAcquisitionSourceEntry,
    right: SupportMemoryAcquisitionSourceEntry,
): number {
    return left.groupKind.localeCompare(right.groupKind)
        || left.groupKey.localeCompare(right.groupKey)
        || left.sourceKind.localeCompare(right.sourceKind)
        || left.title.localeCompare(right.title)
        || left.sourceKey.localeCompare(right.sourceKey);
}

function compareAcquisitionGroups(
    left: SupportMemoryAcquisitionGroupEntry,
    right: SupportMemoryAcquisitionGroupEntry,
): number {
    return (right.satisfiesRequiredQuantity ? 1 : 0) - (left.satisfiesRequiredQuantity ? 1 : 0)
        || (right.totalQuantity ?? 0) - (left.totalQuantity ?? 0)
        || left.title.localeCompare(right.title)
        || left.groupKey.localeCompare(right.groupKey);
}

function compareStrings(left: string, right: string): number {
    return left.localeCompare(right);
}

async function readJsonFile<T>(relativePath: string): Promise<T> {
    const filePath = resolve(__dirname, relativePath);
    const raw = await readFile(filePath, { encoding: "utf8" });
    return JSON.parse(raw) as T;
}

async function readOptionalJsonFile<T>(relativePath: string): Promise<T | undefined> {
    try {
        return await readJsonFile<T>(relativePath);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("ENOENT")) {
            return undefined;
        }

        throw error;
    }
}
