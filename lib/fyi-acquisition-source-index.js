"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildAcquisitionSourceIndex = exports.writeDokkanFyiAcquisitionSourceIndex = exports.getDokkanFyiAcquisitionSourceIndex = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
const format_json_1 = require("./format-json");
async function getDokkanFyiAcquisitionSourceIndex() {
    const acquisition = await readJsonFile("data/acquisition/latest/acquisition.json");
    return buildAcquisitionSourceIndex(acquisition);
}
exports.getDokkanFyiAcquisitionSourceIndex = getDokkanFyiAcquisitionSourceIndex;
async function writeDokkanFyiAcquisitionSourceIndex() {
    const dataset = await getDokkanFyiAcquisitionSourceIndex();
    const outputDir = (0, path_1.resolve)(__dirname, "data/acquisition/latest");
    const outputPath = (0, path_1.resolve)(outputDir, "acquisition-source-index.json");
    await (0, promises_1.mkdir)(outputDir, { recursive: true });
    await (0, format_json_1.writeFormattedJson)(outputPath, dataset);
    return outputPath;
}
exports.writeDokkanFyiAcquisitionSourceIndex = writeDokkanFyiAcquisitionSourceIndex;
function buildAcquisitionSourceIndex(acquisition) {
    const sourcesByKey = new Map();
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
exports.buildAcquisitionSourceIndex = buildAcquisitionSourceIndex;
function mapRewardRef(item, source) {
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
function deriveSourceGrouping(source) {
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
    return {
        groupKey: source.key,
        groupKind: "standalone",
    };
}
function compareSources(left, right) {
    return left.groupKind.localeCompare(right.groupKind)
        || left.groupKey.localeCompare(right.groupKey)
        || left.kind.localeCompare(right.kind)
        || left.key.localeCompare(right.key);
}
function compareRewards(left, right) {
    return (left.name || "").localeCompare(right.name || "")
        || left.key.localeCompare(right.key);
}
async function readJsonFile(relativePath) {
    const filePath = (0, path_1.resolve)(__dirname, relativePath);
    const raw = await (0, promises_1.readFile)(filePath, { encoding: "utf8" });
    return JSON.parse(raw);
}
//# sourceMappingURL=fyi-acquisition-source-index.js.map