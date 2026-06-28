"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fyi_categories_1 = require("./fyi-categories");
async function main() {
    const outputPath = await (0, fyi_categories_1.writeDokkanFyiCategories)();
    console.log(`Wrote dokkan.fyi categories dataset to ${outputPath}`);
}
if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
//# sourceMappingURL=fyi-categories-run.js.map