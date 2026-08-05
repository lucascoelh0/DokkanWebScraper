"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadOnlySqliteAdapter = void 0;
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const path_1 = require("path");
async function runBridge(args, pythonCommand) {
    return new Promise((resolvePromise, rejectPromise) => {
        const child = (0, child_process_1.spawn)(pythonCommand, args, {
            shell: false,
            windowsHide: true,
            stdio: ["ignore", "pipe", "pipe"],
        });
        const stdout = [];
        const stderr = [];
        child.stdout.on("data", chunk => stdout.push(Buffer.from(chunk)));
        child.stderr.on("data", chunk => stderr.push(Buffer.from(chunk)));
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
    constructor(databasePath, pythonCommand = process.platform === "win32" ? "python" : "python3", bridgePath) {
        this.databasePath = databasePath;
        this.pythonCommand = pythonCommand;
        const adjacentBridge = (0, path_1.resolve)(__dirname, "sqlite-readonly-bridge.py");
        this.bridgePath = bridgePath ?? ((0, fs_1.existsSync)(adjacentBridge)
            ? adjacentBridge
            : (0, path_1.resolve)(__dirname, "..", "..", "database-experiment", "sqlite-readonly-bridge.py"));
    }
    async execute(args) {
        const raw = await runBridge([
            this.bridgePath,
            ...args,
            "--database",
            this.databasePath,
        ], this.pythonCommand);
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