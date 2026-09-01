import { writeDokkanInfoGrowthEvents } from "./dokkaninfo-db-stories";

async function run(): Promise<void> {
    const outputPath = await writeDokkanInfoGrowthEvents();
    console.log(`Wrote DokkanInfo Growth dataset to ${outputPath}`);
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
