import { writeDokkanInfoStories } from "./dokkaninfo-db-stories";

async function main() {
    const outputPath = await writeDokkanInfoStories();
    console.log(`Wrote DokkanInfo Story dataset to ${outputPath}`);
}

if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
