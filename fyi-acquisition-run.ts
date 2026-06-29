import { getDokkanFyiAcquisitionDataset, writeDokkanFyiAcquisitionDataset } from "./fyi-acquisition";

async function main() {
    const outputPath = await writeDokkanFyiAcquisitionDataset();
    const dataset = await getDokkanFyiAcquisitionDataset();

    console.log(JSON.stringify({
        outputPath,
        itemCount: dataset.itemCount,
        sourceCount: dataset.sourceCount,
        firstItem: dataset.items[0] ? {
            key: dataset.items[0].key,
            sourceCount: dataset.items[0].sources.length,
            firstSource: dataset.items[0].sources[0]?.kind,
        } : null,
    }, null, 2));
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
