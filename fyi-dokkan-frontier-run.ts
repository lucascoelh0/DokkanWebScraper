import { writeDokkanFyiFrontierDatasets } from "./fyi-dokkan-frontier";

async function main() {
    const output = await writeDokkanFyiFrontierDatasets();
    console.log(`Wrote dokkan.fyi frontier series dataset to ${output.seriesPath}`);
    console.log(`Wrote dokkan.fyi frontier chapters dataset to ${output.chaptersPath}`);
}

if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
