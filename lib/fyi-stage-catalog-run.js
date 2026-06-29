"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fyi_stage_catalog_1 = require("./fyi-stage-catalog");
async function main() {
    const outputPath = await (0, fyi_stage_catalog_1.writeDokkanFyiStageCatalog)();
    const dataset = await (0, fyi_stage_catalog_1.getDokkanFyiStageCatalog)();
    console.log(JSON.stringify({
        outputPath,
        groupCount: dataset.groupCount,
        entryCount: dataset.entryCount,
        firstEntry: dataset.entries[0] ? {
            key: dataset.entries[0].key,
            kind: dataset.entries[0].kind,
        } : null,
    }, null, 2));
}
main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
//# sourceMappingURL=fyi-stage-catalog-run.js.map