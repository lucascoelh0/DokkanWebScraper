"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadSpecialM5Sources = void 0;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const path_1 = require("path");
function hash(value) { return (0, crypto_1.createHash)("sha256").update(value).digest("hex"); }
function safePath(root, path) { if (!/^[A-Za-z0-9_.\/-]+$/.test(path) || path.includes("..") || path.startsWith("/") || /^[A-Za-z]:/.test(path))
    throw new Error("M5 unsafe source path"); const rootReal = (0, fs_1.realpathSync)(root), candidate = (0, path_1.resolve)(rootReal, path), inside = (0, path_1.relative)(rootReal, candidate); if (!inside || inside.startsWith("..") || (0, path_1.resolve)(rootReal, inside) !== candidate)
    throw new Error("M5 source escaped root"); let cursor = rootReal; for (const part of inside.split(/[\\/]/)) {
    cursor = (0, path_1.resolve)(cursor, part);
    if ((0, fs_1.lstatSync)(cursor).isSymbolicLink())
        throw new Error("M5 source path contains a link");
} return candidate; }
function loadSpecialM5Sources(roots, lock) {
    if (lock.schemaVersion !== 1 || lock.contract !== "dokkan-special-modes-shadow-source-lock" || lock.contractVersion !== "0.6.0" || lock.files.length !== 15 || lock.directories.length !== 2)
        throw new Error("M5 source lock mismatch");
    const files = new Map(), lineage = [];
    for (const item of lock.files) {
        const root = roots[item.root];
        if (!root)
            throw new Error("M5 root not allowlisted");
        const path = safePath(root, item.path), info = (0, fs_1.statSync)(path);
        if (!info.isFile() || info.size !== item.sizeBytes)
            throw new Error(`M5 file size mismatch ${item.key}`);
        const bytes = (0, fs_1.readFileSync)(path);
        if (hash(bytes) !== item.sha256)
            throw new Error(`M5 file hash mismatch ${item.key}`);
        const text = bytes.toString("utf8");
        files.set(item.key, JSON.parse(text));
        lineage.push({ key: item.key, sizeBytes: item.sizeBytes, sha256: item.sha256, sourceKind: "file" });
    }
    for (const item of lock.directories) {
        const root = roots[item.root], path = safePath(root, item.path);
        if (!(0, fs_1.statSync)(path).isDirectory())
            throw new Error("M5 aggregate source is not directory");
        const names = (0, fs_1.readdirSync)(path).filter(name => item.filter === "all_json" ? name.endsWith(".json") : /^sdbattle-\d+\.json$/.test(name)).sort(), rows = [];
        let totalBytes = 0;
        for (const name of names) {
            const file = safePath(path, name);
            if ((0, path_1.basename)(file) !== name || !(0, fs_1.statSync)(file).isFile())
                throw new Error("M5 aggregate member invalid");
            const bytes = (0, fs_1.readFileSync)(file);
            totalBytes += bytes.length;
            rows.push(`${name}\0${bytes.length}\0${hash(bytes)}\n`);
        }
        const aggregate = hash(rows.join(""));
        if (names.length !== item.fileCount || totalBytes !== item.totalBytes || aggregate !== item.aggregateSha256)
            throw new Error(`M5 directory aggregate mismatch ${item.key}`);
        files.set(item.key, { names, totalBytes, aggregateSha256: aggregate });
        lineage.push({ key: item.key, sizeBytes: totalBytes, sha256: aggregate, sourceKind: "directory_aggregate" });
    }
    for (const key of ["e9_validation", "s7_validation", "h3_validation", "h12_validation", "h13_validation"])
        if (files.get(key)?.valid !== true)
            throw new Error(`M5 upstream validation not green ${key}`);
    if (files.get("e9_payload")?.contract !== "dokkan-events-database-first-readiness" || files.get("e9_payload")?.contractVersion !== "1.0.0" || files.get("s7_payload")?.contract !== "dokkan-server-readiness" || files.get("s7_payload")?.contractVersion !== "0.8.0" || files.get("h3_payload")?.contract !== "dokkan-official-capture-schedules-availability" || files.get("h3_payload")?.contractVersion !== "0.4.0" || files.get("h12_payload")?.contract !== "dokkan-official-capture-extension-readiness" || files.get("h12_payload")?.contractVersion !== "0.13.1" || files.get("h13_payload")?.contract !== "dokkan-official-capture-gasha-conflict-audit" || files.get("h13_payload")?.contractVersion !== "0.14.0")
        throw new Error("M5 upstream contract mismatch");
    return { files, lineage: lineage.sort((a, b) => a.key.localeCompare(b.key)) };
}
exports.loadSpecialM5Sources = loadSpecialM5Sources;
//# sourceMappingURL=special-m5-sources.js.map