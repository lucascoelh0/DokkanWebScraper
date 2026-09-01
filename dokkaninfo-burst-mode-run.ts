import { writeDokkanInfoBurstModes } from "./dokkaninfo-burst-mode";

writeDokkanInfoBurstModes()
    .then(path => console.log(`Wrote Burst Mode catalog to ${path}`))
    .catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
