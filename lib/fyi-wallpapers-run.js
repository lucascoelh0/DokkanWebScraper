"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fyi_wallpapers_1 = require("./fyi-wallpapers");
async function main() {
    const outputPath = await (0, fyi_wallpapers_1.writeDokkanFyiWallpapers)();
    console.log(`Wrote dokkan.fyi wallpapers dataset to ${outputPath}`);
}
if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
//# sourceMappingURL=fyi-wallpapers-run.js.map