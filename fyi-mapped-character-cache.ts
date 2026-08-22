import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname } from "path";
import { Character } from "./character";

const FYI_MAPPED_CHARACTER_CACHE_VERSION = 12;

export async function readFyiMappedCharacterCache(
    path: string,
    ttlMs: number,
    nowMs = Date.now(),
): Promise<Character | undefined> {
    try {
        const cached = JSON.parse(await readFile(path, "utf8")) as {
            fetchedAt?: string,
            mappingVersion?: number,
            character?: Character,
        };
        const fetchedAt = Date.parse(cached.fetchedAt ?? "");
        if (!cached.character
            || cached.mappingVersion !== FYI_MAPPED_CHARACTER_CACHE_VERSION
            || !Number.isFinite(fetchedAt)
            || nowMs - fetchedAt > ttlMs) {
            return undefined;
        }

        return cached.character;
    } catch {
        return undefined;
    }
}

export async function writeFyiMappedCharacterCache(
    path: string,
    character: Character,
    fetchedAt = new Date(),
): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify({
        fetchedAt: fetchedAt.toISOString(),
        mappingVersion: FYI_MAPPED_CHARACTER_CACHE_VERSION,
        character,
    }), "utf8");
}
