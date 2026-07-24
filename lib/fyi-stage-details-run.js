"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fyi_stage_details_1 = require("./fyi-stage-details");
const stage_detail_dataset_artifacts_1 = require("./stage-detail-dataset-artifacts");
async function main() {
    const localizedDataset = (0, fyi_stage_details_1.localizeStageDetailAssets)(await (0, fyi_stage_details_1.getDokkanFyiStageDetails)());
    const assetSummary = await (0, fyi_stage_details_1.mirrorStageDetailAssets)(localizedDataset);
    const dataset = (0, fyi_stage_details_1.removeUnmirroredStageDetailAssets)(localizedDataset, assetSummary.failedUrls, process.cwd());
    const outputPath = await (0, fyi_stage_details_1.writeDokkanFyiStageDetails)(dataset);
    const manifestPath = outputPath.replace(/stage-details\.json$/, "stage-details-manifest.json");
    const manifest = await (0, stage_detail_dataset_artifacts_1.writeStageDetailsDatasetManifest)(dataset, outputPath, manifestPath);
    console.log(JSON.stringify({
        outputPath,
        manifestPath,
        count: dataset.count,
        sizeBytes: manifest.sizeBytes,
        assetCount: manifest.assetCount,
        assetBytes: manifest.assetBytes,
        stageIds: dataset.entries.map(entry => entry.id),
        assetSummary,
        skippedOptionalAssets: assetSummary.failedUrls,
        firstEntry: dataset.entries[0]
            ? {
                id: dataset.entries[0].id,
                areaName: dataset.entries[0].areaName,
                questName: dataset.entries[0].questName,
                enemyCount: dataset.entries[0].enemies.length,
            }
            : undefined,
    }, null, 2));
}
main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
//# sourceMappingURL=fyi-stage-details-run.js.map