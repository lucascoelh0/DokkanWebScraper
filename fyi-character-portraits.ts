import { existsSync } from "fs";
import { mkdir, readFile, stat, writeFile } from "fs/promises";
import { resolve } from "path";
import { Character, PortraitSpec } from "./character";
import { assertPortraitFilename, savePortraitFile } from "./game-db/portrait-assets";

const PORTRAIT_FORMAT_VERSION = "2";
const PORTRAIT_FORMAT_MARKER = ".portrait-format-version";
const PORTRAIT_ASSET_DIRECTORY = "images/v2";

export interface PortraitTarget {
    filename: string,
    spec: PortraitSpec,
}

export function localizeCharacterPortraitUrls(characters: Character[]): Character[] {
    return characters.map(character => ({
        ...character,
        portraitURL: localPortraitUrl(character.portraitFilename, character.portraitURL),
        transformations: character.transformations?.map(transformation => ({
            ...transformation,
            portraitURL: localPortraitUrl(transformation.portraitFilename, transformation.portraitURL),
        })),
        awakeningCards: character.awakeningCards?.map(awakening => ({
            ...awakening,
            portraitURL: localPortraitUrl(`portrait_${awakening.id}`, awakening.portraitURL),
        })),
        previousAwakenings: character.previousAwakenings?.map(awakening => ({
            ...awakening,
            portraitURL: localPortraitUrl(`portrait_${awakening.id}`, awakening.portraitURL),
        })),
        nextAwakenings: character.nextAwakenings?.map(awakening => ({
            ...awakening,
            portraitURL: localPortraitUrl(`portrait_${awakening.id}`, awakening.portraitURL),
        })),
    }));
}

export function collectFyiPortraitTargets(characters: Character[]): PortraitTarget[] {
    const targets = new Map<string, PortraitTarget>();

    const add = (filename: string | undefined, spec: PortraitSpec | undefined) => {
        if (!filename || !spec || targets.has(filename)) {
            return;
        }

        assertPortraitFilename(filename);
        targets.set(filename, { filename, spec });
    };

    for (const character of characters) {
        add(character.portraitFilename, character.portraitSpec);

        for (const transformation of character.transformations ?? []) {
            add(transformation.portraitFilename, transformation.portraitSpec);
        }

        for (const awakening of [
            ...(character.awakeningCards ?? []),
            ...(character.previousAwakenings ?? []),
            ...(character.nextAwakenings ?? []),
        ]) {
            add(`portrait_${awakening.id}`, awakening.portraitSpec);
        }
    }

    return [...targets.values()].sort((left, right) => left.filename.localeCompare(right.filename));
}

export async function mirrorFyiPortraits(
    characters: Character[],
    dataRoot: string,
): Promise<{ targetCount: number, downloadedCount: number }> {
    const targets = collectFyiPortraitTargets(characters);
    const outputDir = resolve(dataRoot, PORTRAIT_ASSET_DIRECTORY);
    await mkdir(outputDir, { recursive: true });
    const hasCurrentFormat = await readPortraitFormatMarker(outputDir);

    let downloadedCount = 0;
    await mapWithConcurrency(targets, requestedPortraitConcurrency(), async target => {
        assertPortraitFilename(target.filename);
        const outputPath = resolve(outputDir, `${target.filename}.png`);
        if (hasCurrentFormat && await isCurrentPortrait(outputPath)) {
            return;
        }

        await savePortraitFile(target.filename, target.spec, outputDir, true);
        downloadedCount += 1;
    });

    await writeFile(resolve(outputDir, PORTRAIT_FORMAT_MARKER), PORTRAIT_FORMAT_VERSION, "utf8");

    return { targetCount: targets.length, downloadedCount };
}

function localPortraitUrl(filename: string, fallback: string): string {
    if (!filename) return fallback;
    assertPortraitFilename(filename);
    return `${PORTRAIT_ASSET_DIRECTORY}/${filename}.png`;
}

async function isCurrentPortrait(path: string): Promise<boolean> {
    if (!existsSync(path)) {
        return false;
    }

    try {
        const info = await stat(path);
        return info.size > 0;
    } catch {
        return false;
    }
}

async function readPortraitFormatMarker(outputDir: string): Promise<boolean> {
    try {
        const marker = await readFile(resolve(outputDir, PORTRAIT_FORMAT_MARKER), "utf8");
        return marker.trim() === PORTRAIT_FORMAT_VERSION;
    } catch {
        return false;
    }
}

function requestedPortraitConcurrency(): number {
    const value = Number.parseInt(process.env.DOKKAN_FYI_PORTRAIT_CONCURRENCY ?? "", 10);
    return Number.isFinite(value) && value > 0 ? value : 8;
}

async function mapWithConcurrency<T>(
    items: T[],
    concurrency: number,
    mapper: (item: T) => Promise<void>,
): Promise<void> {
    let nextIndex = 0;

    async function worker() {
        while (true) {
            const index = nextIndex++;
            if (index >= items.length) {
                return;
            }

            await mapper(items[index]);
        }
    }

    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
}
