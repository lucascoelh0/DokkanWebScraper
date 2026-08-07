import { deepEqual, equal } from "assert";
import { buildServerS3Coverage, buildServerS3Dataset, validateServerS3Dataset } from "./server-s3-builder";
import { ServerS3Observation } from "./server-s3-contract";

function observation(): ServerS3Observation {
    const lineage: ServerS3Observation["sourceLineage"] = [
        { key: "events_e5", path: "e5", sha256: "a".repeat(64), sizeBytes: 1, authority: "sqlite_first_party", fetchedAt: null },
        { key: "events_e7", path: "e7", sha256: "b".repeat(64), sizeBytes: 1, authority: "community_shadow", fetchedAt: null },
        { key: "dokkaninfo_event_rewards", path: "rewards", sha256: "c".repeat(64), sizeBytes: 1, authority: "community_shadow", fetchedAt: "2026-07-23T00:00:00.000Z" },
        { key: "dokkaninfo_reward_parser", path: "parser", sha256: "d".repeat(64), sizeBytes: 1, authority: "repository_implementation", fetchedAt: null },
    ];
    const reward = (key: string, itemType: string, itemId: string, quantity: number, eventId: string, eventType: string, stageId?: string) => ({ key, itemType, itemId, quantity, eventId, eventType, stageId });
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
        const first = buildServerS3Dataset(observation()), second = buildServerS3Dataset(observation());
        deepEqual(first, second);
        equal(validateServerS3Dataset(first, 4, { ...observation().channelCounts, preview: 1 }).valid, true);
        equal(buildServerS3Coverage(first).normalizedRemoteRewardCount, 4);
    });

    it("keeps stage, reward-number and item matches as historical candidates", () => {
        const values = buildServerS3Dataset(observation()).assessments;
        equal(values[0].classification, "partial_candidate");
        equal(values[0].target?.itemComparison, "agreement");
        equal(values[0].target?.quantityComparison, "not_comparable");
        equal(values[1].classification, "partial_candidate");
        equal(values[1].target?.itemComparison, "conflict");
        equal(values[2].classification, "unjoinable");
    });

    it("keeps Z-Battle reward-level mapping partial", () => {
        const value = buildServerS3Dataset(observation()).assessments[3];
        equal(value.classification, "partial_candidate");
        equal(value.target?.firstPartyItem.itemType, "Point::Stone");
        equal(value.boundary.includes("not_contractually_proven"), true);
    });

    it("rejects promotion of remote quantity or partial candidates", () => {
        const dataset = buildServerS3Dataset(observation());
        (dataset.authorityPolicy as any).remoteQuantityPromotedWhenFirstPartyMissing = true;
        dataset.assessments[3].classification = "agreement";
        const validation = validateServerS3Dataset(dataset, 4, { ...observation().channelCounts, preview: 1 });
        equal(validation.valid, false);
        equal(validation.failures.includes("authority policy"), true);
        equal(validation.failures.some(value => value.includes("legacy identity origin cannot support agreement")), true);
    });

    it("requires unique complete source lineage and exact accounting", () => {
        const dataset = buildServerS3Dataset(observation());
        dataset.sourceLineage[1] = { ...dataset.sourceLineage[0] };
        const validation = validateServerS3Dataset(dataset, 5, { ...observation().channelCounts, preview: 1 });
        equal(validation.valid, false);
        equal(validation.failures.includes("source lineage"), true);
        equal(validation.failures.includes("normalized artifact accounting"), true);
    });

    it("rejects Z-Battle promotion, unknown classifications and channel drift", () => {
        const dataset = buildServerS3Dataset(observation());
        dataset.assessments[3].classification = "agreement";
        (dataset.assessments[2] as any).classification = "invented";
        dataset.channels.find(value => value.channel === "mission")!.semanticStatus = "partial";
        const validation = validateServerS3Dataset(dataset, 4, { ...observation().channelCounts, preview: 1 });
        equal(validation.valid, false);
        equal(validation.exclusiveClassifications, false);
        equal(validation.failures.some(value => value.includes("legacy identity origin cannot support agreement")), true);
        equal(validation.failures.includes("unknown reward semantics promoted"), true);
    });
});
