"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const data_download_context_1 = require("./data-download-context");
const data_download_dd4_1 = require("./data-download-dd4");
const { root, dd1, dd2 } = (0, data_download_context_1.loadDdContext)(), dataset = (0, data_download_dd4_1.buildDd4)(dd1, dd2), validation = (0, data_download_dd4_1.validateDd4)(dataset), out = (0, path_1.resolve)(root, "data/database-data-download-captures/dd4");
(0, fs_1.mkdirSync)(out, { recursive: true });
(0, fs_1.writeFileSync)((0, path_1.resolve)(out, "data-download-dd4-families.json"), `${JSON.stringify(dataset, null, 2)}\n`);
(0, fs_1.writeFileSync)((0, path_1.resolve)(out, "data-download-dd4-validation.json"), `${JSON.stringify(validation, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(validation)}\n`);
//# sourceMappingURL=data-download-dd4-run.js.map