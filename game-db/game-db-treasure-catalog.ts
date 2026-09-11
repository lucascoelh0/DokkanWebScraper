import { createHash } from "crypto";
import { gzipSync } from "zlib";
import { GameDbRow } from "./game-db-source";
import { buildTreasureModeSources, TreasureModeTables } from "./game-db-treasure-mode-sources";

export interface TreasureSourceTables extends Partial<TreasureModeTables> {
    treasure_items: GameDbRow[]; missions: GameDbRow[]; mission_rewards: GameDbRow[];
    areas: GameDbRow[]; quests: GameDbRow[]; sugoroku_maps: GameDbRow[];
    sugoroku_map_boss_drop_items: GameDbRow[]; quest_drop_item_views: GameDbRow[];
}
export interface TreasureSourceEntry {
    id: string; treasureId: string; kind: "mission" | "stage-drop" | "mode-reward"; title: string;
    description: string | null; quantity: number | null; stageId: string | null;
    areaId: string | null; missionId: string | null; difficulty: number | null;
    startsAt: string | null; endsAt: string | null;
    mode?: "world-tournament" | "ultimate-clash";
    editionId?: string; editionName?: string | null;
    rewardType?: "mission" | "local-ranking" | "ranking";
}
const digest = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const id = (v: string) => { if (!/^[1-9]\d*$/.test(v)) throw Error("Invalid ID"); return v; };
const label = (v: string) => { if (!v?.trim() || v.length > 8192) throw Error("Invalid text"); return v.replace(/\s*\n\s*/g, " ").trim(); };
function index(rows: GameDbRow[]) {
    const map = new Map<string, GameDbRow>();
    for (const r of rows) { if (map.has(id(r.id))) throw Error("Duplicate ID"); map.set(r.id, r); }
    return map;
}
function instant(raw: string): string | null {
    if (!raw || raw === "2038-01-01 00:00:00") return null;
    if (!/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(raw)) throw Error("Invalid date");
    const iso = raw.replace(" ", "T") + "Z";
    const date = new Date(iso);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 19) !== iso.slice(0, 19)) throw Error("Invalid date");
    return date.toISOString();
}
/** Offline projection; drop quantities/rates and current event availability are not inferred. */
export function buildTreasureCatalog(t: TreasureSourceTables, snapshot: string, databaseSha256: string) {
    if (!/^\d+$/.test(snapshot) || !/^[a-f0-9]{64}$/.test(databaseSha256)) throw Error("Invalid provenance");
    const treasures = index(t.treasure_items), missions = index(t.missions), quests = index(t.quests);
    const maps = index(t.sugoroku_maps), areas = index(t.areas);
    const sources = new Map<string, TreasureSourceEntry>();
    const add = (s: TreasureSourceEntry) => {
        if (!treasures.has(s.treasureId)) throw Error("Unknown treasure");
        if (sources.has(s.id)) throw Error("Duplicate source");
        sources.set(s.id, s);
    };
    for (const r of t.mission_rewards.filter(r => r.item_type === "TreasureItem")) {
        const m = missions.get(id(r.mission_id)); if (!m) throw Error("Missing mission");
        const quantity = Number(r.quantity);
        if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 2147483647) throw Error("Invalid quantity");
        const startsAt = instant(m.start_at), endsAt = instant(m.end_at);
        if (startsAt && endsAt && startsAt >= endsAt) throw Error("Invalid interval");
        const areaId = m.area_id ? id(m.area_id) : null;
        if (areaId && !areas.has(areaId)) throw Error("Unknown mission area");
        add({ id: `mission:${id(r.id)}`, treasureId: id(r.item_id), kind: "mission",
            title: label(m.name), description: m.description?.trim() ? label(m.description) : null,
            quantity, stageId: null, areaId, missionId: m.id, difficulty: null, startsAt, endsAt });
    }
    const addDrop = (treasureId: string, stageId: string, expectedQuest: string) => {
        const map = maps.get(id(stageId)), quest = quests.get(id(expectedQuest));
        if (!map || !quest || map.quest_id !== quest.id) throw Error("Missing/mismatched drop stage");
        const area = areas.get(id(quest.area_id)); if (!area) throw Error("Missing drop area");
        const key = `drop:${treasureId}:${stageId}`;
        if (sources.has(key)) return; // Boss and displayed-drop evidence describe the same source.
        const difficulty = Number(map.difficulty);
        if (!Number.isSafeInteger(difficulty) || difficulty < 0) throw Error("Invalid difficulty");
        add({ id: key, treasureId: id(treasureId), kind: "stage-drop", title: label(quest.name),
            description: label(area.name), quantity: null, stageId, areaId: area.id,
            missionId: null, difficulty, startsAt: instant(quest.start_at), endsAt: null });
    };
    for (const r of t.sugoroku_map_boss_drop_items.filter(r => r.item_type === "TreasureItem")) {
        addDrop(r.item_id, r.sugoroku_map_id, r.quest_id);
    }
    for (const r of t.quest_drop_item_views) {
        const difficulties: unknown = JSON.parse(r.difficulties);
        if (!Array.isArray(difficulties) || difficulties.some(d => !Number.isSafeInteger(d) || d < 0)) throw Error("Invalid difficulties");
        for (let n = 1; n <= 6; n++) if (r[`item${n}_type`] === "TreasureItem") {
            const matching = [...maps.values()].filter(m => m.quest_id === r.quest_id && difficulties.includes(Number(m.difficulty)));
            if (!matching.length) throw Error("Displayed drop has no stage");
            matching.forEach(m => addDrop(r[`item${n}_id`], m.id, r.quest_id));
        }
    }
    if (t.budokais) buildTreasureModeSources(t as TreasureModeTables).forEach(add);
    const content = {
        schemaVersion: 1, contract: "dokkan-treasure-catalog", contractVersion: "1.1.0",
        sourceSnapshotVersion: snapshot, sourceDatabaseSha256: databaseSha256,
        treasures: [...treasures.values()].map(r => {
            const suffix = id(r.image_suffix_number).padStart(5, "0");
            return { id: r.id, name: label(r.name), description: label(r.description),
                iconAssetPath: `item/other/en/thumb/thumb_trade_jewel_${suffix}/thumb_trade_jewel_${suffix}.png` };
        }).sort((a,b) => Number(a.id)-Number(b.id)),
        sources: [...sources.values()].sort((a,b) => a.id.localeCompare(b.id, "en")),
    };
    const datasetVersion = `${snapshot}-${digest(Buffer.from(JSON.stringify(content))).slice(0,16)}`;
    const payload = Buffer.from(JSON.stringify({ ...content, datasetVersion }));
    const compressed = gzipSync(payload, { level: 9 });
    if (payload.length > 8*1024*1024 || compressed.length > 2*1024*1024) throw Error("Catalog too large");
    const manifest = { schemaVersion: 1, contract: content.contract, contractVersion: content.contractVersion,
        datasetVersion, sourceSnapshotVersion: snapshot, sourceDatabaseSha256: databaseSha256,
        sha256: digest(compressed), sizeBytes: compressed.length, expandedSizeBytes: payload.length };
    return { manifest, compressed, catalog: { ...content, datasetVersion } };
}
