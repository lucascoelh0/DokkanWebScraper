"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runEventsParityBridge = void 0;
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const path_1 = require("path");
async function runEventsParityBridge(paths, onData) {
    const adjacent = (0, path_1.resolve)(__dirname, "events-parity-readonly-bridge.py"), source = (0, path_1.resolve)(__dirname, "..", "..", "database-events", "events-parity-readonly-bridge.py"), bridgePath = (0, fs_1.existsSync)(adjacent) ? adjacent : source;
    const args = [bridgePath, "--database", paths.database, "--quest-story", paths.questStory, "--event-stages", paths.eventStages, "--stage-catalog", paths.stageCatalog, "--stage-details", paths.stageDetails, "--z-battles", paths.zBattles, "--frontier-series", paths.frontierSeries, "--frontier-chapters", paths.frontierChapters, "--event-rewards", paths.eventRewards, "--event-missions", paths.eventMissions, "--event-cache", paths.eventCache];
    return new Promise((done, reject) => {
        const child = (0, child_process_1.spawn)(process.platform === "win32" ? "python" : "python3", args, { shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
        const stdout = [], stderr = [];
        child.stdout.on("data", chunk => { stdout.push(Buffer.from(chunk)); onData?.(); });
        child.stderr.on("data", chunk => stderr.push(Buffer.from(chunk)));
        child.on("error", reject);
        child.on("close", code => code === 0 ? done(JSON.parse(Buffer.concat(stdout).toString("utf8"))) : reject(new Error(`Events parity bridge failed (${code}): ${Buffer.concat(stderr).toString("utf8")}`)));
    });
}
exports.runEventsParityBridge = runEventsParityBridge;
//# sourceMappingURL=events-parity-adapter.js.map