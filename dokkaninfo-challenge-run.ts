import { writeDokkanInfoChallengeEvents } from "./dokkaninfo-db-stories";

async function run(): Promise<void> {
    const outputPath = await writeDokkanInfoChallengeEvents();
    console.log(`Wrote DokkanInfo Challenge dataset to ${outputPath}`);
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
