"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveDokkanResults = void 0;
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const scraper_1 = require("./scraper");
const fs = require("fs");
const sharp = require("sharp");
async function saveDokkanResults() {
    if (!(0, fs_1.existsSync)((0, path_1.resolve)(__dirname, 'data'))) {
        (0, fs_1.mkdirSync)('data');
    }
    if (!(0, fs_1.existsSync)((0, path_1.resolve)(__dirname, 'data/images'))) {
        (0, fs_1.mkdirSync)('data/images');
    }
    console.log('Starting scrape');
    const data = await (0, scraper_1.getDokkanData)();
    console.log('Finished scraping cards');
    const equipment = await (0, scraper_1.getEquipmentData)();
    console.log('Finished scraping equipment');
    let currentDate = new Date();
    let day = ("0" + currentDate.getUTCDate()).slice(-2);
    let month = ("0" + (currentDate.getUTCMonth() + 1)).slice(-2);
    let year = currentDate.getUTCFullYear();
    console.log('Saving images');
    saveData(`${year}${month}${day}DokkanCharacterData`, data);
    saveData(`${year}${month}${day}DokkanEquipmentData`, equipment);
    for (const character of data) {
        await saveImageWithRetry(`${character.portraitFilename}.png`, character.portraitURL, 6);
        // Uncomment the next line if you need to save the art image
        // await saveImageWithRetry(`${character.artFilename}.jpg`, character.artURL, 9)
        if (Array.isArray(character.transformations)) {
            for (const transformation of character.transformations) {
                await saveImageWithRetry(`${transformation.portraitFilename}.png`, transformation.portraitURL, 6);
                // Uncomment the next line if you need to save the art image
                // await saveImageWithRetry(`${transformation.artFilename}.jpg`, transformation.artURL, 9)
            }
        }
    }
}
exports.saveDokkanResults = saveDokkanResults;
async function saveImageWithRetry(filename, url, compressionLevel, retries = 3) {
    try {
        await saveImage(filename, url, compressionLevel);
    }
    catch (error) {
        if (retries > 0) {
            console.log(`Error saving image from ${url}. Retrying in 2 seconds...`);
            return saveImageWithRetry(filename, url, compressionLevel, retries - 1);
        }
        else {
            console.error(`Failed to save image from ${url} after 3 attempts.`);
            throw error;
        }
    }
}
function saveData(fileName, data) {
    (0, promises_1.writeFile)((0, path_1.resolve)(__dirname, `data/${fileName}.json`), JSON.stringify(data), { encoding: 'utf8' });
}
const saveImage = async (filename, url, compressionLevel) => {
    const path = `data/images/${filename}`;
    if (!fs.existsSync(path)) {
        await delay(200);
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            },
        });
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        await sharp(buffer)
            .png({ quality: 10, compressionLevel: compressionLevel })
            .toFile(`${path}`);
    }
};
async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
saveDokkanResults();
//# sourceMappingURL=index.js.map