"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dokkaninfo_frontier_1 = require("./dokkaninfo-frontier");
(0, dokkaninfo_frontier_1.writeDokkanInfoFrontier)()
    .then(path => console.log(`Wrote Dokkan Frontier catalog to ${path}`))
    .catch(error => {
    console.error(error);
    process.exitCode = 1;
});
//# sourceMappingURL=dokkaninfo-frontier-run.js.map