"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fyi_mission_catalog_1 = require("./fyi-mission-catalog");
async function main() {
    const outputPath = await (0, fyi_mission_catalog_1.writeDokkanFyiMissionCatalog)();
    const dataset = await (0, fyi_mission_catalog_1.getDokkanFyiMissionCatalog)();
    console.log(JSON.stringify({
        outputPath,
        groupCount: dataset.groupCount,
        missionCount: dataset.missionCount,
        rewardCount: dataset.rewardCount,
        characterRefCount: dataset.characterRefCount,
    }, null, 2));
}
main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
//# sourceMappingURL=fyi-mission-catalog-run.js.map