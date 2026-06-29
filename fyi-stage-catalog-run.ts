import { getDokkanFyiStageCatalog, writeDokkanFyiStageCatalog } from "./fyi-stage-catalog";

async function main() {
    const outputPath = await writeDokkanFyiStageCatalog();
    const dataset = await getDokkanFyiStageCatalog();

    console.log(JSON.stringify({
        outputPath,
        groupCount: dataset.groupCount,
        entryCount: dataset.entryCount,
        firstEntry: dataset.entries[0] ? {
            key: dataset.entries[0].key,
            kind: dataset.entries[0].kind,
        } : null,
    }, null, 2));
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
