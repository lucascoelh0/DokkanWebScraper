"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const data_download_context_1 = require("./data-download-context");
const data_download_dd5_1 = require("./data-download-dd5");
const { root, loaded, dd1, dd2 } = (0, data_download_context_1.loadDdContext)(), dataset = (0, data_download_dd5_1.buildDd5)(loaded, dd1, dd2), validation = (0, data_download_dd5_1.validateDd5)(dataset), out = (0, path_1.resolve)(root, "data/database-data-download-captures/dd5");
(0, fs_1.mkdirSync)(out, { recursive: true });
(0, fs_1.writeFileSync)((0, path_1.resolve)(out, "data-download-dd5-cache-integrity.json"), `${JSON.stringify(dataset, null, 2)}\n`);
(0, fs_1.writeFileSync)((0, path_1.resolve)(out, "data-download-dd5-validation.json"), `${JSON.stringify(validation, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(validation)}\n`);
//# sourceMappingURL=data-download-dd5-run.js.map