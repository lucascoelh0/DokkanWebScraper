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
});
//# sourceMappingURL=sqlite-readonly-adapter.spec.js.map