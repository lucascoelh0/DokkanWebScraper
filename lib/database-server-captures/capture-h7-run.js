"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const v8_1 = require("v8");
const capture_h3_schedules_1 = require("./capture-h3-schedules");
const capture_h4_gashas_1 = require("./capture-h4-gashas");
const capture_h5_missions_1 = require("./capture-h5-missions");
const capture_h6_assets_1 = require("./capture-h6-assets");
const capture_h7_inputs_1 = require("./capture-h7-inputs");
const capture_h7_shadow_readiness_1 = require("./capture-h7-shadow-readiness");
const capture_secret_scan_1 = require("./capture-secret-scan");
const repositoryRoot = (0, path_1.resolve)(process.cwd());
if (JSON.parse((0, fs_1.readFileSync)((0, path_1.resolve)(repositoryRoot, "package.json"), "utf8"))?.name !== "dokkan-web-scraper")
    throw new Error("H7 must run from the repository root");
if ((0, v8_1.getHeapStatistics)().heap_size_limit >= 1024 * 1024 * 1024)
    throw new Error("H7 requires a Node heap below 1 GiB");
const readLocal = (relativePath) => { const text = (0, fs_1.readFileSync)((0, path_1.resolve)(repositoryRoot, relativePath), "utf8"); return { value: JSON.parse(text), text }; };
const h0File = readLocal("data/database-server-captures/h0/capture-h0-inventory.json"), h3File = readLocal("data/database-server-captures/h3/capture-h3-schedules.json"), h4File = readLocal("data/database-server-captures/h4/capture-h4-gashas.json"), h5File = readLocal("data/database-server-captures/h5/capture-h5-mission-boards.json"), h6File = readLocal("data/database-server-captures/h6/capture-h6-assets.json");
const h0 = h0File.value, h3 = h3File.value, h4 = h4File.value, h5 = h5File.value, h6 = h6File.value;
if (!(0, capture_h3_schedules_1.validateCaptureH3)(h3, h0).valid || !(0, capture_h4_gashas_1.validateCaptureH4)(h4, h0).valid || !(0, capture_h5_missions_1.validateCaptureH5)(h5, h0).valid || !(0, capture_h6_assets_1.validateCaptureH6)(h6, h0).valid)
    throw new Error("H7 capture sidecar validation failed");
const sourceLockFile = readLocal("database-server-captures/capture-h7-source-lock.json");
const external = (0, capture_h7_inputs_1.loadCaptureH7ExternalInputs)("D:\\Dokkan\\DokkanWebScraper\\data", sourceLockFile.value);
const localLineage = [(0, capture_h7_inputs_1.captureH7LocalLineage)("h0", "data/database-server-captures/h0/capture-h0-inventory.json", h0File.text, h0.contract, h0.contractVersion), (0, capture_h7_inputs_1.captureH7LocalLineage)("h3", "data/database-server-captures/h3/capture-h3-schedules.json", h3File.text, h3.contract, h3.contractVersion), (0, capture_h7_inputs_1.captureH7LocalLineage)("h4", "data/database-server-captures/h4/capture-h4-gashas.json", h4File.text, h4.contract, h4.contractVersion), (0, capture_h7_inputs_1.captureH7LocalLineage)("h5", "data/database-server-captures/h5/capture-h5-mission-boards.json", h5File.text, h5.contract, h5.contractVersion), (0, capture_h7_inputs_1.captureH7LocalLineage)("h6", "data/database-server-captures/h6/capture-h6-assets.json", h6File.text, h6.contract, h6.contractVersion)];
const sourceLockSha256 = (0, capture_h7_inputs_1.captureH7LocalLineage)("source_lock", "database-server-captures/capture-h7-source-lock.json", sourceLockFile.text, sourceLockFile.value.contract, sourceLockFile.value.contractVersion).artifactSha256;
const dataset = (0, capture_h7_shadow_readiness_1.buildCaptureH7)(h0.generatedAt, sourceLockSha256, external.inputs, [...external.lineage, ...localLineage], h3, h4, h5, h6), validation = (0, capture_h7_shadow_readiness_1.validateCaptureH7)(dataset), outputText = `${JSON.stringify(dataset, null, 2)}\n`;
const manifest = JSON.parse((0, fs_1.readFileSync)((0, path_1.resolve)(repositoryRoot, "database-server-captures", "capture-input-manifest.json"), "utf8")), roots = { "dokkan-local-captures": "D:\\Dokkan" };
const scan = (0, capture_secret_scan_1.scanTextsForSecrets)((0, capture_secret_scan_1.collectCaptureSensitiveValues)(manifest, roots), [{ name: "capture-h7-shadow-readiness.json", text: outputText }]);
if (!scan.valid)
    throw new Error(`H7 secret scan failed for ${scan.failingTargets.length} target(s)`);
const outputDirectory = (0, path_1.resolve)(repositoryRoot, "data", "database-server-captures", "h7");
(0, fs_1.mkdirSync)(outputDirectory, { recursive: true });
(0, fs_1.writeFileSync)((0, path_1.resolve)(outputDirectory, "capture-h7-shadow-readiness.json"), outputText);
(0, fs_1.writeFileSync)((0, path_1.resolve)(outputDirectory, "capture-h7-validation.json"), `${JSON.stringify(validation, null, 2)}\n`);
(0, fs_1.writeFileSync)((0, path_1.resolve)(outputDirectory, "capture-h7-secret-scan.json"), `${JSON.stringify(scan, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ contract: dataset.contract, contractVersion: dataset.contractVersion, sourceCount: validation.sourceCount, comparisonCount: validation.comparisonCount, comparisonCellTotals: validation.comparisonCellTotals, decisions: Object.fromEntries(dataset.decisions.map(value => [value.key, value.status])), secretScanValid: scan.valid })}\n`);
//# sourceMappingURL=capture-h7-run.js.map