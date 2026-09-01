"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dokkanstats_frontier_1 = require("./dokkanstats-frontier");
async function main() {
    const output = await (0, dokkanstats_frontier_1.writeDokkanStatsFrontierDataset)();
    console.log(`Wrote DokkanStats Frontier enrichment to ${output.outputPath}`);
    console.log(`${output.dataset.cardSkinCount} card skins; ${output.dataset.missionCount} missions across ${output.dataset.missionCategoryCount} categories.`);
}
if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
//# sourceMappingURL=dokkanstats-frontier-run.js.map