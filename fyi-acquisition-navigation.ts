import { mkdir, readFile } from "fs/promises";
import { resolve } from "path";
import { AcquisitionSourceEntry, AcquisitionSourceIndexDataset } from "./acquisition-source-index";
import {
    AcquisitionNavigationDataset,
    AcquisitionNavigationEntry,
    AcquisitionNavigationTarget,
} from "./acquisition-navigation";
import { writeFormattedJson } from "./format-json";

export async function getDokkanFyiAcquisitionNavigation(): Promise<AcquisitionNavigationDataset> {
    const sourceIndex = await readJsonFile<AcquisitionSourceIndexDataset>("data/acquisition/latest/acquisition-source-index.json");
    return buildAcquisitionNavigationDataset(sourceIndex);
}

export async function writeDokkanFyiAcquisitionNavigation(): Promise<string> {
    const dataset = await getDokkanFyiAcquisitionNavigation();
    const outputDir = resolve(__dirname, "data/acquisition/latest");
    const outputPath = resolve(outputDir, "acquisition-navigation.json");

    await mkdir(outputDir, { recursive: true });
    await writeFormattedJson(outputPath, dataset);

    return outputPath;
}

export function buildAcquisitionNavigationDataset(
    sourceIndex: AcquisitionSourceIndexDataset,
): AcquisitionNavigationDataset {
    const entries = sourceIndex.sources
        .map(mapNavigationEntry)
        .sort(compareNavigationEntries);

    return {
        generatedAt: new Date().toISOString(),
        source: "dokkan.fyi",
        sourceCount: entries.length,
        entries,
    };
}

function mapNavigationEntry(source: AcquisitionSourceEntry): AcquisitionNavigationEntry {
    return {
        sourceKey: source.key,
        sourceKind: source.kind,
        title: source.title,
        subtitle: source.subtitle,
        target: mapNavigationTarget(source),
    };
}

function mapNavigationTarget(source: AcquisitionSourceEntry): AcquisitionNavigationTarget {
    switch (source.kind) {
        case "event-mission":
            return {
                kind: "mission-catalog-mission",
                sourcePath: source.sourcePath,
                missionKey: source.missionId ? `event:${source.missionId}` : undefined,
                missionGroupKey: source.missionCategoryId ? `event-category:${source.missionCategoryId}` : undefined,
            };
        case "frontier-chapter-mission":
            return {
                kind: "mission-catalog-mission",
                sourcePath: source.sourcePath,
                missionKey: source.missionId ? `frontier-chapter:${source.missionId}` : undefined,
                missionGroupKey: source.frontierChapterId ? `frontier-chapter:${source.frontierChapterId}` : undefined,
            };
        case "frontier-node-mission":
            return {
                kind: "mission-catalog-mission",
                sourcePath: source.sourcePath,
                missionKey: source.missionId ? `frontier-node:${source.missionId}` : undefined,
                missionGroupKey: source.frontierChapterId && source.frontierNodeId
                    ? `frontier-node:${source.frontierChapterId}:${source.frontierNodeId}`
                    : undefined,
            };
        case "z-battle-level":
            return {
                kind: "stage-catalog-entry",
                sourcePath: source.sourcePath,
                stageEntryKey: source.zBattleId && source.zBattlePhaseId && source.level !== undefined
                    ? `z-battle-level:${source.zBattleId}:${source.zBattlePhaseId}:${source.level}`
                    : undefined,
                stageGroupKey: source.zBattleId ? `z-battle:${source.zBattleId}` : undefined,
                zBattleId: source.zBattleId,
                zBattlePhaseId: source.zBattlePhaseId,
                level: source.level,
            };
        case "z-battle-checkpoint":
            return {
                kind: "stage-catalog-entry",
                sourcePath: source.sourcePath,
                stageEntryKey: source.zBattleId && source.zBattlePhaseId && source.checkpointLevel !== undefined
                    ? `z-battle-checkpoint:${source.zBattleId}:${source.zBattlePhaseId}:${source.checkpointLevel}`
                    : undefined,
                stageGroupKey: source.zBattleId ? `z-battle:${source.zBattleId}` : undefined,
                zBattleId: source.zBattleId,
                zBattlePhaseId: source.zBattlePhaseId,
                checkpointLevel: source.checkpointLevel,
            };
        case "awakening-medal-stage":
            if (source.questId) {
                return {
                    kind: "stage-catalog-entry",
                    sourcePath: source.sourcePath,
                    stageEntryKey: buildAwakeningStageEntryKey(source),
                    stageGroupKey: buildAwakeningStageGroupKey(source),
                    questId: source.questId,
                    areaId: source.areaId,
                };
            }

            return {
                kind: "stage-catalog-group",
                sourcePath: source.sourcePath,
                stageGroupKey: buildAwakeningStageGroupKey(source),
                areaId: source.areaId,
            };
        case "awakening-medal-z-battle":
            return {
                kind: "stage-catalog-group",
                sourcePath: source.sourcePath,
                stageGroupKey: source.zBattleId ? `z-battle:${source.zBattleId}` : undefined,
                zBattleId: source.zBattleId,
            };
        case "awakening-medal-baba-shop":
            return {
                kind: "awakening-baba-shop-sale",
                sourcePath: source.sourcePath,
                saleId: source.saleId,
            };
        case "awakening-medal-world-tournament":
            return {
                kind: "awakening-world-tournament",
                sourcePath: source.sourcePath,
                tournamentId: source.tournamentId,
            };
    }
}

function buildAwakeningStageGroupKey(source: AcquisitionSourceEntry): string | undefined {
    if (!source.areaId) {
        return undefined;
    }

    return isQuestStoryStageSource(source)
        ? `quest-story-area:${source.areaId}`
        : `event-area:${source.areaId}`;
}

function buildAwakeningStageEntryKey(source: AcquisitionSourceEntry): string | undefined {
    if (!source.stageId) {
        return undefined;
    }

    return isQuestStoryStageSource(source)
        ? `quest-stage:${source.stageId}`
        : `event-stage:${source.stageId}`;
}

function isQuestStoryStageSource(source: AcquisitionSourceEntry): boolean {
    const normalizedType = (source.missionType ?? "").toLocaleLowerCase();
    return normalizedType.includes("quest dokkan story");
}

function compareNavigationEntries(left: AcquisitionNavigationEntry, right: AcquisitionNavigationEntry): number {
    return left.target.kind.localeCompare(right.target.kind)
        || left.title.localeCompare(right.title)
        || left.sourceKey.localeCompare(right.sourceKey);
}

async function readJsonFile<T>(relativePath: string): Promise<T> {
    const filePath = resolve(__dirname, relativePath);
    const raw = await readFile(filePath, { encoding: "utf8" });
    return JSON.parse(raw) as T;
}
