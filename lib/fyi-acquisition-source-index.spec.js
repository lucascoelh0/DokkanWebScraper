"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const fyi_acquisition_source_index_1 = require("./fyi-acquisition-source-index");
describe("buildAcquisitionSourceIndex", () => {
    it("inverts acquisition into a source-centric view with stable grouping keys", () => {
        const dataset = (0, fyi_acquisition_source_index_1.buildAcquisitionSourceIndex)({
            generatedAt: "2026-01-01T00:00:00.000Z",
            source: "dokkan.fyi",
            itemCount: 3,
            sourceCount: 4,
            items: [
                {
                    key: "Point::Stone:11",
                    itemType: "Point::Stone",
                    itemId: "11",
                    rewardType: undefined,
                    sources: [
                        {
                            key: "event-mission:796:24832:1:11",
                            kind: "event-mission",
                            title: "Mission A",
                            missionCategoryId: "796",
                            missionId: "24832",
                            quantity: 2,
                        },
                        {
                            key: "frontier-chapter-mission:2001:33000:33001:11",
                            kind: "frontier-chapter-mission",
                            title: "Clear Planet Namek Saga.",
                            frontierChapterId: "2001",
                            frontierSeriesId: "2",
                            quantity: 3,
                        },
                    ],
                },
                {
                    key: "CardSkinItem:1:1029571:1:internal:OriginMapScene?episode=2001&battle=20010102",
                    itemType: "CardSkinItem",
                    itemId: "1",
                    cardId: "1029571",
                    step: 1,
                    linkTo: "internal:OriginMapScene?episode=2001&battle=20010102",
                    sources: [
                        {
                            key: "frontier-node-mission:2001:200101:20010102:32185:55289:1",
                            kind: "frontier-node-mission",
                            title: "Activate the specified character's Active Skill and clear Node 2.",
                            frontierChapterId: "2001",
                            frontierPageId: "200101",
                            frontierNodeId: "20010102",
                            quantity: 1,
                        },
                    ],
                },
                {
                    key: "AwakeningMedal:100874",
                    itemType: "AwakeningMedal",
                    itemId: "100874",
                    name: "Trunks Medal",
                    sources: [
                        {
                            key: "awakening-medal-z-battle:100874:67",
                            kind: "awakening-medal-z-battle",
                            title: "Trunks Medal",
                            zBattleId: "67",
                            quantity: 1,
                        },
                    ],
                },
            ],
        });
        (0, assert_1.equal)(dataset.sourceCount, 4);
        (0, assert_1.equal)(dataset.rewardCount, 4);
        const eventMission = dataset.sources.find(source => source.key === "event-mission:796:24832:1:11");
        const frontierChapter = dataset.sources.find(source => source.key === "frontier-chapter-mission:2001:33000:33001:11");
        const frontierNode = dataset.sources.find(source => source.kind === "frontier-node-mission");
        const zBattle = dataset.sources.find(source => source.kind === "awakening-medal-z-battle");
        (0, assert_1.deepEqual)({
            eventGroup: eventMission?.groupKey,
            frontierChapterGroup: frontierChapter?.groupKey,
            frontierNodeGroup: frontierNode?.groupKey,
            zBattleGroup: zBattle?.groupKey,
        }, {
            eventGroup: "event-mission-category:796",
            frontierChapterGroup: "frontier-chapter:2001",
            frontierNodeGroup: "frontier-node:2001:20010102",
            zBattleGroup: "z-battle:67",
        });
        (0, assert_1.equal)(frontierNode?.rewards[0].itemType, "CardSkinItem");
        (0, assert_1.equal)(frontierNode?.rewards[0].cardId, "1029571");
    });
});
//# sourceMappingURL=fyi-acquisition-source-index.spec.js.map