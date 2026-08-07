import { spawn } from "child_process";
import { existsSync } from "fs";
import { resolve } from "path";

export async function runEventsSqliteBridge<T>(command: "inventory" | "catalog" | "topology" | "encounters" | "mechanics", databasePath: string, onData?: () => void): Promise<T> {
    const adjacent = resolve(__dirname, "events-sqlite-readonly-bridge.py");
    const source = resolve(__dirname, "..", "..", "database-events", "events-sqlite-readonly-bridge.py");
    const bridgePath = existsSync(adjacent) ? adjacent : source;
    return new Promise<T>((done, reject) => {
        const child = spawn(process.platform === "win32" ? "python" : "python3", [bridgePath, command, "--database", databasePath], { shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
        const stdout: Buffer[] = [], stderr: Buffer[] = [];
        child.stdout.on("data", chunk => { stdout.push(Buffer.from(chunk)); onData?.(); });
        child.stderr.on("data", chunk => stderr.push(Buffer.from(chunk)));
        child.on("error", reject);
        child.on("close", code => code === 0 ? done(JSON.parse(Buffer.concat(stdout).toString("utf8")) as T) : reject(new Error(`Events SQLite bridge failed (${code}): ${Buffer.concat(stderr).toString("utf8")}`)));
    });
}
