import { parseFyiCharacterDatasetCli, runDokkanFyiCharacterDataset } from "./fyi-character-dataset";

async function main() {
    const result = await runDokkanFyiCharacterDataset(parseFyiCharacterDatasetCli(process.argv.slice(2)));
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
