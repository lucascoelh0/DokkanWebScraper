"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateCaptureH5 = exports.buildCaptureH5 = void 0;
const capture_product_core_1 = require("./capture-product-core");
const endpoint = "/missions/mission_board_campaigns";
const rule = (kind, path) => ({ kind, endpoint, path });
const rules = {
    mission_board_campaign: {
        identity: rule("identity", "$.mission_board_campaigns[].id"),
        startAt: rule("timestamp", "$.mission_board_campaigns[].start_at"),
        endAt: rule("timestamp", "$.mission_board_campaigns[].end_at"),
        endAtHidden: rule("boolean", "$.mission_board_campaigns[].end_at_hidden"),
        announcementId: rule("positiveInt", "$.mission_board_campaigns[].announcement_id"),
        campaignCompleteMissionId: rule("positiveInt", "$.mission_board_campaigns[].campaign_complete_mission_id"),
        priority: rule("nonNegativeInt", "$.mission_board_campaigns[].priority"),
        missionBoardIds: rule("positiveIntArray", "$.mission_board_campaigns[].mission_boards[].id"),
    },
    mission_board: {
        identity: rule("identity", "$.mission_board_campaigns[].mission_boards[].id"),
        completeMissionId: rule("positiveInt", "$.mission_board_campaigns[].mission_boards[].complete_mission_id"),
        contentsLevel: rule("nonNegativeInt", "$.mission_board_campaigns[].mission_boards[].contents_lv"),
        displayRewardId: rule("positiveInt", "$.mission_board_campaigns[].mission_boards[].display_reward_id"),
        missionCategoryId: rule("positiveInt", "$.mission_board_campaigns[].mission_boards[].mission_category_id"),
        number: rule("positiveInt", "$.mission_board_campaigns[].mission_boards[].number"),
    },
};
const discardedFields = ["accepted_reward_at", "background_image_path", "banner_image_path", "complete_image_path", "complete_message", "completed_at", "current_value", "missions", "name", "processed_at", "type"];
function normalize(kind, raw) {
    if ((kind === "identity" || kind === "positiveInt") && Number.isSafeInteger(raw) && raw > 0 && raw <= 10 ** 12)
        return raw;
    if (kind === "nonNegativeInt" && Number.isSafeInteger(raw) && raw >= 0 && raw <= 10 ** 12)
        return raw;
    if (kind === "timestamp" && Number.isSafeInteger(raw) && raw >= 0 && raw <= 10 ** 13)
        return raw;
    if (kind === "boolean" && typeof raw === "boolean")
        return raw;
    if (kind === "positiveIntArray" && Array.isArray(raw) && raw.length <= 100000 && raw.every(value => Number.isSafeInteger(value) && value > 0 && value <= 10 ** 12))
        return [...new Set(raw)].sort((a, b) => a - b);
    return undefined;
}
function objects(value) { return Array.isArray(value) ? value.filter(item => item && typeof item === "object") : []; }
function add(candidates, context, entityType, entityId, field, raw) {
    const fieldRule = rules[entityType]?.[field];
    if (!fieldRule)
        return;
    const value = normalize(fieldRule.kind, raw);
    if (value !== undefined)
        candidates.push({ entityType, entityId, fact: (0, capture_product_core_1.makeProductFact)(entityType, entityId, field, value, context, fieldRule.path) });
}
function buildCaptureH5(manifest, roots, h0) {
    const candidates = [];
    (0, capture_product_core_1.forEachCaptureProductResponse)(manifest, roots, h0, context => {
        if (context.normalizedEndpoint !== endpoint)
            return;
        const body = context.body;
        for (const campaign of objects(body?.mission_board_campaigns)) {
            if (!Number.isSafeInteger(campaign.id) || campaign.id <= 0)
                continue;
            const boards = objects(campaign.mission_boards);
            for (const [field, raw] of [["identity", campaign.id], ["startAt", campaign.start_at], ["endAt", campaign.end_at], ["endAtHidden", campaign.end_at_hidden], ["announcementId", campaign.announcement_id], ["campaignCompleteMissionId", campaign.campaign_complete_mission_id], ["priority", campaign.priority], ["missionBoardIds", boards.map(board => board.id)]])
                add(candidates, context, "mission_board_campaign", campaign.id, field, raw);
            for (const board of boards) {
                if (!Number.isSafeInteger(board.id) || board.id <= 0)
                    continue;
                for (const [field, raw] of [["identity", board.id], ["completeMissionId", board.complete_mission_id], ["contentsLevel", board.contents_lv], ["displayRewardId", board.display_reward_id], ["missionCategoryId", board.mission_category_id], ["number", board.number]])
                    add(candidates, context, "mission_board", board.id, field, raw);
            }
        }
    });
    const dataset = { schemaVersion: 1, contract: "dokkan-official-capture-mission-boards", contractVersion: "0.6.0", generatedAt: h0.generatedAt, generatedAtPolicy: "latest_capture_timestamp_for_deterministic_bytes", collectionMode: "offline_allowlisted_product_values_no_requests", productionMutation: false, defaultEnabled: false, authority: "capture_observation_partial_no_progress_completion_or_reward_grant_authority", missionArrayDisposition: "discarded_as_progress_wrapper_including_mission_ids", rewardRepresentation: "display_reward_id_reference_only_no_contents_quantity_or_grant_semantics", discardedFields: [...discardedFields], entities: (0, capture_product_core_1.groupProductFacts)(candidates) };
    const validation = validateCaptureH5(dataset, h0);
    if (!validation.valid)
        throw new Error(`H5 validation failed: ${validation.failures.join(", ")}`);
    return dataset;
}
exports.buildCaptureH5 = buildCaptureH5;
function validateCaptureH5(dataset, h0) {
    const failures = [], entityKeys = new Set(), factIds = new Set();
    const publicFingerprints = (0, capture_product_core_1.capturePublicValueFingerprints)(dataset.entities);
    const expectedCaptures = new Map(h0.captures.map(capture => [capture.captureId, capture]));
    let factCount = 0, partialCount = 0, supportedCount = 0, userDerivedAuthorityCount = 0;
    for (const entity of dataset.entities) {
        const key = `${entity.entityType}:${entity.entityId}`;
        if (entityKeys.has(key) || !rules[entity.entityType] || !Number.isSafeInteger(entity.entityId) || entity.entityId <= 0)
            failures.push("entity identity");
        entityKeys.add(key);
        if (!entity.facts.some(fact => fact.field === "identity" && fact.value === entity.entityId))
            failures.push("missing structural identity");
        for (const fact of entity.facts) {
            factCount += 1;
            const fieldRule = rules[entity.entityType]?.[fact.field], p = fact.provenance, { factId: _factId, ...withoutId } = fact;
            if (factIds.has(fact.factId) || !fieldRule || fact.factId !== (0, capture_product_core_1.productFactId)(entity.entityType, entity.entityId, withoutId))
                failures.push("fact identity or field");
            factIds.add(fact.factId);
            if (!fieldRule || JSON.stringify(normalize(fieldRule.kind, fact.value)) !== JSON.stringify(fact.value) || (fact.field === "identity" && fact.value !== entity.entityId))
                failures.push("fact value domain");
            if (p.normalizedEndpoint !== fieldRule?.endpoint || p.jsonPath !== fieldRule?.path)
                failures.push("coordinate allowlist");
            const expectedCapture = expectedCaptures.get(p.captureId);
            if (p.endpointClassification !== "product_catalog" || p.method !== "GET" || !Number.isInteger(p.httpStatus) || p.httpStatus < 200 || p.httpStatus > 299 || p.confidence !== "partial" || p.userDerivedAuthority !== false || p.evidenceOrigin !== "official_capture_allowlisted_product_value" || !/^[a-z0-9][a-z0-9_-]{0,47}$/.test(p.captureId) || !expectedCapture || p.captureFingerprint !== expectedCapture.structuralFingerprint || p.captureSchemaFingerprint !== expectedCapture.schemaFingerprint || p.captureSourceIdentityFingerprint !== expectedCapture.sourceIdentityFingerprint || p.captureTimestamp !== expectedCapture.capturedAtStart || p.capturePublicValueFingerprint !== publicFingerprints.get(p.captureId) || p.valueEvidenceSha256 !== (0, capture_product_core_1.productValueEvidenceSha256)(fact.field, fact.value, p.jsonPath) || Number.isNaN(Date.parse(p.captureTimestamp)) || Number.isNaN(Date.parse(p.observedAt)))
                failures.push("provenance boundary");
            if (p.confidence === "partial")
                partialCount += 1;
            else
                supportedCount += 1;
            if (p.userDerivedAuthority !== false)
                userDerivedAuthorityCount += 1;
            if (discardedFields.some(value => fact.field.toLowerCase().includes(value) || p.jsonPath.toLowerCase().includes(value)))
                failures.push("discarded field leakage");
        }
    }
    if (dataset.schemaVersion !== 1 || dataset.contract !== "dokkan-official-capture-mission-boards" || dataset.contractVersion !== "0.6.0" || dataset.productionMutation !== false || dataset.defaultEnabled !== false || dataset.authority !== "capture_observation_partial_no_progress_completion_or_reward_grant_authority" || dataset.missionArrayDisposition !== "discarded_as_progress_wrapper_including_mission_ids" || dataset.rewardRepresentation !== "display_reward_id_reference_only_no_contents_quantity_or_grant_semantics")
        failures.push("dataset contract");
    if (dataset.entities.length === 0 || factCount === 0)
        failures.push("empty dataset");
    if (supportedCount !== 0)
        failures.push("unsupported promotion");
    if (userDerivedAuthorityCount !== 0)
        failures.push("user-derived authority");
    return { schemaVersion: 1, valid: failures.length === 0, entityCount: dataset.entities.length, factCount, supportedCount, partialCount, userDerivedAuthorityCount, failures: [...new Set(failures)] };
}
exports.validateCaptureH5 = validateCaptureH5;
//# sourceMappingURL=capture-h5-missions.js.map