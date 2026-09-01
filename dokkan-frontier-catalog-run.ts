import { writeDokkanFrontierCatalog } from "./dokkan-frontier-catalog";

async function main() {
    const output = await writeDokkanFrontierCatalog();
    console.log(`Wrote Dokkan Frontier payload to ${output.payloadPath}`);
    console.log(`Wrote Dokkan Frontier manifest to ${output.manifestPath}`);
    console.log(`Dataset ${output.dataset.datasetVersion}: ${output.dataset.counts.nodes} nodes, ${output.dataset.counts.enemies} enemies.`);
    console.log(`${output.dataset.counts.cardSkinRewardsEnriched} card-skin reward labels enriched.`);
}

if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
