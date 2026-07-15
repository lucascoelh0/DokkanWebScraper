"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fyi_exclusive_skill_orb_details_1 = require("./fyi-exclusive-skill-orb-details");
async function main() {
    const dataset = await (0, fyi_exclusive_skill_orb_details_1.getDokkanFyiExclusiveSkillOrbDetails)();
    const outputPath = await (0, fyi_exclusive_skill_orb_details_1.writeDokkanFyiExclusiveSkillOrbDetails)(dataset);
    const acquisitionModelCounts = dataset.entries.reduce((counts, entry) => {
        counts[entry.acquisitionModel] = (counts[entry.acquisitionModel] ?? 0) + 1;
        return counts;
    }, {});
    console.log(JSON.stringify({
        outputPath,
        scannedCharacterCount: dataset.scannedCharacterCount,
        ownerCharacterCount: dataset.ownerCharacterCount,
        failedCharacterCount: dataset.failedCharacterIds?.length ?? 0,
        failedCharacterIds: dataset.failedCharacterIds ?? [],
        orbCount: dataset.count,
        withPresentationAssetsCount: dataset.entries.filter(entry => entry.presentationAssets?.icon?.localPath || entry.presentationAssets?.background?.localPath).length,
        withDokkanInfoCount: dataset.entries.filter(entry => entry.dokkanInfo).length,
        acquisitionModelCounts,
        shopFallbackCount: dataset.entries.filter(entry => entry.acquisitionModel === "character-hint").length,
        missingAcquisitionCount: dataset.entries.filter(entry => entry.acquisitionModel === "unknown").length,
        sampleEntry: dataset.entries[0] ?? null,
    }, null, 2));
}
if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
//# sourceMappingURL=fyi-exclusive-skill-orb-details-run.js.map