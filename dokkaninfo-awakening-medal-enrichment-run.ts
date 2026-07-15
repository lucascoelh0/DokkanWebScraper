import {
    getDokkanInfoAwakeningMedalEnrichment,
    writeDokkanInfoAwakeningMedalEnrichment,
} from "./dokkaninfo-awakening-medal-enrichment";

async function main(): Promise<void> {
    const dataset = await getDokkanInfoAwakeningMedalEnrichment();
    const outputPath = await writeDokkanInfoAwakeningMedalEnrichment(dataset);
    const mirroredThumbs = dataset.entries.filter(entry => entry.thumbnailAsset?.localPath).length;

    console.log(`Wrote DokkanInfo awakening medal enrichment to ${outputPath}`);
    console.log(`Awakening medals: ${dataset.count}`);
    console.log(`Mirrored thumbs: ${mirroredThumbs}`);
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
