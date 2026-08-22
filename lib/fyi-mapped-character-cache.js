"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeFyiMappedCharacterCache = exports.readFyiMappedCharacterCache = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
const FYI_MAPPED_CHARACTER_CACHE_VERSION = 13;
async function readFyiMappedCharacterCache(path, ttlMs, nowMs = Date.now()) {
    try {
        const cached = JSON.parse(await (0, promises_1.readFile)(path, "utf8"));
        const fetchedAt = Date.parse(cached.fetchedAt ?? "");
        if (!cached.character
            || cached.mappingVersion !== FYI_MAPPED_CHARACTER_CACHE_VERSION
            || !Number.isFinite(fetchedAt)
            || nowMs - fetchedAt > ttlMs) {
            return undefined;
        }
        return cached.character;
    }
    catch {
        return undefined;
    }
}
exports.readFyiMappedCharacterCache = readFyiMappedCharacterCache;
async function writeFyiMappedCharacterCache(path, character, fetchedAt = new Date()) {
    await (0, promises_1.mkdir)((0, path_1.dirname)(path), { recursive: true });
    await (0, promises_1.writeFile)(path, JSON.stringify({
        fetchedAt: fetchedAt.toISOString(),
        mappingVersion: FYI_MAPPED_CHARACTER_CACHE_VERSION,
        character,
    }), "utf8");
}
exports.writeFyiMappedCharacterCache = writeFyiMappedCharacterCache;
//# sourceMappingURL=fyi-mapped-character-cache.js.map