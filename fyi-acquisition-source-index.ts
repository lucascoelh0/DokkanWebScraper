import { mkdir, readFile } from "fs/promises";
import { resolve } from "path";
import { AcquisitionDataset, AcquisitionItem, AcquisitionSource } from "./acquisition";
import { AcquisitionSourceEntry, AcquisitionSourceGroupKind, AcquisitionSourceIndexDataset, AcquisitionSourceRewardRef } from "./acquisition-source-index";
import { writeFormattedJson } from "./format-json";

interface AcquisitionSourceEntryBuilder extends AcquisitionSourceEntry {}

export async function getDokkanFyiAcquisitionSourceIndex(): Promise<AcquisitionSourceIndexDataset> {
    const acquisition = await readJsonFile<AcquisitionDataset>("data/acquisition/latest/acquisition.json");
    return buildAcquisitionSourceIndex(acquisition);
}

export async function writeDokkanFyiAcquisitionSourceIndex(): Promise<string> {
    const dataset = await getDokkanFyiAcquisitionSourceIndex();
    const outputDir = resolve(__dirname, "data/acquisition/latest");
    const outputPath = resolve(outputDir, "acquisition-source-index.json");

    await mkdir(outputDir, { recursive: true });
    await writeFormattedJson(outputPath, dataset);

    return outputPath;
}

export function buildAcquisitionSourceIndex(acquisition: AcquisitionDataset): AcquisitionSourceIndexDataset {
    const sourcesByKey = new Map<string, AcquisitionSourceEntryBuilder>();

    for (const item of acquisition.items) {
        for (const source of item.sources) {
            const reward = mapRewardRef(item, source);
            const existing = sourcesByKey.get(source.key);

            if (existing) {
                existing.rewards.push(reward);
                existing.rewardCount += 1;
                continue;
            }

            sourcesByKey.set(source.key, {
                ...source,
                ...deriveSourceGrouping(source),
                rewardCount: 1,
                rewards: [reward],
            });
        }
    }

    const sources = [...sourcesByKey.values()]
        .map(source => ({
            ...source,
            rewards: [...source.rewards].sort(compareRewards),
        }))
        .sort(compareSources);

    return {
        generatedAt: new Date().toISOString(),
        source: "dokkan.fyi",
        sourceCount: sources.length,
        rewardCount: sources.reduce((sum, source) => sum + source.rewardCount, 0),
        sources,
    };
}

function mapRewardRef(item: AcquisitionItem, source: AcquisitionSource): AcquisitionSourceRewardRef {
    return {
        key: item.key,
        itemType: item.itemType,
        itemId: item.itemId,
        name: item.name,
        description: item.description,
        rarity: item.rarity,
        zeni: item.zeni,
        tradePoints: item.tradePoints,
        cardId: item.cardId,
        step: item.step,
        linkTo: item.linkTo,
        bgmId: item.bgmId,
        quantity: source.quantity,
    };
}

function deriveSourceGrouping(source: AcquisitionSource): {
    groupKey: string,
    groupKind: AcquisitionSourceGroupKind,
} {
    if (source.kind === "event-mission" && source.missionCategoryId) {
        return {
            groupKey: `event-mission-category:${source.missionCategoryId}`,
            groupKind: "event-mission-category",
        };
    }

    if (source.kind === "frontier-node-mission" && source.frontierChapterId && source.frontierNodeId) {
        return {
            groupKey: `frontier-node:${source.frontierChapterId}:${source.frontierNodeId}`,
            groupKind: "frontier-node",
        };
    }

    if (source.kind === "frontier-chapter-mission" && source.frontierChapterId) {
        return {
            groupKey: `frontier-chapter:${source.frontierChapterId}`,
            groupKind: "frontier-chapter",
        };
    }

    if ((source.kind === "z-battle-level" || source.kind === "z-battle-checkpoint" || source.kind === "awakening-medal-z-battle") && source.zBattleId) {
        return {
            groupKey: `z-battle:${source.zBattleId}`,
            groupKind: "z-battle",
        };
    }

    if (source.kind === "awakening-medal-stage" && source.questId) {
        return {
            groupKey: `awakening-stage-quest:${source.questId}`,
            groupKind: "awakening-stage-quest",
        };
    }

    if (source.kind === "awakening-medal-stage" && source.areaId) {
        return {
            groupKey: `awakening-stage-area:${source.areaId}`,
            groupKind: "awakening-stage-area",
        };
    }

    if (source.kind === "awakening-medal-baba-shop" && source.saleId) {
        return {
            groupKey: `awakening-baba-shop:${source.saleId}`,
            groupKind: "awakening-baba-shop",
        };
    }

    if (source.kind === "awakening-medal-world-tournament" && source.tournamentId) {
        return {
            groupKey: `awakening-world-tournament:${source.tournamentId}`,
            groupKind: "awakening-world-tournament",
        };
    }

    if (source.kind === "dokkaninfo-event-reward" && source.eventType && source.eventId) {
        return {
            groupKey: `dokkaninfo-event:${source.eventType}:${source.eventId}`,
            groupKind: "dokkaninfo-event",
        };
    }

    return {
        groupKey: source.key,
        groupKind: "standalone",
    };
}

function compareSources(left: AcquisitionSourceEntry, right: AcquisitionSourceEntry): number {
    return left.groupKind.localeCompare(right.groupKind)
        || left.groupKey.localeCompare(right.groupKey)
        || left.kind.localeCompare(right.kind)
        || left.key.localeCompare(right.key);
}

function compareRewards(left: AcquisitionSourceRewardRef, right: AcquisitionSourceRewardRef): number {
    return (left.name || "").localeCompare(right.name || "")
        || left.key.localeCompare(right.key);
}

async function readJsonFile<T>(relativePath: string): Promise<T> {
    const filePath = resolve(__dirname, relativePath);
    const raw = await readFile(filePath, { encoding: "utf8" });
    return JSON.parse(raw) as T;
}
