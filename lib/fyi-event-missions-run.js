"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fyi_event_missions_1 = require("./fyi-event-missions");
async function main() {
    const outputPath = await (0, fyi_event_missions_1.writeDokkanFyiEventMissions)();
    console.log(`Wrote dokkan.fyi event missions dataset to ${outputPath}`);
}
if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
//# sourceMappingURL=fyi-event-missions-run.js.map