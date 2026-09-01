"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dokkaninfo_z_battles_1 = require("./dokkaninfo-z-battles");
async function run() {
    const outputPath = await (0, dokkaninfo_z_battles_1.writeDokkanInfoZBattles)();
    console.log(`Wrote DokkanInfo Z-Battle dataset to ${outputPath}`);
}
run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
//# sourceMappingURL=dokkaninfo-z-battles-run.js.map