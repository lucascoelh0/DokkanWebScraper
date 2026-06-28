import { writeDokkanFyiWallpapers } from "./fyi-wallpapers";

async function main() {
    const outputPath = await writeDokkanFyiWallpapers();
    console.log(`Wrote dokkan.fyi wallpapers dataset to ${outputPath}`);
}

if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
