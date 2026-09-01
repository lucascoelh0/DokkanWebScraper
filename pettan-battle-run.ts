import { writePettanBattleCatalog } from "./pettan-battle-catalog";

async function run(): Promise<void> {
    const outputPath = await writePettanBattleCatalog();
    console.log(`Wrote Pettan Battle catalog to ${outputPath}`);
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
