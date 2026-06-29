"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fyi_team_context_1 = require("./fyi-team-context");
async function main() {
    const outputPath = await (0, fyi_team_context_1.writeDokkanFyiTeamContext)();
    const dataset = await (0, fyi_team_context_1.getDokkanFyiTeamContext)();
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
//# sourceMappingURL=fyi-team-context-run.js.map