/** Offline theoretical sheet stats, never account progress or combat stats. */
export const HIPO_VERSION = "1.0.0";
export type Stats = [number, number, number]; // HP, ATK, DEF
export interface Square { id: number; route: number | null; bonus: Stats; requiredSa: number; choiceCount: number }
export interface Board { id: number; nodes: Square[]; roots: number[]; edges: [number, number][] }
export interface Card {
    id: number; hp_init: number; hp_max: number; atk_init: number; atk_max: number;
    def_init: number; def_max: number; lv_max: number; skill_lv_max: number; grow_type: number;
    optimal_awakening_grow_type: number | null; potential_board_id: number | null;
    rarity: number; is_selling_only: number; open_at: string | null;
}
export interface Growth { id: number; grow_type: number; lv: number; coef: number }
export interface Optimal { id: number; optimal_awakening_grow_type: number; step: number; lv_max: number; skill_lv_max: number }
export interface Route { id: number; card_id: number; awaked_card_id: number; optimal_awakening_step: number; optimal_awakening_type: number; open_at: string | null }
export interface Source {
    cards: Card[]; boards: Board[]; growths: Growth[]; optimal: Optimal[]; routes: Route[];
    provenance: { databaseSha256: string; runtimeSha256: string; snapshotVersion: string; layoutJsonSha256: Record<string, string>;
        files?: { role: string; sha256: string; sizeBytes: number }[] };
}
export const PRESETS = [
    { id: "none", openedRouteIds: [] }, { id: "no-routes", openedRouteIds: [] },
    { id: "one-route", openedRouteIds: [3] }, { id: "two-routes", openedRouteIds: [3, 0] },
    { id: "three-routes", openedRouteIds: [3, 0, 1] }, { id: "all", openedRouteIds: [0, 1, 2, 3] },
] as const;
export const ALTERNATIVE = { id: "three-routes-alternative", openedRouteIds: [3, 0, 2] } as const;
export function check(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
export function int(v: unknown, label: string, min = 0, max = 2147483647): number {
    check(Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max, `Invalid ${label}`); return v as number;
}
function unique<T>(values: T[], key: (v: T) => string | number, label: string): Map<string | number, T> {
    check(Array.isArray(values), `Missing ${label}`);
    const m = new Map<string | number, T>();
    for (const v of values) { const k = key(v); check(!m.has(k), `Duplicate ${label}`); m.set(k, v); }
    return m;
}
export function calculateMax(card: Card, level: number, coef: number | undefined): Stats | null {
    int(level, "level", 1, 1000); int(card.lv_max, "base level", 1, 1000);
    if (coef === undefined) return null;
    check(Number.isFinite(coef) && coef >= 0, "Invalid curve coefficient");
    return (["hp", "atk", "def"] as const).map(axis => {
        const initial = int(card[`${axis}_init`], "initial stat");
        const maximum = int(card[`${axis}_max`], "max stat", initial);
        const delta = maximum - initial;
        // Keep binary64 order, including the final floor. Do not interpolate HIPO bonuses.
        const linear = ((delta / (Math.max(card.lv_max, 2) - 1)) * 0.5) * (level - 1);
        const curved = (coef * delta) * 0.5;
        return int(Math.floor((linear + curved) + initial), "calculated stat");
    }) as Stats;
}

export function calculateBoard(board: Board) {
    int(board.id, "board", 1);
    check(board.nodes.length === 334 && board.roots.length === 4, "Unknown board cardinality");
    const nodes = unique(board.nodes, n => int(n.id, "square", 1), "square");
    const gates = new Set<number>(); const adjacent = new Map<number, number[]>();
    for (const n of board.nodes) {
        check(Array.isArray(n.bonus) && n.bonus.length === 3, "Invalid bonus"); n.bonus.forEach(v => int(v, "bonus", 0, 100000));
        int(n.requiredSa, "required SA", 0, 10); int(n.choiceCount, "choice count", 0, 20);
        check(n.choiceCount !== 1, "Incomplete choice");
        if (n.choiceCount) check(n.bonus.every(v => v === 0), "Choice changes raw stats");
        if (n.route !== null) { int(n.route, "route", 0, 3); check(!gates.has(n.route), "Duplicate gate"); gates.add(n.route); }
        adjacent.set(n.id, []);
    }
    check(gates.size === 4, "Missing gates");
    check(new Set(board.roots).size === 4 && board.roots.every(k => nodes.has(k) && nodes.get(k)!.route === null), "Invalid roots");
    const edges = new Set<string>();
    for (const pair of board.edges) {
        check(Array.isArray(pair) && pair.length === 2, "Invalid edge shape");
        const [a, b] = pair; check(nodes.has(a) && nodes.has(b) && a < b && !edges.has(`${a}:${b}`), "Invalid edge");
        edges.add(`${a}:${b}`); adjacent.get(a)!.push(b); adjacent.get(b)!.push(a);
    }
    const evaluate = (preset: { id: string; openedRouteIds: readonly number[] }) => {
        const visited = new Set<number>(); const todo = preset.id === "none" ? [] : [...board.roots];
        while (todo.length) {
            const k = todo.pop()!; const node = nodes.get(k)!;
            if (visited.has(k) || (node.route !== null && !preset.openedRouteIds.includes(node.route))) continue;
            visited.add(k); todo.push(...adjacent.get(k)!);
        }
        const statBonus: Stats = [0, 0, 0]; let requiredSa = 0;
        for (const k of visited) { const n = nodes.get(k)!; n.bonus.forEach((v, i) => statBonus[i] += v); requiredSa = Math.max(requiredSa, n.requiredSa); }
        return { id: preset.id, openedRouteIds: [...preset.openedRouteIds], activatedNodeCount: visited.size,
            displayPercent: Math.floor(100 * visited.size / board.nodes.length), requiredSa, statBonus };
    };
    const presets = PRESETS.map(evaluate);
    check(presets[5].activatedNodeCount === 334, "Disconnected board");
    check(presets[1].activatedNodeCount < 334 && presets[2].activatedNodeCount > presets[1].activatedNodeCount, "Bypassed gates");
    for (let i = 2; i < presets.length; i++) check(presets[i].activatedNodeCount > presets[i - 1].activatedNodeCount, "Ineffective gate");
    return { boardId: board.id, totalActivatableNodeCount: board.nodes.length, presets, alternatives: [evaluate(ALTERNATIVE)] };
}

export type Availability = "released" | "future" | "unknown";
export type ReleaseState = "base" | "eza" | "seza";
export interface ConfiguredState {
    releaseState: ReleaseState; status: "supported" | "unknown"; reason?: "missing-curve";
    availability: Availability; eligibleForDisplay: boolean; level: number;
    growthStepId: number | null; growthStep: number | null; maxStats: Stats | null; routeIds: number[];
}
export interface UnconfiguredState {
    releaseState: "eza" | "seza"; status: "ineligible"; reason: "not-configured";
    maxStats: null; eligibleForDisplay: false; availability?: undefined;
}
export type StateResult = ConfiguredState | UnconfiguredState;
export interface CardResult {
    status: "supported" | "unknown" | "ineligible"; reason?: string; boardId: number | null;
    states: Partial<Record<ReleaseState, StateResult>>;
}
export type BoardResult = ReturnType<typeof calculateBoard> & {
    evidence: { kind: "sql-and-layout"; layoutSha256: string; routeDirections: string[] }
        | { kind: "sql-graph"; routeDirections: null };
};
export interface HiddenPotentialIndex {
    schemaVersion: 1; contract: "dokkan-hidden-potential"; contractVersion: string; generatedAt: string;
    calculationVersion: "native-binary64-floor-v1"; statOrder: ["hp", "atk", "def"];
    progressKind: "theoretical-complete-presets"; source: Source["provenance"];
    boards: Record<string, BoardResult>; byCardId: Record<string, CardResult>;
}
function openTime(value: string | null): number | null {
    if (value === null) return null;
    check(typeof value === "string" && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value), "Invalid source release date");
    const iso = value.replace(" ", "T") + ".000Z"; const time = Date.parse(iso);
    check(Number.isFinite(time) && new Date(time).toISOString() === iso, "Invalid calendar date"); return time;
}
function availability(dates: (string | null)[], at: number): Availability {
    const parsed = dates.map(openTime);
    return parsed.some(t => t !== null && t > at) ? "future" : parsed.includes(null) ? "unknown" : "released";
}
export function buildIndex(source: Source, scope: number[], generatedAt: string) {
    const at = Date.parse(generatedAt); check(Number.isFinite(at) && new Date(at).toISOString() === generatedAt, "Invalid generatedAt");
    check(Array.isArray(scope) && scope.length > 0 && scope.length <= 10000 && new Set(scope).size === scope.length, "Invalid scope");
    scope.forEach(k => int(k, "card ID", 1));
    const cards = unique(source.cards, c => int(c.id, "card ID", 1), "card");
    check(source.cards.every(c => scope.includes(c.id)), "Source outside roster");
    const curves = unique(source.growths, g => `${int(g.grow_type, "grow type", 1)}:${int(g.lv, "growth level", 1, 1000)}`, "curve");
    for (const g of curves.values()) check(Number.isFinite(g.coef) && g.coef >= 0, "Invalid coefficient");
    const optimal = unique(source.optimal, g => `${int(g.optimal_awakening_grow_type, "optimal type", 1)}:${int(g.step, "step", 1, 100)}`, "optimal");
    const boardInputs = unique(source.boards, b => int(b.id, "board ID", 1), "board");
    const boardResults = new Map([...boardInputs].map(([k, b]) => [k, calculateBoard(b)]));
    unique(source.routes, r => int(r.id, "route ID", 1), "route ID");
    unique(source.routes, r => `${r.card_id}:${r.optimal_awakening_step}`, "card route step");
    const statusCounts: Record<string, number> = {}; const stateCounts: Record<string, number> = {};
    const byCardId: Record<string, CardResult> = {}; const usedBoards = new Set<number>(); const cardsByBoard: Record<string, number> = {};
    for (const cardId of [...scope].sort((a, b) => a - b)) {
        const c = cards.get(cardId); let result: CardResult;
        if (!c) result = { status: "unknown", reason: "missing-source-card", boardId: null, states: {} };
        else if (cardId >= 4000000 || c.rarity < 0 || c.rarity > 5 || c.is_selling_only !== 0 || c.hp_init <= 1) {
            result = { status: "ineligible", reason: "outside-playable-sheet", boardId: c.potential_board_id, states: {} };
        } else {
            if (c.potential_board_id !== null) {
                check(boardResults.has(c.potential_board_id), "Unknown board join"); usedBoards.add(c.potential_board_id);
                cardsByBoard[c.potential_board_id] = (cardsByBoard[c.potential_board_id] || 0) + 1;
            }
            const routes = source.routes.filter(r => r.card_id === cardId).sort((a, b) => a.optimal_awakening_step - b.optimal_awakening_step);
            for (const r of routes) check(r.awaked_card_id === cardId && [1, 2].includes(r.optimal_awakening_type), "Invalid optimal identity/state");
            if (routes.length) check(routes.every((r, i) => r.optimal_awakening_step === i + 1), "Incomplete optimal chain");
            const state = (releaseState: ReleaseState, level: number, step: Optimal | null, dependencies: Route[]): ConfiguredState => {
                const av = availability([c.open_at, ...dependencies.map(r => r.open_at)], at);
                const maximum = calculateMax(c, level, curves.get(`${c.grow_type}:${level}`)?.coef);
                const status = maximum === null ? "unknown" : "supported";
                const key = `${releaseState}:${status}:${av}`; stateCounts[key] = (stateCounts[key] || 0) + 1;
                return { releaseState, status, ...(maximum === null ? { reason: "missing-curve" } : {}), availability: av,
                    eligibleForDisplay: av === "released" && maximum !== null,
                    level, growthStepId: step?.id ?? null, growthStep: step?.step ?? null,
                    maxStats: maximum, routeIds: dependencies.map(r => r.id) };
            };
            const states: Partial<Record<ReleaseState, StateResult>> = { base: state("base", c.lv_max, null, []) };
            for (const [kind, name] of [[1, "eza"], [2, "seza"]] as const) {
                const selected = routes.filter(r => r.optimal_awakening_type === kind).at(-1);
                if (!selected) {
                    states[name] = { releaseState: name, status: "ineligible", reason: "not-configured", maxStats: null, eligibleForDisplay: false };
                    const key = `${name}:ineligible:not-configured`; stateCounts[key] = (stateCounts[key] || 0) + 1; continue;
                }
                const g = optimal.get(`${c.optimal_awakening_grow_type}:${selected.optimal_awakening_step}`);
                check(g, "Missing optimal join");
                states[name] = state(name, g.lv_max, g, routes.filter(r => r.optimal_awakening_step <= g.step));
            }
            if (states.seza.status === "supported") check(states.eza.status === "supported" && JSON.stringify(states.seza.maxStats) === JSON.stringify(states.eza.maxStats), "Unsupported SEZA stat change");
            result = { status: c.potential_board_id === null ? "ineligible" : "supported",
                ...(c.potential_board_id === null ? { reason: "no-potential-board" } : {}), boardId: c.potential_board_id, states };
        }
        byCardId[String(cardId)] = result; const statusKey = `${result.status}:${result.reason || "board-present"}`; statusCounts[statusKey] = (statusCounts[statusKey] || 0) + 1;
    }
    const boards: Record<string, BoardResult> = {};
    for (const id of [...usedBoards].sort((a, b) => a - b)) {
        const layoutSha256 = source.provenance.layoutJsonSha256[String(id)];
        boards[String(id)] = { ...boardResults.get(id), evidence: layoutSha256 ? { kind: "sql-and-layout", layoutSha256,
            routeDirections: ["top-left", "top-right", "bottom-left", "bottom-right"] } : { kind: "sql-graph", routeDirections: null } };
    }
    const index: HiddenPotentialIndex = { schemaVersion: 1, contract: "dokkan-hidden-potential", contractVersion: HIPO_VERSION, generatedAt,
        calculationVersion: "native-binary64-floor-v1", statOrder: ["hp", "atk", "def"],
        progressKind: "theoretical-complete-presets", source: source.provenance, boards, byCardId };
    return { index, coverage: { cardCount: scope.length, boardCount: usedBoards.size, sourceBoardCount: source.boards.length, statusCounts, stateCounts, cardsByBoard } };
}

/** Exact ID lookup; callers can hide optional absent indices. Never aliases transformed IDs. */
export function lookup(index: ReturnType<typeof buildIndex>["index"], cardId: string, state: "base" | "eza" | "seza", presetId: string) {
    const card = index.byCardId[cardId]; if (!card || card.status !== "supported") return null;
    const release = card.states[state]; if (release?.status !== "supported" || !release.eligibleForDisplay) return null;
    const board = index.boards[String(card.boardId)];
    const preset = [...board.presets, ...board.alternatives].find(p => p.id === presetId);
    if (!preset) return null;
    return { cardId, boardId: card.boardId, releaseState: state, level: release.level,
        displayPercent: preset.displayPercent, stats: release.maxStats.map((v: number, i: number) => v + preset.statBonus[i]) as Stats };
}
