import { getDokkanFyiCategoryContext, writeDokkanFyiCategoryContext } from "./fyi-category-context";

async function main() {
    const outputPath = await writeDokkanFyiCategoryContext();
    const dataset = await getDokkanFyiCategoryContext();
    const uncategorizedCharacters = dataset.characters.filter(character => character.categoryIds.length === 0);

    console.log(JSON.stringify({
        outputPath,
        categoryCount: dataset.categoryCount,
        supportMemoryCount: dataset.supportMemoryCount,
        characterCount: dataset.characterCount,
        uncategorizedCharacterCount: uncategorizedCharacters.length,
        uncategorizedSample: uncategorizedCharacters.slice(0, 10).map(character => ({
            id: character.id,
            name: character.name,
            title: character.title,
        })),
        firstCharacter: dataset.characters[0] ? {
            id: dataset.characters[0].id,
            categories: dataset.characters[0].categoryIds.length,
            applicableSupportMemories: dataset.characters[0].applicableSupportMemoryIds.length,
        } : null,
    }, null, 2));
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
