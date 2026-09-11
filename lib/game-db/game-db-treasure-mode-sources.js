"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildTreasureModeSources = exports.TREASURE_MODE_TABLES = void 0;
exports.TREASURE_MODE_TABLES = ["budokais", "budokai_missions", "budokai_mission_rewards",
    "budokai_box_rankings", "budokai_box_ranking_reward_ranges", "budokai_box_ranking_rewards",
    "budokai_ranking_gift_sets", "budokai_ranking_gifts", "rmbattle_missions", "rmbattle_mission_rewards"];
const id = (v) => { if (!/^[1-9]\d*$/.test(v))
    throw Error("Invalid mode ID"); return v; };
const text = (v) => { if (!v?.trim() || v.length > 8192)
    throw Error("Invalid mode text"); return v.replace(/\s*\n\s*/g, " ").trim(); };
const positive = (v) => { const n = Number(v); if (!/^\d+$/.test(v) || !Number.isSafeInteger(n) || n <= 0 || n > 2147483647)
    throw Error("Invalid reward value"); return n; };
function index(rows) {
    const result = new Map();
    for (const row of rows) {
        if (result.has(id(row.id)))
            throw Error("Duplicate mode ID");
        result.set(row.id, row);
    }
    return result;
}
function date(raw) {
    if (!raw || raw === "2038-01-01 00:00:00")
        return null;
    if (!/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(raw))
        throw Error("Invalid mode date");
    const iso = raw.replace(" ", "T") + "Z", parsed = new Date(iso);
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 19) !== iso.slice(0, 19))
        throw Error("Invalid mode date");
    return parsed.toISOString();
}
/** Edition IDs are identities, never assumed to be the displayed edition number. */
function buildTreasureModeSources(t) {
    const editions = index(t.budokais), missions = index(t.budokai_missions);
    const boxes = index(t.budokai_box_rankings), ranges = index(t.budokai_box_ranking_reward_ranges);
    const sets = index(t.budokai_ranking_gift_sets), clash = index(t.rmbattle_missions);
    const result = [];
    const get = (map, key) => {
        const row = map.get(id(key));
        if (!row)
            throw Error("Missing mode reward parent");
        return row;
    };
    const add = (r, prefix, editionId, title, rewardType, missionId = null) => {
        const mode = prefix === "clash" ? "ultimate-clash" : "world-tournament";
        const edition = mode === "world-tournament" ? editions.get(id(editionId)) : undefined;
        const startsAt = edition ? date(edition.start_at) : null, endsAt = edition ? date(edition.end_at) : null;
        if (startsAt && endsAt && startsAt >= endsAt)
            throw Error("Invalid mode interval");
        result.push({ id: `${prefix}:${id(r.id)}`, treasureId: id(r.item_id), kind: "mode-reward",
            title: text(title), description: null, quantity: positive(r.quantity), stageId: null, areaId: null,
            missionId, difficulty: null, startsAt, endsAt, mode, editionId: id(editionId),
            editionName: edition ? text(edition.name) : null, rewardType });
    };
    for (const r of t.budokai_mission_rewards.filter(r => r.item_type === "TreasureItem")) {
        const m = get(missions, r.budokai_mission_id);
        add(r, "wt-mission", m.budokai_id, m.name, "mission", m.id);
    }
    for (const r of t.budokai_box_ranking_rewards.filter(r => r.item_type === "TreasureItem")) {
        const range = get(ranges, r.budokai_box_ranking_reward_range_id);
        const box = get(boxes, range.budokai_box_ranking_id);
        get(editions, box.budokai_id);
        const first = positive(range.start_value), last = positive(range.end_value);
        if (first > last)
            throw Error("Invalid local ranking interval");
        add(r, "wt-local", box.budokai_id, `Local ranking: ${first === last ? first : `${first}–${last}`}`, "local-ranking");
    }
    for (const r of t.budokai_ranking_gifts.filter(r => r.item_type === "TreasureItem")) {
        const set = get(sets, r.budokai_ranking_gift_set_id);
        get(editions, set.budokai_id);
        add(r, "wt-ranking", set.budokai_id, `Ranking: ${text(set.ranking)}`, "ranking");
    }
    for (const r of t.rmbattle_mission_rewards.filter(r => r.item_type === "TreasureItem")) {
        const m = get(clash, r.rmbattle_mission_id);
        add(r, "clash", m.rmbattle_id, m.description || m.name, "mission", m.id);
    }
    return result;
}
exports.buildTreasureModeSources = buildTreasureModeSources;
//# sourceMappingURL=game-db-treasure-mode-sources.js.map