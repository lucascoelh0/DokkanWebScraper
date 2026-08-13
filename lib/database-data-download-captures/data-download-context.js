"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadDdContext = exports.DD_CAPTURE_ROOT = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
const v8_1 = require("v8");
const data_download_core_1 = require("./data-download-core");
const data_download_dd1_1 = require("./data-download-dd1");
const data_download_dd2_1 = require("./data-download-dd2");
exports.DD_CAPTURE_ROOT = "D:\\Dokkan\\har logs\\08-10";
function loadDdContext() {
    if ((0, v8_1.getHeapStatistics)().heap_size_limit >= 1024 * 1024 * 1024)
        throw new Error("DD campaign requires a Node heap below 1 GiB");
    const root = (0, path_1.resolve)(process.cwd()), lock = JSON.parse((0, fs_1.readFileSync)((0, path_1.resolve)(root, "database-data-download-captures/data-download-source-lock.json"), "utf8")), loaded = (0, data_download_core_1.loadDdCaptures)(exports.DD_CAPTURE_ROOT, lock), external = (0, data_download_core_1.loadDdExternalSources)(exports.DD_CAPTURE_ROOT, lock), dd0 = (0, data_download_core_1.buildDd0)(lock, loaded, external), dd1 = (0, data_download_dd1_1.buildDd1)(loaded, lock, dd0), dd2 = (0, data_download_dd2_1.buildDd2)(loaded, external, lock, dd0, dd1);
    return { root, lock, loaded, external, dd0, dd1, dd2 };
}
exports.loadDdContext = loadDdContext;
//# sourceMappingURL=data-download-context.js.map