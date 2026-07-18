import { writeDokkanFyiCharacterCatalog } from "./fyi-character-catalog";

async function main() {
    const { outputPath, dataset } = await writeDokkanFyiCharacterCatalog();

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
