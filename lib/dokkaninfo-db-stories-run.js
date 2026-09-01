"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dokkaninfo_db_stories_1 = require("./dokkaninfo-db-stories");
async function main() {
    const outputPath = await (0, dokkaninfo_db_stories_1.writeDokkanInfoDbStories)();
    console.log(`Wrote DokkanInfo DB Stories dataset to ${outputPath}`);
}
if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
//# sourceMappingURL=dokkaninfo-db-stories-run.js.map