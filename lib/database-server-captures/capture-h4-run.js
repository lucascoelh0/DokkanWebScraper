"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const v8_1 = require("v8");
const capture_h4_gashas_1 = require("./capture-h4-gashas");
const capture_secret_scan_1 = require("./capture-secret-scan");
const repositoryRoot = (0, path_1.resolve)(process.cwd());
if (JSON.parse((0, fs_1.readFileSync)((0, path_1.resolve)(repositoryRoot, "package.json"), "utf8"))?.name !== "dokkan-web-scraper")
    throw new Error("H4 must run from the repository root");
if ((0, v8_1.getHeapStatistics)().heap_size_limit >= 1024 * 1024 * 1024)
    throw new Error("H4 requires a Node heap below 1 GiB");
const manifest = JSON.parse((0, fs_1.readFileSync)((0, path_1.resolve)(repositoryRoot, "database-server-captures", "capture-input-manifest.json"), "utf8"));
const h0 = JSON.parse((0, fs_1.readFileSync)((0, path_1.resolve)(repositoryRoot, "data", "database-server-captures", "h0", "capture-h0-inventory.json"), "utf8"));
const roots = { "dokkan-local-captures": "D:\\Dokkan" };
const dataset = (0, capture_h4_gashas_1.buildCaptureH4)(manifest, roots, h0), validation = (0, capture_h4_gashas_1.validateCaptureH4)(dataset, h0);
const outputText = `${JSON.stringify(dataset, null, 2)}\n`;
const scan = (0, capture_secret_scan_1.scanTextsForSecrets)((0, capture_secret_scan_1.collectCaptureSensitiveValues)(manifest, roots), [{ name: "capture-h4-gashas.json", text: outputText }]);
if (!scan.valid)
    throw new Error(`H4 secret scan failed for ${scan.failingTargets.length} target(s)`);
const outputDirectory = (0, path_1.resolve)(repositoryRoot, "data", "database-server-captures", "h4");
(0, fs_1.mkdirSync)(outputDirectory, { recursive: true });
(0, fs_1.writeFileSync)((0, path_1.resolve)(outputDirectory, "capture-h4-gashas.json"), outputText);
(0, fs_1.writeFileSync)((0, path_1.resolve)(outputDirectory, "capture-h4-validation.json"), `${JSON.stringify(validation, null, 2)}\n`);
(0, fs_1.writeFileSync)((0, path_1.resolve)(outputDirectory, "capture-h4-secret-scan.json"), `${JSON.stringify(scan, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ contract: dataset.contract, contractVersion: dataset.contractVersion, entityCount: validation.entityCount, factCount: validation.factCount, supportedCount: validation.supportedCount, partialCount: validation.partialCount, userDerivedAuthorityCount: validation.userDerivedAuthorityCount, secretScanValid: scan.valid })}\n`);
//# sourceMappingURL=capture-h4-run.js.map