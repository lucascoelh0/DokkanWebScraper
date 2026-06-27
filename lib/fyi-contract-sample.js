"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fyi_scraper_1 = require("./fyi-scraper");
async function main() {
    const outputPath = await (0, fyi_scraper_1.writeDokkanFyiContractReferenceSample)();
    console.log(`Wrote dokkan.fyi contract sample to ${outputPath}`);
}
if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
//# sourceMappingURL=fyi-contract-sample.js.map