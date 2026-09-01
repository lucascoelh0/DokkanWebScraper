import { writeDokkanInfoFrontier } from "./dokkaninfo-frontier";

writeDokkanInfoFrontier()
    .then(path => console.log(`Wrote Dokkan Frontier catalog to ${path}`))
    .catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
