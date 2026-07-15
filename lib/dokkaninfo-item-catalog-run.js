"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dokkaninfo_item_catalog_scraper_1 = require("./dokkaninfo-item-catalog-scraper");
async function main() {
    const dataset = await (0, dokkaninfo_item_catalog_scraper_1.getDokkanInfoItemCatalog)();
    const outputPath = await (0, dokkaninfo_item_catalog_scraper_1.writeDokkanInfoItemCatalog)(dataset);
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
//# sourceMappingURL=dokkaninfo-item-catalog-run.js.map