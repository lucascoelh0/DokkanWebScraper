"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dokkaninfo_ultimate_clash_1 = require("./dokkaninfo-ultimate-clash");
(0, dokkaninfo_ultimate_clash_1.writeDokkanInfoUltimateClashes)()
    .then(path => console.log(`Wrote Ultimate Clash catalog to ${path}`))
    .catch(error => {
    console.error(error);
    process.exitCode = 1;
});
//# sourceMappingURL=dokkaninfo-ultimate-clash-run.js.map