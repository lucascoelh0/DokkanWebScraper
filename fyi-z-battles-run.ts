import { writeDokkanFyiZBattles } from "./fyi-z-battles";

async function main() {
    const outputPath = await writeDokkanFyiZBattles();
    console.log(`Wrote dokkan.fyi z-battles dataset to ${outputPath}`);
}

if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
