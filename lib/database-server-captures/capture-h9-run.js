"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const v8_1 = require("v8");
const capture_h8_audit_1 = require("./capture-h8-audit");
const capture_h9_schemas_1 = require("./capture-h9-schemas");
const capture_secret_scan_1 = require("./capture-secret-scan");
const root = (0, path_1.resolve)(process.cwd());
if ((0, v8_1.getHeapStatistics)().heap_size_limit >= 1024 * 1024 * 1024)
    throw new Error("H9 requires Node heap below 1 GiB");
const manifest = JSON.parse((0, fs_1.readFileSync)((0, path_1.resolve)(root, "database-server-captures/capture-h8-input-manifest.json"), "utf8")), roots = { "dokkan-local-captures-0810": "D:\\Dokkan\\har logs\\08-10" };
const h8Text = (0, fs_1.readFileSync)((0, path_1.resolve)(root, "data/database-server-captures/h8/capture-h8-inventory.json"), "utf8"), h8 = JSON.parse(h8Text);
if (!(0, capture_h8_audit_1.validateCaptureH8)(h8, manifest, roots).valid)
    throw new Error("H9 requires validated H8 lineage");
const dataset = (0, capture_h9_schemas_1.buildCaptureH9)(manifest, roots, h8, h8Text), validation = (0, capture_h9_schemas_1.validateCaptureH9)(dataset, manifest, roots, h8, h8Text), text = `${JSON.stringify(dataset, null, 2)}\n`, scan = (0, capture_secret_scan_1.scanTextsForSecrets)((0, capture_secret_scan_1.collectCaptureSensitiveValues)(manifest, roots), [{ name: "capture-h9-observed-schemas.json", text }]);
if (!scan.valid)
    throw new Error("H9 secret scan failed");
const out = (0, path_1.resolve)(root, "data/database-server-captures/h9");
(0, fs_1.mkdirSync)(out, { recursive: true });
(0, fs_1.writeFileSync)((0, path_1.resolve)(out, "capture-h9-observed-schemas.json"), text);
(0, fs_1.writeFileSync)((0, path_1.resolve)(out, "capture-h9-validation.json"), `${JSON.stringify(validation, null, 2)}\n`);
(0, fs_1.writeFileSync)((0, path_1.resolve)(out, "capture-h9-secret-scan.json"), `${JSON.stringify(scan, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ ...validation, secretScanValid: scan.valid })}\n`);
//# sourceMappingURL=capture-h9-run.js.map