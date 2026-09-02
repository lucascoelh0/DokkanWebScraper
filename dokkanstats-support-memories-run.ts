import { writeDokkanStatsSupportMemoryDataset } from "./dokkanstats-support-memories";

async function main() {
    const output = await writeDokkanStatsSupportMemoryDataset();
    console.log(`Wrote DokkanStats Support Memory enrichment to ${output.outputPath}`);
    console.log(
        `${output.dataset.rootMemoryCount} roots / ${output.dataset.memoryLevelCount} levels; `
        + `${output.dataset.acquisitionSourceCount} acquisition sources for ${output.dataset.acquisitionMemoryCount} memories.`,
    );
}

if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
