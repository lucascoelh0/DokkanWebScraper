"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fyi_support_memories_1 = require("./fyi-support-memories");
async function main() {
    const outputPath = await (0, fyi_support_memories_1.writeDokkanFyiSupportMemories)();
    console.log(`Wrote dokkan.fyi support memories dataset to ${outputPath}`);
}
if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
//# sourceMappingURL=fyi-support-memories-run.js.map