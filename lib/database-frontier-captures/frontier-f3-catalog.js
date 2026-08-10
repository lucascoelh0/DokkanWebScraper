"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateFrontierF3 = exports.buildFrontierF3 = void 0;
const crypto_1 = require("crypto");
const buffer_1 = require("buffer");
function sha256(value) { return (0, crypto_1.createHash)("sha256").update(value).digest("hex"); }
function integer(value) { return Number.isSafeInteger(value) && value > 0 ? value : null; }
function nonNegativeInteger(value) { return Number.isSafeInteger(value) && value >= 0 ? value : null; }
function ids(value) { return [...new Set((Array.isArray(value) ? value : []).map(integer).filter((item) => item !== null))].sort((a, b) => a - b); }
function rawType(value) { return typeof value === "string" && /^[A-Za-z0-9_:]{1,160}$/.test(value) ? value : "unknown"; }
function provenance(entry, entryIndex) { const time = typeof entry?.startedDateTime === "string" ? Date.parse(entry.startedDateTime) : NaN; if (!Number.isFinite(time))
    throw new Error("F3 target entry lacks timestamp"); return { entryIndex, capturedAt: new Date(time).toISOString() }; }
function json(content) { if (!content || typeof content.text !== "string" || content.encoding === "base64" || !(String(content.mimeType ?? "").toLowerCase().startsWith("application/json")))
    return null; try {
    return JSON.parse(content.text);
}
catch {
    return null;
} }
function mergeProvenance(current, next) { return [...new Map([...current, next].map(value => [value.entryIndex, value])).values()].sort((a, b) => a.entryIndex - b.entryIndex); }
function uniqueById(values) { const result = new Map(); for (const value of values) {
    const current = result.get(value.id);
    if (!current)
        result.set(value.id, value);
    else {
        const { provenance: _left, ...left } = current, { provenance: _right, ...right } = value;
        if (JSON.stringify(left) !== JSON.stringify(right))
            throw new Error(`F3 conflicting repeated structural entity ${value.id}`);
        current.provenance = mergeProvenance(current.provenance, value.provenance[0]);
    }
} return [...result.values()].sort((a, b) => a.id - b.id); }
function limitations(values, owner) { return (Array.isArray(values) ? values : []).flatMap(value => { const id = integer(value?.id); if (id === null)
    return []; const conditions = value?.conditions && typeof value.conditions === "object" ? value.conditions : {}; return [{ id, owner, episodeId: owner === "episode" ? integer(value?.origin_episode_id) : null, rawType: rawType(value?.type), allowedCategoryIds: ids(conditions.allowed_category_ids), forbiddenCardIds: ids(conditions.forbid_card_ids), requiredCardIds: ids(conditions.requiring_card_ids), requiredCount: nonNegativeInteger(conditions.required_count) }]; }).sort((a, b) => a.id - b.id); }
function safeAssetPath(pathname) { const collapsed = pathname.replace(/\/{2,}/g, "/"); return /^\/banners\/en\/news\/(?:origin|kobetsuhp)_[A-Za-z0-9_.-]+\.(?:png|jpe?g)$/i.test(collapsed) ? collapsed : null; }
function buildFrontierF3(harText, f2, f2Text) {
    const entries = JSON.parse(harText)?.log?.entries;
    if (!Array.isArray(entries))
        throw new Error("F3 invalid HAR");
    const seriesRaw = [], episodeRelations = new Map(), detailEpisodeIds = new Set(), pagesRaw = [], nodesRaw = [], battlesRaw = [], briefings = [], availability = [], assets = [], accountCounts = new Map();
    const account = (owner, field, proof, count = 1) => { const key = `${owner}\0${field}`, current = accountCounts.get(key) ?? { observationCount: 0, provenance: [] }; current.observationCount += count; current.provenance = mergeProvenance(current.provenance, proof); accountCounts.set(key, current); };
    entries.forEach((entry, entryIndex) => {
        let url;
        try {
            url = new URL(entry?.request?.url);
        }
        catch {
            return;
        }
        const method = String(entry?.request?.method ?? "").toUpperCase(), path = url.pathname.replace(/\/{2,}/g, "/"), body = json(entry?.response?.content), proof = provenance(entry, entryIndex);
        if (url.hostname.toLowerCase() === "cf.ishin-global.aktsk.com") {
            const sanitizedPath = safeAssetPath(path);
            if (sanitizedPath)
                assets.push({ sanitizedPath, status: Number.isSafeInteger(entry?.response?.status) ? entry.response.status : 0, provenance: proof, relationToCatalog: "unproved_temporal_delivery_observation" });
            return;
        }
        if (url.hostname.toLowerCase() !== "ishin-global.aktsk.com" || method !== "GET" || body === null)
            return;
        if (path === "/origin_series") {
            for (const value of Array.isArray(body.origin_series) ? body.origin_series : []) {
                const id = integer(value?.id);
                if (id === null)
                    continue;
                const episodeIds = ids((value.origin_episodes ?? []).map((item) => item?.id));
                seriesRaw.push({ id, episodeIds, provenance: [proof] });
                for (const episodeId of episodeIds) {
                    const existing = episodeRelations.get(episodeId);
                    if (existing !== undefined && existing !== id)
                        throw new Error("F3 episode has conflicting series relation");
                    episodeRelations.set(episodeId, id);
                }
                if (value.user_origin_series !== undefined)
                    account("series", "user_origin_series", proof);
                for (const episode of Array.isArray(value.origin_episodes) ? value.origin_episodes : [])
                    if (episode?.user_origin_episode !== undefined)
                        account("episode", "user_origin_episode", proof);
            }
            availability.push({ owner: "series_index", ownerId: null, nextOpenAtRaw: nonNegativeInteger(body.next_open_at), provenance: proof, authority: "capture_time_global_field_not_universal_current_availability" });
        }
        if (/^\/origin_episodes\/\d+$/.test(path)) {
            const requestedId = integer(Number(path.split("/").at(-1)));
            if (requestedId === null || !body.origin_episode)
                return;
            detailEpisodeIds.add(requestedId);
            availability.push({ owner: "episode", ownerId: requestedId, nextOpenAtRaw: nonNegativeInteger(body.origin_episode.next_open_at), provenance: proof, authority: "capture_time_global_field_not_universal_current_availability" });
            if (body.origin_episode.progress !== undefined)
                account("episode", "progress", proof);
            const pages = Array.isArray(body.origin_episode.origin_pages) ? body.origin_episode.origin_pages : [];
            pages.forEach((page, pageOrdinal) => { const pageId = integer(page?.id); if (pageId === null)
                return; pagesRaw.push({ id: pageId, episodeId: requestedId, observedOrdinal: pageOrdinal, provenance: [proof] }); const spots = Array.isArray(page.origin_spots) ? page.origin_spots : []; spots.forEach((spot, observedOrdinal) => { const nodeId = integer(spot?.id); if (nodeId === null)
                return; const battleId = integer(spot?.origin_battle?.id), enemyCardId = integer(spot?.enemy_card_id), unlockMissionIds = ids((spot?.origin_battle?.unlock_missions ?? []).map((mission) => mission?.mission_id)); nodesRaw.push({ id: nodeId, pageId, observedOrdinal, numberRaw: nonNegativeInteger(spot?.number), previousNodeId: integer(spot?.prev_origin_spot_id), spotTypeRaw: rawType(spot?.spot_type), position: { x: Number.isFinite(spot?.pos_x) ? Number(spot.pos_x) : 0, y: Number.isFinite(spot?.pos_y) ? Number(spot.pos_y) : 0 }, enemyCardId, originBattleId: battleId, provenance: [proof] }); if (battleId !== null) {
                battlesRaw.push({ id: battleId, nodeId, enemyCardId, unlockMissionIds, provenance: [proof] });
                if (spot.origin_battle?.user_origin_battle !== undefined)
                    account("battle", "user_origin_battle", proof);
                for (const mission of Array.isArray(spot.origin_battle?.unlock_missions) ? spot.origin_battle.unlock_missions : [])
                    if (mission?.is_completed !== undefined)
                        account("battle", "unlock_mission.is_completed", proof);
            } }); });
        }
        if (path === "/origin_battles/briefing") {
            briefings.push({ provenance: proof, groupChangeSymbolId: integer(body.group_change_symbol_id), heatUpGimmickSetId: integer(body.heat_up_gimmick_set_id), limitations: [...limitations(body.origin_episode_limitations, "episode"), ...limitations(body.origin_battle_limitations, "battle")], associationBoundary: "no_stage_id_in_request_temporal_adjacency_not_a_join", accountSubtreesOmitted: ["last_deck_cards", "special_guests"] });
            if (body.last_deck_cards !== undefined)
                account("briefing", "last_deck_cards", proof);
            if (body.special_guests !== undefined)
                account("briefing", "special_guests", proof);
        }
    });
    const series = uniqueById(seriesRaw), episodes = [...episodeRelations.entries()].map(([id, seriesId]) => ({ id, seriesId, detailObserved: detailEpisodeIds.has(id), provenance: series.find(value => value.id === seriesId)?.provenance ?? [] })).sort((a, b) => a.id - b.id), pages = uniqueById(pagesRaw), nodes = uniqueById(nodesRaw), battles = uniqueById(battlesRaw), accountObservations = [...accountCounts.entries()].map(([key, observation]) => { const [owner, field] = key.split("\0"); return { owner, field, observationCount: observation.observationCount, provenance: observation.provenance, valuesOmitted: true, authority: "account_scoped_observation_only" }; }).sort((a, b) => `${a.owner}:${a.field}`.localeCompare(`${b.owner}:${b.field}`));
    const dataset = { schemaVersion: 1, contract: "dokkan-frontier-offline-catalog", contractVersion: "0.4.0", generatedAt: f2.generatedAt, generatedAtPolicy: "inherits_f2_capture_timestamp", collectionMode: "offline_local_har_no_requests_no_replay", productionMutation: false, defaultEnabled: false, authority: "capture_bound_product_facts_and_separate_account_shape_observations", identityPolicy: "numeric_structural_ids_only_names_and_titles_excluded", f2ArtifactSha256: sha256(f2Text), f2ArtifactSizeBytes: buffer_1.Buffer.byteLength(f2Text), series, episodes, pages, nodes, battles, briefings, availability: availability.sort((a, b) => a.provenance.entryIndex - b.provenance.entryIndex), accountObservations, assets: [...new Map(assets.map(value => [`${value.sanitizedPath}\0${value.status}\0${value.provenance.entryIndex}`, value])).values()].sort((a, b) => a.provenance.entryIndex - b.provenance.entryIndex), rewardCoverage: { status: "coverage_gap", reason: "finish_response_compressed_unknown_no_reward_projection" } };
    const validation = validateFrontierF3(dataset, f2, f2Text);
    if (!validation.valid)
        throw new Error(`F3 validation failed: ${validation.failures.join(", ")}`);
    return dataset;
}
exports.buildFrontierF3 = buildFrontierF3;
function validateFrontierF3(dataset, f2, f2Text) { const failures = []; if (dataset.schemaVersion !== 1 || dataset.contract !== "dokkan-frontier-offline-catalog" || dataset.contractVersion !== "0.4.0" || dataset.generatedAtPolicy !== "inherits_f2_capture_timestamp" || dataset.collectionMode !== "offline_local_har_no_requests_no_replay" || dataset.productionMutation !== false || dataset.defaultEnabled !== false || dataset.identityPolicy !== "numeric_structural_ids_only_names_and_titles_excluded" || !/^[a-f0-9]{64}$/.test(dataset.f2ArtifactSha256) || dataset.f2ArtifactSizeBytes <= 0 || dataset.rewardCoverage.status !== "coverage_gap")
    failures.push("dataset contract"); for (const values of [dataset.series, dataset.episodes, dataset.pages, dataset.nodes, dataset.battles])
    if (new Set(values.map(value => value.id)).size !== values.length)
        failures.push("duplicate identity"); const series = new Set(dataset.series.map(value => value.id)), episodes = new Set(dataset.episodes.map(value => value.id)), pages = new Set(dataset.pages.map(value => value.id)), nodes = new Set(dataset.nodes.map(value => value.id)), battles = new Set(dataset.battles.map(value => value.id)); let danglingRelationCount = dataset.episodes.filter(value => !series.has(value.seriesId)).length + dataset.pages.filter(value => !episodes.has(value.episodeId)).length + dataset.nodes.filter(value => !pages.has(value.pageId) || value.previousNodeId !== null && !nodes.has(value.previousNodeId)).length + dataset.battles.filter(value => !nodes.has(value.nodeId) || !dataset.nodes.some(node => node.id === value.nodeId && node.originBattleId === value.id)).length; if (danglingRelationCount !== 0)
    failures.push("dangling relation"); if (dataset.accountObservations.some(value => value.valuesOmitted !== true || value.authority !== "account_scoped_observation_only" || value.provenance.length === 0 || value.provenance.some(proof => !Number.isSafeInteger(proof.entryIndex) || !Number.isFinite(Date.parse(proof.capturedAt)))) || dataset.briefings.some(value => value.associationBoundary !== "no_stage_id_in_request_temporal_adjacency_not_a_join"))
    failures.push("authority boundary"); if (f2 && f2Text && (dataset.generatedAt !== f2.generatedAt || dataset.f2ArtifactSha256 !== sha256(f2Text) || dataset.f2ArtifactSizeBytes !== buffer_1.Buffer.byteLength(f2Text)))
    failures.push("F2 lineage"); return { schemaVersion: 1, valid: failures.length === 0, seriesCount: dataset.series.length, episodeCount: dataset.episodes.length, detailedEpisodeCount: dataset.episodes.filter(value => value.detailObserved).length, pageCount: dataset.pages.length, nodeCount: dataset.nodes.length, battleCount: dataset.battles.length, missionReferenceCount: new Set(dataset.battles.flatMap(value => value.unlockMissionIds)).size, briefingCount: dataset.briefings.length, assetObservationCount: dataset.assets.length, danglingRelationCount, failures: [...new Set(failures)] }; }
exports.validateFrontierF3 = validateFrontierF3;
//# sourceMappingURL=frontier-f3-catalog.js.map