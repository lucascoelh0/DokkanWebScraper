"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const v8_1 = require("v8");
const data_download_core_1 = require("./data-download-core");
const data_download_dd1_1 = require("./data-download-dd1");
const data_download_dd2_1 = require("./data-download-dd2");
if ((0, v8_1.getHeapStatistics)().heap_size_limit >= 1024 * 1024 * 1024)
    throw new Error("DD2 requires a Node heap below 1 GiB");
const root = (0, path_1.resolve)(process.cwd());
const lock = JSON.parse((0, fs_1.readFileSync)((0, path_1.resolve)(root, "database-data-download-captures/data-download-source-lock.json"), "utf8"));
const loaded = (0, data_download_core_1.loadDdCaptures)("D:\\Dokkan\\har logs\\08-10", lock);
const external = (0, data_download_core_1.loadDdExternalSources)("D:\\Dokkan\\har logs\\08-10", lock);
const dd0 = (0, data_download_core_1.buildDd0)(lock, loaded, external);
const dd1 = (0, data_download_dd1_1.buildDd1)(loaded, lock, dd0);
const dataset = (0, data_download_dd2_1.buildDd2)(loaded, external, lock, dd0, dd1);
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