"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateServerS3Dataset = exports.buildServerS3Coverage = exports.buildServerS3Dataset = void 0;
function remoteRewardId(event, reward) {
    const stage = reward.stageId ?? "event";
    const prefix = `dokkaninfo-event-reward:${event.type}:${event.id}:${stage}:`;
    const suffix = `:${reward.itemType}:${reward.itemId}`;
    if (!reward.key.startsWith(prefix) || !reward.key.endsWith(suffix))
        return null;
    const value = reward.key.slice(prefix.length, -suffix.length);
    return /^\d+$/.test(value) ? value : null;
}
function item(rawType, itemId, quantity) {
    return { itemType: rawType, itemId: String(itemId), quantity };
}
function buildServerS3Dataset(observation) {
    const bossById = new Map(observation.questBossDrops.map(value => [value.identity.id, value]));
    const anchors = new Map(observation.zFirstAnchors.map(value => [`${value.stageId}:${value.level}`, value]));
    const sets = new Map(observation.zFirstSets.map(value => [value.rewardSetId, value.rewards]));
    const assessments = [];
    for (const event of observation.remoteEvents)
        for (const reward of event.rewards) {
            const parsedId = remoteRewardId(event, reward);
            const remoteItem = item(reward.itemType, reward.itemId, reward.quantity);
            const base = { remoteKey: reward.key, eventId: String(event.id), eventType: event.type, stageId: reward.stageId ? String(reward.stageId) : null, remoteRewardId: parsedId ?? "", remoteItem };
            if (!parsedId || reward.eventId !== event.id || reward.eventType !== event.type) {
                assessments.push({ ...base, classification: "unjoinable", rewardChannel: "unknown", target: null, boundary: "remote_key_or_parent_identity_invalid" });
                continue;
            }
            if (event.type !== "zbattle") {
                const target = bossById.get(parsedId);
                if (!target || !reward.stageId || target.mapId !== reward.stageId) {
                    assessments.push({ ...base, classification: "unjoinable", rewardChannel: "unknown", target: null, boundary: "no_quest_boss_drop_with_same_reward_row_id_and_stage_id" });
                    continue;
                }
                const firstPartyItem = item(target.reward.item.rawType, target.reward.item.itemId, target.reward.quantity);
                const sameItem = firstPartyItem.itemType === remoteItem.itemType && firstPartyItem.itemId === remoteItem.itemId;
                assessments.push({
                    ...base,
                    classification: "partial_candidate",
                    rewardChannel: "drop_candidate",
                    target: { family: "quest_boss_drop", sourceRowId: target.identity.id, parentId: target.mapId, parentLevel: null, firstPartyItem, itemComparison: sameItem ? "agreement" : "conflict", quantityComparison: "not_comparable" },
                    boundary: sameItem ? "stage_candidate_reward_number_and_item_identity_agree_but_legacy_key_does_not_distinguish_payload_id_from_synthetic_index" : "stage_candidate_and_reward_number_align_but_item_identity_conflicts; legacy_key_origin_is_unknown_and_sqlite_remains_authority",
                });
                continue;
            }
            const anchor = anchors.get(`${event.id}:${parsedId}`);
            if (!anchor) {
                assessments.push({ ...base, classification: "unjoinable", rewardChannel: "unknown", target: null, boundary: "no_z_first_reward_anchor_for_event_id_and_remote_reward_id" });
                continue;
            }
            const candidates = (sets.get(anchor.rewardSetId) ?? []).filter(value => value.value.item.rawType === remoteItem.itemType && value.value.item.itemId === remoteItem.itemId);
            if (candidates.length !== 1) {
                assessments.push({ ...base, classification: "unjoinable", rewardChannel: "first_clear_candidate", target: null, boundary: "z_event_and_remote_reward_id_locate_candidate_level_but_item_identity_is_not_unique_or_present" });
                continue;
            }
            const candidate = candidates[0], firstPartyItem = item(candidate.value.item.rawType, candidate.value.item.itemId, candidate.value.quantity);
            assessments.push({
                ...base,
                classification: "partial_candidate",
                rewardChannel: "first_clear_candidate",
                target: { family: "z_battle_first_reward", sourceRowId: candidate.sourceRowId, parentId: anchor.stageId, parentLevel: anchor.level, firstPartyItem, itemComparison: "agreement", quantityComparison: firstPartyItem.quantity === remoteItem.quantity ? "agreement" : "conflict" },
                boundary: "item_identity_is_unique_within_the_candidate_first_reward_set_but_remote_payload_id_as_level_is_not_contractually_proven",
            });
        }
    const c = observation.channelCounts;
    return {
        schemaVersion: 1,
        contract: "dokkan-server-reward-identity",
        contractVersion: "0.4.0",
        generatedAt: "2026-08-07T00:00:00.000Z",
        generatedAtPolicy: "pinned_to_static_evidence_checkpoint",
        sourceSnapshotVersion: observation.sourceSnapshotVersion,
        collectionMode: "local_validated_artifacts_no_network",
        authorityPolicy: { staticRewardIdentity: "sqlite_first_party", remoteRows: "community_shadow", structuralIdsOnly: true, titleJoinAllowed: false, remoteQuantityPromotedWhenFirstPartyMissing: false, chanceOrRepeatabilityInferred: false, legacyRewardIdentityOrigin: "unknown_payload_id_or_synthetic_index", normalizedRowCollisionStatus: "unknown", normalizedRowsLossless: false },
        sourceLineage: observation.sourceLineage,
        channels: [
            { channel: "preview", rowCount: observation.questDropPreviewCount, identityStatus: "partial", semanticStatus: "partial", sources: ["quest_drop_rewards"], boundary: "item_slots_only; quantity_chance_condition_and_repeatability_absent" },
            { channel: "drop", rowCount: c.questBossDrops + c.zNormalRewards, identityStatus: "supported", semanticStatus: "partial", sources: ["quest_boss_drops", "z_battle_normal_rewards"], boundary: "quest boss row identity is supported; z-normal runtime/repeatability semantics remain unknown" },
            { channel: "first_clear", rowCount: c.zFirstRewards, identityStatus: "supported", semanticStatus: "partial", sources: ["z_battle_first_rewards"], boundary: "first-reward grouping is structural; runtime claim frequency remains unverified" },
            { channel: "mission", rowCount: c.missionRewards, identityStatus: "supported", semanticStatus: "supported", sources: ["mission_rewards", "budokai_mission_rewards", "rmbattle_mission_rewards"], boundary: "reward rows join mission IDs; current server grant/claim state is not represented" },
            { channel: "ranking", rowCount: c.rankingRewards, identityStatus: "supported", semanticStatus: "supported", sources: ["budokai_ranking_gifts", "budokai_box_ranking_rewards"], boundary: "static ranking ranges and gifts only; current tournament/rank state is absent" },
            { channel: "server_grant", rowCount: 0, identityStatus: "unknown", semanticStatus: "unknown", sources: [], boundary: "no read-only server grant payload collected; action-shaped accept endpoints remain prohibited" },
        ],
        assessments,
    };
}
exports.buildServerS3Dataset = buildServerS3Dataset;
function buildServerS3Coverage(dataset) {
    const classes = ["agreement", "confirmed_conflict", "partial_candidate", "unjoinable"];
    const byClassification = Object.fromEntries(classes.map(classification => [classification, dataset.assessments.filter(value => value.classification === classification).length]));
    const byEventType = {};
    for (const value of dataset.assessments) {
        const row = byEventType[value.eventType] ?? { total: 0, agreement: 0, confirmedConflict: 0, partialCandidate: 0, unjoinable: 0 };
        row.total++;
        if (value.classification === "agreement")
            row.agreement++;
        else if (value.classification === "confirmed_conflict")
            row.confirmedConflict++;
        else if (value.classification === "partial_candidate")
            row.partialCandidate++;
        else
            row.unjoinable++;
        byEventType[value.eventType] = row;
    }
    const candidates = dataset.assessments.filter(value => value.classification === "partial_candidate");
    const zCandidates = candidates.filter(value => value.target?.family === "z_battle_first_reward");
    return {
        schemaVersion: 1,
        normalizedRemoteRewardCount: dataset.assessments.length,
        rawRemoteRewardCount: null,
        possibleCollisionCount: null,
        byClassification,
        byEventType: Object.fromEntries(Object.entries(byEventType).sort(([left], [right]) => left.localeCompare(right))),
        supportedQuestDropJoinCount: 0,
        traditionalCandidateCount: candidates.filter(value => value.target?.family === "quest_boss_drop").length,
        traditionalCandidateItemAgreementCount: candidates.filter(value => value.target?.family === "quest_boss_drop" && value.target.itemComparison === "agreement").length,
        traditionalCandidateItemConflictCount: candidates.filter(value => value.target?.family === "quest_boss_drop" && value.target.itemComparison === "conflict").length,
        zBattleCandidateCount: zCandidates.length,
        zBattleCandidateQuantityAgreementCount: zCandidates.filter(value => value.target?.quantityComparison === "agreement").length,
        zBattleCandidateQuantityConflictCount: zCandidates.filter(value => value.target?.quantityComparison === "conflict").length,
        titleJoinCount: 0, chanceInferenceCount: 0, repeatabilityInferenceCount: 0, networkRequestCount: 0,
    };
}
exports.buildServerS3Coverage = buildServerS3Coverage;
function validateServerS3Dataset(dataset, declaredRemoteRewardCount, expectedChannelCounts) {
    const failures = [];
    if (dataset.contract !== "dokkan-server-reward-identity" || dataset.contractVersion !== "0.4.0" || dataset.collectionMode !== "local_validated_artifacts_no_network")
        failures.push("contract identity");
    const expectedLineage = new Map([["events_e5", "sqlite_first_party"], ["events_e7", "community_shadow"], ["dokkaninfo_event_rewards", "community_shadow"], ["dokkaninfo_reward_parser", "repository_implementation"]]);
    const lineageKeys = dataset.sourceLineage.map(value => value.key);
    if (lineageKeys.length !== expectedLineage.size || new Set(lineageKeys).size !== expectedLineage.size || [...expectedLineage.keys()].some(key => !lineageKeys.includes(key)) || dataset.sourceLineage.some(value => expectedLineage.get(value.key) !== value.authority || !/^[a-f0-9]{64}$/.test(value.sha256) || value.sizeBytes <= 0))
        failures.push("source lineage");
    if (!dataset.authorityPolicy.structuralIdsOnly || dataset.authorityPolicy.titleJoinAllowed || dataset.authorityPolicy.remoteQuantityPromotedWhenFirstPartyMissing || dataset.authorityPolicy.chanceOrRepeatabilityInferred || dataset.authorityPolicy.legacyRewardIdentityOrigin !== "unknown_payload_id_or_synthetic_index" || dataset.authorityPolicy.normalizedRowCollisionStatus !== "unknown" || dataset.authorityPolicy.normalizedRowsLossless)
        failures.push("authority policy");
    if (new Set(dataset.assessments.map(value => value.remoteKey)).size !== dataset.assessments.length)
        failures.push("duplicate remote reward key");
    const exactNormalizedArtifactAccounting = dataset.assessments.length === declaredRemoteRewardCount;
    if (!exactNormalizedArtifactAccounting)
        failures.push("normalized artifact accounting");
    const allowedClassifications = new Set(["agreement", "confirmed_conflict", "partial_candidate", "unjoinable"]);
    const exclusiveClassifications = dataset.assessments.every(value => allowedClassifications.has(value.classification));
    if (!exclusiveClassifications)
        failures.push("classification domain");
    for (const value of dataset.assessments) {
        if (!/^\d+$/.test(value.eventId) || !/^\d+$/.test(value.remoteRewardId) || !/^\d+$/.test(value.remoteItem.itemId) || (value.stageId !== null && !/^\d+$/.test(value.stageId)))
            failures.push(`non-structural remote identity ${value.remoteKey}`);
        if (value.classification === "agreement" || value.classification === "confirmed_conflict")
            failures.push(`legacy identity origin cannot support ${value.classification} ${value.remoteKey}`);
        if (value.classification === "partial_candidate" && (value.target === null || (value.eventType === "zbattle"
            ? value.target.family !== "z_battle_first_reward" || value.rewardChannel !== "first_clear_candidate" || value.target.itemComparison !== "agreement" || value.target.quantityComparison === "not_comparable"
            : value.target.family !== "quest_boss_drop" || value.rewardChannel !== "drop_candidate" || value.target.sourceRowId !== value.remoteRewardId || value.target.parentId !== value.stageId || value.target.quantityComparison !== "not_comparable" || value.target.itemComparison !== (value.target.firstPartyItem.itemType === value.remoteItem.itemType && value.target.firstPartyItem.itemId === value.remoteItem.itemId ? "agreement" : "conflict"))))
            failures.push(`invalid partial candidate ${value.remoteKey}`);
        if (value.classification === "unjoinable" && value.target !== null)
            failures.push(`unjoinable target ${value.remoteKey}`);
    }
    const channels = new Map(dataset.channels.map(value => [value.channel, value]));
    const expectedChannels = ["preview", "drop", "first_clear", "mission", "ranking", "server_grant"];
    if (dataset.channels.length !== expectedChannels.length || channels.size !== expectedChannels.length || expectedChannels.some(value => !channels.has(value)))
        failures.push("reward channel set");
    const unknownSemanticsPreserved = channels.get("preview")?.rowCount === expectedChannelCounts.preview && channels.get("preview")?.identityStatus === "partial" && channels.get("preview")?.semanticStatus === "partial"
        && channels.get("drop")?.rowCount === expectedChannelCounts.questBossDrops + expectedChannelCounts.zNormalRewards && channels.get("drop")?.identityStatus === "supported" && channels.get("drop")?.semanticStatus === "partial"
        && channels.get("first_clear")?.rowCount === expectedChannelCounts.zFirstRewards && channels.get("first_clear")?.identityStatus === "supported" && channels.get("first_clear")?.semanticStatus === "partial"
        && channels.get("mission")?.rowCount === expectedChannelCounts.missionRewards && channels.get("mission")?.identityStatus === "supported" && channels.get("mission")?.semanticStatus === "supported"
        && channels.get("ranking")?.rowCount === expectedChannelCounts.rankingRewards && channels.get("ranking")?.identityStatus === "supported" && channels.get("ranking")?.semanticStatus === "supported"
        && channels.get("server_grant")?.identityStatus === "unknown" && channels.get("server_grant")?.semanticStatus === "unknown" && channels.get("server_grant")?.rowCount === 0;
    if (!unknownSemanticsPreserved)
        failures.push("unknown reward semantics promoted");
    const staticAuthorityPreserved = dataset.authorityPolicy.staticRewardIdentity === "sqlite_first_party" && dataset.authorityPolicy.remoteRows === "community_shadow";
    if (!staticAuthorityPreserved)
        failures.push("static authority");
    return { schemaVersion: 1, valid: failures.length === 0, exactNormalizedArtifactAccounting, losslessRemoteAccountingProven: false, exclusiveClassifications, staticAuthorityPreserved, unknownSemanticsPreserved, failures };
}
exports.validateServerS3Dataset = validateServerS3Dataset;
//# sourceMappingURL=server-s3-builder.js.map