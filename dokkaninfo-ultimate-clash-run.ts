import { writeDokkanInfoUltimateClashes } from "./dokkaninfo-ultimate-clash";

writeDokkanInfoUltimateClashes()
    .then(path => console.log(`Wrote Ultimate Clash catalog to ${path}`))
    .catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
