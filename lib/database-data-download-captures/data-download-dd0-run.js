"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const data_download_context_1 = require("./data-download-context");
const data_download_core_1 = require("./data-download-core");
const { root, loaded, external, dd0: dataset } = (0, data_download_context_1.loadDdContext)();
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