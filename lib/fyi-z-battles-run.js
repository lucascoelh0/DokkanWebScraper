"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fyi_z_battles_1 = require("./fyi-z-battles");
async function main() {
    const outputPath = await (0, fyi_z_battles_1.writeDokkanFyiZBattles)();
    console.log(`Wrote dokkan.fyi z-battles dataset to ${outputPath}`);
}
if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
//# sourceMappingURL=fyi-z-battles-run.js.map