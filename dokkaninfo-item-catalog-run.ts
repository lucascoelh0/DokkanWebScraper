import { getDokkanInfoItemCatalog, writeDokkanInfoItemCatalog } from "./dokkaninfo-item-catalog-scraper";

async function main() {
    const dataset = await getDokkanInfoItemCatalog();
    const outputPath = await writeDokkanInfoItemCatalog(dataset);

    console.log(JSON.stringify({
        outputPath,
        categoryCount: dataset.categoryCount,
        itemCount: dataset.itemCount,
        failedCategorySlugs: dataset.failedCategorySlugs,
        categories: dataset.categories.map(category => ({
            slug: category.slug,
            itemType: category.itemType,
            count: category.count,
        })),
    }, null, 2));
}

if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
