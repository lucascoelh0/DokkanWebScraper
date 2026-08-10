"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateFrontierF4 = exports.buildFrontierF4 = void 0;
const crypto_1 = require("crypto");
const buffer_1 = require("buffer");
function sha256(value) { return (0, crypto_1.createHash)("sha256").update(value).digest("hex"); }
function integer(value) { return Number.isSafeInteger(value) && value >= 0 ? value : null; }
function body(value) { if (!value || typeof value.text !== "string" || value.encoding === "base64")
    return {}; try {
    const parsed = JSON.parse(value.text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
}
catch {
    return {};
} }
function route(method, pathname) { const path = pathname.replace(/\/{2,}/g, "/"), key = `${method} ${path}`, routes = { "POST /origin_battles/start": "start", "POST /kobetu_battles/commands/take_energy_ball": "take_energy_ball", "POST /kobetu_battles/commands/next_turn": "next_turn", "POST /kobetu_battles/commands/use_group_change": "use_group_change", "POST /kobetu_battles/commands/execute_trigger_skill": "execute_trigger_skill", "POST /origin_battles/finish": "finish" }; return routes[key] ?? null; }
function productEpisodeProjection(value) {
    const episode = value?.origin_episode;
    if (!episode || typeof episode !== "object")
        return null;
    return { pages: (Array.isArray(episode.origin_pages) ? episode.origin_pages : []).map((page) => ({ id: integer(page?.id), spots: (Array.isArray(page?.origin_spots) ? page.origin_spots : []).map((spot) => ({ id: integer(spot?.id), number: integer(spot?.number), previous: integer(spot?.prev_origin_spot_id), type: typeof spot?.spot_type === "string" ? spot.spot_type : "unknown", x: Number.isFinite(spot?.pos_x) ? Number(spot.pos_x) : null, y: Number.isFinite(spot?.pos_y) ? Number(spot.pos_y) : null, enemyCardId: integer(spot?.enemy_card_id), battleId: integer(spot?.origin_battle?.id), unlockMissionIds: (Array.isArray(spot?.origin_battle?.unlock_missions) ? spot.origin_battle.unlock_missions : []).map((mission) => integer(mission?.mission_id)).filter((id) => id !== null).sort((a, b) => a - b) })) })) };
}
function buildFrontierF4(harText, f2, f2Text) {
    const entries = JSON.parse(harText)?.log?.entries;
    if (!Array.isArray(entries))
        throw new Error("F4 invalid HAR");
    const battleRooms = new Map(), actors = new Map();
    const alias = (map, value, prefix) => { const id = integer(value); if (id === null)
        return null; if (!map.has(id))
        map.set(id, `${prefix}-${map.size + 1}`); return map.get(id); };
    const operations = [];
    entries.forEach((entry, entryIndex) => { let url; try {
        url = new URL(entry?.request?.url);
    }
    catch {
        return;
    } const method = String(entry?.request?.method ?? "").toUpperCase(), operation = route(method, url.pathname); if (!operation)
        return; const request = body(entry.request?.postData), evidence = f2.observations.find(value => value.entryIndex === entryIndex), compressed = evidence?.response.compressedEvidence; if (!evidence || !compressed)
        throw new Error("F4 missing F2 compressed evidence"); const time = Date.parse(entry.startedDateTime); if (!Number.isFinite(time))
        throw new Error("F4 operation lacks timestamp"); const allowed = new Set(["stage_id", "group_change_skill_set_id", "skill_type", "battle_room_id", "actor_id", "target_actor_id", "focus_target_actor_id", "slot_actor_ids", "selected_kobetu_team_num", "special_guest_ids", "tapped_ball_index", "slot_changed"]), unknownRequestFields = Object.keys(request).filter(key => !allowed.has(key)).sort(), slotActors = (Array.isArray(request.slot_actor_ids) ? request.slot_actor_ids : []).map(value => alias(actors, value, "actor")).filter((value) => value !== null); operations.push({ sequence: operations.length, entryIndex, provenance: { entryIndex, capturedAt: new Date(time).toISOString() }, operation, requestShapeSha256: sha256(JSON.stringify(evidence.request.fields)), productReferences: { stageId: operation === "start" || operation === "finish" ? integer(request.stage_id) : null, groupChangeSkillSetId: operation === "use_group_change" ? integer(request.group_change_skill_set_id) : null, skillTypeRaw: operation === "execute_trigger_skill" ? integer(request.skill_type) : null }, ephemeralReferences: { battleRoom: alias(battleRooms, request.battle_room_id, "battle-room"), actor: alias(actors, request.actor_id, "actor"), targetActor: alias(actors, request.target_actor_id, "actor"), focusTargetActor: alias(actors, request.focus_target_actor_id, "actor"), slotActors }, presence: { tappedBallIndex: request.tapped_ball_index !== undefined, slotChanged: request.slot_changed !== undefined }, omittedAccountFields: ["selected_kobetu_team_num", "special_guest_ids"], unknownRequestFields, response: { disposition: "compressed_unknown", compressedSizeBytes: compressed.compressedSizeBytes, compressedSha256: compressed.compressedSha256, dictionaryId: compressed.dictionaryId }, previousOperationEntryIndex: operations.at(-1)?.entryIndex ?? null, relationBoundary: "captured_request_then_response_order_only_no_causality_or_replay_claim" }); });
    const transitions = new Map();
    const addTransition = (from, to) => { const key = `${from}\0${to}`, current = transitions.get(key) ?? { from, to, count: 0, evidence: "observed_entry_order_only" }; current.count += 1; transitions.set(key, current); };
    operations.forEach((value, index) => addTransition(index === 0 ? "capture_start" : operations[index - 1].operation, value.operation));
    const finish = operations.find(value => value.operation === "finish");
    if (!finish)
        throw new Error("F4 missing finish");
    let afterIndex = -1, beforeIndex = -1, afterProjection = null, beforeProjection = null;
    entries.forEach((entry, index) => { let path = ""; try {
        path = new URL(entry.request.url).pathname.replace(/\/{2,}/g, "/");
    }
    catch {
        return;
    } if (path !== "/origin_episodes/99001" || String(entry.request.method).toUpperCase() !== "GET")
        return; const parsed = body(entry.response?.content), projection = productEpisodeProjection(parsed); if (index > finish.entryIndex && afterIndex < 0) {
        afterIndex = index;
        afterProjection = projection;
    }
    else if (index < finish.entryIndex) {
        beforeIndex = index;
        beforeProjection = projection;
    } });
    if (beforeIndex < 0 || afterIndex < 0)
        throw new Error("F4 missing pre/post finish episode observations");
    addTransition("finish", "post_finish_read");
    const dataset = { schemaVersion: 1, contract: "dokkan-frontier-observational-battle-protocol", contractVersion: "0.5.0", generatedAt: f2.generatedAt, generatedAtPolicy: "inherits_f2_capture_timestamp", collectionMode: "offline_local_har_no_requests_no_replay", productionMutation: false, defaultEnabled: false, replayCapability: false, authority: "observational_shapes_and_local_equality_relations_only", f2ArtifactSha256: sha256(f2Text), f2ArtifactSizeBytes: buffer_1.Buffer.byteLength(f2Text), operations, transitions: [...transitions.values()].sort((a, b) => `${a.from}:${a.to}`.localeCompare(`${b.from}:${b.to}`)), postFinishObservation: { finishEntryIndex: finish.entryIndex, episodeReadEntryIndex: afterIndex, comparedToPriorEpisodeReadEntryIndex: beforeIndex, productProjectionRelation: JSON.stringify(beforeProjection) === JSON.stringify(afterProjection) ? "equal" : "changed", accountValueComparison: "not_performed_values_excluded", causality: "not_established" } };
    const validation = validateFrontierF4(dataset, f2, f2Text);
    if (!validation.valid)
        throw new Error(`F4 validation failed: ${validation.failures.join(", ")}`);
    return dataset;
}
exports.buildFrontierF4 = buildFrontierF4;
function validateFrontierF4(dataset, f2, f2Text) { const names = ["start", "take_energy_ball", "next_turn", "use_group_change", "execute_trigger_skill", "finish"], countsByOperation = Object.fromEntries(names.map(name => [name, 0])), failures = []; if (dataset.schemaVersion !== 1 || dataset.contract !== "dokkan-frontier-observational-battle-protocol" || dataset.contractVersion !== "0.5.0" || dataset.generatedAtPolicy !== "inherits_f2_capture_timestamp" || dataset.collectionMode !== "offline_local_har_no_requests_no_replay" || dataset.productionMutation !== false || dataset.defaultEnabled !== false || dataset.replayCapability !== false || dataset.authority !== "observational_shapes_and_local_equality_relations_only")
    failures.push("dataset contract"); dataset.operations.forEach((value, index) => { countsByOperation[value.operation] += 1; if (value.sequence !== index || value.previousOperationEntryIndex !== (index === 0 ? null : dataset.operations[index - 1].entryIndex) || value.response.disposition !== "compressed_unknown" || !/^[a-f0-9]{64}$/.test(value.response.compressedSha256) || value.relationBoundary !== "captured_request_then_response_order_only_no_causality_or_replay_claim")
    failures.push("operation contract"); }); if (dataset.operations[0]?.operation !== "start" || dataset.operations.at(-1)?.operation !== "finish" || dataset.postFinishObservation.finishEntryIndex !== dataset.operations.at(-1)?.entryIndex || dataset.postFinishObservation.accountValueComparison !== "not_performed_values_excluded" || dataset.postFinishObservation.causality !== "not_established")
    failures.push("sequence boundary"); if (f2 && f2Text && (dataset.generatedAt !== f2.generatedAt || dataset.f2ArtifactSha256 !== sha256(f2Text) || dataset.f2ArtifactSizeBytes !== buffer_1.Buffer.byteLength(f2Text)))
    failures.push("F2 lineage"); return { schemaVersion: 1, valid: failures.length === 0, operationCount: dataset.operations.length, countsByOperation, transitionCount: dataset.transitions.length, compressedUnknownCount: dataset.operations.filter(value => value.response.disposition === "compressed_unknown").length, failures: [...new Set(failures)] }; }
exports.validateFrontierF4 = validateFrontierF4;
//# sourceMappingURL=frontier-f4-protocol.js.map