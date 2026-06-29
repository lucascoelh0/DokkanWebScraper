"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fyi_awakening_paths_1 = require("./fyi-awakening-paths");
async function main() {
    const output = await (0, fyi_awakening_paths_1.writeDokkanFyiAwakeningDatasets)();
    console.log(`Wrote dokkan.fyi awakening paths dataset to ${output.pathsPath}`);
    console.log(`Wrote dokkan.fyi awakening medals dataset to ${output.medalsPath}`);
}
if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
//# sourceMappingURL=fyi-awakening-paths-run.js.map