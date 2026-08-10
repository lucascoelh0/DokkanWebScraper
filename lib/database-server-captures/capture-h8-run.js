"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const v8_1 = require("v8");
const capture_h8_audit_1 = require("./capture-h8-audit");
const capture_secret_scan_1 = require("./capture-secret-scan");
const root = (0, path_1.resolve)(process.cwd());
if (JSON.parse((0, fs_1.readFileSync)((0, path_1.resolve)(root, "package.json"), "utf8"))?.name !== "dokkan-web-scraper")
    throw new Error("H8 must run from repository root");
if ((0, v8_1.getHeapStatistics)().heap_size_limit >= 1024 * 1024 * 1024)
    throw new Error("H8 requires a Node heap below 1 GiB");
const manifest = JSON.parse((0, fs_1.readFileSync)((0, path_1.resolve)(root, "database-server-captures", "capture-h8-input-manifest.json"), "utf8"));
const roots = { "dokkan-local-captures-0810": "D:\\Dokkan\\har logs\\08-10" };
const dataset = (0, capture_h8_audit_1.buildCaptureH8)(manifest, roots), validation = (0, capture_h8_audit_1.validateCaptureH8)(dataset, manifest, roots), text = `${JSON.stringify(dataset, null, 2)}\n`;
const scan = (0, capture_secret_scan_1.scanTextsForSecrets)((0, capture_secret_scan_1.collectCaptureSensitiveValues)(manifest, roots), [{ name: "capture-h8-inventory.json", text }]);
if (!scan.valid)
    throw new Error("H8 secret scan failed");
const out = (0, path_1.resolve)(root, "data", "database-server-captures", "h8");
(0, fs_1.mkdirSync)(out, { recursive: true });
(0, fs_1.writeFileSync)((0, path_1.resolve)(out, "capture-h8-inventory.json"), text);
(0, fs_1.writeFileSync)((0, path_1.resolve)(out, "capture-h8-validation.json"), `${JSON.stringify(validation, null, 2)}\n`);
(0, fs_1.writeFileSync)((0, path_1.resolve)(out, "capture-h8-secret-scan.json"), `${JSON.stringify(scan, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ contract: dataset.contract, contractVersion: dataset.contractVersion, captureCount: validation.captureCount, entryCount: validation.entryCount, trafficClassCounts: validation.trafficClassCounts, exactDuplicateGroupCount: validation.exactDuplicateGroupCount, secretScanValid: scan.valid })}\n`);
//# sourceMappingURL=capture-h8-run.js.map