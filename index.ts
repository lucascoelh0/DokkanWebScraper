import { existsSync, mkdirSync } from "fs";
import { writeFile } from "fs/promises";
import { resolve } from "path";
import { getDokkanData } from "./scraper";
import * as fs from 'fs';
import * as sharp from 'sharp';

export async function saveDokkanResults() {
    if (!existsSync(resolve(__dirname, 'data'))) {
        mkdirSync('data');
    }
    if (!existsSync(resolve(__dirname, 'data/images'))) {
        mkdirSync('data/images');
    }
    console.log('Starting scrape');
    const URData = await getDokkanData('UR');
    console.log('Finished scraping UR');
    const LRData = await getDokkanData('LR');
    console.log('Finished scraping LR');

    const data = URData.concat(LRData);
    let currentDate = new Date();
    let day = ("0" + currentDate.getUTCDate()).slice(-2);
    let month = ("0" + currentDate.getUTCMonth() + 1).slice(-2);
    let year = currentDate.getUTCFullYear()

    console.log('Saving images');

    saveData(`${year}${month}${day}DokkanCharacterData`, data);

    for (const character of data) {
        await saveImageWithRetry(`${character.portraitFilename}.png`, character.portraitURL, 6)
        // Uncomment the next line if you need to save the art image
        // await saveImageWithRetry(`${character.artFilename}.jpg`, character.artURL, 9)

        if (Array.isArray(character.transformations)) {
            for (const transformation of character.transformations) {
                await saveImageWithRetry(`${transformation.portraitFilename}.png`, transformation.portraitURL, 6)
                // Uncomment the next line if you need to save the art image
                // await saveImageWithRetry(`${transformation.artFilename}.jpg`, transformation.artURL, 9)
            }
        }
    }
}

async function saveImageWithRetry(filename: string, url: string, compressionLevel: number, retries = 3) {
    try {
        await saveImage(filename, url, compressionLevel);
    } catch (error) {
        if (retries > 0) {
            console.log(`Error saving image from ${url}. Retrying in 2 seconds...`);
            return saveImageWithRetry(filename, url, compressionLevel, retries - 1);
        } else {
            console.error(`Failed to save image from ${url} after 3 attempts.`);
            throw error;
        }
    }
}

function saveData(fileName: string, data: unknown) {
    writeFile(
        resolve(__dirname, `data/${fileName}.json`),
        JSON.stringify(data),
        { encoding: 'utf8' })
}


const saveImage = async (filename: string, url: string, compressionLevel: number) => {
    const path = `data/images/${filename}`
    if (!fs.existsSync(path)) {
        await delay(200);
        const response = await fetch(url)
        const blob = await response.blob()
        const arrayBuffer = await blob.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        await sharp(buffer)
            .png({ quality: 10, compressionLevel: compressionLevel })
            .toFile(`${path}`)
    }
}

async function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

saveDokkanResults()