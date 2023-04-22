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
    console.log('First set done');
    const URData2 = await getDokkanData('UR?from=Evil+Pride+Frieza+(Final+Form)+(Angel)');
    console.log('Second set done');
    const URData3 = await getDokkanData('UR?from=Next-Level+Strike+Super+Saiyan+God+SS+Goku');
    console.log('Third set done');
    const URData4 = await getDokkanData('UR?from=Training+and+Refreshment+Goku');
    console.log('Forth set done');
    const LRData = await getDokkanData('LR');
    console.log('Finished scrape, saving data');
    let data = LRData.concat(URData, URData2, URData3, URData4);
    let currentDate = new Date();
    let day = ("0" + currentDate.getUTCDate()).slice(-2);
    let month = ("0" + currentDate.getUTCMonth() + 1).slice(-2);
    let year = currentDate.getUTCFullYear()
    saveData(year + month + day + 'DokkanCharacterData', data)

    for (const character of data) {
        await saveImage(character.portraitFilename, character.portraitURL, 6)
        await saveImage(character.artFilename, character.artURL, 9)

        for (const transformation of character.transformations) {
            await saveImage(transformation.portraitFilename, transformation.portraitURL, 6)
            await saveImage(transformation.artFilename, transformation.artURL, 9)
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
        const response = await fetch(url)
        const blob = await response.blob()
        const arrayBuffer = await blob.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        await sharp(buffer)
            .png({ quality: 10, compressionLevel: compressionLevel })
            .toFile(`${path}`)
    }
}

saveDokkanResults()