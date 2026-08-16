"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const path_1 = require("path");
const v8_1 = require("v8");
const wt3_rankings_1 = require("./wt3-rankings");
const hash = (v) => (0, crypto_1.createHash)("sha256").update(v).digest("hex"), root = (0, path_1.resolve)(process.cwd());
if ((0, v8_1.getHeapStatistics)().heap_size_limit >= 1024 * 1024 * 1024)
    throw new Error("WT3 requires a Node heap below 1 GiB");
function gate(g, p, v) { const b = (0, path_1.resolve)(root, `data/database-world-tournament-captures/${g}`), pt = (0, fs_1.readFileSync)((0, path_1.resolve)(b, p), "utf8"), vt = (0, fs_1.readFileSync)((0, path_1.resolve)(b, v), "utf8"), m = JSON.parse((0, fs_1.readFileSync)((0, path_1.resolve)(b, `${g}-manifest.json`), "utf8")); for (const [n, t] of [[p, pt], [v, vt]]) {
    const x = m.members?.find(i => i.fileName === n);
    if (!x || x.sizeBytes !== Buffer.byteLength(t) || x.sha256 !== hash(t))
        throw new Error("WT3 manifest mismatch");
} if (JSON.parse(vt).valid !== true)
    throw new Error("WT3 upstream not green"); return pt; }
const a = gate("wt0", "wt0-inventory.json", "wt0-validation.json"), b = gate("wt1", "wt1-route-catalog.json", "wt1-validation.json"), d = (0, wt3_rankings_1.buildWt3)(JSON.parse(a), a, JSON.parse(b), b), v = (0, wt3_rankings_1.validateWt3)(d), pt = `${JSON.stringify(d, null, 2)}\n`, vt = `${JSON.stringify(v, null, 2)}\n`, out = (0, path_1.resolve)(root, "data/database-world-tournament-captures/wt3"), member = (fileName, text) => ({ fileName, sizeBytes: Buffer.byteLength(text), sha256: hash(text) });
(0, fs_1.mkdirSync)(out, { recursive: true });
const pp = (0, path_1.resolve)(out, "wt3-rankings-box-schedules.json"), vp = (0, path_1.resolve)(out, "wt3-validation.json");
(0, fs_1.writeFileSync)(pp, pt);
(0, fs_1.writeFileSync)(vp, vt);
if (hash((0, fs_1.readFileSync)(pp)) !== hash(pt) || hash((0, fs_1.readFileSync)(vp)) !== hash(vt))
    throw new Error("WT3 post-write mismatch");
(0, fs_1.writeFileSync)((0, path_1.resolve)(out, "wt3-manifest.json"), `${JSON.stringify({ schemaVersion: 1, contractVersion: d.contractVersion, members: [member("wt3-rankings-box-schedules.json", pt), member("wt3-validation.json", vt)] }, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(v)}\n`);
//# sourceMappingURL=wt3-run.js.map