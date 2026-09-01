import { writeDokkanInfoDbStories } from "./dokkaninfo-db-stories";

async function main() {
    const outputPath = await writeDokkanInfoDbStories();
    console.log(`Wrote DokkanInfo DB Stories dataset to ${outputPath}`);
}

if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
