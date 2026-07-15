import { writeDokkanInfoEventRewards } from "./dokkaninfo-event-rewards";

async function main() {
    const dataset = await writeDokkanInfoEventRewards();
    console.log(`Wrote DokkanInfo event reward dataset to ${dataset}`);
}

if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
