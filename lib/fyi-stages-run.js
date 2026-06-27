"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fyi_stages_1 = require("./fyi-stages");
async function main() {
    const { questStoryPath, eventStagesPath } = await (0, fyi_stages_1.writeDokkanFyiStageDatasets)();
    console.log(`Wrote dokkan.fyi quest story stages to ${questStoryPath}`);
    console.log(`Wrote dokkan.fyi event stages to ${eventStagesPath}`);
}
if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
//# sourceMappingURL=fyi-stages-run.js.map