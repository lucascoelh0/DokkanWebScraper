"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fyi_character_catalog_1 = require("./fyi-character-catalog");
async function main() {
    const { outputPath, dataset } = await (0, fyi_character_catalog_1.writeDokkanFyiCharacterCatalog)();
    console.log(JSON.stringify({
        outputPath,
        pageCount: dataset.pageCount,
        isComplete: dataset.isComplete,
        candidateCount: dataset.candidateCount,
        characterCount: dataset.characterCount,
        awakeningLineCount: dataset.awakeningLineCount,
        duplicateGroupCount: dataset.duplicateGroupCount,
        failedPages: dataset.failedPages,
    }, null, 2));
}
if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
//# sourceMappingURL=fyi-character-catalog-run.js.map