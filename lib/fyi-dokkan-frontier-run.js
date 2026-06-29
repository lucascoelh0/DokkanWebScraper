"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fyi_dokkan_frontier_1 = require("./fyi-dokkan-frontier");
async function main() {
    const output = await (0, fyi_dokkan_frontier_1.writeDokkanFyiFrontierDatasets)();
    console.log(`Wrote dokkan.fyi frontier series dataset to ${output.seriesPath}`);
    console.log(`Wrote dokkan.fyi frontier chapters dataset to ${output.chaptersPath}`);
}
if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
//# sourceMappingURL=fyi-dokkan-frontier-run.js.map