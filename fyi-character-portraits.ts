import { existsSync } from "fs";
import { mkdir, readFile } from "fs/promises";
import { resolve } from "path";
import * as sharp from "sharp";
import { Character } from "./character";

export interface PortraitTarget {
    filename: string,
    sourceUrl: string,
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

    const add = (filename: string | undefined, sourceUrl: string | undefined) => {
        if (!filename || !sourceUrl || targets.has(filename)) {
            return;
        }

        targets.set(filename, { filename, sourceUrl });
    };

    for (const character of characters) {
        add(character.portraitFilename, character.portraitURL);

        for (const transformation of character.transformations ?? []) {
            add(transformation.portraitFilename, transformation.portraitURL);
        }

        for (const awakening of [
            ...(character.awakeningCards ?? []),
            ...(character.previousAwakenings ?? []),
            ...(character.nextAwakenings ?? []),
        ]) {
            add(`portrait_${awakening.id}`, awakening.portraitURL);
        }
    }

    return [...targets.values()].sort((left, right) => left.filename.localeCompare(right.filename));
}

export async function mirrorFyiPortraits(
    characters: Character[],
    dataRoot: string,
): Promise<{ targetCount: number, downloadedCount: number }> {
    const targets = collectFyiPortraitTargets(characters);
    const outputDir = resolve(dataRoot, "images");
    await mkdir(outputDir, { recursive: true });

    let downloadedCount = 0;
    await mapWithConcurrency(targets, requestedPortraitConcurrency(), async target => {
        const outputPath = resolve(outputDir, `${target.filename}.png`);
        if (await isCurrentPortrait(outputPath)) {
            return;
        }

        const buffer = await fetchImageBuffer(target.sourceUrl);
        await sharp(buffer)
            .resize(150, 150, { fit: "contain" })
            .png({ compressionLevel: 9 })
            .toFile(outputPath);
        downloadedCount += 1;
    });

    return { targetCount: targets.length, downloadedCount };
}

function localPortraitUrl(filename: string, fallback: string): string {
    return filename ? `images/${filename}.png` : fallback;
}

async function isCurrentPortrait(path: string): Promise<boolean> {
    if (!existsSync(path)) {
        return false;
    }

    try {
        const metadata = await sharp(await readFile(path)).metadata();
        return metadata.width === 150 && metadata.height === 150;
    } catch {
        return false;
    }
}

async function fetchImageBuffer(url: string, retries = 3): Promise<Buffer> {
    try {
        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/148.0.0.0 Safari/537.36",
                "Accept": "image/avif,image/webp,image/apng,image/png,image/*,*/*;q=0.8",
            },
        });

        if (!response.ok) {
            if (retries > 0 && isRetryableStatus(response.status)) {
                await delay((4 - retries) * 1000);
                return fetchImageBuffer(url, retries - 1);
            }

            throw new Error(`Could not fetch portrait ${url}: ${response.status}`);
        }

        return Buffer.from(await response.arrayBuffer());
    } catch (error) {
        if (retries > 0) {
            await delay((4 - retries) * 1000);
            return fetchImageBuffer(url, retries - 1);
        }

        throw error;
    }
}

function isRetryableStatus(status: number): boolean {
    return status === 408 || status === 425 || status === 429 || status >= 500;
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

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
