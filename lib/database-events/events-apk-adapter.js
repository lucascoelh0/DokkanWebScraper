"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runEventsApkBridge = void 0;
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const path_1 = require("path");
async function runEventsApkBridge(apkPath, onData) {
    const adjacent = (0, path_1.resolve)(__dirname, "events-apk-readonly-bridge.py"), source = (0, path_1.resolve)(__dirname, "..", "..", "database-events", "events-apk-readonly-bridge.py"), bridgePath = (0, fs_1.existsSync)(adjacent) ? adjacent : source;
    return new Promise((done, reject) => {
        const child = (0, child_process_1.spawn)(process.platform === "win32" ? "python" : "python3", [bridgePath, "--apk", apkPath], { shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
        const stdout = [], stderr = [];
        child.stdout.on("data", chunk => { stdout.push(Buffer.from(chunk)); onData?.(); });
        child.stderr.on("data", chunk => stderr.push(Buffer.from(chunk)));
        child.on("error", reject);
        child.on("close", code => code === 0 ? done(JSON.parse(Buffer.concat(stdout).toString("utf8"))) : reject(new Error(`Events APK bridge failed (${code}): ${Buffer.concat(stderr).toString("utf8")}`)));
    });
}
exports.runEventsApkBridge = runEventsApkBridge;
//# sourceMappingURL=events-apk-adapter.js.map