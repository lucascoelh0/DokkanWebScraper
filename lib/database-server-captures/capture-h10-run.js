"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const v8_1 = require("v8");
const capture_h8_audit_1 = require("./capture-h8-audit");
const capture_h9_schemas_1 = require("./capture-h9-schemas");
const capture_h10_domains_1 = require("./capture-h10-domains");
const capture_secret_scan_1 = require("./capture-secret-scan");
const root = (0, path_1.resolve)(process.cwd());
if ((0, v8_1.getHeapStatistics)().heap_size_limit >= 1024 * 1024 * 1024)
    throw new Error("H10 requires a Node heap below 1 GiB");
const manifest = JSON.parse((0, fs_1.readFileSync)((0, path_1.resolve)(root, "database-server-captures/capture-h8-input-manifest.json"), "utf8"));
const roots = { "dokkan-local-captures-0810": "D:\\Dokkan\\har logs\\08-10" };
const h8Text = (0, fs_1.readFileSync)((0, path_1.resolve)(root, "data/database-server-captures/h8/capture-h8-inventory.json"), "utf8");
const h8 = JSON.parse(h8Text);
const h9Text = (0, fs_1.readFileSync)((0, path_1.resolve)(root, "data/database-server-captures/h9/capture-h9-observed-schemas.json"), "utf8");
const h9 = JSON.parse(h9Text);
if (!(0, capture_h8_audit_1.validateCaptureH8)(h8, manifest, roots).valid || !(0, capture_h9_schemas_1.validateCaptureH9)(h9, manifest, roots, h8, h8Text).valid)
    throw new Error("H10 upstream validation failed");
const dataset = (0, capture_h10_domains_1.buildCaptureH10)(manifest, roots, h9, h9Text);
const validation = (0, capture_h10_domains_1.validateCaptureH10)(dataset, manifest, roots, h9, h9Text);
const text = `${JSON.stringify(dataset, null, 2)}\n`;
const scan = (0, capture_secret_scan_1.scanTextsForSecrets)((0, capture_secret_scan_1.collectCaptureSensitiveValues)(manifest, roots), [{ name: "capture-h10-domains.json", text }]);
if (!scan.valid)
    throw new Error("H10 secret scan failed");
const output = (0, path_1.resolve)(root, "data/database-server-captures/h10");
(0, fs_1.mkdirSync)(output, { recursive: true });
(0, fs_1.writeFileSync)((0, path_1.resolve)(output, "capture-h10-domains.json"), text);
(0, fs_1.writeFileSync)((0, path_1.resolve)(output, "capture-h10-validation.json"), `${JSON.stringify(validation, null, 2)}\n`);
(0, fs_1.writeFileSync)((0, path_1.resolve)(output, "capture-h10-secret-scan.json"), `${JSON.stringify(scan, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ ...validation, crashBoundary: dataset.crashBoundary, secretScanValid: scan.valid })}\n`);
//# sourceMappingURL=capture-h10-run.js.map