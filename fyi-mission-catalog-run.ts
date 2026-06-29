import { getDokkanFyiMissionCatalog, writeDokkanFyiMissionCatalog } from "./fyi-mission-catalog";

async function main() {
    const outputPath = await writeDokkanFyiMissionCatalog();
    const dataset = await getDokkanFyiMissionCatalog();

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
