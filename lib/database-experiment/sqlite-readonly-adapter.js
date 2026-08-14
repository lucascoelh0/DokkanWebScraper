"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadOnlySqliteAdapter = void 0;
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const path_1 = require("path");
async function runBridge(args, pythonCommand, databaseBytes) {
    return new Promise((resolvePromise, rejectPromise) => {
        const child = (0, child_process_1.spawn)(pythonCommand, args, {
            shell: false,
            windowsHide: true,
            stdio: [databaseBytes ? "pipe" : "ignore", "pipe", "pipe"],
        });
        const stdout = [];
        const stderr = [];
        child.stdout.on("data", chunk => stdout.push(Buffer.from(chunk)));
        child.stderr.on("data", chunk => stderr.push(Buffer.from(chunk)));
        if (databaseBytes) {
            child.stdin.on("error", error => {
                if (error.code !== "EPIPE")
                    rejectPromise(error);
            });
            child.stdin.end(databaseBytes);
        }
        child.on("error", rejectPromise);
        child.on("close", code => {
            if (code !== 0) {
                rejectPromise(new Error(`SQLite read-only bridge failed with exit code ${code}: ${Buffer.concat(stderr).toString("utf8")}`));
                return;
            }
            resolvePromise(Buffer.concat(stdout).toString("utf8"));
        });
    });
}
class ReadOnlySqliteAdapter {
    databasePath;
    pythonCommand;
    bridgePath;
    databaseBytes;
    constructor(databasePath, pythonCommand = process.platform === "win32" ? "python" : "python3", bridgePath, descriptorBoundBytes) {
        this.databasePath = databasePath;
        this.pythonCommand = pythonCommand;
        const adjacentBridge = (0, path_1.resolve)(__dirname, "sqlite-readonly-bridge.py");
        this.bridgePath = bridgePath ?? ((0, fs_1.existsSync)(adjacentBridge)
            ? adjacentBridge
            : (0, path_1.resolve)(__dirname, "..", "..", "database-experiment", "sqlite-readonly-bridge.py"));
        this.databaseBytes = descriptorBoundBytes ? Buffer.from(descriptorBoundBytes) : undefined;
    }
    static fromDescriptorBoundBytes(databasePathLabel, bytes) {
        if (!Buffer.isBuffer(bytes) || bytes.length === 0)
            throw new Error("Descriptor-bound SQLite bytes are invalid");
        return new ReadOnlySqliteAdapter(databasePathLabel, undefined, undefined, bytes);
    }
    async execute(args) {
        const raw = await runBridge([
            this.bridgePath,
            ...args,
            ...(this.databaseBytes ? ["--database-stdin"] : ["--database", this.databasePath]),
        ], this.pythonCommand, this.databaseBytes);
        return JSON.parse(raw);
    }
    inspect() {
        return this.execute(["inspect"]);
    }
    readTable(table, columns) {
        return this.execute([
            "read-table",
            "--table",
            table,
            ...columns.flatMap(column => ["--column", column]),
        ]);
    }
}
exports.ReadOnlySqliteAdapter = ReadOnlySqliteAdapter;
//# sourceMappingURL=sqlite-readonly-adapter.js.map