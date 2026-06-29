"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildStageCatalog = exports.writeDokkanFyiStageCatalog = exports.getDokkanFyiStageCatalog = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
const format_json_1 = require("./format-json");
const DOKKAN_FYI_BASE_URL = "https://dokkan.fyi";
async function getDokkanFyiStageCatalog() {
    const [questStory, eventStages, zBattles] = await Promise.all([
        readJsonFile("data/stages/latest/quest-story-stages.json"),
        readJsonFile("data/stages/latest/event-stages.json"),
        readJsonFile("data/z-battles/latest/z-battles.json"),
    ]);
    return buildStageCatalog({
        questStory,
        eventStages,
        zBattles,
    });
}
exports.getDokkanFyiStageCatalog = getDokkanFyiStageCatalog;
async function writeDokkanFyiStageCatalog() {
    const dataset = await getDokkanFyiStageCatalog();
    const outputDir = (0, path_1.resolve)(__dirname, "data/stage-catalog/latest");
    const outputPath = (0, path_1.resolve)(outputDir, "stage-catalog.json");
    await (0, promises_1.mkdir)(outputDir, { recursive: true });
    await (0, format_json_1.writeFormattedJson)(outputPath, dataset);
    return outputPath;
}
exports.writeDokkanFyiStageCatalog = writeDokkanFyiStageCatalog;
function buildStageCatalog(input) {
    const groups = [];
    const entries = [];
    for (const chapter of input.questStory.chapters) {
        const chapterGroupKey = questStoryChapterGroupKey(chapter.id);
        groups.push({
            key: chapterGroupKey,
            kind: "quest-story-chapter",
            id: chapter.id,
            title: chapter.name,
            sourcePath: `${DOKKAN_FYI_BASE_URL}/stages/quest-dokkan-story`,
        });
        for (const area of chapter.areas) {
            const areaGroupKey = questStoryAreaGroupKey(area.id);
            groups.push({
                key: areaGroupKey,
                kind: "quest-story-area",
                id: area.id,
                title: area.name,
                parentGroupKey: chapterGroupKey,
                sourcePath: `${DOKKAN_FYI_BASE_URL}/stages/quest-dokkan-story`,
                imageUrl: area.images.bannerUrl || area.images.headerUrl || area.images.buttonUrl,
                areaType: area.type,
                chapter: area.chapter,
            });
            pushStageEntries(entries, chapter, area, areaGroupKey, "quest-stage");
        }
    }
    for (const area of input.eventStages.areas) {
        const areaGroupKey = eventAreaGroupKey(area.id);
        groups.push({
            key: areaGroupKey,
            kind: "event-area",
            id: area.id,
            title: area.name,
            sourcePath: `${DOKKAN_FYI_BASE_URL}/stages/events`,
            imageUrl: area.images.bannerUrl || area.images.headerUrl || area.images.buttonUrl,
            areaType: area.type,
            chapter: area.chapter,
        });
        pushStageEntries(entries, undefined, area, areaGroupKey, "event-stage");
    }
    for (const battle of input.zBattles.battles) {
        const battleGroupKey = zBattleGroupKey(battle.id);
        groups.push({
            key: battleGroupKey,
            kind: "z-battle",
            id: battle.id,
            title: battle.name,
            sourcePath: battle.sourceUrl,
            imageUrl: battle.phases[0]?.images.bannerUrl || battle.phases[0]?.images.buttonUrl,
            zBattleId: battle.id,
            hasSuperStage: battle.hasSuperStage,
        });
        for (const phase of battle.phases) {
            for (const level of phase.levels) {
                entries.push({
                    key: `z-battle-level:${battle.id}:${phase.id}:${level.level}`,
                    kind: "z-battle-level",
                    groupKey: battleGroupKey,
                    id: `${battle.id}:${phase.id}:${level.level}`,
                    title: battle.name,
                    subtitle: `Lv. ${level.level}`,
                    sourcePath: battle.sourceUrl,
                    imageUrl: phase.images.bannerUrl || phase.images.buttonUrl,
                    zBattleId: battle.id,
                    zBattlePhaseId: phase.id,
                    zBattlePhaseKind: phase.kind,
                    level: level.level,
                    zeni: level.firstRewards.find(reward => reward.itemType === "Zeni")?.zeni,
                });
            }
            for (const checkpoint of phase.rewardCheckpoints) {
                entries.push(mapCheckpointEntry(battle, phase, battleGroupKey, checkpoint));
            }
        }
    }
    return {
        generatedAt: new Date().toISOString(),
        source: "dokkan.fyi",
        groupCount: groups.length,
        entryCount: entries.length,
        groups: [...groups].sort(compareGroups),
        entries: [...entries].sort(compareEntries),
    };
}
exports.buildStageCatalog = buildStageCatalog;
function pushStageEntries(entries, chapter, area, groupKey, kind) {
    for (const quest of area.quests) {
        for (const stage of quest.stages) {
            entries.push(mapStageDifficultyEntry(chapter, area, quest, stage, groupKey, kind));
        }
    }
}
function mapStageDifficultyEntry(chapter, area, quest, stage, groupKey, kind) {
    return {
        key: `${kind}:${stage.id}`,
        kind,
        groupKey,
        id: stage.id,
        title: quest.name,
        subtitle: stage.difficulty,
        sourcePath: kind === "quest-stage"
            ? `${DOKKAN_FYI_BASE_URL}/stages/quest-dokkan-story`
            : `${DOKKAN_FYI_BASE_URL}/stages/events`,
        imageUrl: area.images.bannerUrl || area.images.headerUrl || area.images.buttonUrl,
        chapterId: chapter?.id,
        areaId: area.id,
        questId: quest.id,
        difficulty: stage.difficulty,
        stamina: stage.stamina,
        requiredKeys: stage.requiredKeys,
        rankExp: stage.rankExp,
        zeni: stage.zeni,
        linkSkillLevelUpRate: stage.linkSkillLevelUpRate,
    };
}
function mapCheckpointEntry(battle, phase, groupKey, checkpoint) {
    return {
        key: `z-battle-checkpoint:${battle.id}:${phase.id}:${checkpoint.level}`,
        kind: "z-battle-checkpoint",
        groupKey,
        id: `${battle.id}:${phase.id}:checkpoint:${checkpoint.level}`,
        title: `${battle.name} reward checkpoint`,
        subtitle: `Lv. ${checkpoint.level}`,
        sourcePath: battle.sourceUrl,
        imageUrl: phase.images.bannerUrl || phase.images.buttonUrl,
        zBattleId: battle.id,
        zBattlePhaseId: phase.id,
        zBattlePhaseKind: phase.kind,
        checkpointLevel: checkpoint.level,
    };
}
function questStoryChapterGroupKey(chapterId) {
    return `quest-story-chapter:${chapterId}`;
}
function questStoryAreaGroupKey(areaId) {
    return `quest-story-area:${areaId}`;
}
function eventAreaGroupKey(areaId) {
    return `event-area:${areaId}`;
}
function zBattleGroupKey(battleId) {
    return `z-battle:${battleId}`;
}
function compareGroups(left, right) {
    return left.kind.localeCompare(right.kind)
        || left.title.localeCompare(right.title)
        || left.id.localeCompare(right.id);
}
function compareEntries(left, right) {
    return left.groupKey.localeCompare(right.groupKey)
        || (left.level ?? left.checkpointLevel ?? 0) - (right.level ?? right.checkpointLevel ?? 0)
        || left.title.localeCompare(right.title)
        || left.key.localeCompare(right.key);
}
async function readJsonFile(relativePath) {
    const filePath = (0, path_1.resolve)(__dirname, relativePath);
    const raw = await (0, promises_1.readFile)(filePath, { encoding: "utf8" });
    return JSON.parse(raw);
}
//# sourceMappingURL=fyi-stage-catalog.js.map