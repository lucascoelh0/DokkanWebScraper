"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dokkaninfo_event_rewards_1 = require("./dokkaninfo-event-rewards");
async function main() {
    const dataset = await (0, dokkaninfo_event_rewards_1.writeDokkanInfoEventRewards)();
    console.log(`Wrote DokkanInfo event reward dataset to ${dataset}`);
}
if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
//# sourceMappingURL=dokkaninfo-event-rewards-run.js.map