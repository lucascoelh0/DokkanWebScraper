import { writeDokkanFyiSummons } from "./fyi-summons";

async function main() {
    const { indexPath, detailsPath } = await writeDokkanFyiSummons();
    console.log(`Wrote dokkan.fyi summons index to ${indexPath}`);
    console.log(`Wrote dokkan.fyi summons details to ${detailsPath}`);
}

if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
