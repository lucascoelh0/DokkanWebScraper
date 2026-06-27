"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fyi_scraper_1 = require("./fyi-scraper");
async function main() {
    const { charactersPath, coveragePath } = await (0, fyi_scraper_1.writeDokkanFyiExperiment)();
    console.log(`Wrote dokkan.fyi experiment dataset to ${charactersPath}`);
    console.log(`Wrote dokkan.fyi coverage report to ${coveragePath}`);
}
if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
//# sourceMappingURL=fyi-experiment.js.map