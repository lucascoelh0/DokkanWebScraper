"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mirrorFyiPortraits = exports.collectFyiPortraitTargets = exports.localizeCharacterPortraitUrls = void 0;
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const portrait_assets_1 = require("./game-db/portrait-assets");
const PORTRAIT_FORMAT_VERSION = "2";
const PORTRAIT_FORMAT_MARKER = ".portrait-format-version";
const PORTRAIT_ASSET_DIRECTORY = "images/v2";
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
    const add = (filename, spec) => {
        if (!filename || !spec || targets.has(filename)) {
            return;
        }
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
exports.collectFyiPortraitTargets = collectFyiPortraitTargets;
async function mirrorFyiPortraits(characters, dataRoot) {
    const targets = collectFyiPortraitTargets(characters);
    const outputDir = (0, path_1.resolve)(dataRoot, PORTRAIT_ASSET_DIRECTORY);
    await (0, promises_1.mkdir)(outputDir, { recursive: true });
    const hasCurrentFormat = await readPortraitFormatMarker(outputDir);
    let downloadedCount = 0;
    await mapWithConcurrency(targets, requestedPortraitConcurrency(), async (target) => {
        const outputPath = (0, path_1.resolve)(outputDir, `${target.filename}.png`);
        if (hasCurrentFormat && await isCurrentPortrait(outputPath)) {
            return;
        }
        await (0, portrait_assets_1.savePortraitFile)(target.filename, target.spec, outputDir, true);
        downloadedCount += 1;
    });
    await (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, PORTRAIT_FORMAT_MARKER), PORTRAIT_FORMAT_VERSION, "utf8");
    return { targetCount: targets.length, downloadedCount };
}
exports.mirrorFyiPortraits = mirrorFyiPortraits;
function localPortraitUrl(filename, fallback) {
    return filename ? `${PORTRAIT_ASSET_DIRECTORY}/${filename}.png` : fallback;
}
async function isCurrentPortrait(path) {
    if (!(0, fs_1.existsSync)(path)) {
        return false;
    }
    try {
        const info = await (0, promises_1.stat)(path);
        return info.size > 0;
    }
    catch {
        return false;
    }
}
async function readPortraitFormatMarker(outputDir) {
    try {
        const marker = await (0, promises_1.readFile)((0, path_1.resolve)(outputDir, PORTRAIT_FORMAT_MARKER), "utf8");
        return marker.trim() === PORTRAIT_FORMAT_VERSION;
    }
    catch {
        return false;
    }
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
//# sourceMappingURL=fyi-character-portraits.js.map