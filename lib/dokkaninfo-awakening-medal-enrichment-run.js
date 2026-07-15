"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dokkaninfo_awakening_medal_enrichment_1 = require("./dokkaninfo-awakening-medal-enrichment");
async function main() {
    const dataset = await (0, dokkaninfo_awakening_medal_enrichment_1.getDokkanInfoAwakeningMedalEnrichment)();
    const outputPath = await (0, dokkaninfo_awakening_medal_enrichment_1.writeDokkanInfoAwakeningMedalEnrichment)(dataset);
    const mirroredThumbs = dataset.entries.filter(entry => entry.thumbnailAsset?.localPath).length;
    console.log(`Wrote DokkanInfo awakening medal enrichment to ${outputPath}`);
    console.log(`Awakening medals: ${dataset.count}`);
    console.log(`Mirrored thumbs: ${mirroredThumbs}`);
}
main().catch(error => {
    console.error(error);
    process.exit(1);
});
//# sourceMappingURL=dokkaninfo-awakening-medal-enrichment-run.js.map