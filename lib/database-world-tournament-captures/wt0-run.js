"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const path_1 = require("path");
const v8_1 = require("v8");
const wt0_audit_1 = require("./wt0-audit");
function arg(name) { const index = process.argv.indexOf(name); if (index < 0 || !process.argv[index + 1])
    throw new Error(`WT0 requires ${name}`); return process.argv[index + 1]; }
function hash(value) { return (0, crypto_1.createHash)("sha256").update(value).digest("hex"); }
const root = (0, fs_1.realpathSync)(process.cwd());
if ((0, v8_1.getHeapStatistics)().heap_size_limit >= 1024 * 1024 * 1024)
    throw new Error("WT0 requires a Node heap below 1 GiB");
const sourceArgument = (0, path_1.resolve)(arg("--source"));
if ((0, fs_1.lstatSync)(sourceArgument).isSymbolicLink())
    throw new Error("WT0 source boundary");
const sourcePath = (0, fs_1.realpathSync)(sourceArgument), externalLockPath = (0, path_1.resolve)(arg("--external-lock"));
(0, wt0_audit_1.assertExternalHarPath)(root, sourcePath);
if (!(0, path_1.isAbsolute)(sourcePath) || (0, fs_1.statSync)(sourcePath).size > 64 * 1024 * 1024)
    throw new Error("WT0 source boundary");
const lockRelative = (0, path_1.relative)(root, externalLockPath).replace(/\\/g, "/");
if (!lockRelative.startsWith(".agent-logs/") && !lockRelative.startsWith("../"))
    throw new Error("WT0 source lock must remain external or ignored");
const before = (0, fs_1.statSync)(sourcePath), harText = (0, fs_1.readFileSync)(sourcePath, "utf8"), after = (0, fs_1.statSync)(sourcePath);
if (before.size !== after.size || before.mtimeMs !== after.mtimeMs)
    throw new Error("WT0 source changed during read");
const lock = (0, wt0_audit_1.makeExternalSourceLock)(harText);
(0, fs_1.mkdirSync)((0, path_1.resolve)(externalLockPath, ".."), { recursive: true });
(0, fs_1.writeFileSync)(externalLockPath, `${JSON.stringify(lock, null, 2)}\n`, { flag: "wx" });
const dataset = (0, wt0_audit_1.buildWt0)(harText, lock), validation = (0, wt0_audit_1.validateWt0)(dataset, lock), output = (0, path_1.resolve)(root, "data/database-world-tournament-captures/wt0"), payload = `${JSON.stringify(dataset, null, 2)}\n`, validationText = `${JSON.stringify(validation, null, 2)}\n`;
(0, fs_1.mkdirSync)(output, { recursive: true });
const payloadPath = (0, path_1.resolve)(output, "wt0-inventory.json"), validationPath = (0, path_1.resolve)(output, "wt0-validation.json");
(0, fs_1.writeFileSync)(payloadPath, payload);
(0, fs_1.writeFileSync)(validationPath, validationText);
if (hash((0, fs_1.readFileSync)(payloadPath)) !== hash(payload) || hash((0, fs_1.readFileSync)(validationPath)) !== hash(validationText))
    throw new Error("WT0 post-write identity mismatch");
const members = [{ fileName: "wt0-inventory.json", sizeBytes: Buffer.byteLength(payload), sha256: hash(payload) }, { fileName: "wt0-validation.json", sizeBytes: Buffer.byteLength(validationText), sha256: hash(validationText) }];
(0, fs_1.writeFileSync)((0, path_1.resolve)(output, "wt0-manifest.json"), `${JSON.stringify({ schemaVersion: 1, contractVersion: dataset.contractVersion, members }, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(validation)}\n`);
//# sourceMappingURL=wt0-run.js.map