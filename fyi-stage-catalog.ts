import { mkdir, readFile } from "fs/promises";
import { resolve } from "path";
import { writeFormattedJson } from "./format-json";
import { EventStagesDataset, QuestStoryStagesDataset, StageArea, StageChapter, StageDifficulty, StageQuest } from "./stage";
import { StageCatalogDataset, StageCatalogEntry, StageCatalogGroup } from "./stage-catalog";
import { ZBattle, ZBattleDataset, ZBattlePhase, ZBattleRewardCheckpoint } from "./z-battle";

interface StageCatalogBuildInput {
    questStory: QuestStoryStagesDataset,
    eventStages: EventStagesDataset,
    zBattles: ZBattleDataset,
}

const DOKKAN_FYI_BASE_URL = "https://dokkan.fyi";

export async function getDokkanFyiStageCatalog(): Promise<StageCatalogDataset> {
    const [questStory, eventStages, zBattles] = await Promise.all([
        readJsonFile<QuestStoryStagesDataset>("data/stages/latest/quest-story-stages.json"),
        readJsonFile<EventStagesDataset>("data/stages/latest/event-stages.json"),
        readJsonFile<ZBattleDataset>("data/z-battles/latest/z-battles.json"),
    ]);

    return buildStageCatalog({
        questStory,
        eventStages,
        zBattles,
    });
}

export async function writeDokkanFyiStageCatalog(): Promise<string> {
    const dataset = await getDokkanFyiStageCatalog();
    const outputDir = resolve(__dirname, "data/stage-catalog/latest");
    const outputPath = resolve(outputDir, "stage-catalog.json");

    await mkdir(outputDir, { recursive: true });
    await writeFormattedJson(outputPath, dataset);

    return outputPath;
}

export function buildStageCatalog(input: StageCatalogBuildInput): StageCatalogDataset {
    const groups: StageCatalogGroup[] = [];
    const entries: StageCatalogEntry[] = [];

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

function pushStageEntries(
    entries: StageCatalogEntry[],
    chapter: StageChapter | undefined,
    area: StageArea,
    groupKey: string,
    kind: "quest-stage" | "event-stage",
) {
    for (const quest of area.quests) {
        for (const stage of quest.stages) {
            entries.push(mapStageDifficultyEntry(chapter, area, quest, stage, groupKey, kind));
        }
    }
}

function mapStageDifficultyEntry(
    chapter: StageChapter | undefined,
    area: StageArea,
    quest: StageQuest,
    stage: StageDifficulty,
    groupKey: string,
    kind: "quest-stage" | "event-stage",
): StageCatalogEntry {
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

function mapCheckpointEntry(
    battle: ZBattle,
    phase: ZBattlePhase,
    groupKey: string,
    checkpoint: ZBattleRewardCheckpoint,
): StageCatalogEntry {
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

function questStoryChapterGroupKey(chapterId: string): string {
    return `quest-story-chapter:${chapterId}`;
}

function questStoryAreaGroupKey(areaId: string): string {
    return `quest-story-area:${areaId}`;
}

function eventAreaGroupKey(areaId: string): string {
    return `event-area:${areaId}`;
}

function zBattleGroupKey(battleId: string): string {
    return `z-battle:${battleId}`;
}

function compareGroups(left: StageCatalogGroup, right: StageCatalogGroup): number {
    return left.kind.localeCompare(right.kind)
        || left.title.localeCompare(right.title)
        || left.id.localeCompare(right.id);
}

function compareEntries(left: StageCatalogEntry, right: StageCatalogEntry): number {
    return left.groupKey.localeCompare(right.groupKey)
        || (left.level ?? left.checkpointLevel ?? 0) - (right.level ?? right.checkpointLevel ?? 0)
        || left.title.localeCompare(right.title)
        || left.key.localeCompare(right.key);
}

async function readJsonFile<T>(relativePath: string): Promise<T> {
    const filePath = resolve(__dirname, relativePath);
    const raw = await readFile(filePath, { encoding: "utf8" });
    return JSON.parse(raw) as T;
}
