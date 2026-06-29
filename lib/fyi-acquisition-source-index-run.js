"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fyi_acquisition_source_index_1 = require("./fyi-acquisition-source-index");
async function main() {
    const outputPath = await (0, fyi_acquisition_source_index_1.writeDokkanFyiAcquisitionSourceIndex)();
    const dataset = await (0, fyi_acquisition_source_index_1.getDokkanFyiAcquisitionSourceIndex)();
    console.log(JSON.stringify({
        outputPath,
        sourceCount: dataset.sourceCount,
        rewardCount: dataset.rewardCount,
        firstSource: dataset.sources[0] ? {
            key: dataset.sources[0].key,
            groupKey: dataset.sources[0].groupKey,
            rewardCount: dataset.sources[0].rewardCount,
        } : null,
    }, null, 2));
}
main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
//# sourceMappingURL=fyi-acquisition-source-index-run.js.map