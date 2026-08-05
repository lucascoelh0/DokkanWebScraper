import { createHash } from "crypto";
import { execFileSync } from "child_process";
import { mkdtemp, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { resolve } from "path";
import { deepEqual, equal } from "assert";
import { describe, it } from "mocha";
import { ReadOnlySqliteAdapter } from "./sqlite-readonly-adapter";

describe("ReadOnlySqliteAdapter", function () {
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
});
