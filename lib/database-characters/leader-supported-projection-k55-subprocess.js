"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCharacterLeaderK55Subprocess = exports.collectCharacterLeaderK55ChildOutcome = exports.characterLeaderK55SubprocessSpawnSpec = exports.parseCharacterLeaderK55SubprocessOutcome = exports.characterLeaderK55SubprocessArgs = exports.parseCharacterLeaderK55SubprocessCli = exports.CHARACTER_LEADER_K55_SUBPROCESS_HEAP_LIMIT_MIB = exports.CHARACTER_LEADER_K55_SUBPROCESS_FINAL_TERMINATION_DEADLINE_MS = exports.CHARACTER_LEADER_K55_SUBPROCESS_TERMINATION_GRACE_MS = exports.CHARACTER_LEADER_K55_SUBPROCESS_TIMEOUT_MS = exports.CHARACTER_LEADER_K55_SUBPROCESS_STDERR_LIMIT_BYTES = exports.CHARACTER_LEADER_K55_SUBPROCESS_STDOUT_LIMIT_BYTES = void 0;
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const path_1 = require("path");
const leader_lifecycle_semantics_contract_1 = require("./leader-lifecycle-semantics-contract");
const leader_supported_projection_1 = require("./leader-supported-projection");
exports.CHARACTER_LEADER_K55_SUBPROCESS_STDOUT_LIMIT_BYTES = leader_lifecycle_semantics_contract_1.CHARACTER_LEADER_LIFECYCLE_SEMANTICS_REPORT_LIMIT_BYTES + 1024;
exports.CHARACTER_LEADER_K55_SUBPROCESS_STDERR_LIMIT_BYTES = 16 * 1024;
exports.CHARACTER_LEADER_K55_SUBPROCESS_TIMEOUT_MS = 10 * 60 * 1000;
exports.CHARACTER_LEADER_K55_SUBPROCESS_TERMINATION_GRACE_MS = 250;
exports.CHARACTER_LEADER_K55_SUBPROCESS_FINAL_TERMINATION_DEADLINE_MS = 2000;
exports.CHARACTER_LEADER_K55_SUBPROCESS_HEAP_LIMIT_MIB = 608;
function value(args, name) {
    const indexes = args.flatMap((item, index) => item === name ? [index] : []);
    if (indexes.length > 1)
        throw new Error(`duplicate ${name}`);
    if (!indexes.length)
        return undefined;
    const result = args[indexes[0] + 1];
    if (!result || result.startsWith("--"))
        throw new Error(`missing value for ${name}`);
    return result;
}
function required(args, name) {
    const result = value(args, name);
    if (!result)
        throw new Error(`K56 K55 helper requires ${name}`);
    return result;
}
function parseCharacterLeaderK55SubprocessCli(args) {
    const values = [
        "--sidecar-root", "--production-root", "--fyi-root", "--k43-root", "--k46-root", "--k48-root", "--native-runtime", "--database",
    ];
    const allowed = new Set(values);
    for (let index = 0; index < args.length; index++) {
        const argument = args[index];
        if (!allowed.has(argument))
            throw new Error(`K56 K55 helper unsupported argument ${argument}`);
        const next = args[index + 1];
        if (!next || next.startsWith("--"))
            throw new Error(`missing value for ${argument}`);
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
exports.parseCharacterLeaderK55SubprocessCli = parseCharacterLeaderK55SubprocessCli;
function characterLeaderK55SubprocessArgs(options) {
    return [
        "--sidecar-root", options.sidecarRoot, "--production-root", options.productionRoot, "--fyi-root", options.fyiRoot,
        "--k43-root", options.k43Root, "--k46-root", options.k46Root, "--k48-root", options.k48Root,
        "--native-runtime", options.nativeRuntime, "--database", options.database,
    ];
}
exports.characterLeaderK55SubprocessArgs = characterLeaderK55SubprocessArgs;
function assertReportContract(report) {
    if (!report || report.schemaVersion !== 1 || report.contract !== "dokkan-database-character-leader-lifecycle-semantics-audit"
        || report.contractVersion !== "1.0.0" || report.mode !== "offline_local_explicit_opt_in_stdout_only"
        || report.inputIntegrity?.reportTimestampIncluded !== false || report.inputIntegrity?.rssStayedBelowExclusiveLimit !== true) {
        throw new Error("K56 K55 child report contract drifted");
    }
}
function parseCharacterLeaderK55SubprocessOutcome(outcome) {
    if (outcome.terminationUnconfirmed)
        throw new Error("K56 K55 child termination unconfirmed");
    if (outcome.killError)
        throw new Error(`K56 K55 child termination failed: ${outcome.killError}`);
    if (outcome.spawnError)
        throw new Error(`K56 K55 child spawn failed: ${outcome.spawnError.message}`);
    if (outcome.timedOut)
        throw new Error("K56 K55 child timed out");
    if (outcome.stdoutOverflow || outcome.stdout.length > exports.CHARACTER_LEADER_K55_SUBPROCESS_STDOUT_LIMIT_BYTES)
        throw new Error("K56 K55 child stdout limit reached");
    if (outcome.stderrOverflow || outcome.stderr.length > exports.CHARACTER_LEADER_K55_SUBPROCESS_STDERR_LIMIT_BYTES)
        throw new Error("K56 K55 child stderr limit reached");
    if (outcome.stderr.length !== 0)
        throw new Error("K56 K55 child wrote stderr");
    if (outcome.signal !== null)
        throw new Error(`K56 K55 child terminated by signal ${outcome.signal}`);
    if (outcome.exitCode !== 0)
        throw new Error(`K56 K55 child exited ${outcome.exitCode}`);
    let envelope;
    try {
        envelope = JSON.parse(outcome.stdout.toString("utf8"));
    }
    catch {
        throw new Error("K56 K55 child envelope malformed");
    }
    if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)
        || JSON.stringify(Object.keys(envelope)) !== JSON.stringify(["report", "processPeakRssBytes"])
        || !Number.isSafeInteger(envelope.processPeakRssBytes) || envelope.processPeakRssBytes <= 0
        || envelope.processPeakRssBytes >= leader_lifecycle_semantics_contract_1.CHARACTER_LEADER_LIFECYCLE_SEMANTICS_RSS_LIMIT_BYTES) {
        throw new Error("K56 K55 child envelope rejected");
    }
    assertReportContract(envelope.report);
    (0, leader_supported_projection_1.assertConservativeK55ForSupportedProjection)(envelope.report);
    if (`${JSON.stringify(envelope)}\n` !== outcome.stdout.toString("utf8"))
        throw new Error("K56 K55 child envelope is not canonical");
    return envelope;
}
exports.parseCharacterLeaderK55SubprocessOutcome = parseCharacterLeaderK55SubprocessOutcome;
function compiledHelperPath() {
    const path = (0, path_1.resolve)(__dirname, "leader-supported-projection-k55-subprocess.js");
    if (!(0, fs_1.existsSync)(path))
        throw new Error("K56 requires the explicit compiled K55 subprocess helper");
    return path;
}
function characterLeaderK55SubprocessSpawnSpec(options, helperPath) {
    if (!helperPath)
        throw new Error("K56 K55 helper path rejected");
    return {
        executable: process.execPath,
        args: [
            "--expose-gc",
            `--max-old-space-size=${exports.CHARACTER_LEADER_K55_SUBPROCESS_HEAP_LIMIT_MIB}`,
            helperPath,
            ...characterLeaderK55SubprocessArgs(options),
        ],
        options: { shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
    };
}
exports.characterLeaderK55SubprocessSpawnSpec = characterLeaderK55SubprocessSpawnSpec;
function collectCharacterLeaderK55ChildOutcome(child, limits = {
    timeoutMs: exports.CHARACTER_LEADER_K55_SUBPROCESS_TIMEOUT_MS,
    terminationGraceMs: exports.CHARACTER_LEADER_K55_SUBPROCESS_TERMINATION_GRACE_MS,
    finalTerminationDeadlineMs: exports.CHARACTER_LEADER_K55_SUBPROCESS_FINAL_TERMINATION_DEADLINE_MS,
}) {
    if (!Number.isSafeInteger(limits.timeoutMs) || limits.timeoutMs <= 0
        || !Number.isSafeInteger(limits.terminationGraceMs) || limits.terminationGraceMs <= 0
        || !Number.isSafeInteger(limits.finalTerminationDeadlineMs)
        || limits.finalTerminationDeadlineMs <= limits.terminationGraceMs) {
        return Promise.reject(new Error("K56 K55 child lifecycle limits rejected"));
    }
    return new Promise(resolveOutcome => {
        const stdout = [], stderr = [];
        let stdoutBytes = 0, stderrBytes = 0, timedOut = false, stdoutOverflow = false, stderrOverflow = false;
        let spawnError, killError;
        let terminating = false, settled = false;
        let terminationGraceTimer, finalTerminationTimer;
        const finish = (exitCode, signal, terminationUnconfirmed) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(executionTimer);
            if (terminationGraceTimer)
                clearTimeout(terminationGraceTimer);
            if (finalTerminationTimer)
                clearTimeout(finalTerminationTimer);
            resolveOutcome({
                stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr), exitCode, signal,
                timedOut, stdoutOverflow, stderrOverflow, terminationUnconfirmed, killError, spawnError,
            });
        };
        const requestKill = (signal) => {
            try {
                if (!child.kill(signal)) {
                    const detail = `${signal ?? "default"} termination request was not accepted`;
                    killError = killError ? `${killError}; ${detail}` : detail;
                }
            }
            catch (error) {
                const detail = `${signal ?? "default"} termination request threw: ${error instanceof Error ? error.message : String(error)}`;
                killError = killError ? `${killError}; ${detail}` : detail;
            }
        };
        const beginTermination = () => {
            if (terminating || settled)
                return;
            terminating = true;
            requestKill();
            if (settled)
                return;
            terminationGraceTimer = setTimeout(() => requestKill("SIGKILL"), limits.terminationGraceMs);
            finalTerminationTimer = setTimeout(() => finish(null, null, true), limits.finalTerminationDeadlineMs);
        };
        const executionTimer = setTimeout(() => { timedOut = true; beginTermination(); }, limits.timeoutMs);
        child.stdout.on("data", (chunk) => {
            if (settled)
                return;
            stdoutBytes += chunk.length;
            if (stdoutBytes > exports.CHARACTER_LEADER_K55_SUBPROCESS_STDOUT_LIMIT_BYTES) {
                stdoutOverflow = true;
                beginTermination();
                return;
            }
            stdout.push(Buffer.from(chunk));
        });
        child.stderr.on("data", (chunk) => {
            if (settled)
                return;
            stderrBytes += chunk.length;
            if (stderrBytes > exports.CHARACTER_LEADER_K55_SUBPROCESS_STDERR_LIMIT_BYTES) {
                stderrOverflow = true;
                beginTermination();
                return;
            }
            stderr.push(Buffer.from(chunk));
        });
        child.once("error", (error) => {
            if (settled)
                return;
            spawnError = error;
            beginTermination();
        });
        child.once("close", (exitCode, signal) => finish(exitCode, signal, false));
    });
}
exports.collectCharacterLeaderK55ChildOutcome = collectCharacterLeaderK55ChildOutcome;
async function runCharacterLeaderK55Subprocess(options) {
    const invocation = characterLeaderK55SubprocessSpawnSpec(options, compiledHelperPath());
    const child = (0, child_process_1.spawn)(invocation.executable, invocation.args, invocation.options);
    const outcome = await collectCharacterLeaderK55ChildOutcome(child);
    return parseCharacterLeaderK55SubprocessOutcome(outcome);
}
exports.runCharacterLeaderK55Subprocess = runCharacterLeaderK55Subprocess;
class ChildRssGuard {
    peak = Math.max(process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024);
    exceeded = false;
    timer = setInterval(() => this.observe(), 5);
    constructor() { this.timer.unref(); }
    observe() {
        this.peak = Math.max(this.peak, process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024);
        this.exceeded ||= this.peak >= leader_lifecycle_semantics_contract_1.CHARACTER_LEADER_LIFECYCLE_SEMANTICS_RSS_LIMIT_BYTES;
    }
    stop() {
        clearInterval(this.timer);
        this.observe();
        if (this.exceeded)
            throw new Error(`K56 K55 helper RSS limit reached: ${this.peak}`);
        return this.peak;
    }
    dispose() { clearInterval(this.timer); }
}
async function runHelper() {
    if (typeof global.gc !== "function")
        throw new Error("K56 K55 helper requires Node --expose-gc");
    const options = parseCharacterLeaderK55SubprocessCli(process.argv.slice(2));
    const rss = new ChildRssGuard();
    try {
        const { runCharacterLeaderLifecycleSemanticsAudit } = await Promise.resolve().then(() => require("./leader-lifecycle-semantics-run"));
        const report = await runCharacterLeaderLifecycleSemanticsAudit({ optIn: true, ...options });
        global.gc();
        const processPeakRssBytes = rss.stop();
        const envelope = { report, processPeakRssBytes };
        const stdout = `${JSON.stringify(envelope)}\n`;
        if (Buffer.byteLength(stdout) > exports.CHARACTER_LEADER_K55_SUBPROCESS_STDOUT_LIMIT_BYTES)
            throw new Error("K56 K55 helper envelope byte limit reached");
        process.stdout.write(stdout);
    }
    finally {
        rss.dispose();
    }
}
if (require.main === module)
    runHelper().catch(error => { console.error(error); process.exitCode = 1; });
//# sourceMappingURL=leader-supported-projection-k55-subprocess.js.map