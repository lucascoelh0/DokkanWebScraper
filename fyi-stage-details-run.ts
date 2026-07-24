import { getDokkanFyiStageDetails, localizeStageDetailAssets, mirrorStageDetailAssets, removeUnmirroredStageDetailAssets, writeDokkanFyiStageDetails } from "./fyi-stage-details";
import { writeStageDetailsDatasetManifest } from "./stage-detail-dataset-artifacts";

async function main() {
    const localizedDataset = localizeStageDetailAssets(await getDokkanFyiStageDetails());
    const assetSummary = await mirrorStageDetailAssets(localizedDataset);
    const dataset = removeUnmirroredStageDetailAssets(localizedDataset, assetSummary.failedUrls, process.cwd());
    const outputPath = await writeDokkanFyiStageDetails(dataset);
    const manifestPath = outputPath.replace(/stage-details\.json$/, "stage-details-manifest.json");
    const manifest = await writeStageDetailsDatasetManifest(dataset, outputPath, manifestPath);
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
