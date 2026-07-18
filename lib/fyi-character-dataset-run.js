"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fyi_character_dataset_1 = require("./fyi-character-dataset");
async function main() {
    const result = await (0, fyi_character_dataset_1.runDokkanFyiCharacterDataset)();
    console.log(JSON.stringify({
        datasetPath: result.datasetPath,
        manifestPath: result.manifestPath,
        reportPath: result.reportPath,
        ...result.report,
    }, null, 2));
}
if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
//# sourceMappingURL=fyi-character-dataset-run.js.map