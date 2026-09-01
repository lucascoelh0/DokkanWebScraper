"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dokkaninfo_db_stories_1 = require("./dokkaninfo-db-stories");
async function main() {
    const outputPath = await (0, dokkaninfo_db_stories_1.writeDokkanInfoStories)();
    console.log(`Wrote DokkanInfo Story dataset to ${outputPath}`);
}
if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
//# sourceMappingURL=dokkaninfo-stories-run.js.map