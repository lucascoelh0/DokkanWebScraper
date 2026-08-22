import { deepEqual, equal } from "assert";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { describe, it } from "mocha";
import { Character } from "./character";
import {
    readFyiMappedCharacterCache,
    writeFyiMappedCharacterCache,
} from "./fyi-mapped-character-cache";

describe("mapped FYI character cache", function () {
    it("rejects a v10 entry and rewrites the character as v11", async () => {
        const root = await mkdtemp(join(tmpdir(), "dokkanpanion-mapped-cache-"));
        const path = join(root, "mapped-character-1.json");
        const fetchedAt = new Date("2026-08-22T00:00:00.000Z");
        const character = { id: "1", name: "Fixture" } as Character;

        try {
            await writeFile(path, JSON.stringify({
                fetchedAt: fetchedAt.toISOString(),
                mappingVersion: 10,
                character,
            }), "utf8");

            equal(
                await readFyiMappedCharacterCache(path, 60_000, fetchedAt.getTime()),
                undefined,
            );

            await writeFyiMappedCharacterCache(path, character, fetchedAt);

            const rewritten = JSON.parse(await readFile(path, "utf8"));
            equal(rewritten.mappingVersion, 12);
            deepEqual(
                await readFyiMappedCharacterCache(path, 60_000, fetchedAt.getTime()),
                character,
            );
        } finally {
            await rm(root, { recursive: true, force: true });
        }
    });
});
