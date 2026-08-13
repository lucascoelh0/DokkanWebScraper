"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const data_download_context_1 = require("./data-download-context");
const data_download_dd7_1 = require("./data-download-dd7");
const { root, dd2 } = (0, data_download_context_1.loadDdContext)(), dd6Text = (0, fs_1.readFileSync)((0, path_1.resolve)(root, "data/database-data-download-captures/dd6/data-download-dd6-shadow-parity.json"), "utf8"), dataset = (0, data_download_dd7_1.buildDd7)(dd2.generatedAt, dd6Text), validation = (0, data_download_dd7_1.validateDd7)(dataset), out = (0, path_1.resolve)(root, "data/database-data-download-captures/dd7");
(0, fs_1.mkdirSync)(out, { recursive: true });
(0, fs_1.writeFileSync)((0, path_1.resolve)(out, "data-download-dd7-architecture.json"), `${JSON.stringify(dataset, null, 2)}\n`);
(0, fs_1.writeFileSync)((0, path_1.resolve)(out, "data-download-dd7-validation.json"), `${JSON.stringify(validation, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(validation)}\n`);
//# sourceMappingURL=data-download-dd7-run.js.map