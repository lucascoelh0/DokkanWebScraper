import { deepEqual, equal, match, rejects } from "assert";
import { ChildProcess, spawn } from "child_process";
import { createHash } from "crypto";
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    renameSync,
    rmSync,
    writeFileSync,
} from "fs";
import { tmpdir } from "os";
import { isAbsolute, join, resolve } from "path";
import { Writable } from "stream";
import * as ts from "typescript";
import {
    createLocalSqlcipherProcessTransformer,
    LocalSqlcipherProcessTransformerOptions,
} from "./game-db-sqlcipher-process-transformer";

const TEST_PREFIX = "dokkan-dq6-process-test-";
const SECRET_TEXT = "DQ6-SECRET-SENTINEL-9b64c1ae";
const OUTPUT_LIMIT = 2 * 1024 * 1024;
const STDERR_LIMIT = 4 * 1024;

function sourceFile(name: string): string {
    const colocated = resolve(__dirname, name);
    return existsSync(colocated)
        ? colocated
        : resolve(__dirname, "..", "..", "game-db", name);
}

function testResidue(): Set<string> {
    return new Set(readdirSync(tmpdir())
        .filter(name => name.startsWith(TEST_PREFIX))
        .map(name => join(tmpdir(), name)));
}

function options(overrides: Partial<LocalSqlcipherProcessTransformerOptions> = {}): LocalSqlcipherProcessTransformerOptions {
    return {
        runtimeProfile: "approved_sqlcipher_bundle_v1",
        runtimeBundleRoot: resolve(tmpdir(), "unapproved-dq6-runtime"),
        runtimeBundleIdentity: "0".repeat(64),
        cipherCompatibility: 4,
        materialEncoding: "utf8_passphrase",
        processTimeoutMs: 2_000,
        ...overrides,
    };
}

function delay(ms: number): Promise<void> {
    return new Promise(done => setTimeout(done, ms));
}

async function settlesWithin(promise: Promise<unknown>, timeoutMs: number): Promise<boolean> {
    return Promise.race([
        promise.then(() => true, () => true),
        delay(timeoutMs).then(() => false),
    ]);
}

interface KillTarget {
    kill(signal: NodeJS.Signals): boolean,
}

async function terminateBounded(
    target: KillTarget,
    closePromise: Promise<unknown>,
    graceMs: number,
    forceMs: number,
): Promise<boolean> {
    target.kill("SIGTERM");
    if (await settlesWithin(closePromise, graceMs)) return true;
    target.kill("SIGKILL");
    return settlesWithin(closePromise, forceMs);
}

function quarantine(operation: string): string {
    const destination = `${operation}.quarantine`;
    renameSync(operation, destination);
    return destination;
}

function compileFixture(operation: string, failBeforeAssignment = false): string {
    const scratch = join(operation, "scratch");
    mkdirSync(scratch, { mode: 0o700 });
    if (failBeforeAssignment) throw new Error("synthetic pre-assignment failure");

    const sourcePath = sourceFile("game-db-sqlcipher-process-bridge-fixture.txt");
    const emitted = ts.transpileModule(readFileSync(sourcePath, "utf8"), {
        compilerOptions: {
            esModuleInterop: true,
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2022,
        },
        fileName: sourcePath,
        reportDiagnostics: true,
    });
    const errors = (emitted.diagnostics ?? []).filter(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error);
    if (errors.length > 0) throw new Error("synthetic fixture TypeScript did not transpile");
    const fixturePath = join(operation, "fixture.js");
    writeFileSync(fixturePath, emitted.outputText, { flag: "wx", mode: 0o600 });
    return fixturePath;
}

interface FixtureResult {
    output: Buffer,
    secretZeroed: boolean,
    fixturePath: string,
}

async function runCompiledFixture(
    mode: string,
    cipherCompatibility: 3 | 4 = 4,
    materialEncoding: "utf8_passphrase" | "raw_bytes" = "utf8_passphrase",
    timeoutMs = 1_000,
    signal?: AbortSignal,
    failBeforeAssignment = false,
): Promise<FixtureResult> {
    let operation: string | undefined;
    let fixturePath: string | undefined;
    let child: ChildProcess | undefined;
    let closeObserved = false;
    let closePromise: Promise<{ code: number | null, signal: NodeJS.Signals | null }> | undefined;
    let terminationConfirmed = true;
    const secret = materialEncoding === "raw_bytes"
        ? Buffer.from([1, 4, 9, 16, 25, 36, 49, 64, 81, 100, 121, 2])
        : Buffer.from(SECRET_TEXT, "utf8");

    try {
        operation = mkdtempSync(join(tmpdir(), TEST_PREFIX));
        fixturePath = compileFixture(operation, failBeforeAssignment);
        const scratch = join(operation, "scratch");
        child = spawn(process.execPath, [
            fixturePath,
            "--protocol", "dq6-sqlcipher-bridge-v-test",
            "--material-encoding", materialEncoding,
            "--cipher-compatibility", String(cipherCompatibility),
            "--work-directory", scratch,
        ], {
            cwd: operation,
            env: {},
            shell: false,
            windowsHide: true,
            stdio: ["ignore", "pipe", "pipe", "pipe", "pipe"],
        });

        closePromise = new Promise(resolveClose => {
            child!.once("close", (code, closeSignal) => {
                closeObserved = true;
                resolveClose({ code, signal: closeSignal });
            });
        });
        const startFailure = new Promise<never>((_resolve, reject) =>
            child!.once("error", () => reject(new Error("Synthetic fixture could not start"))));
        const stdout: Buffer[] = [];
        const stderr: Buffer[] = [];
        let stdoutBytes = 0;
        let stderrBytes = 0;
        child.stdout!.on("data", (chunk: Buffer) => {
            stdoutBytes += chunk.length;
            if (stdoutBytes <= OUTPUT_LIMIT) stdout.push(Buffer.from(chunk));
            else child!.kill("SIGTERM");
        });
        child.stderr!.on("data", (chunk: Buffer) => {
            stderrBytes += chunk.length;
            if (stderrBytes <= STDERR_LIMIT) stderr.push(Buffer.from(chunk));
            else child!.kill("SIGTERM");
        });
        const sourcePipe = child.stdio[3] as Writable;
        const secretPipe = child.stdio[4] as Writable;
        sourcePipe.on("error", () => undefined);
        secretPipe.on("error", () => undefined);
        sourcePipe.end(Buffer.from(`${mode}:synthetic-encrypted-input`, "ascii"));
        secretPipe.end(secret);
        secret.fill(0);

        let boundaryTimer: NodeJS.Timeout | undefined;
        let abortListener: (() => void) | undefined;
        const boundary = new Promise<"timeout" | "cancelled">(resolveBoundary => {
            boundaryTimer = setTimeout(() => resolveBoundary("timeout"), timeoutMs);
            abortListener = () => resolveBoundary("cancelled");
            signal?.addEventListener("abort", abortListener, { once: true });
            if (signal?.aborted) resolveBoundary("cancelled");
        });
        const outcome = await Promise.race([
            closePromise.then(state => ({ type: "close" as const, state })),
            boundary.then(kind => ({ type: "boundary" as const, kind })),
            startFailure,
        ]);
        if (boundaryTimer) clearTimeout(boundaryTimer);
        if (abortListener) signal?.removeEventListener("abort", abortListener);

        if (outcome.type === "boundary") {
            terminationConfirmed = await terminateBounded(child, closePromise, 100, 250);
            if (!terminationConfirmed) throw new Error(`Synthetic fixture ${outcome.kind}; close unconfirmed`);
            throw new Error(`Synthetic fixture ${outcome.kind}`);
        }
        if (stdoutBytes > OUTPUT_LIMIT) throw new Error("Synthetic fixture stdout overflow");
        if (stderrBytes > STDERR_LIMIT) throw new Error("Synthetic fixture stderr overflow");
        if (stderrBytes > 0) throw new Error("Synthetic fixture wrote to stderr");
        if (outcome.state.code !== 0 || outcome.state.signal !== null) throw new Error("Synthetic fixture exited unsuccessfully");

        const output = Buffer.concat(stdout);
        if (output.length < 48 || output.subarray(0, 8).toString("ascii") !== "DQ6TEST1") {
            throw new Error("Synthetic fixture returned malformed protocol");
        }
        const declaredSize = Number(output.readBigUInt64BE(8));
        if (!Number.isSafeInteger(declaredSize) || declaredSize <= 0 || declaredSize > OUTPUT_LIMIT) {
            throw new Error("Synthetic fixture declared output overflow");
        }
        const payload = output.subarray(48);
        if (payload.length !== declaredSize) throw new Error("Synthetic fixture output length mismatch");
        const declaredHash = output.subarray(16, 48).toString("hex");
        if (createHash("sha256").update(payload).digest("hex") !== declaredHash) {
            throw new Error("Synthetic fixture output hash mismatch");
        }
        const secretProbe = Buffer.from(SECRET_TEXT, "utf8");
        if (payload.includes(secretProbe)) throw new Error("Synthetic fixture exposed secret material");
        return { output: payload, secretZeroed: secret.every(byte => byte === 0), fixturePath };
    } finally {
        secret.fill(0);
        if (child && closePromise && !closeObserved) {
            terminationConfirmed = await terminateBounded(child, closePromise, 100, 250);
        }
        if (operation && existsSync(operation)) {
            if (terminationConfirmed) rmSync(operation, { recursive: true, force: true });
            else quarantine(operation);
        }
    }
}

describe("DQ6 fail-closed SQLCipher boundary", function () {
    this.timeout(20_000);
    let beforeResidue = new Set<string>();

    beforeEach(() => { beforeResidue = testResidue(); });
    afterEach(() => {
        for (const path of testResidue()) if (!beforeResidue.has(path)) rmSync(path, { recursive: true, force: true });
    });

    it("exports no productive process launcher and always rejects the empty allowlist", async () => {
        const source = readFileSync(sourceFile("game-db-sqlcipher-process-transformer.ts"), "utf8");
        equal(source.includes("child_process"), false);
        equal(/\bspawn\s*\(/.test(source), false);
        equal(source.includes("FileHandle"), false);
        equal(source.includes("secret:"), false);

        await rejects(() => createLocalSqlcipherProcessTransformer(options()),
            /No approved SQLCipher runtime bundle matches the requested identity/);
        deepEqual(testResidue(), beforeResidue);
    });

    it("does not let a caller path, hash, command or extra argument establish authority", async () => {
        for (const invalid of [
            { ...options(), runtimeBundleRoot: "relative\\bundle" },
            { ...options(), runtimeBundleIdentity: "A".repeat(64) },
            { ...options(), cipherCompatibility: 2 },
            { ...options(), materialEncoding: "implicit" },
            { ...options(), executablePath: process.execPath },
            { ...options(), executableSha256: "0".repeat(64) },
            { ...options(), command: process.execPath },
            { ...options(), args: ["--key", SECRET_TEXT] },
        ]) await rejects(() => createLocalSqlcipherProcessTransformer(invalid as any), /selection is invalid/);

        const nonexistent = options({ runtimeBundleRoot: resolve(tmpdir(), "does-not-exist-dq6") });
        await rejects(() => createLocalSqlcipherProcessTransformer(nonexistent), /No approved SQLCipher runtime bundle/);
        equal(existsSync(nonexistent.runtimeBundleRoot), false);
    });

    it("makes an A-B-A replacement inert because productive code never validates or spawns a path", async () => {
        const root = mkdtempSync(join(tmpdir(), TEST_PREFIX));
        try {
            const runtime = join(root, "runtime.exe");
            const held = join(root, "runtime-a.exe");
            const replacement = join(root, "runtime-b.exe");
            const executed = join(root, "replacement-executed");
            writeFileSync(runtime, "A", { flag: "wx" });
            writeFileSync(replacement, `B:${executed}:${SECRET_TEXT}`, { flag: "wx" });

            renameSync(runtime, held);
            renameSync(replacement, runtime);
            await rejects(() => createLocalSqlcipherProcessTransformer(options({
                runtimeBundleRoot: root,
                runtimeBundleIdentity: createHash("sha256").update("A").digest("hex"),
            })), /No approved SQLCipher runtime bundle/);
            renameSync(runtime, replacement);
            renameSync(held, runtime);

            equal(readFileSync(runtime, "utf8"), "A");
            equal(existsSync(executed), false);
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
        deepEqual(testResidue(), beforeResidue);
    });

    it("executes emitted JavaScript from the TypeScript fixture for explicit key modes and compatibility", async () => {
        for (const cipherCompatibility of [3, 4] as const) {
            for (const materialEncoding of ["utf8_passphrase", "raw_bytes"] as const) {
                const result = await runCompiledFixture("VALID", cipherCompatibility, materialEncoding);
                equal(result.fixturePath.endsWith(".js"), true);
                equal(result.fixturePath.endsWith(".ts"), false);
                equal(result.output.subarray(0, 16).toString("utf8"), "SQLite format 3\0");
                equal(result.output[100], 13);
                equal(result.secretZeroed, true);
            }
        }
        deepEqual(testResidue(), beforeResidue);
    });

    it("bounds timeout and cancellation close waits and leaves no live staging", async () => {
        await rejects(() => runCompiledFixture("HANG", 4, "utf8_passphrase", 30), /timeout/);
        const controller = new AbortController();
        const cancelled = runCompiledFixture("CANCEL", 4, "utf8_passphrase", 1_000, controller.signal);
        setTimeout(() => controller.abort(), 20);
        await rejects(() => cancelled, /cancelled/);
        deepEqual(testResidue(), beforeResidue);
    });

    it("settles a missing close within the two bounded waits and quarantines ownership", async () => {
        const operation = mkdtempSync(join(tmpdir(), TEST_PREFIX));
        const signals: NodeJS.Signals[] = [];
        const neverCloses = new Promise<void>(() => undefined);
        const startedAt = Date.now();
        const confirmed = await terminateBounded({ kill(signal) { signals.push(signal); return true; } }, neverCloses, 15, 20);
        equal(confirmed, false);
        deepEqual(signals, ["SIGTERM", "SIGKILL"]);
        equal(Date.now() - startedAt < 500, true);
        const retired = quarantine(operation);
        equal(existsSync(operation), false);
        equal(existsSync(retired), true);
        rmSync(retired, { recursive: true, force: true });
        deepEqual(testResidue(), beforeResidue);
    });

    it("cleans operation and scratch after a failure before fixture-path assignment", async () => {
        await rejects(() => runCompiledFixture("VALID", 4, "utf8_passphrase", 1_000, undefined, true),
            /pre-assignment failure/);
        deepEqual(testResidue(), beforeResidue);
    });

    it("rejects synthetic stderr, secret output, overflow, malformed, trailing, early exit and nonzero", async () => {
        for (const mode of ["STDERR", "SECRET_STDOUT", "OVERFLOW", "MALFORMED", "TRAILING", "EPIPE", "NONZERO"]) {
            let failure: unknown;
            try { await runCompiledFixture(mode); }
            catch (error) { failure = error; }
            match(String(failure), /Synthetic fixture/);
            equal(String(failure).includes(SECRET_TEXT), false);
            equal(String(failure).includes(process.execPath), false);
        }
        deepEqual(testResidue(), beforeResidue);
    });

    it("keeps compatibility-before-key ordering and documents Python secret-copy limits in code", () => {
        const bridge = readFileSync(sourceFile("game-db-sqlcipher-process-bridge.py"), "utf8");
        const compatibility = bridge.indexOf('cursor.execute(f"PRAGMA cipher_compatibility = {args.cipher_compatibility}")');
        const key = bridge.indexOf("apply_key(cursor, secret, args.secret_encoding)", compatibility);
        equal(compatibility >= 0, true);
        equal(key > compatibility, true);
        match(bridge, /immutable|cannot be zeroed|best-effort/i);
    });

    it("keeps the historical argv-key helper retired", () => {
        const helper = readFileSync(sourceFile("game-db-decrypt-sqlcipher.py"), "utf8");
        equal(helper.includes("--key"), false);
        equal(helper.includes("import sqlcipher3"), false);
        match(helper, /historical SQLCipher helper is disabled/);
    });

    it("uses only absolute synthetic operation paths", () => {
        const operation = mkdtempSync(join(tmpdir(), TEST_PREFIX));
        try { equal(isAbsolute(operation), true); }
        finally { rmSync(operation, { recursive: true, force: true }); }
    });
});
