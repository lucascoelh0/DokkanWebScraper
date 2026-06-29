import { getDokkanFyiCategories, writeDokkanFyiCategories } from "./fyi-categories";
import { getDokkanFyiCategoryContext, writeDokkanFyiCategoryContext } from "./fyi-category-context";
import { getDokkanFyiTeamContext, writeDokkanFyiTeamContext } from "./fyi-team-context";
import { getDokkanFyiCategoryRoster, writeDokkanFyiCategoryRoster } from "./fyi-category-roster";

async function main() {
    const categoriesPath = await writeDokkanFyiCategories();
    const categoryContextPath = await writeDokkanFyiCategoryContext();
    const teamContextPath = await writeDokkanFyiTeamContext();
    const categoryRosterPath = await writeDokkanFyiCategoryRoster();

    const [categories, categoryContext, teamContext, categoryRoster] = await Promise.all([
        getDokkanFyiCategories(),
        getDokkanFyiCategoryContext(),
        getDokkanFyiTeamContext(),
        getDokkanFyiCategoryRoster(),
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
