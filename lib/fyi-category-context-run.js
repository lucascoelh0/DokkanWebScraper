"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fyi_category_context_1 = require("./fyi-category-context");
async function main() {
    const outputPath = await (0, fyi_category_context_1.writeDokkanFyiCategoryContext)();
    const dataset = await (0, fyi_category_context_1.getDokkanFyiCategoryContext)();
    console.log(JSON.stringify({
        outputPath,
        categoryCount: dataset.categoryCount,
        supportMemoryCount: dataset.supportMemoryCount,
        characterCount: dataset.characterCount,
        firstCharacter: dataset.characters[0] ? {
            id: dataset.characters[0].id,
            categories: dataset.characters[0].categoryIds.length,
            applicableSupportMemories: dataset.characters[0].applicableSupportMemoryIds.length,
        } : null,
    }, null, 2));
}
main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
//# sourceMappingURL=fyi-category-context-run.js.map