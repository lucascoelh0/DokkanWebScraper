"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dokkan_frontier_catalog_1 = require("./dokkan-frontier-catalog");
async function main() {
    const output = await (0, dokkan_frontier_catalog_1.writeDokkanFrontierCatalog)();
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
//# sourceMappingURL=dokkan-frontier-catalog-run.js.map