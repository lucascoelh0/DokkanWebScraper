import { writeDokkanFyiExperiment } from "./fyi-scraper";

async function main() {
    const { charactersPath, coveragePath } = await writeDokkanFyiExperiment();
    console.log(`Wrote dokkan.fyi experiment dataset to ${charactersPath}`);
    console.log(`Wrote dokkan.fyi coverage report to ${coveragePath}`);
}

if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
