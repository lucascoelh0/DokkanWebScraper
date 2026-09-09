/** Opt-in integration verification: HIPO_REAL_OPTIONS points to a local JSON Options file.
 * Reads the pinned source; never runs the candidate writer. Absent env => explicitly skipped.
 */
import { strict as assert } from "assert";
import { readFile } from "fs/promises";
import { resolve } from "path";
import { spawnSync } from "child_process";
import { gzipSync } from "zlib";
import { it } from "mocha";
import { buildIndex, Source } from "./game-db-hidden-potential-core";
import { bounded, DB_SHA, Options, readRoster, RUNTIME_SHA, sha256 } from "./game-db-hidden-potential-run";

(process.env.HIPO_REAL_OPTIONS ? it : it.skip)("optional pinned real source: scope, profiles, states, determinism, immutable inputs", async function () {
    this.timeout(120000);
    const o: Options = JSON.parse(await readFile(process.env.HIPO_REAL_OPTIONS!, "utf8"));
    const before = new Map<string, string>();
    const enrichmentManifest = JSON.parse(await readFile(o.enrichmentManifest, "utf8"));
    const files = [o.db,o.elf,o.layout20,o.layout201,o.primaryManifest,o.primaryPayload,o.enrichmentManifest,
        resolve(o.enrichmentDir, enrichmentManifest.catalog.objectKey), ...enrichmentManifest.shards.map(s => resolve(o.enrichmentDir, s.objectKey))];
    for (const file of files) before.set(file, sha256(await bounded(file, 128 * 1024 * 1024)));
    const roster = await readRoster(o); assert.equal(roster.ids.length, 4210);
    const child = spawnSync(o.python, [resolve("game-db/game-db-hidden-potential-sqlite.py"), "--db",o.db,"--elf",o.elf,"--layout20",o.layout20,"--layout201",o.layout201],
        { input: JSON.stringify(roster.ids), encoding: "utf8", shell: false, windowsHide: true, maxBuffer: 16 * 1024 * 1024, timeout: 120000 });
    assert.equal(child.status, 0, child.stderr); assert.ifError(child.error);
    const source: Source = JSON.parse(child.stdout);
    assert.equal(source.provenance.databaseSha256, DB_SHA); assert.equal(source.provenance.runtimeSha256, RUNTIME_SHA);
    const a = buildIndex(source, roster.ids, o.generatedAt); const b = buildIndex(source, [...roster.ids].reverse(), o.generatedAt);
    assert.deepEqual(a, b);
    assert.equal(sha256(gzipSync(Buffer.from(JSON.stringify(a.index)), { level: 9 })), sha256(gzipSync(Buffer.from(JSON.stringify(b.index)), { level: 9 })));
    assert.equal(a.coverage.sourceBoardCount, 45); assert.equal(a.coverage.boardCount, 44);
    assert.equal(a.coverage.statusCounts["supported:board-present"], 2270);
    assert.equal(a.coverage.statusCounts["ineligible:no-potential-board"], 1918);
    assert.equal(a.coverage.statusCounts["ineligible:outside-playable-sheet"], 22);
    assert.equal(a.coverage.stateCounts["eza:supported:released"], 665);
    assert.equal(a.coverage.stateCounts["seza:supported:released"], 35);
    for (const [id, board] of Object.entries(a.index.boards)) {
        const expected = Number(id) >= 201 ? [0,57,70,79,90,100] : [0,55,69,79,90,100];
        assert.deepEqual(board.presets.map(p => p.displayPercent), expected, `board ${id}`);
        assert.equal(board.alternatives[0].displayPercent, 89);
    }
    assert.deepEqual(a.index.byCardId[1003211].states.eza.maxStats, [12527,11111,5796]);
    assert.deepEqual(a.index.byCardId[1007471].states.seza.maxStats, [15800,15100,8220]);
    for (const [file, digest] of before) assert.equal(sha256(await bounded(file, 128 * 1024 * 1024)), digest, `Source changed: ${file}`);
});
