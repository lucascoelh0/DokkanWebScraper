import { spawn } from "child_process";
import { existsSync } from "fs";
import { resolve } from "path";

export async function runEventsApkBridge<T>(apkPath: string, onData?: () => void): Promise<T> {
    const adjacent = resolve(__dirname, "events-apk-readonly-bridge.py"), source = resolve(__dirname, "..", "..", "database-events", "events-apk-readonly-bridge.py"), bridgePath = existsSync(adjacent) ? adjacent : source;
    return new Promise<T>((done, reject) => {
        const child = spawn(process.platform === "win32" ? "python" : "python3", [bridgePath, "--apk", apkPath], { shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
        const stdout: Buffer[] = [], stderr: Buffer[] = [];
        child.stdout.on("data", chunk => { stdout.push(Buffer.from(chunk)); onData?.(); });
        child.stderr.on("data", chunk => stderr.push(Buffer.from(chunk)));
        child.on("error", reject);
        child.on("close", code => code === 0 ? done(JSON.parse(Buffer.concat(stdout).toString("utf8")) as T) : reject(new Error(`Events APK bridge failed (${code}): ${Buffer.concat(stderr).toString("utf8")}`)));
    });
}
