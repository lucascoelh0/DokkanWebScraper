import { strict as assert } from "assert";
import { readFileSync } from "fs";
import { basename, dirname, resolve } from "path";
import { tmpdir } from "os";
import { it as test } from "mocha";
import { buildIndex, calculateBoard, calculateMax, lookup, Source, Board } from "./game-db-hidden-potential-core";

// tsc emits this spec to lib/game-db, but the fixture remains a source asset.
// Resolve the owning repository in both layouts, never against the caller's cwd.
const REPO = resolve(__dirname, basename(dirname(__dirname)) === "lib" ? "../.." : "..");
const FIXTURE_PATH = resolve(REPO, "game-db/fixtures/hidden-potential/source.json");

export function fixture(): Source {
    const raw = JSON.parse(readFileSync(FIXTURE_PATH, "utf8"));
    const commonEdges = raw.boards.find(b => b.id === 20).edges;
    raw.boards = raw.boards.map(b => ({ id: b.id,
        nodes: b.nodes.map(([offset, route, hp, atk, def, requiredSa, choiceCount]) => ({ id: b.id * 100000 + offset, route, bonus: [hp, atk, def], requiredSa, choiceCount })),
        roots: b.roots.map(k => b.id * 100000 + k),
        edges: (b.edges === "same-as-20" ? commonEdges : b.edges).map(([a, z]) => [a + b.id * 100000, z + b.id * 100000]),
    }));
    return raw;
}
const at = "2026-09-09T12:00:00.000Z";
const board = (id: number) => fixture().boards.find(b => b.id === id)!;

test("source fixture resolves independently of the working directory", () => {
    const expected = fixture();
    const previous = process.cwd();
    try {
        process.chdir(tmpdir());
        assert.deepEqual(fixture(), expected);
    } finally {
        process.chdir(previous);
    }
});

// Fixed values transcribed from the first-party investigation, not calculated by this module.
const golden = {
    20: [[2000,2000,2000],[3300,3700,4100],[3600,4000,4400],[3910,4700,4710],[4600,5000,5400]],
    21: [[2000,2000,2000],[3300,4100,3700],[3600,4400,4000],[3910,5100,4310],[4600,5400,5000]],
    22: [[2000,2000,2000],[3700,3700,3700],[4000,4000,4000],[4310,4700,4310],[5000,5000,5000]],
    23: [[2000,2000,2000],[3700,4100,3300],[4000,4400,3600],[4310,5100,3910],[5000,5400,4600]],
    24: [[2000,2000,2000],[4100,3700,3300],[4400,4000,3600],[4710,4700,3910],[5400,5000,4600]],
    201: [[1600,1600,1600],[2960,2960,2960],[3200,3200,3200],[3448,3760,3448],[4000,4000,4000]],
};
for (const [id, values] of Object.entries(golden)) test(`fixed stat golden board ${id}`, () => {
    const r = calculateBoard(board(Number(id)));
    assert.deepEqual(r.presets.map(p => p.statBonus), [[0,0,0], ...values]);
    assert.deepEqual(r.presets.map(p => p.displayPercent), Number(id) === 201 ? [0,57,70,79,90,100] : [0,55,69,79,90,100]);
    assert.equal(r.alternatives[0].displayPercent, 89);
});
test("physical nodes, not choices or graph segments", () => {
    const b = board(201); const before = calculateBoard(b);
    b.nodes.filter(n => n.choiceCount > 0).forEach(n => n.choiceCount = 12);
    assert.deepEqual(calculateBoard(b), before);
    assert.deepEqual(before.presets.map(p => p.activatedNodeCount), [0,191,235,265,301,334]);
    assert.deepEqual(before.alternatives[0].statBonus, [3752,3440,3752]);
    assert.deepEqual(calculateBoard(board(20)).alternatives[0].statBonus, [4290,4300,5090]);
});
const mutations: [string, (b: Board) => void][] = [
    ["duplicate node", b => b.nodes[1] = b.nodes[0]], ["missing node", b => b.nodes.pop()],
    ["bad root", b => b.roots[0] = -1], ["duplicate root", b => b.roots[1] = b.roots[0]],
    ["missing gate", b => b.nodes.find(n => n.route === 3)!.route = null],
    ["invalid edge", b => b.edges.push([0,1])], ["self edge", b => b.edges.push([b.roots[0],b.roots[0]])],
    ["duplicate edge", b => b.edges.push(b.edges[0])], ["disconnected", b => b.edges = []],
    ["choice changes stats", b => { const n = b.nodes.find(n => n.choiceCount)!; n.bonus[0] = 1; }],
    ["new SA requirement", b => b.nodes[0].requiredSa = 11], ["nan stat", b => b.nodes[0].bonus[0] = NaN],
];
for (const [label, mutate] of mutations) test(`reject ${label}`, () => { const b = board(20); mutate(b); assert.throws(() => calculateBoard(b)); });
test("maximum base/EZA/SEZA and LR fixed matrix", () => {
    const s = fixture(); const result = buildIndex(s, s.cards.map(c => c.id), at).index;
    const expected = {
        1034481: { base: [13350,10700,7825] },
        1010361: { base: [6590,6590,3044], eza: [8503,8527,3928] },
        1003211: { base: [9500,8672,4623], eza: [12527,11111,5796], seza: [12527,11111,5796] },
        1004651: { base: [9792,8432,6034], eza: [12589,11007,7443], seza: [12589,11007,7443] },
        1003761: { base: [9123,7732,5432], eza: [11694,10110,6879] },
        1003801: { base: [9843,9243,4532], eza: [12785,11987,5769], seza: [12785,11987,5769] },
        1007471: { base: [15800,15100,8220], eza: [15800,15100,8220], seza: [15800,15100,8220] },
    };
    for (const [id, states] of Object.entries(expected)) for (const [state, stats] of Object.entries(states)) assert.deepEqual(result.byCardId[id].states[state].maxStats, stats);
    assert.deepEqual(lookup(result, "1010361", "eza", "one-route")!.stats, [11463,11487,6888]);
    assert.equal(lookup(result, "1010361", "eza", "one-route")!.displayPercent, 70);
    assert.equal(lookup(result, "91010361", "base", "none"), null);
});
test("missing curve is null/unknown, no source alias or zero", () => {
    const s = fixture(); s.growths = [];
    const r = buildIndex(s, s.cards.map(c => c.id), at).index;
    assert.equal(r.byCardId[1010361].states.base.maxStats, null);
    assert.equal(r.byCardId[1010361].states.base.status, "unknown");
    assert.equal(lookup(r, "1010361", "base", "none"), null);
});
test("future route configuration is calculated but not eligible for display", () => {
    const s = fixture(); s.routes.find(r => r.card_id === 1010361)!.open_at = "2099-01-01 00:00:00";
    const r = buildIndex(s, s.cards.map(c => c.id), at).index;
    assert.deepEqual(r.byCardId[1010361].states.eza.maxStats, [8503,8527,3928]);
    assert.equal(r.byCardId[1010361].states.eza.availability, "future");
    assert.equal(lookup(r, "1010361", "eza", "all"), null);
});
test("unknown release and unconfigured state never default available", () => {
    const s = fixture(); s.cards.find(c => c.id === 1034481)!.open_at = null;
    const r = buildIndex(s, s.cards.map(c => c.id), at).index;
    assert.equal(r.byCardId[1034481].states.base.availability, "unknown");
    assert.equal(r.byCardId[1034481].states.seza.status, "ineligible");
    assert.equal(lookup(r, "1034481", "base", "all"), null);
});
test("missing board, missing exact card, and battle form have distinct statuses", () => {
    const s = fixture(); const first = s.cards[0]; first.potential_board_id = null;
    s.cards.push({ ...first, id: 4005131 });
    const r = buildIndex(s, [...s.cards.map(c => c.id), 123456], at).index;
    assert.equal(r.byCardId[first.id].reason, "no-potential-board");
    assert.equal(r.byCardId[123456].reason, "missing-source-card");
    assert.equal(r.byCardId[4005131].reason, "outside-playable-sheet");
    assert.deepEqual(r.byCardId[4005131].states, {});
});
test("curve boundary, base max, and floor instead of nearest integer", () => {
    const c = fixture().cards.find(c => c.id === 1003211)!;
    assert.deepEqual(calculateMax(c, 1, 0), [c.hp_init,c.atk_init,c.def_init]);
    assert.deepEqual(calculateMax(c, 120, 1), [9500,8672,4623]);
    const synthetic = { ...c, lv_max: 2, hp_init: 1, hp_max: 2, atk_init: 1, atk_max: 2, def_init: 1, def_max: 2 };
    assert.deepEqual(calculateMax(synthetic, 2, 0.5), [1,1,1]);
    assert.throws(() => calculateMax(c, 140, NaN));
});
test("duplicate curve, missing optimal row and incomplete chain rejected", () => {
    let s = fixture(); s.growths.push(s.growths[0]); assert.throws(() => buildIndex(s, s.cards.map(c => c.id), at));
    s = fixture(); s.optimal = []; assert.throws(() => buildIndex(s, s.cards.map(c => c.id), at));
    s = fixture(); s.routes.shift(); assert.throws(() => buildIndex(s, s.cards.map(c => c.id), at));
});
test("layout proof does not spread to the other SQL templates", () => {
    const s = fixture(); const r = buildIndex(s, s.cards.map(c => c.id), at).index;
    assert.equal(r.boards[20].evidence.kind, "sql-and-layout");
    assert.equal(r.boards[30].evidence.kind, "sql-graph");
    assert.equal(r.boards[30].evidence.routeDirections, null);
});
