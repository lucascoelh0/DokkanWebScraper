import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { createHash } from "crypto";
import { existsSync } from "fs";
import { FileHandle } from "fs/promises";
import { resolve } from "path";
import { SqliteScalar } from "./contract";

export interface SqliteInspection {
    tableCount: number,
    tables: Array<{ name: string, columns: string[], rowCount: number }>,
}

export type SqliteRow = Record<string, SqliteScalar>;

export class SqliteBridgeTerminationUnconfirmedError extends Error {
    constructor() { super("SQLite read-only bridge termination could not be confirmed"); this.name = "SqliteBridgeTerminationUnconfirmedError"; }
}

interface BridgeLimits {
    timeoutMs: number,
    killGraceMs: number,
    inputLimitBytes: number,
    stdoutLimitBytes: number,
    stderrLimitBytes: number,
}

export interface DescriptorBoundSqliteAdapterOptions extends Partial<BridgeLimits> {
    pythonCommand?: string,
    bridgePath?: string,
    signal?: AbortSignal,
}

interface DescriptorBoundInput {
    handle: FileHandle,
    sizeBytes: number,
    sha256: string,
}

const DEFAULT_LIMITS: BridgeLimits = {
    timeoutMs: 120_000,
    killGraceMs: 1_000,
    inputLimitBytes: 128 * 1024 * 1024,
    stdoutLimitBytes: 8 * 1024 * 1024,
    stderrLimitBytes: 1 * 1024 * 1024,
};
const STREAM_CHUNK_BYTES = 64 * 1024;
const TERMINATION_CONFIRMATION_MS = 5_000;

function positiveSafeInteger(value: number, label: string): number {
    if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${label} must be a positive safe integer`);
    return value;
}

function sanitizeBridgeMessage(bytes: Buffer): string {
    return bytes.toString("utf8").replace(/[^\x20-\x7e\r\n\t]/g, "?").replace(/[\r\n\t ]+/g, " ").trim().slice(0, 4096);
}

function waitForWritableCallback(child: ChildProcessWithoutNullStreams, bytes: Buffer): Promise<void> {
    return new Promise<void>((done, reject) => {
        child.stdin.write(bytes, error => error ? reject(error) : done());
    });
}

function endStdin(child: ChildProcessWithoutNullStreams): Promise<void> {
    if (child.stdin.destroyed || child.stdin.writableEnded) return Promise.resolve();
    return new Promise<void>((done, reject) => child.stdin.end(error => error ? reject(error) : done()));
}

function waitForCloseBounded(closePromise: Promise<void>, milliseconds: number): Promise<boolean> {
    return new Promise<boolean>(done => {
        let settled = false;
        const timer = setTimeout(() => { if (!settled) { settled = true; done(false); } }, milliseconds);
        closePromise.then(() => {
            if (!settled) { settled = true; clearTimeout(timer); done(true); }
        });
    });
}

function processIsAlive(pid: number | undefined): boolean {
    if (!pid) return false;
    try { process.kill(pid, 0); return true; }
    catch { return false; }
}

async function forceTerminateProcessTree(child: ChildProcessWithoutNullStreams): Promise<void> {
    child.kill("SIGKILL");
    if (process.platform !== "win32" || !child.pid) return;
    const killer = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], { shell: false, windowsHide: true, stdio: "ignore" });
    const killerClosed = new Promise<void>(done => { killer.once("error", () => done()); killer.once("close", () => done()); });
    if (await waitForCloseBounded(killerClosed, TERMINATION_CONFIRMATION_MS)) return;
    killer.kill("SIGKILL");
    if (await waitForCloseBounded(killerClosed, TERMINATION_CONFIRMATION_MS)) return;
    if (processIsAlive(killer.pid)) throw new Error("SQLite bridge termination helper could not be stopped");
    killer.unref();
}

async function streamDescriptorBoundInput(
    child: ChildProcessWithoutNullStreams,
    input: DescriptorBoundInput,
    inputLimitBytes: number,
    signal?: AbortSignal,
): Promise<number> {
    positiveSafeInteger(input.sizeBytes, "Descriptor-bound SQLite size");
    if (input.sizeBytes > inputLimitBytes) throw new Error("Descriptor-bound SQLite exceeds the bridge input limit");
    const buffer = Buffer.allocUnsafe(Math.min(STREAM_CHUNK_BYTES, input.sizeBytes));
    const hash = createHash("sha256");
    let transmitted = 0;
    while (transmitted < input.sizeBytes) {
        if (signal?.aborted) throw new Error("SQLite read-only bridge was cancelled");
        const requested = Math.min(buffer.length, input.sizeBytes - transmitted);
        const { bytesRead } = await input.handle.read(buffer, 0, requested, transmitted);
        if (bytesRead <= 0) throw new Error("Descriptor-bound SQLite ended before its validated size");
        if (transmitted > inputLimitBytes - bytesRead) throw new Error("Descriptor-bound SQLite exceeded the bridge input limit while streaming");
        transmitted += bytesRead;
        const chunk = Buffer.from(buffer.subarray(0, bytesRead));
        hash.update(chunk);
        await waitForWritableCallback(child, chunk);
    }
    const extra = Buffer.alloc(1);
    if ((await input.handle.read(extra, 0, 1, input.sizeBytes)).bytesRead !== 0) throw new Error("Descriptor-bound SQLite exceeded its validated size while streaming");
    await endStdin(child);
    if (transmitted !== input.sizeBytes) throw new Error("Descriptor-bound SQLite transmitted byte count mismatch");
    if (hash.digest("hex") !== input.sha256) throw new Error("Descriptor-bound SQLite transmitted SHA-256 mismatch");
    return transmitted;
}

async function runBridge(
    args: string[],
    pythonCommand: string,
    limits: BridgeLimits,
    input?: DescriptorBoundInput,
    signal?: AbortSignal,
): Promise<string> {
    if (signal?.aborted) throw new Error("SQLite read-only bridge was cancelled");
    const child = spawn(pythonCommand, args, {
        shell: false,
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
    }) as ChildProcessWithoutNullStreams;
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let transmittedBytes = 0;
    let failure: Error | undefined;
    let closed = false;
    let closeCode: number | null = null;
    let closeSignal: NodeJS.Signals | null = null;
    let killTimer: NodeJS.Timeout | undefined;

    let closeDone!: () => void;
    const closePromise = new Promise<void>(done => { closeDone = done; });
    const stop = (error: Error): void => {
        if (!failure) failure = error;
        if (!child.stdin.destroyed) child.stdin.destroy();
        if (!closed && child.exitCode === null && child.signalCode === null) {
            child.kill();
            if (!killTimer) killTimer = setTimeout(() => {
                if (!closed && child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
            }, limits.killGraceMs);
        }
    };
    const onStdout = (chunk: Buffer | string): void => {
        const bytes = Buffer.from(chunk);
        if (stdoutBytes > limits.stdoutLimitBytes - bytes.length) { stop(new Error("SQLite read-only bridge stdout limit exceeded")); return; }
        stdoutBytes += bytes.length;
        stdout.push(bytes);
    };
    const onStderr = (chunk: Buffer | string): void => {
        const bytes = Buffer.from(chunk);
        if (stderrBytes > limits.stderrLimitBytes - bytes.length) { stop(new Error("SQLite read-only bridge stderr limit exceeded")); return; }
        stderrBytes += bytes.length;
        stderr.push(bytes);
    };
    const onChildError = (): void => stop(new Error("SQLite read-only bridge could not be started"));
    const onStdinError = (error: NodeJS.ErrnoException): void => stop(new Error(
        error.code === "EPIPE" ? "SQLite read-only bridge closed stdin before the validated input completed" : "SQLite read-only bridge stdin failed",
    ));
    const onClose = (code: number | null, childSignal: NodeJS.Signals | null): void => {
        closed = true;
        closeCode = code;
        closeSignal = childSignal;
        closeDone();
    };
    const onAbort = (): void => stop(new Error("SQLite read-only bridge was cancelled"));
    child.stdout.on("data", onStdout);
    child.stderr.on("data", onStderr);
    child.stdin.on("error", onStdinError);
    child.on("error", onChildError);
    child.once("close", onClose);
    signal?.addEventListener("abort", onAbort, { once: true });
    const timeout = setTimeout(() => stop(new Error("SQLite read-only bridge timed out")), limits.timeoutMs);

    try {
        try {
            transmittedBytes = input
                ? await streamDescriptorBoundInput(child, input, limits.inputLimitBytes, signal)
                : (await endStdin(child), 0);
        } catch (error) {
            stop(error instanceof Error && (error as NodeJS.ErrnoException).code === "EPIPE"
                ? new Error("SQLite read-only bridge closed stdin before the validated input completed")
                : error instanceof Error ? error : new Error("SQLite read-only bridge input failed"));
        }
        if (!failure) await closePromise;
        else {
            const confirmed = await waitForCloseBounded(closePromise, limits.killGraceMs + TERMINATION_CONFIRMATION_MS);
            if (!confirmed) {
                try { await forceTerminateProcessTree(child); }
                catch (error) {
                    if (processIsAlive(child.pid)) throw new SqliteBridgeTerminationUnconfirmedError();
                    throw error;
                }
                const forceClosed = await waitForCloseBounded(closePromise, TERMINATION_CONFIRMATION_MS);
                if (!forceClosed) {
                    if (processIsAlive(child.pid)) throw new SqliteBridgeTerminationUnconfirmedError();
                    child.unref();
                }
            }
        }
        if (failure) throw failure;
        if (!closed) throw new Error("SQLite read-only bridge close was not observed");
        if (input && transmittedBytes !== input.sizeBytes) throw new Error("SQLite read-only bridge input byte count mismatch");
        if (closeCode !== 0) {
            const message = sanitizeBridgeMessage(Buffer.concat(stderr));
            throw new Error(`SQLite read-only bridge failed with exit code ${closeCode ?? "null"}${closeSignal ? ` (${closeSignal})` : ""}${message ? `: ${message}` : ""}`);
        }
        const raw = Buffer.concat(stdout).toString("utf8");
        if (!raw || raw.trim() !== raw) throw new Error("SQLite read-only bridge returned unexpected trailing output");
        try { JSON.parse(raw); }
        catch { throw new Error("SQLite read-only bridge returned invalid JSON"); }
        return raw;
    } finally {
        clearTimeout(timeout);
        if (killTimer) clearTimeout(killTimer);
        signal?.removeEventListener("abort", onAbort);
        child.stdout.removeListener("data", onStdout);
        child.stderr.removeListener("data", onStderr);
        child.stdin.removeListener("error", onStdinError);
        child.removeListener("error", onChildError);
        child.removeListener("close", onClose);
        if (!child.stdin.destroyed) child.stdin.destroy();
        if (!child.stdout.destroyed) child.stdout.destroy();
        if (!child.stderr.destroyed) child.stderr.destroy();
    }
}

export class ReadOnlySqliteAdapter {
    private readonly bridgePath: string;
    private readonly limits: BridgeLimits;

    constructor(
        readonly databasePath: string,
        private readonly pythonCommand = process.platform === "win32" ? "python" : "python3",
        bridgePath?: string,
        private readonly descriptorBoundInput?: DescriptorBoundInput,
        private readonly signal?: AbortSignal,
        limits: Partial<BridgeLimits> = {},
    ) {
        const adjacentBridge = resolve(__dirname, "sqlite-readonly-bridge.py");
        this.bridgePath = bridgePath ?? (existsSync(adjacentBridge)
            ? adjacentBridge
            : resolve(__dirname, "..", "..", "database-experiment", "sqlite-readonly-bridge.py"));
        this.limits = {
            timeoutMs: positiveSafeInteger(limits.timeoutMs ?? DEFAULT_LIMITS.timeoutMs, "SQLite bridge timeout"),
            killGraceMs: positiveSafeInteger(limits.killGraceMs ?? DEFAULT_LIMITS.killGraceMs, "SQLite bridge kill grace"),
            inputLimitBytes: positiveSafeInteger(limits.inputLimitBytes ?? DEFAULT_LIMITS.inputLimitBytes, "SQLite bridge input limit"),
            stdoutLimitBytes: positiveSafeInteger(limits.stdoutLimitBytes ?? DEFAULT_LIMITS.stdoutLimitBytes, "SQLite bridge stdout limit"),
            stderrLimitBytes: positiveSafeInteger(limits.stderrLimitBytes ?? DEFAULT_LIMITS.stderrLimitBytes, "SQLite bridge stderr limit"),
        };
    }

    static fromDescriptorBoundHandle(databasePathLabel: string, handle: FileHandle, sizeBytes: number, sha256: string, options: DescriptorBoundSqliteAdapterOptions = {}): ReadOnlySqliteAdapter {
        if (!handle || typeof handle.read !== "function") throw new Error("Descriptor-bound SQLite handle is invalid");
        positiveSafeInteger(sizeBytes, "Descriptor-bound SQLite size");
        if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error("Descriptor-bound SQLite SHA-256 is invalid");
        const { pythonCommand, bridgePath, signal, ...limits } = options;
        return new ReadOnlySqliteAdapter(databasePathLabel, pythonCommand, bridgePath, { handle, sizeBytes, sha256 }, signal, limits);
    }

    private async execute<T>(args: string[]): Promise<T> {
        const raw = await runBridge([
            this.bridgePath,
            ...args,
            ...(this.descriptorBoundInput ? ["--database-stdin"] : ["--database", this.databasePath]),
        ], this.pythonCommand, this.limits, this.descriptorBoundInput, this.signal);
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
