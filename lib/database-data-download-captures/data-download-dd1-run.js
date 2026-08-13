"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const data_download_context_1 = require("./data-download-context");
const data_download_core_1 = require("./data-download-core");
const data_download_dd1_1 = require("./data-download-dd1");
const { root, lock, loaded, external, dd1: dataset } = (0, data_download_context_1.loadDdContext)();
const validation = (0, data_download_dd1_1.validateDd1)(dataset, lock);
const targets = [
    { name: "database-data-download-captures/data-download-dd1-inventory.json", text: `${JSON.stringify(dataset, null, 2)}\n` },
    { name: "database-data-download-captures/data-download-dd1-validation.json", text: `${JSON.stringify(validation, null, 2)}\n` },
];
const sensitiveValues = (0, data_download_core_1.collectDdSensitiveValues)(loaded);
for (const value of (0, data_download_core_1.collectDdExternalSensitiveValues)(external))
    sensitiveValues.add(value);
const secretScan = (0, data_download_core_1.scanVersionableTargets)(sensitiveValues, targets);
if (!validation.valid || !secretScan.valid)
    throw new Error("DD1 validation rejected the sanitized artifact");
const output = (0, path_1.resolve)(root, "data/database-data-download-captures/dd1");
(0, fs_1.mkdirSync)(output, { recursive: true });
for (const target of targets)
    (0, fs_1.writeFileSync)((0, path_1.resolve)(output, target.name.split("/").at(-1)), target.text);
(0, fs_1.writeFileSync)((0, path_1.resolve)(output, "data-download-dd1-secret-validation.json"), `${JSON.stringify(secretScan, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(validation)}\n`);
//# sourceMappingURL=data-download-dd1-run.js.map