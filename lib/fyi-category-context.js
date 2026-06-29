"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCategoryContextDataset = exports.writeDokkanFyiCategoryContext = exports.getDokkanFyiCategoryContext = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
const zlib_1 = require("zlib");
const format_json_1 = require("./format-json");
const CHARACTERS_GZIP_RELATIVE_PATH = "data/latest/characters.json.gz";
const CHARACTERS_JSON_FALLBACK_RELATIVE_PATH = "data/characters.json";
async function getDokkanFyiCategoryContext() {
    const [categories, supportMemories, characters] = await Promise.all([
        readJsonFile("data/categories/latest/categories.json"),
        readJsonFile("data/support-memories/latest/support-memories.json"),
        readCharacterDataset(),
    ]);
    return buildCategoryContextDataset({
        categories,
        supportMemories,
        characters,
    });
}
exports.getDokkanFyiCategoryContext = getDokkanFyiCategoryContext;
async function writeDokkanFyiCategoryContext() {
    const dataset = await getDokkanFyiCategoryContext();
    const outputDir = (0, path_1.resolve)(__dirname, "data/category-context/latest");
    const outputPath = (0, path_1.resolve)(outputDir, "category-context.json");
    await (0, promises_1.mkdir)(outputDir, { recursive: true });
    await (0, format_json_1.writeFormattedJson)(outputPath, dataset);
    return outputPath;
}
exports.writeDokkanFyiCategoryContext = writeDokkanFyiCategoryContext;
function buildCategoryContextDataset(input) {
    const supportMemoryNameToId = new Map(input.supportMemories.supportMemories.map(memory => [normalizeKey(memory.name), memory.id]));
    const normalizedCategories = input.categories.categories.map(category => mapCategoryContextEntry(category, supportMemoryNameToId));
    const categoryNameToId = buildCategoryNameIndex(normalizedCategories);
    const categoryNameById = new Map(normalizedCategories.map(category => [category.id, category.name]));
    const memberCategoryIdsByCharacterId = buildMemberCategoryIndex(input.categories.categories);
    const supportMemoryContextsById = new Map();
    for (const memory of input.supportMemories.supportMemories) {
        supportMemoryContextsById.set(memory.id, {
            id: memory.id,
            name: memory.name,
            categoryIds: [],
            categoryNames: [],
            applicableCharacterIds: [],
        });
    }
    for (const category of input.categories.categories) {
        for (const memoryRef of category.supportMemories) {
            const memoryId = supportMemoryNameToId.get(normalizeKey(memoryRef.name)) || memoryRef.id;
            const existing = supportMemoryContextsById.get(memoryId);
            if (!existing) {
                supportMemoryContextsById.set(memoryId, {
                    id: memoryId,
                    name: memoryRef.name,
                    categoryIds: [category.id],
                    categoryNames: [category.name],
                    applicableCharacterIds: [],
                });
                continue;
            }
            pushUnique(existing.categoryIds, category.id);
            pushUnique(existing.categoryNames, category.name);
        }
    }
    const supportMemoryIdsByCategoryId = new Map([...supportMemoryContextsById.values()].flatMap(memory => memory.categoryIds.map(categoryId => [`${categoryId}:${memory.id}`, { categoryId, memoryId: memory.id }])));
    const categorySupportMemoryIndex = new Map();
    for (const relation of supportMemoryIdsByCategoryId.values()) {
        const current = categorySupportMemoryIndex.get(relation.categoryId) ?? [];
        current.push(relation.memoryId);
        categorySupportMemoryIndex.set(relation.categoryId, current);
    }
    const characters = input.characters
        .map(character => mapCharacterCategoryContextEntry(character, categoryNameToId, categoryNameById, input.categories.categories, memberCategoryIdsByCharacterId))
        .sort(compareCharacterContext);
    for (const character of characters) {
        const memoryIds = new Set();
        for (const categoryId of character.categoryIds) {
            for (const memoryId of categorySupportMemoryIndex.get(categoryId) ?? []) {
                memoryIds.add(memoryId);
                const memoryContext = supportMemoryContextsById.get(memoryId);
                if (memoryContext) {
                    pushUnique(memoryContext.applicableCharacterIds, character.id);
                }
            }
        }
        character.applicableSupportMemoryIds = [...memoryIds].sort(compareIds);
    }
    const supportMemories = [...supportMemoryContextsById.values()]
        .map(memory => ({
        ...memory,
        categoryIds: [...memory.categoryIds].sort(compareIds),
        categoryNames: [...memory.categoryNames].sort((left, right) => left.localeCompare(right)),
        applicableCharacterIds: [...memory.applicableCharacterIds].sort(compareIds),
    }))
        .sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
    return {
        generatedAt: new Date().toISOString(),
        source: "dokkan.fyi",
        categoryCount: normalizedCategories.length,
        supportMemoryCount: supportMemories.length,
        characterCount: characters.length,
        categories: normalizedCategories.sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id)),
        supportMemories,
        characters,
    };
}
exports.buildCategoryContextDataset = buildCategoryContextDataset;
function mapCategoryContextEntry(category, supportMemoryNameToId) {
    return {
        id: category.id,
        name: category.name,
        leaderIds: uniqueSortedIds(category.leaders.map(character => character.id)),
        supportIds: uniqueSortedIds(category.support.map(character => character.id)),
        supportMemoryIds: uniqueSortedIds(category.supportMemories.map(memory => supportMemoryNameToId.get(normalizeKey(memory.name)) || memory.id)),
    };
}
function mapCharacterCategoryContextEntry(character, categoryNameToId, categoryNameById, categories, memberCategoryIdsByCharacterId) {
    const categoryIds = uniqueSortedIds([
        ...(memberCategoryIdsByCharacterId.get(character.id) ?? []),
        ...(character.categories ?? [])
            .map(name => categoryNameToId.get(normalizeKey(name)))
            .filter(Boolean),
    ]);
    const leaderOfCategoryIds = uniqueSortedIds(categories
        .filter(category => category.leaders.some(leader => leader.id === character.id))
        .map(category => category.id));
    const supportOfCategoryIds = uniqueSortedIds(categories
        .filter(category => category.support.some(support => support.id === character.id))
        .map(category => category.id));
    return {
        id: character.id,
        name: character.name,
        title: character.title,
        categoryIds,
        categoryNames: uniqueSortedNames([
            ...categoryIds.map(id => categoryNameById.get(id)).filter(Boolean),
            ...(character.categories ?? []),
        ]),
        leaderOfCategoryIds,
        supportOfCategoryIds,
        applicableSupportMemoryIds: [],
    };
}
function buildCategoryNameIndex(categories) {
    return new Map(categories.map(category => [normalizeKey(category.name), category.id]));
}
function normalizeKey(value) {
    return (value ?? "").trim().toLocaleLowerCase();
}
function uniqueSortedIds(values) {
    return [...new Set(values.filter(Boolean))].sort(compareIds);
}
function uniqueSortedNames(values) {
    return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}
function compareIds(left, right) {
    return left.localeCompare(right);
}
function compareCharacterContext(left, right) {
    return left.name.localeCompare(right.name)
        || (left.title || "").localeCompare(right.title || "")
        || left.id.localeCompare(right.id);
}
function pushUnique(values, value) {
    if (!value || values.includes(value)) {
        return;
    }
    values.push(value);
}
function buildMemberCategoryIndex(categories) {
    const index = new Map();
    for (const category of categories) {
        for (const member of category.members ?? []) {
            const existing = index.get(member.id) ?? [];
            existing.push(category.id);
            index.set(member.id, existing);
        }
    }
    return new Map([...index.entries()].map(([characterId, categoryIds]) => [characterId, uniqueSortedIds(categoryIds)]));
}
async function readCharacterDataset() {
    const gzipPath = (0, path_1.resolve)(__dirname, CHARACTERS_GZIP_RELATIVE_PATH);
    try {
        const gzipBuffer = await (0, promises_1.readFile)(gzipPath);
        return JSON.parse((0, zlib_1.gunzipSync)(gzipBuffer).toString("utf8"));
    }
    catch (error) {
        const fallbackPath = (0, path_1.resolve)(__dirname, CHARACTERS_JSON_FALLBACK_RELATIVE_PATH);
        const raw = await (0, promises_1.readFile)(fallbackPath, { encoding: "utf8" });
        return JSON.parse(raw);
    }
}
async function readJsonFile(relativePath) {
    const filePath = (0, path_1.resolve)(__dirname, relativePath);
    const raw = await (0, promises_1.readFile)(filePath, { encoding: "utf8" });
    return JSON.parse(raw);
}
//# sourceMappingURL=fyi-category-context.js.map