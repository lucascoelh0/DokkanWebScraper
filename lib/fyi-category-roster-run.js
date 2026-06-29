"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fyi_category_roster_1 = require("./fyi-category-roster");
(async () => {
    const outputPath = await (0, fyi_category_roster_1.writeDokkanFyiCategoryRoster)();
    console.log(`Wrote dokkan.fyi category roster dataset to ${outputPath}`);
})();
//# sourceMappingURL=fyi-category-roster-run.js.map