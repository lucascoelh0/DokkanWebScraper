import { writeDokkanInfoLimitedEvents } from "./dokkaninfo-db-stories";

async function run(): Promise<void> {
    const outputPath = await writeDokkanInfoLimitedEvents();
    console.log(`Wrote DokkanInfo Limited dataset to ${outputPath}`);
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
