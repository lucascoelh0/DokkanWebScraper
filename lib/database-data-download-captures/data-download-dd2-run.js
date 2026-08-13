"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const data_download_context_1 = require("./data-download-context");
const data_download_core_1 = require("./data-download-core");
const data_download_dd2_1 = require("./data-download-dd2");
const { root, loaded, external, dd2: dataset } = (0, data_download_context_1.loadDdContext)();
const validation = (0, data_download_dd2_1.validateDd2)(dataset);
const targets = [
    { name: "database-data-download-captures/data-download-dd2-contracts.json", text: `${JSON.stringify(dataset, null, 2)}\n` },
    { name: "database-data-download-captures/data-download-dd2-validation.json", text: `${JSON.stringify(validation, null, 2)}\n` },
];
const sensitiveValues = (0, data_download_core_1.collectDdSensitiveValues)(loaded);
for (const value of (0, data_download_core_1.collectDdExternalSensitiveValues)(external))
    sensitiveValues.add(value);
const secretScan = (0, data_download_core_1.scanVersionableTargets)(sensitiveValues, targets);
if (!validation.valid || !secretScan.valid)
    throw new Error("DD2 validation rejected the sanitized artifact");
const output = (0, path_1.resolve)(root, "data/database-data-download-captures/dd2");
(0, fs_1.mkdirSync)(output, { recursive: true });
for (const target of targets)
    (0, fs_1.writeFileSync)((0, path_1.resolve)(output, target.name.split("/").at(-1)), target.text);
(0, fs_1.writeFileSync)((0, path_1.resolve)(output, "data-download-dd2-secret-validation.json"), `${JSON.stringify(secretScan, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(validation)}\n`);
//# sourceMappingURL=data-download-dd2-run.js.map