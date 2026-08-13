"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const data_download_context_1 = require("./data-download-context");
const data_download_core_1 = require("./data-download-core");
const { loaded, external } = (0, data_download_context_1.loadDdContext)();
const sensitive = (0, data_download_core_1.collectDdSensitiveValues)(loaded);
for (const value of (0, data_download_core_1.collectDdExternalSensitiveValues)(external))
    sensitive.add(value);
const result = (0, data_download_core_1.scanVersionableTargets)(sensitive, (0, data_download_core_1.stagedDdVersionableTargets)());
if (!result.valid)
    throw new Error(`DD staged secret scan rejected ${result.failingTargetCount} target(s)`);
process.stdout.write(`${JSON.stringify(result)}\n`);
//# sourceMappingURL=data-download-staged-scan-run.js.map