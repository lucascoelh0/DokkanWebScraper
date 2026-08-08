import { CaptureH0Dataset, CaptureInputManifest } from "./capture-h0-contract";
import { CaptureH3Dataset, CaptureH3Validation } from "./capture-h3-contract";
import { capturePublicValueFingerprints, forEachCaptureProductResponse, groupProductFacts, makeProductFact, productFactId, productValueEvidenceSha256 } from "./capture-product-core";
import { CaptureProductFact, CaptureProductResponseContext, CaptureProductValue } from "./capture-product-contract";

type Candidate = { entityType: string; entityId: number; fact: CaptureProductFact };
const discardedUserFields = ["accepted_reward_at", "completed_at", "current_value", "effect_viewed", "has_entry", "is_progress", "next_reset_at", "open_status", "processed_at", "reward_acceptable", "user_quest", "visited_count"];
type FieldKind = "identity" | "timestamp" | "positiveInt" | "weekdayArray" | "positiveIntArray" | "observedTrue" | "scheduleType" | "rate";
type FieldRule = { kind: FieldKind; endpoints: string[]; paths: string[] };
const rule = (kind: FieldKind, endpoints: string | string[], paths: string | string[]): FieldRule => ({ kind, endpoints: Array.isArray(endpoints) ? endpoints : [endpoints], paths: Array.isArray(paths) ? paths : [paths] });
const rules: Record<string, Record<string, FieldRule>> = {
    event: { identity: rule("identity", "/events", "$.events[].id"), startAt: rule("timestamp", "/events", "$.events[].start_at"), endAt: rule("timestamp", "/events", "$.events[].end_at"), weekdays: rule("weekdayArray", "/events", "$.events[].wday"), weekdayStartAt: rule("timestamp", "/events", "$.events[].wday_start_at"), weekdayEndAt: rule("timestamp", "/events", "$.events[].wday_end_at"), announcementId: rule("positiveInt", "/events", "$.events[].announcement_id"), questIds: rule("positiveIntArray", "/events", "$.events[].quests[].id") },
    event_key_event: { identity: rule("identity", "/events/eventkagi_events", "$.eventkagi_events[].id"), endAt: rule("timestamp", "/events/eventkagi_events", "$.eventkagi_events[].end_at"), announcementId: rule("positiveInt", "/events/eventkagi_events", "$.eventkagi_events[].announcement_id"), questIds: rule("positiveIntArray", "/events/eventkagi_events", "$.eventkagi_events[].quests[].id"), referenceObserved: rule("observedTrue", "/events/eventkagi_events", "$.eventkagi_events[]") },
    z_battle: { identity: rule("identity", "/events", "$.z_battle_stages[].id"), startAt: rule("timestamp", "/events", "$.z_battle_stages[].start_at"), endAt: rule("timestamp", "/events", "$.z_battle_stages[].end_at"), announcementId: rule("positiveInt", "/events", "$.z_battle_stages[].announcement_id"), superZBattleId: rule("positiveInt", "/events", "$.z_battle_stages[].super_z_battle_stage.id") },
    super_z_battle: { identity: rule("identity", "/events", "$.z_battle_stages[].super_z_battle_stage.id"), startAt: rule("timestamp", "/events", "$.z_battle_stages[].super_z_battle_stage.start_at"), endAt: rule("timestamp", "/events", "$.z_battle_stages[].super_z_battle_stage.end_at"), announcementId: rule("positiveInt", "/events", "$.z_battle_stages[].super_z_battle_stage.announcement_id") },
    event_key_z_battle: { identity: rule("identity", "/events/eventkagi_events", "$.eventkagi_z_battle_stages[].id"), announcementId: rule("positiveInt", "/events/eventkagi_events", "$.eventkagi_z_battle_stages[].announcement_id"), referenceObserved: rule("observedTrue", "/events/eventkagi_events", "$.eventkagi_z_battle_stages[]") },
    bonus_schedule: { identity: rule("identity", ["/bonus_schedules", "/resources/home"], "$.bonus_schedules[].id"), startAt: rule("timestamp", ["/bonus_schedules", "/resources/home"], "$.bonus_schedules[].start_at"), endAt: rule("timestamp", ["/bonus_schedules", "/resources/home"], "$.bonus_schedules[].end_at"), scheduleType: rule("scheduleType", ["/bonus_schedules", "/resources/home"], "$.bonus_schedules[].type"), rate: rule("rate", ["/bonus_schedules", "/resources/home"], "$.bonus_schedules[].rate") },
    rmbattle: { identity: rule("identity", "/resources/home", "$.rmbattles.id"), startAt: rule("timestamp", "/resources/home", "$.rmbattles.start_at"), endAt: rule("timestamp", "/resources/home", "$.rmbattles.end_at"), announcementId: rule("positiveInt", "/resources/home", "$.rmbattles.announcement_id"), requiredRank: rule("positiveInt", "/resources/home", "$.rmbattles.required_rank") },
    budokai: { identity: rule("identity", "/resources/home", "$.budokai.id"), startAt: rule("timestamp", "/resources/home", "$.budokai.start_at"), endAt: rule("timestamp", "/resources/home", "$.budokai.end_at"), announcementId: rule("positiveInt", "/resources/home", "$.budokai.announcement_id") },
    genkai_battle: { identity: rule("identity", "/resources/home", "$.genkai_battles.genkai_battles[].id"), startAt: rule("timestamp", "/resources/home", "$.genkai_battles.genkai_battles[].start_at"), endAt: rule("timestamp", "/resources/home", "$.genkai_battles.genkai_battles[].end_at"), areaId: rule("positiveInt", "/resources/home", "$.genkai_battles.genkai_battles[].area_id"), scheduleId: rule("positiveInt", "/resources/home", "$.genkai_battles.genkai_battles[].genkai_battle_schedule_id"), mapId: rule("positiveInt", "/resources/home", "$.genkai_battles.genkai_battles[].sugoroku_map_id") },
};

function normalizedValue(kind: FieldKind, raw: unknown): CaptureProductValue | undefined {
    if ((kind === "identity" || kind === "positiveInt") && Number.isSafeInteger(raw) && (raw as number) > 0 && (raw as number) <= 10 ** 12) return raw as number;
    if (kind === "timestamp" && Number.isSafeInteger(raw) && (raw as number) >= 0 && (raw as number) <= 10 ** 13) return raw as number;
    if (kind === "positiveIntArray" && Array.isArray(raw) && raw.length <= 4096 && raw.every(item => Number.isSafeInteger(item) && item > 0 && item <= 10 ** 12)) return [...new Set(raw as number[])].sort((a, b) => a - b);
    if (kind === "weekdayArray" && Array.isArray(raw) && raw.length <= 7 && raw.every(item => typeof item === "string" && /^(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/i.test(item))) return [...new Set((raw as string[]).map(item => item.toLowerCase()))].sort((a, b) => a.localeCompare(b));
    if (kind === "observedTrue" && raw === true) return true;
    if (kind === "rate" && typeof raw === "number" && Number.isFinite(raw) && raw >= 0 && raw <= 1000) return raw;
    if (kind === "scheduleType" && Number.isSafeInteger(raw) && (raw as number) >= 0 && (raw as number) <= 1000) return raw as number;
    return undefined;
}

function record(candidates: Candidate[], context: CaptureProductResponseContext, entityType: string, entityId: unknown, base: string, values: Array<[string, unknown, string]>): void {
    if (!Number.isSafeInteger(entityId) || (entityId as number) <= 0) return;
    const id = entityId as number;
    for (const [field, raw, path] of [["identity", id, `${base}.id`] as [string, unknown, string], ...values]) {
        const fieldRule = rules[entityType]?.[field];
        if (!fieldRule || raw === undefined) continue;
        const value = normalizedValue(fieldRule.kind, raw);
        if (value !== undefined) candidates.push({ entityType, entityId: id, fact: makeProductFact(entityType, id, field, value, context, path) });
    }
}

function objects(value: unknown): Record<string, any>[] { return Array.isArray(value) ? value.filter(item => item && typeof item === "object") : []; }
function ids(value: unknown): number[] { return objects(value).flatMap(item => Number.isSafeInteger(item.id) && item.id > 0 ? [item.id] : []); }

export function buildCaptureH3(manifest: CaptureInputManifest, roots: Record<string, string>, h0: CaptureH0Dataset): CaptureH3Dataset {
    const candidates: Candidate[] = [];
    forEachCaptureProductResponse(manifest, roots, h0, context => {
        const body = context.body as any;
        if (!body || typeof body !== "object") return;
        if (context.normalizedEndpoint === "/events") {
            for (const item of objects(body.events)) record(candidates, context, "event", item.id, "$.events[]", [["startAt", item.start_at, "$.events[].start_at"], ["endAt", item.end_at, "$.events[].end_at"], ["weekdays", item.wday, "$.events[].wday"], ["weekdayStartAt", item.wday_start_at, "$.events[].wday_start_at"], ["weekdayEndAt", item.wday_end_at, "$.events[].wday_end_at"], ["announcementId", item.announcement_id, "$.events[].announcement_id"], ["questIds", ids(item.quests), "$.events[].quests[].id"]]);
            for (const item of objects(body.z_battle_stages)) {
                record(candidates, context, "z_battle", item.id, "$.z_battle_stages[]", [["startAt", item.start_at, "$.z_battle_stages[].start_at"], ["endAt", item.end_at, "$.z_battle_stages[].end_at"], ["announcementId", item.announcement_id, "$.z_battle_stages[].announcement_id"], ["superZBattleId", item.super_z_battle_stage?.id, "$.z_battle_stages[].super_z_battle_stage.id"]]);
                if (item.super_z_battle_stage) record(candidates, context, "super_z_battle", item.super_z_battle_stage.id, "$.z_battle_stages[].super_z_battle_stage", [["startAt", item.super_z_battle_stage.start_at, "$.z_battle_stages[].super_z_battle_stage.start_at"], ["endAt", item.super_z_battle_stage.end_at, "$.z_battle_stages[].super_z_battle_stage.end_at"], ["announcementId", item.super_z_battle_stage.announcement_id, "$.z_battle_stages[].super_z_battle_stage.announcement_id"]]);
            }
        } else if (context.normalizedEndpoint === "/events/eventkagi_events") {
            for (const item of objects(body.eventkagi_events)) record(candidates, context, "event_key_event", item.id, "$.eventkagi_events[]", [["endAt", item.end_at, "$.eventkagi_events[].end_at"], ["announcementId", item.announcement_id, "$.eventkagi_events[].announcement_id"], ["questIds", ids(item.quests), "$.eventkagi_events[].quests[].id"], ["referenceObserved", true, "$.eventkagi_events[]"]]);
            for (const item of objects(body.eventkagi_z_battle_stages)) record(candidates, context, "event_key_z_battle", item.id, "$.eventkagi_z_battle_stages[]", [["announcementId", item.announcement_id, "$.eventkagi_z_battle_stages[].announcement_id"], ["referenceObserved", true, "$.eventkagi_z_battle_stages[]"]]);
        } else if (context.normalizedEndpoint === "/bonus_schedules") {
            for (const item of objects(body.bonus_schedules)) record(candidates, context, "bonus_schedule", item.id, "$.bonus_schedules[]", [["startAt", item.start_at, "$.bonus_schedules[].start_at"], ["endAt", item.end_at, "$.bonus_schedules[].end_at"], ["scheduleType", item.type, "$.bonus_schedules[].type"], ["rate", item.rate, "$.bonus_schedules[].rate"]]);
        } else if (context.normalizedEndpoint === "/resources/home") {
            for (const item of objects(body.bonus_schedules)) record(candidates, context, "bonus_schedule", item.id, "$.bonus_schedules[]", [["startAt", item.start_at, "$.bonus_schedules[].start_at"], ["endAt", item.end_at, "$.bonus_schedules[].end_at"], ["scheduleType", item.type, "$.bonus_schedules[].type"], ["rate", item.rate, "$.bonus_schedules[].rate"]]);
            const rm = body.rmbattles;
            if (rm && typeof rm === "object") record(candidates, context, "rmbattle", rm.id, "$.rmbattles", [["startAt", rm.start_at, "$.rmbattles.start_at"], ["endAt", rm.end_at, "$.rmbattles.end_at"], ["announcementId", rm.announcement_id, "$.rmbattles.announcement_id"], ["requiredRank", rm.required_rank, "$.rmbattles.required_rank"]]);
            const budokai = body.budokai;
            if (budokai && typeof budokai === "object") record(candidates, context, "budokai", budokai.id, "$.budokai", [["startAt", budokai.start_at, "$.budokai.start_at"], ["endAt", budokai.end_at, "$.budokai.end_at"], ["announcementId", budokai.announcement_id, "$.budokai.announcement_id"]]);
            for (const item of objects(body.genkai_battles?.genkai_battles)) record(candidates, context, "genkai_battle", item.id, "$.genkai_battles.genkai_battles[]", [["startAt", item.start_at, "$.genkai_battles.genkai_battles[].start_at"], ["endAt", item.end_at, "$.genkai_battles.genkai_battles[].end_at"], ["areaId", item.area_id, "$.genkai_battles.genkai_battles[].area_id"], ["scheduleId", item.genkai_battle_schedule_id, "$.genkai_battles.genkai_battles[].genkai_battle_schedule_id"], ["mapId", item.sugoroku_map_id, "$.genkai_battles.genkai_battles[].sugoroku_map_id"]]);
        }
    });
    const dataset: CaptureH3Dataset = { schemaVersion: 1, contract: "dokkan-official-capture-schedules-availability", contractVersion: "0.4.0", generatedAt: h0.generatedAt, generatedAtPolicy: "latest_capture_timestamp_for_deterministic_bytes", collectionMode: "offline_allowlisted_product_values_no_requests", productionMutation: false, defaultEnabled: false, authority: "capture_observation_partial_database_identity_remains_authoritative", discardedUserFields: [...discardedUserFields], entities: groupProductFacts(candidates) };
    const validation = validateCaptureH3(dataset);
    if (!validation.valid) throw new Error(`H3 validation failed: ${validation.failures.join(", ")}`);
    return dataset;
}

export function validateCaptureH3(dataset: CaptureH3Dataset): CaptureH3Validation {
    const failures: string[] = [];
    let factCount = 0, supportedCount = 0, partialCount = 0, userDerivedAuthorityCount = 0;
    const entityKeys = new Set<string>(), factIds = new Set<string>();
    const publicFingerprints = capturePublicValueFingerprints(dataset.entities);
    for (const entity of dataset.entities) {
        const entityKey = `${entity.entityType}:${entity.entityId}`;
        if (entityKeys.has(entityKey) || !rules[entity.entityType] || !Number.isSafeInteger(entity.entityId) || entity.entityId <= 0) failures.push("entity identity");
        entityKeys.add(entityKey);
        for (const fact of entity.facts) {
            factCount += 1;
            const fieldRule = rules[entity.entityType]?.[fact.field];
            const { factId: _factId, ...withoutId } = fact;
            if (factIds.has(fact.factId) || !/^[a-f0-9]{64}$/.test(fact.factId) || !fieldRule || fact.factId !== productFactId(entity.entityType, entity.entityId, withoutId)) failures.push("fact identity or field");
            factIds.add(fact.factId);
            if (!fieldRule || JSON.stringify(normalizedValue(fieldRule.kind, fact.value)) !== JSON.stringify(fact.value) || (fact.field === "identity" && fact.value !== entity.entityId)) failures.push("fact value domain");
            if (!fieldRule?.endpoints.includes(fact.provenance.normalizedEndpoint) || !fieldRule?.paths.includes(fact.provenance.jsonPath)) failures.push("coordinate allowlist");
            if (discardedUserFields.some(value => fact.field.toLowerCase().includes(value) || fact.provenance.jsonPath.toLowerCase().includes(value))) failures.push("user field leakage");
            if (fact.provenance.confidence === "partial") partialCount += 1; else supportedCount += 1;
            if (fact.provenance.userDerivedAuthority !== false) userDerivedAuthorityCount += 1;
            const expectedClassification = fact.provenance.normalizedEndpoint === "/resources/home" || fact.provenance.normalizedEndpoint === "/events" ? "mixed_product_and_user_state" : "product_catalog";
            if (fact.provenance.evidenceOrigin !== "official_capture_allowlisted_product_value" || fact.provenance.endpointClassification !== expectedClassification || fact.provenance.method !== "GET" || fact.provenance.httpStatus < 200 || fact.provenance.httpStatus > 299 || !/^[a-z0-9][a-z0-9_-]{0,47}$/.test(fact.provenance.captureId) || !/^[a-f0-9]{64}$/.test(fact.provenance.captureFingerprint) || !/^[a-f0-9]{64}$/.test(fact.provenance.captureSchemaFingerprint) || !/^[a-f0-9]{64}$/.test(fact.provenance.captureSourceIdentityFingerprint) || fact.provenance.capturePublicValueFingerprint !== publicFingerprints.get(fact.provenance.captureId) || fact.provenance.valueEvidenceSha256 !== productValueEvidenceSha256(fact.field, fact.value, fact.provenance.jsonPath) || Number.isNaN(Date.parse(fact.provenance.captureTimestamp)) || Number.isNaN(Date.parse(fact.provenance.observedAt))) failures.push("provenance boundary");
        }
    }
    if (dataset.schemaVersion !== 1 || dataset.contract !== "dokkan-official-capture-schedules-availability" || dataset.contractVersion !== "0.4.0" || dataset.productionMutation !== false || dataset.defaultEnabled !== false || dataset.authority !== "capture_observation_partial_database_identity_remains_authoritative") failures.push("dataset contract");
    if (dataset.entities.length === 0 || factCount === 0) failures.push("empty dataset");
    if (supportedCount !== 0) failures.push("unsupported promotion");
    if (userDerivedAuthorityCount !== 0) failures.push("user-derived authority");
    return { schemaVersion: 1, valid: failures.length === 0, entityCount: dataset.entities.length, factCount, supportedCount, partialCount, userDerivedAuthorityCount, failures: [...new Set(failures)] };
}
