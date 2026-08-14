import { createHash } from "crypto";
import { execFileSync } from "child_process";
import { mkdtemp, open, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { resolve } from "path";
import { deepEqual, equal, ok, rejects } from "assert";
import { describe, it } from "mocha";
import { ReadOnlySqliteAdapter } from "./sqlite-readonly-adapter";

describe("ReadOnlySqliteAdapter", function () {
    this.timeout(15_000);

    const activeResources = () => ({
        children: (process as any)._getActiveHandles().filter((value: any) => value?.constructor?.name === "ChildProcess").length,
        requests: (process as any)._getActiveRequests().length,
    });
    const processAlive = (pid: number): boolean => { try { process.kill(pid, 0); return true; } catch { return false; } };

    async function syntheticAdapter(source: string, inputBytes = 256 * 1024, options: Record<string, unknown> = {}) {
        const directory = await mkdtemp(resolve(tmpdir(), "dokkan-sqlite-bridge-"));
        const script = resolve(directory, "bridge.cjs");
        const pidFile = resolve(directory, "pid.txt");
        const input = resolve(directory, "input.bin");
        await writeFile(script, `require("fs").writeFileSync(${JSON.stringify(pidFile)}, String(process.pid));\n${source}\n`);
        const inputBuffer = Buffer.alloc(inputBytes, 0x41);
        await writeFile(input, inputBuffer);
        const handle = await open(input, "r");
        const adapter = ReadOnlySqliteAdapter.fromDescriptorBoundHandle("synthetic.db", handle, inputBytes, createHash("sha256").update(inputBuffer).digest("hex"), {
            pythonCommand: process.execPath,
            bridgePath: script,
            timeoutMs: 2_000,
            killGraceMs: 50,
            inputLimitBytes: Math.max(inputBytes, 1),
            stdoutLimitBytes: 8 * 1024,
            stderrLimitBytes: 4 * 1024,
            ...options,
        });
        return { directory, pidFile, input, handle, adapter };
    }

    async function assertSyntheticFailure(source: string, pattern: RegExp, options: Record<string, unknown> = {}, inputBytes?: number): Promise<void> {
        const before = activeResources();
        const value = await syntheticAdapter(source, inputBytes, options);
        try {
            await rejects(value.adapter.inspect(), pattern);
            const pid = Number(await readFile(value.pidFile, "utf8"));
            equal(processAlive(pid), false, `synthetic bridge process ${pid} remained alive`);
        } finally {
            await value.handle.close();
            await rm(value.directory, { recursive: true, force: true });
        }
        await new Promise<void>(done => setImmediate(done));
        const after = activeResources();
        equal(after.children, before.children);
        ok(after.requests <= before.requests);
    }

    it("reads deterministic rows without changing the SQLite source", async () => {
        const directory = await mkdtemp(resolve(tmpdir(), "dokkan-db0-"));
        const database = resolve(directory, "fixture.db");
        try {
            execFileSync(process.platform === "win32" ? "python" : "python3", [
                "-c",
                "import sqlite3,sys; c=sqlite3.connect(sys.argv[1]); c.execute('create table cards(id integer primary key,name text)'); c.executemany('insert into cards values(?,?)',[(2,'B'),(1,'A')]); c.commit(); c.close()",
                database,
            ]);
            const hash = (value: Buffer) => createHash("sha256").update(value).digest("hex");
            const before = hash(await readFile(database));
            const adapter = new ReadOnlySqliteAdapter(database);
            const inspection = await adapter.inspect();
            equal(inspection.tableCount, 1);
            deepEqual(await adapter.readTable("cards", ["id", "name"]), [{ id: 1, name: "A" }, { id: 2, name: "B" }]);
            deepEqual(await adapter.readTable("cards", ["id", "name"]), [{ id: 1, name: "A" }, { id: 2, name: "B" }]);
            equal(hash(await readFile(database)), before);
        } finally {
            await rm(directory, { recursive: true, force: true });
        }
    });

    it("streams a descriptor-bound SQLite through the normal bridge", async () => {
        const directory = await mkdtemp(resolve(tmpdir(), "dokkan-db0-stream-"));
        const database = resolve(directory, "fixture.db");
        let handle;
        try {
            execFileSync(process.platform === "win32" ? "python" : "python3", [
                "-c",
                "import sqlite3,sys; c=sqlite3.connect(sys.argv[1]); c.execute('create table cards(id integer primary key)'); c.commit(); c.close()",
                database,
            ]);
            handle = await open(database, "r");
            const sizeBytes = (await handle.stat()).size;
            const sha256 = createHash("sha256").update(await readFile(database)).digest("hex");
            const inspection = await ReadOnlySqliteAdapter.fromDescriptorBoundHandle(database, handle, sizeBytes, sha256).inspect();
            equal(inspection.tableCount, 1);
        } finally {
            await handle?.close();
            await rm(directory, { recursive: true, force: true });
        }
    });

    it("terminates a bridge that never exits and leaves no active child", async () => {
        await assertSyntheticFailure(
            "process.on('SIGTERM',()=>{}); process.stdin.resume(); process.stdin.on('end',()=>setInterval(()=>{},1000));",
            /timed out/,
            { timeoutMs: 100 },
        );
    });

    it("terminates stdout and stderr floods at their separate limits", async () => {
        await assertSyntheticFailure(
            "process.stdin.resume(); process.stdin.on('end',()=>setInterval(()=>process.stdout.write(Buffer.alloc(1024,0x78)),0));",
            /stdout limit exceeded/,
            { stdoutLimitBytes: 2048 },
        );
        await assertSyntheticFailure(
            "process.stdin.resume(); process.stdin.on('end',()=>setInterval(()=>process.stderr.write(Buffer.alloc(1024,0x79)),0));",
            /stderr limit exceeded/,
            { stderrLimitBytes: 2048 },
        );
    });

    it("sanitizes non-zero exits and rejects malformed or trailing JSON", async () => {
        await assertSyntheticFailure(
            "process.stdin.resume(); process.stdin.on('end',()=>{process.stderr.write('bounded\\u0000error');process.exit(7)});",
            /exit code 7: bounded\?error/,
        );
        await assertSyntheticFailure(
            "process.stdin.resume(); process.stdin.on('end',()=>process.stdout.write('{invalid'));",
            /invalid JSON/,
        );
        await assertSyntheticFailure(
            "process.stdin.resume(); process.stdin.on('end',()=>process.stdout.write('{\"tableCount\":0,\"tables\":[]} trailing'));",
            /invalid JSON/,
        );
        await assertSyntheticFailure(
            "process.stdin.resume(); process.stdin.on('end',()=>process.stdout.write('{}{}'));",
            /invalid JSON/,
        );
    });

    it("fails closed when the child closes stdin before all bytes arrive", async () => {
        await assertSyntheticFailure("process.exit(0);", /closed stdin|input byte count|stdin failed/, {}, 4 * 1024 * 1024);
    });

    it("rejects same-size bytes whose streamed SHA-256 differs from the committed input", async () => {
        const value = await syntheticAdapter("process.stdin.resume(); process.stdin.on('end',()=>process.stdout.write('{}'));", 256 * 1024);
        try {
            await writeFile(value.input, Buffer.alloc(256 * 1024, 0x42));
            await rejects(value.adapter.inspect(), /transmitted SHA-256 mismatch/);
            const pid = Number(await readFile(value.pidFile, "utf8"));
            equal(processAlive(pid), false);
        } finally {
            await value.handle.close();
            await rm(value.directory, { recursive: true, force: true });
        }
    });

    it("cancels a live bridge, confirms termination and removes listeners", async () => {
        const controller = new AbortController();
        const value = await syntheticAdapter("process.stdin.resume(); process.stdin.on('end',()=>setInterval(()=>{},1000));", 256 * 1024, { signal: controller.signal, timeoutMs: 5_000 });
        const before = activeResources();
        try {
            const pending = value.adapter.inspect();
            setTimeout(() => controller.abort(), 50);
            await rejects(pending, /cancelled/);
            const pid = Number(await readFile(value.pidFile, "utf8"));
            equal(processAlive(pid), false);
            equal(controller.signal.aborted, true);
        } finally {
            await value.handle.close();
            await rm(value.directory, { recursive: true, force: true });
        }
        await new Promise<void>(done => setImmediate(done));
        const after = activeResources();
        equal(after.children, before.children);
        ok(after.requests <= before.requests);
    });
});
