import { writeDokkanInfoQuestAreas } from "./dokkaninfo-db-stories";

async function run(): Promise<void> {
    const outputPath = await writeDokkanInfoQuestAreas();
    console.log(`Wrote DokkanInfo Quest dataset to ${outputPath}`);
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
