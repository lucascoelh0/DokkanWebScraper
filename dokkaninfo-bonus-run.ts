import { writeDokkanInfoBonusEvents } from "./dokkaninfo-db-stories";

async function run(): Promise<void> {
    const outputPath = await writeDokkanInfoBonusEvents();
    console.log(`Wrote DokkanInfo Bonus dataset to ${outputPath}`);
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
