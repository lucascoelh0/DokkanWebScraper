"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const child_process_1 = require("child_process");
const promises_1 = require("fs/promises");
const os_1 = require("os");
const path_1 = require("path");
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const sqlite_readonly_adapter_1 = require("./sqlite-readonly-adapter");
(0, mocha_1.describe)("ReadOnlySqliteAdapter", function () {
    this.timeout(15000);
    const activeResources = () => ({
        children: process._getActiveHandles().filter((value) => value?.constructor?.name === "ChildProcess").length,
        requests: process._getActiveRequests().length,
    });
    const processAlive = (pid) => { try {
        process.kill(pid, 0);
        return true;
    }
    catch {
        return false;
    } };
    async function syntheticAdapter(source, inputBytes = 256 * 1024, options = {}) {
        const directory = await (0, promises_1.mkdtemp)((0, path_1.resolve)((0, os_1.tmpdir)(), "dokkan-sqlite-bridge-"));
        const script = (0, path_1.resolve)(directory, "bridge.cjs");
        const pidFile = (0, path_1.resolve)(directory, "pid.txt");
        const input = (0, path_1.resolve)(directory, "input.bin");
        await (0, promises_1.writeFile)(script, `require("fs").writeFileSync(${JSON.stringify(pidFile)}, String(process.pid));\n${source}\n`);
        const inputBuffer = Buffer.alloc(inputBytes, 0x41);
        await (0, promises_1.writeFile)(input, inputBuffer);
        const handle = await (0, promises_1.open)(input, "r");
        const adapter = sqlite_readonly_adapter_1.ReadOnlySqliteAdapter.fromDescriptorBoundHandle("synthetic.db", handle, inputBytes, (0, crypto_1.createHash)("sha256").update(inputBuffer).digest("hex"), {
            pythonCommand: process.execPath,
            bridgePath: script,
            timeoutMs: 2000,
            killGraceMs: 50,
            inputLimitBytes: Math.max(inputBytes, 1),
            stdoutLimitBytes: 8 * 1024,
            stderrLimitBytes: 4 * 1024,
            ...options,
        });
        return { directory, pidFile, input, handle, adapter };
    }
    async function assertSyntheticFailure(source, pattern, options = {}, inputBytes) {
        const before = activeResources();
        const value = await syntheticAdapter(source, inputBytes, options);
        try {
            await (0, assert_1.rejects)(value.adapter.inspect(), pattern);
            const pid = Number(await (0, promises_1.readFile)(value.pidFile, "utf8"));
            (0, assert_1.equal)(processAlive(pid), false, `synthetic bridge process ${pid} remained alive`);
        }
        finally {
            await value.handle.close();
            await (0, promises_1.rm)(value.directory, { recursive: true, force: true });
        }
        await new Promise(done => setImmediate(done));
        const after = activeResources();
        (0, assert_1.equal)(after.children, before.children);
        (0, assert_1.ok)(after.requests <= before.requests);
    }
    (0, mocha_1.it)("reads deterministic rows without changing the SQLite source", async () => {
        const directory = await (0, promises_1.mkdtemp)((0, path_1.resolve)((0, os_1.tmpdir)(), "dokkan-db0-"));
        const database = (0, path_1.resolve)(directory, "fixture.db");
        try {
            (0, child_process_1.execFileSync)(process.platform === "win32" ? "python" : "python3", [
                "-c",
                "import sqlite3,sys; c=sqlite3.connect(sys.argv[1]); c.execute('create table cards(id integer primary key,name text)'); c.executemany('insert into cards values(?,?)',[(2,'B'),(1,'A')]); c.commit(); c.close()",
                database,
            ]);
            const hash = (value) => (0, crypto_1.createHash)("sha256").update(value).digest("hex");
            const before = hash(await (0, promises_1.readFile)(database));
            const adapter = new sqlite_readonly_adapter_1.ReadOnlySqliteAdapter(database);
            const inspection = await adapter.inspect();
            (0, assert_1.equal)(inspection.tableCount, 1);
            (0, assert_1.deepEqual)(await adapter.readTable("cards", ["id", "name"]), [{ id: 1, name: "A" }, { id: 2, name: "B" }]);
            (0, assert_1.deepEqual)(await adapter.readTable("cards", ["id", "name"]), [{ id: 1, name: "A" }, { id: 2, name: "B" }]);
            (0, assert_1.equal)(hash(await (0, promises_1.readFile)(database)), before);
        }
        finally {
            await (0, promises_1.rm)(directory, { recursive: true, force: true });
        }
    });
    (0, mocha_1.it)("streams a descriptor-bound SQLite through the normal bridge", async () => {
        const directory = await (0, promises_1.mkdtemp)((0, path_1.resolve)((0, os_1.tmpdir)(), "dokkan-db0-stream-"));
        const database = (0, path_1.resolve)(directory, "fixture.db");
        let handle;
        try {
            (0, child_process_1.execFileSync)(process.platform === "win32" ? "python" : "python3", [
                "-c",
                "import sqlite3,sys; c=sqlite3.connect(sys.argv[1]); c.execute('create table cards(id integer primary key)'); c.commit(); c.close()",
                database,
            ]);
            handle = await (0, promises_1.open)(database, "r");
            const sizeBytes = (await handle.stat()).size;
            const sha256 = (0, crypto_1.createHash)("sha256").update(await (0, promises_1.readFile)(database)).digest("hex");
            const inspection = await sqlite_readonly_adapter_1.ReadOnlySqliteAdapter.fromDescriptorBoundHandle(database, handle, sizeBytes, sha256).inspect();
            (0, assert_1.equal)(inspection.tableCount, 1);
        }
        finally {
            await handle?.close();
            await (0, promises_1.rm)(directory, { recursive: true, force: true });
        }
    });
    (0, mocha_1.it)("terminates a bridge that never exits and leaves no active child", async () => {
        await assertSyntheticFailure("process.on('SIGTERM',()=>{}); process.stdin.resume(); process.stdin.on('end',()=>setInterval(()=>{},1000));", /timed out/, { timeoutMs: 100 });
    });
    (0, mocha_1.it)("terminates stdout and stderr floods at their separate limits", async () => {
        await assertSyntheticFailure("process.stdin.resume(); process.stdin.on('end',()=>setInterval(()=>process.stdout.write(Buffer.alloc(1024,0x78)),0));", /stdout limit exceeded/, { stdoutLimitBytes: 2048 });
        await assertSyntheticFailure("process.stdin.resume(); process.stdin.on('end',()=>setInterval(()=>process.stderr.write(Buffer.alloc(1024,0x79)),0));", /stderr limit exceeded/, { stderrLimitBytes: 2048 });
    });
    (0, mocha_1.it)("sanitizes non-zero exits and rejects malformed or trailing JSON", async () => {
        await assertSyntheticFailure("process.stdin.resume(); process.stdin.on('end',()=>{process.stderr.write('bounded\\u0000error');process.exit(7)});", /exit code 7: bounded\?error/);
        await assertSyntheticFailure("process.stdin.resume(); process.stdin.on('end',()=>process.stdout.write('{invalid'));", /invalid JSON/);
        await assertSyntheticFailure("process.stdin.resume(); process.stdin.on('end',()=>process.stdout.write('{\"tableCount\":0,\"tables\":[]} trailing'));", /invalid JSON/);
        await assertSyntheticFailure("process.stdin.resume(); process.stdin.on('end',()=>process.stdout.write('{}{}'));", /invalid JSON/);
    });
    (0, mocha_1.it)("fails closed when the child closes stdin before all bytes arrive", async () => {
        await assertSyntheticFailure("process.exit(0);", /closed stdin|input byte count|stdin failed/, {}, 4 * 1024 * 1024);
    });
    (0, mocha_1.it)("rejects same-size bytes whose streamed SHA-256 differs from the committed input", async () => {
        const value = await syntheticAdapter("process.stdin.resume(); process.stdin.on('end',()=>process.stdout.write('{}'));", 256 * 1024);
        try {
            await (0, promises_1.writeFile)(value.input, Buffer.alloc(256 * 1024, 0x42));
            await (0, assert_1.rejects)(value.adapter.inspect(), /transmitted SHA-256 mismatch/);
            const pid = Number(await (0, promises_1.readFile)(value.pidFile, "utf8"));
            (0, assert_1.equal)(processAlive(pid), false);
        }
        finally {
            await value.handle.close();
            await (0, promises_1.rm)(value.directory, { recursive: true, force: true });
        }
    });
    (0, mocha_1.it)("cancels a live bridge, confirms termination and removes listeners", async () => {
        const controller = new AbortController();
        const value = await syntheticAdapter("process.stdin.resume(); process.stdin.on('end',()=>setInterval(()=>{},1000));", 256 * 1024, { signal: controller.signal, timeoutMs: 5000 });
        const before = activeResources();
        try {
            const pending = value.adapter.inspect();
            setTimeout(() => controller.abort(), 50);
            await (0, assert_1.rejects)(pending, /cancelled/);
            const pid = Number(await (0, promises_1.readFile)(value.pidFile, "utf8"));
            (0, assert_1.equal)(processAlive(pid), false);
            (0, assert_1.equal)(controller.signal.aborted, true);
        }
        finally {
            await value.handle.close();
            await (0, promises_1.rm)(value.directory, { recursive: true, force: true });
        }
        await new Promise(done => setImmediate(done));
        const after = activeResources();
        (0, assert_1.equal)(after.children, before.children);
        (0, assert_1.ok)(after.requests <= before.requests);
    });
});
//# sourceMappingURL=sqlite-readonly-adapter.spec.js.map