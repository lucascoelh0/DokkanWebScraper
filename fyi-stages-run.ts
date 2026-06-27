import { writeDokkanFyiStageDatasets } from "./fyi-stages";

async function main() {
    const { questStoryPath, eventStagesPath } = await writeDokkanFyiStageDatasets();
    console.log(`Wrote dokkan.fyi quest story stages to ${questStoryPath}`);
    console.log(`Wrote dokkan.fyi event stages to ${eventStagesPath}`);
}

if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
