"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mirrorFyiPortraits = exports.collectFyiPortraitTargets = exports.localizeCharacterPortraitUrls = void 0;
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const sharp = require("sharp");
function localizeCharacterPortraitUrls(characters) {
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
exports.localizeCharacterPortraitUrls = localizeCharacterPortraitUrls;
function collectFyiPortraitTargets(characters) {
    const targets = new Map();
    const add = (filename, sourceUrl) => {
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
exports.collectFyiPortraitTargets = collectFyiPortraitTargets;
async function mirrorFyiPortraits(characters, dataRoot) {
    const targets = collectFyiPortraitTargets(characters);
    const outputDir = (0, path_1.resolve)(dataRoot, "images");
    await (0, promises_1.mkdir)(outputDir, { recursive: true });
    let downloadedCount = 0;
    await mapWithConcurrency(targets, requestedPortraitConcurrency(), async (target) => {
        const outputPath = (0, path_1.resolve)(outputDir, `${target.filename}.png`);
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
exports.mirrorFyiPortraits = mirrorFyiPortraits;
function localPortraitUrl(filename, fallback) {
    return filename ? `images/${filename}.png` : fallback;
}
async function isCurrentPortrait(path) {
    if (!(0, fs_1.existsSync)(path)) {
        return false;
    }
    try {
        const metadata = await sharp(await (0, promises_1.readFile)(path)).metadata();
        return metadata.width === 150 && metadata.height === 150;
    }
    catch {
        return false;
    }
}
async function fetchImageBuffer(url, retries = 3) {
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
    }
    catch (error) {
        if (retries > 0) {
            await delay((4 - retries) * 1000);
            return fetchImageBuffer(url, retries - 1);
        }
        throw error;
    }
}
function isRetryableStatus(status) {
    return status === 408 || status === 425 || status === 429 || status >= 500;
}
function requestedPortraitConcurrency() {
    const value = Number.parseInt(process.env.DOKKAN_FYI_PORTRAIT_CONCURRENCY ?? "", 10);
    return Number.isFinite(value) && value > 0 ? value : 8;
}
async function mapWithConcurrency(items, concurrency, mapper) {
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
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
//# sourceMappingURL=fyi-character-portraits.js.map