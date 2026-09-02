"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dokkanstats_support_memories_1 = require("./dokkanstats-support-memories");
async function main() {
    const output = await (0, dokkanstats_support_memories_1.writeDokkanStatsSupportMemoryDataset)();
    console.log(`Wrote DokkanStats Support Memory enrichment to ${output.outputPath}`);
    console.log(`${output.dataset.rootMemoryCount} roots / ${output.dataset.memoryLevelCount} levels; `
        + `${output.dataset.acquisitionSourceCount} acquisition sources for ${output.dataset.acquisitionMemoryCount} memories.`);
}
if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
//# sourceMappingURL=dokkanstats-support-memories-run.js.map