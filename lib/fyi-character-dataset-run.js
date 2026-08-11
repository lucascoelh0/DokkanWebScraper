"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fyi_character_dataset_1 = require("./fyi-character-dataset");
async function main() {
    const result = await (0, fyi_character_dataset_1.runDokkanFyiCharacterDataset)((0, fyi_character_dataset_1.parseFyiCharacterDatasetCli)(process.argv.slice(2)));
    console.log(JSON.stringify({
        datasetPath: result.datasetPath,
        manifestPath: result.manifestPath,
        reportPath: result.reportPath,
        candidateReport: result.candidateReport,
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