"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/** Opt-in integration verification: HIPO_REAL_OPTIONS points to a local JSON Options file.
 * Reads the pinned source; never runs the candidate writer. Absent env => explicitly skipped.
 */
const assert_1 = require("assert");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const child_process_1 = require("child_process");
const zlib_1 = require("zlib");
const mocha_1 = require("mocha");
const game_db_hidden_potential_core_1 = require("./game-db-hidden-potential-core");
const game_db_hidden_potential_run_1 = require("./game-db-hidden-potential-run");
(process.env.HIPO_REAL_OPTIONS ? mocha_1.it : mocha_1.it.skip)("optional pinned real source: scope, profiles, states, determinism, immutable inputs", async function () {
    this.timeout(120000);
    const o = JSON.parse(await (0, promises_1.readFile)(process.env.HIPO_REAL_OPTIONS, "utf8"));
    const before = new Map();
    const enrichmentManifest = JSON.parse(await (0, promises_1.readFile)(o.enrichmentManifest, "utf8"));
    const files = [o.db, o.elf, o.layout20, o.layout201, o.primaryManifest, o.primaryPayload, o.enrichmentManifest,
        (0, path_1.resolve)(o.enrichmentDir, enrichmentManifest.catalog.objectKey), ...enrichmentManifest.shards.map(s => (0, path_1.resolve)(o.enrichmentDir, s.objectKey))];
    for (const file of files)
        before.set(file, (0, game_db_hidden_potential_run_1.sha256)(await (0, game_db_hidden_potential_run_1.bounded)(file, 128 * 1024 * 1024)));
    const roster = await (0, game_db_hidden_potential_run_1.readRoster)(o);
    assert_1.strict.equal(roster.ids.length, 4210);
    const child = (0, child_process_1.spawnSync)(o.python, [(0, path_1.resolve)("game-db/game-db-hidden-potential-sqlite.py"), "--db", o.db, "--elf", o.elf, "--layout20", o.layout20, "--layout201", o.layout201], { input: JSON.stringify(roster.ids), encoding: "utf8", shell: false, windowsHide: true, maxBuffer: 16 * 1024 * 1024, timeout: 120000 });
    assert_1.strict.equal(child.status, 0, child.stderr);
    assert_1.strict.ifError(child.error);
    const source = JSON.parse(child.stdout);
    assert_1.strict.equal(source.provenance.databaseSha256, game_db_hidden_potential_run_1.DB_SHA);
    assert_1.strict.equal(source.provenance.runtimeSha256, game_db_hidden_potential_run_1.RUNTIME_SHA);
    const a = (0, game_db_hidden_potential_core_1.buildIndex)(source, roster.ids, o.generatedAt);
    const b = (0, game_db_hidden_potential_core_1.buildIndex)(source, [...roster.ids].reverse(), o.generatedAt);
    assert_1.strict.deepEqual(a, b);
    assert_1.strict.equal((0, game_db_hidden_potential_run_1.sha256)((0, zlib_1.gzipSync)(Buffer.from(JSON.stringify(a.index)), { level: 9 })), (0, game_db_hidden_potential_run_1.sha256)((0, zlib_1.gzipSync)(Buffer.from(JSON.stringify(b.index)), { level: 9 })));
    assert_1.strict.equal(a.coverage.sourceBoardCount, 45);
    assert_1.strict.equal(a.coverage.boardCount, 44);
    assert_1.strict.equal(a.coverage.statusCounts["supported:board-present"], 2270);
    assert_1.strict.equal(a.coverage.statusCounts["ineligible:no-potential-board"], 1918);
    assert_1.strict.equal(a.coverage.statusCounts["ineligible:outside-playable-sheet"], 22);
    assert_1.strict.equal(a.coverage.stateCounts["eza:supported:released"], 665);
    assert_1.strict.equal(a.coverage.stateCounts["seza:supported:released"], 35);
    for (const [id, board] of Object.entries(a.index.boards)) {
        const expected = Number(id) >= 201 ? [0, 57, 70, 79, 90, 100] : [0, 55, 69, 79, 90, 100];
        assert_1.strict.deepEqual(board.presets.map(p => p.displayPercent), expected, `board ${id}`);
        assert_1.strict.equal(board.alternatives[0].displayPercent, 89);
    }
    assert_1.strict.deepEqual(a.index.byCardId[1003211].states.eza.maxStats, [12527, 11111, 5796]);
    assert_1.strict.deepEqual(a.index.byCardId[1007471].states.seza.maxStats, [15800, 15100, 8220]);
    for (const [file, digest] of before)
        assert_1.strict.equal((0, game_db_hidden_potential_run_1.sha256)(await (0, game_db_hidden_potential_run_1.bounded)(file, 128 * 1024 * 1024)), digest, `Source changed: ${file}`);
});
//# sourceMappingURL=game-db-hidden-potential-real.spec.js.map