import { writeDokkanStatsFrontierDataset } from "./dokkanstats-frontier";

async function main() {
    const output = await writeDokkanStatsFrontierDataset();
    console.log(`Wrote DokkanStats Frontier enrichment to ${output.outputPath}`);
    console.log(`${output.dataset.cardSkinCount} card skins; ${output.dataset.missionCount} missions across ${output.dataset.missionCategoryCount} categories.`);
}

if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
