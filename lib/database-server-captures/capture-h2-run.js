"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const v8_1 = require("v8");
const capture_h2_provenance_1 = require("./capture-h2-provenance");
const capture_secret_scan_1 = require("./capture-secret-scan");
const repositoryRoot = (0, path_1.resolve)(process.cwd());
if (JSON.parse((0, fs_1.readFileSync)((0, path_1.resolve)(repositoryRoot, "package.json"), "utf8"))?.name !== "dokkan-web-scraper")
    throw new Error("capture provenance must run from the repository root");
if ((0, v8_1.getHeapStatistics)().heap_size_limit >= 1024 * 1024 * 1024)
    throw new Error("capture provenance requires a Node heap limit below 1 GiB");
const manifest = JSON.parse((0, fs_1.readFileSync)((0, path_1.resolve)(repositoryRoot, "database-server-captures", "capture-input-manifest.json"), "utf8"));
const h1 = JSON.parse((0, fs_1.readFileSync)((0, path_1.resolve)(repositoryRoot, "data", "database-server-captures", "h1", "capture-h1-schema.json"), "utf8"));
const dataset = (0, capture_h2_provenance_1.buildCaptureH2)(h1);
const validation = (0, capture_h2_provenance_1.validateCaptureH2)(dataset, h1);
const outputText = `${JSON.stringify(dataset, null, 2)}\n`;
const roots = { "dokkan-local-captures": "D:\\Dokkan" };
const scan = (0, capture_secret_scan_1.scanTextsForSecrets)((0, capture_secret_scan_1.collectCaptureSensitiveValues)(manifest, roots), [{ name: "capture-h2-provenance.json", text: outputText }]);
if (!scan.valid)
    throw new Error(`H2 secret scan failed for ${scan.failingTargets.length} target(s)`);
const outputDirectory = (0, path_1.resolve)(repositoryRoot, "data", "database-server-captures", "h2");
(0, fs_1.mkdirSync)(outputDirectory, { recursive: true });
(0, fs_1.writeFileSync)((0, path_1.resolve)(outputDirectory, "capture-h2-provenance.json"), outputText);
(0, fs_1.writeFileSync)((0, path_1.resolve)(outputDirectory, "capture-h2-validation.json"), `${JSON.stringify(validation, null, 2)}\n`);
(0, fs_1.writeFileSync)((0, path_1.resolve)(outputDirectory, "capture-h2-secret-scan.json"), `${JSON.stringify(scan, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ contract: dataset.contract, contractVersion: dataset.contractVersion, factCount: validation.factCount, supportedCount: validation.supportedCount, partialCount: validation.partialCount, unknownCount: validation.unknownCount, userDerivedAuthorityCount: validation.userDerivedAuthorityCount, secretScanValid: scan.valid })}\n`);
//# sourceMappingURL=capture-h2-run.js.map