"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pettan_battle_catalog_1 = require("./pettan-battle-catalog");
async function run() {
    const outputPath = await (0, pettan_battle_catalog_1.writePettanBattleCatalog)();
    console.log(`Wrote Pettan Battle catalog to ${outputPath}`);
}
run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
//# sourceMappingURL=pettan-battle-run.js.map