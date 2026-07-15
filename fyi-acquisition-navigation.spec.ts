import { deepEqual, equal } from "assert";
import { buildAcquisitionNavigationDataset } from "./fyi-acquisition-navigation";

describe("buildAcquisitionNavigationDataset", () => {
    it("maps acquisition sources to stable app navigation targets", () => {
        const dataset = buildAcquisitionNavigationDataset({
            generatedAt: "2026-01-01T00:00:00.000Z",
            source: "dokkan.fyi",
            sourceCount: 5,
            rewardCount: 5,
            sources: [
                {
                    key: "dokkaninfo-event-reward:story:133:1330010:0:AwakeningItem:100001",
                    kind: "dokkaninfo-event-reward",
                    groupKey: "dokkaninfo-event:story:133",
                    groupKind: "dokkaninfo-event",
                    title: "Adventure of Gratitude",
                    eventType: "story",
                    eventId: "133",
                    eventStageId: "1330010",
                    sourcePath: "https://dokkaninfo.com/events/story/133/1330010",
                    rewards: [],
                    rewardCount: 0,
                },
                {
                    key: "event-mission:796:24832:1:11",
                    kind: "event-mission",
                    groupKey: "event-mission-category:796",
                    groupKind: "event-mission-category",
                    title: "Mission A",
                    missionCategoryId: "796",
                    missionId: "24832",
                    rewards: [],
                    rewardCount: 0,
                },
                {
                    key: "frontier-node-mission:2001:200101:20010102:32185:55289:1",
                    kind: "frontier-node-mission",
                    groupKey: "frontier-node:2001:20010102",
                    groupKind: "frontier-node",
                    title: "Node mission",
                    frontierChapterId: "2001",
                    frontierNodeId: "20010102",
                    missionId: "55289",
                    rewards: [],
                    rewardCount: 0,
                },
                {
                    key: "z-battle-level:205:205-normal:30:stone:11",
                    kind: "z-battle-level",
                    groupKey: "z-battle:205",
                    groupKind: "z-battle",
                    title: "Battle Lv. 30",
                    zBattleId: "205",
                    zBattlePhaseId: "205-normal",
                    level: 30,
                    rewards: [],
                    rewardCount: 0,
                },
                {
                    key: "awakening-medal-stage:100874:55001",
                    kind: "awakening-medal-stage",
                    groupKey: "awakening-stage-quest:4402",
                    groupKind: "awakening-stage-quest",
                    title: "Stage drop",
                    missionType: "Event",
                    stageId: "55001",
                    questId: "4402",
                    areaId: "440",
                    rewards: [],
                    rewardCount: 0,
                },
                {
                    key: "awakening-medal-baba-shop:19:26903003",
                    kind: "awakening-medal-baba-shop",
                    groupKey: "awakening-baba-shop:26903003",
                    groupKind: "awakening-baba-shop",
                    title: "Baba Shop",
                    saleId: "26903003",
                    rewards: [],
                    rewardCount: 0,
                },
            ],
        } as any);

        equal(dataset.sourceCount, 6);

        const dokkanInfoEvent = dataset.entries.find(entry => entry.sourceKind === "dokkaninfo-event-reward");
        const eventMission = dataset.entries.find(entry => entry.sourceKind === "event-mission");
        const frontierNodeMission = dataset.entries.find(entry => entry.sourceKind === "frontier-node-mission");
        const zBattleLevel = dataset.entries.find(entry => entry.sourceKind === "z-battle-level");
        const stage = dataset.entries.find(entry => entry.sourceKind === "awakening-medal-stage");
        const baba = dataset.entries.find(entry => entry.sourceKind === "awakening-medal-baba-shop");

        deepEqual(
            {
                eventMissionKey: eventMission?.target.missionKey,
                eventGroupKey: eventMission?.target.missionGroupKey,
                dokkanInfoEventKind: dokkanInfoEvent?.target.kind,
                dokkanInfoEventType: dokkanInfoEvent?.target.eventType,
                dokkanInfoEventId: dokkanInfoEvent?.target.eventId,
                dokkanInfoEventStageId: dokkanInfoEvent?.target.eventStageId,
                frontierMissionKey: frontierNodeMission?.target.missionKey,
                frontierGroupKey: frontierNodeMission?.target.missionGroupKey,
                zBattleKind: zBattleLevel?.target.kind,
                zBattleEntryKey: zBattleLevel?.target.stageEntryKey,
                zBattleLevel: zBattleLevel?.target.level,
                stageEntryKey: stage?.target.stageEntryKey,
                stageGroupKey: stage?.target.stageGroupKey,
                stageQuestId: stage?.target.questId,
                babaSaleId: baba?.target.saleId,
            },
            {
                eventMissionKey: "event:24832",
                eventGroupKey: "event-category:796",
                dokkanInfoEventKind: "dokkaninfo-event",
                dokkanInfoEventType: "story",
                dokkanInfoEventId: "133",
                dokkanInfoEventStageId: "1330010",
                frontierMissionKey: "frontier-node:55289",
                frontierGroupKey: "frontier-node:2001:20010102",
                zBattleKind: "stage-catalog-entry",
                zBattleEntryKey: "z-battle-level:205:205-normal:30",
                zBattleLevel: 30,
                stageEntryKey: "event-stage:55001",
                stageGroupKey: "event-area:440",
                stageQuestId: "4402",
                babaSaleId: "26903003",
            },
        );
    });
});
