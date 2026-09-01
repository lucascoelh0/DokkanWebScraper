"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dokkaninfo_db_stories_1 = require("./dokkaninfo-db-stories");
async function run() {
    const outputPath = await (0, dokkaninfo_db_stories_1.writeDokkanInfoGrowthEvents)();
    console.log(`Wrote DokkanInfo Growth dataset to ${outputPath}`);
}
run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
//# sourceMappingURL=dokkaninfo-growth-run.js.map