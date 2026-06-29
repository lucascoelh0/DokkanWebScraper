import { getDokkanFyiTeamContext, writeDokkanFyiTeamContext } from "./fyi-team-context";

async function main() {
    const outputPath = await writeDokkanFyiTeamContext();
    const dataset = await getDokkanFyiTeamContext();

    console.log(JSON.stringify({
        outputPath,
        categoryCount: dataset.categoryCount,
        characterCount: dataset.characterCount,
        supportMemoryCount: dataset.supportMemoryCount,
        leaderCount: dataset.leaderCount,
        supportUnitCount: dataset.supportUnitCount,
    }, null, 2));
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
