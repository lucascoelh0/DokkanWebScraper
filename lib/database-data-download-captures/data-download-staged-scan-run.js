"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const v8_1 = require("v8");
const fs_1 = require("fs");
const path_1 = require("path");
const data_download_core_1 = require("./data-download-core");
if ((0, v8_1.getHeapStatistics)().heap_size_limit >= 1024 * 1024 * 1024)
    throw new Error("DD staged scan requires a Node heap below 1 GiB");
const root = (0, path_1.resolve)(process.cwd());
const lock = JSON.parse((0, fs_1.readFileSync)((0, path_1.resolve)(root, "database-data-download-captures/data-download-source-lock.json"), "utf8"));
const loaded = (0, data_download_core_1.loadDdCaptures)("D:\\Dokkan\\har logs\\08-10", lock);
const external = (0, data_download_core_1.loadDdExternalSources)("D:\\Dokkan\\har logs\\08-10", lock);
const sensitive = (0, data_download_core_1.collectDdSensitiveValues)(loaded);
for (const value of (0, data_download_core_1.collectDdExternalSensitiveValues)(external))
    sensitive.add(value);
const result = (0, data_download_core_1.scanVersionableTargets)(sensitive, (0, data_download_core_1.stagedDdVersionableTargets)());
if (!result.valid)
    throw new Error(`DD staged secret scan rejected ${result.failingTargetCount} target(s)`);
process.stdout.write(`${JSON.stringify(result)}\n`);
//# sourceMappingURL=data-download-staged-scan-run.js.map