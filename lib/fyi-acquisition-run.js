"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fyi_acquisition_1 = require("./fyi-acquisition");
async function main() {
    const outputPath = await (0, fyi_acquisition_1.writeDokkanFyiAcquisitionDataset)();
    const dataset = await (0, fyi_acquisition_1.getDokkanFyiAcquisitionDataset)();
    console.log(JSON.stringify({
        outputPath,
        itemCount: dataset.itemCount,
        sourceCount: dataset.sourceCount,
        firstItem: dataset.items[0] ? {
            key: dataset.items[0].key,
            sourceCount: dataset.items[0].sources.length,
            firstSource: dataset.items[0].sources[0]?.kind,
        } : null,
    }, null, 2));
}
main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
//# sourceMappingURL=fyi-acquisition-run.js.map