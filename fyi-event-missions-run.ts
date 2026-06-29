import { writeDokkanFyiEventMissions } from "./fyi-event-missions";

async function main() {
    const outputPath = await writeDokkanFyiEventMissions();
    console.log(`Wrote dokkan.fyi event missions dataset to ${outputPath}`);
}

if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
