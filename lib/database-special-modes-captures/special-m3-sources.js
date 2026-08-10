"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadSpecialM3Sources = void 0;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const path_1 = require("path");
function sha256(value) { return (0, crypto_1.createHash)("sha256").update(value).digest("hex"); }
function safeRead(root, path, size, hash) { if (!/^[A-Za-z0-9_.\/-]+$/.test(path) || path.includes("..") || path.startsWith("/") || /^[A-Za-z]:/.test(path))
    throw new Error("M3 unsafe source path"); const rootReal = (0, fs_1.realpathSync)(root), candidate = (0, path_1.resolve)(rootReal, path), inside = (0, path_1.relative)(rootReal, candidate); if (!inside || inside.startsWith("..") || (0, path_1.resolve)(rootReal, inside) !== candidate)
    throw new Error("M3 source escaped root"); let cursor = rootReal; for (const part of inside.split(/[\\/]/)) {
    cursor = (0, path_1.resolve)(cursor, part);
    if ((0, fs_1.lstatSync)(cursor).isSymbolicLink())
        throw new Error("M3 source path contains a link");
} const before = (0, fs_1.statSync)(candidate); if (!before.isFile() || before.size !== size)
    throw new Error("M3 source size mismatch"); const text = (0, fs_1.readFileSync)(candidate, "utf8"), after = (0, fs_1.statSync)(candidate); if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || Buffer.byteLength(text) !== size || sha256(text) !== hash)
    throw new Error("M3 source identity mismatch"); return text; }
function loadSpecialM3Sources(root, lock) { if (lock.schemaVersion !== 1 || lock.contract !== "dokkan-special-modes-database-source-lock" || lock.contractVersion !== "0.4.0" || JSON.stringify(lock.artifacts.map(value => value.key).sort()) !== JSON.stringify(["e1", "e2", "e4", "s2"]))
    throw new Error("M3 source lock mismatch"); const payloads = new Map(), lineage = []; for (const item of lock.artifacts) {
    const payloadText = safeRead(root, item.payloadPath, item.payloadSizeBytes, item.payloadSha256), manifestText = safeRead(root, item.manifestPath, item.manifestSizeBytes, item.manifestSha256), validationText = safeRead(root, item.validationPath, item.validationSizeBytes, item.validationSha256), payload = JSON.parse(payloadText), manifest = JSON.parse(manifestText), validation = JSON.parse(validationText);
    if (payload.contract !== item.contractName || payload.contractVersion !== item.contractVersion || manifest.contractVersion !== item.contractVersion || manifest.fileName !== item.payloadPath.split("/").at(-1) || manifest.sizeBytes !== item.payloadSizeBytes || manifest.sha256 !== item.payloadSha256 || validation.valid !== true)
        throw new Error(`M3 source contract mismatch ${item.key}`);
    payloads.set(item.key, payload);
    lineage.push({ key: item.key, contract: item.contractName, contractVersion: item.contractVersion, payloadSizeBytes: item.payloadSizeBytes, payloadSha256: item.payloadSha256, manifestSha256: item.manifestSha256, validationSha256: item.validationSha256 });
} return { e1: payloads.get("e1"), e2: payloads.get("e2"), e4: payloads.get("e4"), s2: payloads.get("s2"), lineage }; }
exports.loadSpecialM3Sources = loadSpecialM3Sources;
//# sourceMappingURL=special-m3-sources.js.map