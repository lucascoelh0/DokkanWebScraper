"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const data_download_context_1 = require("./data-download-context");
const data_download_dd6_1 = require("./data-download-dd6");
async function main() { const { root, dd2 } = (0, data_download_context_1.loadDdContext)(), lock = JSON.parse((0, fs_1.readFileSync)((0, path_1.resolve)(root, "database-data-download-captures/data-download-dd6-source-lock.json"), "utf8")), dataset = await (0, data_download_dd6_1.buildDd6)(root, lock, dd2), validation = (0, data_download_dd6_1.validateDd6)(dataset, lock), out = (0, path_1.resolve)(root, "data/database-data-download-captures/dd6"); (0, fs_1.mkdirSync)(out, { recursive: true }); (0, fs_1.writeFileSync)((0, path_1.resolve)(out, "data-download-dd6-shadow-parity.json"), `${JSON.stringify(dataset, null, 2)}\n`); (0, fs_1.writeFileSync)((0, path_1.resolve)(out, "data-download-dd6-validation.json"), `${JSON.stringify(validation, null, 2)}\n`); process.stdout.write(`${JSON.stringify(validation)}\n`); }
main().catch(error => { console.error(error instanceof Error ? error.message : "DD6 failed"); process.exitCode = 1; });
//# sourceMappingURL=data-download-dd6-run.js.map