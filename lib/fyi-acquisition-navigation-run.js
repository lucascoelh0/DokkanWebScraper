"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fyi_acquisition_navigation_1 = require("./fyi-acquisition-navigation");
async function main() {
    const outputPath = await (0, fyi_acquisition_navigation_1.writeDokkanFyiAcquisitionNavigation)();
    const dataset = await (0, fyi_acquisition_navigation_1.getDokkanFyiAcquisitionNavigation)();
    console.log(JSON.stringify({
        outputPath,
        sourceCount: dataset.sourceCount,
        firstEntry: dataset.entries[0] ? {
            sourceKey: dataset.entries[0].sourceKey,
            targetKind: dataset.entries[0].target.kind,
        } : null,
    }, null, 2));
}
main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
//# sourceMappingURL=fyi-acquisition-navigation-run.js.map