"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const v8_1 = require("v8");
const capture_h6_assets_1 = require("./capture-h6-assets");
const capture_secret_scan_1 = require("./capture-secret-scan");
const repositoryRoot = (0, path_1.resolve)(process.cwd());
if (JSON.parse((0, fs_1.readFileSync)((0, path_1.resolve)(repositoryRoot, "package.json"), "utf8"))?.name !== "dokkan-web-scraper")
    throw new Error("H6 must run from the repository root");
if ((0, v8_1.getHeapStatistics)().heap_size_limit >= 1024 * 1024 * 1024)
    throw new Error("H6 requires a Node heap below 1 GiB");
const manifest = JSON.parse((0, fs_1.readFileSync)((0, path_1.resolve)(repositoryRoot, "database-server-captures", "capture-input-manifest.json"), "utf8"));
const h0 = JSON.parse((0, fs_1.readFileSync)((0, path_1.resolve)(repositoryRoot, "data", "database-server-captures", "h0", "capture-h0-inventory.json"), "utf8"));
const roots = { "dokkan-local-captures": "D:\\Dokkan" };
const dataset = (0, capture_h6_assets_1.buildCaptureH6)(manifest, roots, h0), validation = (0, capture_h6_assets_1.validateCaptureH6)(dataset, h0), outputText = `${JSON.stringify(dataset, null, 2)}\n`;
const scan = (0, capture_secret_scan_1.scanTextsForSecrets)((0, capture_secret_scan_1.collectCaptureSensitiveValues)(manifest, roots), [{ name: "capture-h6-assets.json", text: outputText }]);
if (!scan.valid)
    throw new Error(`H6 secret scan failed for ${scan.failingTargets.length} target(s)`);
const outputDirectory = (0, path_1.resolve)(repositoryRoot, "data", "database-server-captures", "h6");
(0, fs_1.mkdirSync)(outputDirectory, { recursive: true });
(0, fs_1.writeFileSync)((0, path_1.resolve)(outputDirectory, "capture-h6-assets.json"), outputText);
(0, fs_1.writeFileSync)((0, path_1.resolve)(outputDirectory, "capture-h6-validation.json"), `${JSON.stringify(validation, null, 2)}\n`);
(0, fs_1.writeFileSync)((0, path_1.resolve)(outputDirectory, "capture-h6-secret-scan.json"), `${JSON.stringify(scan, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ contract: dataset.contract, contractVersion: dataset.contractVersion, observationCount: validation.observationCount, databaseDescriptorCount: validation.databaseDescriptorCount, referenceCount: validation.referenceCount, capturedCdnRequestCount: validation.capturedCdnRequestCount, exactReferenceWithCaptured2xxPathCount: validation.exactReferenceWithCaptured2xxPathCount, exactReferenceWithCaptured304PathCount: validation.exactReferenceWithCaptured304PathCount, userDerivedAuthorityCount: validation.userDerivedAuthorityCount, secretScanValid: scan.valid })}\n`);
//# sourceMappingURL=capture-h6-run.js.map