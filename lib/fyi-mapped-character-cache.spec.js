"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const promises_1 = require("fs/promises");
const os_1 = require("os");
const path_1 = require("path");
const mocha_1 = require("mocha");
const fyi_mapped_character_cache_1 = require("./fyi-mapped-character-cache");
(0, mocha_1.describe)("mapped FYI character cache", function () {
    (0, mocha_1.it)("rejects a v10 entry and rewrites the character as v11", async () => {
        const root = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "dokkanpanion-mapped-cache-"));
        const path = (0, path_1.join)(root, "mapped-character-1.json");
        const fetchedAt = new Date("2026-08-22T00:00:00.000Z");
        const character = { id: "1", name: "Fixture" };
        try {
            await (0, promises_1.writeFile)(path, JSON.stringify({
                fetchedAt: fetchedAt.toISOString(),
                mappingVersion: 10,
                character,
            }), "utf8");
            (0, assert_1.equal)(await (0, fyi_mapped_character_cache_1.readFyiMappedCharacterCache)(path, 60000, fetchedAt.getTime()), undefined);
            await (0, fyi_mapped_character_cache_1.writeFyiMappedCharacterCache)(path, character, fetchedAt);
            const rewritten = JSON.parse(await (0, promises_1.readFile)(path, "utf8"));
            (0, assert_1.equal)(rewritten.mappingVersion, 11);
            (0, assert_1.deepEqual)(await (0, fyi_mapped_character_cache_1.readFyiMappedCharacterCache)(path, 60000, fetchedAt.getTime()), character);
        }
        finally {
            await (0, promises_1.rm)(root, { recursive: true, force: true });
        }
    });
});
//# sourceMappingURL=fyi-mapped-character-cache.spec.js.map