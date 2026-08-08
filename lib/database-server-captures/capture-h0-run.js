"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const v8_1 = require("v8");
const capture_h0_audit_1 = require("./capture-h0-audit");
const repositoryRoot = (0, path_1.resolve)(process.cwd());
const packageMetadata = JSON.parse((0, fs_1.readFileSync)((0, path_1.resolve)(repositoryRoot, "package.json"), "utf8"));
if (packageMetadata?.name !== "dokkan-web-scraper")
    throw new Error("capture audit must run from the repository root");
if ((0, v8_1.getHeapStatistics)().heap_size_limit >= 1024 * 1024 * 1024)
    throw new Error("capture audit requires a Node heap limit below 1 GiB");
const manifestPath = (0, path_1.resolve)(repositoryRoot, "database-server-captures", "capture-input-manifest.json");
const outputDirectory = (0, path_1.resolve)(repositoryRoot, "data", "database-server-captures", "h0");
const outputPath = (0, path_1.resolve)(outputDirectory, "capture-h0-inventory.json");
const manifest = JSON.parse((0, fs_1.readFileSync)(manifestPath, "utf8"));
const dataset = (0, capture_h0_audit_1.auditCaptureManifest)(manifest, { "dokkan-local-captures": "D:\\Dokkan" });
(0, fs_1.mkdirSync)(outputDirectory, { recursive: true });
(0, fs_1.writeFileSync)(outputPath, `${JSON.stringify(dataset, null, 2)}\n`, { encoding: "utf8", flag: "w" });
process.stdout.write(`${JSON.stringify({ contract: dataset.contract, contractVersion: dataset.contractVersion, captureCount: dataset.captures.length, targetEntryCount: dataset.captures.reduce((sum, value) => sum + value.targetEntryCount, 0), duplicateGroupCount: dataset.duplicateGroups.length })}\n`);
//# sourceMappingURL=capture-h0-run.js.map