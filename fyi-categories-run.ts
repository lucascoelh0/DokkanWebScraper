import { getDokkanFyiCategories, writeDokkanFyiCategories } from "./fyi-categories";

async function main() {
    const outputPath = await writeDokkanFyiCategories();
    const dataset = await getDokkanFyiCategories();

    console.log(JSON.stringify({
        outputPath,
        categoryCount: dataset.count,
        firstCategory: dataset.categories[0]?.name ?? null,
        lastCategory: dataset.categories[dataset.categories.length - 1]?.name ?? null,
    }, null, 2));
}

if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
