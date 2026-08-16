"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const path_1 = require("path");
const v8_1 = require("v8");
const wt4_briefing_start_1 = require("./wt4-briefing-start");
const h = (v) => (0, crypto_1.createHash)("sha256").update(v).digest("hex"), root = (0, path_1.resolve)(process.cwd());
if ((0, v8_1.getHeapStatistics)().heap_size_limit >= 1024 * 1024 * 1024)
    throw new Error("WT4 heap boundary");
function g(x, p, v) { const q = (0, path_1.resolve)(root, `data/database-world-tournament-captures/${x}`), pt = (0, fs_1.readFileSync)((0, path_1.resolve)(q, p), "utf8"), vt = (0, fs_1.readFileSync)((0, path_1.resolve)(q, v), "utf8"), m = JSON.parse((0, fs_1.readFileSync)((0, path_1.resolve)(q, `${x}-manifest.json`), "utf8")); for (const [n, t] of [[p, pt], [v, vt]]) {
    const i = m.members.find(z => z.fileName === n);
    if (!i || i.sizeBytes !== Buffer.byteLength(t) || i.sha256 !== h(t))
        throw new Error("WT4 manifest mismatch");
} if (!JSON.parse(vt).valid)
    throw new Error("WT4 upstream not green"); return pt; }
const a = g("wt0", "wt0-inventory.json", "wt0-validation.json"), b = g("wt1", "wt1-route-catalog.json", "wt1-validation.json"), d = (0, wt4_briefing_start_1.buildWt4)(JSON.parse(a), a, JSON.parse(b), b), v = (0, wt4_briefing_start_1.validateWt4)(d), pt = `${JSON.stringify(d, null, 2)}\n`, vt = `${JSON.stringify(v, null, 2)}\n`, o = (0, path_1.resolve)(root, "data/database-world-tournament-captures/wt4"), member = (fileName, text) => ({ fileName, sizeBytes: Buffer.byteLength(text), sha256: h(text) });
(0, fs_1.mkdirSync)(o, { recursive: true });
const pp = (0, path_1.resolve)(o, "wt4-briefing-missions-start.json"), vp = (0, path_1.resolve)(o, "wt4-validation.json");
(0, fs_1.writeFileSync)(pp, pt);
(0, fs_1.writeFileSync)(vp, vt);
if (h((0, fs_1.readFileSync)(pp)) !== h(pt) || h((0, fs_1.readFileSync)(vp)) !== h(vt))
    throw new Error("WT4 post-write mismatch");
(0, fs_1.writeFileSync)((0, path_1.resolve)(o, "wt4-manifest.json"), `${JSON.stringify({ schemaVersion: 1, contractVersion: d.contractVersion, members: [member("wt4-briefing-missions-start.json", pt), member("wt4-validation.json", vt)] }, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(v)}\n`);
//# sourceMappingURL=wt4-run.js.map