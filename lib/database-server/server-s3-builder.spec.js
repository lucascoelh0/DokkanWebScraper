"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const server_s3_builder_1 = require("./server-s3-builder");
function observation() {
    const lineage = [
        { key: "events_e5", path: "e5", sha256: "a".repeat(64), sizeBytes: 1, authority: "sqlite_first_party", fetchedAt: null },
        { key: "events_e7", path: "e7", sha256: "b".repeat(64), sizeBytes: 1, authority: "community_shadow", fetchedAt: null },
        { key: "dokkaninfo_event_rewards", path: "rewards", sha256: "c".repeat(64), sizeBytes: 1, authority: "community_shadow", fetchedAt: "2026-07-23T00:00:00.000Z" },
        { key: "dokkaninfo_reward_parser", path: "parser", sha256: "d".repeat(64), sizeBytes: 1, authority: "repository_implementation", fetchedAt: null },
    ];
    const reward = (key, itemType, itemId, quantity, eventId, eventType, stageId) => ({ key, itemType, itemId, quantity, eventId, eventType, stageId });
    return {
        sourceSnapshotVersion: "snapshot", sourceLineage: lineage,
        questBossDrops: [
            { identity: { id: "10" }, mapId: "1001", reward: { item: { rawType: "Card", itemId: "100" }, quantity: null } },
            { identity: { id: "11" }, mapId: "1001", reward: { item: { rawType: "Card", itemId: "101" }, quantity: null } },
        ],
        questDropPreviewCount: 1,
        zFirstAnchors: [{ stageId: "5", level: 7, rewardSetId: "50" }],
        zFirstSets: [{ rewardSetId: "50", rewards: [{ sourceRowId: "500", value: { item: { rawType: "Point::Stone", itemId: "11" }, quantity: 1 } }] }],
        channelCounts: { questBossDrops: 2, zFirstRewards: 1, zNormalRewards: 1, missionRewards: 2, rankingRewards: 3 },
        remoteEvents: [
            { id: "1", type: "story", rewards: [
                    reward("dokkaninfo-event-reward:story:1:1001:10:Card:100", "Card", "100", 1, "1", "story", "1001"),
                    reward("dokkaninfo-event-reward:story:1:1001:11:Card:999", "Card", "999", 1, "1", "story", "1001"),
                    reward("dokkaninfo-event-reward:story:1:1001:99:Card:100", "Card", "100", 1, "1", "story", "1001"),
                ] },
            { id: "5", type: "zbattle", rewards: [reward("dokkaninfo-event-reward:zbattle:5:event:7:Point::Stone:11", "Point::Stone", "11", 1, "5", "zbattle")] },
        ],
        declaredRemoteRewardCount: 4,
    };
}
describe("server S3 reward identity", () => {
    it("is deterministic and accounts every remote row", () => {
        const first = (0, server_s3_builder_1.buildServerS3Dataset)(observation()), second = (0, server_s3_builder_1.buildServerS3Dataset)(observation());
        (0, assert_1.deepEqual)(first, second);
        (0, assert_1.equal)((0, server_s3_builder_1.validateServerS3Dataset)(first, 4, { ...observation().channelCounts, preview: 1 }).valid, true);
        (0, assert_1.equal)((0, server_s3_builder_1.buildServerS3Coverage)(first).normalizedRemoteRewardCount, 4);
    });
    it("keeps stage, reward-number and item matches as historical candidates", () => {
        const values = (0, server_s3_builder_1.buildServerS3Dataset)(observation()).assessments;
        (0, assert_1.equal)(values[0].classification, "partial_candidate");
        (0, assert_1.equal)(values[0].target?.itemComparison, "agreement");
        (0, assert_1.equal)(values[0].target?.quantityComparison, "not_comparable");
        (0, assert_1.equal)(values[1].classification, "partial_candidate");
        (0, assert_1.equal)(values[1].target?.itemComparison, "conflict");
        (0, assert_1.equal)(values[2].classification, "unjoinable");
    });
    it("keeps Z-Battle reward-level mapping partial", () => {
        const value = (0, server_s3_builder_1.buildServerS3Dataset)(observation()).assessments[3];
        (0, assert_1.equal)(value.classification, "partial_candidate");
        (0, assert_1.equal)(value.target?.firstPartyItem.itemType, "Point::Stone");
        (0, assert_1.equal)(value.boundary.includes("not_contractually_proven"), true);
    });
    it("rejects promotion of remote quantity or partial candidates", () => {
        const dataset = (0, server_s3_builder_1.buildServerS3Dataset)(observation());
        dataset.authorityPolicy.remoteQuantityPromotedWhenFirstPartyMissing = true;
        dataset.assessments[3].classification = "agreement";
        const validation = (0, server_s3_builder_1.validateServerS3Dataset)(dataset, 4, { ...observation().channelCounts, preview: 1 });
        (0, assert_1.equal)(validation.valid, false);
        (0, assert_1.equal)(validation.failures.includes("authority policy"), true);
        (0, assert_1.equal)(validation.failures.some(value => value.includes("legacy identity origin cannot support agreement")), true);
    });
    it("requires unique complete source lineage and exact accounting", () => {
        const dataset = (0, server_s3_builder_1.buildServerS3Dataset)(observation());
        dataset.sourceLineage[1] = { ...dataset.sourceLineage[0] };
        const validation = (0, server_s3_builder_1.validateServerS3Dataset)(dataset, 5, { ...observation().channelCounts, preview: 1 });
        (0, assert_1.equal)(validation.valid, false);
        (0, assert_1.equal)(validation.failures.includes("source lineage"), true);
        (0, assert_1.equal)(validation.failures.includes("normalized artifact accounting"), true);
    });
    it("rejects Z-Battle promotion, unknown classifications and channel drift", () => {
        const dataset = (0, server_s3_builder_1.buildServerS3Dataset)(observation());
        dataset.assessments[3].classification = "agreement";
        dataset.assessments[2].classification = "invented";
        dataset.channels.find(value => value.channel === "mission").semanticStatus = "partial";
        const validation = (0, server_s3_builder_1.validateServerS3Dataset)(dataset, 4, { ...observation().channelCounts, preview: 1 });
        (0, assert_1.equal)(validation.valid, false);
        (0, assert_1.equal)(validation.exclusiveClassifications, false);
        (0, assert_1.equal)(validation.failures.some(value => value.includes("legacy identity origin cannot support agreement")), true);
        (0, assert_1.equal)(validation.failures.includes("unknown reward semantics promoted"), true);
    });
});
//# sourceMappingURL=server-s3-builder.spec.js.map