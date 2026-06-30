"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fyi_categories_1 = require("./fyi-categories");
async function main() {
    const outputPath = await (0, fyi_categories_1.writeDokkanFyiCategories)();
    const dataset = await (0, fyi_categories_1.getDokkanFyiCategories)();
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
//# sourceMappingURL=fyi-categories-run.js.map