import { writeDokkanInfoZBattles } from "./dokkaninfo-z-battles";

async function run(): Promise<void> {
    const outputPath = await writeDokkanInfoZBattles();
    console.log(`Wrote DokkanInfo Z-Battle dataset to ${outputPath}`);
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
