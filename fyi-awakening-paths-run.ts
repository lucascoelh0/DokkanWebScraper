import { writeDokkanFyiAwakeningDatasets } from "./fyi-awakening-paths";

async function main() {
    const output = await writeDokkanFyiAwakeningDatasets();
    console.log(`Wrote dokkan.fyi awakening paths dataset to ${output.pathsPath}`);
    console.log(`Wrote dokkan.fyi awakening medals dataset to ${output.medalsPath}`);
}

if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
