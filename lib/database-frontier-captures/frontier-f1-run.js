"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const v8_1 = require("v8");
const capture_h0_audit_1 = require("../database-server-captures/capture-h0-audit");
const frontier_f1_audit_1 = require("./frontier-f1-audit");
const root = (0, path_1.resolve)(process.cwd());
if ((0, v8_1.getHeapStatistics)().heap_size_limit >= 1024 * 1024 * 1024)
    throw new Error("Frontier F1 requires a Node heap below 1 GiB");
const f0Text = (0, fs_1.readFileSync)((0, path_1.resolve)(root, "data/database-frontier-captures/f0/frontier-f0-inventory.json"), "utf8"), f0 = JSON.parse(f0Text), sourceLock = JSON.parse((0, fs_1.readFileSync)((0, path_1.resolve)(root, "database-frontier-captures/frontier-f0-source-lock.json"), "utf8")), harText = (0, capture_h0_audit_1.readValidatedCaptureSnapshot)("D:\\Dokkan\\har logs\\08-10", sourceLock.fileName, sourceLock.captureId).text, artifactLock = JSON.parse((0, fs_1.readFileSync)((0, path_1.resolve)(root, "database-frontier-captures/frontier-f1-artifact-lock.json"), "utf8")), search = (0, frontier_f1_audit_1.scanFrontierDictionaryArtifacts)(artifactLock, { "database-apk": "D:\\Dokkan\\database\\apk", "database-decrypted": "D:\\Dokkan\\database\\decrypted", "database-packages": "D:\\Dokkan\\database\\packages" }), dataset = (0, frontier_f1_audit_1.buildFrontierF1)(harText, f0, f0Text, search), validation = (0, frontier_f1_audit_1.validateFrontierF1)(dataset, f0, f0Text), out = (0, path_1.resolve)(root, "data/database-frontier-captures/f1");
(0, fs_1.mkdirSync)(out, { recursive: true });
(0, fs_1.writeFileSync)((0, path_1.resolve)(out, "frontier-f1-zstd-audit.json"), `${JSON.stringify(dataset, null, 2)}\n`);
(0, fs_1.writeFileSync)((0, path_1.resolve)(out, "frontier-f1-validation.json"), `${JSON.stringify(validation, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(validation)}\n`);
//# sourceMappingURL=frontier-f1-run.js.map