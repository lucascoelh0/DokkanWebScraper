"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = require("fs/promises");
const path_1 = require("path");
const DEFAULT_CATEGORY_SELECTORS = [
    "21",
    "80",
    "2",
    "17",
    "29", // Movie Heroes
];
async function main() {
    const [categories, categoryContext, teamContext, categoryRoster] = await Promise.all([
        readJsonFile("data/categories/latest/categories.json"),
        readJsonFile("data/category-context/latest/category-context.json"),
        readJsonFile("data/team-context/latest/team-context.json"),
        readJsonFile("data/category-roster/latest/category-roster.json"),
    ]);
    const requestedSelectors = requestedCategorySelectors();
    const categoryIds = resolveCategoryIds(requestedSelectors, categories);
    const validations = categoryIds.map(categoryId => {
        const category = categories.categories.find(entry => entry.id === categoryId);
        const context = categoryContext.categories.find(entry => entry.id === categoryId);
        const team = teamContext.categories.find(entry => entry.id === categoryId);
        const roster = categoryRoster.categories.find(entry => entry.id === categoryId);
        return {
            id: categoryId,
            name: category?.name || context?.name || team?.name || roster?.name || categoryId,
            categoriesDataset: category ? summarizeCategoryDatasetEntry(category) : null,
            categoryContext: context ? summarizeCategoryContextEntry(context, categoryContext) : null,
            teamContext: team ? summarizeTeamContextEntry(team) : null,
            categoryRoster: roster ? summarizeCategoryRosterEntry(roster) : null,
        };
    });
    console.log(JSON.stringify({
        selectors: requestedSelectors,
        resolvedCategoryIds: categoryIds,
        validationCount: validations.length,
        validations,
    }, null, 2));
}
function requestedCategorySelectors() {
    const raw = process.env.DOKKAN_FYI_VALIDATE_CATEGORIES?.trim();
    if (!raw) {
        return DEFAULT_CATEGORY_SELECTORS;
    }
    return raw
        .split(",")
        .map(value => value.trim())
        .filter(Boolean);
}
function resolveCategoryIds(selectors, categories) {
    const byId = new Map(categories.categories.map(category => [category.id, category.id]));
    const byName = new Map(categories.categories.map(category => [normalizeKey(category.name), category.id]));
    return selectors.map(selector => byId.get(selector)
        || byName.get(normalizeKey(selector))
        || selector);
}
function summarizeCategoryDatasetEntry(category) {
    return {
        leaders: summarizeCharacterRefs(category.leaders),
        support: summarizeCharacterRefs(category.support),
        supportMemories: summarizeSupportMemoryRefs(category.supportMemories),
    };
}
function summarizeCategoryContextEntry(category, dataset) {
    return {
        leaderIds: summarizeIds(category.leaderIds),
        supportIds: summarizeIds(category.supportIds),
        supportMemoryIds: summarizeIds(category.supportMemoryIds),
        applicableCharacterCount: dataset.characters.filter(character => character.categoryIds.includes(category.id)).length,
    };
}
function summarizeTeamContextEntry(category) {
    return {
        leaders: summarizeCharacterRefs(category.leaders),
        supportUnits: summarizeCharacterRefs(category.supportUnits),
        supportMemories: summarizeSupportMemoryRefs(category.supportMemories),
    };
}
function summarizeCategoryRosterEntry(category) {
    return {
        memberCount: category.memberCount,
        leaderCount: category.leaderCount,
        supportUnitCount: category.supportUnitCount,
        supportMemoryCount: category.supportMemoryCount,
        memberSample: category.members.slice(0, 10).map(member => ({
            id: member.id,
            name: member.name,
            latestReleaseType: member.latestReleaseType,
            isLeader: member.isLeader,
            isSupportUnit: member.isSupportUnit,
        })),
    };
}
function summarizeCharacterRefs(values) {
    return {
        count: values.length,
        sample: values.slice(0, 10).map(value => ({
            id: value.id,
            name: value.name,
        })),
    };
}
function summarizeSupportMemoryRefs(values) {
    return {
        count: values.length,
        sample: values.slice(0, 10).map(value => ({
            id: value.id,
            name: value.name,
        })),
    };
}
function summarizeIds(values) {
    return {
        count: values.length,
        sample: values.slice(0, 10),
    };
}
function normalizeKey(value) {
    return (value ?? "").trim().toLocaleLowerCase();
}
async function readJsonFile(relativePath) {
    const filePath = (0, path_1.resolve)(__dirname, relativePath);
    const raw = await (0, promises_1.readFile)(filePath, { encoding: "utf8" });
    return JSON.parse(raw);
}
main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
//# sourceMappingURL=fyi-category-validation-run.js.map