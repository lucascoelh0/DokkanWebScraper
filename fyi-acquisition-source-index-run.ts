import { getDokkanFyiAcquisitionSourceIndex, writeDokkanFyiAcquisitionSourceIndex } from "./fyi-acquisition-source-index";

async function main() {
    const outputPath = await writeDokkanFyiAcquisitionSourceIndex();
    const dataset = await getDokkanFyiAcquisitionSourceIndex();

    console.log(JSON.stringify({
        outputPath,
        sourceCount: dataset.sourceCount,
        rewardCount: dataset.rewardCount,
        firstSource: dataset.sources[0] ? {
            key: dataset.sources[0].key,
            groupKey: dataset.sources[0].groupKey,
            rewardCount: dataset.sources[0].rewardCount,
        } : null,
    }, null, 2));
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
