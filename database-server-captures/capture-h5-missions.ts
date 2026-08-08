import { CaptureH0Dataset, CaptureInputManifest } from "./capture-h0-contract";
import { CaptureH5Dataset, CaptureH5Validation } from "./capture-h5-contract";
import { capturePublicValueFingerprints, forEachCaptureProductResponse, groupProductFacts, makeProductFact, productFactId, productValueEvidenceSha256 } from "./capture-product-core";
import { CaptureProductFact, CaptureProductResponseContext, CaptureProductValue } from "./capture-product-contract";

type Candidate = { entityType: string; entityId: number; fact: CaptureProductFact };
type Kind = "identity" | "positiveInt" | "nonNegativeInt" | "timestamp" | "boolean" | "positiveIntArray";
type Rule = { kind: Kind; endpoint: string; path: string };
const endpoint = "/missions/mission_board_campaigns";
const rule = (kind: Kind, path: string): Rule => ({ kind, endpoint, path });
const rules: Record<string, Record<string, Rule>> = {
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

function normalize(kind: Kind, raw: unknown): CaptureProductValue | undefined {
    if ((kind === "identity" || kind === "positiveInt") && Number.isSafeInteger(raw) && (raw as number) > 0 && (raw as number) <= 10 ** 12) return raw as number;
    if (kind === "nonNegativeInt" && Number.isSafeInteger(raw) && (raw as number) >= 0 && (raw as number) <= 10 ** 12) return raw as number;
    if (kind === "timestamp" && Number.isSafeInteger(raw) && (raw as number) >= 0 && (raw as number) <= 10 ** 13) return raw as number;
    if (kind === "boolean" && typeof raw === "boolean") return raw;
    if (kind === "positiveIntArray" && Array.isArray(raw) && raw.length <= 100000 && raw.every(value => Number.isSafeInteger(value) && value > 0 && value <= 10 ** 12)) return [...new Set(raw as number[])].sort((a, b) => a - b);
    return undefined;
}

function objects(value: unknown): any[] { return Array.isArray(value) ? value.filter(item => item && typeof item === "object") : []; }
function add(candidates: Candidate[], context: CaptureProductResponseContext, entityType: string, entityId: number, field: string, raw: unknown): void {
    const fieldRule = rules[entityType]?.[field];
    if (!fieldRule) return;
    const value = normalize(fieldRule.kind, raw);
    if (value !== undefined) candidates.push({ entityType, entityId, fact: makeProductFact(entityType, entityId, field, value, context, fieldRule.path) });
}

export function buildCaptureH5(manifest: CaptureInputManifest, roots: Record<string, string>, h0: CaptureH0Dataset): CaptureH5Dataset {
    const candidates: Candidate[] = [];
    forEachCaptureProductResponse(manifest, roots, h0, context => {
        if (context.normalizedEndpoint !== endpoint) return;
        const body = context.body as any;
        for (const campaign of objects(body?.mission_board_campaigns)) {
            if (!Number.isSafeInteger(campaign.id) || campaign.id <= 0) continue;
            const boards = objects(campaign.mission_boards);
            for (const [field, raw] of [["identity", campaign.id], ["startAt", campaign.start_at], ["endAt", campaign.end_at], ["endAtHidden", campaign.end_at_hidden], ["announcementId", campaign.announcement_id], ["campaignCompleteMissionId", campaign.campaign_complete_mission_id], ["priority", campaign.priority], ["missionBoardIds", boards.map(board => board.id)]] as Array<[string, unknown]>) add(candidates, context, "mission_board_campaign", campaign.id, field, raw);
            for (const board of boards) {
                if (!Number.isSafeInteger(board.id) || board.id <= 0) continue;
                for (const [field, raw] of [["identity", board.id], ["completeMissionId", board.complete_mission_id], ["contentsLevel", board.contents_lv], ["displayRewardId", board.display_reward_id], ["missionCategoryId", board.mission_category_id], ["number", board.number]] as Array<[string, unknown]>) add(candidates, context, "mission_board", board.id, field, raw);
            }
        }
    });
    const dataset: CaptureH5Dataset = { schemaVersion: 1, contract: "dokkan-official-capture-mission-boards", contractVersion: "0.6.0", generatedAt: h0.generatedAt, generatedAtPolicy: "latest_capture_timestamp_for_deterministic_bytes", collectionMode: "offline_allowlisted_product_values_no_requests", productionMutation: false, defaultEnabled: false, authority: "capture_observation_partial_no_progress_completion_or_reward_grant_authority", missionArrayDisposition: "discarded_as_progress_wrapper_including_mission_ids", rewardRepresentation: "display_reward_id_reference_only_no_contents_quantity_or_grant_semantics", discardedFields: [...discardedFields], entities: groupProductFacts(candidates) };
    const validation = validateCaptureH5(dataset, h0);
    if (!validation.valid) throw new Error(`H5 validation failed: ${validation.failures.join(", ")}`);
    return dataset;
}

export function validateCaptureH5(dataset: CaptureH5Dataset, h0: CaptureH0Dataset): CaptureH5Validation {
    const failures: string[] = [], entityKeys = new Set<string>(), factIds = new Set<string>();
    const publicFingerprints = capturePublicValueFingerprints(dataset.entities);
    const expectedCaptures = new Map(h0.captures.map(capture => [capture.captureId, capture]));
    let factCount = 0, partialCount = 0, supportedCount = 0, userDerivedAuthorityCount = 0;
    for (const entity of dataset.entities) {
        const key = `${entity.entityType}:${entity.entityId}`;
        if (entityKeys.has(key) || !rules[entity.entityType] || !Number.isSafeInteger(entity.entityId) || entity.entityId <= 0) failures.push("entity identity");
        entityKeys.add(key);
        if (!entity.facts.some(fact => fact.field === "identity" && fact.value === entity.entityId)) failures.push("missing structural identity");
        for (const fact of entity.facts) {
            factCount += 1;
            const fieldRule = rules[entity.entityType]?.[fact.field], p = fact.provenance, { factId: _factId, ...withoutId } = fact;
            if (factIds.has(fact.factId) || !fieldRule || fact.factId !== productFactId(entity.entityType, entity.entityId, withoutId)) failures.push("fact identity or field");
            factIds.add(fact.factId);
            if (!fieldRule || JSON.stringify(normalize(fieldRule.kind, fact.value)) !== JSON.stringify(fact.value) || (fact.field === "identity" && fact.value !== entity.entityId)) failures.push("fact value domain");
            if (p.normalizedEndpoint !== fieldRule?.endpoint || p.jsonPath !== fieldRule?.path) failures.push("coordinate allowlist");
            const expectedCapture = expectedCaptures.get(p.captureId);
            if (p.endpointClassification !== "product_catalog" || p.method !== "GET" || !Number.isInteger(p.httpStatus) || p.httpStatus < 200 || p.httpStatus > 299 || p.confidence !== "partial" || p.userDerivedAuthority !== false || p.evidenceOrigin !== "official_capture_allowlisted_product_value" || !/^[a-z0-9][a-z0-9_-]{0,47}$/.test(p.captureId) || !expectedCapture || p.captureFingerprint !== expectedCapture.structuralFingerprint || p.captureSchemaFingerprint !== expectedCapture.schemaFingerprint || p.captureSourceIdentityFingerprint !== expectedCapture.sourceIdentityFingerprint || p.captureTimestamp !== expectedCapture.capturedAtStart || p.capturePublicValueFingerprint !== publicFingerprints.get(p.captureId) || p.valueEvidenceSha256 !== productValueEvidenceSha256(fact.field, fact.value, p.jsonPath) || Number.isNaN(Date.parse(p.captureTimestamp)) || Number.isNaN(Date.parse(p.observedAt))) failures.push("provenance boundary");
            if (p.confidence === "partial") partialCount += 1; else supportedCount += 1;
            if (p.userDerivedAuthority !== false) userDerivedAuthorityCount += 1;
            if (discardedFields.some(value => fact.field.toLowerCase().includes(value) || p.jsonPath.toLowerCase().includes(value))) failures.push("discarded field leakage");
        }
    }
    if (dataset.schemaVersion !== 1 || dataset.contract !== "dokkan-official-capture-mission-boards" || dataset.contractVersion !== "0.6.0" || dataset.productionMutation !== false || dataset.defaultEnabled !== false || dataset.authority !== "capture_observation_partial_no_progress_completion_or_reward_grant_authority" || dataset.missionArrayDisposition !== "discarded_as_progress_wrapper_including_mission_ids" || dataset.rewardRepresentation !== "display_reward_id_reference_only_no_contents_quantity_or_grant_semantics") failures.push("dataset contract");
    if (dataset.entities.length === 0 || factCount === 0) failures.push("empty dataset");
    if (supportedCount !== 0) failures.push("unsupported promotion");
    if (userDerivedAuthorityCount !== 0) failures.push("user-derived authority");
    return { schemaVersion: 1, valid: failures.length === 0, entityCount: dataset.entities.length, factCount, supportedCount, partialCount, userDerivedAuthorityCount, failures: [...new Set(failures)] };
}
