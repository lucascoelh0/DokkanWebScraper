import { writeDokkanFyiContractReferenceSample } from "./fyi-scraper";

async function main() {
    const outputPath = await writeDokkanFyiContractReferenceSample();
    console.log(`Wrote dokkan.fyi contract sample to ${outputPath}`);
}

if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
