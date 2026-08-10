"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const v8_1 = require("v8");
const capture_h0_audit_1 = require("../database-server-captures/capture-h0-audit");
const frontier_f0_audit_1 = require("./frontier-f0-audit");
const root = (0, path_1.resolve)(process.cwd());
if ((0, v8_1.getHeapStatistics)().heap_size_limit >= 1024 * 1024 * 1024)
    throw new Error("Frontier F0 requires a Node heap below 1 GiB");
const lock = JSON.parse((0, fs_1.readFileSync)((0, path_1.resolve)(root, "database-frontier-captures/frontier-f0-source-lock.json"), "utf8"));
const captureRoot = "D:\\Dokkan\\har logs\\08-10", snapshot = (0, capture_h0_audit_1.readValidatedCaptureSnapshot)(captureRoot, lock.fileName, lock.captureId), dataset = (0, frontier_f0_audit_1.buildFrontierF0)(snapshot.text, lock), validation = (0, frontier_f0_audit_1.validateFrontierF0)(dataset, lock);
const out = (0, path_1.resolve)(root, "data/database-frontier-captures/f0");
(0, fs_1.mkdirSync)(out, { recursive: true });
(0, fs_1.writeFileSync)((0, path_1.resolve)(out, "frontier-f0-inventory.json"), `${JSON.stringify(dataset, null, 2)}\n`);
(0, fs_1.writeFileSync)((0, path_1.resolve)(out, "frontier-f0-validation.json"), `${JSON.stringify(validation, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(validation)}\n`);
//# sourceMappingURL=frontier-f0-run.js.map