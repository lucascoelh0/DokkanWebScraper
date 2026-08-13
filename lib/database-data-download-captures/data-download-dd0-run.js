"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const v8_1 = require("v8");
const data_download_core_1 = require("./data-download-core");
if ((0, v8_1.getHeapStatistics)().heap_size_limit >= 1024 * 1024 * 1024)
    throw new Error("DD0 requires a Node heap below 1 GiB");
const root = (0, path_1.resolve)(process.cwd());
const lock = JSON.parse((0, fs_1.readFileSync)((0, path_1.resolve)(root, "database-data-download-captures/data-download-source-lock.json"), "utf8"));
const loaded = (0, data_download_core_1.loadDdCaptures)("D:\\Dokkan\\har logs\\08-10", lock);
const external = (0, data_download_core_1.loadDdExternalSources)("D:\\Dokkan\\har logs\\08-10", lock);
const dataset = (0, data_download_core_1.buildDd0)(lock, loaded, external);
const text = `${JSON.stringify(dataset, null, 2)}\n`;
const sensitiveValues = (0, data_download_core_1.collectDdSensitiveValues)(loaded);
for (const value of (0, data_download_core_1.collectDdExternalSensitiveValues)(external))
    sensitiveValues.add(value);
const secretScan = (0, data_download_core_1.scanVersionableTargets)(sensitiveValues, [{ name: "database-data-download-captures/data-download-dd0-source-audit.json", text }]);
if (!secretScan.valid)
    throw new Error("DD0 captured-value scan rejected the sanitized artifact");
const output = (0, path_1.resolve)(root, "data/database-data-download-captures/dd0");
(0, fs_1.mkdirSync)(output, { recursive: true });
(0, fs_1.writeFileSync)((0, path_1.resolve)(output, "data-download-dd0-source-audit.json"), text);
(0, fs_1.writeFileSync)((0, path_1.resolve)(output, "data-download-dd0-secret-validation.json"), `${JSON.stringify(secretScan, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ valid: true, sources: dataset.sources.length, targetCount: secretScan.targetCount })}\n`);
//# sourceMappingURL=data-download-dd0-run.js.map