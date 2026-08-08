"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const v8_1 = require("v8");
const capture_h1_sanitizer_1 = require("./capture-h1-sanitizer");
const capture_secret_scan_1 = require("./capture-secret-scan");
const repositoryRoot = (0, path_1.resolve)(process.cwd());
const packageMetadata = JSON.parse((0, fs_1.readFileSync)((0, path_1.resolve)(repositoryRoot, "package.json"), "utf8"));
if (packageMetadata?.name !== "dokkan-web-scraper")
    throw new Error("capture sanitizer must run from the repository root");
if ((0, v8_1.getHeapStatistics)().heap_size_limit >= 1024 * 1024 * 1024)
    throw new Error("capture sanitizer requires a Node heap limit below 1 GiB");
const manifest = JSON.parse((0, fs_1.readFileSync)((0, path_1.resolve)(repositoryRoot, "database-server-captures", "capture-input-manifest.json"), "utf8"));
const h0 = JSON.parse((0, fs_1.readFileSync)((0, path_1.resolve)(repositoryRoot, "data", "database-server-captures", "h0", "capture-h0-inventory.json"), "utf8"));
const roots = { "dokkan-local-captures": "D:\\Dokkan" };
const outputDirectory = (0, path_1.resolve)(repositoryRoot, "data", "database-server-captures", "h1");
const outputPath = (0, path_1.resolve)(outputDirectory, "capture-h1-schema.json");
const scanPath = (0, path_1.resolve)(outputDirectory, "capture-h1-secret-scan.json");
const dataset = (0, capture_h1_sanitizer_1.buildCaptureH1)(manifest, roots, h0);
const outputText = `${JSON.stringify(dataset, null, 2)}\n`;
const scan = (0, capture_secret_scan_1.scanTextsForSecrets)((0, capture_secret_scan_1.collectCaptureSensitiveValues)(manifest, roots), [{ name: "capture-h1-schema.json", text: outputText }]);
(0, fs_1.mkdirSync)(outputDirectory, { recursive: true });
(0, fs_1.writeFileSync)(scanPath, `${JSON.stringify(scan, null, 2)}\n`);
if (!scan.valid)
    throw new Error(`H1 secret scan failed for ${scan.failingTargets.length} target(s)`);
(0, fs_1.writeFileSync)(outputPath, outputText);
process.stdout.write(`${JSON.stringify({ contract: dataset.contract, contractVersion: dataset.contractVersion, captureCount: dataset.captures.length, observationCount: dataset.captures.reduce((sum, value) => sum + value.observations.length, 0), valueFixtureCount: dataset.valueFixtureCount, secretScanValid: scan.valid })}\n`);
//# sourceMappingURL=capture-h1-run.js.map