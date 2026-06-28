import { writeDokkanFyiCategories } from "./fyi-categories";

async function main() {
    const outputPath = await writeDokkanFyiCategories();
    console.log(`Wrote dokkan.fyi categories dataset to ${outputPath}`);
}

if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
