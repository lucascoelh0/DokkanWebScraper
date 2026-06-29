"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fyi_categories_1 = require("./fyi-categories");
const fyi_category_context_1 = require("./fyi-category-context");
const fyi_team_context_1 = require("./fyi-team-context");
const fyi_category_roster_1 = require("./fyi-category-roster");
async function main() {
    const categoriesPath = await (0, fyi_categories_1.writeDokkanFyiCategories)();
    const categoryContextPath = await (0, fyi_category_context_1.writeDokkanFyiCategoryContext)();
    const teamContextPath = await (0, fyi_team_context_1.writeDokkanFyiTeamContext)();
    const categoryRosterPath = await (0, fyi_category_roster_1.writeDokkanFyiCategoryRoster)();
    const [categories, categoryContext, teamContext, categoryRoster] = await Promise.all([
        (0, fyi_categories_1.getDokkanFyiCategories)(),
        (0, fyi_category_context_1.getDokkanFyiCategoryContext)(),
        (0, fyi_team_context_1.getDokkanFyiTeamContext)(),
        (0, fyi_category_roster_1.getDokkanFyiCategoryRoster)(),
    ]);
    const uncategorizedCharacters = categoryContext.characters.filter(character => character.categoryIds.length === 0);
    console.log(JSON.stringify({
        outputPaths: {
            categoriesPath,
            categoryContextPath,
            teamContextPath,
            categoryRosterPath,
        },
        counts: {
            categories: categories.count,
            categoryContextCharacters: categoryContext.characterCount,
            teamContextCharacters: teamContext.characterCount,
            categoryRosterMembers: categoryRoster.memberCharacterCount,
            uncategorizedCharacters: uncategorizedCharacters.length,
        },
        uncategorizedSample: uncategorizedCharacters.slice(0, 10).map(character => ({
            id: character.id,
            name: character.name,
            title: character.title,
        })),
        firstCategory: categoryRoster.categories[0] ? {
            id: categoryRoster.categories[0].id,
            name: categoryRoster.categories[0].name,
            leaders: categoryRoster.categories[0].leaderCount,
            supportUnits: categoryRoster.categories[0].supportUnitCount,
            members: categoryRoster.categories[0].memberCount,
        } : null,
    }, null, 2));
}
main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
//# sourceMappingURL=fyi-category-stack-run.js.map