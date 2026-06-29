import { writeDokkanFyiPanelMissions } from "./fyi-panel-missions";

async function main() {
    const outputPath = await writeDokkanFyiPanelMissions();
    console.log(`Wrote dokkan.fyi panel missions dataset to ${outputPath}`);
}

if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
