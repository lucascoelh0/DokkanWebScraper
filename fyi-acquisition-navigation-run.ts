import { getDokkanFyiAcquisitionNavigation, writeDokkanFyiAcquisitionNavigation } from "./fyi-acquisition-navigation";

async function main() {
    const outputPath = await writeDokkanFyiAcquisitionNavigation();
    const dataset = await getDokkanFyiAcquisitionNavigation();

    console.log(JSON.stringify({
        outputPath,
        sourceCount: dataset.sourceCount,
        firstEntry: dataset.entries[0] ? {
            sourceKey: dataset.entries[0].sourceKey,
            targetKind: dataset.entries[0].target.kind,
        } : null,
    }, null, 2));
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
