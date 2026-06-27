"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fyi_summons_1 = require("./fyi-summons");
async function main() {
    const { indexPath, detailsPath } = await (0, fyi_summons_1.writeDokkanFyiSummons)();
    console.log(`Wrote dokkan.fyi summons index to ${indexPath}`);
    console.log(`Wrote dokkan.fyi summons details to ${detailsPath}`);
}
if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
//# sourceMappingURL=fyi-summons-run.js.map