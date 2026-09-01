"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dokkaninfo_burst_mode_1 = require("./dokkaninfo-burst-mode");
(0, dokkaninfo_burst_mode_1.writeDokkanInfoBurstModes)()
    .then(path => console.log(`Wrote Burst Mode catalog to ${path}`))
    .catch(error => {
    console.error(error);
    process.exitCode = 1;
});
//# sourceMappingURL=dokkaninfo-burst-mode-run.js.map