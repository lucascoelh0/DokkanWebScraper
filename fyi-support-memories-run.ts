import { writeDokkanFyiSupportMemories } from "./fyi-support-memories";

async function main() {
    const outputPath = await writeDokkanFyiSupportMemories();
    console.log(`Wrote dokkan.fyi support memories dataset to ${outputPath}`);
}

if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
