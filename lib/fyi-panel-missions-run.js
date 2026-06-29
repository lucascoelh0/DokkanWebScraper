"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fyi_panel_missions_1 = require("./fyi-panel-missions");
async function main() {
    const outputPath = await (0, fyi_panel_missions_1.writeDokkanFyiPanelMissions)();
    console.log(`Wrote dokkan.fyi panel missions dataset to ${outputPath}`);
}
if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
//# sourceMappingURL=fyi-panel-missions-run.js.map