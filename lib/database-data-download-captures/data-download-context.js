"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadDdContext = exports.resolveDdCaptureRoot = exports.DD_CAPTURE_ROOT_ENV = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
const v8_1 = require("v8");
const data_download_core_1 = require("./data-download-core");
const data_download_dd1_1 = require("./data-download-dd1");
const data_download_dd2_1 = require("./data-download-dd2");
exports.DD_CAPTURE_ROOT_ENV = "DOKKAN_DD0_DD8_CAPTURE_ROOT";
function resolveDdCaptureRoot(argv = process.argv.slice(2), env = process.env) {
    let cliValue;
    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index];
        if (argument === "--capture-root") {
            if (cliValue !== undefined || index + 1 >= argv.length)
                throw new Error("DD capture root CLI configuration is invalid");
            cliValue = argv[index + 1];
            index += 1;
        }
        else if (argument.startsWith("--capture-root=")) {
            if (cliValue !== undefined)
                throw new Error("DD capture root CLI configuration is invalid");
            cliValue = argument.slice("--capture-root=".length);
        }
        else {
            throw new Error("DD runner accepts only --capture-root <directory>");
        }
    }
    const envValue = env[exports.DD_CAPTURE_ROOT_ENV];
    if (cliValue !== undefined && envValue !== undefined)
        throw new Error(`DD capture root must use either --capture-root or ${exports.DD_CAPTURE_ROOT_ENV}, not both`);
    const configured = cliValue ?? envValue;
    if (typeof configured !== "string" || configured.trim().length === 0 || configured.includes("\0"))
        throw new Error(`DD capture root is required via --capture-root or ${exports.DD_CAPTURE_ROOT_ENV}`);
    try {
        const link = (0, fs_1.lstatSync)(configured);
        if (!link.isDirectory() || link.isSymbolicLink())
            throw new Error("rejected");
        const realRoot = fs_1.realpathSync.native(configured);
        const realLink = (0, fs_1.lstatSync)(realRoot);
        if (!realLink.isDirectory() || realLink.isSymbolicLink())
            throw new Error("rejected");
        return realRoot;
    }
    catch {
        throw new Error("DD capture root must resolve to a regular directory, not a symlink or junction");
    }
}
exports.resolveDdCaptureRoot = resolveDdCaptureRoot;
function loadDdContext(argv = process.argv.slice(2), env = process.env) {
    if ((0, v8_1.getHeapStatistics)().heap_size_limit >= 1024 * 1024 * 1024)
        throw new Error("DD campaign requires a Node heap below 1 GiB");
    const root = (0, path_1.resolve)(process.cwd()), captureRoot = resolveDdCaptureRoot(argv, env);
    let lock;
    try {
        lock = JSON.parse((0, fs_1.readFileSync)((0, path_1.resolve)(root, "database-data-download-captures/data-download-source-lock.json"), "utf8"));
    }
    catch {
        throw new Error("DD source lock could not be read");
    }
    const loaded = (0, data_download_core_1.loadDdCaptures)(captureRoot, lock), external = (0, data_download_core_1.loadDdExternalSources)(captureRoot, lock), dd0 = (0, data_download_core_1.buildDd0)(lock, loaded, external), dd1 = (0, data_download_dd1_1.buildDd1)(loaded, lock, dd0), dd2 = (0, data_download_dd2_1.buildDd2)(loaded, external, lock, dd0, dd1);
    return { root, lock, loaded, external, dd0, dd1, dd2 };
}
exports.loadDdContext = loadDdContext;
//# sourceMappingURL=data-download-context.js.map