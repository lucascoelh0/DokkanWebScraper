"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildTeamContextDataset = exports.writeDokkanFyiTeamContext = exports.getDokkanFyiTeamContext = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
const format_json_1 = require("./format-json");
async function getDokkanFyiTeamContext() {
    const [categories, categoryContext, supportMemories] = await Promise.all([
        readJsonFile("data/categories/latest/categories.json"),
        readJsonFile("data/category-context/latest/category-context.json"),
        readJsonFile("data/support-memories/latest/support-memories.json"),
    ]);
    return buildTeamContextDataset({
        categories,
        categoryContext,
        supportMemories,
    });
}
exports.getDokkanFyiTeamContext = getDokkanFyiTeamContext;
async function writeDokkanFyiTeamContext() {
    const dataset = await getDokkanFyiTeamContext();
    const outputDir = (0, path_1.resolve)(__dirname, "data/team-context/latest");
    const outputPath = (0, path_1.resolve)(outputDir, "team-context.json");
    await (0, promises_1.mkdir)(outputDir, { recursive: true });
    await (0, format_json_1.writeFormattedJson)(outputPath, dataset);
    return outputPath;
}
exports.writeDokkanFyiTeamContext = writeDokkanFyiTeamContext;
function buildTeamContextDataset(input) {
    const categoryDetailsById = new Map(input.categories.categories.map(category => [category.id, category]));
    const supportMemoryDetailsById = new Map(input.supportMemories.supportMemories.map(memory => [memory.id, memory]));
    const categoryNameById = new Map(input.categoryContext.categories.map(category => [category.id, category.name]));
    const categories = input.categoryContext.categories
        .map(category => mapTeamContextCategory(category, categoryDetailsById.get(category.id), supportMemoryDetailsById))
        .sort(compareCategoryEntries);
    const characters = input.categoryContext.characters
        .map(character => mapTeamContextCharacter(character, categoryNameById, supportMemoryDetailsById))
        .sort(compareCharacterEntries);
    const supportMemories = input.categoryContext.supportMemories
        .map(memory => mapTeamContextSupportMemory(memory, supportMemoryDetailsById.get(memory.id), categoryNameById))
        .sort(compareSupportMemoryEntries);
    const leaderCount = countUniqueCharacterIds(categories.flatMap(category => category.leaders.map(character => character.id)));
    const supportUnitCount = countUniqueCharacterIds(categories.flatMap(category => category.supportUnits.map(character => character.id)));
    return {
        generatedAt: new Date().toISOString(),
        source: "dokkan.fyi",
        categoryCount: categories.length,
        characterCount: characters.length,
        supportMemoryCount: supportMemories.length,
        leaderCount,
        supportUnitCount,
        categories,
        characters,
        supportMemories,
    };
}
exports.buildTeamContextDataset = buildTeamContextDataset;
function mapTeamContextCategory(context, details, supportMemoryDetailsById) {
    return {
        id: context.id,
        name: context.name,
        leaders: (details?.leaders ?? []).map(mapCharacterRef).sort(compareCharacterRefs),
        supportUnits: (details?.support ?? []).map(mapCharacterRef).sort(compareCharacterRefs),
        supportMemories: context.supportMemoryIds
            .map(id => mapSupportMemoryRef(supportMemoryDetailsById.get(id), id))
            .sort(compareSupportMemoryRefs),
    };
}
function mapTeamContextCharacter(context, categoryNameById, supportMemoryDetailsById) {
    return {
        id: context.id,
        name: context.name,
        title: context.title,
        categories: context.categoryIds.map(id => mapCategoryRef(id, categoryNameById)).sort(compareCategoryRefs),
        leaderOfCategories: context.leaderOfCategoryIds.map(id => mapCategoryRef(id, categoryNameById)).sort(compareCategoryRefs),
        supportOfCategories: context.supportOfCategoryIds.map(id => mapCategoryRef(id, categoryNameById)).sort(compareCategoryRefs),
        applicableSupportMemories: context.applicableSupportMemoryIds
            .map(id => mapSupportMemoryRef(supportMemoryDetailsById.get(id), id))
            .sort(compareSupportMemoryRefs),
    };
}
function mapTeamContextSupportMemory(context, details, categoryNameById) {
    return {
        id: context.id,
        name: details?.name || context.name,
        description: details?.description || "",
        filmId: details?.filmId,
        filmName: details?.film?.name,
        cost: details?.cost,
        unlockQuantity: details?.unlockQuantity,
        lastsEntireBattle: details?.lastsEntireBattle,
        maxLevel: details?.maxLevel ?? 1,
        categories: context.categoryIds.map(id => mapCategoryRef(id, categoryNameById)).sort(compareCategoryRefs),
        applicableCharacterIds: [...context.applicableCharacterIds].sort(compareStrings),
    };
}
function mapCategoryRef(id, categoryNameById) {
    return {
        id,
        name: categoryNameById.get(id) || id,
    };
}
function mapCharacterRef(character) {
    return {
        id: character.id,
        canonicalId: character.canonicalId,
        baseCharacterId: character.baseCharacterId,
        characterId: character.characterId,
        name: character.name,
        rarity: character.rarity,
        type: character.type,
        characterClass: character.characterClass,
        thumbnailId: character.thumbnailId,
        portraitUrl: character.portraitUrl,
        latestReleaseType: character.latestReleaseType,
        hasEza: character.hasEza,
        hasSeza: character.hasSeza,
        isReversiblyExchanged: character.isReversiblyExchanged,
        isFreelyObtainable: character.isFreelyObtainable,
        leaderSkillId: character.leaderSkillId,
        leaderSkillName: character.leaderSkillName,
        leaderSkillDescription: character.leaderSkillDescription,
    };
}
function mapSupportMemoryRef(memory, fallbackId) {
    return {
        id: memory?.id || fallbackId,
        name: memory?.name || fallbackId,
        description: memory?.description || "",
        filmId: memory?.filmId,
        filmName: memory?.film?.name,
        cost: memory?.cost,
        unlockQuantity: memory?.unlockQuantity,
        lastsEntireBattle: memory?.lastsEntireBattle,
        maxLevel: memory?.maxLevel,
    };
}
function countUniqueCharacterIds(values) {
    return new Set(values).size;
}
function compareStrings(left, right) {
    return left.localeCompare(right);
}
function compareCategoryRefs(left, right) {
    return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
}
function compareCharacterRefs(left, right) {
    return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
}
function compareSupportMemoryRefs(left, right) {
    return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
}
function compareCategoryEntries(left, right) {
    return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
}
function compareCharacterEntries(left, right) {
    return left.name.localeCompare(right.name)
        || (left.title || "").localeCompare(right.title || "")
        || left.id.localeCompare(right.id);
}
function compareSupportMemoryEntries(left, right) {
    return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
}
async function readJsonFile(relativePath) {
    const filePath = (0, path_1.resolve)(__dirname, relativePath);
    const raw = await (0, promises_1.readFile)(filePath, { encoding: "utf8" });
    return JSON.parse(raw);
}
//# sourceMappingURL=fyi-team-context.js.map