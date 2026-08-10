"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const v8_1 = require("v8");
const capture_h0_audit_1 = require("../database-server-captures/capture-h0-audit");
const frontier_f3_catalog_1 = require("./frontier-f3-catalog");
const root = (0, path_1.resolve)(process.cwd());
if ((0, v8_1.getHeapStatistics)().heap_size_limit >= 1024 * 1024 * 1024)
    throw new Error("Frontier F3 requires a Node heap below 1 GiB");
const sourceLock = JSON.parse((0, fs_1.readFileSync)((0, path_1.resolve)(root, "database-frontier-captures/frontier-f0-source-lock.json"), "utf8")), harText = (0, capture_h0_audit_1.readValidatedCaptureSnapshot)("D:\\Dokkan\\har logs\\08-10", sourceLock.fileName, sourceLock.captureId).text, f2Text = (0, fs_1.readFileSync)((0, path_1.resolve)(root, "data/database-frontier-captures/f2/frontier-f2-sanitized-shapes.json"), "utf8"), f2 = JSON.parse(f2Text), dataset = (0, frontier_f3_catalog_1.buildFrontierF3)(harText, f2, f2Text), validation = (0, frontier_f3_catalog_1.validateFrontierF3)(dataset, f2, f2Text), out = (0, path_1.resolve)(root, "data/database-frontier-captures/f3");
(0, fs_1.mkdirSync)(out, { recursive: true });
(0, fs_1.writeFileSync)((0, path_1.resolve)(out, "frontier-f3-catalog.json"), `${JSON.stringify(dataset, null, 2)}\n`);
(0, fs_1.writeFileSync)((0, path_1.resolve)(out, "frontier-f3-validation.json"), `${JSON.stringify(validation, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(validation)}\n`);
//# sourceMappingURL=frontier-f3-run.js.map