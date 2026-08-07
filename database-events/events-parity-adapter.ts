import { spawn } from "child_process";
import { existsSync } from "fs";
import { resolve } from "path";

export interface EventsParityBridgePaths {
    database: string;
    questStory: string;
    eventStages: string;
    stageCatalog: string;
    stageDetails: string;
    zBattles: string;
    frontierSeries: string;
    frontierChapters: string;
    eventRewards: string;
    eventMissions: string;
    eventCache: string;
}

export async function runEventsParityBridge<T>(paths: EventsParityBridgePaths, onData?: () => void): Promise<T> {
    const adjacent = resolve(__dirname, "events-parity-readonly-bridge.py"), source = resolve(__dirname, "..", "..", "database-events", "events-parity-readonly-bridge.py"), bridgePath = existsSync(adjacent) ? adjacent : source;
    const args = [bridgePath, "--database", paths.database, "--quest-story", paths.questStory, "--event-stages", paths.eventStages, "--stage-catalog", paths.stageCatalog, "--stage-details", paths.stageDetails, "--z-battles", paths.zBattles, "--frontier-series", paths.frontierSeries, "--frontier-chapters", paths.frontierChapters, "--event-rewards", paths.eventRewards, "--event-missions", paths.eventMissions, "--event-cache", paths.eventCache];
    return new Promise<T>((done, reject) => {
        const child = spawn(process.platform === "win32" ? "python" : "python3", args, { shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
        const stdout: Buffer[] = [], stderr: Buffer[] = [];
        child.stdout.on("data", chunk => { stdout.push(Buffer.from(chunk)); onData?.(); });
        child.stderr.on("data", chunk => stderr.push(Buffer.from(chunk)));
        child.on("error", reject);
        child.on("close", code => code === 0 ? done(JSON.parse(Buffer.concat(stdout).toString("utf8")) as T) : reject(new Error(`Events parity bridge failed (${code}): ${Buffer.concat(stderr).toString("utf8")}`)));
    });
}
