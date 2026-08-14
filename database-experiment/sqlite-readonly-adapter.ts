import { spawn } from "child_process";
import { existsSync } from "fs";
import { resolve } from "path";
import { SqliteScalar } from "./contract";

export interface SqliteInspection {
    tableCount: number,
    tables: Array<{ name: string, columns: string[], rowCount: number }>,
}

export type SqliteRow = Record<string, SqliteScalar>;

async function runBridge(args: string[], pythonCommand: string, databaseBytes?: Buffer): Promise<string> {
    return new Promise<string>((resolvePromise, rejectPromise) => {
        const child = spawn(pythonCommand, args, {
            shell: false,
            windowsHide: true,
            stdio: [databaseBytes ? "pipe" : "ignore", "pipe", "pipe"],
        });
        const stdout: Buffer[] = [];
        const stderr: Buffer[] = [];
        child.stdout.on("data", chunk => stdout.push(Buffer.from(chunk)));
        child.stderr.on("data", chunk => stderr.push(Buffer.from(chunk)));
        if (databaseBytes) {
            child.stdin.on("error", error => {
                if ((error as NodeJS.ErrnoException).code !== "EPIPE") rejectPromise(error);
            });
            child.stdin.end(databaseBytes);
        }
        child.on("error", rejectPromise);
        child.on("close", code => {
            if (code !== 0) {
                rejectPromise(new Error(
                    `SQLite read-only bridge failed with exit code ${code}: ${Buffer.concat(stderr).toString("utf8")}`,
                ));
                return;
            }
            resolvePromise(Buffer.concat(stdout).toString("utf8"));
        });
    });
}

export class ReadOnlySqliteAdapter {
    private readonly bridgePath: string;
    private readonly databaseBytes?: Buffer;

    constructor(
        readonly databasePath: string,
        private readonly pythonCommand = process.platform === "win32" ? "python" : "python3",
        bridgePath?: string,
        descriptorBoundBytes?: Buffer,
    ) {
        const adjacentBridge = resolve(__dirname, "sqlite-readonly-bridge.py");
        this.bridgePath = bridgePath ?? (existsSync(adjacentBridge)
            ? adjacentBridge
            : resolve(__dirname, "..", "..", "database-experiment", "sqlite-readonly-bridge.py"));
        this.databaseBytes = descriptorBoundBytes ? Buffer.from(descriptorBoundBytes) : undefined;
    }

    static fromDescriptorBoundBytes(databasePathLabel: string, bytes: Buffer): ReadOnlySqliteAdapter {
        if (!Buffer.isBuffer(bytes) || bytes.length === 0) throw new Error("Descriptor-bound SQLite bytes are invalid");
        return new ReadOnlySqliteAdapter(databasePathLabel, undefined, undefined, bytes);
    }

    private async execute<T>(args: string[]): Promise<T> {
        const raw = await runBridge([
            this.bridgePath,
            ...args,
            ...(this.databaseBytes ? ["--database-stdin"] : ["--database", this.databasePath]),
        ], this.pythonCommand, this.databaseBytes);
        return JSON.parse(raw) as T;
    }

    inspect(): Promise<SqliteInspection> {
        return this.execute<SqliteInspection>(["inspect"]);
    }

    readTable(table: string, columns: string[]): Promise<SqliteRow[]> {
        return this.execute<SqliteRow[]>([
            "read-table",
            "--table",
            table,
            ...columns.flatMap(column => ["--column", column]),
        ]);
    }
}
