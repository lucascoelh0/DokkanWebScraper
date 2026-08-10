"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const v8_1 = require("v8");
const capture_h0_audit_1 = require("../database-server-captures/capture-h0-audit");
const frontier_f2_shapes_1 = require("./frontier-f2-shapes");
const root = (0, path_1.resolve)(process.cwd());
if ((0, v8_1.getHeapStatistics)().heap_size_limit >= 1024 * 1024 * 1024)
    throw new Error("Frontier F2 requires a Node heap below 1 GiB");
const sourceLock = JSON.parse((0, fs_1.readFileSync)((0, path_1.resolve)(root, "database-frontier-captures/frontier-f0-source-lock.json"), "utf8")), harText = (0, capture_h0_audit_1.readValidatedCaptureSnapshot)("D:\\Dokkan\\har logs\\08-10", sourceLock.fileName, sourceLock.captureId).text, f1Text = (0, fs_1.readFileSync)((0, path_1.resolve)(root, "data/database-frontier-captures/f1/frontier-f1-zstd-audit.json"), "utf8"), f1 = JSON.parse(f1Text), dataset = (0, frontier_f2_shapes_1.buildFrontierF2)(harText, f1, f1Text), validation = (0, frontier_f2_shapes_1.validateFrontierF2)(dataset, f1, f1Text), out = (0, path_1.resolve)(root, "data/database-frontier-captures/f2");
(0, fs_1.mkdirSync)(out, { recursive: true });
(0, fs_1.writeFileSync)((0, path_1.resolve)(out, "frontier-f2-sanitized-shapes.json"), `${JSON.stringify(dataset, null, 2)}\n`);
(0, fs_1.writeFileSync)((0, path_1.resolve)(out, "frontier-f2-validation.json"), `${JSON.stringify(validation, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(validation)}\n`);
//# sourceMappingURL=frontier-f2-run.js.map