"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const child_process_1 = require("child_process");
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const os_1 = require("os");
const path_1 = require("path");
const ts = require("typescript");
const game_db_sqlcipher_process_transformer_1 = require("./game-db-sqlcipher-process-transformer");
const TEST_PREFIX = "dokkan-dq6-process-test-";
const SECRET_TEXT = "DQ6-SECRET-SENTINEL-9b64c1ae";
const OUTPUT_LIMIT = 2 * 1024 * 1024;
const STDERR_LIMIT = 4 * 1024;
function sourceFile(name) {
    const colocated = (0, path_1.resolve)(__dirname, name);
    return (0, fs_1.existsSync)(colocated)
        ? colocated
        : (0, path_1.resolve)(__dirname, "..", "..", "game-db", name);
}
function testResidue() {
    return new Set((0, fs_1.readdirSync)((0, os_1.tmpdir)())
        .filter(name => name.startsWith(TEST_PREFIX))
        .map(name => (0, path_1.join)((0, os_1.tmpdir)(), name)));
}
function options(overrides = {}) {
    return {
        runtimeProfile: "approved_sqlcipher_bundle_v1",
        runtimeBundleRoot: (0, path_1.resolve)((0, os_1.tmpdir)(), "unapproved-dq6-runtime"),
        runtimeBundleIdentity: "0".repeat(64),
        cipherCompatibility: 4,
        materialEncoding: "utf8_passphrase",
        processTimeoutMs: 2000,
        ...overrides,
    };
}
function delay(ms) {
    return new Promise(done => setTimeout(done, ms));
}
async function settlesWithin(promise, timeoutMs) {
    return Promise.race([
        promise.then(() => true, () => true),
        delay(timeoutMs).then(() => false),
    ]);
}
async function terminateBounded(target, closePromise, graceMs, forceMs) {
    target.kill("SIGTERM");
    if (await settlesWithin(closePromise, graceMs))
        return true;
    target.kill("SIGKILL");
    return settlesWithin(closePromise, forceMs);
}
function quarantine(operation) {
    const destination = `${operation}.quarantine`;
    (0, fs_1.renameSync)(operation, destination);
    return destination;
}
function compileFixture(operation, failBeforeAssignment = false) {
    const scratch = (0, path_1.join)(operation, "scratch");
    (0, fs_1.mkdirSync)(scratch, { mode: 0o700 });
    if (failBeforeAssignment)
        throw new Error("synthetic pre-assignment failure");
    const sourcePath = sourceFile("game-db-sqlcipher-process-bridge-fixture.txt");
    const emitted = ts.transpileModule((0, fs_1.readFileSync)(sourcePath, "utf8"), {
        compilerOptions: {
            esModuleInterop: true,
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2022,
        },
        fileName: sourcePath,
        reportDiagnostics: true,
    });
    const errors = (emitted.diagnostics ?? []).filter(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error);
    if (errors.length > 0)
        throw new Error("synthetic fixture TypeScript did not transpile");
    const fixturePath = (0, path_1.join)(operation, "fixture.js");
    (0, fs_1.writeFileSync)(fixturePath, emitted.outputText, { flag: "wx", mode: 0o600 });
    return fixturePath;
}
async function runCompiledFixture(mode, cipherCompatibility = 4, materialEncoding = "utf8_passphrase", timeoutMs = 1000, signal, failBeforeAssignment = false) {
    let operation;
    let fixturePath;
    let child;
    let closeObserved = false;
    let closePromise;
    let terminationConfirmed = true;
    const secret = materialEncoding === "raw_bytes"
        ? Buffer.from([1, 4, 9, 16, 25, 36, 49, 64, 81, 100, 121, 2])
        : Buffer.from(SECRET_TEXT, "utf8");
    try {
        operation = (0, fs_1.mkdtempSync)((0, path_1.join)((0, os_1.tmpdir)(), TEST_PREFIX));
        fixturePath = compileFixture(operation, failBeforeAssignment);
        const scratch = (0, path_1.join)(operation, "scratch");
        child = (0, child_process_1.spawn)(process.execPath, [
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
            child.once("close", (code, closeSignal) => {
                closeObserved = true;
                resolveClose({ code, signal: closeSignal });
            });
        });
        const startFailure = new Promise((_resolve, reject) => child.once("error", () => reject(new Error("Synthetic fixture could not start"))));
        const stdout = [];
        const stderr = [];
        let stdoutBytes = 0;
        let stderrBytes = 0;
        child.stdout.on("data", (chunk) => {
            stdoutBytes += chunk.length;
            if (stdoutBytes <= OUTPUT_LIMIT)
                stdout.push(Buffer.from(chunk));
            else
                child.kill("SIGTERM");
        });
        child.stderr.on("data", (chunk) => {
            stderrBytes += chunk.length;
            if (stderrBytes <= STDERR_LIMIT)
                stderr.push(Buffer.from(chunk));
            else
                child.kill("SIGTERM");
        });
        const sourcePipe = child.stdio[3];
        const secretPipe = child.stdio[4];
        sourcePipe.on("error", () => undefined);
        secretPipe.on("error", () => undefined);
        sourcePipe.end(Buffer.from(`${mode}:synthetic-encrypted-input`, "ascii"));
        secretPipe.end(secret);
        secret.fill(0);
        let boundaryTimer;
        let abortListener;
        const boundary = new Promise(resolveBoundary => {
            boundaryTimer = setTimeout(() => resolveBoundary("timeout"), timeoutMs);
            abortListener = () => resolveBoundary("cancelled");
            signal?.addEventListener("abort", abortListener, { once: true });
            if (signal?.aborted)
                resolveBoundary("cancelled");
        });
        const outcome = await Promise.race([
            closePromise.then(state => ({ type: "close", state })),
            boundary.then(kind => ({ type: "boundary", kind })),
            startFailure,
        ]);
        if (boundaryTimer)
            clearTimeout(boundaryTimer);
        if (abortListener)
            signal?.removeEventListener("abort", abortListener);
        if (outcome.type === "boundary") {
            terminationConfirmed = await terminateBounded(child, closePromise, 100, 250);
            if (!terminationConfirmed)
                throw new Error(`Synthetic fixture ${outcome.kind}; close unconfirmed`);
            throw new Error(`Synthetic fixture ${outcome.kind}`);
        }
        if (stdoutBytes > OUTPUT_LIMIT)
            throw new Error("Synthetic fixture stdout overflow");
        if (stderrBytes > STDERR_LIMIT)
            throw new Error("Synthetic fixture stderr overflow");
        if (stderrBytes > 0)
            throw new Error("Synthetic fixture wrote to stderr");
        if (outcome.state.code !== 0 || outcome.state.signal !== null)
            throw new Error("Synthetic fixture exited unsuccessfully");
        const output = Buffer.concat(stdout);
        if (output.length < 48 || output.subarray(0, 8).toString("ascii") !== "DQ6TEST1") {
            throw new Error("Synthetic fixture returned malformed protocol");
        }
        const declaredSize = Number(output.readBigUInt64BE(8));
        if (!Number.isSafeInteger(declaredSize) || declaredSize <= 0 || declaredSize > OUTPUT_LIMIT) {
            throw new Error("Synthetic fixture declared output overflow");
        }
        const payload = output.subarray(48);
        if (payload.length !== declaredSize)
            throw new Error("Synthetic fixture output length mismatch");
        const declaredHash = output.subarray(16, 48).toString("hex");
        if ((0, crypto_1.createHash)("sha256").update(payload).digest("hex") !== declaredHash) {
            throw new Error("Synthetic fixture output hash mismatch");
        }
        const secretProbe = Buffer.from(SECRET_TEXT, "utf8");
        if (payload.includes(secretProbe))
            throw new Error("Synthetic fixture exposed secret material");
        return { output: payload, secretZeroed: secret.every(byte => byte === 0), fixturePath };
    }
    finally {
        secret.fill(0);
        if (child && closePromise && !closeObserved) {
            terminationConfirmed = await terminateBounded(child, closePromise, 100, 250);
        }
        if (operation && (0, fs_1.existsSync)(operation)) {
            if (terminationConfirmed)
                (0, fs_1.rmSync)(operation, { recursive: true, force: true });
            else
                quarantine(operation);
        }
    }
}
describe("DQ6 fail-closed SQLCipher boundary", function () {
    this.timeout(20000);
    let beforeResidue = new Set();
    beforeEach(() => { beforeResidue = testResidue(); });
    afterEach(() => {
        for (const path of testResidue())
            if (!beforeResidue.has(path))
                (0, fs_1.rmSync)(path, { recursive: true, force: true });
    });
    it("exports no productive process launcher and always rejects the empty allowlist", async () => {
        const source = (0, fs_1.readFileSync)(sourceFile("game-db-sqlcipher-process-transformer.ts"), "utf8");
        (0, assert_1.equal)(source.includes("child_process"), false);
        (0, assert_1.equal)(/\bspawn\s*\(/.test(source), false);
        (0, assert_1.equal)(source.includes("FileHandle"), false);
        (0, assert_1.equal)(source.includes("secret:"), false);
        await (0, assert_1.rejects)(() => (0, game_db_sqlcipher_process_transformer_1.createLocalSqlcipherProcessTransformer)(options()), /No approved SQLCipher runtime bundle matches the requested identity/);
        (0, assert_1.deepEqual)(testResidue(), beforeResidue);
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
        ])
            await (0, assert_1.rejects)(() => (0, game_db_sqlcipher_process_transformer_1.createLocalSqlcipherProcessTransformer)(invalid), /selection is invalid/);
        const nonexistent = options({ runtimeBundleRoot: (0, path_1.resolve)((0, os_1.tmpdir)(), "does-not-exist-dq6") });
        await (0, assert_1.rejects)(() => (0, game_db_sqlcipher_process_transformer_1.createLocalSqlcipherProcessTransformer)(nonexistent), /No approved SQLCipher runtime bundle/);
        (0, assert_1.equal)((0, fs_1.existsSync)(nonexistent.runtimeBundleRoot), false);
    });
    it("makes an A-B-A replacement inert because productive code never validates or spawns a path", async () => {
        const root = (0, fs_1.mkdtempSync)((0, path_1.join)((0, os_1.tmpdir)(), TEST_PREFIX));
        try {
            const runtime = (0, path_1.join)(root, "runtime.exe");
            const held = (0, path_1.join)(root, "runtime-a.exe");
            const replacement = (0, path_1.join)(root, "runtime-b.exe");
            const executed = (0, path_1.join)(root, "replacement-executed");
            (0, fs_1.writeFileSync)(runtime, "A", { flag: "wx" });
            (0, fs_1.writeFileSync)(replacement, `B:${executed}:${SECRET_TEXT}`, { flag: "wx" });
            (0, fs_1.renameSync)(runtime, held);
            (0, fs_1.renameSync)(replacement, runtime);
            await (0, assert_1.rejects)(() => (0, game_db_sqlcipher_process_transformer_1.createLocalSqlcipherProcessTransformer)(options({
                runtimeBundleRoot: root,
                runtimeBundleIdentity: (0, crypto_1.createHash)("sha256").update("A").digest("hex"),
            })), /No approved SQLCipher runtime bundle/);
            (0, fs_1.renameSync)(runtime, replacement);
            (0, fs_1.renameSync)(held, runtime);
            (0, assert_1.equal)((0, fs_1.readFileSync)(runtime, "utf8"), "A");
            (0, assert_1.equal)((0, fs_1.existsSync)(executed), false);
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
        (0, assert_1.deepEqual)(testResidue(), beforeResidue);
    });
    it("executes emitted JavaScript from the TypeScript fixture for explicit key modes and compatibility", async () => {
        for (const cipherCompatibility of [3, 4]) {
            for (const materialEncoding of ["utf8_passphrase", "raw_bytes"]) {
                const result = await runCompiledFixture("VALID", cipherCompatibility, materialEncoding);
                (0, assert_1.equal)(result.fixturePath.endsWith(".js"), true);
                (0, assert_1.equal)(result.fixturePath.endsWith(".ts"), false);
                (0, assert_1.equal)(result.output.subarray(0, 16).toString("utf8"), "SQLite format 3\0");
                (0, assert_1.equal)(result.output[100], 13);
                (0, assert_1.equal)(result.secretZeroed, true);
            }
        }
        (0, assert_1.deepEqual)(testResidue(), beforeResidue);
    });
    it("bounds timeout and cancellation close waits and leaves no live staging", async () => {
        await (0, assert_1.rejects)(() => runCompiledFixture("HANG", 4, "utf8_passphrase", 30), /timeout/);
        const controller = new AbortController();
        const cancelled = runCompiledFixture("CANCEL", 4, "utf8_passphrase", 1000, controller.signal);
        setTimeout(() => controller.abort(), 20);
        await (0, assert_1.rejects)(() => cancelled, /cancelled/);
        (0, assert_1.deepEqual)(testResidue(), beforeResidue);
    });
    it("settles a missing close within the two bounded waits and quarantines ownership", async () => {
        const operation = (0, fs_1.mkdtempSync)((0, path_1.join)((0, os_1.tmpdir)(), TEST_PREFIX));
        const signals = [];
        const neverCloses = new Promise(() => undefined);
        const startedAt = Date.now();
        const confirmed = await terminateBounded({ kill(signal) { signals.push(signal); return true; } }, neverCloses, 15, 20);
        (0, assert_1.equal)(confirmed, false);
        (0, assert_1.deepEqual)(signals, ["SIGTERM", "SIGKILL"]);
        (0, assert_1.equal)(Date.now() - startedAt < 500, true);
        const retired = quarantine(operation);
        (0, assert_1.equal)((0, fs_1.existsSync)(operation), false);
        (0, assert_1.equal)((0, fs_1.existsSync)(retired), true);
        (0, fs_1.rmSync)(retired, { recursive: true, force: true });
        (0, assert_1.deepEqual)(testResidue(), beforeResidue);
    });
    it("cleans operation and scratch after a failure before fixture-path assignment", async () => {
        await (0, assert_1.rejects)(() => runCompiledFixture("VALID", 4, "utf8_passphrase", 1000, undefined, true), /pre-assignment failure/);
        (0, assert_1.deepEqual)(testResidue(), beforeResidue);
    });
    it("rejects synthetic stderr, secret output, overflow, malformed, trailing, early exit and nonzero", async () => {
        for (const mode of ["STDERR", "SECRET_STDOUT", "OVERFLOW", "MALFORMED", "TRAILING", "EPIPE", "NONZERO"]) {
            let failure;
            try {
                await runCompiledFixture(mode);
            }
            catch (error) {
                failure = error;
            }
            (0, assert_1.match)(String(failure), /Synthetic fixture/);
            (0, assert_1.equal)(String(failure).includes(SECRET_TEXT), false);
            (0, assert_1.equal)(String(failure).includes(process.execPath), false);
        }
        (0, assert_1.deepEqual)(testResidue(), beforeResidue);
    });
    it("keeps compatibility-before-key ordering and documents Python secret-copy limits in code", () => {
        const bridge = (0, fs_1.readFileSync)(sourceFile("game-db-sqlcipher-process-bridge.py"), "utf8");
        const compatibility = bridge.indexOf('cursor.execute(f"PRAGMA cipher_compatibility = {args.cipher_compatibility}")');
        const key = bridge.indexOf("apply_key(cursor, secret, args.secret_encoding)", compatibility);
        (0, assert_1.equal)(compatibility >= 0, true);
        (0, assert_1.equal)(key > compatibility, true);
        (0, assert_1.match)(bridge, /immutable|cannot be zeroed|best-effort/i);
    });
    it("keeps the historical argv-key helper retired", () => {
        const helper = (0, fs_1.readFileSync)(sourceFile("game-db-decrypt-sqlcipher.py"), "utf8");
        (0, assert_1.equal)(helper.includes("--key"), false);
        (0, assert_1.equal)(helper.includes("import sqlcipher3"), false);
        (0, assert_1.match)(helper, /historical SQLCipher helper is disabled/);
    });
    it("uses only absolute synthetic operation paths", () => {
        const operation = (0, fs_1.mkdtempSync)((0, path_1.join)((0, os_1.tmpdir)(), TEST_PREFIX));
        try {
            (0, assert_1.equal)((0, path_1.isAbsolute)(operation), true);
        }
        finally {
            (0, fs_1.rmSync)(operation, { recursive: true, force: true });
        }
    });
});
//# sourceMappingURL=game-db-sqlcipher-process-transformer.spec.js.map