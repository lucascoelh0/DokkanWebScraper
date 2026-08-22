import { spawn } from "child_process";
import { existsSync } from "fs";
import { resolve } from "path";
import type { CharacterLeaderLifecycleSemanticsReport } from "./leader-lifecycle-semantics-contract";
import {
    CHARACTER_LEADER_LIFECYCLE_SEMANTICS_REPORT_LIMIT_BYTES,
    CHARACTER_LEADER_LIFECYCLE_SEMANTICS_RSS_LIMIT_BYTES,
} from "./leader-lifecycle-semantics-contract";
import { assertConservativeK55ForSupportedProjection } from "./leader-supported-projection";

export const CHARACTER_LEADER_K55_SUBPROCESS_STDOUT_LIMIT_BYTES = CHARACTER_LEADER_LIFECYCLE_SEMANTICS_REPORT_LIMIT_BYTES + 1024;
export const CHARACTER_LEADER_K55_SUBPROCESS_STDERR_LIMIT_BYTES = 16 * 1024;
export const CHARACTER_LEADER_K55_SUBPROCESS_TIMEOUT_MS = 10 * 60 * 1000;
export const CHARACTER_LEADER_K55_SUBPROCESS_TERMINATION_GRACE_MS = 250;
export const CHARACTER_LEADER_K55_SUBPROCESS_FINAL_TERMINATION_DEADLINE_MS = 2_000;
export const CHARACTER_LEADER_K55_SUBPROCESS_HEAP_LIMIT_MIB = 608;

export interface CharacterLeaderK55SubprocessOptions {
    sidecarRoot: string;
    productionRoot: string;
    fyiRoot: string;
    k43Root: string;
    k46Root: string;
    k48Root: string;
    nativeRuntime: string;
    database: string;
}
export interface CharacterLeaderK55SubprocessEnvelope {
    report: CharacterLeaderLifecycleSemanticsReport;
    processPeakRssBytes: number;
}
export interface CharacterLeaderK55SubprocessOutcome {
    stdout: Buffer;
    stderr: Buffer;
    exitCode: number | null;
    signal: NodeJS.Signals | null;
    timedOut: boolean;
    stdoutOverflow: boolean;
    stderrOverflow: boolean;
    terminationUnconfirmed: boolean;
    killError?: string;
    spawnError?: Error;
}
export interface CharacterLeaderK55ChildLifecycleLimits {
    timeoutMs: number;
    terminationGraceMs: number;
    finalTerminationDeadlineMs: number;
}
export interface CharacterLeaderK55ChildLike {
    stdout: { on(event: "data", listener: (chunk: Buffer) => void): unknown };
    stderr: { on(event: "data", listener: (chunk: Buffer) => void): unknown };
    once(event: "error" | "close", listener: (...args: any[]) => void): unknown;
    kill(signal?: NodeJS.Signals): boolean;
}
export interface CharacterLeaderK55SubprocessSpawnSpec {
    executable: string;
    args: string[];
    options: {
        shell: false;
        windowsHide: true;
        stdio: ["ignore", "pipe", "pipe"];
    };
}

function value(args: string[], name: string): string | undefined {
    const indexes = args.flatMap((item, index) => item === name ? [index] : []);
    if (indexes.length > 1) throw new Error(`duplicate ${name}`);
    if (!indexes.length) return undefined;
    const result = args[indexes[0] + 1];
    if (!result || result.startsWith("--")) throw new Error(`missing value for ${name}`);
    return result;
}
function required(args: string[], name: string): string {
    const result = value(args, name);
    if (!result) throw new Error(`K56 K55 helper requires ${name}`);
    return result;
}
export function parseCharacterLeaderK55SubprocessCli(args: string[]): CharacterLeaderK55SubprocessOptions {
    const values = [
        "--sidecar-root", "--production-root", "--fyi-root", "--k43-root", "--k46-root", "--k48-root", "--native-runtime", "--database",
    ];
    const allowed = new Set(values);
    for (let index = 0; index < args.length; index++) {
        const argument = args[index];
        if (!allowed.has(argument)) throw new Error(`K56 K55 helper unsupported argument ${argument}`);
        const next = args[index + 1];
        if (!next || next.startsWith("--")) throw new Error(`missing value for ${argument}`);
        index++;
    }
    return {
        sidecarRoot: required(args, "--sidecar-root"),
        productionRoot: required(args, "--production-root"),
        fyiRoot: required(args, "--fyi-root"),
        k43Root: required(args, "--k43-root"),
        k46Root: required(args, "--k46-root"),
        k48Root: required(args, "--k48-root"),
        nativeRuntime: required(args, "--native-runtime"),
        database: required(args, "--database"),
    };
}

export function characterLeaderK55SubprocessArgs(options: CharacterLeaderK55SubprocessOptions): string[] {
    return [
        "--sidecar-root", options.sidecarRoot, "--production-root", options.productionRoot, "--fyi-root", options.fyiRoot,
        "--k43-root", options.k43Root, "--k46-root", options.k46Root, "--k48-root", options.k48Root,
        "--native-runtime", options.nativeRuntime, "--database", options.database,
    ];
}

function assertReportContract(report: any): asserts report is CharacterLeaderLifecycleSemanticsReport {
    if (!report || report.schemaVersion !== 1 || report.contract !== "dokkan-database-character-leader-lifecycle-semantics-audit"
        || report.contractVersion !== "1.0.0" || report.mode !== "offline_local_explicit_opt_in_stdout_only"
        || report.inputIntegrity?.reportTimestampIncluded !== false || report.inputIntegrity?.rssStayedBelowExclusiveLimit !== true) {
        throw new Error("K56 K55 child report contract drifted");
    }
}

export function parseCharacterLeaderK55SubprocessOutcome(
    outcome: CharacterLeaderK55SubprocessOutcome,
): CharacterLeaderK55SubprocessEnvelope {
    if (outcome.terminationUnconfirmed) throw new Error("K56 K55 child termination unconfirmed");
    if (outcome.killError) throw new Error(`K56 K55 child termination failed: ${outcome.killError}`);
    if (outcome.spawnError) throw new Error(`K56 K55 child spawn failed: ${outcome.spawnError.message}`);
    if (outcome.timedOut) throw new Error("K56 K55 child timed out");
    if (outcome.stdoutOverflow || outcome.stdout.length > CHARACTER_LEADER_K55_SUBPROCESS_STDOUT_LIMIT_BYTES) throw new Error("K56 K55 child stdout limit reached");
    if (outcome.stderrOverflow || outcome.stderr.length > CHARACTER_LEADER_K55_SUBPROCESS_STDERR_LIMIT_BYTES) throw new Error("K56 K55 child stderr limit reached");
    if (outcome.stderr.length !== 0) throw new Error("K56 K55 child wrote stderr");
    if (outcome.signal !== null) throw new Error(`K56 K55 child terminated by signal ${outcome.signal}`);
    if (outcome.exitCode !== 0) throw new Error(`K56 K55 child exited ${outcome.exitCode}`);
    let envelope: any;
    try { envelope = JSON.parse(outcome.stdout.toString("utf8")); }
    catch { throw new Error("K56 K55 child envelope malformed"); }
    if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)
        || JSON.stringify(Object.keys(envelope)) !== JSON.stringify(["report", "processPeakRssBytes"])
        || !Number.isSafeInteger(envelope.processPeakRssBytes) || envelope.processPeakRssBytes <= 0
        || envelope.processPeakRssBytes >= CHARACTER_LEADER_LIFECYCLE_SEMANTICS_RSS_LIMIT_BYTES) {
        throw new Error("K56 K55 child envelope rejected");
    }
    assertReportContract(envelope.report);
    assertConservativeK55ForSupportedProjection(envelope.report);
    if (`${JSON.stringify(envelope)}\n` !== outcome.stdout.toString("utf8")) throw new Error("K56 K55 child envelope is not canonical");
    return envelope as CharacterLeaderK55SubprocessEnvelope;
}

function compiledHelperPath(): string {
    const path = resolve(__dirname, "leader-supported-projection-k55-subprocess.js");
    if (!existsSync(path)) throw new Error("K56 requires the explicit compiled K55 subprocess helper");
    return path;
}

export function characterLeaderK55SubprocessSpawnSpec(
    options: CharacterLeaderK55SubprocessOptions,
    helperPath: string,
): CharacterLeaderK55SubprocessSpawnSpec {
    if (!helperPath) throw new Error("K56 K55 helper path rejected");
    return {
        executable: process.execPath,
        args: [
            "--expose-gc",
            `--max-old-space-size=${CHARACTER_LEADER_K55_SUBPROCESS_HEAP_LIMIT_MIB}`,
            helperPath,
            ...characterLeaderK55SubprocessArgs(options),
        ],
        options: { shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
    };
}

export function collectCharacterLeaderK55ChildOutcome(
    child: CharacterLeaderK55ChildLike,
    limits: CharacterLeaderK55ChildLifecycleLimits = {
        timeoutMs: CHARACTER_LEADER_K55_SUBPROCESS_TIMEOUT_MS,
        terminationGraceMs: CHARACTER_LEADER_K55_SUBPROCESS_TERMINATION_GRACE_MS,
        finalTerminationDeadlineMs: CHARACTER_LEADER_K55_SUBPROCESS_FINAL_TERMINATION_DEADLINE_MS,
    },
): Promise<CharacterLeaderK55SubprocessOutcome> {
    if (!Number.isSafeInteger(limits.timeoutMs) || limits.timeoutMs <= 0
        || !Number.isSafeInteger(limits.terminationGraceMs) || limits.terminationGraceMs <= 0
        || !Number.isSafeInteger(limits.finalTerminationDeadlineMs)
        || limits.finalTerminationDeadlineMs <= limits.terminationGraceMs) {
        return Promise.reject(new Error("K56 K55 child lifecycle limits rejected"));
    }
    return new Promise(resolveOutcome => {
        const stdout: Buffer[] = [], stderr: Buffer[] = [];
        let stdoutBytes = 0, stderrBytes = 0, timedOut = false, stdoutOverflow = false, stderrOverflow = false;
        let spawnError: Error | undefined, killError: string | undefined;
        let terminating = false, settled = false;
        let terminationGraceTimer: NodeJS.Timeout | undefined, finalTerminationTimer: NodeJS.Timeout | undefined;

        const finish = (exitCode: number | null, signal: NodeJS.Signals | null, terminationUnconfirmed: boolean): void => {
            if (settled) return;
            settled = true;
            clearTimeout(executionTimer);
            if (terminationGraceTimer) clearTimeout(terminationGraceTimer);
            if (finalTerminationTimer) clearTimeout(finalTerminationTimer);
            resolveOutcome({
                stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr), exitCode, signal,
                timedOut, stdoutOverflow, stderrOverflow, terminationUnconfirmed, killError, spawnError,
            });
        };
        const requestKill = (signal?: NodeJS.Signals): void => {
            try {
                if (!child.kill(signal)) {
                    const detail = `${signal ?? "default"} termination request was not accepted`;
                    killError = killError ? `${killError}; ${detail}` : detail;
                }
            } catch (error) {
                const detail = `${signal ?? "default"} termination request threw: ${error instanceof Error ? error.message : String(error)}`;
                killError = killError ? `${killError}; ${detail}` : detail;
            }
        };
        const beginTermination = (): void => {
            if (terminating || settled) return;
            terminating = true;
            requestKill();
            if (settled) return;
            terminationGraceTimer = setTimeout(() => requestKill("SIGKILL"), limits.terminationGraceMs);
            finalTerminationTimer = setTimeout(() => finish(null, null, true), limits.finalTerminationDeadlineMs);
        };
        const executionTimer = setTimeout(() => { timedOut = true; beginTermination(); }, limits.timeoutMs);

        child.stdout.on("data", (chunk: Buffer) => {
            if (settled) return;
            stdoutBytes += chunk.length;
            if (stdoutBytes > CHARACTER_LEADER_K55_SUBPROCESS_STDOUT_LIMIT_BYTES) {
                stdoutOverflow = true;
                beginTermination();
                return;
            }
            stdout.push(Buffer.from(chunk));
        });
        child.stderr.on("data", (chunk: Buffer) => {
            if (settled) return;
            stderrBytes += chunk.length;
            if (stderrBytes > CHARACTER_LEADER_K55_SUBPROCESS_STDERR_LIMIT_BYTES) {
                stderrOverflow = true;
                beginTermination();
                return;
            }
            stderr.push(Buffer.from(chunk));
        });
        child.once("error", (error: Error) => {
            if (settled) return;
            spawnError = error;
            beginTermination();
        });
        child.once("close", (exitCode: number | null, signal: NodeJS.Signals | null) => finish(exitCode, signal, false));
    });
}

export async function runCharacterLeaderK55Subprocess(
    options: CharacterLeaderK55SubprocessOptions,
): Promise<CharacterLeaderK55SubprocessEnvelope> {
    const invocation = characterLeaderK55SubprocessSpawnSpec(options, compiledHelperPath());
    const child = spawn(invocation.executable, invocation.args, invocation.options);
    const outcome = await collectCharacterLeaderK55ChildOutcome(child as unknown as CharacterLeaderK55ChildLike);
    return parseCharacterLeaderK55SubprocessOutcome(outcome);
}

class ChildRssGuard {
    private peak = Math.max(process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024);
    private exceeded = false;
    private readonly timer = setInterval(() => this.observe(), 5);
    constructor() { this.timer.unref(); }
    private observe(): void {
        this.peak = Math.max(this.peak, process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024);
        this.exceeded ||= this.peak >= CHARACTER_LEADER_LIFECYCLE_SEMANTICS_RSS_LIMIT_BYTES;
    }
    stop(): number {
        clearInterval(this.timer);
        this.observe();
        if (this.exceeded) throw new Error(`K56 K55 helper RSS limit reached: ${this.peak}`);
        return this.peak;
    }
    dispose(): void { clearInterval(this.timer); }
}

async function runHelper(): Promise<void> {
    if (typeof (global as any).gc !== "function") throw new Error("K56 K55 helper requires Node --expose-gc");
    const options = parseCharacterLeaderK55SubprocessCli(process.argv.slice(2));
    const rss = new ChildRssGuard();
    try {
        const { runCharacterLeaderLifecycleSemanticsAudit } = await import("./leader-lifecycle-semantics-run");
        const report = await runCharacterLeaderLifecycleSemanticsAudit({ optIn: true, ...options });
        (global as any).gc();
        const processPeakRssBytes = rss.stop();
        const envelope: CharacterLeaderK55SubprocessEnvelope = { report, processPeakRssBytes };
        const stdout = `${JSON.stringify(envelope)}\n`;
        if (Buffer.byteLength(stdout) > CHARACTER_LEADER_K55_SUBPROCESS_STDOUT_LIMIT_BYTES) throw new Error("K56 K55 helper envelope byte limit reached");
        process.stdout.write(stdout);
    } finally { rss.dispose(); }
}

if (require.main === module) runHelper().catch(error => { console.error(error); process.exitCode = 1; });
